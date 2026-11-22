import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  JOURNAL_READ_STATUS,
  JOURNAL_WRITE_STATUS,
  readJournalStorage,
} from "./journalStorage.js";

import {
  JOURNAL_PERSISTENCE_STATUS,
  JOURNAL_RETRY_STATUS,
  describeJournalPersistence,
  planJournalPersistenceRetry,
} from "./journalPersistenceStatus.js";

// ==========================================================
// Journal persistence: what the app is allowed to SAY and to PROPOSE
//
// src/lib/journalStorage.js made the read and the write honest, and
// src/context/JournalContext.jsx publishes that outcome
// (JournalContext.jsx:171-182, :241, :251, :280). Nothing consumes it: a repo
// grep for journalPersistence finds no UI, while src/pages/TradeJournal.jsx:53
// raises a "Journal saved successfully." toast that is not checked against
// anything. So the wording and the retry merge have to be pinned here, as pure
// logic, before any banner, statistics fallback or retry button is wired
// (no React test harness exists in this repo: package.json has no jsdom or
// @testing-library, and Node cannot import .jsx).
//
// Two guarantees hold this file together:
//   - A description may only claim what the state it was given proves. Only a
//     verified save may say the journal was saved; an unreadable value is
//     "could not be read", never "empty" and never "lost".
//   - A retry plan proposes. It never writes, never mutates, and when one id
//     carries two different rows it refuses to pick a winner.
//
// No browser globals, no storage objects, no React, no network, no MT5.
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
    ...overrides,
  };
}

// The recovery fields a future writer relies on surviving untouched
// (src/lib/mt5RecoveryJournalAdapter.js).
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
    pnl: "0.18",
    pnlBasis: "deal-sum",
    recoveryComponents: ["deal-1", "deal-2"],
    dealTickets: ["1", "2"],
    dataGaps: [],
    coverageComplete: false,
    retentionVerified: false,
    ...overrides,
  };
}

function okRead(rows) {
  return readJournalStorage(memoryStorage({ trades: JSON.stringify(rows) }));
}

function unreadableRead(savedValue) {
  return readJournalStorage(memoryStorage({ trades: savedValue }));
}

function state(overrides = {}) {
  return {
    readStatus: JOURNAL_READ_STATUS.OK,
    canPersist: true,
    writeStatus: null,
    persisted: false,
    message: null,
    ...overrides,
  };
}

// Wording this phase is not allowed to produce, in any status.
const FORBIDDEN_WORDING = [
  "lost",
  "empty",
  "deleted",
  "corrupt",
  "no trades",
  "0 trades",
  "reset",
  "restored",
  "saved successfully",
];

function words(result) {
  return `${result.title} ${result.detail}`.toLowerCase();
}

// ==========================================================
// DESCRIBE: HEALTHY / READY / FIRST_RUN
// ==========================================================

test("a save that was written and read back is reported as healthy", () => {
  const result = describeJournalPersistence(
    state({
      writeStatus: JOURNAL_WRITE_STATUS.OK,
      persisted: true,
    }),
  );

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.HEALTHY);
  assert.equal(result.severity, "none");
  assert.equal(result.showBanner, false);
  assert.equal(result.readConfirmed, true);
  assert.equal(result.savedConfirmed, true);
});

test("a journal read safely but never saved does not claim a save", () => {
  const result = describeJournalPersistence(state());

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.READY);
  assert.equal(result.severity, "none");
  assert.equal(result.showBanner, false);
  assert.equal(result.readConfirmed, true);
  assert.equal(result.savedConfirmed, false);
});

test("an absent first-run journal stays quiet and claims nothing", () => {
  const result = describeJournalPersistence(
    state({ readStatus: JOURNAL_READ_STATUS.ABSENT }),
  );

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.FIRST_RUN);
  assert.equal(result.severity, "none");
  assert.equal(result.showBanner, false);
  assert.equal(result.readConfirmed, true);
  assert.equal(result.savedConfirmed, false);
});

// ==========================================================
// DESCRIBE: UNREADABLE / BLOCKED
// ==========================================================

