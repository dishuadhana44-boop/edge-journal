import {
  RECOVERY_COMMIT_STATUS,
  planRecoveryJournalCommit,
} from "./mt5RecoveryJournalCommit.js";

// One login rule for the whole pipeline, and one window builder. Both are
// imported rather than restated: a second spelling of either would let this
// module scope a watermark under a login or a cover the module that produced
// the preview never emits.
import {
  canonicalLogin,
  RECOVERY_CLOCK_STATUS,
} from "../utils/trading/recoveryClock.js";
import {
  buildRecoveryWindows,
  RECOVERY_WINDOW_POLICY,
} from "./mt5RecoveryWindows.js";

// ============================================================
// Stage D — the recovery commit contract
//
// The planner (mt5RecoveryJournalCommit.js:325-404) answers "may these rows go
// into this account's journal?". This module answers the two questions a writer
// then has to answer, and answers them without writing anything:
//
//   1. Is the plan in hand still a plan this pipeline produced? A plan is data
//      by the time it reaches here, so every claim in it gets re-checked: the
//      account it names, the broker identity it was scanned for, the snapshot
//      each record was read against, and whether the journal it publishes is
//      still existing rows followed by the append. JournalContext.addTrade
//      cannot be the safety net for that: it dedupes on String(id) alone
//      (src/context/JournalContext.jsx:397-402), shallow-merges the incoming
//      row over whatever it hit (:437-443), and defaults an omitted account to
//      the selected one (:360-370) — so a hand-built or stale plan would
//      overwrite a user's edits and file the trade under the wrong account.
//   2. Did a durable writer actually put the bytes there? A prepared step is a
//      proposal: `committed:false`, and its watermark says so. Only
//      verifyRecoveryCommitEvidence turns that into a commit claim, and only
//      when the journal bytes and the watermark bytes each read back equal to
//      what this module froze. That is the same proof journalStorage.js demands
//      of a journal save (:235), applied to both values independently: a save
//      that reported success but reads back differently has not happened.
//
// The watermark is scoped to version + canonical account id + broker login +
// lowercased server (recoveryWatermarkStorageKey), so a watermark written for
// one identity can never be read as another's, and its time anchor is the
// broker-clock second the preview was planned from (the same shape
// src/utils/trading/recoveryClock.js:347 produces), which every appended
// record must independently name in its own liveSnapshotToUtc (the field
// adaptRecord sets in mt5RecoveryJournalAdapter.js). Version 1 is a whole-value
// snapshot; a future change to its fields must bump it rather than reuse the
// key with new meaning.
//
// Both halves of that scope come from the pipeline's own rules rather than from
// a second copy of them here: the login through the recovery clock's
// canonicalLogin (trim, strip every leading zero, refuse empty or over fifteen
// digits), and the anchor through the preview's clock reading and the cover
// buildRecoveryWindows makes for it. A leading zero kept here would scope a
// watermark the next run cannot find, and an anchor nobody measured would move
// every range without leaving a trace, so both are re-derived, never copied.
//
// Input:
//   plan            a planner result, trusted as nothing until re-checked
//   verdict         the preview that plan was planned from — the only source of
//                   the identity and anchor this step may carry. Its clock
//                   reading and window plan are read with it: an anchor is only
//                   accepted if the sample produced it and the cover divides it
//   accountId       canonical account id; never defaulted, never "selected"
//   identity        { mt5Login, mt5Server } the scan was confirmed for; must
//                   match the preview's or the step is refused
//   anchorUtc       broker-clock second the windows were anchored to; likewise
//                   must match the preview's
//   existingJournal optional; when supplied it must BE the plan's prefix
//   journalEvidence/watermarkEvidence  { readBack } from the durable writer
//
// Output (frozen):
//   prepared: { status:"prepared", refusals:[], append, rejected, journal,
//     changed, accountId, identity, anchorUtc, provenance, provenanceBytes,
//     watermark, journalBytes, watermarkBytes, committed:false,
//     journalWritten:false, watermarkAdvanced:false, coverageComplete:false,
//     retentionVerified:false }
//   refused:  the same keys with the data fields null, so a refused step
//     cannot be handed to a writer by accident
//   evidence: { status:"committed"|"uncommitted"|"refused", refusals,
//     journalVerified, watermarkVerified, committed, journalWritten,
//     watermarkAdvanced, coverageComplete:false, retentionVerified:false,
//     accountId, identity, anchorUtc, effectiveWatermark }
//
// Still no writer here: coverage and retention stay unproven no matter what
// reads back, because the bridge can only ever answer
// source_scan_complete:false and retention_verified:false
// (mt5-bridge/app.py:6620,6638).
// ============================================================

export const RECOVERY_WATERMARK_VERSION = 1;

// Version 1 of the provenance record is the scope (account + broker identity)
// and the boundary (anchor second) that the preview verdict named, and nothing
// else. It is metadata, not a signature: it lets this module say "these values
// came from that preview" because it re-derived them from the preview itself,
// never because a caller asserted them.
export const RECOVERY_COMMIT_PROVENANCE_VERSION = 1;

export const RECOVERY_COMMIT_STEP_STATUS = Object.freeze({
  PREPARED: "prepared",
  REFUSED: "refused",
});

