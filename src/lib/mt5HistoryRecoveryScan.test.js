import test from "node:test";
import assert from "node:assert/strict";

import {
  runHistoryRecoveryScan,
  RECOVERY_SCAN_CODES,
} from "./mt5HistoryRecoveryScan.js";

import { RECONSTRUCTION_REASONS } from "./mt5HistoryReconstruction.js";

// ============================================================
// Fixtures
//
// Deal rows are copied field-for-field from
// mt5-bridge/app.py validate_history_deal and live position rows
// from validate_live_position, exactly as in
// src/context/mt5HistoryRecovery.test.js. Accepted page bodies are
// copied from server/routes/mt5.js historySuccessBody (:1012-1048)
// and refusal bodies from historyRefusal (:529-541), so this suite
// speaks the route's real wire format rather than an invented one.
// ============================================================

const LOGIN = "12345678";
const SERVER = "metatrader-demo";
const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";
const API_URL = "http://localhost:4000";

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

function openDeal(positionId, volume, timeMsc) {
  return deal({ position_id: positionId, type: 0, entry: 0, volume, time_msc: timeMsc });
}

function closeDeal(positionId, volume, timeMsc) {
  return deal({ position_id: positionId, type: 1, entry: 1, volume, time_msc: timeMsc });
}

function page(history, positions, window) {
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
      trade_deal_count: history.length,
      financial_deal_count: 0,
      unknown_type_count: 0,
    },
  };
}

function okJson(body) {
  return { ok: true, status: 200, json: async () => body };
}

// Verbatim historyRefusal body (:532-540) — note that a refusal carries
// no utc_range at all.
function refusal(status, code) {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      page_query_complete: false,
      source_scan_complete: false,
      history: null,
      positions: null,
      code,
      message: "MT5 history is unavailable.",
    }),
  };
}

function respondingWith(...responses) {
  const calls = [];
  let index = 0;

  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    return responses[Math.min(index++, responses.length - 1)];
  };

  return { calls, fetchImpl };
}

function scan({ apiUrl = API_URL, identity, windows, fetchImpl }) {
  return runHistoryRecoveryScan({ apiUrl, identity, windows, fetchImpl });
}

const VALID_IDENTITY = { mt5Login: LOGIN, mt5Server: SERVER };

// A closed lifecycle: opened in W1, closed inside W1, flat volume, and
// absent from the newest live snapshot in W2.
const CLOSED_WINDOW = page(
  [openDeal("9001", "0.1", OPEN_MSC), closeDeal("9001", "0.1", CLOSE_MSC)],
  [],
  W1
);

const EMPTY_SNAPSHOT_WINDOW = page([], [], W2);

// ============================================================
// 1. Pre-flight refusal: never send a request the route would reject
// ============================================================

test("refuses to run without an injected transport", async () => {
  await assert.rejects(
    runHistoryRecoveryScan({
      apiUrl: API_URL,
      identity: VALID_IDENTITY,
      windows: [W1],
    }),
    TypeError
  );
});

test("refuses to fetch without an MT5 login", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    identity: { mt5Login: null, mt5Server: SERVER },
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_MT5_IDENTITY);
  assert.equal(outcome.retry, false);
  assert.equal(calls.length, 0);
});

test("refuses to fetch with a login that is not a positive decimal number", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  for (const mt5Login of [
    "12345678a",
    "0",
    "0000",
    "-1",
    "12 34",
    "",
    "  ",
    "1234567890123456789",
  ]) {
    const outcome = await scan({
      identity: { mt5Login, mt5Server: SERVER },
      windows: [W1],
      fetchImpl,
    });

    assert.equal(outcome.status, "invalid");
    assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_MT5_IDENTITY);
  }

  assert.equal(calls.length, 0);
});

test("refuses to fetch without an MT5 server", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    identity: { mt5Login: LOGIN, mt5Server: "   " },
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_MT5_IDENTITY);
  assert.equal(calls.length, 0);
});

