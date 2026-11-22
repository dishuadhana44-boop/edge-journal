import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeJournalTrade } from "./journalTradeNormalization.js";

// ==========================================================
// Journal normalization: what a saved trade becomes on reload
//
// Every trade in the journal passes through normalizeJournalTrade when
// localStorage is read (src/context/JournalContext.jsx:690-702) and again
// when it is updated (:952, :1038), so this is where a recovered trade's
// unknowns either stay unknown or silently acquire values.
//
// The recovered fixture below carries exactly the keys the adapter publishes
// (src/lib/mt5RecoveryJournalAdapter.js adaptRecord's record) and nothing else: deal
// history reports no entry price, no exit price, no stop loss, no take
// profit and no risk/reward, which is what the record's own dataGaps names.
// ==========================================================

const OPENED_AT_MSC = 1_763_000_000_000;
const CLOSED_AT_MSC = 1_763_003_600_000;

const recoveredRecord = (overrides = {}) => ({
  id: "mt5-position-123456-9001",
  accountId: "acct-1",
  mt5Login: "123456",
  mt5Server: "MetaQuotes-Demo",
  brokerAccountId: "123456",
  broker: "MT5",
  source: "history-recovery",
  status: "CLOSED",
  positionId: "9001",
  brokerPositionId: "9001",
  symbol: "EURUSD.pro",
  side: "buy",
  volume: "0.1",
  openedAt: OPENED_AT_MSC,
  closedAt: CLOSED_AT_MSC,
  openedAtMsc: OPENED_AT_MSC,
  closedAtMsc: CLOSED_AT_MSC,
  pnl: "0.18",
  netProfit: "0.18",
  netPnL: "0.18",
  realizedPnL: "0.18",
  reconstructedNetPnl: "0.18",
  pnlBasis: "reconstructed-broker-reported-total",
  recoveryComponents: {
    profit: "1",
    commission: "-0.7",
    swap: "-0.12",
    fee: "0",
  },
  dealTickets: ["700001", "700002"],
  openingTickets: ["700001"],
  closingTickets: ["700002"],
  liveSnapshotToUtc: "2025-11-13T00:00:00.000Z",
  coverageComplete: false,
  dataGaps: [
    "CURRENCY",
    "STOP_LOSS",
    "TAKE_PROFIT",
    "ENTRY_PRICE",
    "EXIT_PRICE",
    "RISK_REWARD",
  ],
  ...overrides,
});

// Exactly what a saved trade looks like after it has been through
// localStorage once.
const reload = (trade) => JSON.parse(JSON.stringify(trade));

const UNREPORTED_PRICES = ["entryPrice", "exitPrice", "stopLoss", "takeProfit"];
const RISK_REWARD_KEYS = ["rr", "riskReward", "riskRewardRatio"];

// ============================================================
// 1. A fact the broker never reported must not become a number
// ============================================================

test("keeps a recovered trade's unreported prices unknown through a reload", () => {
  const normalized = normalizeJournalTrade(reload(recoveredRecord()));

  for (const field of UNREPORTED_PRICES) {
    assert.equal(
      normalized[field],
      null,
      `${field} was reported as ${JSON.stringify(normalized[field])} for a trade the broker never gave one for`
    );
  }
});

test("keeps a recovered trade's unreported risk/reward unknown through a reload", () => {
  const normalized = normalizeJournalTrade(reload(recoveredRecord()));

  for (const field of RISK_REWARD_KEYS) {
    assert.equal(
      normalized[field],
      null,
      `${field} claimed ${JSON.stringify(normalized[field])} for a trade with no stop loss and no take profit`
    );
  }
});

// The harm is not an empty cell: src/components/dashboard/Discipline/DisciplineBreakdown.jsx:81-83
// counts a trade as risk-managed when stopLoss is anything other than
// undefined, null or "", so a zero-filled recovered trade is scored as
// protected by a stop loss at price 0.
test("does not score a recovered trade as stop-loss protected", () => {
  const normalized = normalizeJournalTrade(reload(recoveredRecord()));

  const hasStopLoss =
    normalized.stopLoss !== undefined &&
    normalized.stopLoss !== null &&
    normalized.stopLoss !== "";

  assert.equal(hasStopLoss, false, JSON.stringify(normalized.stopLoss));
});

test("keeps an unknown unknown when the same recovered trade is normalized again", () => {
  const once = normalizeJournalTrade(reload(recoveredRecord()));
  const twice = normalizeJournalTrade(reload(once));

  for (const field of [...UNREPORTED_PRICES, ...RISK_REWARD_KEYS]) {
    assert.equal(twice[field], once[field], `${field} changed on the second pass`);
    assert.equal(twice[field], null, `${field} stopped being unknown`);
  }
  assert.deepEqual(twice, once);
});

// ============================================================
// 2. The broker's own symbol text
// ============================================================

