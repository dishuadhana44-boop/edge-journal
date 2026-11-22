import test from "node:test";
import assert from "node:assert/strict";

import { runHistoryRecoveryScan } from "./mt5HistoryRecoveryScan.js";
import { buildRecoveryJournalRecords } from "./mt5HistoryRecoveryJournal.js";
import { sumDecimalTexts } from "./mt5DealAmounts.js";
import { normalizeJournalTrade } from "./journalTradeNormalization.js";

import { canonicalLogin } from "../utils/trading/recoveryClock.js";

import {
  adaptRecoveryJournalRecords,
  RECOVERY_ADAPTER_REASONS as R,
  RECOVERY_ADAPTER_STATUS,
} from "./mt5RecoveryJournalAdapter.js";

// ============================================================
// Fixtures
//
// Deal rows, live-position rows and accepted page bodies are copied
// field-for-field from mt5-bridge/app.py validate_history_deal and
// server/routes/mt5.js historySuccessBody, exactly as in
// src/lib/mt5HistoryRecoveryScan.test.js and
// src/lib/mt5HistoryRecoveryJournal.test.js.
//
// A scenario is a real Phase 2 scan plus the real page records it made
// plus the real Phase 3B mapper output for those pages, so the happy
// path is genuine evidence and only the tests that must prove a guard
// forge one field of it. Every forgery names the field it contradicts.
// ============================================================

const LOGIN = "12345678";
const OTHER_LOGIN = "87654321";
const SERVER = "metatrader-demo";
const ACCOUNT_ID = "1767000000000";
const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";
const API_URL = "http://localhost:4000";

const W1 = { fromUtc: "2026-01-01T00:00:00Z", toUtc: "2026-01-08T00:00:00Z" };
const W2 = { fromUtc: "2026-01-08T00:00:00Z", toUtc: "2026-01-15T00:00:00Z" };
const W0 = { fromUtc: "2025-12-24T00:00:00Z", toUtc: "2025-12-31T00:00:00Z" };

const OPEN_MSC = Date.parse("2026-01-03T01:00:00Z");
const CLOSE_MSC = Date.parse("2026-01-05T01:00:00Z");

let ticketCounter = 1000;

function deal(overrides = {}) {
  const index = ++ticketCounter;

  const fields = {
    ticket: String(overrides.ticket ?? index),
    order: String(overrides.order ?? 500_000 + index),
    position_id: String(overrides.position_id ?? 9_000),
    symbol: overrides.symbol ?? "EURUSD",
    type: overrides.type ?? 0,
    entry: overrides.entry ?? 0,
    volume: overrides.volume ?? "0.1",
    price: overrides.price ?? "1.10000",
    profit: overrides.profit ?? "0",
    commission: overrides.commission ?? "-0.35",
    swap: overrides.swap ?? "0",
    fee: overrides.fee ?? "0",
    time: 0,
    time_msc: overrides.time_msc ?? OPEN_MSC,
    comment: overrides.comment ?? "edgeflo",
    magic: overrides.magic ?? 12345,
  };

  fields.time = Math.floor(fields.time_msc / 1000);

  return { ...fields, raw: { ...fields, ticket: Number(fields.ticket) } };
}

function openDeal(positionId, volume, timeMsc, overrides = {}) {
  return deal({
    position_id: positionId,
    type: 0,
    entry: 0,
    volume,
    time_msc: timeMsc,
    ...overrides,
  });
}

function closeDeal(positionId, volume, timeMsc, overrides = {}) {
  return deal({
    position_id: positionId,
    type: 1,
    entry: 1,
    volume,
    time_msc: timeMsc,
    ...overrides,
  });
}

function historyPage(history, positions, window, identity) {
  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity,
    utc_range: { from_utc: window.fromUtc, to_utc: window.toUtc },
    scan_range: { from_utc: window.fromUtc, to_utc: window.toUtc },
    coverage: {
      boundaries: "inclusive",
      returned_deal_count: history.length,
      serialized_deal_count: history.length,
    },
    retention_verified: false,
    bridge_boot_id: BOOT_ID,
    connection_generation: 0,
    count: history.length,
    history,
    positions,
    classification: {
      trade_deal_count: history.filter((row) => row.type === 0 || row.type === 1)
        .length,
      financial_deal_count: 0,
      unknown_type_count: 0,
    },
  };
}

function okJson(body) {
  return { ok: true, status: 200, json: async () => body };
}

function respondingWith(...responses) {
  let index = 0;

  return {
    fetchImpl: async () => responses[Math.min(index++, responses.length - 1)],
  };
}

// One closed position in W1, proved absent by the newest snapshot in W2.
// The broker components are profit 1, commission -0.7, swap -0.12,
// fee 0, so the exact decimal total is "0.18" while every floating-point
// sum of the same four numbers prints longer than two decimals.
const CLEAN_LIFECYCLE = () => [
  openDeal("9001", "0.1", OPEN_MSC),
  closeDeal("9001", "0.1", CLOSE_MSC, {
    profit: "1",
    swap: "-0.12",
  }),
];

const TOTAL = "0.18";
const COMPONENTS = {
  profit: "1",
  commission: "-0.7",
  swap: "-0.12",
  fee: "0",
};

async function evidence({
  login = LOGIN,
  server = SERVER,
  first = CLEAN_LIFECYCLE(),
  newest = [],
  account = null,
  existingJournal = [],
} = {}) {
  const identity = { mt5Login: login, mt5Server: server };

  const w1 = historyPage(first, [], W1, identity);
  const w2 = historyPage(newest, [], W2, identity);

  const { fetchImpl } = respondingWith(okJson(w1), okJson(w2));

  const outcome = await runHistoryRecoveryScan({
    apiUrl: API_URL,
    identity,
    windows: [W1, W2],
    fetchImpl,
  });

  // The pages are the scan's own carried evidence, not a parallel copy: a
  // scenario that did not pair would prove nothing about pairing, and the
  // forgeries below move both sides together so they isolate the guard each
  // test names.
  return {
    outcome,
    pages: outcome.pages,
    recovery: buildRecoveryJournalRecords({ result: outcome.result, pages: outcome.pages }),
    account: account ?? {
      id: ACCOUNT_ID,
      mt5Login: login,
      mt5Server: server,
      brokerAccountId: login,
    },
    existingJournal,
  };
}

async function adapted(options) {
  const scenario = await evidence(options);

  return { scenario, result: adaptRecoveryJournalRecords(scenario) };
}

function solo(items, what = "item") {
  assert.equal(items.length, 1, `expected one ${what}, got ${items.length}`);

  return items[0];
}

function blocked(result, code) {
  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.BLOCKED);
  assert.deepEqual([...result.records], []);
  assert.deepEqual([...result.skipped], []);
  assert.deepEqual([...result.rejected], []);
  assert.ok(
    result.refusals.includes(code),
    `expected refusal ${code}, got ${JSON.stringify(result.refusals)}`
  );

  return result;
}

// Names the one and only reason a run is blocked. A row forged against
// the candidate has to be caught by the binding, not incidentally by a
// gate that would have failed for an unrelated reason anyway.
function blockedByExactly(result, code) {
  blocked(result, code);
  assert.deepEqual([...result.refusals], [code]);

  return result;
}

function withScan(outcome, overrides) {
  return {
    ...outcome,
    result: {
      ...outcome.result,
      scan: { ...outcome.result.scan, ...overrides },
    },
  };
}

// Forges one field of the scan's own outcome. The outcome is what the gates
// were checked on, so an outcome that no longer describes the pages beside
// it has to be refused rather than repaired.
function withOutcome(scenario, overrides) {
  return { ...scenario, outcome: { ...scenario.outcome, ...overrides } };
}

// Forges one field of an already-mapped recovery record. The mapper is
// the producer; the adapter must still refuse a record whose money,
// identity or provenance does not hold up, because nothing in the type
// system guarantees the recovery object came from clean pages.
function withRecord(scenario, overrides, index = 0) {
  const recovered = [...scenario.recovery.recovered];

  recovered[index] = { ...recovered[index], ...overrides };

  return {
    ...scenario,
    recovery: { ...scenario.recovery, recovered },
  };
}

function withoutRecord(scenario, index) {
  const recovered = [...scenario.recovery.recovered];

  recovered.splice(index, 1);

  return {
    ...scenario,
    recovery: { ...scenario.recovery, recovered },
  };
}

// Swaps the accepted pages out from under an already-mapped recovery, so
// the deal rows handed to the adapter are not the rows the money came
// from. Everything else stays a genuine scan.
function withPages(scenario, index, overrides) {
  const pages = [...scenario.pages];

  pages[index] = { ...pages[index], page: { ...pages[index].page, ...overrides } };

  // The scan's copy moves with them: these forgeries have to be caught by
  // the deal-row binding, not by the pairing gate beside it.
  return {
    ...scenario,
    pages,
    outcome: { ...scenario.outcome, pages },
  };
}

// Patches one candidate inside the scan result while leaving the mapped
// records as the clean pages produced them.
function withCandidate(scenario, overrides, index = 0) {
  const closed = [...scenario.outcome.result.closed];

  closed[index] = { ...closed[index], ...overrides };

  return {
    ...scenario,
    outcome: {
      ...scenario.outcome,
      result: { ...scenario.outcome.result, closed },
    },
  };
}

