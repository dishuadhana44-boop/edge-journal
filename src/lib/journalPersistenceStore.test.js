// ==========================================================
// PURE JOURNAL PERSISTENCE STORE - CONTRACT TESTS
// ==========================================================
//
// Why this module exists. src/context/JournalContext.jsx keeps one module-level
// snapshot of what journal storage did and notifies only when a value differs
// (JournalContext.jsx:54-60), while src/pages/TradeJournal.jsx:24-29 decides
// whether *this* save landed by comparing four of that snapshot's fields
// against what it saw when the click happened. Those two rules make a second
// identical successful save invisible: the write really lands
// (journalStorage.js:245 returns persisted:true after a byte-for-byte read-back)
// yet nothing is published, so the honest page reports
// "Changes are not confirmed as saved" for data that is saved.
//
// The root cause is that the store models VALUES and the page needs EVENTS.
// This file pins the pure replacement for both halves: a reducer that records a
// reported write as a receipt as well as a value, one feedback key, and one
// comparison. The wording authority stays where it is -
// src/lib/journalPersistenceStatus.js remains the only thing allowed to decide
// what a state may CLAIM, and these tests prove the store never borrows that
// job.
//
// SCOPE. Pure contract only: nothing here is wired into React, and no
// production file was changed to make these pass. A receipt says "a write was
// reported"; it does NOT identify which click caused that write, and no test
// here may be read as proving attribution.
// ==========================================================

import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  JOURNAL_PERSISTENCE_INITIAL,
  compareJournalPersistence,
  journalPersistenceKey,
  reduceJournalPersistence,
} from "./journalPersistenceStore.js";

import { describeJournalPersistence } from "./journalPersistenceStatus.js";
import {
  JOURNAL_READ_STATUS,
  JOURNAL_WRITE_STATUS,
} from "./journalStorage.js";

const modulePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "journalPersistenceStore.js",
);

// ==========================================================
// FIXTURES
// ==========================================================
//
// Snapshots are exactly the fields JournalContext publishes
// (src/context/JournalContext.jsx:37-43 and :117-123) plus the receipt, and the
// patches are exactly what its write effect publishes (:280-284). Status values
// come from the producer's own enums (src/lib/journalStorage.js:24-38), never
// from invented strings.

function snapshot({
  readStatus = JOURNAL_READ_STATUS.OK,
  canPersist = true,
  writeStatus = null,
  persisted = false,
  message = null,
  writeReceipt = null,
} = {}) {
  return Object.freeze({
    readStatus,
    canPersist,
    writeStatus,
    persisted,
    message,
    writeReceipt,
  });
}

// A verified write: the only outcome journalStorage.js marks persisted
// (:245, reached only after the read-back at :235-243 matched).
const VERIFIED_WRITE = Object.freeze({
  writeStatus: JOURNAL_WRITE_STATUS.OK,
  persisted: true,
  message: null,
});

// A write that threw (quota, disabled storage): journalStorage.js:207-219.
const FAILED_WRITE = Object.freeze({
  writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR,
  persisted: false,
  message: "QuotaExceededError",
});

// A write that setItem accepted but the read-back could not confirm
// (journalStorage.js:221-243).
const UNVERIFIED_WRITE = Object.freeze({
  writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED,
  persisted: false,
  message: "The saved journal did not read back as it was written.",
});

// What reloadTrades publishes (src/context/JournalContext.jsx:241-244,
// :251-254): read fields only, never a write outcome.
const READ_ONLY_PATCH = Object.freeze({
  readStatus: JOURNAL_READ_STATUS.OK,
  message: null,
});

function reduceFrom(initial, ...patches) {
  let current = initial;

  for (const patch of patches) {
    current = reduceJournalPersistence(current, patch).snapshot;
  }

  return current;
}

function confirmed(snapshotValue, baselineValue) {
  return compareJournalPersistence(
    snapshotValue,
    journalPersistenceKey(baselineValue),
    describeJournalPersistence(snapshotValue),
  ).confirmed;
}

// ==========================================================
// THE INITIAL SNAPSHOT
// ==========================================================

