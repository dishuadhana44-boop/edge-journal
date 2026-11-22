// ============================================================
// CTRADER CONNECTION SUPERVISOR (Audit Task T1) - pure rule, no transport
// ============================================================
//
// Covers server/services/ctraderConnectionSupervisor.js:
//   nextState(), planReconnectAttempt(), evaluateLiveness(),
//   canClaimConnected(), resolveTiming() and the frozen vocabularies.
//
// WHY THIS EXISTS
// The audit measured that the production service registers four socket
// listeners, contains no interval timer at all, and never reconnects: a
// dropped link stays dropped until a human action happens to call start
// again, while a half-open link keeps reporting connected=true forever
// because nothing can observe silence. This module owns the decisions that
// a reconnecting service needs, before any of them is wired to a socket -
// so each decision can be argued about on its own and tested offline.
//
// WHAT THIS DOES NOT PROVE
// These tests prove what a pure function returns for given numbers. They do
// not prove that the cTrader platform enforces the 30-second idle tolerance
// this module is configured with (T0 is open and no session has ever been
// observed from this codebase), that any socket is supervised yet, that a
// reconnect would succeed, or that the running service reports anything
// differently - nothing imports this module yet. The caps below are
// judgements made here, not measurements taken from the broker.
//
// ONE LIMIT WORTH NAMING BEFORE THIS IS WIRED TO A SOCKET
// evaluateLiveness treats a recent outbound frame as evidence of life, which
// is what lets a quiet-but-healthy link avoid the platform's idle window. The
// cost is that a client which sends a heartbeat every 10000ms over a half-open
// link keeps renewing its own evidence and never reaches the deadline: writes
// succeed locally while nothing comes back. Dead-peer detection therefore has
// to rest on inbound evidence, and that is a rule change, not a timing change,
// so it is left for review rather than settled here.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

import {
  SUPERVISOR_STATES,
  SUPERVISOR_EVENTS,
  LIVENESS_VERDICTS,
  SUPERVISION_TIMING,
  resolveTiming,
  nextState,
  planReconnectAttempt,
  evaluateLiveness,
  canClaimConnected,
} from "./ctraderConnectionSupervisor.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.join(HERE, "ctraderConnectionSupervisor.js");

const T = SUPERVISION_TIMING;

function flags(overrides = {}) {
  return {
    connected: true,
    authenticated: true,
    ready: true,
    ...overrides,
  };
}

/* ============================================================
   VOCABULARY - frozen, so a cap cannot be rewritten at runtime
============================================================ */

test("the state vocabulary is the six audited states and is frozen", () => {
  assert.deepEqual(Object.values(SUPERVISOR_STATES).sort(), [
    "authenticating",
    "backoff",
    "connecting",
    "degraded",
    "ready",
    "stopped",
  ]);
  assert.equal(Object.isFrozen(SUPERVISOR_STATES), true);
});

test("the vocabularies are all frozen", () => {
  assert.equal(Object.isFrozen(SUPERVISOR_STATES), true);
  assert.equal(Object.isFrozen(SUPERVISOR_EVENTS), true);
  assert.equal(Object.isFrozen(LIVENESS_VERDICTS), true);
  assert.deepEqual(LIVENESS_VERDICTS, {
    FRESH: "fresh",
    DUE: "due",
    EXPIRED: "expired",
  });
});

test("the event vocabulary is frozen", () => {
  assert.equal(Object.isFrozen(SUPERVISOR_EVENTS), true);
  assert.deepEqual(Object.values(SUPERVISOR_EVENTS).sort(), [
    "activity_fresh",
    "activity_stale",
    "dial",
    "give_up",
    "session_ready",
    "socket_closed",
    "socket_error",
    "socket_open",
    "stop",
  ]);
});

test("the timing caps are frozen and a rewrite attempt throws", () => {
  assert.equal(Object.isFrozen(SUPERVISION_TIMING), true);

  assert.throws(() => {
    SUPERVISION_TIMING.maxDelayMs = 1;
  }, TypeError);
});