// Replaces the mapped record list wholesale. The mapper is a pure function
// of this outcome and these pages, so a list it would not have produced is
// a different payload wearing this payload's flags — even at the right size.
function withRecovered(scenario, recovered) {
  return { ...scenario, recovery: { ...scenario.recovery, recovered } };
}

function withUnresolved(scenario, index, overrides) {
  const unresolved = [...scenario.recovery.unresolved];

  unresolved[index] = { ...unresolved[index], ...overrides };

  return { ...scenario, recovery: { ...scenario.recovery, unresolved } };
}

function withUnassigned(scenario, index, overrides) {
  const unassigned = [...scenario.recovery.unassigned];

  unassigned[index] = { ...unassigned[index], ...overrides };

  return { ...scenario, recovery: { ...scenario.recovery, unassigned } };
}

// Two closed positions in one window: enough to show a record list of the
// right length that is not the list this evidence produces.
const TWO_POSITIONS = () => [
  ...CLEAN_LIFECYCLE(),
  openDeal("9002", "0.3", OPEN_MSC + 500, { commission: "-1" }),
  closeDeal("9002", "0.3", CLOSE_MSC + 500, { profit: "1.4" }),
];

// One closed position plus a position the newest snapshot never disproved:
// the honest producer of a non-empty unresolved list.
const WITH_UNRESOLVED = () => [...CLEAN_LIFECYCLE(), openDeal("9003", "0.1", OPEN_MSC)];

// One healthy position plus a position whose reported profit is a float
// rather than broker text: the honest producer of a non-empty unassigned list.
const WITH_UNASSIGNED = () => [
  ...CLEAN_LIFECYCLE(),
  openDeal("9004", "0.2", OPEN_MSC + 1_000),
  closeDeal("9004", "0.2", CLOSE_MSC + 1_000, { profit: 2.5 }),
];

// Patches one reported deal row and leaves every other row, the scan's
// candidate and the mapped record exactly as the clean pages produced
// them. Only a comparison against the rows can expose the contradiction.
function withRow(scenario, rowIndex, overrides, pageIndex = 0) {
  const history = scenario.pages[pageIndex].page.history.map((row, index) =>
    index === rowIndex ? { ...row, ...overrides } : row
  );

  return withPages(scenario, pageIndex, { history });
}

function recordOf(result, index = 0) {
  assert.ok(
    result.records.length > index,
    `expected a record, got ${JSON.stringify(result.refusals)}`
  );

  return result.records[index];
}

// ============================================================
// 1. One verified recovery becomes one journal-safe record
// ============================================================

test("proposes one record for a clean scan without any refusal", async () => {
  const { scenario, result } = await adapted();

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.refusals], []);
  assert.deepEqual([...result.skipped], []);
  assert.deepEqual([...result.rejected], []);
  assert.equal(result.records.length, 1);
  assert.equal(result.remaining.unresolvedCount, 0);
  assert.equal(result.remaining.unassignedCount, 0);
  assert.equal(result.remaining.refusedCount, 0);
  assert.equal(scenario.recovery.recovered.length, 1);
});

test("proposes nothing when the scan closed no position", async () => {
  const { result } = await adapted({ first: [] });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.records], []);
  assert.deepEqual([...result.refusals], []);
  assert.equal(result.remaining.unresolvedCount, 0);
  assert.equal(result.remaining.unassignedCount, 0);
});

test("names the record by the canonical login and the position id", async () => {
  const { result } = await adapted();

  assert.equal(recordOf(result).id, `mt5-position-${LOGIN}-9001`);
});

test("places the reconstructed total on every net field the journal reads", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  for (const field of ["pnl", "netProfit", "netPnL", "realizedPnL"]) {
    assert.equal(record[field], TOTAL, `${field} lost the total`);
  }

  assert.equal(record.reconstructedNetPnl, TOTAL);
});

test("carries the broker total through without summing it in floats", async () => {
  const { scenario, result } = await adapted();
  const record = recordOf(result);
  const mapped = scenario.recovery.recovered[0];

  assert.equal(typeof record.pnl, "string", "the total was coerced");
  assert.equal(record.pnl, mapped.reconstructedNetPnl);

  // 1 - 0.7 - 0.12 + 0 is 0.18000000000000005 in binary floating point in
  // every summation order, so any recompute here would publish an amount
  // the broker never reported.
  assert.equal(record.pnl, TOTAL);
  assert.notEqual(record.pnl, String(1 - 0.7 - 0.12 + 0));
  assert.notEqual(record.pnl, String(-0.12 + 1 + 0 - 0.7));
  assert.notEqual(record.pnl, String(-0.7 + 0 + 1 - 0.12));
});

test("publishes no amount key a P&L consumer reads before the total", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  for (const field of [
    "profit",
    "grossProfit",
    "grossPnL",
    "grossPnl",
    "grossPL",
    "unrealizedPnL",
    "unrealizedPnl",
    "commission",
    "swap",
    "fee",
  ]) {
    assert.equal(field in record, false, `invented top-level ${field}`);
  }
});

test("keeps the four broker amounts unchanged under recoveryComponents", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  assert.deepEqual({ ...record.recoveryComponents }, COMPONENTS);
  assert.equal(Object.isFrozen(record.recoveryComponents), true);
});

test("refuses a record whose components do not add up to its total", async () => {
  const scenario = await evidence();

  const forged = [
    ["9.99", R.RECOVERY_TOTAL_COMPONENTS_MISMATCH],
    ["0.180", R.RECOVERY_TOTAL_COMPONENTS_MISMATCH],
    ["-0.18", R.RECOVERY_TOTAL_COMPONENTS_MISMATCH],
    ["0", R.RECOVERY_TOTAL_COMPONENTS_MISMATCH],
    ["-0", R.RECOVERY_TOTAL_COMPONENTS_MISMATCH],
  ];

  for (const [total, code] of forged) {
    const result = adaptRecoveryJournalRecords({
      ...withRecord(scenario, { reconstructedNetPnl: total }),
    });

    assert.deepEqual([...result.records], []);
    assert.equal(
      solo(result.rejected, "rejection").reason,
      code,
      `total ${total} was refused with the wrong reason`
    );
  }
});

test("refuses a record whose components are not broker decimal text", async () => {
  const scenario = await evidence();

  for (const field of ["profit", "commission", "swap", "fee"]) {
    const result = adaptRecoveryJournalRecords({
      ...withRecord(scenario, { [field]: 0.18 }),
    });

    assert.deepEqual([...result.records], []);
    assert.equal(solo(result.rejected, "rejection").reason, R.RECOVERY_COMPONENTS_INVALID);
  }
});

test("carries account, broker and snapshot provenance verbatim", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  assert.equal(record.accountId, ACCOUNT_ID);
  assert.equal(record.mt5Login, LOGIN);
  assert.equal(record.mt5Server, SERVER);
  assert.equal(record.brokerAccountId, LOGIN);
  assert.equal(record.broker, "MT5");
  assert.equal(record.source, "history-recovery");
  assert.equal(record.status, "CLOSED");
  assert.equal(record.pnlBasis, "reconstructed-broker-reported-total");
  assert.equal(record.coverageComplete, false);
});

test("keeps broker position identity so live and recovery can dedupe", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  assert.equal(record.brokerPositionId, "9001");
  assert.equal(record.positionId, "9001");
  assert.equal(record.symbol, "EURUSD");
  assert.equal(record.side, "buy");
  assert.equal(record.volume, "0.1");
});

test("reports the proven timestamps under the keys the journal resolves", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  assert.equal(record.openedAt, OPEN_MSC);
  assert.equal(record.closedAt, CLOSE_MSC);
  assert.equal(record.openedAtMsc, OPEN_MSC);
  assert.equal(record.closedAtMsc, CLOSE_MSC);
});

test("keeps every deal ticket the closure was proved from", async () => {
  const { scenario, result } = await adapted();
  const candidate = scenario.outcome.result.closed[0];
  const record = recordOf(result);

  assert.deepEqual([...record.dealTickets], [...candidate.dealTickets]);
  assert.deepEqual([...record.openingTickets], [...candidate.openingTickets]);
  assert.deepEqual([...record.closingTickets], [...candidate.closingTickets]);
  assert.equal(record.liveSnapshotToUtc, W2.toUtc);
});

test("states the facts broker deal history never reported", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  assert.deepEqual([...record.dataGaps], [
    "CURRENCY",
    "STOP_LOSS",
    "TAKE_PROFIT",
    "ENTRY_PRICE",
    "EXIT_PRICE",
    "RISK_REWARD",
  ]);

  for (const field of [
    "currency",
    "stopLoss",
    "takeProfit",
    "entryPrice",
    "exitPrice",
    "rr",
    "riskReward",
    "riskRewardRatio",
  ]) {
    assert.equal(field in record, false, `invented ${field}`);
  }
});