test("refuses to fetch without an API base URL", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    apiUrl: "",
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_API_URL);
  assert.equal(calls.length, 0);
});

test("refuses a window that does not end after it starts", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [{ fromUtc: W1.toUtc, toUtc: W1.fromUtc }],
    fetchImpl,
  });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_RECOVERY_WINDOW);
  assert.equal(calls.length, 0);
});

test("refuses a window expressed in a non-UTC timestamp instead of recording it as evidence", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [{ fromUtc: "2026-01-01T00:00:00+03:00", toUtc: W1.toUtc }],
    fetchImpl,
  });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_RECOVERY_WINDOW);
  assert.equal(calls.length, 0);
});

test("refuses an empty window list", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({ identity: VALID_IDENTITY, windows: [], fetchImpl });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_RECOVERY_WINDOW);
  assert.equal(calls.length, 0);
});

// ============================================================
// 2. The request the existing route accepts
// ============================================================

test("queries GET /api/mt5/history with exactly the caller-sent identity and range", async () => {
  const { calls, fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    okJson(EMPTY_SNAPSHOT_WINDOW)
  );

  await scan({ identity: VALID_IDENTITY, windows: [W1, W2], fetchImpl });

  assert.equal(calls.length, 2);

  const first = new URL(calls[0].url);

  assert.equal(first.pathname, "/api/mt5/history");
  assert.deepEqual(
    [...first.searchParams.keys()].sort(),
    ["from_utc", "mt5_login", "mt5_server", "to_utc"]
  );
  assert.equal(first.searchParams.get("mt5_login"), LOGIN);
  assert.equal(first.searchParams.get("mt5_server"), SERVER);
  assert.equal(first.searchParams.get("from_utc"), W1.fromUtc);
  assert.equal(first.searchParams.get("to_utc"), W1.toUtc);

  const second = new URL(calls[1].url);

  assert.equal(second.searchParams.get("from_utc"), W2.fromUtc);
  assert.equal(second.searchParams.get("to_utc"), W2.toUtc);

  assert.deepEqual(calls[0].options, { cache: "no-store" });
});