test("the heartbeat cadence, the idle tolerance and the caps are stated numbers", () => {
  // The two quoted figures, pinned here so a future edit has to argue with a
  // source rather than with a comment.
  //
  //   heartbeatSendAfterMs - "To keep a connection alive, keep sending a
  //   heartbeat event (ProtoHeartbeatEvent) every 10 seconds."
  //   https://help.ctrader.com/open-api/connection/
  //
  //   idleToleranceMs - "Open API client can send this message when he needs
  //   to keep the connection open for a period without other messages longer
  //   than 30 seconds." Vendored at
  //   server/openapi-proto-messages/OpenApiCommonMessages.proto:28 and
  //   repeated verbatim at https://help.ctrader.com/open-api/common-messages/
  //
  // Both are documented figures, not measurements: T0 remains open. The
  // cadence used to be 20000ms, which is half the frequency the platform asks
  // for, so this assertion is the one that caught that.
  assert.equal(T.heartbeatSendAfterMs, 10_000);
  assert.equal(T.idleToleranceMs, 30_000);
  assert.equal(T.deadlineGraceMs, 5_000);
  assert.equal(T.maxDelayMs, 30_000);
  assert.equal(T.baseDelayMs, 1_000);
  assert.equal(T.maxAttempts, 6);
});

test("the shipped cadence is no slower than the documented 10 seconds", () => {
  // A slower prompt would let the link idle past the cadence the platform
  // asks a client to keep, which is the failure the event exists to avoid.
  assert.ok(
    T.heartbeatSendAfterMs <= 10_000,
    `the platform asks for a heartbeat every 10000ms, but this supervisor only prompts one after ${T.heartbeatSendAfterMs}ms`
  );
});

test("the shipped cadence fits inside the silence it is meant to interrupt", () => {
  // At 10000ms per prompt and a 35000ms deadline a quiet but live link is
  // prompted three times before it is ever called dead. A cadence that left
  // no room for a second prompt would make the due verdict meaningless.
  const promptsBeforeDeadline = Math.floor(
    (T.idleToleranceMs + T.deadlineGraceMs) / T.heartbeatSendAfterMs
  );

  assert.equal(promptsBeforeDeadline, 3);
});

/* ============================================================
   nextState - the transition table
============================================================ */

test("a dial from stopped begins connecting", () => {
  assert.deepEqual(nextState({ state: "stopped", event: "dial" }), {
    ok: true,
    state: "connecting",
    previousState: "stopped",
    code: "transition_applied",
    message:
      "The cTrader connection moved from stopped to connecting because a dial was requested.",
  });
});

test("the full ladder reaches ready only through authenticating", () => {
  let state = "stopped";

  for (const event of ["dial", "socket_open", "session_ready"]) {
    const outcome = nextState({ state, event });

    assert.equal(outcome.ok, true, event);
    state = outcome.state;
  }

  assert.equal(state, "ready");
});

test("authentication cannot be skipped from connecting", () => {
  const outcome = nextState({ state: "connecting", event: "session_ready" });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, "transition_not_allowed");
  assert.equal(outcome.state, "connecting", "a refused transition keeps state");
});

test("stale activity degrades a ready session and fresh activity heals it", () => {
  const degraded = nextState({ state: "ready", event: "activity_stale" });

  assert.equal(degraded.ok, true);
  assert.equal(degraded.state, "degraded");

  const healed = nextState({ state: "degraded", event: "activity_fresh" });

  assert.equal(healed.ok, true);
  assert.equal(healed.state, "ready");
});

test("activity only becomes fresh through degraded, never straight into ready", () => {
  const outcome = nextState({ state: "connecting", event: "activity_fresh" });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.state, "connecting");
});

test("a lost socket moves every live state into backoff", () => {
  for (const state of [
    "connecting",
    "authenticating",
    "ready",
    "degraded",
  ]) {
    for (const event of ["socket_closed", "socket_error"]) {
      const outcome = nextState({ state, event });

      assert.equal(outcome.ok, true, `${state} + ${event}`);
      assert.equal(outcome.state, "backoff", `${state} + ${event}`);
    }
  }
});