export const RECOVERY_COMMIT_EVIDENCE_STATUS = Object.freeze({
  COMMITTED: "committed",
  UNCOMMITTED: "uncommitted",
  REFUSED: "refused",
});

export const RECOVERY_COMMIT_STEP_REASONS = Object.freeze({
  ACCOUNT_ID_MISSING: "RECOVERY_COMMIT_ACCOUNT_ID_MISSING",
  PLAN_NOT_COMMITTABLE: "RECOVERY_COMMIT_PLAN_NOT_COMMITTABLE",
  PLAN_CLAIMS_WRITE: "RECOVERY_COMMIT_PLAN_CLAIMS_WRITE",
  PLAN_CLAIMS_COVERAGE: "RECOVERY_COMMIT_PLAN_CLAIMS_COVERAGE",
  PLAN_ACCOUNT_MISMATCH: "RECOVERY_COMMIT_PLAN_ACCOUNT_MISMATCH",
  PLAN_NOT_APPEND_ONLY: "RECOVERY_COMMIT_PLAN_NOT_APPEND_ONLY",
  EXISTING_JOURNAL_INVALID: "RECOVERY_COMMIT_EXISTING_JOURNAL_INVALID",

  IDENTITY_INVALID: "RECOVERY_COMMIT_IDENTITY_INVALID",
  ANCHOR_INVALID: "RECOVERY_COMMIT_ANCHOR_INVALID",

  RECORD_INVALID: "RECOVERY_COMMIT_RECORD_INVALID",
  RECORD_PROVENANCE_INVALID: "RECOVERY_COMMIT_RECORD_PROVENANCE_INVALID",
  RECORD_ID_INVALID: "RECOVERY_COMMIT_RECORD_ID_INVALID",
  RECORD_POSITION_INVALID: "RECOVERY_COMMIT_RECORD_POSITION_INVALID",
  RECORD_CLAIMS_COVERAGE: "RECOVERY_COMMIT_RECORD_CLAIMS_COVERAGE",
  RECORD_ACCOUNT_MISMATCH: "RECOVERY_COMMIT_RECORD_ACCOUNT_MISMATCH",
  RECORD_IDENTITY_MISMATCH: "RECOVERY_COMMIT_RECORD_IDENTITY_MISMATCH",
  RECORD_ANCHOR_MISMATCH: "RECOVERY_COMMIT_RECORD_ANCHOR_MISMATCH",

  ID_COLLISION: "RECOVERY_COMMIT_ID_COLLISION",
  ID_JOURNALED_ELSEWHERE: "RECOVERY_COMMIT_ID_JOURNALED_ELSEWHERE",
  POSITION_COLLISION: "RECOVERY_COMMIT_POSITION_COLLISION",
  DUPLICATE_ID: "RECOVERY_COMMIT_DUPLICATE_ID",
  DUPLICATE_POSITION: "RECOVERY_COMMIT_DUPLICATE_POSITION",

  PREVIEW_INVALID: "RECOVERY_COMMIT_PREVIEW_INVALID",
  PREVIEW_REFUSALS_PRESENT: "RECOVERY_COMMIT_PREVIEW_REFUSALS_PRESENT",
  PREVIEW_CLAIMS_WRITE: "RECOVERY_COMMIT_PREVIEW_CLAIMS_WRITE",
  PREVIEW_CLAIMS_COVERAGE: "RECOVERY_COMMIT_PREVIEW_CLAIMS_COVERAGE",
  PREVIEW_IDENTITY_INVALID: "RECOVERY_COMMIT_PREVIEW_IDENTITY_INVALID",
  PREVIEW_ANCHOR_INVALID: "RECOVERY_COMMIT_PREVIEW_ANCHOR_INVALID",
  PREVIEW_ACCOUNT_MISMATCH: "RECOVERY_COMMIT_PREVIEW_ACCOUNT_MISMATCH",

  // The anchor is only the broker's second if the preview can show the reading
  // it came from and the ranges that reading built.
  PREVIEW_CLOCK_INVALID: "RECOVERY_COMMIT_PREVIEW_CLOCK_INVALID",
  PREVIEW_CLOCK_ANCHOR_MISMATCH:
    "RECOVERY_COMMIT_PREVIEW_CLOCK_ANCHOR_MISMATCH",
  PREVIEW_CLOCK_IDENTITY_MISMATCH:
    "RECOVERY_COMMIT_PREVIEW_CLOCK_IDENTITY_MISMATCH",
  PREVIEW_WINDOWS_INVALID: "RECOVERY_COMMIT_PREVIEW_WINDOWS_INVALID",
  PREVIEW_WINDOW_SEQUENCE_INVALID:
    "RECOVERY_COMMIT_PREVIEW_WINDOW_SEQUENCE_INVALID",
  PREVIEW_WINDOW_TOO_WIDE: "RECOVERY_COMMIT_PREVIEW_WINDOW_TOO_WIDE",
  PREVIEW_WINDOW_PLAN_MISMATCH: "RECOVERY_COMMIT_PREVIEW_WINDOW_PLAN_MISMATCH",

  PROVENANCE_IDENTITY_CONFLICT: "RECOVERY_COMMIT_PROVENANCE_IDENTITY_CONFLICT",
  PROVENANCE_ANCHOR_CONFLICT: "RECOVERY_COMMIT_PROVENANCE_ANCHOR_CONFLICT",
  PROVENANCE_INVALID: "RECOVERY_COMMIT_PROVENANCE_INVALID",
  PLAN_NOT_PREVIEW_OUTPUT: "RECOVERY_COMMIT_PLAN_NOT_PREVIEW_OUTPUT",

  PREPARED_STEP_INVALID: "RECOVERY_COMMIT_PREPARED_STEP_INVALID",
  JOURNAL_EVIDENCE_INVALID: "RECOVERY_COMMIT_JOURNAL_EVIDENCE_INVALID",
  JOURNAL_EVIDENCE_MISMATCH: "RECOVERY_COMMIT_JOURNAL_EVIDENCE_MISMATCH",
  WATERMARK_EVIDENCE_INVALID: "RECOVERY_COMMIT_WATERMARK_EVIDENCE_INVALID",
  WATERMARK_EVIDENCE_MISMATCH: "RECOVERY_COMMIT_WATERMARK_EVIDENCE_MISMATCH",
});

