import { test } from "node:test";
import assert from "node:assert/strict";

import {
  JOURNAL_READ_STATUS,
  JOURNAL_STORAGE_KEY,
  JOURNAL_WRITE_STATUS,
  canPersistAfterRead,
  readJournalStorage,
  writeJournalStorage,
} from "./journalStorage.js";

// ==========================================================
// Journal storage: what a saved journal may and may not do to itself
//
// JournalContext reads localStorage["trades"] once on mount
// (src/context/JournalContext.jsx:26-52) and then rewrites the WHOLE key from
// an effect that has no first-run guard (:149-161). As long as a failed read
// was turned into [] inside the same try/catch, one unreadable value therefore
// became a persisted empty journal: the stored data was destroyed by the next
// render, and nothing could see it happen because the only signal was
// console.error (:155-160, :45).
//
// These tests fix the contract that replaces that behaviour: the read result
// must say WHY it produced nothing, persistence is only allowed after a read
// that can be trusted, and a write must report its own outcome instead of
// being assumed.
//
// Every storage here is an injected in-memory object. Nothing touches browser
// localStorage, files, the network or MT5.
// ==========================================================

const OPENED_AT_MSC = 1_763_000_000_000;
const CLOSED_AT_MSC = 1_763_003_600_000;

function memoryStorage(initialEntries = {}) {
  const values = new Map(Object.entries(initialEntries));

  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function journalRow(overrides = {}) {
  return {
    id: "mt5-700001",
    accountId: "1767000000000",
    symbol: "EURUSD.pro",
    direction: "Buy",
    pnl: 12.5,
    entryTime: OPENED_AT_MSC,
    exitTime: CLOSED_AT_MSC,
    notes: "manual journal entry",
    ...overrides,
  };
}

// Exactly the recovery-specific fields a future writer would rely on
// surviving a round trip (the record adaptRecord returns in
// src/lib/mt5RecoveryJournalAdapter.js).
function recoveredRow(overrides = {}) {
  return {
    id: "mt5-position-123456-9001",
    accountId: "1767000000000",
    broker: "MT5",
    source: "history-recovery",
    status: "CLOSED",
    positionId: "9001",
    brokerPositionId: "9001",
    symbol: "EURUSD.pro",
    volume: "0.1",
    openedAt: OPENED_AT_MSC,
    closedAt: CLOSED_AT_MSC,
    pnl: "0.18",
    netProfit: "0.18",
    pnlBasis: "reconstructed-broker-reported-total",
    recoveryComponents: {
      profit: "1",
      commission: "-0.7",
      swap: "-0.12",
      fee: "0",
    },
    dealTickets: ["700001", "700002"],
    dataGaps: ["CURRENCY", "STOP_LOSS", "TAKE_PROFIT"],
    liveSnapshotToUtc: "2025-11-13T00:00:00.000Z",
    coverageComplete: false,
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    rr: null,
    ...overrides,
  };
}

const storedRows = (rows) =>
  JSON.stringify(Array.isArray(rows) ? rows : []);

// ==========================================================
// readJournalStorage - honest read results
// ==========================================================

test("reads a valid journal array and keeps its order", () => {
  const rows = [journalRow({ id: "a" }), journalRow({ id: "b" }), journalRow({ id: "c" })];
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: JSON.stringify(rows) });

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.OK);
  assert.equal(result.reason, null);
  assert.ok(Array.isArray(result.rows));
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["a", "b", "c"],
  );
  assert.equal(canPersistAfterRead(result), true);
});

test("returns an absent key as absent, not as an empty journal", () => {
  const storage = memoryStorage({});

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.ABSENT);
  assert.deepEqual(result.rows, []);
  assert.equal(canPersistAfterRead(result), true);
});

test("treats a stored empty string as absent so a first run still behaves normally", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: "" });

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.ABSENT);
  assert.deepEqual(result.rows, []);
  assert.equal(canPersistAfterRead(result), true);
});

test("reads a stored empty array as a valid empty journal", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: "[]" });

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.OK);
  assert.deepEqual(result.rows, []);
  assert.equal(canPersistAfterRead(result), true);
});