test("the initial snapshot keeps every published field and carries no receipt", () => {
  assert.deepEqual(JOURNAL_PERSISTENCE_INITIAL, {
    readStatus: null,
    canPersist: true,
    writeStatus: null,
    persisted: false,
    message: null,
    writeReceipt: null,
  });

  assert.equal(Object.isFrozen(JOURNAL_PERSISTENCE_INITIAL), true);
  assert.throws(() => {
    JOURNAL_PERSISTENCE_INITIAL.persisted = true;
  }, TypeError);
  assert.throws(() => {
    JOURNAL_PERSISTENCE_INITIAL.writeReceipt = 1;
  }, TypeError);
});

// ==========================================================
// REDUCER: VALUES AND EVENTS
// ==========================================================

test("the first verified write changes the key and can confirm", () => {
  const result = reduceJournalPersistence(
    JOURNAL_PERSISTENCE_INITIAL,
    { ...VERIFIED_WRITE, writeReceipt: 1 },
  );

  assert.equal(result.changed, true);
  assert.equal(result.snapshot.writeReceipt, 1);
  assert.equal(result.snapshot.persisted, true);
  assert.notEqual(result.snapshot, JOURNAL_PERSISTENCE_INITIAL);
  assert.notEqual(
    journalPersistenceKey(result.snapshot),
    journalPersistenceKey(JOURNAL_PERSISTENCE_INITIAL),
  );
  assert.equal(
    confirmed(result.snapshot, JOURNAL_PERSISTENCE_INITIAL),
    true,
    "a verified write after a session that only read the journal is a save",
  );
});

test("a repeated verified write with unchanged status fields and a newer receipt still changes the key", () => {
  const first = reduceJournalPersistence(
    JOURNAL_PERSISTENCE_INITIAL,
    { ...VERIFIED_WRITE, writeReceipt: 1 },
  );

  const second = reduceJournalPersistence(first.snapshot, {
    ...VERIFIED_WRITE,
    writeReceipt: 2,
  });

  // Every status field repeats, so this is the case the value-only store
  // swallowed: the write landed and must be reported as an event.
  for (const field of ["readStatus", "canPersist", "writeStatus", "persisted", "message"]) {
    assert.equal(
      second.snapshot[field],
      first.snapshot[field],
      `${field} was expected to repeat for this fixture`,
    );
  }

  assert.equal(second.changed, true, "a newer reported write is an event");
  assert.notEqual(second.snapshot, first.snapshot);
  assert.notEqual(
    journalPersistenceKey(second.snapshot),
    journalPersistenceKey(first.snapshot),
  );
  assert.equal(
    confirmed(second.snapshot, first.snapshot),
    true,
    "the second save must be able to report what the first one reported",
  );
});

test("an identical patch is not an event and keeps the snapshot reference", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 2,
  });

  const result = reduceJournalPersistence(published, {
    ...VERIFIED_WRITE,
    writeReceipt: 2,
  });

  assert.equal(result.changed, false);
  assert.equal(result.snapshot, published);
  assert.equal(journalPersistenceKey(result.snapshot), journalPersistenceKey(published));
});

test("an empty patch is not an event", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 3,
  });

  const result = reduceJournalPersistence(published, {});

  assert.equal(result.changed, false);
  assert.equal(result.snapshot, published);
});

test("a message-only patch is a store change but not a feedback event", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...FAILED_WRITE,
    writeReceipt: 4,
  });

  const result = reduceJournalPersistence(published, {
    ...FAILED_WRITE,
    writeReceipt: 4,
    message: "Storage write threw again with a different reason",
  });

  assert.equal(
    result.changed,
    true,
    "a new diagnostic has to reach the banner that prints it",
  );
  assert.equal(
    journalPersistenceKey(result.snapshot),
    journalPersistenceKey(published),
    "a diagnostic-only change must not look like a fresh persistence event",
  );
});

