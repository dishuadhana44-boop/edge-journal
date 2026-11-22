import test from "node:test";
import assert from "node:assert/strict";

import {
  reconstructClosedPositions,
  RECONSTRUCTION_REASONS,
} from "../lib/mt5HistoryReconstruction.js";

// ============================================================
// Fixtures
//
// Deal rows are copied field-for-field from
// mt5-bridge/app.py validate_history_deal (:6251-6269) and live
// position rows from validate_live_position (:6309-6317). Page
// bodies are copied from the Express success body in
// server/routes/mt5.js historySuccessBody (:994-1030 at the time
// these tests were written).
// ============================================================

const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";
const LOGIN = "12345678";
const SERVER = "metatrader-demo";
const FROM = "2026-01-01T00:00:00Z";
const TO = "2026-01-08T00:00:00Z";

const BASE_MSC = 1767229200000; // 2026-01-01T01:00:00Z
const DAY_MSC = 86_400_000;

// 2026-01-03T01:00:00Z and 2026-01-04T01:00:00Z — each inside the page
// window its fixture claims, the way validate_history_deal enforces
// (app.py:6235).
const DAY3_MSC = 1767225600000 + 2 * DAY_MSC + 3_600_000;
const DAY4_MSC = 1767225600000 + 3 * DAY_MSC + 3_600_000;

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
    time_msc: overrides.time_msc ?? BASE_MSC,
    comment: overrides.comment ?? "edgeflo",
    magic: overrides.magic ?? 12345,
  };

  fields.time = Math.floor(fields.time_msc / 1000);

  return {
    ...fields,
    raw: { ...fields, ticket: Number(fields.ticket) },
  };
}

function openDeal(positionId, volume, timeMsc, extra = {}) {
  return deal({
    position_id: positionId,
    type: 0,
    entry: 0,
    volume,
    time_msc: timeMsc,
    ...extra,
  });
}

function closeDeal(positionId, volume, timeMsc, extra = {}) {
  return deal({
    position_id: positionId,
    type: 1,
    entry: 1,
    volume,
    time_msc: timeMsc,
    ...extra,
  });
}

function liveRow(positionId, overrides = {}) {
  const fields = {
    ticket: String(overrides.ticket ?? 70_000 + Number(positionId)),
    position_id: String(positionId),
    identifier: String(positionId),
    symbol: overrides.symbol ?? "EURUSD",
    type: overrides.type ?? 0,
    volume: overrides.volume ?? "0.1",
  };

  return { ...fields, raw: { ...fields, identifier: Number(positionId) } };
}

function page(history, positions = [], overrides = {}) {
  const rows = overrides.history ?? history;

  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity: { mt5Login: LOGIN, mt5Server: SERVER },
    utc_range: {
      from_utc: overrides.from_utc ?? FROM,
      to_utc: overrides.to_utc ?? TO,
    },
    scan_range: {
      from_utc: overrides.scan_from_utc ?? FROM,
      to_utc: overrides.scan_to_utc ?? TO,
    },
    coverage: {
      boundaries: "inclusive",
      returned_deal_count: rows.length,
      serialized_deal_count: rows.length,
    },
    retention_verified: false,
    bridge_boot_id: overrides.bridge_boot_id ?? BOOT_ID,
    connection_generation:
      overrides.connection_generation ?? 0,
    count: rows.length,
    history: rows,
    positions,
    classification: {
      trade_deal_count: rows.length,
      financial_deal_count: 0,
      unknown_type_count: 0,
    },
  };
}

function accepted(body) {
  return { accepted: true, page: body };
}

function rejected(code = "MT5_HISTORY_TIMEOUT") {
  return { accepted: false, page: null, code };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }

  return value;
}

function closedFor(pages) {
  return reconstructClosedPositions(pages).closed;
}

function unresolvedFor(pages, positionId) {
  return reconstructClosedPositions(pages).unresolved.find(
    (entry) => entry.positionId === String(positionId)
  );
}

// ============================================================
// 1. Complete, verified closed lifecycle
// ============================================================