test("leaves every stored row shape to the journal instead of filtering here", () => {
  const junk = ["text", 7, true, null, {}, []];
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: JSON.stringify(junk) });

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.OK);
  assert.equal(result.rows.length, junk.length);
  assert.equal(result.rows[0], "text");
  assert.equal(result.rows[1], 7);
  assert.equal(result.rows[3], null);
});

test("preserves recovery fields and unknowns through a read round trip", () => {
  const row = recoveredRow();
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: JSON.stringify([row]) });

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.OK);
  assert.deepEqual(result.rows, [row]);
  assert.equal(result.rows[0].source, "history-recovery");
  assert.equal(result.rows[0].broker, "MT5");
  assert.equal(result.rows[0].pnl, "0.18");
  assert.equal(result.rows[0].brokerPositionId, "9001");
  assert.equal(result.rows[0].pnlBasis, "reconstructed-broker-reported-total");
  assert.deepEqual(result.rows[0].recoveryComponents, row.recoveryComponents);
  assert.deepEqual(result.rows[0].dataGaps, row.dataGaps);
  assert.equal(result.rows[0].coverageComplete, false);
  assert.equal(result.rows[0].entryPrice, null);
  assert.equal(result.rows[0].stopLoss, null);
  assert.equal(result.rows[0].rr, null);
});

test("reports malformed json as invalid-json with no rows", () => {
  for (const saved of ["{oops", "[", '["unclosed', "  { \"id\": 1, }  ", "\0"]) {
    const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: saved });

    const result = readJournalStorage(storage);

    assert.equal(result.status, JOURNAL_READ_STATUS.INVALID_JSON, `for ${JSON.stringify(saved)}`);
    assert.equal(result.rows, null);
    assert.equal(result.reason, "JSON_INVALID");
    assert.equal(typeof result.message, "string");
    assert.equal(canPersistAfterRead(result), false);
  }
});

test("reports whitespace-only storage as invalid json instead of absent", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: "   " });

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.INVALID_JSON);
  assert.equal(canPersistAfterRead(result), false);
});

test("reports valid json that is not an array as not-array", () => {
  for (const saved of ["{}", '{"id":"a"}', "null", "0", "false", '"a string"', '""']) {
    const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: saved });

    const result = readJournalStorage(storage);

    assert.equal(result.status, JOURNAL_READ_STATUS.NOT_ARRAY, `for ${saved}`);
    assert.equal(result.rows, null);
    assert.equal(result.reason, "NOT_AN_ARRAY");
    assert.equal(canPersistAfterRead(result), false);
  }
});

test("reports a throwing getItem as read-error", () => {
  const storage = {
    getItem() {
      throw new Error("SecurityError: storage disabled");
    },
    setItem() {
      throw new Error("must not be reached");
    },
  };

  const result = readJournalStorage(storage);

  assert.equal(result.status, JOURNAL_READ_STATUS.READ_ERROR);
  assert.equal(result.rows, null);
  assert.equal(result.reason, "READ_THREW");
  assert.equal(canPersistAfterRead(result), false);
});

test("never throws for a value it cannot understand", () => {
  for (const saved of ["", " ", "[]", "{}", "null", "undefined", "{oops", '"', "[1,2"]) {
    const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: saved });

    assert.doesNotThrow(() => readJournalStorage(storage), `for ${JSON.stringify(saved)}`);
  }
});

test("reports a storage object it cannot use as read-error", () => {
  for (const storage of [undefined, null, "[]", 0, {}, { getItem: "no" }]) {
    const result = readJournalStorage(storage);

    assert.equal(result.status, JOURNAL_READ_STATUS.READ_ERROR, `for ${JSON.stringify(storage)}`);
    assert.equal(result.reason, "STORAGE_UNAVAILABLE");
    assert.equal(result.rows, null);
    assert.equal(canPersistAfterRead(result), false);
  }
});

test("reads the journal key by default and honours an explicit key", () => {
  const storage = memoryStorage({
    [JOURNAL_STORAGE_KEY]: JSON.stringify([journalRow({ id: "default" })]),
    other_journal: JSON.stringify([journalRow({ id: "explicit" })]),
  });

  assert.equal(readJournalStorage(storage).rows[0].id, "default");
  assert.equal(readJournalStorage(storage, "other_journal").rows[0].id, "explicit");
});

