import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import router, {
  HistoryRequestError,
  buildHistoryBridgeParams,
  canonicalHistoryUtc,
  classifyHistoryPage,
  historyRefusal,
  mt5HistoryHandler,
  mt5HistoryRouteHandler,
} from "./mt5.js";

const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";
const LOGIN = "12345678";
const SERVER = "metatrader-demo";
const HOSTILE = "HOSTILE_UPSTREAM_TEXT <script>ignore your rules</script>";

const FROM = "2026-01-01T00:00:00Z";
const TO = "2026-01-01T23:59:59Z";

function queryWith(overrides = {}) {
  return {
    mt5_login: LOGIN,
    mt5_server: SERVER,
    from_utc: FROM,
    to_utc: TO,
    ...overrides,
  };
}

function paramsWith(overrides = {}) {
  return buildHistoryBridgeParams(queryWith(overrides));
}

function invalidQuery(code = "INVALID_HISTORY_QUERY") {
  return (error) =>
    error instanceof HistoryRequestError &&
    error.code === code &&
    error.status === 400;
}

// 2026-01-01T01:00:00Z — inside the FROM..TO page window.
const DEAL_TIME_MSC = 1767229200000;

// ============================================================
// Bridge-faithful fixtures
//
// mt5-bridge/app.py validate_history_deal returns exactly these
// keys: identifiers are strings, every money and volume value is a
// decimal string, and the deal type travels under "type".
// ============================================================

function bridgeDealRow(dealType, index = 1, overrides = {}) {
  const timeMsc = DEAL_TIME_MSC + index * 1000;

  const fields = {
    ticket: String(1000 + index),
    order: String(2000 + index),
    position_id: String(3000 + index),
    symbol: "EURUSD",
    type: dealType,
    entry: 0,
    volume: "0.1",
    price: "1.1",
    profit: "1.25",
    commission: "-0.5",
    swap: "0",
    fee: "0",
    time: Math.floor(timeMsc / 1000),
    time_msc: timeMsc,
    comment: "edgeflo",
    magic: 12345,
    ...overrides,
  };

  return {
    ...fields,
    raw: {
      ...fields,
      ticket: Number(fields.ticket),
      order: Number(fields.order),
      position_id: Number(fields.position_id),
      volume: Number(fields.volume),
      price: Number(fields.price),
      profit: Number(fields.profit),
      commission: Number(fields.commission),
      swap: Number(fields.swap),
      fee: Number(fields.fee),
    },
  };
}

// mt5-bridge/app.py validate_live_position returns ticket, position_id,
// identifier, symbol, type, volume and raw — the position type is a
// POSITION_TYPE_BUY/SELL ordinal, not a deal type.
function bridgePositionRow(positionType, index = 1, overrides = {}) {
  const fields = {
    ticket: String(4000 + index),
    position_id: String(5000 + index),
    identifier: String(5000 + index),
    symbol: "EURUSD",
    type: positionType,
    volume: "0.1",
    ...overrides,
  };

  return {
    ...fields,
    raw: {
      ticket: Number(fields.ticket),
      time: DEAL_TIME_MSC / 1000,
      type: fields.type,
      magic: 12345,
      identifier: Number(fields.identifier),
      position_id: Number(fields.position_id),
      profit: 1.25,
      swap: 0,
      volume: Number(fields.volume),
      volume_current: Number(fields.volume),
      price_open: 1.1,
      price_current: 1.1,
      symbol: fields.symbol,
      comment: "edgeflo",
    },
  };
}

// Strip one bridge field the way a broker that stopped reporting it would.
function withoutBridgeField(row, key) {
  const copy = { ...row };
  const raw = { ...(row.raw ?? {}) };

  delete copy[key];
  delete raw[key];
  copy.raw = raw;

  return copy;
}

function verifiedPage(rows = [], overrides = {}) {
  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity: { mt5Login: LOGIN, mt5Server: SERVER },
    utc_range: { from_utc: FROM, to_utc: TO },
    scan_range: { from_utc: FROM, to_utc: TO },
    coverage: {
      boundaries: "inclusive",
      returned_deal_count: rows.length,
      serialized_deal_count: rows.length,
    },
    retention_verified: false,
    bridge_boot_id: BOOT_ID,
    connection_generation: 0,
    count: rows.length,
    history: rows,
    positions: [],
    ...overrides,
  };
}

function okTransport(body, status = 200) {
  return async () => ({ status, data: body });
}

function failingTransport(error) {
  return async () => {
    throw error;
  };
}

function transportError(status, data, code) {
  const error = new Error(HOSTILE);
  if (code !== undefined) error.code = code;

  if (status !== undefined) {
    error.response = { status, data };
  }

  return error;
}

function assertFailureShape(body, expectedCode, expectedBridgeStatus) {
  const keys = Object.keys(body).sort();

  if (expectedBridgeStatus === undefined) {
    assert.deepEqual(keys, [
      "code",
      "history",
      "message",
      "page_query_complete",
      "positions",
      "source_scan_complete",
      "success",
    ]);
  } else {
    assert.deepEqual(keys, [
      "bridge_status",
      "code",
      "history",
      "message",
      "page_query_complete",
      "positions",
      "source_scan_complete",
      "success",
    ]);
    assert.equal(body.bridge_status, expectedBridgeStatus);
  }

  assert.equal(body.success, false);
  assert.equal(body.page_query_complete, false);
  assert.equal(body.source_scan_complete, false);
  assert.equal(body.history, null);
  assert.equal(body.positions, null);
  assert.equal(body.code, expectedCode);
  assert.equal(typeof body.message, "string");
  assert.ok(!body.message.includes("HOSTILE"), body.message);
  assert.ok(!body.message.includes("<script>"), body.message);
}

