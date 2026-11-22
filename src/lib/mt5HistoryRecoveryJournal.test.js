import test from "node:test";
import assert from "node:assert/strict";

import { reconstructClosedPositions } from "./mt5HistoryReconstruction.js";

import {
  buildRecoveryJournalRecords,
  RECOVERY_JOURNAL_REASONS,
} from "./mt5HistoryRecoveryJournal.js";

// ============================================================
// Fixtures
//
// Deal rows are copied field-for-field from mt5-bridge/app.py
// validate_history_deal (:6251-6269) and page bodies from
// server/routes/mt5.js historySuccessBody (:1012-1048), the same wire
// shapes used by src/lib/mt5HistoryRecoveryScan.test.js. Candidates come
// from the real approved reconstruction module, so every assertion below
// runs on genuine Phase 1 output.
// ============================================================

const LOGIN = "12345678";
const SERVER = "metatrader-demo";
const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";

const W1 = { fromUtc: "2026-01-01T00:00:00Z", toUtc: "2026-01-08T00:00:00Z" };
const W2 = { fromUtc: "2026-01-08T00:00:00Z", toUtc: "2026-01-15T00:00:00Z" };

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

function addDeal(positionId, volume, timeMsc, overrides = {}) {
  return deal({
    position_id: positionId,
    type: 0,
    entry: 2,
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

function financialDeal(overrides = {}) {
  return deal({
    type: 2,
    entry: 0,
    position_id: "0",
    symbol: "",
    volume: "0",
    price: "0",
    ...overrides,
  });
}

function page(history, positions, window) {
  const trades = history.filter((row) => row.type === 0 || row.type === 1);
  const financial = history.filter(
    (row) => row.type === 2 || row.type === 3 || row.type === 4 || row.type === 5
  );

  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity: { mt5Login: LOGIN, mt5Server: SERVER },
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
      trade_deal_count: trades.length,
      financial_deal_count: financial.length,
      unknown_type_count: 0,
    },
  };
}

function accepted(body) {
  return { accepted: true, page: body };
}

// One closed position in W1, proven absent by the newest snapshot in W2.
function closedPages(rows) {
  return [accepted(page(rows, [], W1)), accepted(page([], [], W2))];
}

function reconstruct(pages) {
  return reconstructClosedPositions(pages);
}

function mapClosed(pages, result = reconstruct(pages)) {
  assert.equal(result.closed.length, 1);
  assert.equal(result.unresolved.length, 0);

  return { result, outcome: buildRecoveryJournalRecords({ result, pages }) };
}

function soloRecord(mapped) {
  assert.equal(mapped.outcome.unassigned.length, 0);
  assert.equal(mapped.outcome.recovered.length, 1);

  return mapped.outcome.recovered[0];
}

const PROFITABLE_LIFECYCLE = () => [
  openDeal("9001", "0.1", OPEN_MSC),
  closeDeal("9001", "0.1", CLOSE_MSC, {
    profit: "2.5",
    swap: "-0.1",
    fee: "-0.05",
  }),
];

// ============================================================
// 1. A resolved candidate becomes a broker-money record
// ============================================================

test("reports the reconstructed total across every deal ticket of the position", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.id, "mt5-position-9001");
  assert.equal(record.broker, "MT5");
  assert.equal(record.source, "history-recovery");
  assert.equal(record.profit, "2.5");
  assert.equal(record.commission, "-0.7");
  assert.equal(record.swap, "-0.1");
  assert.equal(record.fee, "-0.05");
  assert.equal(record.reconstructedNetPnl, "1.65");
});

test("carries the proven lifecycle evidence through unchanged", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());
  const mapped = mapClosed(pages);
  const record = soloRecord(mapped);
  const candidate = mapped.result.closed[0];

  assert.equal(record.positionId, "9001");
  assert.equal(record.symbol, "EURUSD");
  assert.equal(record.side, "buy");
  assert.equal(record.openedAtMsc, OPEN_MSC);
  assert.equal(record.closedAtMsc, CLOSE_MSC);
  assert.deepEqual(record.openingTickets, candidate.openingTickets);
  assert.deepEqual(record.closingTickets, candidate.closingTickets);
  assert.deepEqual(record.dealTickets, candidate.dealTickets);
  assert.equal(record.liveSnapshotToUtc, W2.toUtc);
  assert.equal(record.coverageComplete, false);
  assert.notEqual(Object.is(record, candidate), true);
});