const S = RECOVERY_COMMIT_STEP_REASONS;

const RECOVERED_SOURCE = "history-recovery";
const RECOVERED_BROKER = "MT5";

const DIGITS_ONLY = /^[0-9]+$/;

// The second-precision UTC shape the recovery clock produces
// (src/utils/trading/recoveryClock.js:347) and the scan forwards.
const ANCHOR_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const DAY_MS = 86_400_000;

// The tile ceiling the window policy gives a scan, in milliseconds
// (src/lib/mt5RecoveryWindows.js:45-51). A preview that names a wider range is
// claiming a read the pipeline refuses to make.
const MAX_TILE_MS = RECOVERY_WINDOW_POLICY.TILE_DAYS * DAY_MS;

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

// Mirrors mt5RecoveryJournalCommit.js:142-150 so the account this module
// names is the account the planner and the adapter named.
function accountText(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "string" && value.trim() !== "") return value.trim();

  return null;
}

function loginText(value) {
  const canonical = canonicalLogin(value);

  return typeof canonical.login === "string" ? canonical.login : null;
}

// Lowercased for comparison and storage: the route and the scan both treat the
// server name case-insensitively (server/routes/mt5.js:760,
// src/lib/mt5RecoveryJournalAdapter.js:474), so a watermark must not be scoped
// to whichever spelling the caller happened to hold.
function serverText(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (trimmed === "") return null;

  for (const character of trimmed) {
    if (character.codePointAt(0) < 32) return null;
  }

  return trimmed.toLowerCase();
}

function anchorText(value) {
  if (typeof value !== "string") return null;
  if (!ANCHOR_INSTANT.test(value)) return null;

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function positionText(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? String(value) : null;
  }

  if (typeof value === "string" && DIGITS_ONLY.test(value)) return value;

  return null;
}

function rowsOf(value) {
  return Array.isArray(value) && value.every(isPlainObject);
}

// The version-1 watermark is a scope plus a broker boundary. Write claims do
// not belong in it: only verifyRecoveryCommitEvidence may say bytes landed, and
// only the pipeline may say anything about coverage.
const WATERMARK_SCHEMA = [
  "accountId",
  "anchorUtc",
  "coverageComplete",
  "mt5Login",
  "mt5Server",
  "retentionVerified",
  "storageKey",
  "version",
]
  .sort()
  .join("|");

function watermarkFields(watermark) {
  return Object.keys(watermark).sort().join("|");
}

// A provenance record is a scope and a boundary. It carries no write, coverage
// or retention claim, and no row content: those belong to the plan and the
// watermark, both of which are checked against it.
const PROVENANCE_SCHEMA = [
  "accountId",
  "anchorUtc",
  "mt5Login",
  "mt5Server",
  "version",
]
  .sort()
  .join("|");

function provenanceFields(provenance) {
  return Object.keys(provenance).sort().join("|");
}

function refusedStep(refusals, accountId = null) {
  return Object.freeze({
    status: RECOVERY_COMMIT_STEP_STATUS.REFUSED,
    refusals: Object.freeze([...refusals]),
    append: null,
    rejected: null,
    journal: null,
    changed: false,
    accountId,
    identity: null,
    anchorUtc: null,
    provenance: null,
    provenanceBytes: null,
    watermark: null,
    journalBytes: null,
    watermarkBytes: null,
    committed: false,
    journalWritten: false,
    watermarkAdvanced: false,
    coverageComplete: false,
    retentionVerified: false,
  });
}

// ==========================================================
// The watermark key, defined once
// ==========================================================

export function recoveryWatermarkStorageKey(input = {}) {
  const request = isPlainObject(input) ? input : {};

  const accountId = accountText(request.accountId);

  if (accountId === null) {
    throw new TypeError(
      "recoveryWatermarkStorageKey requires a canonical account id"
    );
  }

  const login = loginText(request.mt5Login);

  if (login === null) {
    throw new TypeError(
      "recoveryWatermarkStorageKey requires a numeric MT5 login"
    );
  }

  const server = serverText(request.mt5Server);

  if (server === null) {
    throw new TypeError(
      "recoveryWatermarkStorageKey requires an MT5 server name"
    );
  }

  return `mt5-recovery-watermark:${RECOVERY_WATERMARK_VERSION}:${login}:${server}:${accountId}`;
}

// ==========================================================
// Reading the plan back
// ==========================================================

