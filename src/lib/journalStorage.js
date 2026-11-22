// ==========================================================
// JOURNAL STORAGE
// ==========================================================
//
// The journal is one whole-array value under localStorage["trades"], and the
// provider rewrites that whole key whenever its state changes
// (src/context/JournalContext.jsx). If a failed read was reported as an empty
// journal, the next rewrite destroyed whatever was stored. So the read has to
// say WHY it produced nothing, and the answer has to be strong enough for the
// writer to refuse to persist.
//
// Two rules hold this together:
//   - ABSENT (a genuine first run) and OK (a valid array) may persist.
//     Everything else - unparseable, not-an-array, storage that threw or was
//     never supplied - must not, because its rows are unknown rather than empty.
//   - A write is successful only when the bytes it just put in storage read
//     back identically. Anything else is reported, never claimed.
//
// Storage is always injected. This module never touches browser globals, the
// journal itself, watermarks or MT5.

export const JOURNAL_STORAGE_KEY = "trades";

export const JOURNAL_READ_STATUS = Object.freeze({
  OK: "ok",
  ABSENT: "absent",
  INVALID_JSON: "invalid-json",
  NOT_ARRAY: "not-array",
  READ_ERROR: "read-error",
});

export const JOURNAL_WRITE_STATUS = Object.freeze({
  OK: "ok",
  INVALID_ROWS: "invalid-rows",
  SERIALIZE_ERROR: "serialize-error",
  WRITE_ERROR: "write-error",
  UNVERIFIED: "unverified",
});

// A read is trusted only when it either proved the stored journal is a real
// array or proved that no journal has been saved yet.
const TRUSTED_READ_STATUSES = Object.freeze([
  JOURNAL_READ_STATUS.OK,
  JOURNAL_READ_STATUS.ABSENT,
]);

function isFunction(value) {
  return typeof value === "function";
}

function failureMessage(error) {
  if (error && typeof error.message === "string" && error.message !== "") {
    return error.message;
  }

  return String(error);
}

function readResult(status, rows, reason = null, message = null) {
  return Object.freeze({
    status,
    rows,
    reason,
    message,
  });
}

function writeResult(status, persisted, count, reason = null, message = null) {
  return Object.freeze({
    status,
    persisted,
    count,
    reason,
    message,
  });
}

// ==========================================================
// READ
// ==========================================================

export function readJournalStorage(storage, key = JOURNAL_STORAGE_KEY) {
  if (!storage || !isFunction(storage.getItem)) {
    return readResult(
      JOURNAL_READ_STATUS.READ_ERROR,
      null,
      "STORAGE_UNAVAILABLE",
      "No usable journal storage was supplied.",
    );
  }

  let saved;

  try {
    saved = storage.getItem(key);
  } catch (error) {
    return readResult(
      JOURNAL_READ_STATUS.READ_ERROR,
      null,
      "READ_THREW",
      failureMessage(error),
    );
  }

  // Absent is not empty-with-permission-to-overwrite: it is a first run, and
  // the very first render is allowed to save the journal it starts with.
  if (saved === null || saved === undefined || saved === "") {
    return readResult(JOURNAL_READ_STATUS.ABSENT, []);
  }

  let parsed;

  try {
    parsed = JSON.parse(saved);
  } catch (error) {
    return readResult(
      JOURNAL_READ_STATUS.INVALID_JSON,
      null,
      "JSON_INVALID",
      failureMessage(error),
    );
  }

  if (!Array.isArray(parsed)) {
    return readResult(
      JOURNAL_READ_STATUS.NOT_ARRAY,
      null,
      "NOT_AN_ARRAY",
      "The saved journal is not an array.",
    );
  }

  // Row shapes belong to the journal's own normalization rules
  // (src/lib/journalTradeNormalization.js:557-563), not to this reader.
  return readResult(JOURNAL_READ_STATUS.OK, parsed.slice());
}

// ==========================================================
// PERSISTENCE GUARD
// ==========================================================

export function canPersistAfterRead(readResultValue) {
  if (!readResultValue || typeof readResultValue !== "object") {
    return false;
  }

  const { status, rows } = readResultValue;

  if (TRUSTED_READ_STATUSES.includes(status) === false) {
    return false;
  }

  if (!Array.isArray(rows)) {
    return false;
  }

  // An ABSENT read that somehow carries rows is not a state this module
  // produced, so it does not earn permission to write.
  if (status === JOURNAL_READ_STATUS.ABSENT && rows.length > 0) {
    return false;
  }

  return true;
}

// ==========================================================
// WRITE
// ==========================================================

export function writeJournalStorage(storage, rows, key = JOURNAL_STORAGE_KEY) {
  const count = Array.isArray(rows) ? rows.length : null;

  if (!Array.isArray(rows)) {
    return writeResult(
      JOURNAL_WRITE_STATUS.INVALID_ROWS,
      false,
      count,
      "ROWS_NOT_ARRAY",
      "The journal must be an array before it can be saved.",
    );
  }

  if (!storage || !isFunction(storage.setItem) || !isFunction(storage.getItem)) {
    return writeResult(
      JOURNAL_WRITE_STATUS.WRITE_ERROR,
      false,
      count,
      "STORAGE_UNAVAILABLE",
      "No usable journal storage was supplied.",
    );
  }

  let serialized;

  try {
    serialized = JSON.stringify(rows);
  } catch (error) {
    return writeResult(
      JOURNAL_WRITE_STATUS.SERIALIZE_ERROR,
      false,
      count,
      "SERIALIZE_THREW",
      failureMessage(error),
    );
  }

  try {
    storage.setItem(key, serialized);
  } catch (error) {
    // Quota errors and disabled storage land here. setItem is atomic and
    // whole-key, so the previously saved journal is still what a read returns.
    return writeResult(
      JOURNAL_WRITE_STATUS.WRITE_ERROR,
      false,
      count,
      "SET_ITEM_THREW",
      failureMessage(error),
    );
  }

  let written;

  try {
    written = storage.getItem(key);
  } catch (error) {
    return writeResult(
      JOURNAL_WRITE_STATUS.UNVERIFIED,
      false,
      count,
      "VERIFY_THREW",
      failureMessage(error),
    );
  }

  if (written !== serialized) {
    return writeResult(
      JOURNAL_WRITE_STATUS.UNVERIFIED,
      false,
      count,
      "VERIFY_MISMATCH",
      "The saved journal did not read back as it was written.",
    );
  }

  return writeResult(JOURNAL_WRITE_STATUS.OK, true, count);
}
