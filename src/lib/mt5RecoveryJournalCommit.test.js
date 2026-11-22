import test from "node:test";
import assert from "node:assert/strict";

import {
  planRecoveryJournalCommit,
  RECOVERY_COMMIT_STATUS,
  RECOVERY_COMMIT_REASONS as C,
} from "./mt5RecoveryJournalCommit.js";

// ============================================================
// Fixtures
//
// A proposal is copied key-for-key from the record the adapter publishes
// (src/lib/mt5RecoveryJournalAdapter.js, the record adaptRecord returns), including the
// recoveryComponents shape built by componentsOf from
// MONEY_FIELDS (:35) = profit / commission / swap / fee, and the
// dataGaps list at :54-61. A verdict is copied from the account preview
// (mt5RecoveryAccountPreview.js planRecoveryPreviewForAccount over
// mt5RecoveryOrchestrator.js planMT5RecoveryPreview): status, refusals, records, skipped,
// rejected, remaining, the four false flags, identity, outcome, accountId.
// A journal row is copied from what JournalContext persists under
// localStorage["trades"] (src/context/JournalContext.jsx:26-52, :149-161)
// through normalizeJournalTrade (journalTradeNormalization.js:662-669),
// which always fills `id` and keeps `accountId`.
//
// Nothing here invents a key: a code that read a field no producer writes
// would pass against these fixtures and fail in production.
// ============================================================

const LOGIN = "12345678";
const SERVER = "metatrader-demo";
const ACCOUNT_ID = "1767000000000";
const OTHER_ACCOUNT_ID = "1767000000999";

const OPEN_MSC = Date.UTC(2026, 9, 14, 9, 30, 0);
const CLOSE_MSC = Date.UTC(2026, 9, 14, 15, 5, 0);
const SNAPSHOT_UTC = "2026-10-21T12:00:05Z";

function proposal(overrides = {}) {
  const positionId = overrides.positionId ?? "900";

  return Object.freeze({
    id: `mt5-position-${LOGIN}-${positionId}`,
    accountId: ACCOUNT_ID,
    mt5Login: LOGIN,
    mt5Server: SERVER,
    broker: "MT5",
    source: "history-recovery",
    status: "CLOSED",
    positionId,
    brokerPositionId: positionId,
    symbol: "EURUSD.pro",
    side: "buy",
    volume: "0.10",
    openedAt: OPEN_MSC,
    closedAt: CLOSE_MSC,
    openedAtMsc: OPEN_MSC,
    closedAtMsc: CLOSE_MSC,
    pnl: "12.50",
    netProfit: "12.50",
    netPnL: "12.50",
    realizedPnL: "12.50",
    reconstructedNetPnl: "12.50",
    pnlBasis: "reconstructed-broker-reported-total",
    recoveryComponents: Object.freeze({
      profit: "15.00",
      commission: "-2.50",
      swap: "0.00",
      fee: "0.00",
    }),
    dealTickets: Object.freeze(["7001", "7002"]),
    openingTickets: Object.freeze(["7001"]),
    closingTickets: Object.freeze(["7002"]),
    liveSnapshotToUtc: SNAPSHOT_UTC,
    coverageComplete: false,
    dataGaps: Object.freeze([
      "CURRENCY",
      "STOP_LOSS",
      "TAKE_PROFIT",
      "ENTRY_PRICE",
      "EXIT_PRICE",
      "RISK_REWARD",
    ]),
    ...overrides,
  });
}

function preview(records, overrides = {}) {
  return Object.freeze({
    status: RECOVERY_ORCHESTRATOR_PREVIEW,
    refusals: Object.freeze([]),
    records: Object.freeze(records),
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
    identity: Object.freeze({
      accountId: ACCOUNT_ID,
      login: LOGIN,
      server: SERVER,
    }),
    outcome: null,
    accountId: ACCOUNT_ID,
    ...overrides,
  });
}

// The orchestrator's own literal, spelled out so a fixture cannot drift
// into agreeing with a wrong production value.
const RECOVERY_ORCHESTRATOR_PREVIEW = "preview";

function journalRow(overrides = {}) {
  return {
    id: "journal-1760000000000-abc123",
    accountId: ACCOUNT_ID,
    pair: "EURUSD",
    symbol: "EURUSD",
    side: "buy",
    volume: 0.1,
    status: "Closed",
    openedAt: "2026-10-14",
    closedAt: "2026-10-14",
    netProfit: 30,
    notes: "manual entry",
    ...overrides,
  };
}

