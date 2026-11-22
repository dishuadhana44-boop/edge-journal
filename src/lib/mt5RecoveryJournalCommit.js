// ============================================================
// Stage D — preview -> append-only commit plan
//
// The pipeline upstream of this module can already prove things: the scan
// reports which history pages the bridge answered (mt5HistoryRecoveryScan.js),
// the reconstruction proves which deals formed one closed position
// (mt5HistoryReconstruction.js), and the adapter publishes journal-ready
// proposals after binding them to that evidence (mt5RecoveryJournalAdapter.js).
// What none of them can decide is the question a write raises: *may these
// rows go into this account's journal without touching the rows that are
// already there?*
//
// That question has two answers in the app today, and neither is safe for a
// recovery record. JournalContext.addTrade dedupes on String(id) only
// (src/context/JournalContext.jsx:398-402) and then overwrites the existing
// row with the incoming fields (:437-443), so a proposal that ever shares an
// id with a trade the user edited destroys the edit. It also attaches
// `selectedAccountId` when a caller omits an account (:368-370), which would
// file a recovered trade under whichever account happens to be highlighted.
// Worse, the two id namespaces never meet: a live MT5 position is
// "mt5-<ticket>" (src/context/TradeContext.jsx:968-972, written on close at
// :5695-5727) while a recovered one is "mt5-position-<login>-<positionId>"
// (adaptRecord's id), so an id comparison cannot see that the
// same position is already journalled. This module is the smallest contract
// that closes all three gaps, and it is a plan, not a writer.
//
// What it refuses:
//   - a verdict that is not a clean preview. Only status "preview" with no
//     refusals can reach a journal; a blocked verdict stays blocked (gates
//     inherited from planMT5RecoveryPreview's verdict and the adapter's
//     RECOVERY_ADAPTER_STATUS.BLOCKED).
//   - anything that claims a write already happened, or claims coverage.
//     journalWritten / watermarkAdvanced / coverageComplete /
//     retentionVerified must each be exactly false, on the verdict and on
//     every record (set false by adaptRecord). A plan that carries a true is not this
//     pipeline's output, and refusing it keeps "a preview is not proof that
//     the broker returned its whole history" true in code, not just in
//     comments.
//   - a record the adapter could not have published: wrong provenance pair,
//     a non-text id, a non-digit broker position id.
//   - a batch that names anyone but the account the caller names. The caller
//     supplies accountId and there is no fallback to a selected account;
//     a record from another account refuses the whole commit rather than
//     being quietly dropped, because a mixed batch means the wrong verdict
//     or the wrong account was handed over.
//   - a journal snapshot it was not given. existingJournal is an argument and
//     must be an array of rows: assuming an empty journal would turn a stale
//     or missing read into duplicated trades.
//
// Dedupe mirrors indexJournal (mt5RecoveryJournalAdapter.js) exactly:
// account-scoped, ids compared as text, positions compared as digit text, and
// another broker's position numbers must not silence this one. Hits are
// per-record dispositions in `rejected`; every other proposal is still
// planned, and in-batch duplicates are refused so one call can never append
// the same position twice.
//
// Append-only is the point. Existing rows are returned by reference, in their
// original order, never re-normalised, merged or replaced, and new rows are
// added after them. That is what lets a later writer persist this plan with a
// single setItem and still be able to say the user's own words survived.
//
// Input:
//   verdict          the frozen preview verdict (records, flags, accountId)
//   existingJournal  the journal rows at commit time, as an array — the WHOLE
//                    array, not this account's rows filtered out of it: ids are
//                    one namespace, so an account-filtered subset would hide
//                    exactly the collisions Policy 3X-7D-B refuses
//   accountId        the account to commit to; canonicalised, never defaulted
//
// Output (frozen):
//   { status: "planned" | "refused", refusals, append, rejected, journal,
//     changed, accountId, coverageComplete: false, retentionVerified: false,
//     journalWritten: false, watermarkAdvanced: false }
//
//   "planned" with an empty `append` is not a success claim: `changed` says
//   whether anything is new, and the four flags stay false either way.
//   "refused" carries the reason codes and journal: null so a caller cannot
//   hand half a plan to a writer.
//
// Pure by construction: no React, storage, network, timer, clock or journal
// call, and nothing here writes. Whether anything is committed is a separate,
// separately approved call site.
// ============================================================

const DIGITS_ONLY = /^[0-9]+$/;

const RECOVERED_SOURCE = "history-recovery";
const RECOVERED_BROKER = "MT5";

// The orchestrator's own RECOVERY_ORCHESTRATOR_STATUS literal, copied
// rather than imported: this module must not inherit a preview stage's
// dependencies just to name its status.
const PREVIEW_STATUS = "preview";

export const RECOVERY_COMMIT_STATUS = Object.freeze({
  PLANNED: "planned",
  REFUSED: "refused",
});