test("a failure receipt changes the key but never confirms a save", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  const result = reduceJournalPersistence(published, {
    ...FAILED_WRITE,
    writeReceipt: 2,
  });

  assert.equal(result.changed, true);
  assert.notEqual(journalPersistenceKey(result.snapshot), journalPersistenceKey(published));

  const view = describeJournalPersistence(result.snapshot);

  assert.equal(view.status, "write-failed");
  assert.equal(view.savedConfirmed, false);
  assert.equal(view.showBanner, true);
  assert.equal(
    confirmed(result.snapshot, published),
    false,
    "a reported failure is an event, never a confirmation",
  );
});

test("an unverified write never confirms a save", () => {
  for (const patch of [
    { ...UNVERIFIED_WRITE, writeReceipt: 5 },
    // writeStatus ok with persisted:false is what journalStorage.js can never
    // return (:245 sets both together), and the status module still refuses to
    // claim it (journalPersistenceStatus.js:187-193).
    { writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: false, message: null, writeReceipt: 5 },
  ]) {
    const result = reduceJournalPersistence(JOURNAL_PERSISTENCE_INITIAL, patch);

    assert.equal(result.changed, true);

    const view = describeJournalPersistence(result.snapshot);

    assert.equal(view.status, "write-unverified");
    assert.equal(view.savedConfirmed, false);
    assert.equal(
      compareJournalPersistence(
        result.snapshot,
        journalPersistenceKey(JOURNAL_PERSISTENCE_INITIAL),
        view,
      ).confirmed,
      false,
      `receipt ${patch.writeReceipt} over ${patch.writeStatus} may not confirm`,
    );
  }
});

test("a receipt by itself never makes savedConfirmed true", () => {
  const result = reduceJournalPersistence(JOURNAL_PERSISTENCE_INITIAL, {
    writeReceipt: 99,
  });

  assert.equal(
    result.snapshot.writeReceipt,
    null,
    "a bare receipt is not a reported write, so it must be refused",
  );

  const view = describeJournalPersistence(
    reduceJournalPersistence(
      JOURNAL_PERSISTENCE_INITIAL,
      { ...VERIFIED_WRITE, writeReceipt: 99 },
    ).snapshot,
  );

  assert.equal(view.savedConfirmed, true);
  assert.equal(view.status, "healthy");
  assert.equal(
    describeJournalPersistence(
      snapshot({ writeReceipt: 99 }),
    ).savedConfirmed,
    false,
    "without a verified write field a receipt may not earn a saved claim",
  );
});

test("invalid receipts are ignored", () => {
  const current = snapshot({ ...VERIFIED_WRITE, writeReceipt: 10 });
  const invalid = [
    0,
    -1,
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "11",
    true,
    false,
    null,
    undefined,
    {},
    [11],
    () => 11,
    10,
    9,
  ];

  for (const writeReceipt of invalid) {
    const result = reduceJournalPersistence(current, {
      ...VERIFIED_WRITE,
      writeReceipt,
    });

    assert.equal(
      result.snapshot.writeReceipt,
      10,
      `${String(writeReceipt)} must not replace an accepted receipt`,
    );
    assert.equal(
      result.changed,
      false,
      `a patch whose only new thing is the invalid receipt ${String(writeReceipt)} is not an event`,
    );
    assert.equal(result.snapshot, current);
  }
});

test("a valid newer receipt is accepted and cannot be rewound by a later stale patch", () => {
  const advanced = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 5,
  });

  assert.equal(advanced.writeReceipt, 5);

  const stale = reduceJournalPersistence(advanced, {
    ...FAILED_WRITE,
    writeReceipt: 3,
  });

  assert.equal(stale.snapshot.writeReceipt, 5, "a receipt never moves backwards");

  // The stale patch still reports what storage did: refusing the receipt must
  // not swallow the failure.
  assert.equal(stale.changed, true);
  assert.equal(stale.snapshot.writeStatus, JOURNAL_WRITE_STATUS.WRITE_ERROR);
  assert.equal(stale.snapshot.persisted, false);

  const recovered = reduceFrom(advanced, {
    ...FAILED_WRITE,
    writeReceipt: 3,
  }, {
    ...VERIFIED_WRITE,
    writeReceipt: 6,
  });

  assert.equal(recovered.writeReceipt, 6);
});