function planned(input) {
  const outcome = planRecoveryJournalCommit(input);

  assert.equal(outcome.status, RECOVERY_COMMIT_STATUS.PLANNED);
  assert.deepEqual([...outcome.refusals], []);

  return outcome;
}

function refused(input, ...reasons) {
  const outcome = planRecoveryJournalCommit(input);

  assert.equal(outcome.status, RECOVERY_COMMIT_STATUS.REFUSED);

  for (const reason of reasons) {
    assert.ok(
      outcome.refusals.includes(reason),
      `expected refusal ${reason}, got ${JSON.stringify(outcome.refusals)}`
    );
  }

  // A refused plan must be unusable: nothing to append, nothing already
  // merged, and no array a caller could hand to a writer by mistake.
  assert.deepEqual([...outcome.append], []);
  assert.deepEqual([...outcome.rejected], []);
  assert.equal(outcome.journal, null);
  assert.equal(outcome.changed, false);

  return outcome;
}

// ============================================================
// A preview whose records the journal does not hold yet
// ============================================================

test("plans an append for every proposal a fresh journal has never seen", () => {
  const first = proposal({ positionId: "900" });
  const second = proposal({ positionId: "901" });

  const outcome = planned({
    verdict: preview([first, second]),
    existingJournal: [],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], [first, second]);
  assert.deepEqual([...outcome.journal], [first, second]);
  assert.equal(outcome.changed, true);
  assert.equal(outcome.accountId, ACCOUNT_ID);
});

test("carries every unproven flag through the plan unchanged", () => {
  const outcome = planned({
    verdict: preview([proposal()]),
    existingJournal: [],
    accountId: ACCOUNT_ID,
  });

  assert.equal(outcome.coverageComplete, false);
  assert.equal(outcome.retentionVerified, false);
  assert.equal(outcome.journalWritten, false);
  assert.equal(outcome.watermarkAdvanced, false);
});