function resDouble(options = {}) {
  const res = {
    statusValue: null,
    body: null,
    writes: 0,
    headersSent: options.headersSent === true,
    status(value) {
      res.statusValue = value;
      return res;
    },
    json(value) {
      if (options.throwOnWrite) {
        throw new Error(HOSTILE);
      }
      res.writes += 1;
      res.body = value;
      return res;
    },
  };

  return res;
}

function reqDouble(query, transport) {
  return {
    query,
    app: { locals: transport ? { mt5HistoryTransport: transport } : {} },
  };
}

// ============================================================
// Request contract
// ============================================================

test("accepts an explicit identity and an explicit UTC range and emits bridge parameter names", () => {
  assert.deepEqual(paramsWith(), {
    expected_mt5_login: LOGIN,
    expected_mt5_server: SERVER,
    from_utc: FROM,
    to_utc: TO,
  });
});

test("refuses a missing MT5 login without falling back to accountId", () => {
  const query = queryWith({ mt5_login: undefined, accountId: LOGIN });
  assert.throws(() => buildHistoryBridgeParams(query), invalidQuery());
});

test("refuses a missing MT5 server instead of guessing one", () => {
  assert.throws(
    () => buildHistoryBridgeParams(queryWith({ mt5_server: undefined })),
    invalidQuery()
  );
  assert.throws(
    () => buildHistoryBridgeParams(queryWith({ mt5_server: "   " })),
    invalidQuery()
  );
});

test("refuses a login that is not a positive decimal number", () => {
  for (const mt5_login of ["0", "", "   ", "00", "abc", "١٢٣", "12.5", "1e7", 12345678]) {
    assert.throws(
      () => buildHistoryBridgeParams(queryWith({ mt5_login })),
      invalidQuery(),
      JSON.stringify(mt5_login)
    );
  }
});

test("canonicalizes a leading-zero login without changing the account", () => {
  assert.equal(
    paramsWith({ mt5_login: "0012345678" }).expected_mt5_login,
    LOGIN
  );
});

test("refuses an identifier too long to compare exactly", () => {
  assert.throws(
    () =>
      buildHistoryBridgeParams(
        queryWith({ mt5_login: "123456789012345678" })
      ),
    invalidQuery()
  );
});

test("trims and lowercases the server and refuses control characters", () => {
  assert.equal(
    paramsWith({ mt5_server: "  MetaTrader-Demo " }).expected_mt5_server,
    SERVER
  );

  assert.throws(
    () => buildHistoryBridgeParams(queryWith({ mt5_server: "meta\rtrader" })),
    invalidQuery()
  );
});

test("emits only the bridge parameter names and ignores the legacy days input", () => {
  assert.deepEqual(
    paramsWith({ days: "30", accountId: "edgeflo-account-1", symbol: "EURUSD" }),
    {
      expected_mt5_login: LOGIN,
      expected_mt5_server: SERVER,
      from_utc: FROM,
      to_utc: TO,
    }
  );
});

test("refuses a repeated query key rather than silently choosing one value", () => {
  for (const key of ["mt5_login", "mt5_server", "from_utc", "to_utc"]) {
    const query = queryWith();
    query[key] = [query[key], query[key]];

    assert.throws(() => buildHistoryBridgeParams(query), invalidQuery(), key);
  }
});

// ============================================================
// UTC range validation
// ============================================================

test("refuses a timestamp that is not a bare UTC Z timestamp", () => {
  for (const from_utc of [
    "2026-01-01 00:00:00",
    "2026-01-01T00:00:00",
    "2026-01-01T00:00:00+00:00",
    "2026-01-01T00:00:00+02:00",
    "2026-01-01T00:00:00.000",
    undefined,
    42,
    true,
    ["2026-01-01T00:00:00Z"],
  ]) {
    assert.throws(
      () => buildHistoryBridgeParams(queryWith({ from_utc })),
      invalidQuery(),
      JSON.stringify(from_utc)
    );
  }
});