test("a read or reload patch cannot fabricate a receipt", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 7,
  });

  for (const patch of [
    { ...READ_ONLY_PATCH, writeReceipt: 8 },
    { ...READ_ONLY_PATCH, writeReceipt: 100 },
    // A write patch whose status is not a real status string is the same
    // fabrication risk in a different costume.
    { writeStatus: null, persisted: false, message: null, writeReceipt: 9 },
    { writeStatus: "", persisted: false, message: null, writeReceipt: 9 },
    { writeStatus: undefined, persisted: false, message: null, writeReceipt: 9 },
  ]) {
    const result = reduceJournalPersistence(published, patch);

    assert.equal(
      result.snapshot.writeReceipt,
      7,
      `${JSON.stringify(patch)} carried no reported write status`,
    );
  }

  // A first-run read is not a write either, and must not reset the receipt.
  const blocked = reduceJournalPersistence(published, {
    readStatus: JOURNAL_READ_STATUS.ABSENT,
    writeReceipt: 10,
  });

  assert.equal(blocked.snapshot.writeReceipt, 7);
  assert.equal(
    blocked.changed,
    true,
    "the read status did change, and that is still worth publishing",
  );
});

// ==========================================================
// THE FEEDBACK KEY
// ==========================================================

test("the feedback key includes the receipt and every field the save gate reads", () => {
  const fields = [
    ["readStatus", JOURNAL_READ_STATUS.INVALID_JSON],
    ["canPersist", false],
    ["writeStatus", JOURNAL_WRITE_STATUS.WRITE_ERROR],
    ["persisted", true],
    ["writeReceipt", 42],
  ];

  for (const [field, value] of fields) {
    const other = snapshot();
    const moved = Object.freeze({ ...snapshot(), [field]: value });

    assert.notEqual(
      journalPersistenceKey(moved),
      journalPersistenceKey(other),
      `${field} belongs in the save feedback key`,
    );
  }

  assert.equal(
    journalPersistenceKey(snapshot()),
    journalPersistenceKey(snapshot({ message: "anything" })),
    "a wording-only difference is excluded",
  );
});

test("the feedback key keeps the existing field semantics and is total", () => {
  // An absent field means the same as a null one, because the current save key
  // reads every field through ?? null (src/pages/TradeJournal.jsx:25-28).
  const sparse = Object.freeze({
    readStatus: JOURNAL_READ_STATUS.OK,
    canPersist: true,
  });
  const explicit = Object.freeze({
    readStatus: JOURNAL_READ_STATUS.OK,
    canPersist: true,
    writeStatus: null,
    persisted: null,
    writeReceipt: null,
  });

  assert.equal(
    journalPersistenceKey(sparse),
    journalPersistenceKey(explicit),
    "missing fields must not be read as a persistence event",
  );

  assert.equal(
    journalPersistenceKey({ ...explicit, writeStatus: undefined }),
    journalPersistenceKey(explicit),
  );

  for (const value of [null, undefined, "trades", 42, [], true]) {
    assert.equal(typeof journalPersistenceKey(value), "string");
  }

  assert.equal(
    journalPersistenceKey(JOURNAL_PERSISTENCE_INITIAL),
    journalPersistenceKey(JOURNAL_PERSISTENCE_INITIAL),
    "the key is deterministic",
  );
});

// ==========================================================
// THE COMPARISON
// ==========================================================

test("the comparison returns a frozen verdict with exactly the three claims", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  const result = compareJournalPersistence(
    published,
    journalPersistenceKey(JOURNAL_PERSISTENCE_INITIAL),
    describeJournalPersistence(published),
  );

  assert.deepEqual(Object.keys(result).sort(), [
    "confirmed",
    "keyChanged",
    "savedConfirmed",
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.keyChanged, true);
  assert.equal(result.savedConfirmed, true);
  assert.equal(result.confirmed, true);

  assert.throws(() => {
    result.confirmed = false;
  }, TypeError);
});