test("plans nothing when the preview proposed nothing", () => {
  const outcome = planned({
    verdict: preview([]),
    existingJournal: [journalRow()],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.deepEqual([...outcome.rejected], []);
  assert.equal(outcome.changed, false);
  assert.equal(outcome.journal.length, 1);
});

// ============================================================
// Verdict shape: only a clean preview may be committed
// ============================================================

test("refuses a verdict that is not a plain object", () => {
  for (const verdict of [undefined, null, "preview", [], 0]) {
    refused({ verdict, existingJournal: [], accountId: ACCOUNT_ID }, C.VERDICT_INVALID);
  }
});

test("refuses a blocked verdict", () => {
  refused(
    {
      verdict: preview([proposal()], { status: "blocked" }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_NOT_PREVIEW
  );
});

test("refuses a verdict that carries refusals", () => {
  refused(
    {
      verdict: preview([proposal()], {
        refusals: Object.freeze(["SCAN_RETRY_REQUIRED"]),
      }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_REFUSALS_PRESENT
  );
});

test("refuses a verdict that reports its refusals in the wrong shape", () => {
  for (const refusals of [undefined, null, "SCAN_RETRY_REQUIRED", {}]) {
    refused(
      { verdict: preview([proposal()], { refusals }), existingJournal: [], accountId: ACCOUNT_ID },
      C.VERDICT_INVALID
    );
  }
});

test("refuses a verdict that claims the journal was written", () => {
  refused(
    {
      verdict: preview([proposal()], { journalWritten: true }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_CLAIMS_WRITE
  );
});

test("refuses a verdict that claims a watermark was advanced", () => {
  refused(
    {
      verdict: preview([proposal()], { watermarkAdvanced: true }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_CLAIMS_WRITE
  );
});

test("refuses a verdict that omits the write flags", () => {
  const verdict = { ...preview([proposal()]) };

  delete verdict.journalWritten;
  delete verdict.watermarkAdvanced;

  refused(
    { verdict, existingJournal: [], accountId: ACCOUNT_ID },
    C.VERDICT_CLAIMS_WRITE
  );
});

test("refuses a verdict that claims complete broker coverage", () => {
  refused(
    {
      verdict: preview([proposal()], { coverageComplete: true }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_CLAIMS_COVERAGE
  );
});

test("refuses a verdict that claims verified broker retention", () => {
  refused(
    {
      verdict: preview([proposal()], { retentionVerified: true }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_CLAIMS_COVERAGE
  );
});

test("refuses a verdict with no records list", () => {
  for (const records of [undefined, null, "mt5-position-12345678-900", {}]) {
    refused(
      { verdict: preview(records), existingJournal: [], accountId: ACCOUNT_ID },
      C.RECORDS_INVALID
    );
  }
});

test("refuses a record that is not a plain object", () => {
  for (const record of [null, "mt5-position-12345678-900", 900, []]) {
    refused(
      { verdict: preview([record]), existingJournal: [], accountId: ACCOUNT_ID },
      C.RECORD_INVALID
    );
  }
});

// ============================================================
// Record shape: only what the adapter publishes
// ============================================================

test("refuses a record missing either half of the recovery provenance pair", () => {
  for (const overrides of [
    { source: undefined },
    { broker: undefined },
    { source: "manual" },
    { broker: "cTrader" },
    { source: "history-recovery-" },
  ]) {
    refused(
      {
        verdict: preview([proposal({ ...overrides })]),
        existingJournal: [],
        accountId: ACCOUNT_ID,
      },
      C.RECORD_PROVENANCE_INVALID
    );
  }
});

test("refuses a record whose id is not adapter-published text", () => {
  for (const id of [undefined, null, "", "   ", 1001, {}, () => "mt5-position"]) {
    refused(
      { verdict: preview([proposal({ id })]), existingJournal: [], accountId: ACCOUNT_ID },
      C.RECORD_ID_INVALID
    );
  }
});

test("refuses a record whose broker position id is not digits", () => {
  for (const brokerPositionId of [undefined, null, "", "900a", "-900", " 900", {}]) {
    refused(
      {
        verdict: preview([proposal({ brokerPositionId })]),
        existingJournal: [],
        accountId: ACCOUNT_ID,
      },
      C.RECORD_POSITION_INVALID
    );
  }
});

test("refuses a record that claims its own coverage is complete", () => {
  refused(
    {
      verdict: preview([proposal({ coverageComplete: true })]),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.RECORD_CLAIMS_COVERAGE
  );
});

// ============================================================
// Account attribution: the caller names the account and nothing else may
// ============================================================

test("refuses when the caller supplies no account id", () => {
  for (const accountId of [undefined, null, "", "   "]) {
    refused(
      { verdict: preview([proposal()]), existingJournal: [], accountId },
      C.ACCOUNT_ID_MISSING
    );
  }
});

test("canonicalises a numeric account id to the text the journal stores", () => {
  // accountText in mt5RecoveryJournalAdapter.js and the app's own
  // normalizeAccountId both stringify a finite number, so the same account
  // named as a number must not be read as a different one.
  const outcome = planned({
    verdict: preview([proposal()]),
    existingJournal: [],
    accountId: Number(ACCOUNT_ID),
  });

  assert.equal(outcome.accountId, ACCOUNT_ID);
  assert.equal(outcome.append.length, 1);
});

test("refuses a batch holding a record for another account", () => {
  refused(
    {
      verdict: preview([
        proposal({ positionId: "900" }),
        proposal({ positionId: "901", accountId: OTHER_ACCOUNT_ID }),
      ]),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.BATCH_ATTRIBUTION_MISMATCH
  );
});

test("refuses a record carrying no account attribution", () => {
  for (const accountId of [undefined, null, ""]) {
    refused(
      {
        verdict: preview([proposal({ accountId })]),
        existingJournal: [],
        accountId: ACCOUNT_ID,
      },
      C.BATCH_ATTRIBUTION_MISMATCH
    );
  }
});

test("refuses a verdict planned for a different account", () => {
  refused(
    {
      verdict: preview([proposal()], { accountId: OTHER_ACCOUNT_ID }),
      existingJournal: [],
      accountId: ACCOUNT_ID,
    },
    C.VERDICT_ACCOUNT_MISMATCH
  );
});

test("refuses a verdict that resolved no persisted account", () => {
  // mt5RecoveryAccountPreview.js accountId = account.id ?? null lets it be null when the matched
  // account row has no id, so a null here means an unnamed account.
  for (const accountId of [undefined, null, ""]) {
    refused(
      {
        verdict: preview([proposal()], { accountId }),
        existingJournal: [],
        accountId: ACCOUNT_ID,
      },
      C.VERDICT_ACCOUNT_MISMATCH
    );
  }
});

test("matches the verdict account on text, not on the type it was stored as", () => {
  const outcome = planned({
    verdict: preview([proposal()], { accountId: ACCOUNT_ID }),
    existingJournal: [],
    accountId: `  ${ACCOUNT_ID}  `,
  });

  assert.equal(outcome.accountId, ACCOUNT_ID);
  assert.equal(outcome.append.length, 1);
});

// ============================================================
// The journal snapshot is an argument and must be a real one
// ============================================================

test("refuses a journal snapshot that was never supplied", () => {
  for (const existingJournal of [undefined, null, "[]", {}, 0]) {
    refused(
      { verdict: preview([proposal()]), existingJournal, accountId: ACCOUNT_ID },
      C.JOURNAL_INVALID
    );
  }
});

test("refuses a journal snapshot holding a row that is not an object", () => {
  for (const row of [null, undefined, "journal-1", 42, []]) {
    refused(
      {
        verdict: preview([proposal()]),
        existingJournal: [journalRow(), row],
        accountId: ACCOUNT_ID,
      },
      C.JOURNAL_INVALID
    );
  }
});

// ============================================================
// Dedupe: ids across the whole journal, positions per account
// ============================================================

test("skips a proposal whose id is already journaled by a manual trade", () => {
  const collided = proposal({ positionId: "900" });
  const fresh = proposal({ positionId: "901" });

  const outcome = planned({
    verdict: preview([collided, fresh]),
    existingJournal: [
      journalRow({
        id: collided.id,
        notes: "edited by the user",
        tags: ["keep me"],
      }),
    ],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], [fresh]);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].reason, C.ID_ALREADY_JOURNALED);
  assert.equal(outcome.rejected[0].id, collided.id);
});

test("skips a proposal journaled under the live position id namespace", () => {
  // A live close writes id "mt5-<ticket>" (TradeContext.jsx:5695-5727 over a
  // position normalised at :968-972), so an id comparison alone cannot see
  // that this recovered position is already in the journal.
  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [
      journalRow({
        id: "mt5-555",
        broker: "MT5",
        brokerPositionId: "900",
      }),
    ],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].reason, C.POSITION_ALREADY_JOURNALED);
  assert.equal(outcome.changed, false);
});

test("skips a proposal whose journaled position is stored as a number", () => {
  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [
      journalRow({ id: "mt5-555", broker: "MT5", brokerPositionId: 900 }),
    ],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected[0].reason, C.POSITION_ALREADY_JOURNALED);
});

// Policy 3X-7D-B. The journal is one array (localStorage["trades"], written
// whole by JournalContext), and its dedupe key is String(id) alone
// (src/context/JournalContext.jsx:398-402) with the incoming fields written
// over the row it matched (:437-443) — all of which is account-blind. So an id
// taken by another account is not free space: appending over it would destroy
// that row's user edits. The position namespace stays account-scoped, because
// two accounts genuinely can share position numbers.
test("refuses a proposal whose id is journaled under another account", () => {
  const held = journalRow({
    id: `mt5-position-${LOGIN}-900`,
    accountId: OTHER_ACCOUNT_ID,
    notes: "another account's own words",
    tags: ["keep me"],
  });

  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [held],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].reason, C.ID_JOURNALED_ELSEWHERE);
  assert.equal(outcome.rejected[0].id, held.id);
  assert.equal(outcome.rejected[0].accountId, ACCOUNT_ID);
  assert.equal(outcome.changed, false);

  // Refusing the proposal is the whole response: the row that was already
  // there comes back untouched, in place, and never rewritten.
  assert.strictEqual(outcome.journal[0], held);
  assert.equal(outcome.journal.length, 1);
  assert.equal(held.notes, "another account's own words");
  assert.deepEqual([...held.tags], ["keep me"]);
});

test("refuses a proposal whose id is journaled by a row that names no account", () => {
  // A row this module cannot attribute is still a row the writer would match
  // on id, so it occupies the id namespace like any other.
  const held = journalRow({
    id: `mt5-position-${LOGIN}-900`,
    accountId: null,
    notes: "unattributed",
  });

  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [held],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected[0].reason, C.ID_JOURNALED_ELSEWHERE);
  assert.strictEqual(outcome.journal[0], held);
});

test("keeps the same-account reason when an id is journaled twice", () => {
  // The account-scoped refusal is preserved, not swallowed by the global one:
  // the row the caller is committing to is named first, wherever else the id
  // may appear.
  const collided = proposal({ positionId: "900" });

  const outcome = planned({
    verdict: preview([collided]),
    existingJournal: [
      journalRow({ id: collided.id, accountId: OTHER_ACCOUNT_ID }),
      journalRow({ id: collided.id, accountId: ACCOUNT_ID }),
    ],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].reason, C.ID_ALREADY_JOURNALED);
});

test("does not silence a position journaled for another account", () => {
  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [
      journalRow({
        id: "mt5-555",
        accountId: OTHER_ACCOUNT_ID,
        broker: "MT5",
        brokerPositionId: "900",
      }),
    ],
    accountId: ACCOUNT_ID,
  });

  assert.equal(outcome.append.length, 1);
  assert.deepEqual([...outcome.rejected], []);
});

test("does not silence a position number belonging to another broker", () => {
  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [
      journalRow({
        id: "ct-555",
        broker: "cTrader",
        brokerPositionId: "900",
      }),
    ],
    accountId: ACCOUNT_ID,
  });

  assert.equal(outcome.append.length, 1);
  assert.deepEqual([...outcome.rejected], []);
});

test("counts a row with no broker as this account holding the position", () => {
  // indexJournal (mt5RecoveryJournalAdapter.js) skips only rows that
  // name another broker, so an unbranded row still occupies its position.
  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" })]),
    existingJournal: [journalRow({ brokerPositionId: "900" })],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected[0].reason, C.POSITION_ALREADY_JOURNALED);
});

test("keeps the second of two proposals with one id out of the append", () => {
  const outcome = planned({
    verdict: preview([proposal({ positionId: "900" }), proposal({ positionId: "900" })]),
    existingJournal: [],
    accountId: ACCOUNT_ID,
  });

  assert.equal(outcome.append.length, 1);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].reason, C.DUPLICATE_ID_IN_BATCH);
});

test("keeps the second of two proposals for one broker position out of the append", () => {
  const outcome = planned({
    verdict: preview([
      proposal({ positionId: "900", id: "mt5-position-12345678-900" }),
      proposal({ positionId: "900", id: "recovered-duplicate-900" }),
    ]),
    existingJournal: [],
    accountId: ACCOUNT_ID,
  });

  assert.equal(outcome.append.length, 1);
  assert.equal(outcome.append[0].id, "mt5-position-12345678-900");
  assert.equal(outcome.rejected[0].reason, C.DUPLICATE_POSITION_IN_BATCH);
});

test("reports every proposal as skipped when the journal already holds them all", () => {
  const first = proposal({ positionId: "900" });
  const second = proposal({ positionId: "901" });

  const outcome = planned({
    verdict: preview([first, second]),
    existingJournal: [journalRow({ id: first.id }), journalRow({ id: second.id })],
    accountId: ACCOUNT_ID,
  });

  // Nothing new appended is not a failure and not a success either: the
  // plan says changed=false and leaves the writing to the caller.
  assert.equal(outcome.status, RECOVERY_COMMIT_STATUS.PLANNED);
  assert.equal(outcome.changed, false);
  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.rejected.length, 2);
  assert.equal(outcome.journalWritten, false);
  assert.equal(outcome.watermarkAdvanced, false);
});