test("every untrusted read status is reported as unreadable with a banner", () => {
  for (const readStatus of [
    JOURNAL_READ_STATUS.INVALID_JSON,
    JOURNAL_READ_STATUS.NOT_ARRAY,
    JOURNAL_READ_STATUS.READ_ERROR,
  ]) {
    const result = describeJournalPersistence(
      state({ readStatus, canPersist: false, message: "why it failed" }),
    );

    assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNREADABLE);
    assert.equal(result.severity, "warning");
    assert.equal(result.showBanner, true);
    assert.equal(result.retryPossible, true);
    assert.equal(result.readConfirmed, false);
    assert.equal(result.savedConfirmed, false);
    assert.equal(result.technicalDetail, "why it failed");
  }
});

test("an unreadable journal says the text was left alone, not that it is gone", () => {
  const result = describeJournalPersistence(
    state({ readStatus: JOURNAL_READ_STATUS.INVALID_JSON, canPersist: false }),
  );

  assert.match(result.detail, /could not be read/i);
  assert.match(result.detail, /without replacing what is stored/i);
  assert.doesNotMatch(words(result), /no journal|nothing was saved/);
});

test("a blocked session with a readable journal is reported as blocked", () => {
  const result = describeJournalPersistence(state({ canPersist: false }));

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.BLOCKED);
  assert.equal(result.severity, "warning");
  assert.equal(result.showBanner, true);
  assert.equal(result.retryPossible, true);
  assert.equal(result.readConfirmed, true);
  assert.equal(result.savedConfirmed, false);
  assert.match(result.detail, /will not save/i);
});

test("an unreadable read outranks a stale write failure", () => {
  const result = describeJournalPersistence(
    state({
      readStatus: JOURNAL_READ_STATUS.NOT_ARRAY,
      canPersist: false,
      writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR,
      persisted: false,
    }),
  );

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNREADABLE);
});

// ==========================================================
// DESCRIBE: WRITE FAILED / UNVERIFIED / UNKNOWN
// ==========================================================

test("a write that failed is reported as an error that did not save", () => {
  for (const writeStatus of [
    JOURNAL_WRITE_STATUS.WRITE_ERROR,
    JOURNAL_WRITE_STATUS.SERIALIZE_ERROR,
    JOURNAL_WRITE_STATUS.INVALID_ROWS,
  ]) {
    const result = describeJournalPersistence(state({ writeStatus }));

    assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.WRITE_FAILED);
    assert.equal(result.severity, "error");
    assert.equal(result.showBanner, true);
    assert.equal(result.retryPossible, true);
    assert.equal(result.savedConfirmed, false);
    assert.match(result.detail, /not saved/i);
  }
});

test("an unverified write is reported as unconfirmed, never as saved", () => {
  const result = describeJournalPersistence(
    state({
      writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED,
      message: "The saved journal did not read back as it was written.",
    }),
  );

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNVERIFIED);
  assert.equal(result.severity, "warning");
  assert.equal(result.showBanner, true);
  assert.equal(result.savedConfirmed, false);
  assert.match(result.detail, /not confirmed/i);
  assert.equal(
    result.technicalDetail,
    "The saved journal did not read back as it was written.",
  );
});

test("a write result claiming ok without proof of persistence is unverified", () => {
  const result = describeJournalPersistence(
    state({ writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: false }),
  );

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNVERIFIED);
  assert.equal(result.savedConfirmed, false);
});

test("an unrecognised write status is treated as unverified rather than healthy", () => {
  const result = describeJournalPersistence(
    state({ writeStatus: "perfectly-fine" }),
  );

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNVERIFIED);
  assert.equal(result.savedConfirmed, false);
});

test("missing or unusable status information is unknown and never healthy", () => {
  for (const input of [
    null,
    undefined,
    {},
    "healthy",
    42,
    state({ readStatus: null }),
    state({ readStatus: "who-knows" }),
  ]) {
    const result = describeJournalPersistence(input);

    assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNKNOWN);
    assert.equal(result.savedConfirmed, false);
    assert.equal(result.readConfirmed, false);
    assert.equal(result.showBanner, false);
    assert.equal(result.retryPossible, false);
  }
});

