import {
  assessRecoveryClock,
  RECOVERY_CLOCK_STATUS,
} from "../utils/trading/recoveryClock.js";
import { buildRecoveryWindows } from "./mt5RecoveryWindows.js";
import {
  planMT5RecoveryPreview,
  RECOVERY_ORCHESTRATOR_STATUS,
} from "./mt5RecoveryOrchestrator.js";

// ============================================================
// Stage D — one preview, from the clock the broker actually reported
//
// The scan reads, the adapter proposes and the orchestrator confirms the
// account — but every one of them takes its range or its identity from a
// caller, and until now no caller existed. This module is that caller, with
// the smallest possible amount of authority: it decides *whether a preview may
// run at all* and *which ranges it may run over*, and then hands the pipeline
// the scan outcome it produced without touching it.
//
// What it will not do:
//   - anchor on this machine. The only instant a window may end at comes from
//     assessRecoveryClock, which refuses a sample it cannot tie to an MT5 tick
//     and to the account being recovered (src/utils/trading/recoveryClock.js).
//     No `Date.now()` appears in this file, and `now` is a parameter.
//   - widen the read. The ranges are what buildRecoveryWindows derives from the
//     accepted anchor under the fixed 90-day / 30-day policy; a caller-supplied
//     `windows` in the input is not read at all, because a hand-written range is
//     exactly what that policy exists to refuse.
//   - soften a gate. The scan, adapter and orchestrator verdicts are passed
//     through: their status, refusals, records, skipped, rejected and remaining
//     arrive here as they left them, and a blocked stage stays blocked with its
//     own codes rather than being relabelled as a clock problem.
//   - write. There is no journal, storage, watermark or checkpoint call in this
//     module, and the returned verdict repeats the orchestrator's
//     `journalWritten: false` / `watermarkAdvanced: false` so a caller cannot
//     mistake a preview for a commit.
//
// Input:
//   clockSample      the identity-bound sample TradeContext remembers
//   now              client instant in ms the age is measured against; required
//   account          the persisted trading account (id, mt5Login, mt5Server)
//   existingJournal  what that account's journal already holds, for deduping
//   apiUrl, fetchImpl  forwarded to the scan untouched
//
// Output (frozen): the orchestrator's verdict —
//   { status: "preview" | "blocked", refusals, records, skipped, rejected,
//     remaining, coverageComplete: false, retentionVerified: false,
//     journalWritten: false, watermarkAdvanced: false, identity, outcome }
//   plus the binding this module added: { clock, windowPlan, anchorUtc,
//   anchorMs, windows }.
// ============================================================

export const RECOVERY_PREVIEW_STATUS = Object.freeze({
  PREVIEW: RECOVERY_ORCHESTRATOR_STATUS.PREVIEW,
  BLOCKED: RECOVERY_ORCHESTRATOR_STATUS.BLOCKED,
});

export const RECOVERY_PREVIEW_REASONS = Object.freeze({
  CLOCK_REFUSED: "RECOVERY_PREVIEW_CLOCK_REFUSED",
  WINDOWS_REFUSED: "RECOVERY_PREVIEW_WINDOWS_REFUSED",
});

const R = RECOVERY_PREVIEW_REASONS;

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

function blocked(refusals, bound = {}) {
  return Object.freeze({
    status: RECOVERY_PREVIEW_STATUS.BLOCKED,
    refusals: Object.freeze([...refusals]),
    records: Object.freeze([]),
    skipped: Object.freeze([]),
    rejected: Object.freeze([]),
    remaining: Object.freeze({
      unresolvedCount: 0,
      unassignedCount: 0,
      refusedCount: 0,
    }),
    coverageComplete: false,
    retentionVerified: false,
    journalWritten: false,
    watermarkAdvanced: false,
    identity: bound.identity ?? null,
    outcome: bound.outcome ?? null,
    clock: bound.clock ?? null,
    windowPlan: bound.windowPlan ?? null,
    anchorUtc: bound.anchorUtc ?? null,
    anchorMs: bound.anchorMs ?? null,
    windows: Object.freeze([]),
  });
}

// The same keys TradeContext reads when it captures a sample: a persisted
// account may name its broker login under either spelling, and anything it
// cannot name fails closed rather than defaulting.
function expectedIdentityOf(account) {
  if (!isPlainObject(account)) return null;

  return {
    mt5Login: account.mt5Login ?? account.login ?? null,
    mt5Server: account.mt5Server ?? account.server ?? null,
  };
}

export async function planRecoveryPreviewFromClock(input = {}) {
  const request = isPlainObject(input) ? input : {};

  const clock = assessRecoveryClock({
    sample: request.clockSample,
    expectedIdentity: expectedIdentityOf(request.account),
    now: request.now,
  });

  if (clock.status !== RECOVERY_CLOCK_STATUS.ACCEPTED) {
    return blocked([R.CLOCK_REFUSED], { clock });
  }

  const windowPlan = buildRecoveryWindows({ anchorUtc: clock.anchorUtc });

  if (windowPlan.refusal !== null) {
    return blocked([R.WINDOWS_REFUSED], {
      clock,
      windowPlan,
      anchorUtc: clock.anchorUtc,
      anchorMs: clock.anchorMs,
    });
  }

  // The identity the broker itself reported on the response this sample came
  // from — not whatever the caller asserts. The orchestrator then refuses if
  // the persisted account record disagrees with it.
  const liveIdentity = {
    mt5Login: clock.sample.identity.mt5Login,
    mt5Server: clock.sample.identity.mt5Server,
  };

  const verdict = await planMT5RecoveryPreview({
    apiUrl: request.apiUrl,
    fetchImpl: request.fetchImpl,
    account: request.account,
    liveIdentity,
    windows: windowPlan.windows,
    existingJournal: request.existingJournal,
  });

  return Object.freeze({
    ...verdict,
    clock,
    windowPlan,
    anchorUtc: clock.anchorUtc,
    anchorMs: clock.anchorMs,
    windows: windowPlan.windows,
  });
}