// ============================================================
// Append-only: existing rows are never rewritten
// ============================================================

test("returns the supplied rows untouched and appends after them", () => {
  const edited = journalRow({
    id: "journal-1",
    notes: "the user's own words",
    tags: ["keep"],
    manuallyReviewed: true,
  });
  const other = journalRow({ id: "journal-2", accountId: OTHER_ACCOUNT_ID });
  const recovered = proposal({ positionId: "900" });

  const snapshot = [edited, other];

  const outcome = planned({
    verdict: preview([recovered]),
    existingJournal: snapshot,
    accountId: ACCOUNT_ID,
  });

  assert.equal(outcome.journal.length, 3);
  assert.notEqual(outcome.journal, snapshot);

  // Same objects, not copies: nothing was re-normalised, re-keyed or merged.
  assert.strictEqual(outcome.journal[0], edited);
  assert.strictEqual(outcome.journal[1], other);
  assert.strictEqual(outcome.journal[2], recovered);

  assert.equal(edited.notes, "the user's own words");
  assert.deepEqual([...edited.tags], ["keep"]);
  assert.equal(edited.manuallyReviewed, true);
});

test("leaves a colliding journal row exactly as it was supplied", () => {
  const held = journalRow({
    id: "mt5-position-12345678-900",
    notes: "user edit",
    netProfit: 999,
  });

  const outcome = planned({
    verdict: preview([proposal({ positionId: "900", pnl: "12.50", netProfit: "12.50" })]),
    existingJournal: [held],
    accountId: ACCOUNT_ID,
  });

  assert.deepEqual([...outcome.append], []);
  assert.equal(outcome.journal.length, 1);
  assert.strictEqual(outcome.journal[0], held);
  assert.equal(held.notes, "user edit");
  assert.equal(held.netProfit, 999);
});

