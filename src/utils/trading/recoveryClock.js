// ============================================================
// RECOVERY CLOCK
//
// Offline recovery needs one thing from the live app: a UTC instant to count
// the lookback window back from. Getting it wrong is not a rounding error — an
// anchor taken from this machine's clock, or from a broker reading that belongs
// to another account, silently moves every window, and a window that starts
// after a trade closed loses that trade without any evidence that it did.
//
// Two rules keep the risk honest:
//
// 1. Only a number the bridge says came from an MT5 tick is usable. Phase 3S
//    added `broker_time_source` to /mt5/positions precisely because
//    `broker_time_msc` alone cannot tell the broker's clock from the bridge's
//    own `time.time()` fallback (mt5-bridge/app.py:1445-1570, :3266-3268). The
//    local fallback and any unrecognised marker are refused, not down-weighted.
// 2. The reading belongs to whichever account the terminal was connected to,
//    so it is only usable for that account. Identity is compared with the same
//    contract the adapter applies to its pages (its checkIdentity): a login
//    canonicalised to digits without leading zeros, and a server name trimmed
//    but compared exactly. Anything missing fails closed.
//
// Both functions are pure: `now` is a parameter, there is no clock, storage or
// network read anywhere in this file, and the 10 second window is measured
// against the client instant recorded when the response arrived — never against
// a fresh local reading that would hide an old sample.
//
// Known limit, deliberately not papered over: a tick's `time`/`time_msc` is
// what MetaTrader5 reports for that symbol, and the installed package does not
// document it as server wall time. This module therefore trusts the marker,
// never the assumption; an anchor here is good enough to bound a lookback, not
// to certify when a deal happened.
// ============================================================

const DIGITS_ONLY = /^[0-9]+$/;
const MAX_LOGIN_DIGITS = 15;

// The positions poll runs every 2000 ms (TradeContext.jsx MT5 polling), so 10
// seconds means about five consecutive failed polls. Past that the number on
// screen is the last one remembered, not the one the account holds, and a
// recovery window must not be planned from it.
export const RECOVERY_CLOCK_MAX_AGE_MS = 10_000;

// Exactly the four tick markers the bridge can emit, plus nothing. Every other
// value — including "local_wall_clock", the bridge's own fallback — is refused.
export const TRUSTED_BROKER_CLOCK_SOURCES = Object.freeze([
  "tick.time_msc",
  "tick.time",
  "fallback_symbol_tick.time_msc",
  "fallback_symbol_tick.time",
]);

export const RECOVERY_CLOCK_STATUS = Object.freeze({
  ACCEPTED: "ACCEPTED",
  REFUSED: "REFUSED",
});

export const RECOVERY_CLOCK_REASONS = Object.freeze({
  ACCEPTED: "RECOVERY_CLOCK_ACCEPTED",
  SAMPLE_MISSING: "RECOVERY_CLOCK_SAMPLE_MISSING",
  SOURCE_UNTRUSTED: "RECOVERY_CLOCK_SOURCE_UNTRUSTED",
  TIMESTAMP_INVALID: "RECOVERY_CLOCK_TIMESTAMP_INVALID",
  CLIENT_SAMPLE_INVALID: "RECOVERY_CLOCK_CLIENT_SAMPLE_INVALID",
  IDENTITY_MISSING: "RECOVERY_CLOCK_IDENTITY_MISSING",
  IDENTITY_INVALID: "RECOVERY_CLOCK_IDENTITY_INVALID",
  IDENTITY_MISMATCH: "RECOVERY_CLOCK_IDENTITY_MISMATCH",
  NOW_MISSING: "RECOVERY_CLOCK_NOW_MISSING",
  SAMPLE_IN_FUTURE: "RECOVERY_CLOCK_SAMPLE_IN_FUTURE",
  STALE: "RECOVERY_CLOCK_STALE",
});

const R = RECOVERY_CLOCK_REASONS;

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

function refused(reason, message, extra) {
  return Object.freeze({
    status: RECOVERY_CLOCK_STATUS.REFUSED,
    reason,
    message,
    sample: null,
    anchorUtc: null,
    anchorMs: null,
    ageMs: null,
    ...extra,
  });
}

// ----------------------------------------------------------
// Inputs
// ----------------------------------------------------------