test("backoff re-dials or gives up, and giving up is terminal", () => {
  assert.equal(
    nextState({ state: "backoff", event: "dial" }).state,
    "connecting"
  );
  assert.equal(
    nextState({ state: "backoff", event: "give_up" }).state,
    "stopped"
  );

  // Stopped admits nothing but a dial: no ghost path back into a session.
  assert.equal(
    nextState({ state: "stopped", event: "socket_open" }).ok,
    false
  );
  assert.equal(
    nextState({ state: "stopped", event: "session_ready" }).ok,
    false
  );
});

test("every named event is admitted from at least one state", () => {
  // A mistyped key in the table would make an event unreachable, which is
  // exactly the kind of defect that no per-transition test would notice.
  for (const event of Object.values(SUPERVISOR_EVENTS)) {
    const admitted = Object.values(SUPERVISOR_STATES).some(
      (state) => nextState({ state, event }).ok === true
    );

    assert.equal(admitted, true, event);
  }
});

test("giving up is only meaningful while backing off", () => {
  const outcome = nextState({ state: "ready", event: "give_up" });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, "transition_not_allowed");
  assert.equal(outcome.state, "ready");
});

test("stop is admitted from every state and always lands on stopped", () => {
  for (const state of Object.values(SUPERVISOR_STATES)) {
    const outcome = nextState({ state, event: "stop" });

    assert.equal(outcome.ok, true, state);
    assert.equal(outcome.state, "stopped", state);
  }
});

test("an unrecognised event is refused with the state preserved, never thrown", () => {
  const outcome = nextState({ state: "ready", event: "socket_rejoiced" });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, "unknown_event");
  assert.equal(outcome.state, "ready");
  assert.equal(outcome.event, "socket_rejoiced");
});

test("an unrecognised current state is refused rather than defaulted", () => {
  for (const state of [undefined, null, "", "Ready", 7, {}]) {
    const outcome = nextState({ state, event: "dial" });

    assert.equal(outcome.ok, false, String(state));
    assert.equal(outcome.code, "unknown_state", String(state));
    assert.equal(outcome.state, null, String(state));
  }
});

test("missing arguments are refused", () => {
  assert.equal(nextState().ok, false);
  assert.equal(nextState({}).ok, false);
  assert.equal(nextState({ state: "stopped" }).code, "missing_event");
  assert.equal(nextState({ event: "dial" }).code, "unknown_state");
});

test("state names and event names are read from the frozen vocabularies", () => {
  const fromStates = nextState({
    state: SUPERVISOR_STATES.STOPPED,
    event: SUPERVISOR_EVENTS.DIAL,
  });

  assert.equal(fromStates.ok, true);
  assert.equal(fromStates.state, SUPERVISOR_STATES.CONNECTING);
});

/* ============================================================
   resolveTiming - fail fast on a partly understood configuration
============================================================ */

test("resolveTiming accepts the shipped defaults", () => {
  const verdict = resolveTiming();

  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.timing, {
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
    maxAttempts: 6,
    heartbeatSendAfterMs: 10_000,
    idleToleranceMs: 30_000,
    deadlineGraceMs: 5_000,
  });
  assert.equal(Object.isFrozen(verdict.timing), true);
});

test("resolveTiming refuses a non-positive or non-finite field and names it", () => {
  for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1000", null]) {
    const verdict = resolveTiming({ maxDelayMs: bad });

    assert.equal(verdict.ok, false, String(bad));
    assert.equal(verdict.code, "timing_field_not_a_positive_integer");
    assert.equal(verdict.field, "maxDelayMs");
  }
});

test("resolveTiming refuses an unknown timing key instead of ignoring it", () => {
  const verdict = resolveTiming({ maxDelay: 5_000 });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "timing_key_unrecognised");
  assert.equal(verdict.field, "maxDelay");
});

test("resolveTiming refuses a cadence that would only prompt after the deadline", () => {
  const verdict = resolveTiming({ heartbeatSendAfterMs: 40_000 });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "heartbeat_send_not_before_deadline");
});

