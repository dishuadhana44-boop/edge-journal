// ==========================================================
// JOURNAL PERSISTENCE STATUS AND RETRY PLANNING
// ==========================================================
//
// JournalContext publishes the outcome of journal storage
// (src/context/JournalContext.jsx:171-182, :241, :251, :280) and nothing
// renders it, while src/pages/TradeJournal.jsx:53 raises a "saved
// successfully" toast that is checked against nothing. Before any banner,
// statistics fallback or retry button exists, the two decisions they would
// make have to be testable on their own: what a state is allowed to SAY, and
// what a retry is allowed to PROPOSE.
//
//   - A description may only claim what the state it was given proves. Only a
//     verified read-back sets savedConfirmed. An unreadable value is reported
//     as unreadable: never as gone, never as nothing.
//   - A retry plan reads and merges. It performs no write, mutates nothing,
//     and when one id carries two different rows it refuses to pick a winner,
//     because both sides can be work nobody may throw away.
//
// Pure logic: no storage objects, no browser globals, no React, no MT5.

import {
  JOURNAL_READ_STATUS,
  JOURNAL_WRITE_STATUS,
  canPersistAfterRead,
} from "./journalStorage.js";

export const JOURNAL_PERSISTENCE_STATUS = Object.freeze({
  HEALTHY: "healthy",
  READY: "ready",
  FIRST_RUN: "first-run",
  UNREADABLE: "unreadable",
  BLOCKED: "blocked",
  WRITE_FAILED: "write-failed",
  UNVERIFIED: "write-unverified",
  UNKNOWN: "unknown",
});

export const JOURNAL_PERSISTENCE_SEVERITY = Object.freeze({
  NONE: "none",
  WARNING: "warning",
  ERROR: "error",
});

export const JOURNAL_RETRY_STATUS = Object.freeze({
  PLANNED: "planned",
  READ_UNTRUSTED: "read-untrusted",
  CONFLICT: "id-conflict",
  INVALID_INPUT: "invalid-input",
});

const SEVERITY = JOURNAL_PERSISTENCE_SEVERITY;
const STATUS = JOURNAL_PERSISTENCE_STATUS;
const RETRY = JOURNAL_RETRY_STATUS;
const READ = JOURNAL_READ_STATUS;
const WRITE = JOURNAL_WRITE_STATUS;

const UNTRUSTED_READ_STATUSES = Object.freeze([
  READ.INVALID_JSON,
  READ.NOT_ARRAY,
  READ.READ_ERROR,
]);

const FAILED_WRITE_STATUSES = Object.freeze([
  WRITE.WRITE_ERROR,
  WRITE.SERIALIZE_ERROR,
  WRITE.INVALID_ROWS,
]);

// A retry re-reads storage, so it can only change something when the current
// status came from a read or a write that did not land.
const RETRYABLE_STATUSES = Object.freeze([
  STATUS.UNREADABLE,
  STATUS.BLOCKED,
  STATUS.WRITE_FAILED,
  STATUS.UNVERIFIED,
]);

const WORDING = Object.freeze({
  [STATUS.HEALTHY]: {
    severity: SEVERITY.NONE,
    title: "Journal saved",
    detail: "The last save was written and read back from this browser's storage.",
  },
  [STATUS.READY]: {
    severity: SEVERITY.NONE,
    title: "Journal loaded",
    detail:
      "The saved journal was read safely. No save has been confirmed yet in this session.",
  },
  [STATUS.FIRST_RUN]: {
    severity: SEVERITY.NONE,
    title: "Nothing saved yet",
    detail:
      "This browser has no saved journal for this app, so the first save will create one.",
  },
  [STATUS.UNREADABLE]: {
    severity: SEVERITY.WARNING,
    title: "Saved journal could not be read",
    detail:
      "The journal saved in this browser could not be read safely, so saving stays off and this session will continue without replacing what is stored.",
  },
  [STATUS.BLOCKED]: {
    severity: SEVERITY.WARNING,
    title: "Saving is disabled",
    detail:
      "This session will not save journal changes, so anything you edit stays in this tab only.",
  },
  [STATUS.WRITE_FAILED]: {
    severity: SEVERITY.ERROR,
    title: "Journal was not saved",
    detail:
      "The last save did not complete and the journal was not saved to this browser.",
  },
  [STATUS.UNVERIFIED]: {
    severity: SEVERITY.WARNING,
    title: "Save could not be confirmed",
    detail:
      "The last save was not confirmed by reading it back, so this session does not claim it reached storage.",
  },
  [STATUS.UNKNOWN]: {
    severity: SEVERITY.NONE,
    title: "Journal status is unknown",
    detail:
      "Not enough information was supplied to tell whether the journal can be read or saved.",
  },
});

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function text(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function describeResult(status, technicalDetail, readConfirmed) {
  const wording = WORDING[status];

  return Object.freeze({
    status,
    severity: wording.severity,
    title: wording.title,
    detail: wording.detail,
    showBanner:
      status === STATUS.UNREADABLE ||
      status === STATUS.BLOCKED ||
      status === STATUS.WRITE_FAILED ||
      status === STATUS.UNVERIFIED,
    retryPossible: RETRYABLE_STATUSES.includes(status),
    // Reported from the read itself: a blocked session or a failed save still
    // had a readable journal, and hiding that would point at the wrong place.
    readConfirmed,
    savedConfirmed: status === STATUS.HEALTHY,
    technicalDetail,
  });
}

// ==========================================================
// DESCRIBE
// ==========================================================

export function describeJournalPersistence(state) {
  if (!isRecord(state)) {
    return describeResult(STATUS.UNKNOWN, null, false);
  }

  const readStatus = text(state.readStatus);
  const writeStatus = text(state.writeStatus);
  const technicalDetail = text(state.message);
  const readConfirmed = readStatus === READ.OK || readStatus === READ.ABSENT;

  // The read is the root cause: while it cannot be trusted, a write failure
  // can only be a leftover from an earlier attempt.
  if (UNTRUSTED_READ_STATUSES.includes(readStatus)) {
    return describeResult(STATUS.UNREADABLE, technicalDetail, readConfirmed);
  }

  if (state.canPersist === false) {
    return describeResult(STATUS.BLOCKED, technicalDetail, readConfirmed);
  }

  if (FAILED_WRITE_STATUSES.includes(writeStatus)) {
    return describeResult(STATUS.WRITE_FAILED, technicalDetail, readConfirmed);
  }

  if (writeStatus === WRITE.OK) {
    return describeResult(
      state.persisted === true ? STATUS.HEALTHY : STATUS.UNVERIFIED,
      technicalDetail,
      readConfirmed,
    );
  }

  if (writeStatus !== null) {
    return describeResult(STATUS.UNVERIFIED, technicalDetail, readConfirmed);
  }

  if (readStatus === READ.ABSENT) {
    return describeResult(STATUS.FIRST_RUN, technicalDetail, readConfirmed);
  }

  if (readStatus === READ.OK) {
    return describeResult(STATUS.READY, technicalDetail, readConfirmed);
  }

  return describeResult(STATUS.UNKNOWN, technicalDetail, readConfirmed);
}

// ==========================================================
// RETRY PLANNING
// ==========================================================

function rowId(row) {
  if (!isRecord(row)) {
    return null;
  }

  if (row.id === null || row.id === undefined) {
    return null;
  }

  const key = String(row.id);

  return key === "" ? null : key;
}

// Rows that cannot be serialised cannot be compared, so they get a null key
// and are never folded into another version.
function contentKey(row) {
  try {
    return JSON.stringify(row);
  } catch {
    return null;
  }
}

function distinctVersions(rows) {
  const versions = [];

  for (const row of rows) {
    const key = contentKey(row);
    const alreadyCarried = versions.some(
      (version) => version.row === row || (key !== null && version.key === key),
    );

    if (alreadyCarried === false) {
      versions.push({ key, row });
    }
  }

  return versions.map((version) => version.row);
}

function rowsById(rows) {
  const groups = new Map();

  for (const row of rows) {
    const id = rowId(row);

    if (id === null) {
      continue;
    }

    const bucket = groups.get(id);

    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(id, [row]);
    }
  }

  return groups;
}