function positiveInstant(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

// The pipeline's one canonical login rule, exported so a downstream consumer
// cannot state it a second way: trim, drop every leading zero, refuse what is
// left empty or longer than fifteen digits. The orchestrator, the journal
// adapter, the account layer and the commit contract all import it from here
// (phase 3X-6E removed their private copies), so anything that stores a login
// has to store it stripped - a watermark keyed on "00012345678" would not be
// the watermark the next run looks up. mt5HistoryRecoveryScan.js still carries
// its own stricter, string-only copy; see the pinned divergence test.
export function canonicalLogin(value) {
  let text = value;

  if (typeof text === "number") {
    if (!Number.isInteger(text) || text <= 0) return { invalid: true };
    text = String(text);
  }

  if (typeof text !== "string") return { missing: true };

  const trimmed = text.trim();

  if (trimmed === "") return { missing: true };
  if (!DIGITS_ONLY.test(trimmed)) return { invalid: true };

  const stripped = trimmed.replace(/^0+/, "");

  if (stripped === "" || stripped.length > MAX_LOGIN_DIGITS) {
    return { invalid: true };
  }

  return { login: stripped };
}

function identityText(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "string" && value.trim() !== "") return value.trim();

  return null;
}

// ----------------------------------------------------------
// Checks shared by capture and assess
// ----------------------------------------------------------

function readClockReading(brokerTimeMsc, brokerTimeSource, sampledAtClientMsc) {
  if (
    typeof brokerTimeSource !== "string" ||
    !TRUSTED_BROKER_CLOCK_SOURCES.includes(brokerTimeSource)
  ) {
    return refused(
      R.SOURCE_UNTRUSTED,
      `The broker clock reading came from "${String(brokerTimeSource)}", which is not one of the MT5 tick sources the bridge reports, so it may be the bridge machine's own clock. Check the terminal connection and wait for a positions response whose broker_time_source is a tick.`
    );
  }

  const timeMsc = positiveInstant(brokerTimeMsc);

  if (timeMsc === null) {
    return refused(
      R.TIMESTAMP_INVALID,
      `The positions response carried broker time "${String(brokerTimeMsc)}", which is not a positive number, so there is no broker instant to anchor recovery windows to. Check the terminal connection and retry once a positions poll returns a broker time.`
    );
  }

  const clientMsc = positiveInstant(sampledAtClientMsc);

  if (clientMsc === null) {
    return refused(
      R.CLIENT_SAMPLE_INVALID,
      `This broker clock sample has no usable client-side reading of when it was taken ("${String(sampledAtClientMsc)}"), so its age cannot be measured. Take the sample again with the client instant recorded at the same moment.`
    );
  }

  return { timeMsc, clientMsc };
}

function compareIdentity(sampleIdentity, expectedIdentity) {
  const sampled = readIdentity(sampleIdentity);

  if (sampled.missing) {
    return refused(
      R.IDENTITY_MISSING,
      "The broker clock sample is not tied to an MT5 login and server, so there is nothing to compare it against and it cannot be trusted for this account. Wait for a positions response that reports both the connected login and server."
    );
  }

  if (sampled.invalid) {
    return refused(
      R.IDENTITY_INVALID,
      "The MT5 identity on the broker clock sample is not a login number and server name, so it cannot be confirmed as any account. Check the broker connection and retry."
    );
  }

  const expected = readIdentity(expectedIdentity);

  if (expected.missing) {
    return refused(
      R.IDENTITY_MISSING,
      "No MT5 login and server are known for the selected account, so the broker clock sample cannot be confirmed as belonging to it. Select an account that carries its MT5 login and server, or reconnect the broker account."
    );
  }

  if (expected.invalid) {
    return refused(
      R.IDENTITY_INVALID,
      "The selected account's MT5 login is not a login number, so the broker clock sample cannot be matched to it. Correct the account's MT5 login and retry."
    );
  }

  if (
    sampled.login !== expected.login ||
    sampled.server !== expected.server
  ) {
    return refused(
      R.IDENTITY_MISMATCH,
      `The broker clock sample reports MT5 account ${sampled.login} on ${sampled.server}, but this account is ${expected.login} on ${expected.server}, so its clock belongs to a different connection. Wait for the selected account's own positions poll.`
    );
  }

  return {
    identity: Object.freeze({
      mt5Login: sampled.login,
      mt5Server: sampled.server,
    }),
  };
}

