import test from "node:test";
import assert from "node:assert/strict";

import {
  SYNTHETIC_CANDLE_COUNT,
  SYNTHETIC_INTERVAL_SECONDS,
  SYNTHETIC_LABEL,
  SYNTHETIC_START_TIME,
  generateSyntheticCandles,
  deriveInitialLinePrices,
  createSeededRandom,
} from "./syntheticCandles.js";

test("synthetic label is the honest test-data marker", () => {
  assert.equal(SYNTHETIC_LABEL, "SYNTHETIC / TEST DATA");
});

test("candle generation is deterministic for a fixed seed", () => {
  const a = generateSyntheticCandles();
  const b = generateSyntheticCandles();

  assert.deepEqual(a, b);
  assert.equal(a.length, SYNTHETIC_CANDLE_COUNT);
});

test("a different seed produces a different series", () => {
  const a = generateSyntheticCandles({ seed: 1 });
  const b = generateSyntheticCandles({ seed: 2 });

  assert.notDeepEqual(a, b);
});

test("seeded random stays inside [0, 1)", () => {
  const random = createSeededRandom(42);

  for (let index = 0; index < 500; index += 1) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
});

test("every candle is valid OHLC and time is contiguous", () => {
  const candles = generateSyntheticCandles({ count: 64 });

  candles.forEach((candle, index) => {
    assert.ok(Number.isFinite(candle.open));
    assert.ok(Number.isFinite(candle.high));
    assert.ok(Number.isFinite(candle.low));
    assert.ok(Number.isFinite(candle.close));

    assert.ok(candle.price !== 0);
    assert.ok(candle.open > 0 && candle.close > 0);

    assert.ok(
      candle.high >= Math.max(candle.open, candle.close),
      `high must contain the body (index ${index})`
    );
    assert.ok(
      candle.low <= Math.min(candle.open, candle.close),
      `low must contain the body (index ${index})`
    );
    assert.ok(candle.high >= candle.low);

    assert.equal(
      candle.time,
      SYNTHETIC_START_TIME + index * SYNTHETIC_INTERVAL_SECONDS
    );
    assert.ok(Number.isInteger(candle.volume));
  });
});

test("initial levels bracket the last close", () => {
  const candles = generateSyntheticCandles();
  const lastClose = candles[candles.length - 1].close;
  const levels = deriveInitialLinePrices(candles);

  assert.ok(Number.isFinite(levels.sl));
  assert.ok(Number.isFinite(levels.tp));
  assert.ok(levels.sl < lastClose);
  assert.ok(levels.tp > lastClose);
});

test("initial levels are null for missing or unusable data", () => {
  assert.deepEqual(deriveInitialLinePrices([]), { sl: null, tp: null });
  assert.deepEqual(deriveInitialLinePrices(null), { sl: null, tp: null });
  assert.deepEqual(
    deriveInitialLinePrices([{ close: 0 }]),
    { sl: null, tp: null }
  );
  assert.deepEqual(
    deriveInitialLinePrices([{ close: "abc" }]),
    { sl: null, tp: null }
  );
});