test("keeps the broker symbol of a recovered trade exactly", () => {
  const normalized = normalizeJournalTrade(reload(recoveredRecord()));

  assert.equal(normalized.symbol, "EURUSD.pro");
  assert.equal(normalized.pair, "EURUSD.pro");
});

test("keeps the broker symbol of a recovered trade through repeated reloads", () => {
  let trade = recoveredRecord();

  for (let pass = 0; pass < 3; pass += 1) {
    trade = normalizeJournalTrade(reload(trade));

    assert.equal(trade.symbol, "EURUSD.pro", `pass ${pass + 1} rewrote the symbol`);
    assert.equal(trade.pair, "EURUSD.pro", `pass ${pass + 1} rewrote the pair`);
  }
});

// ============================================================
// 3. Everything the journal resolves for a recovered trade stays
//    resolved — the fix may not reach past the unknowns
// ============================================================

test("still resolves every reported fact of a recovered trade", () => {
  const normalized = normalizeJournalTrade(reload(recoveredRecord()));

  assert.equal(normalized.accountId, "acct-1");
  assert.equal(normalized.direction, "Buy");
  assert.equal(normalized.result, "Win");
  assert.equal(normalized.entryTime, OPENED_AT_MSC);
  assert.equal(normalized.openedAt, OPENED_AT_MSC);
  assert.equal(normalized.exitTime, CLOSED_AT_MSC);
  assert.equal(normalized.closedAt, CLOSED_AT_MSC);
  assert.equal(normalized.durationMs, CLOSED_AT_MSC - OPENED_AT_MSC);
  assert.equal(normalized.date.length, 10);
  assert.ok(normalized.day.length > 0);
  assert.ok(normalized.session.length > 0);
  assert.equal(normalized.pnl, 0.18);
  assert.equal(normalized.netProfit, 0.18);
});

test("leaves the broker's own decimal text and provenance untouched", () => {
  const normalized = normalizeJournalTrade(reload(recoveredRecord()));

  assert.equal(normalized.reconstructedNetPnl, "0.18");
  assert.equal(normalized.pnlBasis, "reconstructed-broker-reported-total");
  assert.deepEqual({ ...normalized.recoveryComponents }, {
    profit: "1",
    commission: "-0.7",
    swap: "-0.12",
    fee: "0",
  });
  assert.equal(normalized.coverageComplete, false);
  assert.deepEqual([...normalized.dataGaps], [
    "CURRENCY",
    "STOP_LOSS",
    "TAKE_PROFIT",
    "ENTRY_PRICE",
    "EXIT_PRICE",
    "RISK_REWARD",
  ]);
  assert.equal(normalized.source, "history-recovery");
  assert.equal(normalized.broker, "MT5");
});

// ============================================================
// 4. Live trades keep the normalization they have always had
// ============================================================

test("keeps a manual trade's blank prices as zero the way it always did", () => {
  const normalized = normalizeJournalTrade({
    id: "journal-1",
    accountId: "acct-1",
    pair: "EURUSD",
    direction: "Buy",
    date: "2025-11-12",
    pnl: 12,
  });

  for (const field of UNREPORTED_PRICES) {
    assert.equal(normalized[field], 0, `${field} stopped being zero-filled for a live trade`);
  }

  for (const field of RISK_REWARD_KEYS) {
    assert.equal(normalized[field], 0, `${field} stopped being zero-filled for a live trade`);
  }
});

test("keeps stripping a manual trade's broker suffix the way it always did", () => {
  const normalized = normalizeJournalTrade({
    id: "journal-2",
    accountId: "acct-1",
    symbol: "EURUSD.pro",
    direction: "Buy",
    date: "2025-11-12",
    pnl: 12,
  });

  assert.equal(normalized.symbol, "EURUSDPRO");
  assert.equal(normalized.pair, "EURUSDPRO");
});

test("keeps computing risk/reward from a manual trade's own prices", () => {
  const normalized = normalizeJournalTrade({
    id: "journal-3",
    accountId: "acct-1",
    pair: "EURUSD",
    direction: "Buy",
    date: "2025-11-12",
    pnl: 12,
    entryPrice: 1.1,
    stopLoss: 1.09,
    takeProfit: 1.13,
  });

  assert.equal(normalized.rr, 3);
  assert.equal(normalized.riskReward, 3);
});

test("normalizes a recovered trade that really does report prices as reported", () => {
  const normalized = normalizeJournalTrade(
    recoveredRecord({
      entryPrice: 1.1,
      exitPrice: 1.12,
      stopLoss: 1.09,
      takeProfit: 1.13,
    })
  );

  assert.equal(normalized.entryPrice, 1.1);
  assert.equal(normalized.exitPrice, 1.12);
  assert.equal(normalized.stopLoss, 1.09);
  assert.equal(normalized.takeProfit, 1.13);
  assert.equal(normalized.rr, 3);
});