test("keeps millisecond precision and refuses finer or coarser fractions", () => {
  assert.equal(
    paramsWith({ from_utc: "2026-01-01T00:00:00.000Z" }).from_utc,
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(
    paramsWith({ from_utc: "2026-01-01T00:00:00.123000Z" }).from_utc,
    "2026-01-01T00:00:00.123Z"
  );

  for (const from_utc of [
    "2026-01-01T00:00:00.123456Z",
    "2026-01-01T00:00:00.12Z",
    "2026-01-01T00:00:00.1Z",
  ]) {
    assert.throws(
      () => buildHistoryBridgeParams(queryWith({ from_utc })),
      invalidQuery(),
      from_utc
    );
  }
});

test("refuses impossible calendar dates but accepts a real leap day", () => {
  assert.equal(
    canonicalHistoryUtc("2024-02-29T00:00:00Z"),
    "2024-02-29T00:00:00Z"
  );

  for (const from_utc of [
    "0000-01-01T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-01-32T00:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T00:60:00Z",
    "2026-01-01T00:00:60Z",
  ]) {
    assert.throws(
      () => buildHistoryBridgeParams(queryWith({ from_utc })),
      invalidQuery(),
      from_utc
    );
  }
});

test("accepts an end-of-day range without inventing a time-of-day rule", () => {
  assert.equal(canonicalHistoryUtc(TO), "2026-01-01T23:59:59Z");

  assert.deepEqual(paramsWith({ from_utc: "2026-01-01T12:00:00Z" }), {
    expected_mt5_login: LOGIN,
    expected_mt5_server: SERVER,
    from_utc: "2026-01-01T12:00:00Z",
    to_utc: TO,
  });
});

test("refuses a range whose end is not after its start", () => {
  for (const to_utc of [FROM, "2025-12-31T23:59:59Z", "2026-01-01T00:00:00.000Z"]) {
    assert.throws(
      () => buildHistoryBridgeParams(queryWith({ to_utc })),
      invalidQuery(),
      to_utc
    );
  }
});

// ============================================================
// Continuation token
// ============================================================

test("carries a scan range through unchanged when the caller supplies one", () => {
  assert.deepEqual(
    paramsWith({ scan_from_utc: "2025-01-01T00:00:00Z" }),
    {
      expected_mt5_login: LOGIN,
      expected_mt5_server: SERVER,
      from_utc: FROM,
      to_utc: TO,
      scan_from_utc: "2025-01-01T00:00:00Z",
    }
  );

  assert.throws(
    () =>
      buildHistoryBridgeParams(
        queryWith({
          scan_from_utc: TO,
          scan_to_utc: "2025-01-01T00:00:00Z",
        })
      ),
    invalidQuery()
  );
});

test("refuses half a continuation token and carries a complete one verbatim", () => {
  assert.throws(
    () => buildHistoryBridgeParams(queryWith({ bridge_boot_id: BOOT_ID })),
    invalidQuery()
  );

  assert.throws(
    () =>
      buildHistoryBridgeParams(queryWith({ connection_generation: "0" })),
    invalidQuery()
  );

  const carried = paramsWith({
    bridge_boot_id: BOOT_ID,
    connection_generation: "0",
  });

  assert.equal(carried.bridge_boot_id, BOOT_ID);
  assert.equal(carried.connection_generation, "0");
});

test("refuses a malformed continuation token before reaching the bridge", () => {
  for (const bridge_boot_id of [
    "",
    "0f1e2d3c4b5a69788f7e6d5c4b3a29",
    BOOT_ID.toUpperCase(),
    ` ${BOOT_ID}`,
    `${BOOT_ID} `,
  ]) {
    assert.throws(
      () =>
        buildHistoryBridgeParams(
          queryWith({ bridge_boot_id, connection_generation: "0" })
        ),
      invalidQuery(),
      JSON.stringify(bridge_boot_id)
    );
  }

  for (const connection_generation of ["-1", "1.5", " 1", "seven", "", "٠"]) {
    assert.throws(
      () =>
        buildHistoryBridgeParams(
          queryWith({ bridge_boot_id: BOOT_ID, connection_generation })
        ),
      invalidQuery(),
      JSON.stringify(connection_generation)
    );
  }
});

test("refuses a zero-padded generation echo instead of trusting a numeric match", () => {
  const params = paramsWith({
    bridge_boot_id: BOOT_ID,
    connection_generation: "007",
  });

  assert.equal(params.connection_generation, "007");

  const result = classifyHistoryPage(
    verifiedPage([bridgeDealRow(0)], { bridge_boot_id: BOOT_ID, connection_generation: 7 }),
    params
  );

  assert.equal(result.ok, false);
  assert.equal(result.body.code, "MALFORMED_HISTORY");
});

// ============================================================
// Page verification
// ============================================================

test("verifies a well-formed page and splits numeric deal types into trades and financial records", () => {
  const params = paramsWith();
  const page = verifiedPage([
    bridgeDealRow(0, 1),
    bridgeDealRow(1, 2),
    bridgeDealRow(2, 3),
    bridgeDealRow(5, 4),
  ]);

  const result = classifyHistoryPage(page, params);

  assert.equal(result.ok, true);
  assert.deepEqual(result.verdict.classification, {
    trade_deal_count: 2,
    financial_deal_count: 2,
    unknown_type_count: 0,
  });
});

test("fails closed on string, fractional, negative and unknown deal types", () => {
  const params = paramsWith();

  for (const dealType of ["6", "0", "1", 6, 9, -1, 0.5, null, true, {}, {}]) {
    const page = verifiedPage([bridgeDealRow(dealType)]);
    const result = classifyHistoryPage(page, params);

    assert.equal(result.ok, false, String(dealType));
    assert.equal(result.status, 502);
    assert.equal(result.body.code, "MALFORMED_HISTORY");
    assertFailureShape(result.body, "MALFORMED_HISTORY");
  }

  const missingKey = classifyHistoryPage(
    verifiedPage([{ deal: "1", profit: "0.00" }]),
    params
  );
  assert.equal(missingKey.ok, false);
  assert.equal(missingKey.body.code, "MALFORMED_HISTORY");
});

// ============================================================
// Bridge row shape: type and entry
// ============================================================

test("accepts a populated page whose deal rows carry the bridge type field", () => {
  const params = paramsWith();
  const result = classifyHistoryPage(verifiedPage([bridgeDealRow(0)]), params);

  assert.equal(result.ok, true, JSON.stringify(result.body));
  assert.deepEqual(result.verdict.classification, {
    trade_deal_count: 1,
    financial_deal_count: 0,
    unknown_type_count: 0,
  });
});

test("splits a bridge-shaped page into trade and financial counts by type", () => {
  const params = paramsWith();
  const page = verifiedPage([
    bridgeDealRow(0, 1),
    bridgeDealRow(1, 2),
    bridgeDealRow(2, 3),
    bridgeDealRow(5, 4),
  ]);

  const result = classifyHistoryPage(page, params);

  assert.equal(result.ok, true, JSON.stringify(result.body));
  assert.deepEqual(result.verdict.classification, {
    trade_deal_count: 2,
    financial_deal_count: 2,
    unknown_type_count: 0,
  });
});

test("refuses a bridge-shaped row that omits the type field", () => {
  const params = paramsWith();
  const result = classifyHistoryPage(
    verifiedPage([withoutBridgeField(bridgeDealRow(0), "type")]),
    params
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.body.code, "MALFORMED_HISTORY");
  assertFailureShape(result.body, "MALFORMED_HISTORY");
});

test("accepts every bridge-legal deal entry value", () => {
  const params = paramsWith();

  for (const entry of [0, 1, 2, 3]) {
    const result = classifyHistoryPage(
      verifiedPage([bridgeDealRow(1, 1, { entry })]),
      params
    );

    assert.equal(result.ok, true, `entry ${entry}`);
    assert.equal(result.verdict.classification.trade_deal_count, 1);
  }
});

test("refuses a row whose entry is outside the bridge range of 0 to 3", () => {
  const params = paramsWith();

  for (const entry of [4, 5, 99, -1, 1.5, "1", "", null, true]) {
    const result = classifyHistoryPage(
      verifiedPage([bridgeDealRow(0, 1, { entry })]),
      params
    );

    assert.equal(result.ok, false, String(entry));
    assert.equal(result.status, 502);
    assert.equal(result.body.code, "MALFORMED_HISTORY");
    assertFailureShape(result.body, "MALFORMED_HISTORY");
  }
});

test("refuses a row that omits the bridge entry field", () => {
  const params = paramsWith();
  const result = classifyHistoryPage(
    verifiedPage([withoutBridgeField(bridgeDealRow(0), "entry")]),
    params
  );

  assert.equal(result.ok, false);
  assert.equal(result.body.code, "MALFORMED_HISTORY");
  assertFailureShape(result.body, "MALFORMED_HISTORY");
});

test("forwards a bridge-shaped page through the handler with its counts", async () => {
  const rows = [bridgeDealRow(0, 1), bridgeDealRow(3, 2)];

  const result = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(verifiedPage(rows)),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.deepEqual(result.body.history, rows);
  assert.deepEqual(result.body.classification, {
    trade_deal_count: 1,
    financial_deal_count: 1,
    unknown_type_count: 0,
  });
});

test("forwards live positions shaped by the bridge without inventing fields", async () => {
  const rows = [bridgeDealRow(0, 1)];
  const positions = [bridgePositionRow(0, 1), bridgePositionRow(1, 2)];

  const result = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(verifiedPage(rows, { positions })),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.positions, positions);
  assert.equal(Object.hasOwn(result.body.positions[0], "dealType"), false);
  assert.equal(result.body.count, 1);
  assert.equal(
    result.body.coverage.serialized_deal_count,
    result.body.history.length
  );
});