function readPlan(plan, accountId, refusals) {
  if (!isPlainObject(plan)) {
    refusals.push(S.PLAN_NOT_COMMITTABLE);
    return null;
  }

  if (
    plan.status !== RECOVERY_COMMIT_STATUS.PLANNED ||
    !Array.isArray(plan.append) ||
    !Array.isArray(plan.rejected) ||
    !Array.isArray(plan.journal) ||
    !Array.isArray(plan.refusals) ||
    plan.refusals.length > 0
  ) {
    refusals.push(S.PLAN_NOT_COMMITTABLE);
    return null;
  }

  if (plan.changed !== plan.append.length > 0) {
    refusals.push(S.PLAN_NOT_COMMITTABLE);
  }

  if (plan.journalWritten !== false || plan.watermarkAdvanced !== false) {
    refusals.push(S.PLAN_CLAIMS_WRITE);
  }

  if (plan.coverageComplete !== false || plan.retentionVerified !== false) {
    refusals.push(S.PLAN_CLAIMS_COVERAGE);
  }

  if (accountText(plan.accountId) !== accountId) {
    refusals.push(S.PLAN_ACCOUNT_MISMATCH);
  }

  return plan;
}

// ==========================================================
// Reading the preview the plan was planned from
// ==========================================================

// The preview is the only thing in this pipeline that can name who was scanned
// and up to which broker-clock second: the orchestrator freezes the identity it
// confirmed against the persisted account (its planMT5RecoveryPreview identity)
// and the clock coordinator adds the anchor (src/lib/mt5RecoveryPreview.js:154-161).
// A verdict is data by the time it reaches here, so its own claims are re-read
// before a single value is copied out of it.
function readPreview(verdict, refusals) {
  if (!isPlainObject(verdict)) {
    refusals.push(S.PREVIEW_INVALID);
    return null;
  }

  if (
    verdict.status !== "preview" ||
    !Array.isArray(verdict.records) ||
    !Array.isArray(verdict.skipped) ||
    !Array.isArray(verdict.rejected) ||
    !Array.isArray(verdict.refusals)
  ) {
    refusals.push(S.PREVIEW_INVALID);
    return null;
  }

  if (verdict.refusals.length > 0) {
    refusals.push(S.PREVIEW_REFUSALS_PRESENT);
    return null;
  }

  // A preview that already claims a write is not a preview; nothing downstream
  // can tell it apart from a commit receipt.
  if (verdict.journalWritten !== false || verdict.watermarkAdvanced !== false) {
    refusals.push(S.PREVIEW_CLAIMS_WRITE);
    return null;
  }

  if (verdict.coverageComplete !== false || verdict.retentionVerified !== false) {
    refusals.push(S.PREVIEW_CLAIMS_COVERAGE);
    return null;
  }

  const accountId = accountText(verdict.accountId);

  if (accountId === null) {
    refusals.push(S.PREVIEW_INVALID);
    return null;
  }

  // The broker's own spelling, or nothing: the { login, server } shape some
  // callers invent names no account this pipeline scanned.
  const source = isPlainObject(verdict.identity) ? verdict.identity : null;
  const login = source === null ? null : loginText(source.mt5Login);
  const server = source === null ? null : serverText(source.mt5Server);

  if (login === null || server === null) {
    refusals.push(S.PREVIEW_IDENTITY_INVALID);
    return null;
  }

  const anchorUtc = anchorText(verdict.anchorUtc);

  if (anchorUtc === null) {
    refusals.push(S.PREVIEW_ANCHOR_INVALID);
    return null;
  }

  // The anchor is a claim about the broker's clock, and the preview carries the
  // reading it was made from (mt5RecoveryPreview.js:116-160). A string that is
  // valid to the second proves nothing on its own: an anchor taken from this
  // machine's clock, or from another account's tick, moves every range the scan
  // read and loses the closures that lived outside them without a trace.
  const clock = readClockEvidence(
    verdict.clock,
    verdict.anchorMs,
    Object.freeze({ login, server, anchorUtc }),
    refusals
  );

  if (clock === null) return null;

  // And the ranges are the ranges that second builds
  // (src/lib/mt5RecoveryWindows.js:96-148). This is the same call the
  // coordinator makes, so a cover that was narrowed, widened or shifted is
  // named rather than trusted.
  const cover = readWindowEvidence(
    Object.freeze({
      anchorUtc,
      windows: verdict.windows,
      windowPlan: verdict.windowPlan,
    }),
    refusals
  );

  if (cover === null) return null;

  return Object.freeze({ accountId, login, server, anchorUtc });
}