test("recovers a position whose opening deal, flat volume and absent live row prove a close", () => {
  const body = page([
    openDeal("9001", "0.10", BASE_MSC, { ticket: "41" }),
    closeDeal("9001", "0.10", BASE_MSC + 60_000, { ticket: "42" }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, [
    {
      positionId: "9001",
      symbol: "EURUSD",
      side: "buy",
      openedAtMsc: BASE_MSC,
      closedAtMsc: BASE_MSC + 60_000,
      netVolume: "0",
      dealCount: 2,
      openingTickets: ["41"],
      closingTickets: ["42"],
      dealTickets: ["41", "42"],
      liveSnapshotToUtc: TO,
    },
  ]);
  assert.deepEqual(result.unresolved, []);
  assert.equal(result.scan.coverageComplete, false);
});

test("groups one position across its deals and never splits it by deal ticket", () => {
  const body = page([
    openDeal("9002", "0.30", BASE_MSC, { ticket: "11" }),
    closeDeal("9002", "0.10", BASE_MSC + 1_000, { ticket: "12" }),
    closeDeal("9002", "0.20", BASE_MSC + 2_000, { ticket: "13" }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.equal(result.closed.length, 1);
  assert.deepEqual(result.closed[0].dealTickets, ["11", "12", "13"]);
  assert.deepEqual(result.closed[0].openingTickets, ["11"]);
  assert.deepEqual(result.closed[0].closingTickets, ["12", "13"]);
  assert.equal(result.closed[0].netVolume, "0");
});

// ============================================================
// 2. Opening deal missing from the fetched history
// ============================================================

test("leaves a position unresolved when its opening deal is outside the fetched pages", () => {
  const body = page([closeDeal("9003", "0.10", BASE_MSC)]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.unresolved.length, 1);
  assert.equal(result.unresolved[0].positionId, "9003");
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.OPENING_DEAL_MISSING
  );
  assert.equal(result.unresolved[0].retryable, true);
  assert.equal(result.unresolved[0].earliestDealTimeMsc, BASE_MSC);
});

// ============================================================
// 3. Non-zero cumulative volume
// ============================================================

test("leaves a partially closed position unresolved instead of guessing a close", () => {
  const body = page([
    openDeal("9004", "0.50", BASE_MSC),
    closeDeal("9004", "0.20", BASE_MSC + 1_000),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.VOLUME_NOT_FLAT
  );
  assert.equal(result.unresolved[0].netVolume, "0.3");
});

test("leaves a position unresolved when closed volume exceeds opened volume", () => {
  const body = page([
    openDeal("9005", "0.10", BASE_MSC),
    closeDeal("9005", "0.10", BASE_MSC + 1_000),
    closeDeal("9005", "0.10", BASE_MSC + 2_000),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.VOLUME_NET_NEGATIVE
  );
});

// ============================================================
// 4. Still present in the accepted live-position snapshot
// ============================================================

test("never closes a position that is present in the newest live-position snapshot", () => {
  const body = page(
    [
      openDeal("9006", "0.20", BASE_MSC),
      closeDeal("9006", "0.10", BASE_MSC + 1_000),
    ],
    [liveRow("9006", { volume: "0.1" })]
  );

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.unresolved[0].reason, RECONSTRUCTION_REASONS.STILL_OPEN);
  assert.equal(result.unresolved[0].liveInNewestSnapshot, true);
});

test("treats a flat lifecycle that the live snapshot still reports as a contradiction", () => {
  const body = page(
    [
      openDeal("9007", "0.10", BASE_MSC),
      closeDeal("9007", "0.10", BASE_MSC + 1_000),
    ],
    [liveRow("9007")]
  );

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIFECYCLE_CONTRADICTS_SNAPSHOT
  );
});

test("uses the newest accepted snapshot, not an older page, to decide liveness", () => {
  const older = accepted(
    page(
      [openDeal("9008", "0.10", BASE_MSC)],
      [liveRow("9008")],
      { to_utc: "2026-01-04T00:00:00Z" }
    )
  );
  const newer = accepted(
    page(
      [closeDeal("9008", "0.10", DAY4_MSC)],
      [],
      {
        from_utc: "2026-01-04T00:00:00Z",
        to_utc: "2026-01-05T00:00:00Z",
      }
    )
  );

  const result = reconstructClosedPositions([older, newer]);

  assert.deepEqual(result.unresolved, []);
  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].positionId, "9008");
  assert.equal(result.closed[0].closedAtMsc, DAY4_MSC);
  assert.equal(result.scan.liveSnapshotToUtc, "2026-01-05T00:00:00Z");
});

// ============================================================
// 5. Duplicate and conflicting deal evidence
// ============================================================

test("deduplicates identical deals that appear on more than one page", () => {
  const rows = [
    openDeal("9009", "0.10", BASE_MSC, { ticket: "21" }),
    closeDeal("9009", "0.10", BASE_MSC + 1_000, { ticket: "22" }),
  ];

  const result = reconstructClosedPositions([
    accepted(page(rows)),
    accepted(page(rows)),
  ]);

  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].dealCount, 2);
  assert.equal(result.scan.duplicateDealRows, 2);
});