test("resolveTiming does not police the cadence, only its order", () => {
  // Named so nobody mistakes the guard above for a restatement of the
  // platform's recommendation. A 20000ms cadence is off-spec but legal here:
  // only the shipped table and the assertion above keep the cadence honest.
  const verdict = resolveTiming({ heartbeatSendAfterMs: 20_000 });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.timing.heartbeatSendAfterMs, 20_000);
});

test("the shipped configuration always reaches the due verdict before the deadline", () => {
  assert.ok(
    T.heartbeatSendAfterMs < T.idleToleranceMs + T.deadlineGraceMs,
    `a keepalive prompted at ${T.heartbeatSendAfterMs}ms of silence must fall before the deadline at ${T.idleToleranceMs + T.deadlineGraceMs}ms`
  );
});

/* ============================================================
   planReconnectAttempt - finite delay, finite attempts
============================================================ */

test("the delay doubles deterministically from the base", () => {
  const seen = [];

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const plan = planReconnectAttempt({ attempt });

    assert.equal(plan.ok, true, String(attempt));
    assert.equal(plan.code, "attempt_planned");
    assert.equal(plan.attempt, attempt);
    seen.push(plan.delayMs);
  }

  assert.deepEqual(seen, [1_000, 2_000, 4_000, 8_000, 16_000]);
});

test("the delay cap binds, and it is reachable so it is load-bearing", () => {
  const plan = planReconnectAttempt({ attempt: T.maxAttempts });

  assert.equal(plan.ok, true);
  assert.equal(plan.delayMs, T.maxDelayMs);

  // Without the cap this attempt would double past it, which is what makes
  // the assertion above capable of failing.
  assert.equal(T.baseDelayMs * 2 ** (T.maxAttempts - 1), 32_000);
  assert.ok(
    T.baseDelayMs * 2 ** (T.maxAttempts - 1) > T.maxDelayMs,
    `the uncapped delay for attempt ${T.maxAttempts} must overshoot the ${T.maxDelayMs}ms cap, otherwise the cap is not load-bearing`
  );
});

test("no planned delay ever exceeds the named cap", () => {
  for (let attempt = 1; attempt <= T.maxAttempts; attempt += 1) {
    const plan = planReconnectAttempt({ attempt });

    assert.ok(
      plan.delayMs <= T.maxDelayMs,
      `attempt ${attempt} planned ${plan.delayMs}ms, over the ${T.maxDelayMs}ms cap`
    );
  }
});

test("the last allowed attempt is planned and the one after it is refused", () => {
  const last = planReconnectAttempt({ attempt: T.maxAttempts });
  const beyond = planReconnectAttempt({ attempt: T.maxAttempts + 1 });

  assert.equal(last.ok, true);
  assert.equal(beyond.ok, false);
  assert.equal(beyond.code, "attempts_exhausted");
  assert.equal(beyond.delayMs, null);
  assert.equal(beyond.maxAttempts, T.maxAttempts);
  assert.match(beyond.message, /no further attempt is scheduled/);
});

test("an attempt that is not a positive integer is refused", () => {
  for (const attempt of [0, -3, 1.5, Number.NaN, Infinity, "2", null, undefined]) {
    const plan = planReconnectAttempt({ attempt });

    assert.equal(plan.ok, false, String(attempt));
    assert.equal(plan.code, "attempt_not_a_positive_integer");
    assert.equal(plan.delayMs, null);
  }
});

test("an unusable timing override is refused rather than half-applied", () => {
  const plan = planReconnectAttempt({ attempt: 1, timing: { maxDelayMs: 0 } });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "timing_unusable");
  assert.equal(plan.delayMs, null);
});

test("the plan is a pure function of the attempt number", () => {
  const first = planReconnectAttempt({ attempt: 4 });
  const second = planReconnectAttempt({ attempt: 4 });

  assert.deepEqual(first, second);
});

/* ============================================================
   evaluateLiveness - the deadline, from an injected clock
============================================================ */

