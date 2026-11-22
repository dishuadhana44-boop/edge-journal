import test from "node:test";
import assert from "node:assert/strict";

import {
  BROKER_SIZING_CODES,
  CALC_PROFIT_CALCULATION,
  buildCalcProfitUrl,
  buildVolumeGrid,
  gridIndexOf,
  normalizePriceToDigits,
  sizeWithBroker,
  validateBrokerVolume,
  volumeAtGridStep,
} from "../brokerSizing.js";

// ============================================================
// STUB BROKER
//
// Nothing here talks to a bridge, a backend or MT5. The stub answers exactly
// the shape GET /api/mt5/calc-profit returns today and reports derived numbers
// from a declared loss model, so every assertion below is about the sizing
// module's decisions, not about broker behaviour.
// ============================================================

const GRID = { volume_min: 0.01, volume_max: 10, volume_step: 0.01 };

function closeTo(actual, expected, tolerance = 1e-9, message = "") {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`
  );
}

function symbolInfo({
  symbol = "EURUSD",
  digits = 5,
  grid = GRID,
  volumeGridUsable = true,
  spec = null,
  specStatus = null,
  success = true,
} = {}) {
  return {
    success,
    connected: true,
    symbol,
    digits,
    spec: spec ?? { ...grid },
    spec_status:
      specStatus ??
      { volume_min: "ok", volume_max: "ok", volume_step: "ok" },
    fields_present: ["volume_min", "volume_max", "volume_step"],
    volume_grid_usable: volumeGridUsable,
    recorded_at: 1_700_000_000_000,
  };
}

function parseUrl(url) {
  const parsed = new URL(url);

  return {
    path: `${parsed.origin}${parsed.pathname}`,
    params: Object.fromEntries(parsed.searchParams.entries()),
  };
}

function profitBody({
  params,
  lossAbs,
  profit = null,
  accountCurrency = "USD",
  grid = GRID,
  overrides = {},
}) {
  return {
    success: true,
    connected: true,
    symbol: params.symbol,
    action: params.action === "BUY" ? 0 : 1,
    action_name: params.action,
    volume: Number(params.volume),
    price_open: Number(params.price_open),
    price_close: Number(params.price_close),
    profit: profit ?? -lossAbs,
    loss_abs: lossAbs,
    account_currency: accountCurrency,
    currency_source: "account_info().currency",
    calculation: CALC_PROFIT_CALCULATION,
    volume_min: grid.volume_min,
    volume_max: grid.volume_max,
    volume_step: grid.volume_step,
    recorded_at: 1_700_000_000_001,
    ...overrides,
  };
}

function stubFetch({
  lossOf = () => ({ loss: 0 }),
  grid = GRID,
  accountCurrency = "USD",
  bodyOverrides = null,
  http = null,
  jsonThrows = false,
  rawBody,
  rejectWith = null,
} = {}) {
  const calls = [];
  const occurrences = new Map();

  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options, ...parseUrl(url) });

    if (rejectWith) throw rejectWith;

    const params = calls[calls.length - 1].params;
    const volume = Number(params.volume);
    const occurrence = (occurrences.get(volume) ?? 0) + 1;
    occurrences.set(volume, occurrence);

    if (http) {
      return {
        status: http.status,
        json: async () => http.body,
      };
    }

    if (jsonThrows) {
      return {
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
      };
    }

    if (rawBody !== undefined) {
      return { status: 200, json: async () => rawBody };
    }

    const outcome = lossOf({ volume, params, occurrence, callIndex: calls.length });

    return {
      status: 200,
      json: async () =>
        profitBody({
          params,
          lossAbs: outcome.loss,
          profit: outcome.profit ?? null,
          accountCurrency: outcome.accountCurrency ?? accountCurrency,
          grid,
          overrides:
            typeof bodyOverrides === "function"
              ? bodyOverrides({ volume, params, occurrence, callIndex: calls.length })
              : bodyOverrides,
        }),
    };
  };

  fetchImpl.calls = calls;
  fetchImpl.volumesCalled = () =>
    calls.map((call) => Number(call.params.volume));

  return fetchImpl;
}

function input(overrides = {}) {
  return {
    // Real, loaded account values.
    balance: 10_000,
    riskPercent: 1,
    accountCurrency: "USD",
    symbol: "EURUSD",
    side: "buy",
    orderType: "Market",
    entry: 1.1,
    stopLoss: 1.0975,
    symbolInfo: symbolInfo(),
    apiBaseUrl: "http://stub.broker",
    ...overrides,
  };
}

function assertBlocked(result, code, { calls = null } = {}) {
  assert.equal(result.ok, false, result.message);
  assert.equal(result.code, code, `${code} vs ${result.code}: ${result.message}`);
  assert.equal(result.lots, 0, "a blocked calculation must never report a lot size");
  assert.equal(result.lotSizeSource, "blocked");
  assert.equal(result.measuredLossAbs, null, "no measurement may be claimed");
  assert.ok(result.message.length > 0, "every refusal carries a reason");

  if (calls !== null) {
    assert.equal(calls.length, 0, "no request should have been made");
  }
}

function assertAllOnGrid(result, rawGrid = GRID) {
  const grid = rawGrid.ok === true ? rawGrid : buildVolumeGrid(rawGrid);

  for (const volume of result.probedVolumes) {
    assert.equal(
      validateBrokerVolume(volume, grid).ok,
      true,
      `${volume} is not a broker grid volume`
    );
  }
}

// ============================================================
// VALID GRID CALCULATION
// ============================================================

test("sizes to the largest broker grid volume the measured loss allows", async () => {
  // Budget 100 USD; the stub loses 40 per lot on this stop.
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.code, BROKER_SIZING_CODES.OK);
  closeTo(sizing.riskBudget, 100, 1e-9, "risk budget");
  assert.equal(sizing.lots, 2.5, "40 x 2.5 = 100 is the largest grid volume that fits");
  closeTo(sizing.measuredLossAbs, 100, 1e-6);
  assert.equal(sizing.withinRiskBudget, true);
  assert.equal(sizing.lotSizeSource, "broker-measured");
  assert.equal(sizing.accountCurrency, "USD");
  assert.equal(sizing.currencySource, "account_info().currency");
  assert.equal(sizing.calculation, CALC_PROFIT_CALCULATION);
  assert.equal(sizing.volume_min, GRID.volume_min);
  assert.equal(sizing.volume_max, GRID.volume_max);
  assert.equal(sizing.volume_step, GRID.volume_step);
  assert.equal(sizing.digits, 5);
  assert.ok(sizing.requestsUsed >= 2 && sizing.requestsUsed <= 32);
  assert.equal(fetchImpl.calls.length, sizing.requestsUsed);
  assertAllOnGrid(sizing);

  // One volume above the answer must not fit, proving the search maximised.
  const oneStepMore = volumeAtGridStep(
    buildVolumeGrid(GRID),
    sizing.gridIndex + 1
  );
  assert.ok(
    oneStepMore === null || 40 * oneStepMore > sizing.riskBudget,
    `${oneStepMore} also fit, so the reported volume was not the largest`
  );
});

test("only the calc-profit endpoint is asked for money", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assert.equal(sizing.ok, true, sizing.message);

  for (const call of fetchImpl.calls) {
    assert.equal(call.path, "http://stub.broker/api/mt5/calc-profit");
    assert.ok(
      !/price=|quote|symbol-info|tick|contract|pip/i.test(call.url),
      `unexpected request: ${call.url}`
    );
  }
});

test("the grid comes from the broker, not from an assumed 0.01 step", async () => {
  const brokerGrid = { volume_min: 0.1, volume_max: 5, volume_step: 0.1 };

  const fetchImpl = stubFetch({
    grid: brokerGrid,
    lossOf: ({ volume }) => ({ loss: 100 * volume }),
  });

  const sizing = await sizeWithBroker({
    ...input(),
    // 230 USD budget: 100 x 2.3 = 230 fits, 100 x 2.4 = 240 does not.
    riskPercent: 2.3,
    symbolInfo: symbolInfo({ grid: brokerGrid }),
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, 2.3, "a 0.1 grid, not a 0.01 grid");
  assert.equal(sizing.volume_step, 0.1);
  closeTo(sizing.measuredLossAbs, 230, 1e-6);
  assertAllOnGrid(sizing, brokerGrid);

  for (const volume of fetchImpl.volumesCalled()) {
    assert.match(String(volume), /^(0\.1|0\.2|0\.3|0\.4|0\.5|0\.6|0\.7|0\.8|0\.9|[1-5](\.[1-9])?)$/, `${volume} ignores the 0.1 step`);
  }
});

// ============================================================
// STEP DOWN, IN EXACT GRID STEPS
// ============================================================

test("re-measures the candidate and steps down one grid step when it no longer fits", async () => {
  const fetchImpl = stubFetch({
    lossOf: ({ volume, occurrence }) => {
      // The broker's first answer at 2.44 is optimistic; its own repeat answer
      // is the true loss. 41 x 2.44 = 100.04 over a 100 budget,
      // 41 x 2.43 = 99.63 inside it.
      if (volume === 2.44 && occurrence === 1) return { loss: 1 };
      return { loss: 41 * volume };
    },
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, 2.43);
  closeTo(sizing.measuredLossAbs, 99.63, 1e-6);
  assert.equal(sizing.withinRiskBudget, true);
  assertAllOnGrid(sizing);

  const probesAt244 = fetchImpl.volumesCalled().filter((v) => v === 2.44).length;
  assert.ok(probesAt244 >= 2, "the rejected candidate must be measured, not assumed");

  const acceptedProbe = fetchImpl.volumesCalled().filter((v) => v === 2.43).length;
  assert.ok(acceptedProbe >= 1);
});

test("an oversized budget still cannot exceed the broker maximum", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({
    ...input(),
    balance: 1_000_000,
    riskPercent: 5,
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, GRID.volume_max);
  assert.equal(sizing.atBrokerMaximum, true);
  closeTo(sizing.measuredLossAbs, 400, 1e-6);
  assert.ok(sizing.measuredLossAbs < sizing.riskBudget);
  assertAllOnGrid(sizing);
});

// ============================================================
// NO VOLUME FITS
// ============================================================

test("no volume on the broker grid fits the budget, so nothing is proposed", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 20_000 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.NO_VOLUME_WITHIN_BUDGET);
  closeTo(sizing.lossAtBrokerMinimum, 200, 1e-6, "loss at volume_min");
  closeTo(sizing.riskBudget, 100, 1e-9);
  assert.match(sizing.message, /not raised to the minimum/);
  assertAllOnGrid(sizing);
});

test("the accepted volume is refused when the broker's own repeat answer no longer fits anywhere", async () => {
  const fetchImpl = stubFetch({
    lossOf: ({ volume, occurrence }) =>
      occurrence === 1 ? { loss: 0.01 } : { loss: 20_000 * volume },
  });

  const sizing = await sizeWithBroker({
    ...input(),
    maxRequests: 6,
    fetchImpl,
  });

  assert.equal(sizing.ok, false, sizing.message);
  assert.equal(sizing.lots, 0);
  assert.ok(
    [
      BROKER_SIZING_CODES.NO_VOLUME_WITHIN_BUDGET,
      BROKER_SIZING_CODES.REQUEST_BUDGET_EXCEEDED,
    ].includes(sizing.code),
    `unexpected refusal ${sizing.code}`
  );
});

// ============================================================
// MISSING OR MALFORMED INPUTS (must not request anything)
// ============================================================

test("a missing, unreadable or non-positive balance blocks with no request", async () => {
  for (const balance of [undefined, null, "", "abc", 0, -500, Number.NaN]) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({ ...input(), balance, fetchImpl });

    assertBlocked(
      sizing,
      BROKER_SIZING_CODES.INVALID_BALANCE,
      { calls: fetchImpl.calls }
    );
  }
});

test("a missing or non-positive risk percentage blocks with no request", async () => {
  for (const riskPercent of [undefined, 0, -1, "abc"]) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({ ...input(), riskPercent, fetchImpl });

    assertBlocked(
      sizing,
      BROKER_SIZING_CODES.INVALID_RISK_PERCENT,
      { calls: fetchImpl.calls }
    );
  }
});

test("an unknown account currency blocks with no request", async () => {
  for (const accountCurrency of ["", "   ", null, undefined]) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({
      ...input(),
      accountCurrency,
      fetchImpl,
    });

    assertBlocked(
      sizing,
      BROKER_SIZING_CODES.MISSING_ACCOUNT_CURRENCY,
      { calls: fetchImpl.calls }
    );
  }
});

test("missing or malformed broker metadata blocks with no request", async () => {
  const cases = [
    ["no metadata at all", null],
    ["not an object", "EURUSD"],
    ["unsuccessful payload", { ...symbolInfo(), success: false }],
    ["no spec object", { ...symbolInfo(), spec: null }],
    ["digits missing", { ...symbolInfo(), digits: undefined }],
    ["digits not an integer", symbolInfo({ digits: 4.5 })],
    ["digits out of range", symbolInfo({ digits: 12 })],
  ];

  for (const [label, symbolInfoValue] of cases) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({
      ...input(),
      symbolInfo: symbolInfoValue,
      fetchImpl,
    });

    assert.equal(sizing.ok, false, label);
    assert.equal(sizing.lots, 0, label);
    assert.equal(
      sizing.code,
      BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA,
      `${label}: ${sizing.code}`
    );
    assert.equal(fetchImpl.calls.length, 0, label);
  }
});

test("metadata for a different symbol blocks instead of reusing the wrong grid", async () => {
  const fetchImpl = stubFetch();

  const sizing = await sizeWithBroker({
    ...input(),
    symbol: "GBPUSD",
    symbolInfo: symbolInfo({ symbol: "EURUSD" }),
    fetchImpl,
  });

  assertBlocked(sizing, BROKER_SIZING_CODES.METADATA_SYMBOL_MISMATCH, {
    calls: fetchImpl.calls,
  });
});

test("an unusable broker volume grid blocks with no request", async () => {
  const cases = [
    ["grid flagged unusable", symbolInfo({ volumeGridUsable: false })],
    [
      "spec status not ok",
      symbolInfo({
        specStatus: { volume_min: "non_positive", volume_max: "ok", volume_step: "ok" },
      }),
    ],
    [
      "zero step",
      symbolInfo({ spec: { volume_min: 0.01, volume_max: 10, volume_step: 0 } }),
    ],
    [
      "maximum below minimum",
      symbolInfo({ spec: { volume_min: 1, volume_max: 0.1, volume_step: 0.1 } }),
    ],
    [
      "missing minimum",
      symbolInfo({ spec: { volume_max: 10, volume_step: 0.01 } }),
    ],
    [
      "string grid",
      symbolInfo({ spec: { volume_min: "a", volume_max: "b", volume_step: "c" } }),
    ],
  ];

  for (const [label, symbolInfoValue] of cases) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({
      ...input(),
      symbolInfo: symbolInfoValue,
      fetchImpl,
    });

    assertBlocked(sizing, BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID, {
      calls: fetchImpl.calls,
    });
    void label;
  }
});

test("an unusable side, order type or request budget blocks with no request", async () => {
  const cases = [
    ["bad side", { side: "hold" }],
    ["bad order type", { orderType: "Trailing" }],
    ["budget below two probes", { maxRequests: 1 }],
    ["non-integer budget", { maxRequests: 4.5 }],
    ["no fetch available", { fetchImpl: null }],
  ];

  for (const [label, override] of cases) {
    const sizing = await sizeWithBroker({
      ...input(),
      fetchImpl: stubFetch(),
      ...override,
    });

    assert.equal(sizing.ok, false, label);
    assert.equal(sizing.lots, 0, label);
    assert.equal(sizing.code, BROKER_SIZING_CODES.INVALID_INPUT, `${label}: ${sizing.code}`);
  }
});

// ============================================================
// CURRENCY
// ============================================================

test("a measurement in another currency is not this account's loss", async () => {
  const fetchImpl = stubFetch({
    lossOf: ({ volume }) => ({ loss: 40 * volume }),
    accountCurrency: "EUR",
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assert.equal(sizing.ok, false, sizing.message);
  assert.equal(sizing.code, BROKER_SIZING_CODES.ACCOUNT_CURRENCY_MISMATCH);
  assert.equal(sizing.lots, 0);
  assert.equal(sizing.measuredCurrency, "EUR");
  assert.equal(sizing.accountCurrency, "USD");
  assert.equal(sizing.currencySource, "account_info().currency");
  assert.match(sizing.message, /account_currency|EUR/);
});

test("a lower-case USD account currency still matches the broker's USD", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({
    ...input(),
    accountCurrency: "usd",
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.accountCurrency, "USD");
});

// ============================================================
// PRICES
// ============================================================

test("entry and stop must be two usable prices", async () => {
  const fetchImpl = stubFetch();

  const cases = [
    ["stop missing", { stopLoss: "" }],
    ["stop zero", { stopLoss: 0 }],
    ["entry missing", { entry: "" }],
    ["entry not a number", { entry: "ask" }],
    ["negative stop", { stopLoss: -1 }],
    ["prices equal", { stopLoss: 1.1 }],
  ];

  for (const [label, override] of cases) {
    const sizing = await sizeWithBroker({
      ...input(),
      fetchImpl,
      ...override,
    });

    assertBlocked(sizing, BROKER_SIZING_CODES.PRICE_UNUSABLE);
    void label;
  }

  assert.equal(fetchImpl.calls.length, 0, "bad prices must never reach the broker");
});

test("the stop must sit on the loss side for the order side", async () => {
  const cases = [
    ["buy with the stop above entry", "buy", 1.1, 1.1025],
    ["sell with the stop below entry", "sell", 1.1, 1.0975],
  ];

  for (const [label, side, entry, stopLoss] of cases) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({
      ...input(),
      side,
      entry,
      stopLoss,
      fetchImpl,
    });

    assertBlocked(sizing, BROKER_SIZING_CODES.STOP_ON_WRONG_SIDE);
    assert.equal(fetchImpl.calls.length, 0, label);
  }
});

test("prices are measured at the broker's own digits", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({
    ...input(),
    symbolInfo: symbolInfo({ digits: 3 }),
    entry: 1.100_04,
    stopLoss: 1.097_49,
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.digits, 3);
  assert.equal(sizing.entry, 1.1, "rounded to the broker's 3 digits");
  assert.equal(sizing.stopLoss, 1.097);

  for (const call of fetchImpl.calls) {
    assert.equal(call.params.price_open, "1.100");
    assert.equal(call.params.price_close, "1.097");
  }

  // Two prices that are different numbers but the same broker price.
  const roundedTogether = stubFetch();

  const blocked = await sizeWithBroker({
    ...input(),
    symbolInfo: symbolInfo({ digits: 3 }),
    entry: 1.100_04,
    stopLoss: 1.100_1,
    fetchImpl: roundedTogether,
  });

  assertBlocked(blocked, BROKER_SIZING_CODES.PRICE_UNUSABLE);
  assert.equal(roundedTogether.calls.length, 0);
});

// ============================================================
// LOSS-SIDE ACTION PER ORDER SIDE / TYPE
// ============================================================

test("a buy measures the loss when price falls to the stop", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), side: "buy", fetchImpl });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.action, "BUY");

  const params = fetchImpl.calls[0].params;
  assert.equal(params.action, "BUY");
  assert.equal(params.symbol, "EURUSD");
  assert.ok(
    Number(params.price_close) < Number(params.price_open),
    "a buy loses when the close price is below entry"
  );
});

test("a sell measures the loss when price rises to the stop", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({
    ...input(),
    side: "sell",
    entry: 1.0975,
    stopLoss: 1.1,
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.action, "SELL");

  for (const call of fetchImpl.calls) {
    assert.equal(call.params.action, "SELL");
    assert.ok(
      Number(call.params.price_close) > Number(call.params.price_open),
      "a sell loses when the close price is above entry"
    );
  }
});

test("a pending order is measured at the typed entry, never at a live quote", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({
    ...input(),
    orderType: "Limit",
    side: "buy",
    // A buy limit below the market, typed by the trader.
    entry: 1.085,
    stopLoss: 1.08,
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.entry, 1.085, "the typed pending entry is the measured entry");
  assert.equal(sizing.stopLoss, 1.08);

  for (const call of fetchImpl.calls) {
    assert.equal(call.params.price_open, "1.08500");
    assert.equal(call.params.price_close, "1.08000");
  }
});

test("buildCalcProfitUrl only carries the documented query parameters", () => {
  const url = buildCalcProfitUrl({
    apiBaseUrl: "http://stub.broker/",
    symbol: "usdjpy",
    action: "SELL",
    volume: 0.35,
    entryAsString: "149.500",
    stopAsString: "150.000",
  });

  const parsed = new URL(url);

  assert.equal(parsed.origin + parsed.pathname, "http://stub.broker/api/mt5/calc-profit");
  assert.equal(
    [...parsed.searchParams.keys()].sort().join(","),
    "action,price_close,price_open,symbol,volume"
  );
  assert.equal(parsed.searchParams.get("symbol"), "USDJPY");
  assert.equal(parsed.searchParams.get("volume"), "0.35");
});

// ============================================================
// BRIDGE ERRORS, MALFORMED RESPONSES, NETWORK FAILURE
// ============================================================

test("a broker refusal is reported with its own error code", async () => {
  const fetchImpl = stubFetch({
    http: {
      status: 502,
      body: {
        success: false,
        error: "BROKER_RISK_UNAVAILABLE",
        message: "The broker could not price this risk.",
      },
    },
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.BROKER_MEASUREMENT_FAILED);
  assert.equal(sizing.brokerError, "BROKER_RISK_UNAVAILABLE");
  assert.equal(sizing.httpStatus, 502);
  assert.equal(sizing.message, "The broker could not price this risk.");
});

test("a 400 volume-grid refusal from the broker is not turned into a success", async () => {
  const fetchImpl = stubFetch({
    http: {
      status: 400,
      body: {
        success: false,
        error: "OFF_GRID_VOLUME",
        message: "The requested volume is not on the broker volume grid.",
      },
    },
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.BROKER_MEASUREMENT_FAILED);
  assert.equal(sizing.brokerError, "OFF_GRID_VOLUME");
  assert.equal(sizing.httpStatus, 400);
});

test("an unsuccessful 200 payload blocks", async () => {
  const fetchImpl = stubFetch({
    rawBody: { success: false, error: "ZERO_RISK_RESPONSE", message: "Broker reported no risk." },
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.BROKER_MEASUREMENT_FAILED);
  assert.equal(sizing.brokerError, "ZERO_RISK_RESPONSE");
});

test("unreadable or non-JSON responses block", async () => {
  for (const fetchImpl of [
    stubFetch({ jsonThrows: true }),
    stubFetch({ rawBody: "gateway error" }),
    stubFetch({ rawBody: null }),
  ]) {
    const sizing = await sizeWithBroker({ ...input(), fetchImpl });

    assert.equal(sizing.ok, false);
    assert.equal(sizing.lots, 0);
    assert.ok(
      [
        BROKER_SIZING_CODES.INVALID_RESPONSE,
        BROKER_SIZING_CODES.BROKER_MEASUREMENT_FAILED,
      ].includes(sizing.code),
      sizing.code
    );
  }
});

test("an inconsistent risk figure blocks", async () => {
  const fetchImpl = stubFetch({
    // loss_abs 50 but profit -5000: the two figures cannot describe one trade.
    lossOf: () => ({ loss: 50, profit: -5000 }),
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.INVALID_RESPONSE);
});

test("a measurement that did not come from the broker calculator is rejected", async () => {
  const fetchImpl = stubFetch({
    lossOf: ({ volume }) => ({ loss: 40 * volume }),
    bodyOverrides: { calculation: "pip-formula-estimate" },
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.RESPONSE_MISMATCH);
  assert.match(sizing.message, /profit calculator/);
});

test("a response about a different volume, symbol, action or price is rejected", async () => {
  const cases = [
    ["volume", () => ({ volume: 0.02 })],
    ["symbol", () => ({ symbol: "GBPUSD" })],
    ["action", () => ({ action_name: "SELL" })],
    ["entry price", () => ({ price_open: 1.2 })],
    ["stop price", () => ({ price_close: 1.0 })],
  ];

  for (const [label, overrides] of cases) {
    const fetchImpl = stubFetch({
      lossOf: ({ volume }) => ({ loss: 40 * volume }),
      bodyOverrides: overrides,
    });

    const sizing = await sizeWithBroker({ ...input(), fetchImpl });

    assertBlocked(sizing, BROKER_SIZING_CODES.RESPONSE_MISMATCH);
    void label;
  }
});

test("a volume grid that moved mid-sizing invalidates every measurement", async () => {
  const fetchImpl = stubFetch({
    lossOf: ({ volume }) => ({ loss: 40 * volume }),
    bodyOverrides: ({ callIndex }) =>
      callIndex > 2 ? { volume_max: 8 } : null,
  });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.VOLUME_GRID_CHANGED);
  assert.equal(sizing.lots, 0);
});

test("network failure and cancellation both block with no lot size", async () => {
  const networkError = new Error("connect ECONNREFUSED");
  const abortError = new Error("The operation was aborted");
  abortError.name = "AbortError";

  const sizing = await sizeWithBroker({
    ...input(),
    fetchImpl: stubFetch({ rejectWith: networkError }),
  });

  assertBlocked(sizing, BROKER_SIZING_CODES.NETWORK_ERROR);
  assert.match(sizing.message, /ECONNREFUSED/);

  const cancelled = await sizeWithBroker({
    ...input(),
    fetchImpl: stubFetch({ rejectWith: abortError }),
  });

  assertBlocked(cancelled, BROKER_SIZING_CODES.REQUEST_CANCELLED);
});

// ============================================================
// REQUEST BOUND
// ============================================================

test("the number of broker requests is bounded and then it fails closed", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), maxRequests: 3, fetchImpl });

  assert.equal(sizing.ok, false, sizing.message);
  assert.equal(sizing.code, BROKER_SIZING_CODES.REQUEST_BUDGET_EXCEEDED);
  assert.equal(sizing.lots, 0);
  assert.equal(sizing.measuredLossAbs, null);
  assert.ok(sizing.requestsUsed <= 3, `used ${sizing.requestsUsed}`);
  assert.equal(fetchImpl.calls.length, sizing.requestsUsed);
  assert.match(sizing.message, /without confirming a volume/);
});

test("sizing a full broker grid stays well inside the request bound", async () => {
  const wideGrid = { volume_min: 0.01, volume_max: 100_000, volume_step: 0.01 };

  const fetchImpl = stubFetch({
    grid: wideGrid,
    lossOf: ({ volume }) => ({ loss: 40 * volume }),
  });

  const sizing = await sizeWithBroker({
    ...input(),
    symbolInfo: symbolInfo({ grid: wideGrid }),
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, 2.5);
  // A ten-million-step grid is searched in a couple of dozen probes, not one
  // probe per grid position.
  assert.ok(
    sizing.requestsUsed >= 20 && sizing.requestsUsed <= 32,
    `used ${sizing.requestsUsed} requests`
  );
  assertAllOnGrid(sizing, wideGrid);
});

// ============================================================
// MANUAL VOLUME AGAINST THE BROKER GRID
// ============================================================

test("off-grid, below-minimum and above-maximum volumes are refused, never adjusted", () => {
  const grid = buildVolumeGrid(GRID);
  assert.equal(grid.ok, true);

  const below = validateBrokerVolume(0.005, grid);
  assert.equal(below.ok, false);
  assert.equal(below.code, BROKER_SIZING_CODES.BELOW_BROKER_MINIMUM);
  assert.equal(below.volume, 0.005, "the volume was not raised to the minimum");
  assert.match(below.message, /not raised to the minimum/);

  const above = validateBrokerVolume(10.5, grid);
  assert.equal(above.ok, false);
  assert.equal(above.code, BROKER_SIZING_CODES.ABOVE_BROKER_MAXIMUM);

  const offGrid = validateBrokerVolume(2.345, grid);
  assert.equal(offGrid.ok, false);
  assert.equal(offGrid.code, BROKER_SIZING_CODES.OFF_GRID_VOLUME);
  closeTo(offGrid.nearest_valid_volume, 2.34, 1e-9, "nearest grid volume");

  for (const volume of [0, -1, "abc", null, undefined]) {
    const invalid = validateBrokerVolume(volume, grid);
    assert.equal(invalid.ok, false, String(volume));
    assert.equal(invalid.code, BROKER_SIZING_CODES.INVALID_INPUT);
  }

  for (const volume of [0.01, 2.34, 10]) {
    const valid = validateBrokerVolume(volume, grid);
    assert.equal(valid.ok, true, `${volume}: ${valid.message}`);
  }
});

test("grid positions map to the broker's own volumes", () => {
  const grid = buildVolumeGrid(GRID);

  assert.equal(volumeAtGridStep(grid, 0), 0.01);
  assert.equal(volumeAtGridStep(grid, 1), 0.02);
  assert.equal(volumeAtGridStep(grid, grid.maxIndex), 10);
  assert.equal(volumeAtGridStep(grid, grid.maxIndex + 1), null);
  assert.equal(volumeAtGridStep(grid, -1), null);

  const stepped = buildVolumeGrid({ volume_min: 0.5, volume_max: 5, volume_step: 0.5 });
  assert.equal(stepped.maxIndex, 9);
  assert.equal(volumeAtGridStep(stepped, 4), 2.5);
});

test("price normalisation only uses the broker's digits", () => {
  assert.equal(normalizePriceToDigits("1.234567", 5).price, 1.23457);
  assert.equal(normalizePriceToDigits(150.0049, 3).price, 150.005);
  assert.equal(normalizePriceToDigits(150.0049, 2).price, 150);
  assert.equal(normalizePriceToDigits(0, 5).ok, false);
  assert.equal(normalizePriceToDigits(-1, 5).ok, false);
  assert.equal(normalizePriceToDigits("abc", 5).ok, false);
  assert.equal(normalizePriceToDigits(undefined, 5).ok, false);
});

// ============================================================
// GRID ANCHORING (regression: volume_min finer than volume_step)
//
// The bridge anchors its grid at volume_min and only accepts
// volume_min + k * volume_step (app.py volume_grid_index). When the grid is
// scaled by the step's precision alone, volume_min is pushed onto that coarser
// scale and every candidate moves off the broker's real grid.
// ============================================================

const MIN_FINER_THAN_STEP = {
  volume_min: 0.01,
  volume_max: 1.01,
  volume_step: 0.1,
};

const MIN_FINER_THAN_STEP_CANDIDATES = [
  "0.01",
  "0.11",
  "0.21",
  "0.31",
  "0.41",
  "0.51",
  "0.61",
  "0.71",
  "0.81",
  "0.91",
  "1.01",
];

const WHOLE_STEP_WITH_HALF_MIN = {
  volume_min: 0.5,
  volume_max: 5.5,
  volume_step: 1,
};

const WHOLE_STEP_WITH_HALF_MIN_CANDIDATES = [
  "0.5",
  "1.5",
  "2.5",
  "3.5",
  "4.5",
  "5.5",
];

function assertExactCandidateList(rawGrid, expected) {
  const grid = buildVolumeGrid(rawGrid);

  assert.equal(grid.ok, true, grid.message);
  assert.equal(
    grid.maxIndex + 1,
    expected.length,
    `${expected.length} volumes sit on ${rawGrid.volume_min} + k * ${rawGrid.volume_step}`
  );

  const candidates = [];

  for (let index = 0; index <= grid.maxIndex; index += 1) {
    const volume = volumeAtGridStep(grid, index);

    assert.ok(Number(volume) > 0, `grid position ${index} is not a positive volume`);
    candidates.push(volume.toFixed(grid.decimals));

    assert.equal(
      validateBrokerVolume(volume, grid).ok,
      true,
      `${volume} must be a broker volume`
    );
    assert.equal(gridIndexOf(grid, volume), index);
  }

  assert.deepEqual(candidates, expected);

  return grid;
}

test("volume_min finer than volume_step keeps the broker's anchor", () => {
  assertExactCandidateList(
    MIN_FINER_THAN_STEP,
    MIN_FINER_THAN_STEP_CANDIDATES
  );

  // Half-tick FX anchors at 0.01 on a 0.1 step; the 0.1 multiples the old anchor
  // produced are the broker's own off-grid refusals.
  const grid = buildVolumeGrid(MIN_FINER_THAN_STEP);

  for (const volume of [0.1, 0.2, 0.3, 0.5, 1]) {
    const refused = validateBrokerVolume(volume, grid);

    assert.equal(refused.ok, false, `${volume} is not on the broker grid`);
    assert.equal(refused.code, BROKER_SIZING_CODES.OFF_GRID_VOLUME);
  }

  closeTo(
    validateBrokerVolume(0.1, grid).nearest_valid_volume,
    0.01,
    1e-9,
    "flooring goes to the anchor, not to the step multiple"
  );

  for (const volume of [0, -1, 0.005]) {
    const refused = validateBrokerVolume(volume, grid);

    assert.equal(refused.ok, false, String(volume));
    assert.ok(
      [
        BROKER_SIZING_CODES.INVALID_INPUT,
        BROKER_SIZING_CODES.BELOW_BROKER_MINIMUM,
      ].includes(refused.code),
      `${volume}: ${refused.code}`
    );
  }

  const above = validateBrokerVolume(1.11, grid);
  assert.equal(above.ok, false);
  assert.equal(above.code, BROKER_SIZING_CODES.ABOVE_BROKER_MAXIMUM);
});

test("a whole-lot step with a half-lot minimum keeps the half-lot anchor", () => {
  const grid = assertExactCandidateList(
    WHOLE_STEP_WITH_HALF_MIN,
    WHOLE_STEP_WITH_HALF_MIN_CANDIDATES
  );

  // The old anchor rounded 0.5 up to 1 and offered whole lots, which the broker
  // refuses as half a step off its grid.
  for (const volume of [1, 2, 3, 4, 5]) {
    const refused = validateBrokerVolume(volume, grid);

    assert.equal(refused.ok, false, `${volume} is not on the broker grid`);
    assert.equal(refused.code, BROKER_SIZING_CODES.OFF_GRID_VOLUME);
  }

  closeTo(
    validateBrokerVolume(2, grid).nearest_valid_volume,
    1.5,
    1e-9,
    "floored to the anchored grid"
  );

  assert.equal(validateBrokerVolume(5.5, grid).ok, true);

  const above = validateBrokerVolume(6, grid);
  assert.equal(above.ok, false);
  assert.equal(above.code, BROKER_SIZING_CODES.ABOVE_BROKER_MAXIMUM);
});

test("grid position zero is always the broker's own volume_min", () => {
  for (const rawGrid of [
    GRID,
    MIN_FINER_THAN_STEP,
    WHOLE_STEP_WITH_HALF_MIN,
    { volume_min: 0.1, volume_max: 5, volume_step: 0.1 },
    { volume_min: 0.05, volume_max: 5, volume_step: 0.5 },
  ]) {
    const grid = buildVolumeGrid(rawGrid);

    assert.equal(grid.ok, true, `${JSON.stringify(rawGrid)}: ${grid.message}`);
    assert.equal(
      volumeAtGridStep(grid, 0),
      rawGrid.volume_min,
      `${JSON.stringify(rawGrid)} was re-anchored away from volume_min`
    );
    assert.equal(volumeAtGridStep(grid, grid.maxIndex) <= rawGrid.volume_max, true);
  }
});

test("a grid that cannot be represented at the broker's precision is refused", () => {
  const cases = [
    ["step finer than 8 places", { volume_min: 0.01, volume_max: 10, volume_step: 1e-9 }],
    ["minimum finer than 8 places", { volume_min: 0.010000001, volume_max: 10, volume_step: 0.01 }],
    ["maximum needs more than safe integers", { volume_min: 1e-8, volume_max: 1e9, volume_step: 1e-8 }],
  ];

  for (const [label, rawGrid] of cases) {
    const grid = buildVolumeGrid(rawGrid);

    assert.equal(grid.ok, false, label);
    assert.equal(grid.code, BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID, label);
    assert.ok(grid.message.length > 0, label);
  }

  // 8 places is exactly the bridge's own limit (app.py VOLUME_DECIMAL_PLACES).
  const finest = buildVolumeGrid({
    volume_min: 1e-8,
    volume_max: 2e-8,
    volume_step: 1e-8,
  });

  assert.equal(finest.ok, true, finest.message);
  assert.equal(finest.decimals, 8);
  assert.equal(finest.maxIndex, 1);
  closeTo(volumeAtGridStep(finest, 0), 1e-8, 1e-18);
  closeTo(volumeAtGridStep(finest, 1), 2e-8, 1e-18);
});

test("unusable anchoring blocks the whole sizing run with no request", async () => {
  const fetchImpl = stubFetch();

  const sizing = await sizeWithBroker({
    ...input(),
    symbolInfo: symbolInfo({
      grid: { volume_min: 0.01, volume_max: 10, volume_step: 1e-9 },
    }),
    fetchImpl,
  });

  assertBlocked(sizing, BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID, {
    calls: fetchImpl.calls,
  });
});

test("sizing a 0.01-anchored 0.1-step grid never leaves the anchor", async () => {
  // Budget 100 USD; the stub loses 300 per lot, so 0.31 (93) fits and
  // 0.41 (123) does not - a volume the old 0.1-anchored grid could not name.
  const fetchImpl = stubFetch({
    grid: MIN_FINER_THAN_STEP,
    lossOf: ({ volume }) => ({ loss: 300 * volume }),
  });

  const sizing = await sizeWithBroker({
    ...input(),
    symbolInfo: symbolInfo({ grid: MIN_FINER_THAN_STEP }),
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, 0.31);
  assert.equal(String(sizing.lots), "0.31");
  closeTo(sizing.measuredLossAbs, 93, 1e-9);
  assert.equal(sizing.withinRiskBudget, true);
  assert.equal(sizing.volume_min, 0.01);
  assert.equal(sizing.volume_step, 0.1);
  assert.equal(sizing.gridIndex, 3);

  const requested = fetchImpl.calls.map((call) => call.params.volume);

  assert.ok(
    requested.every((volume) => MIN_FINER_THAN_STEP_CANDIDATES.includes(volume)),
    `off-anchor volumes were requested: ${requested.join(", ")}`
  );
  assert.equal(fetchImpl.calls.length, sizing.requestsUsed);
  assertAllOnGrid(sizing, MIN_FINER_THAN_STEP);

  // The candidate one grid step up really does not fit.
  assert.equal(
    volumeAtGridStep(buildVolumeGrid(MIN_FINER_THAN_STEP), sizing.gridIndex + 1),
    0.41
  );
});

test("sizing a whole-lot grid with a half-lot minimum anchors on 0.5", async () => {
  // Budget 100 USD at 30 per lot: 2.5 (75) fits, 3.5 (105) does not.
  const fetchImpl = stubFetch({
    grid: WHOLE_STEP_WITH_HALF_MIN,
    lossOf: ({ volume }) => ({ loss: 30 * volume }),
  });

  const sizing = await sizeWithBroker({
    ...input(),
    symbolInfo: symbolInfo({ grid: WHOLE_STEP_WITH_HALF_MIN }),
    fetchImpl,
  });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, 2.5);
  assert.equal(String(sizing.lots), "2.5");
  closeTo(sizing.measuredLossAbs, 75, 1e-9);

  const requested = fetchImpl.calls.map((call) => call.params.volume);

  assert.ok(
    requested.every((volume) => WHOLE_STEP_WITH_HALF_MIN_CANDIDATES.includes(volume)),
    `off-anchor volumes were requested: ${requested.join(", ")}`
  );
  assertAllOnGrid(sizing, WHOLE_STEP_WITH_HALF_MIN);
});

// ============================================================
// PROFIT DIRECTION, DEADLINE AND FAILURE OUTPUT (2H.3)
// ============================================================

function abortError(message = "The operation was aborted") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function timeoutError(message = "The operation timed out") {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
}

function fakeSignal() {
  const listeners = [];

  return {
    aborted: false,
    listenerCount: () => listeners.length,
    abort() {
      this.aborted = true;

      for (const listener of [...listeners]) listener();
    },
    addEventListener(type, listener) {
      if (type === "abort") listeners.push(listener);
    },
    removeEventListener(type, listener) {
      if (type !== "abort") return;

      const at = listeners.indexOf(listener);

      if (at >= 0) listeners.splice(at, 1);
    },
  };
}

test("a broker gain on the loss side is never spent as risk", async () => {
  // loss_abs 50 is inside the 100 budget, but profit +50 says this pair of
  // prices was measured as a gain, so it cannot be this order's risk.
  const optimistic = stubFetch({
    lossOf: () => ({ loss: 50, profit: 50 }),
  });

  const gain = await sizeWithBroker({ ...input(), fetchImpl: optimistic });

  assertBlocked(gain, BROKER_SIZING_CODES.PROFIT_DIRECTION_MISMATCH);
  assert.equal(gain.measuredProfit, 50);
  assert.equal(gain.measuredLossAbs, null);
  assert.match(gain.message, /not a loss/);
  assert.ok(optimistic.calls.length > 0, "the broker was asked before refusing");

  // A zero answer is the same contradiction: the bridge itself refuses it as
  // ZERO_RISK_RESPONSE, so a 200 carrying it is not a measurement.
  const nothing = stubFetch({ lossOf: () => ({ loss: 0, profit: 0 }) });

  const zero = await sizeWithBroker({ ...input(), fetchImpl: nothing });

  assertBlocked(zero, BROKER_SIZING_CODES.PROFIT_DIRECTION_MISMATCH);
  assert.equal(zero.lots, 0);

  // A sell is measured the same way: rising to the stop must also come back
  // negative, whatever the sign convention of the caller looks like. The figure
  // is internally consistent (loss_abs == |profit|), so only the direction gate
  // can catch it.
  const sellGain = stubFetch({
    lossOf: () => ({ loss: 120, profit: 120 }),
  });

  const sold = await sizeWithBroker({
    ...input(),
    side: "sell",
    entry: 1.0975,
    stopLoss: 1.1,
    fetchImpl: sellGain,
  });

  assertBlocked(sold, BROKER_SIZING_CODES.PROFIT_DIRECTION_MISMATCH);
  assert.equal(sold.measuredProfit, 120);

  // The honest negative answer still sizes, and its money is loss_abs.
  const honest = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl: honest });

  assert.equal(sizing.ok, true, sizing.message);
  assert.equal(sizing.lots, 2.5);
  closeTo(sizing.measuredLossAbs, 100, 1e-9, "loss_abs is the reported risk");
  closeTo(sizing.measuredProfit, -100, 1e-9);
});

test("an already-aborted order asks the broker nothing", async () => {
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();

  const cases = [
    ["plain aborted signal", { aborted: true }],
    ["real AbortSignal", alreadyAborted.signal],
  ];

  for (const [label, signal] of cases) {
    const fetchImpl = stubFetch({
      lossOf: ({ volume }) => ({ loss: 40 * volume }),
    });

    const sizing = await sizeWithBroker({ ...input(), signal, fetchImpl });

    assertBlocked(sizing, BROKER_SIZING_CODES.REQUEST_CANCELLED, {
      calls: fetchImpl.calls,
    });
    assert.equal(sizing.requestsUsed, 0, label);
    assert.deepEqual(sizing.probedVolumes, [], label);
    assert.equal(sizing.riskBudget, 100, `${label}: a valid budget is still shown`);
  }
});

test("a stalled measurement is a timeout, not a cancellation", async () => {
  const fetchImpl = async () => {
    throw timeoutError();
  };

  const sizing = await sizeWithBroker({
    ...input(),
    requestTimeoutMs: 900,
    fetchImpl,
  });

  assertBlocked(sizing, BROKER_SIZING_CODES.REQUEST_TIMED_OUT);
  assert.match(sizing.message, /did not answer within 900 ms/);
  assert.equal(sizing.lots, 0);
});

test("a broker that never answers is cut off by the module's own deadline", async () => {
  // Nothing here resolves, so the only way this run can end is the per-request
  // timer the module sets for itself.
  let given = null;

  const fetchImpl = (url, options = {}) => {
    given = { url, options };

    return new Promise(() => {});
  };

  const sizing = await sizeWithBroker({
    ...input(),
    requestTimeoutMs: 5,
    fetchImpl,
  });

  assertBlocked(sizing, BROKER_SIZING_CODES.REQUEST_TIMED_OUT);
  assert.match(sizing.message, /did not answer within 5 ms/);
  assert.ok(given.options.signal instanceof AbortSignal, "the request got a signal");
  assert.equal(given.options.signal.aborted, true, "the deadline aborted its own request");
  assert.equal(sizing.lots, 0);
});

test("the caller's mid-request cancellation is kept distinct from the deadline", async () => {
  const signal = fakeSignal();
  const calls = [];

  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options, params: parseUrl(url).params });

    // The trader walks away while this measurement is in flight.
    signal.abort();

    throw abortError();
  };

  const sizing = await sizeWithBroker({ ...input(), signal, fetchImpl });

  assertBlocked(sizing, BROKER_SIZING_CODES.REQUEST_CANCELLED);
  assert.equal(sizing.code, BROKER_SIZING_CODES.REQUEST_CANCELLED);
  assert.equal(calls.length, 1);
  assert.equal(sizing.requestsUsed, 1);
  assert.equal(
    calls[0].options.signal instanceof AbortSignal,
    true,
    "the request was given its own abortable signal"
  );
  assert.equal(
    calls[0].options.signal.aborted,
    true,
    "the caller's cancellation reached the request signal"
  );
  assert.equal(
    signal.listenerCount(),
    0,
    "the abort listener was released on the failure path"
  );
});

test("a measurement that lands after cancellation is not reported as a size", async () => {
  const signal = fakeSignal();
  const calls = [];

  const fetchImpl = async (url, options = {}) => {
    const params = parseUrl(url).params;

    calls.push({ url, options, params });

    return {
      status: 200,
      json: async () => {
        // Aborted while the body was still arriving, then the body resolves.
        signal.abort();

        return profitBody({ params, lossAbs: 40 * Number(params.volume), grid: GRID });
      },
    };
  };

  const sizing = await sizeWithBroker({ ...input(), signal, fetchImpl });

  assert.equal(sizing.ok, false, sizing.message);
  assert.equal(sizing.code, BROKER_SIZING_CODES.REQUEST_CANCELLED);
  assert.equal(sizing.lots, 0);
  assert.equal(sizing.measuredLossAbs, null);
  assert.equal(calls.length, 1);
  assert.equal(signal.listenerCount(), 0);
});

test("an unusable per-request timeout blocks with no request", async () => {
  for (const requestTimeoutMs of [0, -1000, 1.5, Number.NaN, null, 120_001, "abc"]) {
    const fetchImpl = stubFetch();

    const sizing = await sizeWithBroker({
      ...input(),
      requestTimeoutMs,
      fetchImpl,
    });

    assertBlocked(
      sizing,
      BROKER_SIZING_CODES.INVALID_INPUT,
      { calls: fetchImpl.calls }
    );
  }
});

test("every measurement is given a bounded deadline by default", async () => {
  const fetchImpl = stubFetch({ lossOf: ({ volume }) => ({ loss: 40 * volume }) });

  const sizing = await sizeWithBroker({ ...input(), fetchImpl });

  assert.equal(sizing.ok, true, sizing.message);
  assert.ok(sizing.requestsUsed >= 2);

  for (const call of fetchImpl.calls) {
    assert.equal(
      typeof call.options?.signal?.addEventListener,
      "function",
      `no abortable signal on ${call.url}`
    );
    assert.equal(call.options.cache, "no-store");
  }
});

test("an unusable balance or risk percentage never shows a risk budget", async () => {
  const unusableBalance = [
    undefined,
    null,
    "",
    "abc",
    0,
    -500,
    -0.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];

  for (const balance of unusableBalance) {
    const sizing = await sizeWithBroker({
      ...input(),
      balance,
      fetchImpl: stubFetch(),
    });

    assertBlocked(sizing, BROKER_SIZING_CODES.INVALID_BALANCE);
    assert.equal(
      sizing.riskBudget,
      null,
      `${String(balance)} must not display a budget`
    );
    assert.ok(
      !(Number(sizing.riskBudget) < 0),
      `${String(balance)} produced a negative budget`
    );
  }

  const unusableRisk = [undefined, null, "", "abc", 0, -1, Number.NaN, Number.POSITIVE_INFINITY];

  for (const riskPercent of unusableRisk) {
    const sizing = await sizeWithBroker({
      ...input(),
      riskPercent,
      fetchImpl: stubFetch(),
    });

    assertBlocked(sizing, BROKER_SIZING_CODES.INVALID_RISK_PERCENT);
    assert.equal(
      sizing.riskBudget,
      null,
      `${String(riskPercent)} must not display a budget`
    );
  }

  // Account figures are usable, the broker metadata is not: the budget is still
  // the real one, so this change does not hide valid numbers.
  const metadataBlocked = await sizeWithBroker({
    ...input(),
    symbolInfo: null,
    fetchImpl: stubFetch(),
  });

  assertBlocked(metadataBlocked, BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA);
  closeTo(metadataBlocked.riskBudget, 100, 1e-9, "valid budget still reported");

  const nothingFits = await sizeWithBroker({
    ...input(),
    fetchImpl: stubFetch({ lossOf: ({ volume }) => ({ loss: 20_000 * volume }) }),
  });

  assertBlocked(nothingFits, BROKER_SIZING_CODES.NO_VOLUME_WITHIN_BUDGET);
  closeTo(nothingFits.riskBudget, 100, 1e-9, "valid budget still reported");
});

test("no request is ever made for a zero or negative volume", async () => {
  const grids = [
    GRID,
    MIN_FINER_THAN_STEP,
    WHOLE_STEP_WITH_HALF_MIN,
    { volume_min: 0.05, volume_max: 5, volume_step: 0.5 },
    { volume_min: 1e-8, volume_max: 2e-8, volume_step: 1e-8 },
  ];

  for (const rawGrid of grids) {
    const fetchImpl = stubFetch({
      grid: rawGrid,
      lossOf: ({ volume }) => ({ loss: volume * 1e12 }),
    });

    const sizing = await sizeWithBroker({
      ...input(),
      symbolInfo: symbolInfo({ grid: rawGrid }),
      fetchImpl,
    });

    for (const call of fetchImpl.calls) {
      const volume = Number(call.params.volume);

      assert.ok(
        Number.isFinite(volume) && volume > 0,
        `${JSON.stringify(rawGrid)} requested volume ${call.params.volume}`
      );
      assert.equal(
        validateBrokerVolume(volume, buildVolumeGrid(rawGrid)).ok,
        true,
        `${JSON.stringify(rawGrid)} requested ${volume}, which the broker would refuse`
      );
    }

    // This loss model fits nothing, so the run must refuse rather than offer a
    // fallback at a volume that was never measured.
    assert.equal(sizing.ok, false, JSON.stringify(rawGrid));
    assert.equal(sizing.lots, 0, JSON.stringify(rawGrid));
    assert.ok(
      [
        BROKER_SIZING_CODES.NO_VOLUME_WITHIN_BUDGET,
        BROKER_SIZING_CODES.REQUEST_BUDGET_EXCEEDED,
      ].includes(sizing.code),
      `${JSON.stringify(rawGrid)}: ${sizing.code}`
    );
    assert.equal(fetchImpl.calls.length, sizing.requestsUsed);
  }
});