test("refuses to close a position whose deal ticket appears twice with different contents", () => {
  const first = openDeal("9010", "0.10", BASE_MSC, { ticket: "31" });
  const second = openDeal("9010", "0.20", BASE_MSC, { ticket: "31" });

  const result = reconstructClosedPositions([
    accepted(page([first, closeDeal("9010", "0.10", BASE_MSC + 1_000)])),
    accepted(
      page([
        second,
        closeDeal("9010", "0.20", BASE_MSC + 1_000, { ticket: "32" }),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.CONFLICTING_DUPLICATE_DEALS
  );
});

// ============================================================
// 6. CLOSE_BY without a proven counterpart
// ============================================================

test("leaves a position unresolved when its only closing evidence is a close-by deal", () => {
  const body = page([
    openDeal("9011", "0.10", BASE_MSC),
    deal({
      position_id: "9011",
      type: 1,
      entry: 3,
      volume: "0.10",
      time_msc: BASE_MSC + 1_000,
    }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.INCOMPLETE_CLOSE_BY_EVIDENCE
  );
});

// ============================================================
// 7. INOUT treated conservatively
// ============================================================

test("will not accept an inout deal as proof that a position opened", () => {
  const body = page([
    deal({
      position_id: "9012",
      type: 1,
      entry: 2,
      volume: "0.10",
      time_msc: BASE_MSC,
    }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.INOUT_OPENER_UNPROVEN
  );
});

test("accepts an inout deal that reduces volume after a proven opening deal", () => {
  const body = page([
    openDeal("9013", "0.20", BASE_MSC),
    deal({
      position_id: "9013",
      type: 1,
      entry: 2,
      volume: "0.20",
      time_msc: BASE_MSC + 1_000,
    }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].netVolume, "0");
});

// ============================================================
// 8. Decimal volume arithmetic
// ============================================================

test("nets 0.1 plus 0.2 against an 0.3 opening deal without floating-point drift", () => {
  const body = page([
    openDeal("9014", "0.3", BASE_MSC),
    closeDeal("9014", "0.1", BASE_MSC + 1_000),
    closeDeal("9014", "0.2", BASE_MSC + 2_000),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].netVolume, "0");
  assert.notEqual(0.1 + 0.2 === 0.3, true);
});

test("nets 0.01 plus 0.06 against an 0.07 opening deal without a binary residue", () => {
  // 0.1 + 0.2 against 0.3 rounds back to a clean total in binary, so it
  // cannot tell exact decimal netting from float netting; these do not.
  const body = page([
    openDeal("9062", "0.07", BASE_MSC),
    closeDeal("9062", "0.01", BASE_MSC + 1_000),
    closeDeal("9062", "0.06", BASE_MSC + 2_000),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].netVolume, "0");
  assert.notEqual(0.01 + 0.06 === 0.07, true);
});

test("treats differently scaled but equal decimal volumes as flat", () => {
  const body = page([
    openDeal("9015", "0.100", BASE_MSC),
    closeDeal("9015", "0.1", BASE_MSC + 1_000),
  ]);

  assert.equal(closedFor([accepted(body)])[0].netVolume, "0");
});

test("refuses a deal whose volume is not a plain non-negative decimal string", () => {
  for (const volume of ["0.1e1", "-0.1", "abc", "", "0x1", 0.1, null]) {
    // Assigned after construction on purpose: a `??` default would replace
    // null with a valid volume and silently test nothing.
    const opener = deal({ position_id: "9016" });
    opener.volume = volume;

    const result = reconstructClosedPositions([
      accepted(page([opener, closeDeal("9016", "0.1", BASE_MSC + 1_000)])),
    ]);

    assert.deepEqual(result.closed, [], String(volume));
    assert.equal(
      result.unresolved[0].reason,
      RECONSTRUCTION_REASONS.MALFORMED_DEAL_ROW,
      String(volume)
    );
  }
});

// ============================================================
// 9. Page atomicity
// ============================================================

test("a rejected page contributes no records and keeps the scan incomplete", () => {
  const body = page([
    openDeal("9017", "0.10", BASE_MSC),
    closeDeal("9017", "0.10", BASE_MSC + 1_000),
  ]);

  const result = reconstructClosedPositions([accepted(body), rejected()]);

  // Updated for the rejected-snapshot rule: the rejection adds no record,
  // and because a refusal carries no instant its live set is unknowable, so
  // the accepted page alone can no longer prove the absence of 9017.
  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(result.scan.acceptedPages, 1);
  assert.equal(result.scan.rejectedPages, 1);
  assert.equal(result.scan.coverageComplete, false);
});

test("a rejected page invents no liveness and proves no absence either", () => {
  const withRejection = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9018", "0.10", BASE_MSC),
        closeDeal("9018", "0.10", BASE_MSC + 1_000),
      ])
    ),
    rejected(),
  ]);
  const onlyRejection = reconstructClosedPositions([rejected()]);

  // Neither direction is allowed: a rejection must not report a position
  // open, and it must not be read as an empty snapshot either.
  assert.deepEqual(withRejection.closed, []);
  assert.equal(
    withRejection.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(withRejection.unresolved[0].liveInNewestSnapshot, false);
  assert.deepEqual(onlyRejection.closed, []);
  assert.deepEqual(onlyRejection.unresolved, []);
  assert.equal(onlyRejection.scan.acceptedPages, 0);
  assert.equal(onlyRejection.scan.coverageComplete, false);
});

test("a page body that is not shaped like an accepted history page is refused", () => {
  const badBodies = [
    null,
    undefined,
    "page",
    {},
    { ...page([]), history: "not-an-array" },
    { ...page([]), positions: null },
    { ...page([]), utc_range: null },
    { ...page([]), utc_range: { from_utc: "nope", to_utc: "nope" } },
    // Date.UTC would roll these forward instead of failing; the round-trip
    // check has to catch them or the page order is silently wrong.
    { ...page([]), utc_range: { from_utc: FROM, to_utc: "2026-01-08T00:00:60Z" } },
    { ...page([]), utc_range: { from_utc: FROM, to_utc: "2026-01-31T24:00:00Z" } },
    { ...page([]), bridge_boot_id: 7 },
    { ...page([]), connection_generation: "zero" },
  ];

  for (const body of badBodies) {
    const result = reconstructClosedPositions([accepted(body)]);

    assert.deepEqual(result.closed, [], JSON.stringify(body) ?? "undefined");
    assert.equal(result.scan.acceptedPages, 0, String(body));
    assert.equal(result.scan.rejectedPages, 1, String(body));
  }
});

// ============================================================
// 10. Determinism and purity
// ============================================================

test("repeated reconstruction of the same pages produces identical output", () => {
  const pages = [
    accepted(
      page([
        openDeal("9021", "0.10", BASE_MSC),
        closeDeal("9021", "0.10", BASE_MSC + 1_000),
        openDeal("9020", "0.30", BASE_MSC + 2_000),
        closeDeal("9020", "0.10", BASE_MSC + 3_000),
        deal({
          position_id: "0",
          type: 2,
          entry: 0,
          volume: "0",
          symbol: "",
          time_msc: BASE_MSC + 4_000,
        }),
      ])
    ),
    rejected(),
  ];

  const input = deepFreeze(structuredClone(pages));
  const first = reconstructClosedPositions(input);
  const second = reconstructClosedPositions(input);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  // The rejection in this fixture carries no instant, so neither position
  // can be proved absent: both stay unresolved, and 9020 also keeps its own
  // integrity reason. Determinism is what this test is for.
  assert.deepEqual(first.closed, []);
  assert.deepEqual(
    first.unresolved.map((entry) => entry.positionId),
    ["9020", "9021"]
  );
  assert.equal(
    first.unresolved[1].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(Object.isFrozen(input[0].page.history[0]), true);
});

test("exports only the documented pure API", async () => {
  const module = await import("../lib/mt5HistoryReconstruction.js");

  assert.deepEqual(Object.keys(module).sort(), [
    "RECONSTRUCTION_REASONS",
    "reconstructClosedPositions",
  ]);
});

// ============================================================
// Extra safety rules
// ============================================================

test("keeps financial deals out of candidates and records them as evidence only", () => {
  const body = page([
    openDeal("9030", "0.10", BASE_MSC),
    closeDeal("9030", "0.10", BASE_MSC + 1_000),
    deal({
      type: 2,
      entry: 0,
      volume: "0",
      position_id: "0",
      symbol: "",
      time_msc: BASE_MSC + 2_000,
    }),
    deal({
      type: 5,
      entry: 0,
      volume: "0",
      position_id: "0",
      symbol: "",
      time_msc: BASE_MSC + 3_000,
    }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].positionId, "9030");
  assert.equal(result.financialDeals.length, 2);
  assert.deepEqual(
    result.financialDeals.map((row) => row.type),
    [2, 5]
  );
});

test("refuses to treat a deal with an unknown lifecycle entry as usable evidence", () => {
  const body = page([
    openDeal("9031", "0.10", BASE_MSC),
    deal({
      position_id: "9031",
      type: 1,
      entry: 4,
      volume: "0.10",
      time_msc: BASE_MSC + 1_000,
    }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.UNKNOWN_DEAL_ENTRY
  );
});

test("marks every closure ambiguous when accepted pages span more than one connection generation", () => {
  const firstGen = page(
    [openDeal("9032", "0.10", BASE_MSC)],
    [],
    { to_utc: "2026-01-03T00:00:00Z" }
  );
  const secondGen = page(
    [closeDeal("9032", "0.10", DAY3_MSC)],
    [],
    {
      from_utc: "2026-01-03T00:00:00Z",
      to_utc: "2026-01-04T00:00:00Z",
      connection_generation: 1,
    }
  );

  const result = reconstructClosedPositions([
    accepted(firstGen),
    accepted(secondGen),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.scan.generationAmbiguous, true);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.GENERATION_AMBIGUOUS_SNAPSHOT
  );
});

test("refuses to choose between two live snapshots that describe the same instant differently", () => {
  const instant = "2026-01-08T00:00:00Z";

  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9033", "0.10", BASE_MSC),
          closeDeal("9033", "0.10", BASE_MSC + 1_000),
        ],
        [],
        { to_utc: instant }
      )
    ),
    accepted(
      page(
        [],
        [liveRow("9033")],
        { to_utc: instant, from_utc: "2026-01-07T00:00:00Z" }
      )
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.scan.snapshotAmbiguous, true);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.AMBIGUOUS_LIVE_SNAPSHOT
  );
});

// ============================================================
// Input discipline
// ============================================================

test("throws when the pages argument is not an array", () => {
  for (const bad of [null, undefined, "pages", {}, 42]) {
    assert.throws(
      () => reconstructClosedPositions(bad),
      TypeError,
      String(bad)
    );
  }
});

test("discards a page whose trade deal carries no position identifier", () => {
  const body = page([
    openDeal("9040", "0.10", BASE_MSC),
    closeDeal("9040", "0.10", BASE_MSC + 1_000),
    deal({ position_id: "0", type: 0, entry: 0, volume: "0.10" }),
  ]);

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.deepEqual(result.unresolved, []);
  assert.equal(result.scan.acceptedPages, 0);
  assert.equal(result.scan.rejectedPages, 1);
});

test("discards a page whose live-position row cannot be trusted", () => {
  const body = page(
    [
      openDeal("9041", "0.10", BASE_MSC),
      closeDeal("9041", "0.10", BASE_MSC + 1_000),
    ],
    [{ ticket: "70", position_id: "9041", identifier: "9041" }]
  );

  const result = reconstructClosedPositions([accepted(body)]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.scan.acceptedPages, 0);
  assert.equal(result.scan.rejectedPages, 1);
});

// ============================================================
// Phase 1 review corrections
// ============================================================

test("refuses a trade deal whose volume is zero", () => {
  // Both rows point the same way, so the old direction-only netting saw a
  // flat lifecycle with no closing deal and crashed on the missing ticket.
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9050", "0", BASE_MSC),
        deal({
          position_id: "9050",
          type: 0,
          entry: 2,
          volume: "0",
          time_msc: BASE_MSC + 1_000,
        }),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.MALFORMED_DEAL_ROW
  );
});

test("refuses a lifecycle that repeats an opening deal", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9051", "0.10", BASE_MSC),
        openDeal("9051", "0.10", BASE_MSC + 1_000),
        closeDeal("9051", "0.20", BASE_MSC + 2_000),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.UNCLASSIFIABLE_DEAL_ENTRY
  );
});

test("refuses an entry deal in the opposite direction as a close", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9052", "0.10", BASE_MSC),
        deal({
          position_id: "9052",
          type: 1,
          entry: 0,
          volume: "0.10",
          time_msc: BASE_MSC + 1_000,
        }),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.unresolved[0].dealCount, 2);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.UNCLASSIFIABLE_DEAL_ENTRY
  );
});