test("freezes the proposal so no caller can rewrite it in place", async () => {
  const { result } = await adapted();
  const record = recordOf(result);

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.records), true);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.dealTickets), true);
  assert.equal(Object.isFrozen(record.dataGaps), true);
});

// ============================================================
// 2. Account identity, never the selected account
// ============================================================

test("gives the same position number on two logins two different records", async () => {
  const first = await adapted({ login: "11111111" });
  const second = await adapted({ login: "22222222" });

  assert.equal(recordOf(first.result).id, "mt5-position-11111111-9001");
  assert.equal(recordOf(second.result).id, "mt5-position-22222222-9001");
  assert.notEqual(recordOf(first.result).id, recordOf(second.result).id);
});

test("attributes the record to the persisted account, not a selected one", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    selectedAccountId: "9999999999",
    accountId: "8888888888",
  });

  assert.equal(recordOf(result).accountId, ACCOUNT_ID);
  assert.notEqual(recordOf(result).accountId, "9999999999");
});

test("canonicalizes a login stored as a number on the account record", async () => {
  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: Number(LOGIN),
      mt5Server: SERVER,
      brokerAccountId: Number(LOGIN),
    },
  });

  assert.equal(recordOf(result).id, `mt5-position-${LOGIN}-9001`);
  assert.equal(recordOf(result).mt5Login, LOGIN);
});

test("strips leading zeros from both sides of the login comparison", async () => {
  const padded = "00" + LOGIN;

  const { result } = await adapted({
    login: padded,
    account: {
      id: ACCOUNT_ID,
      mt5Login: padded,
      mt5Server: SERVER,
      brokerAccountId: padded,
    },
  });

  assert.equal(recordOf(result).mt5Login, LOGIN);
  assert.equal(recordOf(result).id, `mt5-position-${LOGIN}-9001`);
});

// Phase 3X-6E: the login the record is named with comes from the shared rule
// in recoveryClock.js. Every expectation below is read back from that same
// function, so this table tests the adapter's call sites - including the
// missing/invalid tagging its refusals depend on - rather than a hand-kept
// copy of the rule.
const ACCOUNT_LOGIN_SPELLINGS = [
  LOGIN,
  `00${LOGIN}`,
  ` 00${LOGIN} `,
  Number(LOGIN),
  `00000000000${LOGIN}`,
  "0",
  "0000",
  "12345678a",
  "1234567890123456",
  "-12345678",
  1.5,
  "",
  "   ",
  undefined,
  null,
];

test("agrees with the shared login rule about the account it is handed", async () => {
  for (const spelling of ACCOUNT_LOGIN_SPELLINGS) {
    const verdict = canonicalLogin(spelling);

    const { result } = await adapted({
      account: {
        id: ACCOUNT_ID,
        mt5Login: spelling,
        mt5Server: SERVER,
        brokerAccountId: spelling,
      },
    });

    if (typeof verdict.login === "string") {
      assert.equal(
        result.status,
        RECOVERY_ADAPTER_STATUS.PROPOSED,
        `"${String(spelling)}" canonicalises to ${verdict.login}, got ${JSON.stringify(result.refusals)}`
      );
      assert.equal(recordOf(result).mt5Login, verdict.login);
      continue;
    }

    blocked(
      result,
      verdict.missing ? R.MISSING_MT5_LOGIN : R.IDENTITY_INVALID
    );
  }
});

test("canonicalising a login never matches a page from another account", async () => {
  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: `000${OTHER_LOGIN}`,
      mt5Server: SERVER,
    },
  });

  blocked(result, R.IDENTITY_MISMATCH);
});

test("refuses when the accepted pages name a different login", async () => {
  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: "87654321",
      mt5Server: SERVER,
      brokerAccountId: "87654321",
    },
  });

  blocked(result, R.IDENTITY_MISMATCH);
});

test("refuses when the accepted pages name a different server", async () => {
  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: "another-server",
      brokerAccountId: LOGIN,
    },
  });

  blocked(result, R.IDENTITY_MISMATCH);
});

test("refuses a server that differs only by case or padding", async () => {
  const { result } = await adapted({
    server: "MetaTrader-Demo",
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: " metatrader-demo ",
      brokerAccountId: LOGIN,
    },
  });

  // Policy 3X-7D-A moved this refusal: the stored row carries padding, so it
  // is not already its own trimmed lowercase form and is refused for that
  // reason before any page is compared. What it still proves is the surviving
  // half of the old rule - nothing here folds the spelling into a match.
  blockedByExactly(result, R.IDENTITY_SERVER_NONCANONICAL);
});

// Policy 3X-7D-A. The stored server must already be canonical: raw text equal
// to its own trimmed lowercase form. The reason is the pipeline's own evidence
// chain - server/routes/mt5.js:765 trims and lowercases the server it forwards
// and verifyHistoryPage (:937-947) refuses any page whose identity is not that
// exact text - so a page naming any other spelling cannot be accepted at all.
// A catalog row in a different form therefore names an identity nothing can
// confirm, and the honest answer is a refusal that says so, not a silent
// rewrite of the account and not a loosened page comparison.
const NONCANONICAL_STORED_SERVERS = [
  "MetaTrader-Demo",
  "METATRADER-DEMO",
  " metatrader-demo ",
  "metatrader-demo ",
  "metatrader-demo\t",
];

test("refuses a stored server that is not already its own trimmed lowercase form", async () => {
  for (const spelling of NONCANONICAL_STORED_SERVERS) {
    const account = {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: spelling,
      brokerAccountId: LOGIN,
    };

    const { result } = await adapted({ account });

    blockedByExactly(result, R.IDENTITY_SERVER_NONCANONICAL);

    // Refusing an unusable identity is not the same as repairing one: the
    // caller's account row comes back exactly as it went in.
    assert.equal(account.mt5Server, spelling);
  }
});

test("accepts the canonical stored server and refuses only a genuinely different one", async () => {
  const canonical = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: "metatrader-demo",
      brokerAccountId: LOGIN,
    },
  });

  assert.equal(canonical.result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.equal(recordOf(canonical.result).mt5Server, SERVER);

  // A different server that is itself canonical is still the old mismatch:
  // the new reason must not swallow it.
  const different = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: "metatrader-live",
      brokerAccountId: LOGIN,
    },
  });

  blockedByExactly(different.result, R.IDENTITY_MISMATCH);
});

// Policy 3X-7C-1. The route lowercases the server it forwards and
// verifyHistoryPage refuses any page whose identity is not that exact text,
// and the bridge only answers when the terminal's own canonical identity
// matches it - so a page that reaches this module can only ever name the
// canonical lowercase server. A catalog row stored in any other spelling is
// therefore not a case variant to be folded away: it is an identity no page
// can confirm, and Phase 3X-7D-A names that reason specifically.
test("refuses a stored server identity the bridge can never report", async () => {
  const canonical = await adapted({ server: SERVER });

  assert.equal(canonical.result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.equal(recordOf(canonical.result).mt5Server, SERVER);

  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: "MetaTrader-Demo",
      brokerAccountId: LOGIN,
    },
  });

  blockedByExactly(result, R.IDENTITY_SERVER_NONCANONICAL);
});

test("refuses accepted pages that never name an identity", async () => {
  const scenario = await evidence();

  // The route answers 200 only after comparing the caller with the bridge
  // (server/routes/mt5.js:940-945), so a page without an identity can only
  // reach the adapter by hand; the adapter still refuses to attribute a
  // record to an account no page proved.
  const pages = scenario.pages.map((record) => ({
    ...record,
    page: { ...record.page, identity: null },
  }));

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    // The scan's own copy moves with them, so this stays a paired payload
    // and the refusal names the missing identity rather than the pairing.
    pages,
    outcome: { ...scenario.outcome, pages },
  });

  blocked(result, R.IDENTITY_INVALID);
});

test("refuses an account record without an explicit identity", async () => {
  const cases = [
    [{ id: null, mt5Login: LOGIN, mt5Server: SERVER }, R.MISSING_ACCOUNT_ID],
    [{ id: ACCOUNT_ID, mt5Login: null, mt5Server: SERVER }, R.MISSING_MT5_LOGIN],
    [{ id: ACCOUNT_ID, mt5Login: LOGIN, mt5Server: "" }, R.MISSING_MT5_SERVER],
    [{ id: ACCOUNT_ID, mt5Login: "abc", mt5Server: SERVER }, R.IDENTITY_INVALID],
    [
      { id: ACCOUNT_ID, mt5Login: "1".repeat(16), mt5Server: SERVER },
      R.IDENTITY_INVALID,
    ],
  ];

  for (const [account, code] of cases) {
    const { result } = await adapted({ account });

    blocked(result, code);
  }
});

test("refuses a broker account id that contradicts the login", async () => {
  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: SERVER,
      brokerAccountId: "99999999",
    },
  });

  blocked(result, R.BROKER_ACCOUNT_ID_CONFLICT);
});

test("refuses a broker account id that is not a login at all", async () => {
  const { result } = await adapted({
    account: {
      id: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: SERVER,
      brokerAccountId: "demo-1",
    },
  });

  blocked(result, R.IDENTITY_INVALID);
});