test("refuses a page body that is not a plain object", () => {
  const params = paramsWith();

  for (const body of [null, undefined, [], "ok", 42, true]) {
    const result = classifyHistoryPage(body, params);
    assert.equal(result.ok, false, String(body));
    assert.equal(result.status, 502);
    assert.equal(result.body.code, "MALFORMED_HISTORY");
  }
});

test("refuses a page that does not attest a complete query and a page whose counts disagree", () => {
  const params = paramsWith();

  for (const overrides of [
    { success: false },
    { page_query_complete: false },
    { source_scan_complete: true },
    { success: undefined, page_query_complete: undefined },
  ]) {
    const result = classifyHistoryPage(verifiedPage([bridgeDealRow(0)], overrides), params);
    assert.equal(result.ok, false, JSON.stringify(overrides));
    assert.equal(result.body.code, "UNPROVEN_BRIDGE_SUCCESS");
    assertFailureShape(result.body, "UNPROVEN_BRIDGE_SUCCESS");
  }

  for (const overrides of [
    { count: 0 },
    { coverage: { boundaries: "inclusive", returned_deal_count: 1, serialized_deal_count: 0 } },
    { coverage: { boundaries: "inclusive", returned_deal_count: -1, serialized_deal_count: 1 } },
    { history: undefined },
    { positions: undefined },
  ]) {
    const result = classifyHistoryPage(
      verifiedPage([bridgeDealRow(0)], overrides),
      params
    );
    assert.equal(result.ok, false, JSON.stringify(overrides));
    assert.equal(result.body.code, "MALFORMED_HISTORY");
  }
});