test("refuses an out deal that carries the opening direction", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9053", "0.10", BASE_MSC),
        deal({
          position_id: "9053",
          type: 0,
          entry: 1,
          volume: "0.10",
          time_msc: BASE_MSC + 1_000,
        }),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.UNCLASSIFIABLE_DEAL_ENTRY
  );
});

test("keeps an inout deal that adds volume out of the closing count", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9054", "0.10", BASE_MSC, { ticket: "71" }),
        deal({
          position_id: "9054",
          type: 0,
          entry: 2,
          volume: "0.10",
          time_msc: BASE_MSC + 1_000,
          ticket: "72",
        }),
        deal({
          position_id: "9054",
          type: 1,
          entry: 1,
          volume: "0.20",
          time_msc: BASE_MSC + 2_000,
          ticket: "73",
        }),
      ])
    ),
  ]);

  assert.equal(result.closed.length, 1, JSON.stringify(result.unresolved));
  assert.deepEqual(result.closed[0].openingTickets, ["71", "72"]);
  assert.deepEqual(result.closed[0].closingTickets, ["73"]);
  assert.equal(result.closed[0].netVolume, "0");
});

test("leaves a position unresolved when its opening instant is shared", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9055", "0.10", BASE_MSC, { ticket: "81" }),
        closeDeal("9055", "0.10", BASE_MSC, { ticket: "82" }),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.AMBIGUOUS_OPENING_TIME
  );
});