function findConflicts(storedGroups, memoryGroups) {
  const ids = new Set([...storedGroups.keys(), ...memoryGroups.keys()]);
  const conflicts = [];

  for (const id of ids) {
    // Compared as one list so the same row held by both sides is one version.
    const versions = distinctVersions([
      ...(storedGroups.get(id) ?? []),
      ...(memoryGroups.get(id) ?? []),
    ]);

    if (versions.length > 1) {
      conflicts.push(Object.freeze({ id, versions: Object.freeze(versions) }));
    }
  }

  return conflicts;
}

function planResult(status, fields) {
  return Object.freeze({
    status,
    retryCompleted: status === RETRY.PLANNED,
    canPersistChange: "none",
    proposedCanPersist: null,
    trades: null,
    conflicts: Object.freeze([]),
    // Broker-history completeness is never proved by a successful read: a
    // journal that reads back fine still says nothing about what the broker
    // retained (src/lib/mt5RecoveryJournalAdapter.js).
    coverageComplete: false,
    retentionVerified: false,
    reason: null,
    message: null,
    ...fields,
  });
}

export function planJournalPersistenceRetry(input) {
  const readResult = isRecord(input) ? input.readResult : null;
  const currentTrades = isRecord(input) ? input.currentTrades : null;

  if (!isRecord(readResult)) {
    return planResult(RETRY.INVALID_INPUT, {
      reason: "READ_RESULT_MISSING",
      message:
        "No journal read result was supplied, so nothing could be planned.",
    });
  }

  if (!Array.isArray(currentTrades)) {
    return planResult(RETRY.INVALID_INPUT, {
      reason: "JOURNAL_NOT_AN_ARRAY",
      message:
        "The journal in this session is not an array, so nothing could be planned.",
    });
  }

  if (canPersistAfterRead(readResult) === false) {
    return planResult(RETRY.READ_UNTRUSTED, {
      trades: Object.freeze(currentTrades.slice()),
      reason: "READ_NOT_TRUSTED",
      message:
        `A retry could not read the saved journal safely (${readResult.status}), ` +
        "so this plan keeps the rows already in memory and changes nothing else.",
    });
  }

  const storedRows = readResult.rows;
  const stored = rowsById(storedRows);
  const memory = rowsById(currentTrades);

  const conflicts = findConflicts(stored, memory);

  if (conflicts.length > 0) {
    return planResult(RETRY.CONFLICT, {
      conflicts: Object.freeze(conflicts),
      reason: "SAME_ID_WITH_DIFFERENT_CONTENT",
      message:
        `${conflicts.length} journal id(s) carry more than one version, so this plan ` +
        "refuses to choose between them and proposes no replacement.",
    });
  }

  const memoryOnly = currentTrades.filter(
    (row) => rowId(row) === null || stored.has(rowId(row)) === false,
  );

  return planResult(RETRY.PLANNED, {
    canPersistChange: "enable",
    proposedCanPersist: true,
    trades: Object.freeze([...storedRows, ...memoryOnly]),
    message:
      "The saved journal was read safely and can be adopted together with the rows from this session.",
  });
}