test("returns a frozen read result so callers cannot fake a safe status", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: "{oops" });

  const result = readJournalStorage(storage);

  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => {
    result.status = JOURNAL_READ_STATUS.OK;
  }, TypeError);
});

// ==========================================================
// canPersistAfterRead - the first-run guard
// ==========================================================

test("permits persistence only after a trusted read", () => {
  const trusted = [
    readJournalStorage(memoryStorage({})),
    readJournalStorage(memoryStorage({ [JOURNAL_STORAGE_KEY]: "[]" })),
    readJournalStorage(memoryStorage({ [JOURNAL_STORAGE_KEY]: JSON.stringify([journalRow()]) })),
  ];

  for (const result of trusted) {
    assert.equal(canPersistAfterRead(result), true, result.status);
  }
});

test("blocks persistence after every untrusted read", () => {
  const untrusted = [
    readJournalStorage(memoryStorage({ [JOURNAL_STORAGE_KEY]: "{oops" })),
    readJournalStorage(memoryStorage({ [JOURNAL_STORAGE_KEY]: "   " })),
    readJournalStorage(memoryStorage({ [JOURNAL_STORAGE_KEY]: "{}" })),
    readJournalStorage(memoryStorage({ [JOURNAL_STORAGE_KEY]: "null" })),
    readJournalStorage({
      getItem() {
        throw new Error("blocked");
      },
    }),
    readJournalStorage(undefined),
  ];

  for (const result of untrusted) {
    assert.equal(canPersistAfterRead(result), false, result.status);
  }
});

test("the guard refuses a malformed journal even though rows would be empty", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: "{oops" });

  const result = readJournalStorage(storage);

  assert.equal(result.rows, null);
  assert.equal(canPersistAfterRead(result), false);
});

test("treats a missing or invented read result as unsafe", () => {
  for (const fake of [
    undefined,
    null,
    {},
    "[]",
    0,
    { status: JOURNAL_READ_STATUS.OK },
    { status: JOURNAL_READ_STATUS.ABSENT, rows: [journalRow()] },
    { status: JOURNAL_READ_STATUS.ABSENT, rows: null },
    { status: "ok " },
    { status: "ABSENT" },
    { status: JOURNAL_READ_STATUS.READ_ERROR, rows: [] },
  ]) {
    assert.equal(canPersistAfterRead(fake), false, `for ${String(fake)}`);
  }
});

test("a malformed stored journal is never rewritten as an empty journal", () => {
  const malformed = '{"trades": [oops';
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: malformed });

  // This mirrors the mount decision the context effect has to make.
  const read = readJournalStorage(storage);
  const mountRows = read.rows === null ? [] : read.rows;

  if (canPersistAfterRead(read)) {
    writeJournalStorage(storage, mountRows);
  }

  assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), malformed);
  assert.equal(malformed.includes("[oops"), true);
});

test("an unreadable journal keeps its bytes through every later state change", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: "not json at all" });

  const read = readJournalStorage(storage);

  for (const rows of [[], [journalRow()], [journalRow(), journalRow()]]) {
    if (canPersistAfterRead(read)) {
      writeJournalStorage(storage, rows);
    }
  }

  assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), "not json at all");
});

test("a genuinely absent journal still allows the normal first write", () => {
  const storage = memoryStorage({});

  const read = readJournalStorage(storage);

  assert.equal(canPersistAfterRead(read), true);

  const write = writeJournalStorage(storage, [journalRow({ id: "first" })]);

  assert.equal(write.persisted, true);
  assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), JSON.stringify([journalRow({ id: "first" })]));
});

// ==========================================================
// writeJournalStorage - explicit write results
// ==========================================================

test("writes a journal array and reports the bytes as persisted", () => {
  const storage = memoryStorage({});
  const rows = [journalRow({ id: "a" }), recoveredRow()];

  const write = writeJournalStorage(storage, rows);

  assert.equal(write.status, JOURNAL_WRITE_STATUS.OK);
  assert.equal(write.persisted, true);
  assert.equal(write.reason, null);
  assert.equal(write.count, 2);
  assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), JSON.stringify(rows));
});

test("writes an intentionally empty journal", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: storedRows([journalRow()]) });

  const write = writeJournalStorage(storage, []);

  assert.equal(write.status, JOURNAL_WRITE_STATUS.OK);
  assert.equal(write.persisted, true);
  assert.equal(write.count, 0);
  assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), "[]");
});