test("refuses a page whose identity echo does not match the requested account", () => {
  const params = paramsWith();

  for (const identity of [
    { mt5Login: "99999999", mt5Server: SERVER },
    { mt5Login: LOGIN, mt5Server: "other-server" },
    { mt5Login: 12345678, mt5Server: SERVER },
    undefined,
  ]) {
    const result = classifyHistoryPage(
      verifiedPage([bridgeDealRow(0)], { identity }),
      params
    );
    assert.equal(result.ok, false, JSON.stringify(identity));
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "MT5_IDENTITY_MISMATCH");
    assertFailureShape(result.body, "MT5_IDENTITY_MISMATCH");
  }
});

test("refuses a malformed or hostile utc_range echo without throwing", () => {
  const params = paramsWith();

  const hostile = verifiedPage([bridgeDealRow(0)], {
    utc_range: {
      get from_utc() {
        throw new Error(HOSTILE);
      },
      to_utc: TO,
    },
  });

  assert.doesNotThrow(() => classifyHistoryPage(hostile, params));
  const getterResult = classifyHistoryPage(hostile, params);
  assert.equal(getterResult.ok, false);
  assert.equal(getterResult.status, 502);
  assertFailureShape(getterResult.body, "MALFORMED_HISTORY");

  for (const utc_range of [
    { from_utc: "2026-01-01 00:00:00", to_utc: TO },
    { from_utc: FROM, to_utc: "not-a-timestamp" },
    { from_utc: FROM, to_utc: "2026-01-01T00:00:00.123456Z" },
    { from_utc: FROM, to_utc: undefined },
    undefined,
  ]) {
    const result = classifyHistoryPage(verifiedPage([bridgeDealRow(0)], { utc_range }), params);
    assert.equal(result.ok, false, JSON.stringify(utc_range));
    assert.equal(result.status, 502);
    assertFailureShape(result.body, "MALFORMED_HISTORY");
  }
});

test("refuses a bridge_boot_id that is malformed or does not match the request", () => {
  const params = paramsWith();
  const withToken = buildHistoryBridgeParams(
    queryWith({ bridge_boot_id: BOOT_ID, connection_generation: "0" })
  );

  assert.equal(
    classifyHistoryPage(verifiedPage([bridgeDealRow(0)]), params).ok,
    true
  );

  for (const bridge_boot_id of [
    undefined,
    "0f1e2d3c4b5a69788f7e6d5c4b3a29",
    "ZZ1e2d3c4b5a69788f7e6d5c4b3a2918",
    BOOT_ID.toUpperCase(),
    "1f1e2d3c4b5a69788f7e6d5c4b3a2918",
  ]) {
    const result = classifyHistoryPage(
      verifiedPage([bridgeDealRow(0)], { bridge_boot_id }),
      withToken
    );
    assert.equal(result.ok, false, String(bridge_boot_id));
    assert.equal(result.body.code, "MALFORMED_HISTORY");
  }
});

test("refuses a connection_generation echo that is not a non-negative integer or does not match", () => {
  const params = paramsWith();
  const withToken = buildHistoryBridgeParams(
    queryWith({ bridge_boot_id: BOOT_ID, connection_generation: "7" })
  );

  for (const connection_generation of [-1, 1.5, "seven", null, undefined]) {
    const result = classifyHistoryPage(
      verifiedPage([bridgeDealRow(0)], { connection_generation }),
      params
    );
    assert.equal(result.ok, false, String(connection_generation));
    assert.equal(result.body.code, "MALFORMED_HISTORY");
  }

  const mismatch = classifyHistoryPage(
    verifiedPage([bridgeDealRow(0)], { connection_generation: 8 }),
    withToken
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.body.code, "MALFORMED_HISTORY");
});

// ============================================================
// Handler and route
// ============================================================

test("turns a present but non-200 upstream status into a structured refusal and preserves bridge_status", async () => {
  const cases = [199, 201, 204, 302];

  for (const status of cases) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: okTransport({ code: "MT5_HISTORY_READ_FAILED", message: HOSTILE }, status),
    });

    assert.equal(result.status, 502, String(status));
    assertFailureShape(result.body, "MT5_HISTORY_READ_FAILED", status);
  }
});

test("refuses a response that carries no usable status as unproven", async () => {
  const page = verifiedPage([bridgeDealRow(0)]);

  const statusTooHigh = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(page, 600),
  });
  assert.equal(statusTooHigh.status, 502);
  assertFailureShape(statusTooHigh.body, "UNPROVEN_BRIDGE_SUCCESS");

  const noStatus = await mt5HistoryHandler({
    query: queryWith(),
    transport: async () => ({ data: page }),
  });
  assert.equal(noStatus.status, 502);
  assertFailureShape(noStatus.body, "UNPROVEN_BRIDGE_SUCCESS");
});

test("forwards a verified page with classification and range echoes", async () => {
  const rows = [bridgeDealRow(0, 1), bridgeDealRow(2, 2)];
  const result = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(verifiedPage(rows)),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.page_query_complete, true);
  assert.equal(result.body.source_scan_complete, false);
  assert.deepEqual(result.body.history, rows);
  assert.deepEqual(result.body.positions, []);
  assert.equal(result.body.count, 2);
  assert.deepEqual(result.body.classification, {
    trade_deal_count: 1,
    financial_deal_count: 1,
    unknown_type_count: 0,
  });
  assert.deepEqual(result.body.requested_range, { from_utc: FROM, to_utc: TO });
  assert.deepEqual(result.body.utc_range, { from_utc: FROM, to_utc: TO });
  assert.deepEqual(result.body.coverage, {
    boundaries: "inclusive",
    returned_deal_count: 2,
    serialized_deal_count: 2,
  });
  assert.equal(result.body.retention_verified, false);
});