// An accepted clock reading, or null with the reason this preview's anchor
// cannot be trusted. Deliberately narrow: it asks whether the sample names this
// account at this second, and nothing about what the broker kept.
function readClockEvidence(clock, claimedAnchorMs, bound, refusals) {
  const reading = isPlainObject(clock) ? clock : null;
  const sample = reading === null ? null : reading.sample;
  const identity = isPlainObject(sample) ? sample.identity : null;

  if (
    reading === null ||
    reading.status !== RECOVERY_CLOCK_STATUS.ACCEPTED ||
    identity === null ||
    !Number.isSafeInteger(reading.anchorMs) ||
    reading.anchorMs <= 0 ||
    !Number.isSafeInteger(claimedAnchorMs)
  ) {
    refusals.push(S.PREVIEW_CLOCK_INVALID);
    return null;
  }

  const clockAnchorUtc = anchorText(reading.anchorUtc);
  const clockLogin = loginText(identity.mt5Login);
  const clockServer = serverText(identity.mt5Server);

  if (clockAnchorUtc === null || clockLogin === null || clockServer === null) {
    refusals.push(S.PREVIEW_CLOCK_INVALID);
    return null;
  }

  // One instant, three spellings of it: the text the verdict carries, the text
  // the clock answered with, and the milliseconds beside them
  // (recoveryClock.js assessRecoveryClock's verdict, mt5RecoveryPreview.js:158-159).
  if (
    clockAnchorUtc !== bound.anchorUtc ||
    reading.anchorMs !== Date.parse(bound.anchorUtc) ||
    claimedAnchorMs !== reading.anchorMs
  ) {
    refusals.push(S.PREVIEW_CLOCK_ANCHOR_MISMATCH);
    return null;
  }

  // The sample belongs to whichever terminal answered (recoveryClock.js:17-21),
  // and its server is the broker's own spelling while the preview's is the
  // account's — so the comparison is the one the orchestrator uses
  // (planMT5RecoveryPreview's identity comparison): login canonicalised, server folded.
  if (clockLogin !== bound.login || clockServer !== bound.server) {
    refusals.push(S.PREVIEW_CLOCK_IDENTITY_MISMATCH);
    return null;
  }

  return Object.freeze({ login: clockLogin, server: clockServer });
}

function readWindowEvidence(claimed, refusals) {
  const { anchorUtc, windows, windowPlan } = claimed;

  const plan = isPlainObject(windowPlan) ? windowPlan : null;
  const planned = plan === null ? null : plan.windows;

  if (
    !Array.isArray(windows) ||
    windows.length === 0 ||
    !windows.every(isPlainObject) ||
    plan === null ||
    plan.refusal !== null ||
    !Array.isArray(planned) ||
    !planned.every(isPlainObject)
  ) {
    refusals.push(S.PREVIEW_WINDOWS_INVALID);
    return null;
  }

  // The scan forwards the ranges it was handed (mt5HistoryRecoveryScan.js:226
  // reads them straight through), so the cover the preview reports has to be
  // the cover its own plan holds.
  if (!sameWindows(windows, planned)) {
    refusals.push(S.PREVIEW_WINDOW_SEQUENCE_INVALID);
    return null;
  }

  for (const window of planned) {
    const fromUtc = typeof window.fromUtc === "string" ? window.fromUtc : "";
    const toUtc = typeof window.toUtc === "string" ? window.toUtc : "";

    if (
      !ANCHOR_INSTANT.test(fromUtc) ||
      !ANCHOR_INSTANT.test(toUtc) ||
      Date.parse(toUtc) <= Date.parse(fromUtc)
    ) {
      refusals.push(S.PREVIEW_WINDOW_SEQUENCE_INVALID);
      return null;
    }

    if (Date.parse(toUtc) - Date.parse(fromUtc) > MAX_TILE_MS) {
      refusals.push(S.PREVIEW_WINDOW_TOO_WIDE);
      return null;
    }
  }

  // Rebuilt from the module that owns the policy rather than compared against a
  // tile count copied into this file: a cover that stops short of the anchor,
  // starts after it, or does not divide it into the ranges the pipeline is
  // allowed to read, is not this preview's cover.
  const canonical = buildRecoveryWindows({ anchorUtc });

  if (canonical.refusal !== null || !sameWindows(planned, canonical.windows)) {
    refusals.push(S.PREVIEW_WINDOW_PLAN_MISMATCH);
    return null;
  }

  return Object.freeze({ windows: canonical.windows });
}

// Whole-second bounds, in order, with no gap between neighbours: the only two
// fields a window has (src/lib/mt5RecoveryWindows.js:141).
function sameWindows(left, right) {
  return (
    left.length === right.length &&
    left.every(
      (window, index) =>
        window.fromUtc === right[index].fromUtc &&
        window.toUtc === right[index].toUtc
    )
  );
}

// Fixed keys, in fixed order: what the planner returns for this preview and
// this journal, compared as bytes rather than as an object a caller may have
// built with different keys than the planner writes.
function planFingerprint(plan) {
  return JSON.stringify([
    plan.status,
    plan.refusals,
    plan.append,
    plan.rejected,
    plan.journal,
    plan.changed,
    plan.accountId,
    plan.coverageComplete,
    plan.retentionVerified,
    plan.journalWritten,
    plan.watermarkAdvanced,
  ]);
}

// The plan publishes existing rows followed by the append. Rebuild that shape
// from the rows themselves rather than trusting the array it hands over.
function readJournalShape(plan, existingJournal, refusals) {
  const { journal, append } = plan;

  // Row shapes belong to the append check below, not here: this comparison is
  // only about whether the journal is the existing rows followed by the append.
  const expected =
    existingJournal.length + append.length === journal.length &&
    journal.every(
      (row, index) =>
        index < existingJournal.length
          ? row === existingJournal[index]
          : row === append[index - existingJournal.length]
    );

  if (!expected) {
    refusals.push(S.PLAN_NOT_APPEND_ONLY);
    return null;
  }

  return journal.slice(0, existingJournal.length);
}