export const RECOVERY_COMMIT_REASONS = Object.freeze({
  VERDICT_INVALID: "RECOVERY_COMMIT_VERDICT_INVALID",
  VERDICT_NOT_PREVIEW: "RECOVERY_COMMIT_VERDICT_NOT_PREVIEW",
  VERDICT_REFUSALS_PRESENT: "RECOVERY_COMMIT_VERDICT_REFUSALS_PRESENT",
  VERDICT_CLAIMS_WRITE: "RECOVERY_COMMIT_VERDICT_CLAIMS_WRITE",
  VERDICT_CLAIMS_COVERAGE: "RECOVERY_COMMIT_VERDICT_CLAIMS_COVERAGE",
  VERDICT_ACCOUNT_MISMATCH: "RECOVERY_COMMIT_VERDICT_ACCOUNT_MISMATCH",
  RECORDS_INVALID: "RECOVERY_COMMIT_RECORDS_INVALID",

  RECORD_INVALID: "RECOVERY_COMMIT_RECORD_INVALID",
  RECORD_PROVENANCE_INVALID: "RECOVERY_COMMIT_RECORD_PROVENANCE_INVALID",
  RECORD_ID_INVALID: "RECOVERY_COMMIT_RECORD_ID_INVALID",
  RECORD_POSITION_INVALID: "RECOVERY_COMMIT_RECORD_POSITION_INVALID",
  RECORD_CLAIMS_COVERAGE: "RECOVERY_COMMIT_RECORD_CLAIMS_COVERAGE",
  BATCH_ATTRIBUTION_MISMATCH: "RECOVERY_COMMIT_BATCH_ATTRIBUTION_MISMATCH",

  ACCOUNT_ID_MISSING: "RECOVERY_COMMIT_ACCOUNT_ID_MISSING",
  JOURNAL_INVALID: "RECOVERY_COMMIT_JOURNAL_INVALID",

  ID_ALREADY_JOURNALED: "RECOVERY_COMMIT_ID_ALREADY_JOURNALED",
  ID_JOURNALED_ELSEWHERE: "RECOVERY_COMMIT_ID_JOURNALED_ELSEWHERE",
  POSITION_ALREADY_JOURNALED: "RECOVERY_COMMIT_POSITION_ALREADY_JOURNALED",
  DUPLICATE_ID_IN_BATCH: "RECOVERY_COMMIT_DUPLICATE_ID_IN_BATCH",
  DUPLICATE_POSITION_IN_BATCH: "RECOVERY_COMMIT_DUPLICATE_POSITION_IN_BATCH",
});

const C = RECOVERY_COMMIT_REASONS;

const UNPROVEN_FLAGS = Object.freeze({
  coverageComplete: false,
  retentionVerified: false,
  journalWritten: false,
  watermarkAdvanced: false,
});

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

// Mirrors the adapter's own accountText so the account this module
// names is the account the adapter named.
function accountText(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "string" && value.trim() !== "") return value.trim();

  return null;
}

// Mirrors the adapter's own digitText so a position written as a
// number by one producer and as text by another still matches.
function digitText(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? String(value) : null;
  }

  if (typeof value === "string" && DIGITS_ONLY.test(value)) return value;

  return null;
}

function entry(reason, details) {
  return Object.freeze({ reason, ...details });
}

function refused(refusals, accountId) {
  return Object.freeze({
    status: RECOVERY_COMMIT_STATUS.REFUSED,
    refusals: Object.freeze([...refusals]),
    append: Object.freeze([]),
    rejected: Object.freeze([]),
    journal: null,
    changed: false,
    accountId,
    ...UNPROVEN_FLAGS,
  });
}

// ==========================================================
// The verdict in hand
// ==========================================================

function readVerdict(verdict, refusals) {
  if (!isPlainObject(verdict)) {
    refusals.push(C.VERDICT_INVALID);
    return null;
  }

  if (verdict.status !== PREVIEW_STATUS) {
    refusals.push(C.VERDICT_NOT_PREVIEW);
  }

  if (!Array.isArray(verdict.refusals)) {
    refusals.push(C.VERDICT_INVALID);
  } else if (verdict.refusals.length > 0) {
    refusals.push(C.VERDICT_REFUSALS_PRESENT);
  }

  // A plan may only be built over a verdict that says nothing was written
  // yet; anything else is either a different pipeline's output or a caller
  // that has already committed and is about to do it twice.
  if (
    verdict.journalWritten !== false ||
    verdict.watermarkAdvanced !== false
  ) {
    refusals.push(C.VERDICT_CLAIMS_WRITE);
  }

  if (
    verdict.coverageComplete !== false ||
    verdict.retentionVerified !== false
  ) {
    refusals.push(C.VERDICT_CLAIMS_COVERAGE);
  }

  if (!Array.isArray(verdict.records)) {
    refusals.push(C.RECORDS_INVALID);
    return null;
  }

  return verdict;
}

// ==========================================================
// The proposals, and what the journal already holds
// ==========================================================