// ==========================================================
// DESCRIBE: shape and wording guarantees
// ==========================================================

test("only a confirmed save may claim the journal was saved", () => {
  const states = [
    state(),
    state({ readStatus: JOURNAL_READ_STATUS.ABSENT }),
    state({ readStatus: JOURNAL_READ_STATUS.INVALID_JSON, canPersist: false }),
    state({ readStatus: JOURNAL_READ_STATUS.NOT_ARRAY, canPersist: false }),
    state({ readStatus: JOURNAL_READ_STATUS.READ_ERROR, canPersist: false }),
    state({ canPersist: false }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.SERIALIZE_ERROR }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: false }),
    null,
  ];

  for (const input of states) {
    assert.equal(
      describeJournalPersistence(input).savedConfirmed,
      false,
      `savedConfirmed leaked for ${JSON.stringify(input)}`,
    );
  }

  assert.equal(
    describeJournalPersistence(
      state({ writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: true }),
    ).savedConfirmed,
    true,
  );
});

test("no description ever uses the forbidden wording", () => {
  const inputs = [
    state(),
    state({ readStatus: JOURNAL_READ_STATUS.ABSENT }),
    state({
      readStatus: JOURNAL_READ_STATUS.ABSENT,
      writeStatus: JOURNAL_WRITE_STATUS.OK,
      persisted: true,
    }),
    state({ readStatus: JOURNAL_READ_STATUS.INVALID_JSON, canPersist: false }),
    state({ readStatus: JOURNAL_READ_STATUS.NOT_ARRAY, canPersist: false }),
    state({ readStatus: JOURNAL_READ_STATUS.READ_ERROR, canPersist: false }),
    state({ canPersist: false }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.SERIALIZE_ERROR }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.INVALID_ROWS }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: false }),
    state({ writeStatus: "perfectly-fine" }),
    state({ readStatus: "who-knows" }),
    null,
    {},
  ];

  for (const input of inputs) {
    const result = describeJournalPersistence(input);

    for (const forbidden of FORBIDDEN_WORDING) {
      assert.ok(
        words(result).includes(forbidden) === false,
        `"${forbidden}" appeared in ${result.status}: ${words(result)}`,
      );
    }
  }
});

test("retry is offered only where a fresh read could change something", () => {
  const retryable = [
    state({ readStatus: JOURNAL_READ_STATUS.INVALID_JSON, canPersist: false }),
    state({ canPersist: false }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED }),
  ];

  const notRetryable = [
    state(),
    state({ readStatus: JOURNAL_READ_STATUS.ABSENT }),
    state({ writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: true }),
    null,
  ];

  for (const input of retryable) {
    assert.equal(describeJournalPersistence(input).retryPossible, true);
  }

  for (const input of notRetryable) {
    assert.equal(describeJournalPersistence(input).retryPossible, false);
  }
});

test("descriptions are frozen so a consumer cannot rewrite the status", () => {
  const result = describeJournalPersistence(
    state({ readStatus: JOURNAL_READ_STATUS.INVALID_JSON, canPersist: false }),
  );

  assert.throws(() => {
    result.status = JOURNAL_PERSISTENCE_STATUS.HEALTHY;
  }, TypeError);

  assert.equal(result.status, JOURNAL_PERSISTENCE_STATUS.UNREADABLE);
});

test("a description carries the supplied message only as technical detail", () => {
  const withMessage = describeJournalPersistence(
    state({ writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR, message: "Quota exceeded" }),
  );
  const withoutMessage = describeJournalPersistence(state());

  assert.equal(withMessage.technicalDetail, "Quota exceeded");
  assert.equal(withoutMessage.technicalDetail, null);
});

// ==========================================================
// RETRY: trusted reads
// ==========================================================