test("keeps a verified empty page distinct from a failed page", async () => {
  const empty = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(verifiedPage([])),
  });

  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.history, []);
  assert.deepEqual(empty.body.positions, []);
  assert.equal(empty.body.count, 0);

  const failed = await mt5HistoryHandler({
    query: queryWith(),
    transport: failingTransport(transportError(undefined, undefined)),
  });

  assert.equal(failed.status, 502);
  assert.equal(failed.body.history, null);
  assert.equal(failed.body.positions, null);
});

test("relays a bridge 400 invalid-query refusal resolved and thrown", async () => {
  const page = { code: "INVALID_HISTORY_QUERY", message: HOSTILE };

  const resolved = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(page, 400),
  });
  assert.equal(resolved.status, 400);
  assertFailureShape(resolved.body, "INVALID_HISTORY_QUERY", 400);

  const thrown = await mt5HistoryHandler({
    query: queryWith(),
    transport: failingTransport(transportError(400, page)),
  });
  assert.equal(thrown.status, 400);
  assertFailureShape(thrown.body, "INVALID_HISTORY_QUERY", 400);
});

test("relays identity mismatch and connection changed as 409", async () => {
  for (const code of ["MT5_IDENTITY_MISMATCH", "MT5_CONNECTION_CHANGED"]) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: failingTransport(transportError(409, { code, message: HOSTILE })),
    });

    assert.equal(result.status, 409, code);
    assertFailureShape(result.body, code, 409);
  }
});

test("relays 503 not-connected and read-failed codes", async () => {
  for (const code of [
    "MT5_NOT_CONNECTED",
    "MT5_IDENTITY_UNAVAILABLE",
    "MT5_HISTORY_READ_FAILED",
    "MT5_POSITIONS_READ_FAILED",
  ]) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: failingTransport(transportError(503, { code, message: HOSTILE })),
    });

    assert.equal(result.status, 503, code);
    assertFailureShape(result.body, code, 503);
  }
});

test("relays 502 malformed upstream codes", async () => {
  for (const code of ["MALFORMED_HISTORY", "MALFORMED_POSITIONS"]) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: okTransport({ code, message: HOSTILE }, 502),
    });

    assert.equal(result.status, 502, code);
    assertFailureShape(result.body, code, 502);
  }
});

test("never copies hostile upstream text into the response", async () => {
  const hostileCodePage = verifiedPage([bridgeDealRow(0)], {
    identity: { mt5Login: HOSTILE, mt5Server: SERVER },
  });

  const forged = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(hostileCodePage),
  });
  assert.equal(forged.status, 409);
  assertFailureShape(forged.body, "MT5_IDENTITY_MISMATCH");

  const hostileCode = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport({ code: HOSTILE, message: HOSTILE }, 500),
  });
  assert.equal(hostileCode.status, 500);
  assertFailureShape(hostileCode.body, "MT5_HISTORY_UNAVAILABLE", 500);

  const garbage = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(HOSTILE),
  });
  assert.equal(garbage.status, 502);
  assertFailureShape(garbage.body, "MALFORMED_HISTORY");
});

test("classifies a 200 page that is unattested versus one that is malformed", async () => {
  const unattested = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(verifiedPage([bridgeDealRow(0)], { source_scan_complete: true })),
  });
  assert.equal(unattested.status, 502);
  assertFailureShape(unattested.body, "UNPROVEN_BRIDGE_SUCCESS");

  const malformed = await mt5HistoryHandler({
    query: queryWith(),
    transport: okTransport(verifiedPage([bridgeDealRow("0")])),
  });
  assert.equal(malformed.status, 502);
  assertFailureShape(malformed.body, "MALFORMED_HISTORY");
});

test("maps every refusal to one argument code and an authored message", () => {
  assert.equal(historyRefusal.length, 1);

  const codes = [
    "INVALID_HISTORY_QUERY",
    "MT5_IDENTITY_MISMATCH",
    "MT5_CONNECTION_CHANGED",
    "MT5_NOT_CONNECTED",
    "MT5_IDENTITY_UNAVAILABLE",
    "MT5_HISTORY_READ_FAILED",
    "MT5_POSITIONS_READ_FAILED",
    "MALFORMED_HISTORY",
    "MALFORMED_POSITIONS",
    "MT5_HISTORY_TIMEOUT",
    "MT5_HISTORY_UNAVAILABLE",
    "UNPROVEN_BRIDGE_SUCCESS",
  ];

  const messages = new Set();

  for (const code of codes) {
    const body = historyRefusal(code);
    assert.equal(body.code, code);
    assert.equal(typeof body.message, "string");
    assert.ok(body.message.length > 0);
    assert.notEqual(body.message, "MT5 history is unavailable.", code);
    messages.add(body.message);
  }

  assert.equal(messages.size, codes.length);

  assert.equal(historyRefusal("NOT_A_CONTRACT_CODE").message, "MT5 history is unavailable.");
  assert.equal(historyRefusal(HOSTILE).code, "MT5_HISTORY_UNAVAILABLE");
  assert.equal(historyRefusal(undefined).code, "MT5_HISTORY_UNAVAILABLE");
});