test("confirmation requires both halves, so neither alone is enough", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  const view = describeJournalPersistence(published);

  // Same key, verified write: this is the previous save's result being read as
  // this click's, which the gate must refuse.
  const sameKey = compareJournalPersistence(published, journalPersistenceKey(published), view);

  assert.equal(sameKey.keyChanged, false);
  assert.equal(sameKey.savedConfirmed, true);
  assert.equal(sameKey.confirmed, false);

  // Different key, nothing verified: an event that is not a save.
  const failed = reduceJournalPersistence(JOURNAL_PERSISTENCE_INITIAL, {
    ...FAILED_WRITE,
    writeReceipt: 2,
  });

  const otherKey = compareJournalPersistence(
    failed.snapshot,
    journalPersistenceKey(published),
    describeJournalPersistence(failed.snapshot),
  );

  assert.equal(otherKey.keyChanged, true);
  assert.equal(otherKey.savedConfirmed, false);
  assert.equal(otherKey.confirmed, false);
});

test("a missing or malformed baseline can never confirm", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  const view = describeJournalPersistence(published);

  for (const baselineKey of [null, undefined, 0, "", {}, JOURNAL_PERSISTENCE_INITIAL]) {
    const result = compareJournalPersistence(published, baselineKey, view);

    assert.equal(
      result.keyChanged,
      false,
      `no baseline means no comparison, so nothing may be claimed (${String(baselineKey)})`,
    );
    assert.equal(result.confirmed, false);
  }

  assert.equal(
    confirmed(published, JOURNAL_PERSISTENCE_INITIAL),
    true,
    "a real baseline still confirms",
  );
});

test("a missing or dishonest view never confirms", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  const baselineKey = journalPersistenceKey(JOURNAL_PERSISTENCE_INITIAL);

  for (const view of [null, undefined, "healthy", {}, { savedConfirmed: "yes" }]) {
    assert.equal(
      compareJournalPersistence(published, baselineKey, view).confirmed,
      false,
      "only a boolean true from the status module counts as a saved claim",
    );
  }
});

test("a success after a prior failure confirms, and a failure after a success does not", () => {
  const failed = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...FAILED_WRITE,
    writeReceipt: 1,
  });

  const thenSuccess = reduceJournalPersistence(failed, {
    ...VERIFIED_WRITE,
    writeReceipt: 2,
  });

  assert.equal(thenSuccess.changed, true);
  assert.equal(
    confirmed(thenSuccess.snapshot, failed),
    true,
    "the save after a failure is exactly the one a user needs believed",
  );

  const thenFailure = reduceJournalPersistence(thenSuccess.snapshot, {
    ...FAILED_WRITE,
    writeReceipt: 3,
  });

  assert.equal(
    confirmed(thenFailure.snapshot, thenSuccess.snapshot),
    false,
    "a later failure may not inherit the earlier success's claim",
  );
  assert.equal(describeJournalPersistence(thenFailure.snapshot).status, "write-failed");
});