test("omits the broker account id when the account never recorded one", async () => {
  const { result } = await adapted({
    account: { id: ACCOUNT_ID, mt5Login: LOGIN, mt5Server: SERVER },
  });

  assert.equal("brokerAccountId" in recordOf(result), false);
});

// ============================================================
// 3. Scan safety gates: one failed check, zero records
// ============================================================

test("refuses an invalid scan outcome", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: {
      status: "invalid",
      code: "RECOVERY_FETCH_FAILED",
      retry: false,
      refusals: [],
      result: null,
    },
  });

  blocked(result, R.SCAN_NOT_SCANNED);
});

test("refuses a scanned outcome that carries no reconstruction result", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: { ...scenario.outcome, result: null },
  });

  blocked(result, R.RESULT_INVALID);
});

test("refuses a scan that still wants to be repeated", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: { ...scenario.outcome, retry: true },
  });

  blocked(result, R.SCAN_RETRY_REQUIRED);
});

test("refuses a scan that never reported whether to retry", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: {
      status: "scanned",
      refusals: [],
      result: scenario.outcome.result,
    },
  });

  blocked(result, R.SCAN_RETRY_REQUIRED);
});

test("refuses a scan with any window refusal", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: {
      ...scenario.outcome,
      refusals: [Object.freeze({ ...W0, code: "RECOVERY_FETCH_FAILED" })],
    },
  });

  blocked(result, R.SCAN_REFUSALS_PRESENT);
});

test("refuses a rejected page even when snapshot evidence looks complete", async () => {
  const scenario = await evidence();

  // A genuine scan cannot pair rejectedPages > 0 with
  // snapshotEvidenceIncomplete === false: mt5HistoryRecoveryScan.js:217-218
  // raises retry for any rejection, and a rejected record carries
  // page: null (scan.js:96-98), which assessRejectedEvidence reads as
  // unknown evidence. The fixture is hand-paired on purpose, so this test
  // proves the rejection gate stands on its own and does not lean on the
  // retry flag or on the snapshot flag beside it.
  const rejected = {
    accepted: false,
    page: historyPage([], [], W0, { mt5Login: LOGIN, mt5Server: SERVER }),
    code: "MT5_HISTORY_UNAVAILABLE",
  };

  const pages = [...scenario.pages, rejected];

  // Carried on the outcome as well. A scan that reports a refused window
  // hands over the refused record beside it; leaving the scan's own copy at
  // two pages would refuse an unpaired payload instead of testing whether
  // the rejection gate stands on its own.
  const outcome = {
    ...withScan(scenario.outcome, {
      acceptedPages: 2,
      rejectedPages: 1,
      snapshotEvidenceIncomplete: false,
    }),
    pages,
  };

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome,
    pages,
  });

  assert.equal(outcome.result.scan.snapshotEvidenceIncomplete, false);
  assert.equal(outcome.retry, false);
  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.BLOCKED);
  assert.deepEqual([...result.refusals], [R.REJECTED_PAGES_PRESENT]);
  assert.deepEqual([...result.records], []);
});

test("refuses incomplete live-snapshot evidence", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: withScan(scenario.outcome, {
      snapshotEvidenceIncomplete: true,
    }),
  });

  blocked(result, R.SNAPSHOT_EVIDENCE_INCOMPLETE);
});

test("refuses pages that span more than one bridge generation", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: withScan(scenario.outcome, { generationAmbiguous: true }),
  });

  blocked(result, R.SNAPSHOT_GENERATION_AMBIGUOUS);
});

test("refuses a live snapshot that cannot be ordered", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: withScan(scenario.outcome, { snapshotAmbiguous: true }),
  });

  blocked(result, R.SNAPSHOT_AMBIGUOUS);
});

test("refuses a scan that cannot name its live snapshot instant", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: withScan(scenario.outcome, { liveSnapshotToUtc: null }),
  });

  blocked(result, R.SNAPSHOT_TIMESTAMP_MISSING);
});

test("refuses pages that are not the pages the scan summarised", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    pages: [scenario.pages[0]],
  });

  blocked(result, R.PAGES_EVIDENCE_MISMATCH);
});

test("refuses a recovery that is not the recovery those pages produced", async () => {
  const dropped = await withoutRecord(await evidence(), 0);

  blocked(adaptRecoveryJournalRecords(dropped), R.RECOVERY_EVIDENCE_MISMATCH);

  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords({
      ...scenario,
      recovery: {
        ...scenario.recovery,
        unresolved: [
          ...scenario.recovery.unresolved,
          { positionId: "7777", reason: "STILL_OPEN", netVolume: "0.1", retryable: true },
        ],
      },
    }),
    R.RECOVERY_EVIDENCE_MISMATCH
  );
});

test("refuses a record for a position the scan never closed", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords({
      ...withRecord(scenario, { positionId: "9999" }),
    }),
    R.UNKNOWN_POSITION_EVIDENCE
  );
});

test("refuses a record whose ticket trail differs from the scan", async () => {
  const scenario = await evidence();
  const candidate = scenario.outcome.result.closed[0];

  const tampers = [
    { dealTickets: [candidate.dealTickets[0]] },
    { dealTickets: [...candidate.dealTickets].reverse() },
    { openingTickets: [candidate.closingTickets[0]] },
    { closingTickets: [candidate.openingTickets[0]] },
  ];

  for (const overrides of tampers) {
    blocked(
      adaptRecoveryJournalRecords({ ...withRecord(scenario, overrides) }),
      R.TICKET_EVIDENCE_MISMATCH
    );
  }
});

test("refuses a record proved against a different snapshot than the scan", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords({
      ...withRecord(scenario, { liveSnapshotToUtc: "2026-01-20T00:00:00Z" }),
    }),
    R.CANDIDATE_SNAPSHOT_MISMATCH
  );

  blocked(
    adaptRecoveryJournalRecords({
      ...withRecord(scenario, { liveSnapshotToUtc: null }),
    }),
    R.CANDIDATE_SNAPSHOT_MISMATCH
  );
});

test("refuses any outcome that claims complete history coverage", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords({
      ...scenario,
      outcome: withScan(scenario.outcome, { coverageComplete: true }),
    }),
    R.COVERAGE_CLAIMED
  );
});

test("treats coverageComplete false as honest provenance, not a failure", async () => {
  const { scenario, result } = await adapted();

  assert.equal(scenario.outcome.result.scan.coverageComplete, false);
  assert.equal(result.records.length, 1);
  assert.deepEqual([...result.refusals], []);
});

test("collects every failed gate instead of stopping at the first", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: withScan(
      { ...scenario.outcome, retry: true, refusals: [{ ...W0, code: "X" }] },
      { generationAmbiguous: true, snapshotAmbiguous: true, rejectedPages: 1 }
    ),
    pages: [...scenario.pages, { accepted: false, page: null, code: "X" }],
  });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.BLOCKED);

  for (const code of [
    R.SCAN_RETRY_REQUIRED,
    R.SCAN_REFUSALS_PRESENT,
    R.SNAPSHOT_GENERATION_AMBIGUOUS,
    R.SNAPSHOT_AMBIGUOUS,
    R.REJECTED_PAGES_PRESENT,
  ]) {
    assert.ok(result.refusals.includes(code), `missing refusal ${code}`);
  }

  assert.equal(result.records.length, 0);
});

// ============================================================
// 4. Evidence the reconstruction or the mapper refused is never journaled
// ============================================================

test("keeps a position with unreadable amounts out of the records", async () => {
  const broken = CLEAN_LIFECYCLE();

  // A second finished position whose reported profit is not decimal text.
  broken.push(
    openDeal("9002", "0.2", OPEN_MSC + 1_000),
    closeDeal("9002", "0.2", CLOSE_MSC + 1_000, { profit: 2.5 })
  );

  const { scenario, result } = await adapted({ first: broken });

  assert.equal(scenario.outcome.result.closed.length, 2);
  assert.equal(result.records.length, 1);
  assert.equal(recordOf(result).positionId, "9001");
  assert.equal(solo(result.rejected, "rejection").reason, R.DEAL_EVIDENCE_REFUSED);
  assert.equal(
    solo(result.rejected, "rejection").evidenceReason,
    "DEAL_MONEY_INVALID"
  );
  assert.equal(result.remaining.unassignedCount, 1);
});

test("keeps an unresolved position out of the records", async () => {
  const withOpen = [...CLEAN_LIFECYCLE(), openDeal("9003", "0.1", OPEN_MSC)];

  const { scenario, result } = await adapted({ first: withOpen });

  assert.equal(scenario.outcome.result.unresolved.length, 1);
  assert.equal(recordOf(result).positionId, "9001");
  assert.equal(solo(result.rejected, "rejection").reason, R.POSITION_UNRESOLVED);
  assert.equal(
    solo(result.rejected, "rejection").evidenceReason,
    "VOLUME_NOT_FLAT"
  );
  assert.equal(result.remaining.unresolvedCount, 1);
});

test("refuses a record without a position id", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { positionId: null }),
  });

  assert.equal(solo(result.rejected, "rejection").reason, R.MISSING_POSITION_ID);
  assert.deepEqual([...result.records], []);
});