test("leaves a position unresolved when shared instants reorder its deals", () => {
  // The closing ticket sorts first, so the opener cannot be identified
  // from order alone either way.
  const result = reconstructClosedPositions([
    accepted(
      page([
        closeDeal("9056", "0.10", BASE_MSC, { ticket: "83" }),
        openDeal("9056", "0.10", BASE_MSC, { ticket: "84" }),
      ])
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.AMBIGUOUS_OPENING_TIME
  );
});

test("closes a position whose deals share a later instant", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9057", "0.20", BASE_MSC, { ticket: "85" }),
        closeDeal("9057", "0.10", BASE_MSC + 1_000, { ticket: "86" }),
        closeDeal("9057", "0.10", BASE_MSC + 1_000, { ticket: "87" }),
      ])
    ),
  ]);

  assert.equal(result.closed.length, 1, JSON.stringify(result.unresolved));
  assert.deepEqual(result.closed[0].closingTickets, ["86", "87"]);
});

test("proves liveness from a live row whose identity fields agree", () => {
  const row = liveRow("9058");

  assert.equal(row.position_id, row.identifier);

  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9058", "0.10", BASE_MSC),
          closeDeal("9058", "0.10", BASE_MSC + 1_000),
        ],
        [row]
      )
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.scan.acceptedPages, 1);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIFECYCLE_CONTRADICTS_SNAPSHOT
  );
});

