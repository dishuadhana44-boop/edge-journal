// ==========================================================
// JOURNAL PERSISTENCE STORE
// ==========================================================
//
// One snapshot of what journal storage did, and the rules for turning the next
// reported write into something a subscriber can see.
//
// The snapshot is a VALUE; a save prompt needs an EVENT. The store in
// src/context/JournalContext.jsx notifies only when a field differs (:54-60),
// so a second verified write whose fields all repeated was never reported, and
// src/pages/TradeJournal.jsx read that silence as "not confirmed" even though
// journalStorage.js had returned persisted:true (:245) after a byte-for-byte
// read-back. A receipt separates the two ideas: the code that performed the
// write stamps one, and it always moves the feedback key, so a repeated success
// stays visible as a success.
//
// What a receipt does NOT mean: it says a write outcome was reported to this
// store. It does not identify which click, edit or reload caused that write, and
// no consumer may present it as proof of per-save attribution. Exact attribution
// would need the journal state itself to carry the number of the request that
// produced it.
//
// Only src/lib/journalPersistenceStatus.js decides what a state is allowed to
// SAY, so nothing here reads or re-derives a saved claim: the receipt never
// appears in a key field that the wording module looks at, and confirmation is
// always taken from the verdict a caller passes in.

export const JOURNAL_PERSISTENCE_INITIAL = Object.freeze({
  readStatus: null,
  canPersist: true,
  writeStatus: null,
  persisted: false,
  message: null,
  writeReceipt: null,
});

function isRecord(value) {
  return (
    typeof value === "object" && value !== null && Array.isArray(value) === false
  );
}

function text(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

// A receipt is usable only when it is a whole positive number, it is larger
// than the one already published, and the patch that carries it also reports
// what a write did. The last condition is what keeps reloadTrades
// (src/context/JournalContext.jsx:241-254), which publishes read fields only,
// from manufacturing a save event out of a re-read.
export function reduceJournalPersistence(current, patch) {
  const base = isRecord(current) ? current : JOURNAL_PERSISTENCE_INITIAL;
  const incoming = isRecord(patch) ? patch : {};

  const merged = { ...base, ...incoming };

  const candidate = positiveInteger(incoming.writeReceipt);
  const reportsWrite = text(incoming.writeStatus) !== null;
  const currentReceipt = positiveInteger(base.writeReceipt) ?? 0;
  const acceptReceipt =
    candidate !== null && reportsWrite && candidate > currentReceipt;

  if (acceptReceipt) {
    merged.writeReceipt = candidate;
  } else if (Object.prototype.hasOwnProperty.call(incoming, "writeReceipt")) {
    // An unusable receipt leaves the published one exactly where it was: never
    // rewound, never reset, never taken from the rejected patch.
    merged.writeReceipt = base.writeReceipt;
  }

  const unchanged = Object.keys(merged).every((key) => merged[key] === base[key]);

  // Unchanged means unchanged: the same reference is handed back so a store
  // subscription stays quiet, and an identical patch can never be mistaken for
  // persistence progress.
  const snapshot = unchanged ? base : Object.freeze(merged);

  return Object.freeze({ snapshot, changed: !unchanged });
}

// The fields a save prompt is allowed to compare. message is excluded on
// purpose: a new diagnostic is worth re-rendering a banner for, but it is not a
// new persistence event, and reading it as one would let wording changes
// impersonate a write.
export function journalPersistenceKey(snapshotValue) {
  const value = isRecord(snapshotValue) ? snapshotValue : {};

  return [
    value.readStatus ?? null,
    value.canPersist ?? null,
    value.writeStatus ?? null,
    value.persisted ?? null,
    value.writeReceipt ?? null,
  ].join("|");
}

// One place for the rule the save prompt needs: an event AND a verdict that
// allows claiming a save. A receipt with persisted:false, a failed write or an
// unverified write never confirms, because savedConfirmed comes only from the
// verdict - never from this comparison.
export function compareJournalPersistence(published, baselineKey, view) {
  // journalPersistenceKey() can never produce an empty string, so one is not a
  // baseline: without a real captured key there is nothing to compare against
  // and nothing may be claimed.
  const hasBaseline = typeof baselineKey === "string" && baselineKey !== "";

  const keyChanged = hasBaseline && journalPersistenceKey(published) !== baselineKey;

  const savedConfirmed = isRecord(view) && view.savedConfirmed === true;

  return Object.freeze({
    keyChanged,
    savedConfirmed,
    confirmed: keyChanged && savedConfirmed,
  });
}