test("the store cannot rewrite a claim the status module made", () => {
  const published = reduceFrom(JOURNAL_PERSISTENCE_INITIAL, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  const view = describeJournalPersistence(published);

  assert.equal(Object.isFrozen(view), true);

  for (const patch of [
    () => {
      view.savedConfirmed = false;
    },
    () => {
      view.status = "write-failed";
    },
    () => {
      Object.assign(view, { savedConfirmed: false, showBanner: true });
    },
  ]) {
    assert.throws(patch, TypeError);
  }

  assert.equal(view.savedConfirmed, true);
});

// ==========================================================
// WHAT THE STORE MUST NOT DISTURB
// ==========================================================

test("describeJournalPersistence is receipt-blind", () => {
  const withoutReceipt = snapshot({ ...VERIFIED_WRITE });
  const withReceipt = snapshot({ ...VERIFIED_WRITE, writeReceipt: 77 });

  assert.deepEqual(
    describeJournalPersistence(withoutReceipt),
    describeJournalPersistence(withReceipt),
    "a receipt must not change what a state is allowed to say",
  );

  for (const base of [
    { readStatus: JOURNAL_READ_STATUS.INVALID_JSON, canPersist: false, message: "boom" },
    { canPersist: false },
    { ...FAILED_WRITE },
    { ...UNVERIFIED_WRITE },
    { readStatus: JOURNAL_READ_STATUS.ABSENT },
    {},
  ]) {
    assert.deepEqual(
      describeJournalPersistence(snapshot({ ...base, writeReceipt: 3 })),
      describeJournalPersistence(snapshot(base)),
      JSON.stringify(base),
    );
  }
});

test("adopting the reducer over a snapshot with no receipt field is not an event", () => {
  // The shape JournalContext publishes today (src/context/JournalContext.jsx
  // :37-43, :117-123) has no writeReceipt key at all. Importing the reducer
  // must not turn that omission into a phantom write.
  const legacy = Object.freeze({
    readStatus: JOURNAL_READ_STATUS.OK,
    canPersist: true,
    writeStatus: null,
    persisted: false,
    message: null,
  });

  const result = reduceJournalPersistence(legacy, READ_ONLY_PATCH);

  assert.equal(result.changed, false);
  assert.equal(result.snapshot, legacy);
  assert.equal(
    journalPersistenceKey(result.snapshot),
    journalPersistenceKey(legacy),
  );
});

test("the reducer starts from the initial snapshot for input it cannot read", () => {
  for (const current of [null, undefined, "trades", 7, []]) {
    const result = reduceJournalPersistence(current, READ_ONLY_PATCH);

    assert.equal(
      result.snapshot.writeReceipt,
      JOURNAL_PERSISTENCE_INITIAL.writeReceipt,
    );
    assert.equal(result.snapshot.readStatus, JOURNAL_READ_STATUS.OK);
    assert.equal(result.snapshot.persisted, false);
  }

  const verified = reduceJournalPersistence(undefined, {
    ...VERIFIED_WRITE,
    writeReceipt: 1,
  });

  assert.equal(verified.snapshot.writeReceipt, 1);
  assert.equal(verified.changed, true);
});

test("the reducer never mutates its inputs and never adopts a caller's object", () => {
  const current = {
    readStatus: JOURNAL_READ_STATUS.OK,
    canPersist: true,
    writeStatus: null,
    persisted: false,
    message: null,
    writeReceipt: 1,
  };
  const patch = { ...VERIFIED_WRITE, writeReceipt: 2 };

  const currentBefore = JSON.parse(JSON.stringify(current));
  const patchBefore = JSON.parse(JSON.stringify(patch));

  const result = reduceJournalPersistence(current, patch);

  assert.deepEqual(current, currentBefore);
  assert.deepEqual(patch, patchBefore);
  assert.notEqual(result.snapshot, current, "a change produces a new snapshot");
  assert.equal(
    current.writeReceipt,
    1,
    "the caller's object must not be advanced by the reducer",
  );

  const unchanged = reduceJournalPersistence(result.snapshot, patch);

  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.snapshot, result.snapshot);
  assert.equal(
    Object.isFrozen(result.snapshot),
    true,
    "a published snapshot is frozen so no consumer can rewrite a claim",
  );
  assert.equal(Object.isFrozen(result), true);

  // An empty patch over an unreadable current still returns a frozen snapshot.
  assert.equal(Object.isFrozen(reduceJournalPersistence(undefined, {}).snapshot), true);
});

test("the module is pure: no storage, no time, no transport, no imports", () => {
  const source = readFileSync(modulePath, "utf8");

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document",
    "window",
    "navigator",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "setTimeout",
    "setInterval",
    "requestAnimationFrame",
    "Date",
    "Math.random",
    "performance",
    "process.",
    "globalThis",
    "require(",
    "node:",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `the store may not use ${forbidden}`,
    );
  }

  // Nothing may be imported: the module has to stay loadable on its own, which
  // is what the mutation probes below rely on.
  assert.equal(/^import\s/m.test(source), false);
});

// ==========================================================
// NON-VACUITY: EACH WRONG STORE MUST BREAK A CONTRACT
// ==========================================================
//
// These probes apply a plausible wrong implementation to the source this module
// reads from disk, in memory, and require it to break at least one invariant.
// The unmutated source is always checked first, so a broken probe cannot report
// a mutant as "caught".