function readRecords(append, context, refusals) {
  const readable = [];

  for (const row of append) {
    if (!isPlainObject(row)) {
      refusals.push(S.RECORD_INVALID);
      continue;
    }

    if (row.source !== RECOVERED_SOURCE || row.broker !== RECOVERED_BROKER) {
      refusals.push(S.RECORD_PROVENANCE_INVALID);
      continue;
    }

    if (typeof row.id !== "string" || row.id.trim() === "") {
      refusals.push(S.RECORD_ID_INVALID);
      continue;
    }

    const positionId = positionText(row.brokerPositionId);

    if (positionId === null) {
      refusals.push(S.RECORD_POSITION_INVALID);
      continue;
    }

    if (row.coverageComplete !== false) {
      refusals.push(S.RECORD_CLAIMS_COVERAGE);
      continue;
    }

    if (accountText(row.accountId) !== context.accountId) {
      refusals.push(S.RECORD_ACCOUNT_MISMATCH);
      continue;
    }

    if (
      loginText(row.mt5Login) !== context.login ||
      serverText(row.mt5Server) !== context.server
    ) {
      refusals.push(S.RECORD_IDENTITY_MISMATCH);
      continue;
    }

    if (row.liveSnapshotToUtc !== context.anchorUtc) {
      refusals.push(S.RECORD_ANCHOR_MISMATCH);
      continue;
    }

    readable.push({ row, id: row.id, positionId });
  }

  return readable;
}

function indexExisting(rows, accountId) {
  const ids = new Set();
  const foreignIds = new Set();
  const positions = new Set();

  for (const row of rows) {
    if (row.id !== undefined && row.id !== null) {
      if (accountText(row.accountId) === accountId) {
        ids.add(String(row.id));
      } else {
        // Policy 3X-7D-B, in lock-step with the planner's index
        // (mt5RecoveryJournalCommit.js). Ids are one namespace across the whole
        // journal: the step this module prepares is what a writer hands
        // storage, and the write matches on String(id) alone wherever the row
        // is filed. Positions stay account-scoped.
        foreignIds.add(String(row.id));
      }
    }

    if (accountText(row.accountId) !== accountId) continue;

    const positionId = positionText(row.brokerPositionId);

    if (positionId === null) continue;

    // Another broker's position numbers live in a different space, so they
    // must not silence this account's recovery
    // (mt5RecoveryJournalCommit.js indexJournal).
    if (row.broker !== undefined && row.broker !== null && row.broker !== RECOVERED_BROKER) {
      continue;
    }

    positions.add(positionId);
  }

  return { ids, foreignIds, positions };
}

// ==========================================================
// Public entry point
// ==========================================================