function readRecords(records, accountId, refusals) {
  const readable = [];

  for (const record of records) {
    if (!isPlainObject(record)) {
      refusals.push(C.RECORD_INVALID);
      continue;
    }

    if (
      record.source !== RECOVERED_SOURCE ||
      record.broker !== RECOVERED_BROKER
    ) {
      refusals.push(C.RECORD_PROVENANCE_INVALID);
      continue;
    }

    const id =
      typeof record.id === "string" && record.id.trim() !== ""
        ? record.id
        : null;

    if (id === null) {
      refusals.push(C.RECORD_ID_INVALID);
      continue;
    }

    const positionId = digitText(record.brokerPositionId);

    if (positionId === null) {
      refusals.push(C.RECORD_POSITION_INVALID);
      continue;
    }

    if (record.coverageComplete !== false) {
      refusals.push(C.RECORD_CLAIMS_COVERAGE);
      continue;
    }

    // Never attributed to the account named above, so the batch spans two
    // accounts or names none. Dropping the row would hide that.
    if (accountId === null || accountText(record.accountId) !== accountId) {
      refusals.push(C.BATCH_ATTRIBUTION_MISMATCH);
      continue;
    }

    readable.push({ record, id, positionId });
  }

  return readable;
}

function readJournal(existingJournal, refusals) {
  if (!Array.isArray(existingJournal)) {
    refusals.push(C.JOURNAL_INVALID);
    return null;
  }

  for (const row of existingJournal) {
    if (!isPlainObject(row)) {
      refusals.push(C.JOURNAL_INVALID);
      return null;
    }
  }

  return existingJournal;
}

function indexJournal(rows, accountId) {
  const ids = new Set();
  const foreignIds = new Set();
  const positions = new Set();

  for (const row of rows) {
    if (row.id !== undefined && row.id !== null) {
      if (accountText(row.accountId) === accountId) {
        ids.add(String(row.id));
      } else {
        // Policy 3X-7D-B, mirroring the adapter's index: ids are one
        // namespace across the whole array because the writer matches on
        // String(id) alone, wherever the row is filed.
        foreignIds.add(String(row.id));
      }
    }

    if (accountText(row.accountId) !== accountId) continue;

    const positionId = digitText(row.brokerPositionId);

    if (positionId === null) continue;

    if (row.broker !== undefined && row.broker !== null && row.broker !== "MT5") {
      continue;
    }

    positions.add(positionId);
  }

  return { ids, foreignIds, positions };
}

// ==========================================================
// Public entry point
// ==========================================================

export function planRecoveryJournalCommit(input = {}) {
  const request = isPlainObject(input) ? input : {};

  const refusals = [];

  const accountId = accountText(request.accountId);

  if (accountId === null) refusals.push(C.ACCOUNT_ID_MISSING);

  const journal = readJournal(request.existingJournal, refusals);
  const verdict = readVerdict(request.verdict, refusals);

  if (verdict !== null && accountId !== null) {
    if (accountText(verdict.accountId) !== accountId) {
      refusals.push(C.VERDICT_ACCOUNT_MISMATCH);
    }
  }

  const records =
    verdict === null ? [] : readRecords(verdict.records, accountId, refusals);

  if (
    refusals.length > 0 ||
    journal === null ||
    verdict === null ||
    accountId === null
  ) {
    return refused(refusals, accountId);
  }

  const held = indexJournal(journal, accountId);

  const append = [];
  const rejected = [];
  const batchIds = new Set();
  const batchPositions = new Set();

  for (const { record, id, positionId } of records) {
    const details = { id, positionId, accountId };

    if (held.ids.has(id)) {
      rejected.push(entry(C.ID_ALREADY_JOURNALED, details));
      continue;
    }

    // Policy 3X-7D-B. The id is taken by a row filed under another account, so
    // appending this record would put two rows in one array with the same key —
    // and the writer that consumes this plan dedupes and merges on String(id)
    // alone, which is how the other account's user edits get destroyed. The row
    // is refused as already held; nothing here overwrites, merges or renames it.
    if (held.foreignIds.has(id)) {
      rejected.push(entry(C.ID_JOURNALED_ELSEWHERE, details));
      continue;
    }

    // The live namespace can hold this position under a different id, which
    // is the only way a recovered trade and a live close describe one
    // position. An id check alone would append the same trade twice.
    if (held.positions.has(positionId)) {
      rejected.push(entry(C.POSITION_ALREADY_JOURNALED, details));
      continue;
    }

    if (batchIds.has(id)) {
      rejected.push(entry(C.DUPLICATE_ID_IN_BATCH, details));
      continue;
    }

    if (batchPositions.has(positionId)) {
      rejected.push(entry(C.DUPLICATE_POSITION_IN_BATCH, details));
      continue;
    }

    batchIds.add(id);
    batchPositions.add(positionId);
    append.push(record);
  }

  // Existing rows first, untouched and by reference; new rows after them.
  return Object.freeze({
    status: RECOVERY_COMMIT_STATUS.PLANNED,
    refusals: Object.freeze([]),
    append: Object.freeze(append),
    rejected: Object.freeze(rejected),
    journal: Object.freeze(journal.concat(append)),
    changed: append.length > 0,
    accountId,
    ...UNPROVEN_FLAGS,
  });
}