test("a trusted read proposes re-enabling persistence and keeps both journals", () => {
  const stored = [journalRow({ id: "mt5-1" }), journalRow({ id: "mt5-2" })];
  const current = [journalRow({ id: "mt5-3", symbol: "USDJPY.pro" })];

  const plan = planJournalPersistenceRetry({
    readResult: okRead(stored),
    currentTrades: current,
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.PLANNED);
  assert.equal(plan.retryCompleted, true);
  assert.equal(plan.canPersistChange, "enable");
  assert.equal(plan.proposedCanPersist, true);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(
    plan.trades.map((row) => row.id),
    ["mt5-1", "mt5-2", "mt5-3"],
  );
});

test("stored rows come first and memory-only rows keep their own order", () => {
  const stored = [
    journalRow({ id: "mt5-b" }),
    journalRow({ id: "mt5-a" }),
    journalRow({ id: "mt5-c" }),
  ];
  const current = [
    journalRow({ id: "mt5-z", symbol: "AUDUSD.pro" }),
    journalRow({ id: "mt5-a", pnl: 12.5 }),
    journalRow({ id: "mt5-y", symbol: "GBPUSD.pro" }),
  ];

  const plan = planJournalPersistenceRetry({
    readResult: okRead(stored),
    currentTrades: current,
  });

  assert.deepEqual(
    plan.trades.map((row) => row.id),
    ["mt5-b", "mt5-a", "mt5-c", "mt5-z", "mt5-y"],
  );
});

test("a memory row identical to a stored row is carried once, not duplicated", () => {
  const stored = [journalRow({ id: "mt5-1" })];

  const plan = planJournalPersistenceRetry({
    readResult: okRead(stored),
    currentTrades: [journalRow({ id: "mt5-1" })],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.PLANNED);
  assert.equal(plan.trades.length, 1);
});

test("an absent journal keeps every in-memory row and still proposes persistence", () => {
  const current = [journalRow({ id: "mt5-1" }), journalRow({ id: "mt5-2" })];

  const plan = planJournalPersistenceRetry({
    readResult: readJournalStorage(memoryStorage()),
    currentTrades: current,
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.PLANNED);
  assert.equal(plan.proposedCanPersist, true);
  assert.deepEqual(plan.trades, current);
});

test("recovery metadata is carried forward unchanged and by identity", () => {
  const recovered = recoveredRow();
  const readResult = okRead([recovered]);
  const current = [journalRow({ id: "mt5-700001" })];

  const plan = planJournalPersistenceRetry({
    readResult,
    currentTrades: current,
  });

  // The plan hands the read's own rows back: no cloning, no re-normalising.
  assert.equal(plan.trades[0], readResult.rows[0]);
  assert.deepEqual(plan.trades[0], recovered);
  assert.equal(plan.trades[1], current[0]);
  assert.equal(plan.trades[0].source, "history-recovery");
  assert.equal(plan.trades[0].brokerPositionId, "9001");
  assert.deepEqual(plan.trades[0].recoveryComponents, ["deal-1", "deal-2"]);
});

test("rows without a comparable id are carried forward instead of dropped", () => {
  const anonymous = { symbol: "EURUSD.pro", pnl: 3 };
  const current = [anonymous, null, journalRow({ id: "mt5-9" })];

  const plan = planJournalPersistenceRetry({
    readResult: okRead([journalRow({ id: "mt5-8" })]),
    currentTrades: current,
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.PLANNED);
  assert.deepEqual(
    plan.trades.map((row) => row?.id ?? null),
    ["mt5-8", null, null, "mt5-9"],
  );
});

// ==========================================================
// RETRY: untrusted reads
// ==========================================================

test("an untrusted read keeps the current journal and leaves eligibility untouched", () => {
  for (const saved of ['{"oops"', "[", '["unclosed"', '{"a":1}']) {
    const readResult = unreadableRead(saved);

    assert.ok(
      [
        JOURNAL_READ_STATUS.INVALID_JSON,
        JOURNAL_READ_STATUS.NOT_ARRAY,
      ].includes(readResult.status),
      `fixture ${saved} produced ${readResult.status}`,
    );

    const current = [journalRow({ id: "mt5-1", pnl: 7 })];
    const plan = planJournalPersistenceRetry({
      readResult,
      currentTrades: current,
    });

    assert.equal(plan.status, JOURNAL_RETRY_STATUS.READ_UNTRUSTED);
    assert.equal(plan.retryCompleted, false);
    assert.equal(plan.canPersistChange, "none");
    assert.equal(plan.proposedCanPersist, null);
    assert.deepEqual(plan.trades, current);
    assert.deepEqual(plan.conflicts, []);
  }
});

test("a storage read that threw is treated as untrusted, not as an empty journal", () => {
  const plan = planJournalPersistenceRetry({
    readResult: readJournalStorage({
      getItem() {
        throw new Error("blocked");
      },
    }),
    currentTrades: [journalRow({ id: "mt5-1" })],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.READ_UNTRUSTED);
  assert.equal(plan.proposedCanPersist, null);
  assert.equal(plan.trades.length, 1);
});

test("a read result carrying rows it should not have stays untrusted", () => {
  const plan = planJournalPersistenceRetry({
    readResult: { status: JOURNAL_READ_STATUS.OK, rows: null },
    currentTrades: [journalRow({ id: "mt5-1" })],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.READ_UNTRUSTED);
  assert.equal(plan.retryCompleted, false);
  assert.equal(plan.proposedCanPersist, null);
});

// ==========================================================
// RETRY: same-id conflicts
// ==========================================================

test("a same-id difference is refused with both versions preserved", () => {
  const stored = journalRow({ id: "mt5-1", pnl: 5 });
  const memory = journalRow({ id: "mt5-1", pnl: 9.5 });

  const plan = planJournalPersistenceRetry({
    readResult: okRead([stored]),
    currentTrades: [memory],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.CONFLICT);
  assert.equal(plan.trades, null);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].id, "mt5-1");
  assert.deepEqual(plan.conflicts[0].versions[0], stored);
  assert.deepEqual(plan.conflicts[0].versions[1], memory);
});

test("a conflict is not labelled a completed retry or a persistence change", () => {
  const plan = planJournalPersistenceRetry({
    readResult: okRead([journalRow({ id: "mt5-1", pnl: 5 })]),
    currentTrades: [journalRow({ id: "mt5-1", pnl: 9.5 })],
  });

  assert.equal(plan.retryCompleted, false);
  assert.equal(plan.canPersistChange, "none");
  assert.equal(plan.proposedCanPersist, null);
  assert.equal(
    JSON.stringify(plan).toLowerCase().includes("saved successfully"),
    false,
  );
});

test("a conflict is detected when the only difference is a timestamp", () => {
  const plan = planJournalPersistenceRetry({
    readResult: okRead([journalRow({ id: "mt5-1", updatedAt: "a" })]),
    currentTrades: [journalRow({ id: "mt5-1", updatedAt: "b" })],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.CONFLICT);
  assert.equal(plan.conflicts[0].id, "mt5-1");
});

test("a same-id pair written in a different key order is refused", () => {
  const plan = planJournalPersistenceRetry({
    readResult: okRead([{ id: "mt5-1", pnl: 5, symbol: "EURUSD.pro" }]),
    currentTrades: [{ id: "mt5-1", symbol: "EURUSD.pro", pnl: 5 }],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.CONFLICT);
});

test("a repeated id inside the stored journal is refused, not collapsed", () => {
  const plan = planJournalPersistenceRetry({
    readResult: okRead([
      journalRow({ id: "mt5-1", pnl: 5 }),
      journalRow({ id: "mt5-1", pnl: 6 }),
    ]),
    currentTrades: [],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.CONFLICT);
  assert.equal(plan.trades, null);
  assert.deepEqual(
    plan.conflicts[0].versions.map((row) => row.pnl),
    [5, 6],
  );
});

test("only the conflicting ids are refused when other ids are clean", () => {
  const plan = planJournalPersistenceRetry({
    readResult: okRead([
      journalRow({ id: "mt5-1", pnl: 5 }),
      journalRow({ id: "mt5-2", pnl: 1 }),
    ]),
    currentTrades: [
      journalRow({ id: "mt5-1", pnl: 9 }),
      journalRow({ id: "mt5-3", pnl: 2 }),
    ],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.CONFLICT);
  assert.deepEqual(
    plan.conflicts.map((conflict) => conflict.id),
    ["mt5-1"],
  );
});

test("rows that cannot be compared are refused instead of guessed", () => {
  const circular = journalRow({ id: "mt5-1", pnl: 9 });
  circular.self = circular;

  const plan = planJournalPersistenceRetry({
    readResult: okRead([journalRow({ id: "mt5-1", pnl: 5 })]),
    currentTrades: [circular],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.CONFLICT);
  assert.equal(plan.trades, null);
});

// ==========================================================
// RETRY: guarantees
// ==========================================================

test("the plan never mutates the read result or the current journal", () => {
  const readResult = okRead([journalRow({ id: "mt5-1" })]);
  const current = [journalRow({ id: "mt5-2", pnl: 3 })];

  const readSnapshot = structuredClone(readResult);
  const currentSnapshot = structuredClone(current);

  const plan = planJournalPersistenceRetry({ readResult, currentTrades: current });

  assert.deepEqual(readResult, readSnapshot);
  assert.deepEqual(current, currentSnapshot);
  assert.equal(plan.trades.length, 2);
  assert.equal(plan.trades[0], readResult.rows[0]);
  assert.equal(plan.trades[1], current[0]);
});

test("an unusable input is reported instead of being planned around", () => {
  const noRead = planJournalPersistenceRetry({
    currentTrades: [journalRow()],
  });
  const badTrades = planJournalPersistenceRetry({
    readResult: okRead([]),
    currentTrades: "mt5-1",
  });

  assert.equal(noRead.status, JOURNAL_RETRY_STATUS.INVALID_INPUT);
  assert.equal(noRead.retryCompleted, false);
  assert.equal(noRead.trades, null);
  assert.equal(noRead.proposedCanPersist, null);

  assert.equal(badTrades.status, JOURNAL_RETRY_STATUS.INVALID_INPUT);
  assert.equal(badTrades.retryCompleted, false);
  assert.equal(badTrades.trades, null);
  assert.equal(badTrades.proposedCanPersist, null);
});

test("coverage and retention stay unproven even when a stored row claims them", () => {
  const plan = planJournalPersistenceRetry({
    readResult: okRead([
      recoveredRow({ coverageComplete: true, retentionVerified: true }),
    ]),
    currentTrades: [],
  });

  assert.equal(plan.status, JOURNAL_RETRY_STATUS.PLANNED);
  assert.equal(plan.coverageComplete, false);
  assert.equal(plan.retentionVerified, false);
  assert.equal(plan.trades[0].coverageComplete, true);
});

test("plans are frozen so a caller cannot mark its own retry completed", () => {
  const plan = planJournalPersistenceRetry({
    readResult: unreadableRead("{oops"),
    currentTrades: [],
  });

  assert.throws(() => {
    plan.retryCompleted = true;
  }, TypeError);

  assert.equal(plan.retryCompleted, false);
});

test("planning touches no storage, no browser global and no React", () => {
  const moduleSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "journalPersistenceStatus.js"),
    "utf8",
  );

  assert.equal(moduleSource.includes("localStorage"), false);
  assert.equal(moduleSource.includes("window"), false);
  assert.equal(moduleSource.includes("document"), false);
  assert.equal(moduleSource.includes("react"), false);
  assert.equal(moduleSource.includes("setItem"), false);
  assert.equal(moduleSource.includes("removeItem"), false);

  const previous = globalThis.localStorage;

  globalThis.localStorage = {
    getItem() {
      throw new Error("the module must never reach browser storage");
    },
    setItem() {
      throw new Error("the module must never write browser storage");
    },
  };

  try {
    describeJournalPersistence(state());
    planJournalPersistenceRetry({
      readResult: okRead([journalRow()]),
      currentTrades: [recoveredRow()],
    });
  } finally {
    if (previous === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previous;
    }
  }
});

test("the status module imports nothing but the storage contract", () => {
  const moduleSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "journalPersistenceStatus.js"),
    "utf8",
  );
  const specifiers = [...moduleSource.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

  assert.equal(specifiers.length > 0, true);

  for (const specifier of specifiers) {
    assert.equal(specifier, "./journalStorage.js");
  }
});