test("discards a page whose live row reports two identities", () => {
  const row = liveRow("9059");
  row.identifier = "9959";

  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9059", "0.10", BASE_MSC),
          closeDeal("9059", "0.10", BASE_MSC + 1_000),
        ],
        [row]
      )
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.deepEqual(result.unresolved, []);
  assert.equal(result.scan.acceptedPages, 0);
  assert.equal(result.scan.rejectedPages, 1);
});

test("discards a page whose live row is missing an identity field", () => {
  for (const key of [
    "ticket",
    "position_id",
    "identifier",
    "symbol",
    "type",
    "volume",
  ]) {
    const row = liveRow("9060");
    delete row[key];

    const result = reconstructClosedPositions([
      accepted(
        page(
          [
            openDeal("9060", "0.10", BASE_MSC),
            closeDeal("9060", "0.10", BASE_MSC + 1_000),
          ],
          [row]
        )
      ),
    ]);

    assert.deepEqual(result.closed, [], key);
    assert.equal(result.scan.acceptedPages, 0, key);
    assert.equal(result.scan.rejectedPages, 1, key);
  }
});

test("discards a page whose live row reports a zero volume", () => {
  const row = liveRow("9061");
  row.volume = "0";

  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9061", "0.10", BASE_MSC),
          closeDeal("9061", "0.10", BASE_MSC + 1_000),
        ],
        [row]
      )
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(result.scan.acceptedPages, 0);
  assert.equal(result.scan.rejectedPages, 1);
});

// ============================================================
// 12. Rejected live-snapshot evidence (Phase 1 blocker)
//
// A page that was dropped cannot be read as "nothing was open here".
// When a dropped page covers the instant a closure rests on, the
// closure is demoted to an explicit unresolved reason instead.
// ============================================================

