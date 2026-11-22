// ==========================================================
// CHART PROTOTYPE — SYNTHETIC CANDLE SOURCE
//
// Phase 1 scaffold only. This module exists so the draggable
// SL/TP prototype can render a real candlestick series without
// any market, MT5 or broker request of any kind.
//
// It is deliberately deterministic: the same seed always
// produces byte-identical candles, which keeps screenshots,
// tests and bug reports reproducible.
//
// ISOLATION RULES
//   - no imports (no services, no contexts, no fetch)
//   - no Date.now(): time starts at a fixed UTC stamp
//   - the prototype page labels this data "SYNTHETIC / TEST DATA"
//
// A real candle adapter can replace `generateSyntheticCandles`
// later without touching the chart, overlay or geometry code.
// ==========================================================

export const SYNTHETIC_LABEL = "SYNTHETIC / TEST DATA";

export const SYNTHETIC_SYMBOL = "SYNTH-EURUSD";

// 2024-01-01T00:00:00Z — fixed so runs are reproducible.
export const SYNTHETIC_START_TIME = 1704067200;

export const SYNTHETIC_INTERVAL_SECONDS = 15 * 60;

export const SYNTHETIC_CANDLE_COUNT = 320;

// ==========================================================
// SEEDED RANDOM (mulberry32)
// ==========================================================

export function createSeededRandom(seed = 20260101) {
  let state = seed >>> 0;

  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Five decimals for FX majors, three for metals/indices — the
// same rule the positions table already uses for display.
function roundPrice(value) {
  const decimals = Math.abs(value) >= 100 ? 3 : 5;
  return Number(value.toFixed(decimals));
}

// ==========================================================
// GENERATION
// ==========================================================

export function generateSyntheticCandles({
  count = SYNTHETIC_CANDLE_COUNT,
  intervalSeconds = SYNTHETIC_INTERVAL_SECONDS,
  startTime = SYNTHETIC_START_TIME,
  basePrice = 1.085,
  seed = 20260101,
  volatility = 0.00062,
  drift = 0.0000045,
} = {}) {
  const safeCount = Math.max(2, Math.floor(Number(count) || 0));

  const random = createSeededRandom(seed);

  const candles = [];

  let previousClose = roundPrice(basePrice);

  for (let index = 0; index < safeCount; index += 1) {
    const open = previousClose;

    // A slow upward drift plus symmetric noise gives a series
    // that trends enough to look real without ever exploding.
    const body = (random() * 2 - 1) * volatility + drift;

    const close = roundPrice(open + body);

    const upperWick = random() * volatility * 0.9;
    const lowerWick = random() * volatility * 0.9;

    // Rounding happens after the wick is added so high/low can
    // never exclude open/close.
    const high = roundPrice(Math.max(open, close) + upperWick);
    const low = roundPrice(Math.min(open, close) - lowerWick);

    candles.push({
      time: startTime + index * intervalSeconds,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume: Math.round(400 + random() * 900),
    });

    previousClose = close;
  }

  return candles;
}

// ==========================================================
// INITIAL TEST LEVELS
// ==========================================================

// Distance from the last close, wide enough to stay visible
// after fitContent() and close enough to drag comfortably.
const INITIAL_STOP_DISTANCE = 0.0018;
const INITIAL_TARGET_DISTANCE = 0.0024;

export function deriveInitialLinePrices(
  candles,
  {
    stopDistance = INITIAL_STOP_DISTANCE,
    targetDistance = INITIAL_TARGET_DISTANCE,
  } = {}
) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { sl: null, tp: null };
  }

  const lastClose = Number(candles[candles.length - 1]?.close);

  if (!Number.isFinite(lastClose) || lastClose <= 0) {
    return { sl: null, tp: null };
  }

  return {
    sl: roundPrice(lastClose - stopDistance),
    tp: roundPrice(lastClose + targetDistance),
  };
}