function livenessAt(nowMs, overrides = {}) {
  return evaluateLiveness({
    lastInboundActivityMs: 1_000_000,
    lastOutboundActivityMs: 1_000_000,
    nowMs,
    ...overrides,
  });
}

test("a recently active connection is fresh and reports its deadline", () => {
  const verdict = livenessAt(1_000_000 + 5_000);

  assert.equal(verdict.ok, true);
  assert.equal(verdict.verdict, LIVENESS_VERDICTS.FRESH);
  assert.equal(verdict.ageMs, 5_000);
  assert.equal(verdict.lastActivityMs, 1_000_000);
  assert.equal(
    verdict.deadlineAtMs,
    1_000_000 + T.idleToleranceMs + T.deadlineGraceMs
  );
});

test("the send is due on the documented tick, not a tick later", () => {
  const justBefore = livenessAt(1_000_000 + T.heartbeatSendAfterMs - 1);
  const exactly = livenessAt(1_000_000 + T.heartbeatSendAfterMs);

  assert.equal(justBefore.verdict, LIVENESS_VERDICTS.FRESH);
  assert.equal(justBefore.advisory, null);
  assert.equal(exactly.verdict, LIVENESS_VERDICTS.DUE);
  assert.equal(exactly.advisory, "heartbeat_send_due");
});

test("a session silent for one documented cadence is still inside tolerance", () => {
  const due = livenessAt(1_000_000 + T.heartbeatSendAfterMs);

  assert.equal(due.ok, true);
  assert.ok(
    due.deadlineAtMs > 1_000_000 + T.heartbeatSendAfterMs,
    "prompting a heartbeat must not be the same event as declaring the link dead"
  );
});

test("silence just under the deadline is still due, not dead", () => {
  const almost = livenessAt(1_000_000 + T.idleToleranceMs + T.deadlineGraceMs - 1);

  assert.equal(almost.verdict, LIVENESS_VERDICTS.DUE);
});

test("the deadline itself is expired, and so is anything after it", () => {
  const exactly = livenessAt(1_000_000 + T.idleToleranceMs + T.deadlineGraceMs);
  const longAfter = livenessAt(1_000_000 + 600_000);

  assert.equal(exactly.verdict, LIVENESS_VERDICTS.EXPIRED);
  assert.equal(exactly.advisory, null);
  assert.equal(longAfter.verdict, LIVENESS_VERDICTS.EXPIRED);
});

test("traffic in either direction is evidence of life", () => {
  // The platform documents the client sending this event to keep an idle
  // connection open, so a recent outbound message is evidence too. Here only
  // the outbound frame is recent, and the clock sits just after it.
  const verdict = livenessAt(1_032_000, {
    lastInboundActivityMs: 1_000_000,
    lastOutboundActivityMs: 1_030_000,
  });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.lastActivityMs, 1_030_000);
  assert.equal(verdict.ageMs, 2_000);
  assert.equal(verdict.verdict, LIVENESS_VERDICTS.FRESH);
});

test("the most recent observation wins, not the oldest", () => {
  const verdict = livenessAt(1_021_000, {
    lastInboundActivityMs: 1_000_000,
    lastOutboundActivityMs: 1_020_000,
  });

  assert.equal(verdict.lastActivityMs, 1_020_000);
  assert.equal(verdict.ageMs, 1_000);
  assert.equal(verdict.verdict, LIVENESS_VERDICTS.FRESH);
});

test("no observed activity is refused, not treated as fresh", () => {
  for (const value of [null, undefined]) {
    const verdict = evaluateLiveness({
      lastInboundActivityMs: value,
      lastOutboundActivityMs: value,
      nowMs: 1_000_000,
    });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, "activity_unobserved");
    assert.equal(verdict.verdict, null);
  }
});

test("an unusable activity timestamp is refused", () => {
  for (const bad of [Number.NaN, "1000", -1, {}, true]) {
    const verdict = evaluateLiveness({
      lastInboundActivityMs: bad,
      lastOutboundActivityMs: null,
      nowMs: 1_000_000,
    });

    assert.equal(verdict.ok, false, String(bad));
    assert.equal(verdict.code, "activity_not_a_timestamp");
    assert.equal(verdict.verdict, null);
  }
});

