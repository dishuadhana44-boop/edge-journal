import test from "node:test";
import assert from "node:assert/strict";

import {
  RECOVERY_CLOCK_MAX_AGE_MS,
  RECOVERY_CLOCK_REASONS,
  RECOVERY_CLOCK_STATUS,
  TRUSTED_BROKER_CLOCK_SOURCES,
  assessRecoveryClock,
  captureRecoveryClockSample,
} from "./recoveryClock.js";

// ============================================================
// FIXTURES
//
// The client clock and the broker clock deliberately differ by 850 ms, and the
// broker instant is not a whole second. A implementation that rounded instead
// of flooring, or that forgot the elapsed client time, lands on a different
// instant than the one asserted below.
// ============================================================

const SAMPLED_AT = Date.UTC(2026, 9, 21, 12, 0, 0, 0);
const BROKER_AT_SAMPLE = Date.UTC(2026, 9, 21, 12, 0, 0, 850);

const IDENTITY = Object.freeze({
  mt5Login: 123456,
  mt5Server: "Broker-Demo",
});

const OTHER_IDENTITY = Object.freeze({
  mt5Login: 654321,
  mt5Server: "Broker-Demo",
});

const WHOLE_SECOND_UTC =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function capture(overrides = {}, remove = []) {
  const input = {
    brokerTimeMsc: BROKER_AT_SAMPLE,
    brokerTimeSource: "tick.time_msc",
    sampledAtClientMsc: SAMPLED_AT,
    expectedIdentity: IDENTITY,
    returnedIdentity: IDENTITY,
    ...overrides,
  };

  for (const key of remove) delete input[key];

  return captureRecoveryClockSample(input);
}

function capturedSample(overrides = {}) {
  const result = capture(overrides);

  assert.equal(
    result.status,
    RECOVERY_CLOCK_STATUS.ACCEPTED,
    `fixture should capture, got ${result.reason}`
  );

  return result.sample;
}

function assess(options = {}) {
  // Every input is passed through only when the test actually named it, so a
  // deliberate `undefined` stays undefined instead of being replaced by a
  // default and quietly turning a refusal into a pass.
  const atMs = "atMs" in options ? options.atMs : 5_000;

  return assessRecoveryClock({
    sample: "sample" in options ? options.sample : capturedSample(),
    expectedIdentity:
      "expectedIdentity" in options ? options.expectedIdentity : IDENTITY,
    now: atMs === null ? undefined : SAMPLED_AT + atMs,
  });
}

function refused(result, reason) {
  assert.equal(result.status, RECOVERY_CLOCK_STATUS.REFUSED);
  assert.equal(result.reason, reason);
  assert.ok(
    Object.values(RECOVERY_CLOCK_REASONS).includes(result.reason),
    `${result.reason} is not a declared recovery-clock reason`
  );
  assert.ok(result.message.length > 0);
}

// ============================================================
// CAPTURE — what a positions response may be remembered for
// ============================================================

test("captures a tick-sourced sample whose identity matches the selected account", () => {
  const result = capture();

  assert.equal(result.status, RECOVERY_CLOCK_STATUS.ACCEPTED);
  assert.equal(result.reason, RECOVERY_CLOCK_REASONS.ACCEPTED);

  assert.equal(result.sample.brokerTimeMsc, BROKER_AT_SAMPLE);
  assert.equal(result.sample.brokerTimeSource, "tick.time_msc");
  assert.equal(result.sample.sampledAtClientMsc, SAMPLED_AT);
  assert.deepEqual(result.sample.identity, {
    mt5Login: "123456",
    mt5Server: "Broker-Demo",
  });
});

test("captures a seconds-precision tick sample as well", () => {
  const result = capture({
    brokerTimeSource: "tick.time",
  });

  assert.equal(result.status, RECOVERY_CLOCK_STATUS.ACCEPTED);
  assert.equal(result.sample.brokerTimeSource, "tick.time");
});

test("keeps the common-symbol tick marker instead of laundering it", () => {
  // A tick from a symbol the trader may not hold is still broker time, but the
  // label has to survive capture so a later reader can tell the two apart.
  const result = capture({
    brokerTimeSource: "fallback_symbol_tick.time_msc",
  });

  assert.equal(result.status, RECOVERY_CLOCK_STATUS.ACCEPTED);
  assert.equal(
    result.sample.brokerTimeSource,
    "fallback_symbol_tick.time_msc"
  );
});