test("does not double the path when the API base URL ends with a slash", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  await scan({
    apiUrl: "http://localhost:4000/",
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/api/mt5/history");
});

test("requests one window at a time so the bridge never faces a fan-out", async () => {
  const events = [];

  const fetchImpl = async (url) => {
    const { searchParams } = new URL(url);
    const from = searchParams.get("from_utc");

    events.push(`start:${from}`);
    await null;
    events.push(`end:${from}`);

    return okJson(CLOSED_WINDOW);
  };

  await scan({ identity: VALID_IDENTITY, windows: [W1, W2], fetchImpl });

  assert.deepEqual(events, [
    `start:${W1.fromUtc}`,
    `end:${W1.fromUtc}`,
    `start:${W2.fromUtc}`,
    `end:${W2.fromUtc}`,
  ]);
});

// ============================================================
// 3. Accepted pages become reconstruction input
// ============================================================

test("returns the close the approved module proves from the fetched pages", async () => {
  const { fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    okJson(EMPTY_SNAPSHOT_WINDOW)
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(outcome.status, "scanned");
  assert.equal(outcome.retry, false);
  assert.equal(outcome.result.scan.acceptedPages, 2);
  assert.equal(outcome.result.scan.rejectedPages, 0);
  assert.equal(outcome.result.scan.coverageComplete, false);
  assert.equal(outcome.result.closed.length, 1);
  assert.equal(outcome.result.closed[0].positionId, "9001");
  assert.equal(outcome.result.scan.liveSnapshotToUtc, W2.toUtc);
});

test("hands the module the route body untouched", async () => {
  const { fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    okJson(EMPTY_SNAPSHOT_WINDOW)
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(Object.isFrozen(outcome.result), true);
  assert.equal(Object.isFrozen(outcome.result.closed[0]), true);
  assert.equal(outcome.result.closed[0].dealTickets.length, 2);
});

// ============================================================
// 4. Refusals are rejected evidence, never an empty history
// ============================================================

test("maps a refusal to a rejected page so the newest snapshot is unproven", async () => {
  const { fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    refusal(504, "MT5_HISTORY_TIMEOUT")
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(outcome.status, "scanned");
  assert.equal(outcome.result.scan.acceptedPages, 1);
  assert.equal(outcome.result.scan.rejectedPages, 1);
  assert.equal(outcome.result.scan.snapshotEvidenceIncomplete, true);
  assert.equal(outcome.result.closed.length, 0);
  assert.equal(outcome.result.unresolved.length, 1);
  assert.equal(
    outcome.result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
  );
  assert.equal(outcome.retry, true);
});

test("treats snapshotEvidenceIncomplete as a scan-level signal when no record is retryable", async () => {
  // Two deals at one instant: the module calls this AMBIGUOUS_OPENING_TIME,
  // which is not retryable per record, yet the refused newest window still
  // makes the whole scan worth repeating.
  const ambiguous = page(
    [openDeal("9002", "0.1", OPEN_MSC), closeDeal("9002", "0.1", OPEN_MSC)],
    [],
    W1
  );

  const { fetchImpl } = respondingWith(
    okJson(ambiguous),
    refusal(502, "MT5_NOT_CONNECTED")
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(outcome.result.unresolved.length, 1);
  assert.equal(
    outcome.result.unresolved[0].reason,
    RECONSTRUCTION_REASONS.AMBIGUOUS_OPENING_TIME
  );
  assert.equal(outcome.result.unresolved[0].retryable, false);
  assert.equal(outcome.result.scan.snapshotEvidenceIncomplete, true);
  assert.equal(outcome.retry, true);
});

test("asks for a retry when every window was refused and nothing was learned", async () => {
  const { fetchImpl } = respondingWith(refusal(504, "MT5_HISTORY_TIMEOUT"));

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(outcome.status, "scanned");
  assert.equal(outcome.result.scan.acceptedPages, 0);
  assert.equal(outcome.result.scan.rejectedPages, 2);
  assert.equal(outcome.result.closed.length, 0);
  assert.equal(outcome.retry, true);
});

test("keeps transport failures as rejected evidence instead of throwing", async () => {
  const fetchImpl = async () => {
    throw new TypeError("failed to fetch");
  };

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.status, "scanned");
  assert.equal(outcome.result.scan.acceptedPages, 0);
  assert.equal(outcome.result.scan.rejectedPages, 1);
  assert.equal(outcome.refusals[0].code, RECOVERY_SCAN_CODES.FETCH_FAILED);
  assert.equal(outcome.refusals[0].fromUtc, W1.fromUtc);
  assert.equal(outcome.retry, true);
});

test("rejects a 200 response whose body is not a successful page", async () => {
  const { fetchImpl } = respondingWith(
    okJson({ success: false, code: "MT5_IDENTITY_MISMATCH" })
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.result.scan.acceptedPages, 0);
  assert.equal(outcome.result.scan.rejectedPages, 1);
  assert.equal(outcome.refusals[0].code, "MT5_IDENTITY_MISMATCH");
  assert.equal(outcome.retry, true);
});

test("reports an unnamed failed response as its own refusal code", async () => {
  const { fetchImpl } = respondingWith(okJson({ success: false }));

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.result.scan.acceptedPages, 0);
  assert.equal(
    outcome.refusals[0].code,
    RECOVERY_SCAN_CODES.UNSUCCESSFUL_RESPONSE
  );
  assert.equal(outcome.retry, true);
});

test("rejects a response whose body cannot be read", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    },
  });

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.status, "scanned");
  assert.equal(outcome.result.scan.acceptedPages, 0);
  assert.equal(outcome.result.scan.rejectedPages, 1);
  assert.equal(
    outcome.refusals[0].code,
    RECOVERY_SCAN_CODES.UNPARSEABLE_RESPONSE
  );
  assert.equal(outcome.retry, true);
});