const INVARIANTS = [
  [
    "a repeated verified write with a newer receipt is an event",
    (store) => {
      const first = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...VERIFIED_WRITE, writeReceipt: 1 },
      );
      const second = store.reduceJournalPersistence(first.snapshot, {
        ...VERIFIED_WRITE,
        writeReceipt: 2,
      });

      assert.equal(second.changed, true);
      assert.notEqual(second.snapshot, first.snapshot);
      assert.notEqual(
        store.journalPersistenceKey(second.snapshot),
        store.journalPersistenceKey(first.snapshot),
      );
    },
  ],
  [
    "an identical patch is not an event and keeps the snapshot reference",
    (store) => {
      const published = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...VERIFIED_WRITE, writeReceipt: 2 },
      );
      const again = store.reduceJournalPersistence(published.snapshot, {
        ...VERIFIED_WRITE,
        writeReceipt: 2,
      });

      assert.equal(again.changed, false);
      assert.equal(again.snapshot, published.snapshot);
    },
  ],
  [
    "the feedback key ignores message and reads the receipt",
    (store) => {
      const base = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...FAILED_WRITE, writeReceipt: 4 },
      ).snapshot;
      const reworded = store.reduceJournalPersistence(base, {
        ...FAILED_WRITE,
        writeReceipt: 4,
        message: "another reason",
      }).snapshot;

      assert.equal(store.journalPersistenceKey(reworded), store.journalPersistenceKey(base));

      const advanced = store.reduceJournalPersistence(base, {
        ...FAILED_WRITE,
        writeReceipt: 5,
      }).snapshot;

      assert.notEqual(store.journalPersistenceKey(advanced), store.journalPersistenceKey(base));
    },
  ],
  [
    "a key change without a verified write does not confirm",
    (store) => {
      const published = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...FAILED_WRITE, writeReceipt: 1 },
      );

      assert.equal(
        store.compareJournalPersistence(
          published.snapshot,
          store.journalPersistenceKey(store.JOURNAL_PERSISTENCE_INITIAL),
          describeJournalPersistence(published.snapshot),
        ).confirmed,
        false,
      );
    },
  ],
  [
    "an unchanged key cannot confirm even when the state is healthy",
    (store) => {
      const published = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...VERIFIED_WRITE, writeReceipt: 1 },
      ).snapshot;

      assert.equal(
        store.compareJournalPersistence(
          published,
          store.journalPersistenceKey(published),
          describeJournalPersistence(published),
        ).confirmed,
        false,
      );
    },
  ],
  [
    "a receipt only arrives with a reported write status",
    (store) => {
      const published = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...VERIFIED_WRITE, writeReceipt: 7 },
      ).snapshot;

      assert.equal(
        store.reduceJournalPersistence(published, {
          ...READ_ONLY_PATCH,
          writeReceipt: 8,
        }).snapshot.writeReceipt,
        7,
      );
    },
  ],
  [
    "an invalid receipt is ignored",
    (store) => {
      const published = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...VERIFIED_WRITE, writeReceipt: 10 },
      ).snapshot;

      for (const writeReceipt of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, "11", null, undefined, 10, 9]) {
        const result = store.reduceJournalPersistence(published, {
          ...VERIFIED_WRITE,
          writeReceipt,
        });

        assert.equal(result.snapshot.writeReceipt, 10, String(writeReceipt));
        assert.equal(result.changed, false, String(writeReceipt));
      }
    },
  ],
  [
    "a stale receipt cannot rewind the published one",
    (store) => {
      const advanced = store.reduceJournalPersistence(
        store.reduceJournalPersistence(store.JOURNAL_PERSISTENCE_INITIAL, {
          ...VERIFIED_WRITE,
          writeReceipt: 5,
        }).snapshot,
        { ...VERIFIED_WRITE, writeReceipt: 9 },
      ).snapshot;

      assert.equal(
        store.reduceJournalPersistence(advanced, {
          ...VERIFIED_WRITE,
          writeReceipt: 6,
        }).snapshot.writeReceipt,
        9,
      );
    },
  ],
  [
    "a baseline that was never produced by the key function cannot confirm",
    (store) => {
      const published = store.reduceJournalPersistence(
        store.JOURNAL_PERSISTENCE_INITIAL,
        { ...VERIFIED_WRITE, writeReceipt: 1 },
      ).snapshot;

      const view = describeJournalPersistence(published);

      for (const baselineKey of ["", null, undefined, 0, {}]) {
        assert.equal(
          store.compareJournalPersistence(published, baselineKey, view).confirmed,
          false,
          String(baselineKey),
        );
      }

      assert.equal(
        store.compareJournalPersistence(
          published,
          store.journalPersistenceKey(store.JOURNAL_PERSISTENCE_INITIAL),
          view,
        ).confirmed,
        true,
      );
    },
  ],
];