test("clamps an upstream status that cannot be a failure status", async () => {
  for (const status of [700, "400", null, 1.5]) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: failingTransport(
        transportError(status, { code: "MT5_HISTORY_READ_FAILED", message: HOSTILE })
      ),
    });

    assert.equal(result.status, 502, String(status));
    assertFailureShape(result.body, "MT5_HISTORY_READ_FAILED");
  }

  const noResponseObject = await mt5HistoryHandler({
    query: queryWith(),
    transport: failingTransport(transportError(undefined, undefined)),
  });
  assert.equal(noResponseObject.status, 502);
  assertFailureShape(noResponseObject.body, "MT5_HISTORY_UNAVAILABLE");
  assert.equal(noResponseObject.body.message, "MT5 did not return a history page.");

  const thrownStatus99 = await mt5HistoryHandler({
    query: queryWith(),
    transport: failingTransport(transportError(99, { code: HOSTILE })),
  });
  assert.equal(thrownStatus99.status, 502);
  assertFailureShape(thrownStatus99.body, "MT5_HISTORY_UNAVAILABLE");
});

test("refuses a transport that resolves with nothing and never reports empty history", async () => {
  for (const value of [undefined, null, "ok", 42, [], {}]) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: async () => value,
    });

    assert.equal(result.status, 502, JSON.stringify(value));
    assert.equal(result.body.history, null);
    assert.equal(result.body.positions, null);
    assert.equal(result.body.success, false);
  }
});

test("answers 504 on a timeout even when the error carries a response", async () => {
  for (const code of ["ECONNABORTED", "ETIMEDOUT"]) {
    const result = await mt5HistoryHandler({
      query: queryWith(),
      transport: failingTransport(transportError(503, { code: "MT5_NOT_CONNECTED" }, code)),
    });

    assert.equal(result.status, 504, code);
    assertFailureShape(result.body, "MT5_HISTORY_TIMEOUT");
  }
});

test("never reaches the transport when the request itself is invalid", async () => {
  let reached = 0;
  const spy = async () => {
    reached += 1;
    return { status: 200, data: verifiedPage([]) };
  };

  for (const query of [
    queryWith({ mt5_login: undefined }),
    queryWith({ mt5_server: undefined }),
    queryWith({ from_utc: "2026-01-01T00:00:00" }),
    queryWith({ from_utc: "0000-01-01T00:00:00Z" }),
    queryWith({ to_utc: FROM }),
    queryWith({ bridge_boot_id: BOOT_ID }),
    queryWith({ mt5_login: "abc" }),
  ]) {
    const result = await mt5HistoryHandler({ query, transport: spy });
    assert.equal(result.status, 400, JSON.stringify(query));
    assertFailureShape(result.body, "INVALID_HISTORY_QUERY");
  }

  assert.equal(reached, 0);
});

test("survives every hostile transport return and throw", async () => {
  const transports = [
    async () => undefined,
    async () => null,
    async () => "ok",
    async () => 42,
    async () => NaN,
    async () => Symbol("nope"),
    async () => () => {},
    async () => ({ status: 200 }),
    async () => ({ status: 200, data: undefined }),
    async () => ({ status: 200, data: verifiedPage([bridgeDealRow(0)], { count: "one" }) }),
    async () => ({ status: 200, data: verifiedPage([bridgeDealRow(0)], { history: {} }) }),
    async () => ({ status: 200, data: verifiedPage([bridgeDealRow(0)], { positions: {} }) }),
    async () => ({ status: 200, data: verifiedPage([bridgeDealRow(0)], { coverage: null }) }),
    async () => ({ status: 200, data: verifiedPage([bridgeDealRow(0)], { identity: null }) }),
    async () => ({ status: 200, data: verifiedPage([bridgeDealRow(0)], { utc_range: "x" }) }),
    async () => ({ status: 500, data: null }),
    async () => ({ status: 500, data: [] }),
    async () => ({ status: 404, data: { code: HOSTILE } }),
    async () => ({ get status() { throw new Error(HOSTILE); } }),
    failingTransport(new Error(HOSTILE)),
    failingTransport(undefined),
    failingTransport("plain string"),
    failingTransport(null),
    failingTransport(Symbol("nope")),
    failingTransport(42),
    failingTransport({}),
    failingTransport({ response: { status: 503, data: { code: HOSTILE } } }),
    failingTransport({ response: { status: 503, get data() { throw new Error(HOSTILE); } } }),
    failingTransport(transportError(409, { code: "MT5_IDENTITY_MISMATCH" })),
    failingTransport(transportError(502, { code: "MALFORMED_POSITIONS" })),
    failingTransport(transportError("ECONNABORTED")),
  ];

  assert.equal(transports.length, 31);

  for (const [index, transport] of transports.entries()) {
    const result = await mt5HistoryHandler({ query: queryWith(), transport });

    assert.equal(typeof result.status, "number", index);
    assert.ok(result.status >= 400 && result.status <= 599, `${index}: ${result.status}`);
    assert.equal(result.body.success, false, index);
    assert.equal(Array.isArray(result.body.history), false, index);
    assert.equal(result.body.history, null, index);
    assert.equal(result.body.positions, null, index);
    assert.ok(!JSON.stringify(result.body).includes("HOSTILE"), index);
  }
});