export function prepareRecoveryCommitStep(input = {}) {
  const request = isPlainObject(input) ? input : {};

  const refusals = [];

  const accountId = accountText(request.accountId);

  if (accountId === null) refusals.push(S.ACCOUNT_ID_MISSING);

  const plan = accountId === null ? null : readPlan(request.plan, accountId, refusals);

  const login = loginText(isPlainObject(request.identity) ? request.identity.mt5Login : null);
  const server = serverText(isPlainObject(request.identity) ? request.identity.mt5Server : null);

  if (login === null || server === null) refusals.push(S.IDENTITY_INVALID);

  const anchorUtc = anchorText(request.anchorUtc);

  if (anchorUtc === null) refusals.push(S.ANCHOR_INVALID);

  // The preview decides what the identity and the anchor are; the caller's
  // copies of them are only a claim until this comparison says otherwise. A
  // plan that appends nothing carries no row to check them against, so without
  // the preview there is nothing in this input that names a broker at all.
  const bound = readPreview(request.verdict, refusals);

  if (bound !== null) {
    if (accountId !== null && bound.accountId !== accountId) {
      refusals.push(S.PREVIEW_ACCOUNT_MISMATCH);
    }

    if (
      login !== null &&
      server !== null &&
      (bound.login !== login || bound.server !== server)
    ) {
      refusals.push(S.PROVENANCE_IDENTITY_CONFLICT);
    }

    if (anchorUtc !== null && bound.anchorUtc !== anchorUtc) {
      refusals.push(S.PROVENANCE_ANCHOR_CONFLICT);
    }
  }

  // An omitted journal is not an empty journal: the caller has to say what the
  // account already holds before anything may be added to it.
  const existingJournal = rowsOf(request.existingJournal)
    ? request.existingJournal
    : null;

  if (existingJournal === null) refusals.push(S.EXISTING_JOURNAL_INVALID);

  const prefix =
    plan !== null && existingJournal !== null
      ? readJournalShape(plan, existingJournal, refusals)
      : null;

  if (refusals.length > 0 || plan === null || prefix === null) {
    return refusedStep(refusals, accountId);
  }

  const readable = readRecords(plan.append, { accountId, login, server, anchorUtc }, refusals);

  const held = indexExisting(prefix, accountId);
  const batchIds = new Set();
  const batchPositions = new Set();

  for (const { id, positionId } of readable) {
    if (held.ids.has(String(id))) {
      refusals.push(S.ID_COLLISION);
      continue;
    }

    // The contract's own gate, not the planner's: a step is what a writer
    // hands storage, so this module names the same refusal Policy 3X-7D-B
    // gave the planner instead of relying on the reproduce step below to
    // catch it as a plan that was not the preview's output.
    if (held.foreignIds.has(String(id))) {
      refusals.push(S.ID_JOURNALED_ELSEWHERE);
      continue;
    }

    if (held.positions.has(positionId)) {
      refusals.push(S.POSITION_COLLISION);
      continue;
    }

    if (batchIds.has(id)) {
      refusals.push(S.DUPLICATE_ID);
      continue;
    }

    if (batchPositions.has(positionId)) {
      refusals.push(S.DUPLICATE_POSITION);
      continue;
    }

    batchIds.add(id);
    batchPositions.add(positionId);
  }

  if (refusals.length > 0) {
    return refusedStep(refusals, accountId);
  }

  // The last gate. Everything above is about shape; only re-running the real
  // planner over this preview and this journal can show that a row, a rejection
  // or a whole append was invented rather than reported. A plan whose rows were
  // re-serialized in a different key order fails here: that is a refusal, never
  // a commit.
  const reproduced = planRecoveryJournalCommit({
    verdict: request.verdict,
    existingJournal,
    accountId,
  });

  if (planFingerprint(reproduced) !== planFingerprint(plan)) {
    refusals.push(S.PLAN_NOT_PREVIEW_OUTPUT);
  }

  if (refusals.length > 0) {
    return refusedStep(refusals, accountId);
  }

  // Explicit, versioned provenance: the scope and boundary this step was
  // planned from, taken from the preview that reported them. Not a signature —
  // ordinary metadata, which is why every field in it is re-derived above and
  // re-checked against the watermark in readStep below.
  const provenance = Object.freeze({
    version: RECOVERY_COMMIT_PROVENANCE_VERSION,
    accountId: bound.accountId,
    mt5Login: bound.login,
    mt5Server: bound.server,
    anchorUtc: bound.anchorUtc,
  });

  const identity = Object.freeze({ mt5Login: login, mt5Server: server });

  // The durable value is a scope plus a boundary, and nothing else: it carries
  // no write claim, because the only thing that may say a write happened is
  // verifyRecoveryCommitEvidence reading both values back.
  const watermark = Object.freeze({
    version: RECOVERY_WATERMARK_VERSION,
    accountId,
    mt5Login: login,
    mt5Server: server,
    anchorUtc,
    storageKey: recoveryWatermarkStorageKey({
      accountId,
      mt5Login: login,
      mt5Server: server,
    }),
    coverageComplete: false,
    retentionVerified: false,
  });

  return Object.freeze({
    status: RECOVERY_COMMIT_STEP_STATUS.PREPARED,
    refusals: Object.freeze([]),
    append: Object.freeze([...plan.append]),
    rejected: Object.freeze([...plan.rejected]),
    journal: Object.freeze([...plan.journal]),
    changed: plan.changed,
    accountId,
    identity,
    anchorUtc,
    provenance,
    provenanceBytes: JSON.stringify(provenance),
    watermark,
    journalBytes: JSON.stringify(plan.journal),
    watermarkBytes: JSON.stringify(watermark),
    committed: false,
    journalWritten: false,
    watermarkAdvanced: false,
    coverageComplete: false,
    retentionVerified: false,
  });
}

// ==========================================================
// Durable evidence over that proposal
// ==========================================================

function evidenceBytes(evidence, key) {
  if (!isPlainObject(evidence)) return S[`${key}_EVIDENCE_INVALID`];
  if (typeof evidence.readBack !== "string") return S[`${key}_EVIDENCE_INVALID`];

  return null;
}

// A provenance block this module could not read at all is a step that is not
// this contract's; bytes that no longer describe the block inside them are a
// named provenance defect, because that is the one forgery a caller can do
// without touching the block.
function readProvenance(provenance, provenanceBytes, refusals) {
  if (!isPlainObject(provenance)) {
    refusals.push(S.PREPARED_STEP_INVALID);
    return null;
  }

  if (provenanceFields(provenance) !== PROVENANCE_SCHEMA) {
    refusals.push(S.PREPARED_STEP_INVALID);
    return null;
  }

  if (provenance.version !== RECOVERY_COMMIT_PROVENANCE_VERSION) {
    refusals.push(S.PREPARED_STEP_INVALID);
    return null;
  }

  const accountId = accountText(provenance.accountId);
  const login = loginText(provenance.mt5Login);
  const server = serverText(provenance.mt5Server);
  const anchorUtc = anchorText(provenance.anchorUtc);

  if (
    accountId === null ||
    login === null ||
    server === null ||
    anchorUtc === null
  ) {
    refusals.push(S.PREPARED_STEP_INVALID);
    return null;
  }

  if (
    typeof provenanceBytes !== "string" ||
    JSON.stringify(provenance) !== provenanceBytes
  ) {
    refusals.push(S.PROVENANCE_INVALID);
    return null;
  }

  return Object.freeze({ accountId, login, server, anchorUtc });
}