function readIdentity(value) {
  if (!isPlainObject(value)) return { missing: true };

  const login = canonicalLogin(value.mt5Login);
  const server = identityText(value.mt5Server);

  if (login.missing || server === null) return { missing: true };
  if (login.invalid) return { invalid: true };

  return { login: login.login, server };
}

// ----------------------------------------------------------
// Capture: may this response be remembered at all?
// ----------------------------------------------------------

export function captureRecoveryClockSample(input) {
  const response = isPlainObject(input) ? input : {};

  const reading = readClockReading(
    response.brokerTimeMsc,
    response.brokerTimeSource,
    response.sampledAtClientMsc
  );

  if (reading.status === RECOVERY_CLOCK_STATUS.REFUSED) return reading;

  const identity = compareIdentity(
    response.returnedIdentity,
    response.expectedIdentity
  );

  if (identity.status === RECOVERY_CLOCK_STATUS.REFUSED) return identity;

  return Object.freeze({
    status: RECOVERY_CLOCK_STATUS.ACCEPTED,
    reason: R.ACCEPTED,
    message: "",
    sample: Object.freeze({
      brokerTimeMsc: reading.timeMsc,
      brokerTimeSource: response.brokerTimeSource,
      sampledAtClientMsc: reading.clientMsc,
      identity: identity.identity,
    }),
    anchorUtc: null,
    anchorMs: null,
    ageMs: null,
  });
}

// ----------------------------------------------------------
// Assess: may this remembered sample anchor a scan now?
// ----------------------------------------------------------

export function assessRecoveryClock(input) {
  const request = isPlainObject(input) ? input : {};

  if (!isPlainObject(request.sample)) {
    return refused(
      R.SAMPLE_MISSING,
      "There is no broker clock sample to anchor recovery windows to, so no lookback range can be chosen yet. Reconnect the broker account and let a positions poll record the broker's own clock first."
    );
  }

  const reading = readClockReading(
    request.sample.brokerTimeMsc,
    request.sample.brokerTimeSource,
    request.sample.sampledAtClientMsc
  );

  if (reading.status === RECOVERY_CLOCK_STATUS.REFUSED) return reading;

  const identity = compareIdentity(
    request.sample.identity,
    request.expectedIdentity
  );

  if (identity.status === RECOVERY_CLOCK_STATUS.REFUSED) return identity;

  const now = positiveInstant(request.now);

  if (now === null) {
    return refused(
      R.NOW_MISSING,
      `The recovery clock was asked how old its sample is without a current instant ("${String(request.now)}"), so the age cannot be measured. Pass the same clock the caller uses for the sample.`
    );
  }

  const ageMs = now - reading.clientMsc;

  if (ageMs < 0) {
    return refused(
      R.SAMPLE_IN_FUTURE,
      `The broker clock sample claims it was taken ${Math.abs(Math.round(ageMs / 1000))} seconds in the future, so its age cannot be measured against the current instant. Wait for a new positions poll to replace it.`,
      { ageMs }
    );
  }

  if (ageMs > RECOVERY_CLOCK_MAX_AGE_MS) {
    return refused(
      R.STALE,
      `The broker clock sample is ${Math.floor(ageMs / 1000)} seconds old, past the ${Math.floor(RECOVERY_CLOCK_MAX_AGE_MS / 1000)} second recovery window, so it may no longer describe the connected account. Reconnect or wait for a fresh positions poll before planning recovery windows.`,
      { ageMs }
    );
  }

  // The sample says what the broker's clock read at client instant C. Since
  // then only client time has passed, so the broker estimate is the sampled
  // reading plus that elapsed client time. Recovery windows take whole seconds
  // because the bridge truncates range bounds to the second, so the last
  // partial second is dropped rather than rounded up into a window the broker
  // will never answer for.
  const anchorMs =
    Math.floor((reading.timeMsc + ageMs) / 1000) * 1000;

  return Object.freeze({
    status: RECOVERY_CLOCK_STATUS.ACCEPTED,
    reason: R.ACCEPTED,
    message: "",
    sample: request.sample,
    anchorUtc: `${new Date(anchorMs).toISOString().slice(0, 19)}Z`,
    anchorMs,
    ageMs,
  });
}