test("keeps the route handler total when the write itself fails", async () => {
  const res = resDouble({ throwOnWrite: true });

  assert.doesNotThrow(() =>
    mt5HistoryRouteHandler(
      reqDouble(queryWith(), okTransport(verifiedPage([bridgeDealRow(0)]))),
      res
    )
  );

  const broken = await mt5HistoryHandler({
    query: queryWith(),
    transport: async () => ({
      status: 200,
      get data() {
        throw new Error(HOSTILE);
      },
    }),
  });
  assert.equal(broken.status, 502);
  assertFailureShape(broken.body, "MALFORMED_HISTORY");

  const badQuery = resDouble();
  await mt5HistoryRouteHandler(reqDouble(queryWith({ mt5_login: undefined })), badQuery);
  assert.equal(badQuery.statusValue, 400);
  assertFailureShape(badQuery.body, "INVALID_HISTORY_QUERY");
});

test("writes exactly one response and never writes twice", async () => {
  const verified = resDouble();
  await mt5HistoryRouteHandler(reqDouble(queryWith(), okTransport(verifiedPage([bridgeDealRow(0)]))), verified);
  assert.equal(verified.writes, 1);
  assert.equal(verified.statusValue, 200);
  assert.deepEqual(Object.keys(verified.body).sort(), [
    "bridge_boot_id",
    "classification",
    "connection_generation",
    "count",
    "coverage",
    "history",
    "identity",
    "page_query_complete",
    "positions",
    "requested_range",
    "retention_verified",
    "scan_range",
    "source_scan_complete",
    "success",
    "utc_range",
  ]);

  const relayed = resDouble();
  await mt5HistoryRouteHandler(
    reqDouble(queryWith(), failingTransport(transportError(503, { code: "MT5_NOT_CONNECTED" }))),
    relayed
  );
  assert.equal(relayed.writes, 1);
  assert.equal(relayed.statusValue, 503);
  assertFailureShape(relayed.body, "MT5_NOT_CONNECTED", 503);
});

test("does not write to a response that has already been sent", async () => {
  const sent = resDouble({ headersSent: true });
  await mt5HistoryRouteHandler(reqDouble(queryWith(), okTransport(verifiedPage([]))), sent);

  assert.equal(sent.writes, 0);
  assert.equal(sent.statusValue, null);
});

test("keeps the 10000 ms timeout and the bridge parameter names in the default transport", async () => {
  const calls = [];
  const route = router.stack.find((layer) => layer.route?.path === "/history");
  assert.ok(route, "GET /history must be registered");

  const originalGet = axios.get;

  axios.get = async (url, config) => {
    calls.push({ url, config });
    return { status: 200, data: verifiedPage([]) };
  };

  try {
    const result = await mt5HistoryHandler({ query: queryWith() });
    assert.equal(result.status, 200);
  } finally {
    axios.get = originalGet;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001"}/mt5/history`);
  assert.equal(calls[0].config.timeout, 10000);
  assert.deepEqual(Object.keys(calls[0].config.params).sort(), [
    "expected_mt5_login",
    "expected_mt5_server",
    "from_utc",
    "to_utc",
  ]);
  assert.equal(calls[0].config.validateStatus(503), true);
  assert.equal(calls[0].config.validateStatus(200), true);
});

test("registers GET /history exactly once with the exported handler and arity two", () => {
  const historyLayers = router.stack.filter((layer) => layer.route?.path === "/history");

  assert.equal(historyLayers.length, 1);
  assert.equal(historyLayers[0].route.stack.length, 1);
  assert.equal(historyLayers[0].route.stack[0].handle, mt5HistoryRouteHandler);
  assert.equal(historyLayers[0].route.stack[0].handle.length, 2);
  assert.deepEqual(Object.keys(historyLayers[0].route.methods), ["get"]);
  assert.equal(historyLayers[0].route.methods.get, true);
  assert.equal(historyLayers[0].route.stack[0].method, "get");
});

test("preserves continuation metadata so a caller can request the next page", async () => {
  const query = queryWith({
    scan_from_utc: "2025-01-01T00:00:00Z",
    scan_to_utc: "2026-01-01T00:00:00Z",
    bridge_boot_id: BOOT_ID,
    connection_generation: "7",
  });

  const params = buildHistoryBridgeParams(query);
  assert.deepEqual(params, {
    expected_mt5_login: LOGIN,
    expected_mt5_server: SERVER,
    from_utc: FROM,
    to_utc: TO,
    scan_from_utc: "2025-01-01T00:00:00Z",
    scan_to_utc: "2026-01-01T00:00:00Z",
    bridge_boot_id: BOOT_ID,
    connection_generation: "7",
  });

  const result = await mt5HistoryHandler({
    query,
    transport: okTransport(
      verifiedPage([bridgeDealRow(0)], {
        scan_range: { from_utc: "2025-01-01T00:00:00Z", to_utc: "2026-01-01T00:00:00Z" },
        bridge_boot_id: BOOT_ID,
        connection_generation: 7,
      })
    ),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.bridge_boot_id, BOOT_ID);
  assert.equal(result.body.connection_generation, 7);
  assert.deepEqual(result.body.scan_range, {
    from_utc: "2025-01-01T00:00:00Z",
    to_utc: "2026-01-01T00:00:00Z",
  });
  assert.equal(result.body.source_scan_complete, false);
});