test("trusts exactly the four tick markers the bridge emits", () => {
  assert.deepEqual(
    [...TRUSTED_BROKER_CLOCK_SOURCES].sort(),
    [
      "fallback_symbol_tick.time",
      "fallback_symbol_tick.time_msc",
      "tick.time",
      "tick.time_msc",
    ]
  );
});

test("refuses the local wall-clock fallback", () => {
  const result = capture({
    brokerTimeSource: "local_wall_clock",
  });

  refused(result, RECOVERY_CLOCK_REASONS.SOURCE_UNTRUSTED);
  assert.equal(result.sample, null);
});

test("refuses a missing or unknown source marker", () => {
  for (const source of [
    undefined,
    null,
    "",
    "   ",
    "system_clock",
    "TICK.TIME_MSC",
    "tick",
    7,
  ]) {
    const result = capture({
      brokerTimeSource: source,
      ...(source === undefined
        ? { brokerTimeMsc: BROKER_AT_SAMPLE }
        : {}),
    });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${String(source)} should not be trusted`
    );
    assert.equal(result.reason, RECOVERY_CLOCK_REASONS.SOURCE_UNTRUSTED);
    assert.equal(result.sample, null);
  }
});

test("refuses a response whose timestamp is not a positive number", () => {
  for (const value of [undefined, null, 0, -1, "abc", "", {}, NaN]) {
    const result = capture({ brokerTimeMsc: value });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${String(value)} should not be a clock`
    );
    assert.equal(
      result.reason,
      RECOVERY_CLOCK_REASONS.TIMESTAMP_INVALID
    );
  }
});

test("refuses rather than stamping the sample with the local clock", () => {
  // The caller owns the client clock reading. A default of Date.now() here
  // would make the recovery anchor as old as the machine's own clock, silently.
  const result = capture({}, ["sampledAtClientMsc"]);

  refused(result, RECOVERY_CLOCK_REASONS.CLIENT_SAMPLE_INVALID);
  assert.equal(result.sample, null);
});

test("refuses an unusable client sample instant", () => {
  for (const value of [null, 0, -1, "yesterday", {}, NaN]) {
    const result = capture({ sampledAtClientMsc: value });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${String(value)} cannot anchor a sample`
    );
    assert.equal(
      result.reason,
      RECOVERY_CLOCK_REASONS.CLIENT_SAMPLE_INVALID
    );
  }
});

// ----------------------------------------------------------
// Identity
// ----------------------------------------------------------

test("refuses a response that carries no login or server", () => {
  for (const returnedIdentity of [
    undefined,
    null,
    {},
    { mt5Login: 123456 },
    { mt5Server: "Broker-Demo" },
    { mt5Login: null, mt5Server: "" },
    { mt5Login: true, mt5Server: "Broker-Demo" },
  ]) {
    const result = capture({ returnedIdentity });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${JSON.stringify(returnedIdentity)} must not update the sample`
    );
    assert.equal(result.reason, RECOVERY_CLOCK_REASONS.IDENTITY_MISSING);
    assert.equal(result.sample, null);
  }
});

test("refuses when the selected account has no identity to compare with", () => {
  for (const expectedIdentity of [undefined, null, {}, { mt5Login: "  "}]) {
    const result = capture({ expectedIdentity });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      "a missing expected identity cannot be a match"
    );
    assert.equal(result.reason, RECOVERY_CLOCK_REASONS.IDENTITY_MISSING);
  }
});

test("refuses a response from a different login", () => {
  const result = capture({ returnedIdentity: OTHER_IDENTITY });

  refused(result, RECOVERY_CLOCK_REASONS.IDENTITY_MISMATCH);
  assert.equal(result.sample, null);
});