test("an unusable clock reading is refused", () => {
  for (const nowMs of [undefined, null, Number.NaN, "1000", {}]) {
    const verdict = evaluateLiveness({
      lastInboundActivityMs: 1_000_000,
      lastOutboundActivityMs: null,
      nowMs,
    });

    assert.equal(verdict.ok, false, String(nowMs));
    assert.equal(verdict.code, "now_not_a_timestamp");
  }
});

test("a clock that moved backwards is refused instead of reporting a negative age", () => {
  const verdict = livenessAt(999_999);

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "clock_moved_backwards");
  assert.equal(verdict.verdict, null);
  assert.equal(verdict.ageMs, null);
});

test("missing arguments are refused", () => {
  assert.equal(evaluateLiveness().ok, false);
  assert.equal(evaluateLiveness({}).code, "activity_unobserved");
});

/* ============================================================
   canClaimConnected - the audited item 9 rule
============================================================ */

const FRESH = { ok: true, verdict: "fresh", ageMs: 1_000 };
const DUE = { ok: true, verdict: "due", ageMs: 25_000, advisory: "heartbeat_send_due" };
const EXPIRED = { ok: true, verdict: "expired", ageMs: 60_000, advisory: null };

test("open flags with fresh evidence may be reported connected", () => {
  const outcome = canClaimConnected({ flags: flags(), liveness: FRESH });

  assert.deepEqual(outcome, {
    ok: true,
    verdict: "connected",
    advisory: null,
    code: "connected",
    message:
      "The cTrader socket flags and the observed activity agree, so this session may be reported as connected.",
  });
});

test("open flags with due evidence stay connected but say the heartbeat is due", () => {
  const outcome = canClaimConnected({ flags: flags(), liveness: DUE });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.verdict, "connected");
  assert.equal(outcome.advisory, "heartbeat_due");
  assert.equal(outcome.code, "connected_heartbeat_due");
});

test("open flags with expired evidence are degraded, never connected", () => {
  // This is the audited half-open case: the socket still reports OPEN, so a
  // rule that reads only the flags would call it healthy forever.
  const outcome = canClaimConnected({ flags: flags(), liveness: EXPIRED });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.verdict, "degraded");
  assert.equal(outcome.advisory, null);
  assert.equal(outcome.code, "liveness_expired");
  assert.match(outcome.message, /cannot be reported as connected/);
});

test("open flags with no liveness evidence at all are degraded", () => {
  for (const liveness of [null, undefined]) {
    const outcome = canClaimConnected({ flags: flags(), liveness });

    assert.equal(outcome.ok, true, String(liveness));
    assert.equal(outcome.verdict, "degraded", String(liveness));
    assert.equal(outcome.code, "liveness_unobserved");
  }
});