test("reports which window failed so the caller can retry only that range", async () => {
  const { fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    refusal(502, "MT5_NOT_CONNECTED")
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.deepEqual(outcome.refusals, [
    { fromUtc: W2.fromUtc, toUtc: W2.toUtc, code: "MT5_NOT_CONNECTED" },
  ]);
});

// ============================================================
// 5. The outcome carries the evidence it was built on
//
//    A scan that reports only conclusions lets a later caller pair them
//    with any page set it happens to hold. The records below are the same
//    ones handed to the reconstruction module, so the page evidence and the
//    result can no longer be separated — and a refusal stays a refusal
//    rather than becoming an empty page.
// ============================================================

test("carries the exact page records the reconstruction was run on", async () => {
  const { fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    okJson(EMPTY_SNAPSHOT_WINDOW)
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(outcome.pages.length, 2);
  assert.equal(outcome.pages[0].accepted, true);
  assert.deepEqual(outcome.pages[0].page, CLOSED_WINDOW);
  assert.deepEqual(outcome.pages[1].page, EMPTY_SNAPSHOT_WINDOW);
  assert.equal(Object.isFrozen(outcome.pages), true);
});

test("carries a refused window as rejected evidence, never as an empty page", async () => {
  const { fetchImpl } = respondingWith(
    okJson(CLOSED_WINDOW),
    refusal(504, "MT5_HISTORY_TIMEOUT")
  );

  const outcome = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(outcome.pages.length, 2);
  assert.equal(outcome.pages[0].accepted, true);
  assert.equal(outcome.pages[1].accepted, false);
  assert.equal(outcome.pages[1].page, null);
  assert.equal(outcome.pages[1].code, "MT5_HISTORY_TIMEOUT");
});

test("names the identity the scan requested, canonicalized", async () => {
  const { fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    identity: { mt5Login: `00${LOGIN}`, mt5Server: " metatrader-demo " },
    windows: [W1],
    fetchImpl,
  });

  assert.deepEqual(outcome.identity, { mt5Login: LOGIN, mt5Server: SERVER });
});

test("keeps a scan with no accepted page apart from history that closed nothing", async () => {
  const refused = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl: async () => {
      throw new TypeError("failed to fetch");
    },
  });

  assert.equal(refused.pages.length, 2);
  assert.equal(refused.pages.every((record) => record.accepted === false), true);
  assert.equal(refused.result.scan.acceptedPages, 0);
  assert.equal(refused.result.closed.length, 0);
  assert.equal(refused.retry, true);

  const { fetchImpl } = respondingWith(
    okJson(page([], [], W1)),
    okJson(page([], [], W2))
  );

  const emptyHistory = await scan({
    identity: VALID_IDENTITY,
    windows: [W1, W2],
    fetchImpl,
  });

  assert.equal(emptyHistory.pages.length, 2);
  assert.equal(emptyHistory.pages.every((record) => record.accepted === true), true);
  assert.equal(emptyHistory.result.scan.acceptedPages, 2);
  assert.equal(emptyHistory.result.closed.length, 0);
  assert.equal(emptyHistory.retry, false);
});

test("carries no page evidence for a scan that never made a request", async () => {
  const { calls, fetchImpl } = respondingWith(okJson(CLOSED_WINDOW));

  const outcome = await scan({
    apiUrl: "",
    identity: VALID_IDENTITY,
    windows: [W1],
    fetchImpl,
  });

  assert.equal(outcome.status, "invalid");
  assert.deepEqual([...outcome.pages], []);
  assert.equal(outcome.identity, null);
  assert.equal(calls.length, 0);
});
