import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_PIP_SIZE,
  SIZING_CODES,
  distanceInPips,
  floorToLotStep,
  sizePosition,
} from "../positionSizing.js";

function closeTo(actual, expected, tolerance = 1e-9, message = "") {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`
  );
}

test("EURUSD sizes on a USD-quoted 5-digit pip", () => {
  const sizing = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: 150,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, true);
  assert.equal(sizing.code, SIZING_CODES.OK);
  closeTo(sizing.distancePips, 50, 1e-6);
  closeTo(sizing.pipValuePerLot, 10, 1e-9, "pip value per lot");
  assert.equal(sizing.lots, 0.3);
  closeTo(sizing.plannedRisk, 150, 0.01);
});

test("USDJPY uses a 0.01 pip and converts JPY profit into USD", () => {
  const sizing = sizePosition({
    symbol: "USDJPY",
    entryPrice: 150.0,
    stopLoss: 149.5,
    riskAmount: 150,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, true);
  closeTo(sizing.distancePips, 50, 1e-6);
  closeTo(sizing.pipValuePerLot, 1000 / 150, 1e-9, "pip value per lot");

  // The old fixed $10-per-pip maths sized this at 0.003 lots, ~150x undersized.
  assert.equal(sizing.lots, 0.45);
  closeTo(sizing.plannedRisk, 150, 0.01);
});

test("XAUUSD sizes on 100 oz contracts, not on FX pips", () => {
  const sizing = sizePosition({
    symbol: "XAUUSD",
    entryPrice: 2000,
    stopLoss: 1990,
    riskAmount: 110,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, true);
  closeTo(sizing.distancePips, 100, 1e-6);
  closeTo(sizing.pipValuePerLot, 10, 1e-9);
  assert.equal(sizing.lots, 0.11);
  closeTo(sizing.plannedRisk, 110, 0.01);
});

test("BTCUSD sizes on its own pip size and 1-coin contract", () => {
  const sizing = sizePosition({
    symbol: "BTCUSD",
    entryPrice: 60000,
    stopLoss: 58000,
    riskAmount: 200,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, true);
  closeTo(sizing.distancePips, 2000, 1e-9);
  closeTo(sizing.pipValuePerLot, 1, 1e-9);
  assert.equal(sizing.lots, 0.1);
  closeTo(sizing.plannedRisk, 200, 0.01);
});

test("a JPY account is converted with the traded symbol's own rate", () => {
  const sizing = sizePosition({
    symbol: "USDJPY",
    entryPrice: 150.0,
    stopLoss: 149.5,
    riskAmount: 50000,
    accountCurrency: "JPY",
  });

  assert.equal(sizing.ok, true);
  closeTo(sizing.pipValuePerLot, 1000, 1e-9);
  assert.equal(sizing.lots, 1);
  closeTo(sizing.plannedRisk, 50000, 0.01);
});

test("volume is floored to the lot step and never spends more than requested", () => {
  const sizing = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: 174.9,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, true);
  closeTo(sizing.rawLots, 0.3498, 1e-6);
  assert.equal(sizing.lots, 0.34);
  assert.ok(sizing.lots <= sizing.rawLots);
  assert.ok(sizing.plannedRisk <= sizing.riskAmount + 1e-9);

  for (let risk = 1; risk <= 300; risk += 7) {
    const result = sizePosition({
      symbol: "EURUSD",
      entryPrice: 1.1,
      stopLoss: 1.095,
      riskAmount: risk,
      accountCurrency: "USD",
    });

    if (result.ok) {
      assert.ok(
        result.plannedRisk <= result.riskAmount + 1e-6,
        `risk ${risk} over-funded at ${result.plannedRisk}`
      );
      assert.equal(
        result.lots,
        floorToLotStep(result.lots),
        `risk ${risk} is not on the lot step`
      );
    }
  }
});

test("the minimum lot is reported when it would exceed the risk budget", () => {
  const sizing = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: 4,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, false);
  assert.equal(sizing.code, SIZING_CODES.BELOW_MIN_LOT);
  assert.equal(sizing.lots, 0);
  closeTo(sizing.riskAtMinLot, 5, 1e-6);
  assert.match(sizing.message, /minimum would risk 5\.00 USD/);
});

test("volume above the maximum is capped down, which only reduces risk", () => {
  const sizing = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: 100000,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, true);
  closeTo(sizing.rawLots, 200, 1e-6);
  assert.equal(sizing.lots, 100);
  assert.equal(sizing.cappedAtMaxLot, true);
  closeTo(sizing.plannedRisk, 50000, 0.01);
  assert.ok(sizing.plannedRisk < sizing.riskAmount);
});

test("an unknown symbol blocks instead of guessing a lot size", () => {
  for (const symbol of ["US500", "NAS100", ""]) {
    const sizing = sizePosition({
      symbol,
      entryPrice: 1.1,
      stopLoss: 1.095,
      riskAmount: 150,
      accountCurrency: "USD",
    });

    assert.equal(sizing.ok, false, symbol);
    assert.equal(sizing.code, SIZING_CODES.NO_SPEC, symbol);
    assert.equal(sizing.lots, 0, symbol);
    assert.match(sizing.message, /No contract specification/, symbol);
  }
});

test("a quote currency the account cannot receive blocks sizing", () => {
  const crossPair = sizePosition({
    symbol: "EURGBP",
    entryPrice: 0.86,
    stopLoss: 0.855,
    riskAmount: 150,
    accountCurrency: "USD",
  });

  assert.equal(crossPair.ok, false);
  assert.equal(crossPair.code, SIZING_CODES.NO_CONVERSION);
  assert.equal(crossPair.lots, 0);
  assert.match(crossPair.message, /Cannot convert GBP profit/);

  const noAccountCurrency = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: 150,
    accountCurrency: "",
  });

  assert.equal(noAccountCurrency.ok, false);
  assert.equal(noAccountCurrency.code, SIZING_CODES.NO_CONVERSION);
  assert.match(noAccountCurrency.message, /account currency is unknown/);
});

test("incomplete or impossible inputs are refused", () => {
  const cases = [
    ["missing risk", { riskAmount: 0 }],
    ["missing entry", { entryPrice: 0 }],
    ["missing stop", { stopLoss: 0 }],
    ["stop equals entry", { stopLoss: 1.1 }],
    ["non-numeric entry", { entryPrice: "abc" }],
  ];

  for (const [label, override] of cases) {
    const sizing = sizePosition({
      symbol: "EURUSD",
      entryPrice: 1.1,
      stopLoss: 1.095,
      riskAmount: 150,
      accountCurrency: "USD",
      ...override,
    });

    assert.equal(sizing.ok, false, label);
    assert.equal(sizing.code, SIZING_CODES.INVALID_INPUT, label);
    assert.equal(sizing.lots, 0, label);
  }
});

test("floorToLotStep always rounds down inside the step grid", () => {
  assert.equal(floorToLotStep(0.0299999), 0.02);
  assert.equal(floorToLotStep(0.030000000000000002), 0.03);
  assert.equal(floorToLotStep(0.009999), 0);
  assert.equal(floorToLotStep(1.239, 0.01), 1.23);
  assert.equal(floorToLotStep(1.239, 0.1), 1.2);
  assert.equal(floorToLotStep(0), 0);
  assert.equal(floorToLotStep(-5), 0);
  assert.equal(floorToLotStep(Number.NaN), 0);
});

test("pip distance is measured with the symbol's own pip size", () => {
  closeTo(
    distanceInPips({ symbol: "EURUSD", from: 1.1, to: 1.095 }).pips,
    50,
    1e-6
  );

  const jpy = distanceInPips({ symbol: "USDJPY", from: 150.0, to: 149.5 });
  closeTo(jpy.pips, 50, 1e-6);
  assert.equal(jpy.pipSize, 0.01);
  assert.equal(jpy.approximate, false);

  const gold = distanceInPips({ symbol: "XAUUSD", from: 2000, to: 1990 });
  closeTo(gold.pips, 100, 1e-6);
  assert.equal(gold.pipSize, 0.1);

  // Marked approximate, and never read by sizePosition for an unknown symbol.
  const unknown = distanceInPips({ symbol: "US500", from: 5000, to: 4950 });
  closeTo(unknown.pips, 50 / LEGACY_PIP_SIZE, 1e-6);
  assert.equal(unknown.approximate, true);
});