test("refuses a record without a deal-ticket trail", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { dealTickets: [] }),
  });

  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.rejected, "rejection").reason, R.TICKET_EVIDENCE_MISSING);
});

test("refuses a record whose closure predates its opening", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { closedAtMsc: OPEN_MSC - 1_000 }),
  });

  assert.deepEqual([...result.records], []);
  assert.equal(
    solo(result.rejected, "rejection").reason,
    R.LIFECYCLE_TIME_ORDER_INVALID
  );
});

test("refuses a record without a reconstructed total", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { reconstructedNetPnl: null }),
  });

  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.rejected, "rejection").reason, R.RECOVERY_TOTAL_INVALID);
});

test("refuses a total that is not exact broker decimal text", async () => {
  const scenario = await evidence();

  for (const total of [0.18, "", " 0.18", "abc", "1e-1", "0.18\n", "00.18", "+0.18", ".18", "0.18e0"]) {
    const result = adaptRecoveryJournalRecords({
      ...withRecord(scenario, { reconstructedNetPnl: total }),
    });

    assert.deepEqual([...result.records], []);
    assert.equal(
      solo(result.rejected, "rejection").reason,
      R.RECOVERY_TOTAL_INVALID,
      `total ${JSON.stringify(total)} was refused with the wrong reason`
    );
  }
});

test("never substitutes zero for a missing total", async () => {
  const scenario = await evidence();

  const missing = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { reconstructedNetPnl: undefined }),
  });

  assert.deepEqual([...missing.records], []);

  const rejection = solo(missing.rejected, "rejection");

  assert.equal(rejection.reason, R.RECOVERY_TOTAL_INVALID);
  assert.equal(missing.remaining.refusedCount, 1);

  // A refusal carries no amount of any kind: nothing downstream can read a
  // dropped total as a flat zero.
  for (const field of [
    "pnl",
    "netProfit",
    "netPnL",
    "realizedPnL",
    "reconstructedNetPnl",
    "recoveryComponents",
    "profit",
    "commission",
    "swap",
    "fee",
  ]) {
    assert.equal(field in rejection, false, `a refusal published ${field}`);
  }
});

test("refuses a record without a symbol or side", async () => {
  const scenario = await evidence();

  const noSymbol = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { symbol: "" }),
  });

  const noSide = adaptRecoveryJournalRecords({
    ...withRecord(scenario, { side: "up" }),
  });

  assert.equal(solo(noSymbol.rejected, "rejection").reason, R.MISSING_SYMBOL);
  assert.deepEqual([...noSymbol.records], []);
  assert.equal(solo(noSide.rejected, "rejection").reason, R.SIDE_INVALID);
  assert.deepEqual([...noSide.records], []);
});

test("refuses a record whose traded volume is not a positive decimal", async () => {
  const scenario = await evidence();

  for (const volume of [0.1, "0", "-0.1", "0.1.0", ""]) {
    const result = adaptRecoveryJournalRecords({
      ...withRecord(scenario, { volume }),
    });

    assert.deepEqual([...result.records], []);
    assert.equal(
      solo(result.rejected, "rejection").reason,
      R.VOLUME_INVALID,
      `volume ${JSON.stringify(volume)} was refused with the wrong reason`
    );
  }
});

test("refuses input that is not a scan, a page set and a recovery", async () => {
  const scenario = await evidence();

  const refusalsOf = (overrides) =>
    adaptRecoveryJournalRecords({ ...scenario, ...overrides }).refusals;

  assert.equal(solo(refusalsOf({ pages: null }), "refusal"), R.PAGES_INVALID);
  assert.equal(solo(refusalsOf({ recovery: null }), "refusal"), R.RECOVERY_INVALID);
  assert.equal(
    solo(refusalsOf({ recovery: { ...scenario.recovery, recovered: null } }), "refusal"),
    R.RECOVERY_INVALID
  );
  blocked(adaptRecoveryJournalRecords({ ...scenario, account: null }), R.ACCOUNT_INVALID);
  blocked(
    adaptRecoveryJournalRecords({ ...scenario, existingJournal: null }),
    R.EXISTING_JOURNAL_INVALID
  );
  blocked(
    adaptRecoveryJournalRecords({ ...scenario, existingJournal: [null] }),
    R.EXISTING_JOURNAL_INVALID
  );
  blocked(adaptRecoveryJournalRecords({}), R.SCAN_NOT_SCANNED);
});

// ============================================================
// 5. Idempotency: skip, never merge
// ============================================================

test("skips a record whose account-scoped id is already journaled", async () => {
  const first = await adapted();

  const second = await adapted({
    existingJournal: [...first.result.records],
  });

  assert.deepEqual([...second.result.records], []);
  assert.equal(solo(second.result.skipped, "skip").reason, R.ALREADY_JOURNALED_ID);
  assert.equal(solo(second.result.skipped, "skip").id, `mt5-position-${LOGIN}-9001`);
});

// Policy 3X-7D-B, at the preview stage. The journal the caller hands this
// module is one array, and the writer that would consume the proposal dedupes
// on String(id) alone across every account, so an id another account already
// holds is not free. The preview says so with its own reason instead of
// proposing a record the commit planner will refuse — the two stages must not
// give contradictory answers to the same journal.
test("skips a record whose id is journaled under another account", async () => {
  const held = {
    id: `mt5-position-${LOGIN}-9001`,
    accountId: "other-account",
    brokerPositionId: "7777",
    notes: "another account's own words",
  };

  const { result } = await adapted({ existingJournal: [held] });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped, "skip").reason, R.ALREADY_JOURNALED_ID_ELSEWHERE);
  assert.equal(solo(result.skipped, "skip").id, held.id);
  assert.equal(solo(result.skipped, "skip").accountId, ACCOUNT_ID);

  // A skip is a refusal to propose, never a repair: the row that was already
  // in the journal comes back exactly as it went in.
  assert.strictEqual(result.skipped.length, 1);
  assert.equal(held.notes, "another account's own words");
  assert.equal(held.accountId, "other-account");
});

test("keeps the account-scoped id skip when both accounts hold the id", async () => {
  const collided = `mt5-position-${LOGIN}-9001`;

  const { result } = await adapted({
    existingJournal: [
      { id: collided, accountId: "other-account", brokerPositionId: "7777" },
      { id: collided, accountId: ACCOUNT_ID, brokerPositionId: "9001" },
    ],
  });

  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped, "skip").reason, R.ALREADY_JOURNALED_ID);
});

test("skips a position already journaled by the live path under another id", async () => {
  const live = {
    id: "9001",
    accountId: ACCOUNT_ID,
    broker: "MT5",
    brokerPositionId: "9001",
    notes: "written by the live close path",
  };

  const { result } = await adapted({ existingJournal: [live] });

  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped, "skip").reason, R.ALREADY_JOURNALED_POSITION);
});

test("accepts a live record whose broker position id is a number", async () => {
  const { result } = await adapted({
    existingJournal: [
      { id: "9001", accountId: ACCOUNT_ID, brokerPositionId: 9001 },
    ],
  });

  assert.equal(solo(result.skipped, "skip").reason, R.ALREADY_JOURNALED_POSITION);
});

test("does not treat another account's same position number as a duplicate", async () => {
  const { result } = await adapted({
    existingJournal: [
      {
        // Its own recovered id, built from its own login: only the broker
        // position number is shared, which is exactly the case two accounts
        // can legitimately repeat.
        id: "mt5-position-87654321-9001",
        accountId: "other-account",
        brokerPositionId: "9001",
      },
    ],
  });

  assert.deepEqual([...result.skipped], []);
  assert.equal(recordOf(result).accountId, ACCOUNT_ID);
});

test("does not treat an unattributed legacy trade as this account's copy", async () => {
  const { result } = await adapted({
    existingJournal: [{ id: "legacy-1", brokerPositionId: "9001" }],
  });

  assert.deepEqual([...result.skipped], []);
  assert.equal(result.records.length, 1);
});

test("does not treat another broker's same position number as a duplicate", async () => {
  const { result } = await adapted({
    existingJournal: [
      {
        id: "ct-1",
        accountId: ACCOUNT_ID,
        broker: "cTrader",
        brokerPositionId: "9001",
      },
    ],
  });

  assert.deepEqual([...result.skipped], []);
  assert.equal(result.records.length, 1);
});

test("leaves every existing journal entry byte-for-byte unchanged", async () => {
  const edited = {
    id: "journal-42",
    accountId: ACCOUNT_ID,
    brokerPositionId: "9001",
    pnl: 999,
    notes: "the user's own words",
    tags: ["manual-review"],
  };

  const before = JSON.stringify(edited);
  const beforeList = JSON.stringify([edited]);

  const scenario = await evidence();

  scenario.existingJournal = [edited];

  const result = adaptRecoveryJournalRecords(scenario);

  assert.equal(JSON.stringify(scenario.existingJournal), beforeList);
  assert.equal(JSON.stringify(edited), before);
  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped, "skip").reason, R.ALREADY_JOURNALED_POSITION);
});