test("takes traded volume from the opening deals, never from netVolume", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.volume, "0.1");
  assert.equal(record.netVolume, "0");
});

test("sums volume across every opening deal of a position that was added to", () => {
  const pages = closedPages([
    openDeal("9001", "0.1", OPEN_MSC, { commission: "-0.35" }),
    addDeal("9001", "0.7", OPEN_MSC + 1_000, { commission: "0" }),
    closeDeal("9001", "0.8", CLOSE_MSC, {
      commission: "0",
      profit: "3",
    }),
  ]);
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.volume, "0.8");
  assert.equal(record.netVolume, "0");
  assert.equal(record.reconstructedNetPnl, "2.65");
});

test("includes opening-deal commission and every partial close in one total", () => {
  const pages = closedPages([
    openDeal("9001", "0.3", OPEN_MSC, { commission: "-1.05" }),
    closeDeal("9001", "0.1", CLOSE_MSC, { profit: "1.4", commission: "0" }),
    closeDeal("9001", "0.2", CLOSE_MSC + 1_000, {
      profit: "0.7",
      commission: "0",
    }),
  ]);
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.profit, "2.1");
  assert.equal(record.commission, "-1.05");
  assert.equal(record.reconstructedNetPnl, "1.05");
});

// ============================================================
// 2. Nothing a deal record cannot prove is filled in
// ============================================================

test("leaves risk and stop unknown rather than estimated", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.riskReward, null);
  assert.equal(record.stopLoss, null);
});

test("does not publish the journal keys that default to zero", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());
  const record = soloRecord(mapClosed(pages));

  for (const field of ["pnl", "netProfit", "netPnL", "PnL", "currency"]) {
    assert.equal(field in record, false, `invented ${field}`);
  }
});

// ============================================================
// 3. Deterministic, idempotent identity
// ============================================================

test("derives the same record twice from the same evidence", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());

  const first = soloRecord(mapClosed(pages));
  const second = soloRecord(mapClosed(pages));

  assert.deepEqual({ ...second }, { ...first });
  assert.equal(second.id, "mt5-position-9001");
});

// ============================================================
// 4. Unrelated broker records never enter a position total
// ============================================================

test("excludes financial deals the candidate does not reference", () => {
  const pages = closedPages([
    financialDeal({ profit: "100.00", commission: "0", time_msc: OPEN_MSC }),
    ...PROFITABLE_LIFECYCLE(),
  ]);
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.reconstructedNetPnl, "1.65");
});

test("counts an identical deal reported by two pages once", () => {
  const rows = PROFITABLE_LIFECYCLE();
  const pages = [
    accepted(page(rows, [], W1)),
    accepted(page([rows[0]], [], W2)),
  ];
  const record = soloRecord(mapClosed(pages));

  assert.equal(record.commission, "-0.7");
  assert.equal(record.reconstructedNetPnl, "1.65");
});

// ============================================================
// 5. Contradictory or missing evidence is refused, never zero-filled
// ============================================================

test("refuses a candidate whose ticket is reported two different ways", () => {
  const rows = PROFITABLE_LIFECYCLE();
  const result = reconstruct(closedPages(rows));

  const conflicting = { ...rows[1], price: "1.20000" };
  const pages = [accepted(page(rows, [], W1)), accepted(page([conflicting], [], W2))];

  const outcome = buildRecoveryJournalRecords({ result, pages });

  assert.equal(outcome.recovered.length, 0);
  assert.equal(outcome.unassigned.length, 1);
  assert.equal(
    outcome.unassigned[0].reason,
    RECOVERY_JOURNAL_REASONS.CONFLICTING_DEAL_TICKETS
  );
  assert.deepEqual(outcome.unassigned[0].dealTickets, result.closed[0].dealTickets);
});

test("refuses a candidate whose deal evidence is not in the accepted pages", () => {
  const rows = PROFITABLE_LIFECYCLE();
  const result = reconstruct(closedPages(rows));

  const thinner = [accepted(page([rows[0]], [], W1)), accepted(page([], [], W2))];

  const outcome = buildRecoveryJournalRecords({ result, pages: thinner });

  assert.equal(outcome.recovered.length, 0);
  assert.equal(
    outcome.unassigned[0].reason,
    RECOVERY_JOURNAL_REASONS.MISSING_DEAL_TICKETS
  );
  assert.deepEqual(outcome.unassigned[0].missingTickets, [rows[1].ticket]);
});