test("refuses a close that rests on an older snapshot when a newer page was rejected", () => {
  const older = accepted(
    page(
      [
        openDeal("9080", "0.10", BASE_MSC, { ticket: "91" }),
        closeDeal("9080", "0.10", BASE_MSC + 1_000, { ticket: "92" }),
      ],
      [],
      { to_utc: "2026-01-05T00:00:00Z" }
    )
  );
  // Dropped for a live row with no identifier, but it still reported an
  // instant and named this position as open.
  const newer = accepted(
    page(
      [],
      [
        {
          ticket: "9",
          position_id: "9080",
          symbol: "EURUSD",
          type: 0,
          volume: "0.1",
        },
      ],
      { to_utc: "2026-01-08T00:00:00Z", from_utc: "2026-01-06T00:00:00Z" }
    )
  );

  const result = reconstructClosedPositions([older, newer]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(result.unresolved[0].retryable, true);
  assert.equal(result.unresolved[0].netVolume, "0");
  assert.equal(result.scan.acceptedPages, 1);
  assert.equal(result.scan.rejectedPages, 1);
  // Rejected evidence never advances the snapshot it would supersede.
  assert.equal(result.scan.liveSnapshotToUtc, "2026-01-05T00:00:00Z");
  assert.equal(result.scan.rejectedSnapshotToUtc, "2026-01-08T00:00:00Z");
  assert.equal(result.scan.snapshotEvidenceIncomplete, true);
  assert.equal(result.scan.coverageComplete, false);
});

test("a rejected sibling page at the newest instant cannot strengthen a close", () => {
  const instant = "2026-01-08T00:00:00Z";

  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9081", "0.10", BASE_MSC, { ticket: "93" }),
          closeDeal("9081", "0.10", BASE_MSC + 1_000, { ticket: "94" }),
        ],
        [],
        { to_utc: instant }
      )
    ),
    accepted(
      page(
        [],
        [
          liveRow("9081"),
          // The row that spoils the page says nothing about 9081, and still
          // the page as a whole is untrustworthy, so its snapshot is unknown.
          {
            ticket: "8",
            position_id: "9999",
            identifier: "9999",
            symbol: "",
            type: 0,
            volume: "0.1",
          },
        ],
        { to_utc: instant, from_utc: "2026-01-07T00:00:00Z" }
      )
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(result.scan.snapshotEvidenceIncomplete, true);
  assert.equal(result.scan.acceptedPages, 1);
  assert.equal(result.scan.rejectedPages, 1);
});

test("the same two pages, both valid, still disagree as an ambiguous snapshot", () => {
  const instant = "2026-01-08T00:00:00Z";

  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9082", "0.10", BASE_MSC, { ticket: "95" }),
          closeDeal("9082", "0.10", BASE_MSC + 1_000, { ticket: "96" }),
        ],
        [],
        { to_utc: instant }
      )
    ),
    accepted(
      page([], [liveRow("9082")], {
        to_utc: instant,
        from_utc: "2026-01-07T00:00:00Z",
      })
    ),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.AMBIGUOUS_LIVE_SNAPSHOT
  );
  assert.equal(result.scan.snapshotAmbiguous, true);
  assert.equal(result.scan.snapshotEvidenceIncomplete, false);
});

test("closes normally when nothing about the newest snapshot was rejected", () => {
  const result = reconstructClosedPositions([
    accepted(
      page([
        openDeal("9083", "0.10", BASE_MSC, { ticket: "97" }),
        closeDeal("9083", "0.10", BASE_MSC + 1_000, { ticket: "98" }),
      ])
    ),
  ]);

  assert.equal(result.closed.length, 1);
  assert.equal(result.closed[0].positionId, "9083");
  assert.equal(result.unresolved.length, 0);
  assert.equal(result.scan.snapshotEvidenceIncomplete, false);
  assert.equal(result.scan.rejectedSnapshotToUtc, null);
});

