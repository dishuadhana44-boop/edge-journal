/* ============================================================
   CTRADER CONNECTION SUPERVISOR (Audit Task T1)

   The decisions a reconnecting cTrader socket has to make, kept away
   from the socket itself so that each one can be argued about and
   tested with no live link:

     - nextState(): the only legal moves between stopped, connecting,
       authenticating, ready, degraded and backoff.
     - planReconnectAttempt(): a bounded schedule. The delay doubles
       from the base and is capped, and the number of attempts is
       capped, so a link that the platform refuses cannot produce an
       endless dial.
     - evaluateLiveness(): given the newest inbound and outbound
       activity and a caller-supplied reading of the clock, whether the
       session is fresh, is due a keepalive send, or is past its
       deadline.
     - canClaimConnected(): the rule that keeps a half-open socket from
       being advertised as healthy just because it still reports OPEN.

   This module is deliberately pure: it opens no socket, reads no clock,
   writes no file and touches nothing outside its arguments, which is
   what lets the whole rule be tested offline. No production module uses
   it yet - wiring it to the live service belongs to a later task, and
   the silence budget below is a documented figure plus a judgement, not
   a measurement taken from the broker.
   ============================================================ */

export const SUPERVISOR_STATES = Object.freeze({
  STOPPED: "stopped",
  CONNECTING: "connecting",
  AUTHENTICATING: "authenticating",
  READY: "ready",
  DEGRADED: "degraded",
  BACKOFF: "backoff",
});

export const SUPERVISOR_EVENTS = Object.freeze({
  DIAL: "dial",
  SOCKET_OPEN: "socket_open",
  SESSION_READY: "session_ready",
  ACTIVITY_FRESH: "activity_fresh",
  ACTIVITY_STALE: "activity_stale",
  SOCKET_CLOSED: "socket_closed",
  SOCKET_ERROR: "socket_error",
  GIVE_UP: "give_up",
  STOP: "stop",
});

export const LIVENESS_VERDICTS = Object.freeze({
  FRESH: "fresh",
  DUE: "due",
  EXPIRED: "expired",
});

// maxDelayMs and maxAttempts are the two caps the audit asked to be named.
// heartbeatSendAfterMs is the cadence the Open API connection guide asks a
// client to keep: a heartbeat event every 10 seconds of otherwise idle link.
// idleToleranceMs is the silence the platform's own message comment names -
// it is the figure above which a client is told to send heartbeats, not a
// measured disconnect timer - and deadlineGraceMs is this project's margin,
// so a session is only called dead once that tolerance has passed with room
// to spare. The two are judgements; only the 10s and 30s figures are quoted.
export const SUPERVISION_TIMING = Object.freeze({
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  maxAttempts: 6,
  heartbeatSendAfterMs: 10_000,
  idleToleranceMs: 30_000,
  deadlineGraceMs: 5_000,
});

const T = SUPERVISION_TIMING;
const STATES = SUPERVISOR_STATES;
const EVENTS = SUPERVISOR_EVENTS;

const TIMING_FIELDS = Object.freeze(Object.keys(T));
const FLAG_KEYS = Object.freeze(["connected", "authenticated", "ready"]);

const TRANSITIONS = Object.freeze({
  [STATES.STOPPED]: Object.freeze({
    dial: STATES.CONNECTING,
    stop: STATES.STOPPED,
  }),
  [STATES.CONNECTING]: Object.freeze({
    socket_open: STATES.AUTHENTICATING,
    socket_closed: STATES.BACKOFF,
    socket_error: STATES.BACKOFF,
    stop: STATES.STOPPED,
  }),
  [STATES.AUTHENTICATING]: Object.freeze({
    session_ready: STATES.READY,
    socket_closed: STATES.BACKOFF,
    socket_error: STATES.BACKOFF,
    stop: STATES.STOPPED,
  }),
  [STATES.READY]: Object.freeze({
    activity_stale: STATES.DEGRADED,
    socket_closed: STATES.BACKOFF,
    socket_error: STATES.BACKOFF,
    stop: STATES.STOPPED,
  }),
  [STATES.DEGRADED]: Object.freeze({
    activity_fresh: STATES.READY,
    socket_closed: STATES.BACKOFF,
    socket_error: STATES.BACKOFF,
    stop: STATES.STOPPED,
  }),
  [STATES.BACKOFF]: Object.freeze({
    dial: STATES.CONNECTING,
    give_up: STATES.STOPPED,
    stop: STATES.STOPPED,
  }),
});