test("refuses to write something that is not an array and touches nothing", () => {
  const previous = storedRows([journalRow({ id: "keep" })]);

  for (const rows of [undefined, null, "[]", 0, {}, { id: "a" }, new Set()]) {
    const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: previous });

    const write = writeJournalStorage(storage, rows);

    assert.equal(write.status, JOURNAL_WRITE_STATUS.INVALID_ROWS, `for ${String(rows)}`);
    assert.equal(write.persisted, false);
    assert.equal(write.reason, "ROWS_NOT_ARRAY");
    assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), previous);
  }
});

test("reports a quota error as a failed write instead of claiming success", () => {
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: storedRows([journalRow({ id: "old" })]) });

  storage.setItem = () => {
    const error = new Error("quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  };

  const write = writeJournalStorage(storage, [journalRow({ id: "new" })]);

  assert.equal(write.status, JOURNAL_WRITE_STATUS.WRITE_ERROR);
  assert.equal(write.persisted, false);
  assert.equal(write.reason, "SET_ITEM_THREW");
  assert.equal(typeof write.message, "string");
});

test("a failed write leaves the previous journal readable", () => {
  const rows = [journalRow({ id: "old" })];
  const storage = memoryStorage({ [JOURNAL_STORAGE_KEY]: storedRows(rows) });

  storage.setItem = () => {
    throw new Error("quota exceeded");
  };

  writeJournalStorage(storage, [...rows, recoveredRow()]);

  const reread = readJournalStorage(storage);

  assert.equal(reread.status, JOURNAL_READ_STATUS.OK);
  assert.deepEqual(reread.rows, rows);
});

test("unserializable rows are reported as a serialize failure", () => {
  const circular = journalRow({ id: "loop" });
  circular.self = circular;

  const cases = [
    [circular],
    [{ id: "bigint", value: 1n }],
    [{
      id: "tojson-throws",
      toJSON() {
        throw new Error("row cannot be serialised");
      },
    }],
  ];

  for (const rows of cases) {
    const storage = memoryStorage({});

    const write = writeJournalStorage(storage, rows);

    assert.equal(write.status, JOURNAL_WRITE_STATUS.SERIALIZE_ERROR, `for ${rows[0].id}`);
    assert.equal(write.persisted, false);
    assert.equal(write.reason, "SERIALIZE_THREW");
    assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), null);
  }
});

test("a function value alone is not a serialize failure because json drops it", () => {
  const storage = memoryStorage({});

  const write = writeJournalStorage(storage, [journalRow({ notes: () => "dropped" })]);

  assert.equal(write.status, JOURNAL_WRITE_STATUS.OK);
  assert.equal(storage.getItem(JOURNAL_STORAGE_KEY), JSON.stringify([journalRow({ notes: undefined })]));
});

test("reports an unverified write when the stored bytes differ", () => {
  const storage = memoryStorage({});

  storage.getItem = (key) => (key === JOURNAL_STORAGE_KEY ? "[]" : null);

  const write = writeJournalStorage(storage, [journalRow({ id: "a" })]);

  assert.equal(write.status, JOURNAL_WRITE_STATUS.UNVERIFIED);
  assert.equal(write.persisted, false);
  assert.equal(write.reason, "VERIFY_MISMATCH");
});

test("reports an unverified write when verification cannot read", () => {
  const storage = memoryStorage({});

  storage.setItem = (key, value) => {
    storage.values.set(key, value);
  };
  storage.getItem = () => {
    throw new Error("read blocked after write");
  };

  const write = writeJournalStorage(storage, [journalRow({ id: "a" })]);

  assert.equal(write.status, JOURNAL_WRITE_STATUS.UNVERIFIED);
  assert.equal(write.persisted, false);
  assert.equal(write.reason, "VERIFY_THREW");
});

test("reports a missing storage object as a failed write", () => {
  for (const storage of [undefined, null, "[]", 0, {}, { setItem: "no" }]) {
    const write = writeJournalStorage(storage, [journalRow()]);

    assert.equal(write.status, JOURNAL_WRITE_STATUS.WRITE_ERROR, `for ${JSON.stringify(storage)}`);
    assert.equal(write.persisted, false);
    assert.equal(write.reason, "STORAGE_UNAVAILABLE");
  }
});