test("a rejected page whose instant cannot be read is treated as newest evidence", () => {
  const proof = accepted(
    page(
      [
        openDeal("9084", "0.10", BASE_MSC, { ticket: "99" }),
        closeDeal("9084", "0.10", BASE_MSC + 1_000, { ticket: "100" }),
      ],
      [],
      { to_utc: "2026-01-05T00:00:00Z" }
    )
  );

  for (const unusable of [
    accepted(page([], [], { to_utc: "not-a-utc-instant" })),
    accepted({ ...page([]), utc_range: null }),
    { accepted: true, page: null },
    { accepted: false, page: null },
    { accepted: false },
  ]) {
    const result = reconstructClosedPositions([proof, unusable]);

    assert.deepEqual(result.closed, [], JSON.stringify(unusable) ?? "undefined");
    assert.equal(
      result.unresolved[0].reason,
      RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
    );
    assert.equal(result.scan.rejectedSnapshotToUtc, null);
    assert.equal(result.scan.snapshotEvidenceIncomplete, true);
    assert.equal(result.scan.liveSnapshotToUtc, "2026-01-05T00:00:00Z");
  }
});

test("an attestation rejection without a body leaves coverage unknowable", () => {
  // The real refusal body (server/routes/mt5.js historyRefusal) carries no
  // range at all, so a caller rejection has no instant to compare against.
  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9085", "0.10", BASE_MSC, { ticket: "121" }),
          closeDeal("9085", "0.10", BASE_MSC + 1_000, { ticket: "122" }),
        ],
        [],
        { to_utc: "2026-01-05T00:00:00Z" }
      )
    ),
    rejected(),
  ]);

  assert.deepEqual(result.closed, []);
  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(result.scan.acceptedPages, 1);
  assert.equal(result.scan.rejectedPages, 1);
  assert.equal(result.scan.rejectedSnapshotToUtc, null);
  assert.equal(result.scan.snapshotEvidenceIncomplete, true);
});

test("a rejected page older than the accepted snapshot leaves the close alone", () => {
  const newest = accepted(
    page([
      openDeal("9086", "0.10", BASE_MSC, { ticket: "123" }),
      closeDeal("9086", "0.10", BASE_MSC + 1_000, { ticket: "124" }),
    ])
  );
  const stale = accepted(
    page(
      [],
      [
        {
          ticket: "9",
          position_id: "9086",
          symbol: "EURUSD",
          type: 0,
          volume: "0.1",
        },
      ],
      { to_utc: "2026-01-02T00:00:00Z", from_utc: FROM }
    )
  );

  const result = reconstructClosedPositions([newest, stale]);

  assert.equal(result.closed.length, 1, JSON.stringify(result.unresolved));
  assert.equal(result.closed[0].positionId, "9086");
  assert.equal(result.scan.snapshotEvidenceIncomplete, false);
  assert.equal(result.scan.rejectedSnapshotToUtc, "2026-01-02T00:00:00Z");
  assert.equal(result.scan.rejectedPages, 1);
});

test("suppressed closures keep their deal evidence and their financial records", () => {
  const body = page(
    [
      openDeal("9087", "0.10", BASE_MSC, { ticket: "131" }),
      closeDeal("9087", "0.10", BASE_MSC + 1_000, { ticket: "132" }),
      openDeal("9088", "0.20", BASE_MSC + 2_000, { ticket: "133" }),
      closeDeal("9088", "0.20", BASE_MSC + 3_000, { ticket: "134" }),
      deal({
        ticket: "135",
        type: 2,
        entry: 0,
        volume: "0",
        position_id: "0",
        symbol: "",
        time_msc: BASE_MSC + 4_000,
      }),
    ],
    [],
    { to_utc: "2026-01-05T00:00:00Z" }
  );

  const result = reconstructClosedPositions([accepted(body), rejected()]);

  assert.deepEqual(result.closed, []);
  assert.deepEqual(
    result.unresolved.map((entry) => entry.positionId),
    ["9087", "9088"]
  );

  for (const entry of result.unresolved) {
    assert.equal(entry.reason, RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE);
    assert.equal(entry.netVolume, "0");
    assert.equal(entry.dealCount, 2);
    assert.equal(entry.dealTickets.length, 2);
  }

  assert.deepEqual(result.financialDeals, [
    { ticket: "135", type: 2, timeMsc: BASE_MSC + 4_000 },
  ]);
});

test("rejected evidence does not change reasons that do not rest on absence", () => {
  const result = reconstructClosedPositions([
    accepted(
      page(
        [
          openDeal("9089", "0.10", BASE_MSC, { ticket: "141" }),
          closeDeal("9089", "0.20", BASE_MSC + 1_000, { ticket: "142" }),
        ],
        [],
        { to_utc: "2026-01-05T00:00:00Z" }
      )
    ),
    rejected(),
  ]);

  assert.equal(
    result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.VOLUME_NET_NEGATIVE
  );
  assert.equal(result.scan.snapshotEvidenceIncomplete, true);
});