test("re-running over its own output proposes nothing new", async () => {
  const scenario = await evidence();

  const runOne = adaptRecoveryJournalRecords(scenario);

  assert.equal(runOne.records.length, 1);

  const runTwo = adaptRecoveryJournalRecords({
    ...scenario,
    existingJournal: [...scenario.existingJournal, ...runOne.records],
  });

  assert.deepEqual([...runTwo.records], []);
  assert.equal(runTwo.skipped.length, 1);
});

test("proposes both positions of a clean two-position recovery", async () => {
  const rows = [
    ...CLEAN_LIFECYCLE(),
    openDeal("9002", "0.3", OPEN_MSC + 500, { commission: "-1" }),
    closeDeal("9002", "0.3", CLOSE_MSC + 500, { profit: "1.4" }),
  ];

  const { result } = await adapted({ first: rows });

  assert.equal(result.records.length, 2);
  assert.deepEqual(
    result.records.map((record) => record.id),
    [`mt5-position-${LOGIN}-9001`, `mt5-position-${LOGIN}-9002`]
  );
});

test("skips only the position already journaled in a two-position recovery", async () => {
  const rows = [
    ...CLEAN_LIFECYCLE(),
    openDeal("9002", "0.3", OPEN_MSC + 500, { commission: "-1" }),
    closeDeal("9002", "0.3", CLOSE_MSC + 500, { profit: "1.4" }),
  ];

  const { result } = await adapted({
    first: rows,
    existingJournal: [{ id: `mt5-position-${LOGIN}-9001`, accountId: ACCOUNT_ID }],
  });

  assert.deepEqual(
    result.records.map((record) => record.id),
    [`mt5-position-${LOGIN}-9002`]
  );
  assert.equal(solo(result.skipped, "skip").id, `mt5-position-${LOGIN}-9001`);
});

// ============================================================
// 6. Evidence binding: a record has to match the candidate and the
//    accepted deal rows handed over in the same call
//
// Every forgery below is internally consistent — the trail names real
// tickets, the timestamps are ordered, the components add up to the
// total — so only a comparison against the scan's candidate and the
// broker's own rows can catch it.
// ============================================================

test("refuses a symbol the candidate never reported", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withRecord(scenario, { symbol: "GBPUSD" })),
    R.CANDIDATE_SYMBOL_MISMATCH
  );
});

test("refuses a side the candidate never reported", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withRecord(scenario, { side: "sell" })),
    R.CANDIDATE_SIDE_MISMATCH
  );
});

test("refuses an opening instant the candidate does not name", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withRecord(scenario, { openedAtMsc: OPEN_MSC - 60_000 })),
    R.CANDIDATE_LIFECYCLE_MISMATCH
  );
});

test("refuses a closing instant the candidate does not name", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withRecord(scenario, { closedAtMsc: CLOSE_MSC + 60_000 })),
    R.CANDIDATE_LIFECYCLE_MISMATCH
  );
});

test("refuses a record proved against a snapshot the candidate does not name", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withCandidate(scenario, { liveSnapshotToUtc: W1.toUtc })),
    R.CANDIDATE_SNAPSHOT_MISMATCH
  );
});

test("refuses a candidate whose deal count disagrees with its own trail", async () => {
  const scenario = await evidence();

  assert.equal(scenario.outcome.result.closed[0].dealTickets.length, 2);

  blocked(
    adaptRecoveryJournalRecords(withCandidate(scenario, { dealCount: 3 })),
    R.CANDIDATE_DEAL_COUNT_MISMATCH
  );
});

test("refuses money that agrees with itself but not with the accepted deal rows", async () => {
  const scenario = await evidence();

  const forged = {
    profit: "2",
    commission: "-0.7",
    swap: "-0.12",
    fee: "0",
    reconstructedNetPnl: "1.18",
  };

  assert.equal(
    sumDecimalTexts([forged.profit, forged.commission, forged.swap, forged.fee]).total,
    forged.reconstructedNetPnl,
    "the forgery must stay internally consistent to prove the external check"
  );

  blocked(
    adaptRecoveryJournalRecords(withRecord(scenario, forged)),
    R.DEAL_MONEY_EVIDENCE_MISMATCH
  );
});

test("refuses a component the accepted deal rows do not report digit for digit", async () => {
  const scenario = await evidence();

  const record = scenario.recovery.recovered[0];

  assert.equal(record.commission, "-0.7");

  blocked(
    adaptRecoveryJournalRecords(
      withRecord(scenario, { commission: "-0.70", reconstructedNetPnl: record.reconstructedNetPnl })
    ),
    R.DEAL_MONEY_EVIDENCE_MISMATCH
  );
});

test("refuses a volume the opening deal rows do not add up to", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withRecord(scenario, { volume: "0.2" })),
    R.DEAL_VOLUME_MISMATCH
  );
});

test("refuses a record whose deal tickets are not on the accepted pages handed over", async () => {
  const scenario = await evidence();

  const openerOnly = scenario.pages[0].page.history.slice(0, 1);

  blocked(
    adaptRecoveryJournalRecords(withPages(scenario, 0, { history: openerOnly })),
    R.DEAL_ROW_MISSING
  );
});

test("refuses a deal row the accepted pages report twice with different money", async () => {
  const scenario = await evidence();

  const closer = scenario.pages[0].page.history[1];

  blocked(
    adaptRecoveryJournalRecords(
      withPages(scenario, 1, { history: [{ ...closer, profit: "5" }] })
    ),
    R.DEAL_ROW_CONFLICT
  );
});

test("refuses money that cannot be summed from the accepted deal rows", async () => {
  const scenario = await evidence();

  const opener = scenario.pages[0].page.history[0];

  blocked(
    adaptRecoveryJournalRecords(
      withPages(scenario, 0, {
        history: [{ ...opener, profit: 2.5 }, scenario.pages[0].page.history[1]],
      })
    ),
    R.DEAL_ROW_MALFORMED
  );
});

test("refuses an accepted page whose history is not a list of rows", async () => {
  const scenario = await evidence();

  blocked(
    adaptRecoveryJournalRecords(withPages(scenario, 0, { history: null })),
    R.DEAL_ROW_MISSING
  );
});

test("refuses an opening deal the accepted pages never reported", async () => {
  const scenario = await evidence();

  // Both sides name a ticket no page reported, so the trails agree with
  // each other and only the rows can expose it.
  const ghost = { openingTickets: ["777001"] };

  blocked(
    adaptRecoveryJournalRecords({
      ...withRecord(scenario, ghost),
      outcome: withCandidate(scenario, ghost).outcome,
    }),
    R.DEAL_ROW_MISSING
  );
});

test("refuses rows that belong to a different position than the record claims", async () => {
  const scenario = await evidence();

  // Candidate and record agree with each other and name no row the pages
  // did not report; only the rows themselves say this is not position 9005.
  const renamed = { positionId: "9005" };

  blocked(
    adaptRecoveryJournalRecords({
      ...withRecord(scenario, renamed),
      outcome: withCandidate(scenario, renamed).outcome,
    }),
    R.DEAL_ROW_POSITION_MISMATCH
  );
});

test("one record whose evidence cannot be tied blocks every record of the run", async () => {
  const rows = [
    ...CLEAN_LIFECYCLE(),
    openDeal("9002", "0.3", OPEN_MSC + 500, { commission: "-1" }),
    closeDeal("9002", "0.3", CLOSE_MSC + 500, { profit: "1.4" }),
  ];

  const scenario = await evidence({ first: rows });

  assert.equal(scenario.recovery.recovered.length, 2);

  const result = adaptRecoveryJournalRecords(withRecord(scenario, { symbol: "GBPUSD" }, 1));

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.BLOCKED);
  assert.ok(result.refusals.includes(R.CANDIDATE_SYMBOL_MISMATCH));
  assert.deepEqual([...result.records], []);
  assert.deepEqual([...result.skipped], []);
  assert.deepEqual([...result.rejected], []);
});

// ============================================================
// 7. Lifecycle evidence: the candidate's instants, symbol and side are
//    conclusions drawn from the reported rows, so the rows have to say
//    the same thing
//
//    reconstruction.js sorts each position's deals by (time_msc, ticket)
//    (:528 with compareDeals :242-246), takes openedAtMsc from the first
//    deal (:748, :850), closedAtMsc from the last closing deal (:851),
//    side from the first deal's type (:775, :849) and symbol from the
//    group's rows (:467-469, :848). dealTickets, openingTickets and
//    closingTickets keep that sorted order and the trail comparison above
//    is index-by-index, so the row behind a named ticket is exactly the
//    row the conclusion was drawn from — which makes equality the only
//    honest test, and a row that says otherwise evidence the payload was
//    not the one the gates were checked on.
// ============================================================

test("refuses an opening instant the reported opening deal does not name", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withRow(scenario, 0, { time_msc: OPEN_MSC + 60_000 })),
    R.DEAL_OPEN_TIME_MISMATCH
  );
});

test("refuses a closing instant the reported closing deal does not name", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withRow(scenario, 1, { time_msc: CLOSE_MSC + 60_000 })),
    R.DEAL_CLOSE_TIME_MISMATCH
  );
});