test("builds its ticket index from accepted pages only", () => {
  const rows = PROFITABLE_LIFECYCLE();
  const result = reconstruct(closedPages(rows));

  const blind = [
    { accepted: false, page: page(rows, [], W1) },
    accepted(page([], [], W2)),
  ];

  const outcome = buildRecoveryJournalRecords({ result, pages: blind });

  assert.equal(outcome.recovered.length, 0);
  assert.equal(
    outcome.unassigned[0].reason,
    RECOVERY_JOURNAL_REASONS.MISSING_DEAL_TICKETS
  );
});

test("refuses a candidate whose reported amount is not decimal text", () => {
  const rows = PROFITABLE_LIFECYCLE();
  rows[1] = { ...rows[1], profit: 2.5 };

  const pages = closedPages(rows);
  const result = reconstruct(pages);

  assert.equal(result.closed.length, 1);

  const outcome = buildRecoveryJournalRecords({ result, pages });

  assert.equal(outcome.recovered.length, 0);
  assert.equal(
    outcome.unassigned[0].reason,
    RECOVERY_JOURNAL_REASONS.DEAL_MONEY_INVALID
  );
  assert.equal(outcome.unassigned[0].field, "profit");
});

test("refuses a candidate whose opening volume is not decimal text", () => {
  const rows = PROFITABLE_LIFECYCLE();
  const candidate = {
    positionId: "9001",
    symbol: "EURUSD",
    side: "buy",
    openedAtMsc: OPEN_MSC,
    closedAtMsc: CLOSE_MSC,
    netVolume: "0",
    dealCount: 2,
    openingTickets: [rows[0].ticket],
    closingTickets: [rows[1].ticket],
    dealTickets: [rows[0].ticket, rows[1].ticket],
    liveSnapshotToUtc: W2.toUtc,
  };

  const pages = [
    accepted(page([{ ...rows[0], volume: 0.1 }, rows[1]], [], W1)),
    accepted(page([], [], W2)),
  ];

  const outcome = buildRecoveryJournalRecords({
    result: { closed: [candidate], unresolved: [], scan: {} },
    pages,
  });

  assert.equal(outcome.recovered.length, 0);
  assert.equal(
    outcome.unassigned[0].reason,
    RECOVERY_JOURNAL_REASONS.OPENING_VOLUME_INVALID
  );
});

// ============================================================
// 6. Phase 1 results are passed through, not weakened
// ============================================================

test("preserves the unresolved records the reconstruction module returned", () => {
  const rows = [
    ...PROFITABLE_LIFECYCLE(),
    openDeal("9002", "0.1", OPEN_MSC + 2_000),
  ];

  const pages = closedPages(rows);
  const result = reconstruct(pages);

  assert.equal(result.closed.length, 1);
  assert.equal(result.unresolved.length, 1);

  const outcome = buildRecoveryJournalRecords({ result, pages });

  assert.equal(Object.is(outcome.unresolved, result.unresolved), true);
  assert.equal(outcome.unresolved[0].positionId, "9002");
  assert.equal(soloRecord({ outcome }).id, "mt5-position-9001");
});

test("returns empty collections when nothing was proven closed", () => {
  const pages = closedPages([]);
  const result = reconstruct(pages);

  assert.equal(result.closed.length, 0);

  const outcome = buildRecoveryJournalRecords({ result, pages });

  assert.deepEqual([...outcome.recovered], []);
  assert.deepEqual([...outcome.unassigned], []);
  assert.equal(Object.isFrozen(outcome.recovered), true);
  assert.equal(Object.isFrozen(outcome), true);
});

test("refuses to map without a reconstruction result or page list", () => {
  const pages = closedPages(PROFITABLE_LIFECYCLE());

  assert.throws(
    () => buildRecoveryJournalRecords({ pages }),
    TypeError
  );
  assert.throws(
    () => buildRecoveryJournalRecords({ result: reconstruct(pages) }),
    TypeError
  );
  assert.throws(
    () =>
      buildRecoveryJournalRecords({
        result: { closed: [] },
        pages: "not a list",
      }),
    TypeError
  );
});