// Policy 3X-7C-2, "a collision must never trigger overwriting or merging the
// existing trade", and Policy 3X-7D-B, which made the collision itself a
// refusal. The journal is one array and its writer matches on String(id) alone,
// so a same-id row held by another account is not free space; and either way
// the invariant asserted here holds — the journal is append-only, the row that
// was already there is returned by reference with its own fields, and no
// proposal is ever blended with it.
test("never overwrites or merges a same-id row held by another account", () => {
  const held = journalRow({
    id: `mt5-position-${LOGIN}-900`,
    accountId: OTHER_ACCOUNT_ID,
    notes: "another account's words",
    netProfit: 999,
    tags: ["keep me"],
  });
  const proposed = proposal({ positionId: "900" });

  const outcome = planRecoveryJournalCommit({
    verdict: preview([proposed]),
    existingJournal: [held],
    accountId: ACCOUNT_ID,
  });

  if (outcome.journal !== null) {
    assert.strictEqual(outcome.journal[0], held);
  }

  // The proposal is accounted for exactly once, either way.
  assert.equal(outcome.append.length + outcome.rejected.length, 1);

  // The row that was already journaled comes back as the same object with
  // the user's own fields on it: it was neither rewritten nor re-normalised.
  assert.equal(held.notes, "another account's words");
  assert.equal(held.netProfit, 999);
  assert.deepEqual([...held.tags], ["keep me"]);

  // And nothing added under that id carries those fields.
  for (const row of outcome.append) {
    assert.notEqual(row, held);
    assert.equal(row.id, held.id);
    assert.equal(row.notes, undefined);
    assert.notEqual(row.netProfit, 999);
  }
});