test("refuses a symbol the opening deal does not report", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withRow(scenario, 0, { symbol: "GBPUSD" })),
    R.DEAL_ROW_SYMBOL_MISMATCH
  );
});

test("refuses a symbol a closing deal contradicts", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withRow(scenario, 1, { symbol: "USDJPY" })),
    R.DEAL_ROW_SYMBOL_MISMATCH
  );
});

test("refuses a side the opening deal's reported type contradicts", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withRow(scenario, 0, { type: 1 })),
    R.DEAL_OPEN_TYPE_MISMATCH
  );
});

test("refuses an opening deal the reported rows do not call an entry", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withRow(scenario, 0, { entry: 1 })),
    R.DEAL_OPEN_ENTRY_MISMATCH
  );
});

test("binds a partial close to its final closing deal, not its first", async () => {
  const rows = [
    openDeal("9004", "0.3", OPEN_MSC),
    closeDeal("9004", "0.1", OPEN_MSC + 3_600_000, { profit: "0.2" }),
    closeDeal("9004", "0.2", CLOSE_MSC, { profit: "0.4" }),
  ];

  const { result } = await adapted({ first: rows });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.refusals], []);

  const record = solo(result.records, "record");

  assert.equal(record.volume, "0.3");
  assert.equal(record.closedAtMsc, CLOSE_MSC);
});

test("binds a sell position to its own rows without a refusal", async () => {
  const rows = [
    openDeal("9003", "0.2", OPEN_MSC, { type: 1 }),
    closeDeal("9003", "0.2", CLOSE_MSC, { type: 0, profit: "0.6" }),
  ];

  const { result } = await adapted({ first: rows });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.refusals], []);
  assert.equal(solo(result.records, "record").side, "sell");
});

// ============================================================
// 8. Scan pairing: the pages in hand have to be the pages this scan
//    consumed, and the scan has to say which ones those were
//
//    Sections 6 and 7 prove a page set is internally consistent with its
//    own candidate. None of that proves the set came from the scan whose
//    retry, snapshot and coverage flags were just gated — a second scan of
//    the same account produces pages of exactly the same shape, and before
//    the scan carried its own records the caller was the only thing holding
//    the two together.
//
//    Refusing zero accepted pages belongs here too. "Nothing was read" and
//    "everything was read and nothing closed" produce the same empty
//    `closed` list, and only the page evidence tells them apart: the honest
//    empty case still proposes with no refusal at all, in section 1.
// ============================================================

test("refuses the page evidence of a different scan of the same account", async () => {
  const first = await evidence();
  const other = await evidence();

  assert.equal(other.pages.length, first.pages.length);
  assert.notEqual(other.pages[0].page.history[0].ticket, first.pages[0].page.history[0].ticket);

  blockedByExactly(
    adaptRecoveryJournalRecords({ ...first, pages: other.pages }),
    R.PAGES_NOT_SCAN_EVIDENCE
  );
});

test("refuses a page set that differs from the scan's own evidence in one deal row", async () => {
  const scenario = await evidence();

  const forged = JSON.parse(JSON.stringify(scenario.pages));

  forged[0].page.history[0].volume = "0.2";

  blockedByExactly(
    adaptRecoveryJournalRecords({ ...scenario, pages: forged }),
    R.PAGES_NOT_SCAN_EVIDENCE
  );
});

test("refuses an outcome that carries no page evidence", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withOutcome(scenario, { pages: undefined })),
    R.SCAN_EVIDENCE_MISSING
  );
});

test("refuses an outcome that cannot name the identity it requested", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withOutcome(scenario, { identity: null })),
    R.SCAN_EVIDENCE_MISSING
  );
});

test("refuses pages that answer to a different identity than the scan requested", async () => {
  const scenario = await evidence();

  const outcome = {
    ...scenario.outcome,
    identity: { mt5Login: "99999999", mt5Server: SERVER },
  };

  blockedByExactly(
    adaptRecoveryJournalRecords({ ...scenario, outcome, pages: outcome.pages }),
    R.SCAN_IDENTITY_MISMATCH
  );
});

test("refuses a scan whose every page was refused instead of proposing nothing", async () => {
  const outcome = await runHistoryRecoveryScan({
    apiUrl: API_URL,
    identity: { mt5Login: LOGIN, mt5Server: SERVER },
    windows: [W1, W2],
    fetchImpl: async () => {
      throw new TypeError("failed to fetch");
    },
  });

  assert.equal(outcome.result.scan.acceptedPages, 0);

  const result = adaptRecoveryJournalRecords({
    outcome,
    pages: outcome.pages,
    recovery: buildRecoveryJournalRecords({ result: outcome.result, pages: outcome.pages }),
    account: { id: ACCOUNT_ID, mt5Login: LOGIN, mt5Server: SERVER, brokerAccountId: LOGIN },
    existingJournal: [],
  });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.BLOCKED);
  assert.ok(
    result.refusals.includes(R.NO_ACCEPTED_PAGE_EVIDENCE),
    JSON.stringify(result.refusals)
  );
  assert.deepEqual([...result.records], []);
  assert.deepEqual([...result.skipped], []);
});

test("treats the scan's own evidence reloaded from storage as the same evidence", async () => {
  const scenario = await evidence();

  const reloaded = JSON.parse(JSON.stringify(scenario));

  const result = adaptRecoveryJournalRecords({
    ...scenario,
    outcome: reloaded.outcome,
    pages: reloaded.pages,
    recovery: reloaded.recovery,
  });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.refusals], []);
  assert.equal(result.records.length, 1);
});

// ============================================================
// 9. One source of evidence
//
//    Sections 6-8 prove every published field against the candidate and the
//    broker's own rows, and Section 8 proves the pages belong to the scan.
//    None of it proves the record *list* is the one this evidence produces:
//    RECOVERY_EVIDENCE_MISMATCH compares lengths, so a payload may name the
//    right number of positions and still not be this scan's recovery.
//
//    Both producers are pure functions of the same inputs — the mapper of
//    {result, pages}, the reconstruction of pages alone — so the adapter can
//    run them again and compare, instead of trusting a caller to hand back
//    what it was given. That also lets a caller pass the scan outcome alone
//    rather than carrying independent copies of its evidence.
// ============================================================

test("adapts a scan outcome handed over with no independent copies", async () => {
  const scenario = await evidence();

  const result = adaptRecoveryJournalRecords({
    outcome: scenario.outcome,
    account: scenario.account,
    existingJournal: [],
  });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...result.refusals], []);
  assert.equal(result.records.length, 1);
  assert.deepEqual(
    [...result.records],
    [...adaptRecoveryJournalRecords(scenario).records]
  );
});

test("adapts a reloaded scan outcome with no independent copies", async () => {
  const reloaded = JSON.parse(JSON.stringify(await evidence()));

  const result = adaptRecoveryJournalRecords({
    outcome: reloaded.outcome,
    account: reloaded.account,
    existingJournal: [],
  });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.equal(result.records.length, 1);
  assert.equal(recordOf(result).positionId, "9001");
});

test("derives both records of a two-position recovery from the outcome alone", async () => {
  const scenario = await evidence({ first: TWO_POSITIONS() });

  const result = adaptRecoveryJournalRecords({
    outcome: scenario.outcome,
    account: scenario.account,
    existingJournal: [],
  });

  assert.deepEqual(
    result.records.map((record) => record.id),
    [`mt5-position-${LOGIN}-9001`, `mt5-position-${LOGIN}-9002`]
  );
});

test("refuses a recovery that offers one position twice while the scan closed two", async () => {
  const scenario = await evidence({ first: TWO_POSITIONS() });
  const first = scenario.recovery.recovered[0];

  assert.equal(first.positionId, "9001");
  assert.equal(scenario.recovery.recovered.length, 2);

  const doubled = withRecovered(scenario, [first, first]);

  // The right number of records, each well formed, each tying to a real
  // candidate and its rows: only the set itself says the second closed
  // position is missing. Before this gate the run proposed two records with
  // the same id, which is a duplicate trade, not a recovery.
  blockedByExactly(
    adaptRecoveryJournalRecords(doubled),
    R.RECOVERY_NOT_SCAN_EVIDENCE
  );
});

test("refuses a mapped record the scan's own evidence does not produce", async () => {
  const scenario = await evidence();

  // netVolume is a conclusion the reconstruction drew and the journal never
  // reads, so every binding above passes on a record that carries a different
  // one than these pages produce.
  blockedByExactly(
    adaptRecoveryJournalRecords(withRecord(scenario, { netVolume: "0.2" })),
    R.RECOVERY_NOT_SCAN_EVIDENCE
  );
});

test("refuses a stale recovery rebuilt around a candidate the pages contradict", async () => {
  const scenario = await evidence();

  blockedByExactly(
    adaptRecoveryJournalRecords(withCandidate(scenario, { netVolume: "0.2" })),
    R.RECOVERY_NOT_SCAN_EVIDENCE
  );
});