const EVENT_REASONS = Object.freeze({
  dial: "a dial was requested",
  socket_open: "the socket opened",
  session_ready: "the trading session was authenticated",
  activity_fresh: "activity was observed again",
  activity_stale: "the link went silent past its deadline",
  socket_closed: "the socket closed",
  socket_error: "the socket reported an error",
  give_up: "the reconnect attempt cap was reached",
  stop: "a stop was requested",
});

function refusal(code, message, details = {}) {
  return Object.freeze({ ok: false, code, message, ...details });
}

function claim(verdict, code, advisory, message) {
  return Object.freeze({ ok: true, verdict, advisory, code, message });
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isTimestamp(value) {
  return Number.isInteger(value) && value >= 0;
}

function isKnownState(value) {
  return typeof value === "string" && Object.values(STATES).includes(value);
}

function isKnownEvent(value) {
  return typeof value === "string" && Object.values(EVENTS).includes(value);
}

function isClaimableVerdict(verdict) {
  return (
    verdict === LIVENESS_VERDICTS.FRESH || verdict === LIVENESS_VERDICTS.DUE
  );
}

function shown(value) {
  return typeof value === "string" ? value : String(value);
}

/* ============================================================
   TIMING CONFIGURATION
   ============================================================ */

export function resolveTiming(overrides) {
  if (overrides === null || overrides === undefined) {
    return Object.freeze({ ok: true, timing: T });
  }

  if (typeof overrides !== "object" || Array.isArray(overrides)) {
    return refusal(
      "timing_not_an_object",
      "The cTrader supervision timing override is not an object, so no timing was used."
    );
  }

  const keys = Object.keys(overrides);

  for (const key of keys) {
    if (!TIMING_FIELDS.includes(key)) {
      return refusal(
        "timing_key_unrecognised",
        `The cTrader supervision timing override names "${key}", which is not a timing this supervisor reads, so no timing was used.`,
        { field: key }
      );
    }
  }

  const merged = { ...T };

  for (const key of keys) {
    if (!isPositiveInteger(overrides[key])) {
      return refusal(
        "timing_field_not_a_positive_integer",
        `The cTrader supervision timing override sets "${key}" to ${shown(overrides[key])}, which is not a positive whole number of milliseconds, so no timing was used.`,
        { field: key }
      );
    }

    merged[key] = overrides[key];
  }

  if (merged.heartbeatSendAfterMs >= merged.idleToleranceMs + merged.deadlineGraceMs) {
    return refusal(
      "heartbeat_send_not_before_deadline",
      `The cTrader supervision timing would prompt a keepalive at ${merged.heartbeatSendAfterMs}ms of silence, which is not before the ${merged.idleToleranceMs + merged.deadlineGraceMs}ms deadline, so no timing was used.`,
      { field: "heartbeatSendAfterMs" }
    );
  }

  return Object.freeze({ ok: true, timing: Object.freeze(merged) });
}

/* ============================================================
   STATE MACHINE
   ============================================================ */

export function nextState({ state, event } = {}) {
  if (!isKnownState(state)) {
    return refusal(
      "unknown_state",
      `The current cTrader connection state ${shown(state)} is not one this supervisor recognises, so no transition was applied.`,
      { state: null }
    );
  }

  if (event === null || event === undefined || event === "") {
    return refusal(
      "missing_event",
      `No cTrader connection event was given for a session in state ${state}, so the state was kept.`,
      { state }
    );
  }

  if (!isKnownEvent(event)) {
    return refusal(
      "unknown_event",
      `The cTrader connection event ${shown(event)} is not one this supervisor recognises, so the state was kept.`,
      { state, event }
    );
  }

  const transition = TRANSITIONS[state][event];

  if (transition === undefined) {
    return refusal(
      "transition_not_allowed",
      `A cTrader connection in state ${state} does not move on the event ${event}, so the state was kept.`,
      { state, event }
    );
  }

  return Object.freeze({
    ok: true,
    state: transition,
    previousState: state,
    code: "transition_applied",
    message: `The cTrader connection moved from ${state} to ${transition} because ${EVENT_REASONS[event]}.`,
  });
}

/* ============================================================
   RECONNECT SCHEDULE
   ============================================================ */

export function planReconnectAttempt({ attempt, timing } = {}) {
  if (!isPositiveInteger(attempt)) {
    return Object.freeze({
      ok: false,
      attempt: null,
      delayMs: null,
      code: "attempt_not_a_positive_integer",
      message: `The cTrader reconnect attempt ${shown(attempt)} is not a positive whole number, so no attempt was planned.`,
    });
  }

  const resolved = resolveTiming(timing);

  if (resolved.ok === false) {
    return Object.freeze({
      ok: false,
      attempt,
      delayMs: null,
      code: "timing_unusable",
      reason: resolved.code,
      message: `The cTrader reconnect schedule for attempt ${attempt} was refused because ${resolved.message}`,
    });
  }

  const cfg = resolved.timing;

  if (attempt > cfg.maxAttempts) {
    return Object.freeze({
      ok: false,
      attempt,
      delayMs: null,
      maxAttempts: cfg.maxAttempts,
      code: "attempts_exhausted",
      message: `The cTrader reconnect attempt cap of ${cfg.maxAttempts} was reached, so no further attempt is scheduled and the session stays down until it is started again.`,
    });
  }

  const factor = 2 ** (attempt - 1);
  const baseDelay = cfg.baseDelayMs;
  const delayMs = Math.min(baseDelay * factor, cfg.maxDelayMs);

  return Object.freeze({
    ok: true,
    attempt,
    delayMs,
    code: "attempt_planned",
    message: `The next cTrader reconnect attempt ${attempt} is scheduled in ${delayMs}ms, capped at ${cfg.maxDelayMs}ms.`,
  });
}

/* ============================================================
   LIVENESS
   ============================================================ */

export function evaluateLiveness({
  lastInboundActivityMs,
  lastOutboundActivityMs,
  nowMs,
  timing,
} = {}) {
  const resolved = resolveTiming(timing);

  if (resolved.ok === false) {
    return refusal(
      "timing_unusable",
      `The cTrader liveness check was refused because ${resolved.message}`,
      { verdict: null, reason: resolved.code }
    );
  }

  const cfg = resolved.timing;
  const observed = [lastInboundActivityMs, lastOutboundActivityMs].filter(
    (value) => value !== null && value !== undefined
  );

  if (observed.length === 0) {
    return refusal(
      "activity_unobserved",
      "No cTrader inbound or outbound activity has been observed yet, so the liveness of this session is unknown rather than good.",
      { verdict: null }
    );
  }

  if (!observed.every(isTimestamp)) {
    return refusal(
      "activity_not_a_timestamp",
      `The observed cTrader activity timestamp ${shown(observed.find((value) => !isTimestamp(value)))} is not a whole number of milliseconds, so the liveness of this session is unknown.`,
      { verdict: null }
    );
  }

  if (!isTimestamp(nowMs)) {
    return refusal(
      "now_not_a_timestamp",
      `The supplied cTrader clock reading ${shown(nowMs)} is not a whole number of milliseconds, so the liveness of this session is unknown.`,
      { verdict: null }
    );
  }

  const lastActivityMs = Math.max(...observed);
  const deadlineAtMs =
    lastActivityMs + cfg.idleToleranceMs + cfg.deadlineGraceMs;

  if (nowMs < lastActivityMs) {
    return refusal(
      "clock_moved_backwards",
      `The supplied cTrader clock ${nowMs} is older than the newest observed activity ${lastActivityMs}, so the liveness of this session is unknown.`,
      { verdict: null, ageMs: null, lastActivityMs, deadlineAtMs }
    );
  }

  const ageMs = nowMs - lastActivityMs;

  if (nowMs >= deadlineAtMs) {
    return Object.freeze({
      ok: true,
      verdict: LIVENESS_VERDICTS.EXPIRED,
      code: "liveness_expired",
      ageMs,
      lastActivityMs,
      deadlineAtMs,
      advisory: null,
      message: `The cTrader link has been silent for ${ageMs}ms, past its deadline at ${deadlineAtMs}, so it is treated as dead even though the socket has not said otherwise.`,
    });
  }

  if (ageMs >= cfg.heartbeatSendAfterMs) {
    return Object.freeze({
      ok: true,
      verdict: LIVENESS_VERDICTS.DUE,
      code: "liveness_due_prompt",
      ageMs,
      lastActivityMs,
      deadlineAtMs,
      advisory: "heartbeat_send_due",
      message: `The cTrader link has been silent for ${ageMs}ms, so a keepalive is due before the deadline at ${deadlineAtMs}.`,
    });
  }

  return Object.freeze({
    ok: true,
    verdict: LIVENESS_VERDICTS.FRESH,
    code: "liveness_fresh",
    ageMs,
    lastActivityMs,
    deadlineAtMs,
    advisory: null,
    message: `The cTrader link was last active ${ageMs}ms ago, well inside its deadline at ${deadlineAtMs}.`,
  });
}

/* ============================================================
   HEALTH CLAIM
   ============================================================ */

export function canClaimConnected({ flags, liveness } = {}) {
  if (flags === null || typeof flags !== "object" || Array.isArray(flags)) {
    return refusal(
      "flags_not_an_object",
      `The cTrader socket flags ${shown(flags)} are not an object, so this supervisor refuses to say anything about the session.`,
      { verdict: null }
    );
  }

  for (const key of FLAG_KEYS) {
    if (typeof flags[key] !== "boolean") {
      return refusal(
        "flag_not_boolean",
        `The cTrader socket flag "${key}" is ${shown(flags[key])} rather than a boolean, so this supervisor refuses to say anything about the session.`,
        { verdict: null }
      );
    }
  }

  const down = FLAG_KEYS.filter((key) => flags[key] === false);

  if (down.length > 0) {
    return claim(
      "disconnected",
      "socket_flags_down",
      null,
      `The cTrader socket flag ${down.join(", ")} is down, so this session is disconnected.`
    );
  }

  if (liveness === null || liveness === undefined) {
    return claim(
      "degraded",
      "liveness_unobserved",
      null,
      "The cTrader socket reports itself open but no activity has been observed, so this session is degraded rather than connected."
    );
  }

  if (liveness.ok === false) {
    return claim(
      "degraded",
      "liveness_unobserved",
      null,
      `The cTrader socket reports itself open but its liveness could not be evaluated (${liveness.code}), so this session is degraded rather than connected.`
    );
  }

  if (isClaimableVerdict(liveness.verdict)) {
    const isDue = liveness.verdict === LIVENESS_VERDICTS.DUE;

    return claim(
      "connected",
      isDue ? "connected_heartbeat_due" : "connected",
      isDue ? "heartbeat_due" : null,
      isDue
        ? "The cTrader socket flags and the observed activity agree, so this session may be reported as connected, but a keepalive is due now."
        : "The cTrader socket flags and the observed activity agree, so this session may be reported as connected."
    );
  }

  if (liveness.verdict === LIVENESS_VERDICTS.EXPIRED) {
    return claim(
      "degraded",
      "liveness_expired",
      null,
      "The cTrader socket still reports itself open, but the observed activity is past its deadline, so this session cannot be reported as connected."
    );
  }

  return claim(
    "degraded",
    "liveness_verdict_unrecognised",
    null,
    `The cTrader liveness verdict ${shown(liveness.verdict)} is not one this supervisor recognises, so this session cannot be reported as connected.`
  );
}