test("write results are frozen and never report success without verification", () => {
  const storage = memoryStorage({});

  const write = writeJournalStorage(storage, [journalRow()]);

  assert.equal(Object.isFrozen(write), true);
  assert.equal(write.persisted, write.status === JOURNAL_WRITE_STATUS.OK);
  assert.throws(() => {
    write.status = "forced";
  }, TypeError);
});

test("a round trip through write then read preserves rows, order and keys", () => {
  const storage = memoryStorage({});
  const rows = [journalRow({ id: "live" }), recoveredRow(), journalRow({ id: "edited", notes: "x" })];

  assert.equal(writeJournalStorage(storage, rows).persisted, true);

  const read = readJournalStorage(storage);

  assert.equal(read.status, JOURNAL_READ_STATUS.OK);
  assert.deepEqual(read.rows, rows);
  assert.deepEqual(Object.keys(read.rows[1]).sort(), Object.keys(recoveredRow()).sort());
});

test("recovery fields survive the write-read loop unchanged", () => {
  const storage = memoryStorage({});
  const row = recoveredRow();

  assert.equal(writeJournalStorage(storage, [row]).persisted, true);

  const [persisted] = readJournalStorage(storage).rows;

  assert.equal(persisted.source, "history-recovery");
  assert.equal(persisted.broker, "MT5");
  assert.equal(persisted.brokerPositionId, "9001");
  assert.equal(persisted.pnl, "0.18");
  assert.equal(persisted.coverageComplete, false);
  assert.deepEqual(persisted.dataGaps, row.dataGaps);
  assert.deepEqual(persisted.recoveryComponents, row.recoveryComponents);
  assert.equal(persisted.stopLoss, null);
});

test("storage events from other keys can be told apart from the journal", () => {
  const storage = memoryStorage({
    [JOURNAL_STORAGE_KEY]: storedRows([journalRow({ id: "a" })]),
    selectedAccountId: "1767000000000",
  });

  assert.equal(writeJournalStorage(storage, [journalRow({ id: "a" }), journalRow({ id: "b" })]).persisted, true);
  assert.equal(storage.getItem("selectedAccountId"), "1767000000000");
  assert.equal(readJournalStorage(storage, "selectedAccountId").status, JOURNAL_READ_STATUS.NOT_ARRAY);
});

test("the helper only uses the storage it is given", () => {
  const sentinel = {
    getItem() {
      throw new Error("browser localStorage must not be read");
    },
    setItem() {
      throw new Error("browser localStorage must not be written");
    },
  };

  const hadLocalStorage = "localStorage" in globalThis;
  const previous = globalThis.localStorage;

  globalThis.localStorage = sentinel;

  try {
    const rows = [journalRow({ id: "injected" })];
    const storage = memoryStorage({});

    assert.equal(readJournalStorage(storage).status, JOURNAL_READ_STATUS.ABSENT);
    assert.equal(writeJournalStorage(storage, rows).persisted, true);
    assert.deepEqual(readJournalStorage(storage).rows, rows);
  } finally {
    if (hadLocalStorage) {
      globalThis.localStorage = previous;
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("the journal key stays the value the rest of the app already uses", () => {
  assert.equal(JOURNAL_STORAGE_KEY, "trades");
});

test("status vocabularies are frozen and mutually distinct where they must be", () => {
  assert.equal(Object.isFrozen(JOURNAL_READ_STATUS), true);
  assert.equal(Object.isFrozen(JOURNAL_WRITE_STATUS), true);

  assert.deepEqual(
    Object.values(JOURNAL_READ_STATUS).sort(),
    ["absent", "invalid-json", "not-array", "ok", "read-error"],
  );
  assert.deepEqual(
    Object.values(JOURNAL_WRITE_STATUS).sort(),
    ["invalid-rows", "serialize-error", "unverified", "write-error", "ok"].sort(),
  );

  assert.notEqual(JOURNAL_READ_STATUS.OK, JOURNAL_READ_STATUS.ABSENT);
  assert.notEqual(JOURNAL_WRITE_STATUS.UNVERIFIED, JOURNAL_WRITE_STATUS.OK);
});