test("refuses candidates the scan's pages do not reconstruct to", async () => {
  const scenario = await evidence();
  const forged = withCandidate(scenario, { netVolume: "0.2" });

  // Nothing supplied to compare against: the adapter derives its own records
  // from this outcome, so only re-running the reconstruction over the paired
  // pages can say this candidate was never proved from them.
  blockedByExactly(
    adaptRecoveryJournalRecords({
      outcome: forged.outcome,
      account: scenario.account,
      existingJournal: [],
    }),
    R.RESULT_NOT_SCAN_EVIDENCE
  );
});

test("refuses an unresolved list that is not this scan's", async () => {
  const scenario = await evidence({ first: WITH_UNRESOLVED() });

  assert.equal(solo(scenario.recovery.unresolved, "unresolved").reason, "VOLUME_NOT_FLAT");

  blockedByExactly(
    adaptRecoveryJournalRecords(withUnresolved(scenario, 0, { reason: "STILL_OPEN" })),
    R.RECOVERY_NOT_SCAN_EVIDENCE
  );
});

test("refuses an unassigned list that is not this scan's", async () => {
  const scenario = await evidence({ first: WITH_UNASSIGNED() });

  assert.equal(
    solo(scenario.recovery.unassigned, "unassigned").reason,
    "DEAL_MONEY_INVALID"
  );

  blockedByExactly(
    adaptRecoveryJournalRecords(withUnassigned(scenario, 0, { reason: "ALREADY_JOURNALED" })),
    R.RECOVERY_NOT_SCAN_EVIDENCE
  );
});

test("proposes the honest unresolved and unassigned lists it was derived from", async () => {
  const withUnresolvedList = await evidence({ first: WITH_UNRESOLVED() });
  const withUnassignedList = await evidence({ first: WITH_UNASSIGNED() });

  for (const scenario of [withUnresolvedList, withUnassignedList]) {
    const derived = adaptRecoveryJournalRecords({
      outcome: scenario.outcome,
      account: scenario.account,
      existingJournal: [],
    });

    assert.equal(derived.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
    assert.deepEqual([...derived.refusals], []);
    assert.equal(derived.rejected.length, 1);
    assert.equal(derived.records.length, 1);
    assert.equal(
      solo(derived.rejected, "rejection").evidenceReason,
      solo(
        adaptRecoveryJournalRecords(scenario).rejected,
        "rejection"
      ).evidenceReason
    );
  }
});

// ============================================================
// 10. The journal's own hands on a published record
//
//    Sections 1-9 prove what the adapter puts into a record. None of them
//    proves what the record becomes afterwards: every saved trade is passed
//    through normalizeJournalTrade when localStorage is read
//    (src/context/JournalContext.jsx loadSavedTrades) and again on every
//    update, so a recovered trade's unknowns and its broker symbol are
//    re-derived each time the app opens. The normalizer answered "the broker
//    never said" with 0, and the discipline panel counts any stopLoss that is
//    not undefined/null/"" as risk management
//    (src/components/dashboard/Discipline/DisciplineBreakdown.jsx:81-83), so a
//    zero-filled recovered trade is scored as protected by a stop loss at
//    price 0. normalizeSymbol also strips the broker's ".pro" suffix.
//
//    These tests put the real adapter output, not a hand-written stand-in,
//    through one localStorage round-trip and the real normalizer, so a record
//    shape that drifts from the compatibility is caught here.
// ============================================================

const UNREPORTED_PRICES = ["entryPrice", "exitPrice", "stopLoss", "takeProfit"];
const UNREPORTED_RISK = ["rr", "riskReward", "riskRewardRatio"];

// The same clean lifecycle under a symbol that carries a broker suffix: the
// deals are what price a position, so the suffix is the only new fact.
const SUFIXED_LIFECYCLE = () => [
  openDeal("9001", "0.1", OPEN_MSC, { symbol: "EURUSD.pro" }),
  closeDeal("9001", "0.1", CLOSE_MSC, {
    symbol: "EURUSD.pro",
    profit: "1",
    swap: "-0.12",
  }),
];

const reload = (trade) => JSON.parse(JSON.stringify(trade));

test("publishes no price or risk/reward field for a position the deals never priced", async () => {
  const { result } = await adapted({ first: SUFIXED_LIFECYCLE() });

  const record = recordOf(result);

  for (const field of [...UNREPORTED_PRICES, ...UNREPORTED_RISK]) {
    assert.equal(record[field], undefined, `${field} was published`);
  }
});

test("leaves a saved recovered trade's unreported prices unknown", async () => {
  const { result } = await adapted({ first: SUFIXED_LIFECYCLE() });

  const normalized = normalizeJournalTrade(reload(recordOf(result)));

  for (const field of UNREPORTED_PRICES) {
    assert.equal(
      normalized[field],
      null,
      `${field} became ${JSON.stringify(normalized[field])} for a value the broker never reported`
    );
  }
});

test("leaves a saved recovered trade's unreported risk/reward unknown", async () => {
  const { result } = await adapted({ first: SUFIXED_LIFECYCLE() });

  const normalized = normalizeJournalTrade(reload(recordOf(result)));

  for (const field of UNREPORTED_RISK) {
    assert.equal(
      normalized[field],
      null,
      `${field} claimed ${JSON.stringify(normalized[field])} for a trade with no stop loss and no take profit`
    );
  }
});

test("does not score a saved recovered trade as stop-loss protected", async () => {
  const { result } = await adapted({ first: SUFIXED_LIFECYCLE() });

  const { stopLoss } = normalizeJournalTrade(reload(recordOf(result)));

  assert.equal(
    stopLoss !== undefined && stopLoss !== null && stopLoss !== "",
    false,
    `stop loss read as ${JSON.stringify(stopLoss)}`
  );
});

test("keeps a saved recovered trade's broker symbol exactly", async () => {
  const { result } = await adapted({ first: SUFIXED_LIFECYCLE() });

  const normalized = normalizeJournalTrade(reload(recordOf(result)));

  assert.equal(normalized.symbol, "EURUSD.pro");
  assert.equal(normalized.pair, "EURUSD.pro");
});

test("keeps a saved recovered trade's money and provenance exact", async () => {
  const { result } = await adapted();

  const record = recordOf(result);
  const normalized = normalizeJournalTrade(reload(record));

  assert.equal(normalized.id, record.id);
  assert.equal(normalized.accountId, ACCOUNT_ID);
  assert.equal(normalized.mt5Login, LOGIN);
  assert.equal(normalized.mt5Server, SERVER);
  assert.equal(normalized.positionId, "9001");
  assert.equal(normalized.source, "history-recovery");
  assert.equal(normalized.broker, "MT5");
  assert.equal(normalized.direction, "Buy");
  assert.equal(normalized.result, "Win");
  assert.equal(normalized.pnl, 0.18);
  assert.equal(normalized.reconstructedNetPnl, TOTAL);
  assert.equal(normalized.pnlBasis, "reconstructed-broker-reported-total");
  assert.deepEqual({ ...normalized.recoveryComponents }, COMPONENTS);
  assert.deepEqual([...normalized.dataGaps], [...record.dataGaps]);
  assert.equal(normalized.coverageComplete, false);
});

// ============================================================
// 11. An empty proposal only ever means an empty history
//
//    A future watermark can only advance on evidence that a window was
//    actually read, so the two endings that both produce zero records have to
//    stay distinguishable in the adapter's own output. No watermark exists
//    yet; these pins are what a Phase 4 gate would be checked against.
// ============================================================

test("separates a window that closed nothing from a window that was never read", async () => {
  const read = await adapted({ first: [] });

  const identity = { mt5Login: LOGIN, mt5Server: SERVER };

  const outcome = await runHistoryRecoveryScan({
    apiUrl: API_URL,
    identity,
    windows: [W1, W2],
    fetchImpl: async () => {
      throw new TypeError("failed to fetch");
    },
  });

  const unread = adaptRecoveryJournalRecords({
    outcome,
    pages: outcome.pages,
    recovery: buildRecoveryJournalRecords({ result: outcome.result, pages: outcome.pages }),
    account: { id: ACCOUNT_ID, mt5Login: LOGIN, mt5Server: SERVER, brokerAccountId: LOGIN },
    existingJournal: [],
  });

  assert.equal(read.result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.deepEqual([...read.result.refusals], []);
  assert.deepEqual([...read.result.records], []);
  assert.equal(read.scenario.outcome.result.scan.acceptedPages, 2);

  assert.equal(outcome.result.scan.acceptedPages, 0);
  assert.equal(unread.status, RECOVERY_ADAPTER_STATUS.BLOCKED);
  assert.deepEqual([...unread.records], []);
  assert.ok(
    unread.refusals.includes(R.NO_ACCEPTED_PAGE_EVIDENCE),
    JSON.stringify(unread.refusals)
  );
});

test("proposes nothing that claims its history is complete", async () => {
  const { result } = await adapted({ first: TWO_POSITIONS() });

  assert.equal(result.status, RECOVERY_ADAPTER_STATUS.PROPOSED);
  assert.equal(result.records.length, 2);

  for (const record of result.records) {
    assert.equal(record.coverageComplete, false, record.positionId);
  }

  assert.equal(
    result.records.some(
      (record) =>
        Object.hasOwn(record, "watermark") ||
        Object.hasOwn(record, "throughUtc") ||
        record.coverageComplete === true
    ),
    false
  );
});