test("refuses a response from a different server", () => {
  // The recovery identity contract trims but does not fold case, so a server
  // that differs only in spelling is a mismatch, not a near enough match.
  for (const mt5Server of ["Other-Demo", "broker-demo", "BROKER-DEMO"]) {
    const result = capture({
      returnedIdentity: { mt5Login: 123456, mt5Server },
    });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${JSON.stringify(mt5Server)} is not the selected server`
    );
    assert.equal(result.reason, RECOVERY_CLOCK_REASONS.IDENTITY_MISMATCH);
  }
});

test("compares a login as a canonical number, not as its spelling", () => {
  for (const pair of [
    [ { mt5Login: "00123456", mt5Server: "Broker-Demo" }, IDENTITY ],
    [ IDENTITY, { mt5Login: "123456", mt5Server: "Broker-Demo" } ],
    [ IDENTITY, { mt5Login: " 123456 ", mt5Server: "Broker-Demo" } ],
  ]) {
    const [expectedIdentity, returnedIdentity] = pair;
    const result = capture({ expectedIdentity, returnedIdentity });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.ACCEPTED,
      `expected ${JSON.stringify(expectedIdentity)} to match ${JSON.stringify(returnedIdentity)}, got ${result.reason}`
    );
    assert.equal(result.sample.identity.mt5Login, "123456");
  }
});

test("refuses an identity that cannot be a broker login at all", () => {
  for (const mt5Login of ["123x", "12.5", 1.5, "0", 1234567890123456]) {
    const result = capture({
      returnedIdentity: { mt5Login, mt5Server: "Broker-Demo" },
    });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${String(mt5Login)} is not a login`
    );
    assert.equal(result.reason, RECOVERY_CLOCK_REASONS.IDENTITY_INVALID);
  }
});

// ============================================================
// ASSESS — turning a remembered sample into an anchor
// ============================================================

test("anchors at broker time plus the client time elapsed since the sample", () => {
  const result = assess({ atMs: 5_000 });

  assert.equal(result.status, RECOVERY_CLOCK_STATUS.ACCEPTED);
  assert.equal(result.ageMs, 5_000);
  assert.equal(
    result.anchorMs,
    Date.UTC(2026, 9, 21, 12, 0, 5, 0)
  );
  assert.equal(result.anchorUtc, "2026-10-21T12:00:05Z");
});

test("floors the anchor to a whole-second UTC boundary", () => {
  // 850 ms of broker milliseconds plus 9 999 ms of elapsed client time lands on
  // 12:00:10.849. Rounding would answer :11, and the recovery window builder
  // only accepts whole-second bounds.
  const result = assess({ atMs: 9_999 });

  assert.equal(result.status, RECOVERY_CLOCK_STATUS.ACCEPTED);
  assert.equal(result.anchorMs % 1000, 0);
  assert.match(result.anchorUtc, WHOLE_SECOND_UTC);
  assert.equal(result.anchorUtc, "2026-10-21T12:00:10Z");
});

test("accepts a sample at exactly the freshness limit", () => {
  assert.equal(RECOVERY_CLOCK_MAX_AGE_MS, 10_000);

  const result = assess({ atMs: RECOVERY_CLOCK_MAX_AGE_MS });

  assert.equal(result.status, RECOVERY_CLOCK_STATUS.ACCEPTED);
  assert.equal(result.ageMs, 10_000);
});

test("refuses a sample one millisecond past the freshness limit", () => {
  const result = assess({ atMs: RECOVERY_CLOCK_MAX_AGE_MS + 1 });

  refused(result, RECOVERY_CLOCK_REASONS.STALE);
  assert.equal(result.ageMs, 10_001);
  assert.equal(result.anchorUtc, null);
  assert.equal(result.anchorMs, null);
});

test("refuses a sample taken in the future", () => {
  const result = assess({ atMs: -1 });

  refused(result, RECOVERY_CLOCK_REASONS.SAMPLE_IN_FUTURE);
  assert.equal(result.anchorUtc, null);
});

test("refuses when the selected account has moved on since the sample", () => {
  for (const expectedIdentity of [OTHER_IDENTITY, undefined, null, {}]) {
    const result = assess({ expectedIdentity });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      "an account switch must invalidate the remembered sample"
    );
    assert.ok(
      [
        RECOVERY_CLOCK_REASONS.IDENTITY_MISMATCH,
        RECOVERY_CLOCK_REASONS.IDENTITY_MISSING,
      ].includes(result.reason)
    );
    assert.equal(result.anchorUtc, null);
  }
});

test("refuses a remembered sample whose marker is not a trusted tick", () => {
  // capture() refuses an untrusted marker, so these samples are hand-built or
  // persisted ones. The assessor must re-check the marker instead of trusting
  // the shape of whatever it is handed.
  for (const source of ["local_wall_clock", "system_clock", undefined]) {
    const tampered = { ...capturedSample() };

    if (source === undefined) delete tampered.brokerTimeSource;
    else tampered.brokerTimeSource = source;

    refused(
      assess({ sample: tampered }),
      RECOVERY_CLOCK_REASONS.SOURCE_UNTRUSTED
    );
  }
});