// A prepared step is data by the time evidence arrives, so everything it claims
// about itself is re-derived: the bytes have to describe the rows, the account
// and identity the step names have to be the ones the watermark is scoped to,
// the provenance has to still describe the scope the watermark carries, and no
// flag may already claim a write.
function readStep(step, refusals) {
  if (!isPlainObject(step)) return null;

  if (step.status !== RECOVERY_COMMIT_STEP_STATUS.PREPARED) return null;

  if (!Array.isArray(step.refusals) || step.refusals.length > 0) return null;

  if (!Array.isArray(step.journal) || !Array.isArray(step.append)) return null;

  if (!isPlainObject(step.watermark)) return null;

  if (typeof step.journalBytes !== "string") return null;
  if (typeof step.watermarkBytes !== "string") return null;

  if (step.committed !== false) return null;
  if (step.journalWritten !== false) return null;
  if (step.watermarkAdvanced !== false) return null;
  if (step.coverageComplete !== false) return null;
  if (step.retentionVerified !== false) return null;
  if (step.changed !== step.append.length > 0) return null;

  if (JSON.stringify(step.journal) !== step.journalBytes) return null;
  if (JSON.stringify(step.watermark) !== step.watermarkBytes) return null;

  const watermark = step.watermark;

  if (watermark.version !== RECOVERY_WATERMARK_VERSION) return null;
  if (watermark.coverageComplete !== false) return null;
  if (watermark.retentionVerified !== false) return null;

  // Exactly the versioned schema, or it is not this contract's watermark: a
  // value carrying an extra claim key would let a caller smuggle a write
  // assertion into the bytes a later read trusts.
  if (watermarkFields(watermark) !== WATERMARK_SCHEMA) return null;

  const accountId = accountText(watermark.accountId);
  const login = loginText(watermark.mt5Login);
  const server = serverText(watermark.mt5Server);
  const anchorUtc = anchorText(watermark.anchorUtc);

  if (accountId === null || login === null) return null;
  if (server === null || anchorUtc === null) return null;

  if (
    watermark.storageKey !==
    recoveryWatermarkStorageKey({ accountId, mt5Login: login, mt5Server: server })
  ) {
    return null;
  }

  if (accountText(step.accountId) !== accountId) return null;
  if (anchorText(step.anchorUtc) !== anchorUtc) return null;

  // The provenance and the durable value must name one scope. If they ever
  // drift, the watermark this evidence is about is not the watermark this
  // preview was planned for, and no read-back can fix that.
  const provenance = readProvenance(step.provenance, step.provenanceBytes, refusals);

  if (provenance === null) return null;

  if (
    provenance.accountId !== accountId ||
    provenance.login !== login ||
    provenance.server !== server ||
    provenance.anchorUtc !== anchorUtc
  ) {
    refusals.push(S.PREPARED_STEP_INVALID);
    return null;
  }

  return Object.freeze({
    accountId,
    identity: Object.freeze({ mt5Login: login, mt5Server: server }),
    anchorUtc,
    provenance,
    watermark,
    journalBytes: step.journalBytes,
    watermarkBytes: step.watermarkBytes,
  });
}

export function verifyRecoveryCommitEvidence(input = {}) {
  const request = isPlainObject(input) ? input : {};

  // Why the step could not be read is named when this module can name it, and
  // defaults to "not a step" when it cannot.
  const stepRefusals = [];

  const scope = readStep(
    isPlainObject(request.prepared) ? request.prepared : null,
    stepRefusals
  );

  function outcome(status, refusals, verified, proven) {
    const committed =
      status === RECOVERY_COMMIT_EVIDENCE_STATUS.COMMITTED;

    return Object.freeze({
      status,
      refusals: Object.freeze([...refusals]),
      journalVerified: verified.journal,
      watermarkVerified: verified.watermark,
      committed,
      journalWritten: committed,
      watermarkAdvanced: committed,
      coverageComplete: false,
      retentionVerified: false,
      accountId: proven ? scope.accountId : null,
      identity: proven ? scope.identity : null,
      anchorUtc: proven ? scope.anchorUtc : null,
      effectiveWatermark: committed ? scope.watermark : null,
    });
  }

  const UNVERIFIED = Object.freeze({ journal: false, watermark: false });

  if (scope === null) {
    return outcome(
      RECOVERY_COMMIT_EVIDENCE_STATUS.REFUSED,
      stepRefusals.length > 0 ? stepRefusals : [S.PREPARED_STEP_INVALID],
      UNVERIFIED,
      false
    );
  }

  const refusals = [];

  const journalProblem = evidenceBytes(request.journalEvidence, "JOURNAL");
  const watermarkProblem = evidenceBytes(request.watermarkEvidence, "WATERMARK");

  if (journalProblem !== null) refusals.push(journalProblem);
  if (watermarkProblem !== null) refusals.push(watermarkProblem);

  const journalVerified =
    journalProblem === null &&
    request.journalEvidence.readBack === scope.journalBytes;

  const watermarkVerified =
    watermarkProblem === null &&
    request.watermarkEvidence.readBack === scope.watermarkBytes;

  if (journalProblem === null && !journalVerified) {
    refusals.push(S.JOURNAL_EVIDENCE_MISMATCH);
  }

  if (watermarkProblem === null && !watermarkVerified) {
    refusals.push(S.WATERMARK_EVIDENCE_MISMATCH);
  }

  return outcome(
    refusals.length === 0
      ? RECOVERY_COMMIT_EVIDENCE_STATUS.COMMITTED
      : RECOVERY_COMMIT_EVIDENCE_STATUS.UNCOMMITTED,
    refusals,
    Object.freeze({ journal: journalVerified, watermark: watermarkVerified }),
    true
  );
}