test("a refused liveness verdict never becomes a health claim", () => {
  const outcome = canClaimConnected({
    flags: flags(),
    liveness: { ok: false, verdict: null, code: "activity_unobserved" },
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.verdict, "degraded");
  assert.equal(outcome.code, "liveness_unobserved");
});

test("an unrecognised liveness verdict is degraded, not defaulted to connected", () => {
  for (const verdict of ["fresher", "", 7, undefined]) {
    const outcome = canClaimConnected({
      flags: flags(),
      liveness: { ok: true, verdict },
    });

    assert.equal(outcome.verdict, "degraded", String(verdict));
    assert.equal(outcome.code, "liveness_verdict_unrecognised");
  }
});

test("a flag that is down makes the session disconnected", () => {
  for (const overrides of [
    { connected: false },
    { authenticated: false },
    { ready: false },
    { connected: false, authenticated: false, ready: false },
  ]) {
    const outcome = canClaimConnected({
      flags: flags(overrides),
      liveness: FRESH,
    });

    assert.equal(outcome.ok, true);
    assert.equal(outcome.verdict, "disconnected");
    assert.equal(outcome.code, "socket_flags_down");
  }
});

test("a down flag is disconnected even when liveness is expired", () => {
  const outcome = canClaimConnected({
    flags: flags({ ready: false }),
    liveness: EXPIRED,
  });

  assert.equal(outcome.verdict, "disconnected");
});

test("non-boolean flags are refused, and a string never counts as true", () => {
  for (const flagsValue of [
    { connected: "true", authenticated: true, ready: true },
    { connected: "false", authenticated: "false", ready: "false" },
    { connected: 1, authenticated: true, ready: true },
    { connected: null, authenticated: true, ready: true },
  ]) {
    const outcome = canClaimConnected({ flags: flagsValue, liveness: FRESH });

    assert.equal(outcome.ok, false);
    assert.equal(outcome.code, "flag_not_boolean");
    assert.equal(outcome.verdict, null);
    assert.ok(Object.isFrozen(outcome), "a refusal must not be editable");
  }
});

test("missing or malformed flags and liveness are refused without throwing", () => {
  assert.equal(canClaimConnected().ok, false);
  assert.equal(canClaimConnected({}).code, "flags_not_an_object");
  assert.equal(
    canClaimConnected({ flags: "connected", liveness: FRESH }).code,
    "flags_not_an_object"
  );
});

/* ============================================================
   SOURCE CONTRACT - the module stays pure and offline-testable
============================================================ */

function moduleSource() {
  return fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
}

test("the supervisor performs no I/O and reads no clock of its own", () => {
  const source = moduleSource();

  const forbidden = [
    [/(^|\n)\s*import\b/, "an import"],
    [/node:/, "a built-in dependency"],
    [/require\s*\(/, "require()"],
    [/\bprocess\s*\./, "process"],
    [/\bfs\b|\bpath\b/, "the filesystem"],
    [/\bWebSocket\b/, "a WebSocket"],
    [/\bnet\b|\bhttp|\bdns\b/, "the network"],
    [/\bfetch\s*\(/, "fetch()"],
    [/protobuf/i, "protobuf"],
    [/setTimeout|setInterval|clearTimeout|clearInterval/, "a timer"],
    [/\bDate\b/, "the clock"],
    [/Math\s*\.\s*random/, "randomness"],
    [/\b(req|res)\s*\./, "a request or response object"],
    [/\bheaders\b/, "request headers"],
    [/process\.env|\benv\b/, "the environment"],
  ];

  for (const [pattern, label] of forbidden) {
    assert.equal(
      pattern.test(source),
      false,
      `ctraderConnectionSupervisor.js must not use ${label}`
    );
  }
});

test("the caps are read from a frozen default, not re-declared inline", () => {
  const source = moduleSource();

  assert.ok(
    source.includes("const T = SUPERVISION_TIMING"),
    "the shipped caps must come from the one frozen table"
  );
});

/* ============================================================
   MUTANTS - every guard is load-bearing
============================================================ */

// Each mutant below is a plausible wrong implementation of one shipped rule.
// `rule` states that rule and must hold for the module as written; the mutant
// must break it. A rule that holds for the mutant too proves nothing, so the
// next test first checks every rule against the real module.
const MUTANTS = [
  {
    name: "the delay cap is deleted",
    from: "const delayMs = Math.min(baseDelay * factor, cfg.maxDelayMs);",
    to: "const delayMs = baseDelay * factor;",
    rule: (api) =>
      api.planReconnectAttempt({ attempt: T.maxAttempts }).delayMs ===
      T.maxDelayMs,
  },
  {
    name: "the attempt cap is deleted",
    from: "if (attempt > cfg.maxAttempts) {",
    to: "if (false) {",
    rule: (api) =>
      api.planReconnectAttempt({ attempt: T.maxAttempts + 1 }).code ===
      "attempts_exhausted",
  },
  {
    name: "the deadline itself is treated as still alive",
    from: "if (nowMs >= deadlineAtMs) {",
    to: "if (nowMs > deadlineAtMs) {",
    rule: (api) =>
      api.evaluateLiveness({
        lastInboundActivityMs: 1_000_000,
        lastOutboundActivityMs: null,
        nowMs: 1_000_000 + T.idleToleranceMs + T.deadlineGraceMs,
      }).verdict === LIVENESS_VERDICTS.EXPIRED,
  },
  {
    name: "the oldest observation is used instead of the newest",
    from: "const lastActivityMs = Math.max(...observed);",
    to: "const lastActivityMs = Math.min(...observed);",
    rule: (api) =>
      api.evaluateLiveness({
        lastInboundActivityMs: 1_000_000,
        lastOutboundActivityMs: 1_030_000,
        nowMs: 1_032_000,
      }).verdict === LIVENESS_VERDICTS.FRESH,
  },
  {
    name: "the heartbeat prompt fires one tick late",
    from: "if (ageMs >= cfg.heartbeatSendAfterMs) {",
    to: "if (ageMs > cfg.heartbeatSendAfterMs) {",
    rule: (api) =>
      api.evaluateLiveness({
        lastInboundActivityMs: 1_000_000,
        lastOutboundActivityMs: null,
        nowMs: 1_000_000 + T.heartbeatSendAfterMs,
      }).verdict === LIVENESS_VERDICTS.DUE,
  },
  {
    name: "an off-spec cadence slower than the deadline is accepted",
    from: "if (merged.heartbeatSendAfterMs >= merged.idleToleranceMs + merged.deadlineGraceMs) {",
    to: "if (false) {",
    rule: (api) =>
      api.resolveTiming({ heartbeatSendAfterMs: 40_000 }).code ===
      "heartbeat_send_not_before_deadline",
  },
  {
    name: "expired liveness is allowed to claim a connection",
    from: "if (isClaimableVerdict(liveness.verdict)) {",
    to: "if (true) {",
    rule: (api) =>
      api.canClaimConnected({ flags: flags(), liveness: EXPIRED }).code ===
      "liveness_expired",
  },
  {
    name: "the expired branch is deleted",
    from: "if (liveness.verdict === LIVENESS_VERDICTS.EXPIRED) {",
    to: "if (false) {",
    rule: (api) =>
      api.canClaimConnected({ flags: flags(), liveness: EXPIRED }).code ===
      "liveness_expired",
  },
  {
    name: "missing liveness is allowed to claim a connection",
    from: "if (liveness === null || liveness === undefined) {",
    to: "if (false) {",
    rule: (api) => {
      try {
        return (
          api.canClaimConnected({ flags: flags(), liveness: null }).code ===
          "liveness_unobserved"
        );
      } catch {
        return false;
      }
    },
  },
  {
    name: "any event is admitted from any state",
    from: "if (transition === undefined) {",
    to: "if (false) {",
    rule: (api) =>
      api.nextState({ state: "connecting", event: "session_ready" }).ok ===
      false,
  },
  {
    name: "authentication can be skipped",
    from: "socket_open: STATES.AUTHENTICATING,",
    to: "socket_open: STATES.READY,",
    rule: (api) =>
      api.nextState({ state: "connecting", event: "socket_open" }).state ===
      "authenticating",
  },
];

async function loadMutated(mutant) {
  const source = moduleSource();
  const mutated = source.split(mutant.from).join(mutant.to);

  assert.notEqual(
    mutated,
    source,
    `the anchor is no longer in the source: ${mutant.from}`
  );

  return import(
    `data:text/javascript;base64,${Buffer.from(mutated, "utf8").toString("base64")}`
  );
}

test("every mutant rule holds for the module as shipped", () => {
  const api = {
    resolveTiming,
    planReconnectAttempt,
    evaluateLiveness,
    canClaimConnected,
    nextState,
  };

  for (const mutant of MUTANTS) {
    assert.equal(
      mutant.rule(api),
      true,
      `the rule probed by "${mutant.name}" does not describe the shipped module`
    );
  }
});

for (const mutant of MUTANTS) {
  test(`mutation: ${mutant.name} is rejected`, async () => {
    const mutatedApi = await loadMutated(mutant);

    assert.equal(
      mutant.rule(mutatedApi),
      false,
      `nothing noticed the mutant "${mutant.name}"`
    );
  });
}