test("refuses a missing or unusable sample instead of reading the clock", () => {
  for (const sample of [undefined, null, "1767225600000", []]) {
    const result = assess({ sample });

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${JSON.stringify(sample)} is not a sample`
    );
    assert.equal(result.reason, RECOVERY_CLOCK_REASONS.SAMPLE_MISSING);
    assert.equal(result.anchorUtc, null);
    assert.equal(result.anchorMs, null);
    assert.equal(result.ageMs, null);
  }
});

test("refuses a sample with broken contents rather than a partial anchor", () => {
  const cases = [
    [{ brokerTimeMsc: 0 }, RECOVERY_CLOCK_REASONS.TIMESTAMP_INVALID],
    [{ brokerTimeMsc: "abc" }, RECOVERY_CLOCK_REASONS.TIMESTAMP_INVALID],
    [{ sampledAtClientMsc: null }, RECOVERY_CLOCK_REASONS.CLIENT_SAMPLE_INVALID],
    [{ identity: null }, RECOVERY_CLOCK_REASONS.IDENTITY_MISSING],
    [{ identity: { mt5Login: 123456 } }, RECOVERY_CLOCK_REASONS.IDENTITY_MISSING],
    [{ identity: { mt5Login: "12x", mt5Server: "Broker-Demo" } }, RECOVERY_CLOCK_REASONS.IDENTITY_INVALID],
  ];

  for (const [patch, reason] of cases) {
    const result = assess({
      sample: { ...capturedSample(), ...patch },
    });

    refused(result, reason);
    assert.equal(result.anchorUtc, null);
  }

  // A bare object is sample-shaped but carries nothing, so the first thing
  // wrong with it is that no trusted tick marker was ever reported.
  refused(
    assess({ sample: {} }),
    RECOVERY_CLOCK_REASONS.SOURCE_UNTRUSTED
  );
});

test("refuses rather than inventing a now", () => {
  const result = assess({ atMs: null });

  refused(result, RECOVERY_CLOCK_REASONS.NOW_MISSING);
  assert.equal(result.anchorUtc, null);
});

test("never hands back a local or machine time as the anchor", () => {
  for (const options of [
    { sample: null },
    {
      sample: {
        ...capturedSample(),
        brokerTimeSource: "local_wall_clock",
      },
    },
    { expectedIdentity: OTHER_IDENTITY },
    { atMs: RECOVERY_CLOCK_MAX_AGE_MS + 5_000 },
    { atMs: -60_000 },
  ]) {
    const result = assess(options);

    assert.equal(
      result.status,
      RECOVERY_CLOCK_STATUS.REFUSED,
      `${JSON.stringify(options)} must not produce an anchor`
    );
    assert.equal(result.anchorUtc, null);
    assert.equal(result.anchorMs, null);
  }
});

test("does not throw on input it simply refuses", () => {
  const junk = [
    () => captureRecoveryClockSample(),
    () => captureRecoveryClockSample(null),
    () => captureRecoveryClockSample("noon"),
    () => captureRecoveryClockSample({ expectedIdentity: 5, returnedIdentity: 5 }),
    () => assessRecoveryClock(),
    () => assessRecoveryClock(null),
    () => assessRecoveryClock({ sample: { identity: 42 }, expectedIdentity: IDENTITY, now: SAMPLED_AT }),
  ];

  for (const call of junk) {
    const result = call();

    assert.equal(typeof result, "object");
    assert.equal(result.status, RECOVERY_CLOCK_STATUS.REFUSED);
    assert.ok(
      Object.values(RECOVERY_CLOCK_REASONS).includes(result.reason)
    );
    assert.equal(result.sample === undefined ? null : result.sample, null);
  }
});

test("hands out frozen samples and verdicts", () => {
  const captured = capture();
  const verdict = assess();

  assert.ok(Object.isFrozen(captured));
  assert.ok(Object.isFrozen(captured.sample));
  assert.ok(Object.isFrozen(captured.sample.identity));
  assert.ok(Object.isFrozen(verdict));

  const refusedVerdict = assess({ atMs: -1 });

  assert.ok(Object.isFrozen(refusedVerdict));
});