async function loadStore(label) {
  if (label === null) {
    return {
      JOURNAL_PERSISTENCE_INITIAL,
      reduceJournalPersistence,
      journalPersistenceKey,
      compareJournalPersistence,
    };
  }

  const source = readFileSync(modulePath, "utf8");
  const mutated = source.replace(label.from, label.to);

  assert.notEqual(
    mutated,
    source,
    `mutation anchor is no longer in the source: ${label.from}`,
  );

  return import(
    `data:text/javascript;base64,${Buffer.from(mutated, "utf8").toString("base64")}`
  );
}

const MUTANTS = [
  {
    name: "the receipt never reaches the snapshot (R1 as shipped)",
    from: "if (acceptReceipt) {",
    to: "if (false) {",
  },
  {
    // Rejected as an equivalent mutant, kept here so it is not re-tried:
    // `merged.writeReceipt = incoming.writeReceipt;` behaves identically,
    // because inside the accept branch candidate IS incoming.writeReceipt.
    // A probe that cannot differ from the original proves nothing, so this one
    // drops the validation call instead, which is the defect worth catching.
    name: "receipts skip shape validation",
    from: "const candidate = positiveInteger(incoming.writeReceipt);",
    to: "const candidate = incoming.writeReceipt;",
  },
  {
    name: "a receipt needs no reported write",
    from: "const reportsWrite = text(incoming.writeStatus) !== null;",
    to: "const reportsWrite = true;",
  },
  {
    name: "a receipt may move backwards",
    from: "candidate > currentReceipt",
    to: "true",
  },
  {
    name: "fractional receipts pass the shape test",
    from: "Number.isInteger(value) && value > 0",
    to: "typeof value === \"number\" && value > 0",
  },
  {
    name: "the feedback key reads message instead of the receipt",
    from: "    value.writeReceipt ?? null,",
    to: "    value.message ?? null,",
  },
  {
    name: "an event alone confirms a save",
    from: "confirmed: keyChanged && savedConfirmed",
    to: "confirmed: keyChanged",
  },
  {
    name: "a saved state alone confirms this save",
    from: "confirmed: keyChanged && savedConfirmed",
    to: "confirmed: savedConfirmed",
  },
  {
    name: "every patch notifies",
    from: "changed: !unchanged",
    to: "changed: true",
  },
  {
    name: "an unchanged patch still replaces the snapshot object",
    from: "unchanged ? base :",
    to: "unchanged ? Object.freeze({ ...base }) :",
  },
  {
    name: "an empty baseline is read as a captured key",
    from: 'typeof baselineKey === "string" && baselineKey !== ""',
    to: 'typeof baselineKey === "string"',
  },
];

test("baseline: the shipped store satisfies every invariant", async () => {
  const store = await loadStore(null);

  for (const [name, check] of INVARIANTS) {
    try {
      check(store);
    } catch (error) {
      assert.fail(`the unmutated store must satisfy "${name}" (${error.message})`);
    }
  }
});

test("mutation self-check: every wrong store breaks a contract", async () => {
  const failures = [];

  for (const mutant of MUTANTS) {
    let store;

    try {
      store = await loadStore(mutant);
    } catch (error) {
      failures.push(`${mutant.name}: did not load (${error.message})`);
      continue;
    }

    const broken = INVARIANTS.filter(([, check]) => {
      try {
        check(store);
        return false;
      } catch {
        return true;
      }
    });

    if (broken.length === 0) {
      failures.push(`${mutant.name}: survived every invariant`);
    }
  }

  assert.deepEqual(failures, []);
});