test("does not mutate the snapshot array it is given", () => {
  const snapshot = [journalRow({ id: "journal-1" })];

  planned({
    verdict: preview([proposal()]),
    existingJournal: snapshot,
    accountId: ACCOUNT_ID,
  });

  assert.equal(snapshot.length, 1);
});

// ============================================================
// Purity: no storage, clock, timer or transport anywhere
// ============================================================

test("reads no storage, clock, timer or transport while planning", () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;

  const trip = (name) => () => {
    throw new Error(`PROBE_PURITY_BREACH: ${name}`);
  };

  Date.now = trip("Date.now");
  globalThis.setTimeout = trip("setTimeout");
  globalThis.setInterval = trip("setInterval");
  globalThis.fetch = trip("fetch");
  globalThis.localStorage = { getItem: trip("localStorage.getItem") };

  try {
    const outcome = planned({
      verdict: preview([proposal()]),
      existingJournal: [journalRow()],
      accountId: ACCOUNT_ID,
    });

    assert.equal(outcome.append.length, 1);
  } finally {
    Date.now = originalDateNow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  }
});

// ============================================================
// The plan is frozen, so no caller can relabel it a commit
// ============================================================

test("freezes the plan and its lists against relabelling", () => {
  const outcome = planned({
    verdict: preview([proposal()]),
    existingJournal: [],
    accountId: ACCOUNT_ID,
  });

  assert.ok(Object.isFrozen(outcome));
  assert.ok(Object.isFrozen(outcome.append));
  assert.ok(Object.isFrozen(outcome.journal));
  assert.ok(Object.isFrozen(outcome.rejected));

  assert.throws(() => {
    outcome.journalWritten = true;
  }, TypeError);

  assert.throws(() => {
    outcome.append.push(journalRow());
  }, TypeError);
});

test("freezes a refused plan the same way a planned one", () => {
  const outcome = planRecoveryJournalCommit({
    verdict: preview([proposal()], { journalWritten: true }),
    existingJournal: [],
    accountId: ACCOUNT_ID,
  });

  assert.ok(Object.isFrozen(outcome));
  assert.ok(Object.isFrozen(outcome.refusals));
  assert.throws(() => {
    outcome.status = RECOVERY_COMMIT_STATUS.PLANNED;
  }, TypeError);
});

test("reports the refused account id it was given", () => {
  const outcome = planRecoveryJournalCommit({
    verdict: preview([proposal()], { status: "blocked" }),
    existingJournal: [],
    accountId: ` ${ACCOUNT_ID} `,
  });

  assert.equal(outcome.status, RECOVERY_COMMIT_STATUS.REFUSED);
  assert.equal(outcome.accountId, ACCOUNT_ID);
});
