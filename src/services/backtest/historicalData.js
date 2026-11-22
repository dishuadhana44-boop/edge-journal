// src/services/backtest/historicalData.js
// HistoricalDataService — one normalisation + provenance boundary for every
// backtest candle source. Candles leave this module as
// { time: epochMilliseconds, open, high, low, close, volume }, sorted ASC.

import { fetchHistoricalCandles } from "../twelveData";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const PROVENANCE = {
  REAL: "real",
  IMPORTED: "imported",
  UNAVAILABLE: "unavailable",
};

export const SOURCES = {
  MT5: "mt5",
  TWELVE_DATA: "twelvedata",
  IMPORT: "import",
};

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

const MT5_TIMEFRAME = {
  "1m": "M1",
  "5m": "M5",
  "15m": "M15",
  "30m": "M30",
  "1h": "H1",
  "4h": "H4",
  "1d": "D1",
};

const TIMEFRAME_SECONDS = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export const MAX_MT5_CANDLES = 1000; // server route clamps count to 1000

export class HistoricalDataError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "HistoricalDataError";
    this.code = code;
  }
}

function toMillis(value) {
  if (value == null || value === "") return NaN;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return NaN;
    return value > 1e11 ? Math.floor(value) : Math.floor(value * 1000);
  }

  const text = String(value).trim();

  if (/^\d{10}$/.test(text)) return Number(text) * 1000;
  if (/^\d{13}$/.test(text)) return Number(text);

  // "2025-04-17 13:45" and ISO strings are read as UTC — broker feeds are UTC.
  const normalised = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text)
    ? `${text.replace(" ", "T")}${text.endsWith("Z") ? "" : "Z"}`
    : text;

  const parsed = Date.parse(normalised);
  return Number.isNaN(parsed) ? NaN : parsed;
}

// Broker feeds occasionally deliver a candle whose high/low ignore open/close.
// Repairing the trivial cases keeps one bad row from nuking a whole range.
function repairOhlc(open, high, low, close) {
  return {
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
  };
}

export function normalizeCandles(rawCandles) {
  const byTime = new Map();

  let dropped = 0;
  let repaired = 0;
  let duplicates = 0;

  for (const raw of rawCandles || []) {
    const time = toMillis(raw.time ?? raw.timestamp ?? raw.date ?? raw.dt);

    const open = Number(raw.open);
    const high = Number(raw.high ?? raw.h);
    const low = Number(raw.low ?? raw.l);
    const close = Number(raw.close ?? raw.c);

    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0
    ) {
      dropped += 1;
      continue;
    }

    let candle;

    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      const fixed = repairOhlc(open, high, low, close);

      // Still inconsistent after repair means the row is unusable.
      if (
        fixed.high < fixed.low ||
        Math.abs(fixed.high - high) > open * 0.05 ||
        Math.abs(fixed.low - low) > open * 0.05
      ) {
        dropped += 1;
        continue;
      }

      candle = { time, ...fixed };
      repaired += 1;
    } else {
      candle = { time, open, high, low, close };
    }

    const volume = Number(raw.volume ?? raw.tick_volume ?? raw.tickVolume);
    candle.volume = Number.isFinite(volume) && volume >= 0 ? volume : 0;

    // Last writer wins: duplicate stamps arrive mid-update from the bridge.
    if (byTime.has(time)) duplicates += 1;
    byTime.set(time, candle);
  }

  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);

  return {
    candles,
    dropped,
    duplicates,
    repaired,
  };
}

export function inferTimeframe(candles) {
  if (candles.length < 2) return null;

  const deltas = [];
  for (let i = 1; i < Math.min(candles.length, 40); i += 1) {
    deltas.push(candles[i].time - candles[i - 1].time);
  }

  deltas.sort((a, b) => a - b);
  const medianSeconds = (deltas[Math.floor(deltas.length / 2)] || 0) / 1000;
  if (medianSeconds <= 0) return null;

  let best = null;
  let bestRatio = Infinity;

  for (const [label, seconds] of Object.entries(TIMEFRAME_SECONDS)) {
    const ratio = Math.max(seconds, medianSeconds) / Math.min(seconds, medianSeconds);
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = label;
    }
  }

  return bestRatio <= 1.35 ? best : null;
}

export function candlesToCsv(candles) {
  const header = "time,open,high,low,close,volume";

  const rows = candles.map(
    (c) => `${Math.round(c.time / 1000)},${c.open},${c.high},${c.low},${c.close},${c.volume}`
  );

  return [header, ...rows].join("\n");
}

export function parseCandlesCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length < 2) {
    throw new HistoricalDataError(
      "The file contains no candle rows. Expected a header plus at least one candle.",
      "EMPTY_CSV"
    );
  }

  const header = lines[0]
    .split(/[,;\t]/)
    .map((name) => name.trim().toLowerCase().replace(/^\ufeff/, ""));

  const index = (...candidates) => {
    for (const candidate of candidates) {
      const found = header.indexOf(candidate);
      if (found !== -1) return found;
    }
    return -1;
  };

  const timeIdx = index("time", "timestamp", "datetime", "date", "dt");
  const openIdx = index("open", "o");
  const highIdx = index("high", "h");
  const lowIdx = index("low", "l");
  const closeIdx = index("close", "c");
  const volumeIdx = index("volume", "vol", "tick_volume", "tickvolume", "v");

  if ([timeIdx, openIdx, highIdx, lowIdx, closeIdx].some((i) => i === -1)) {
    throw new HistoricalDataError(
      "CSV needs time/date, open, high, low and close columns. " +
        `Found: ${header.join(", ") || "none"}`,
      "BAD_HEADER"
    );
  }

  // A header row means the first line is not data; otherwise treat it as data.
  const looksLikeData = (line) => {
    const first = line.split(/[,;\t]/)[0]?.trim() || "";
    return /^\d{4}-\d{2}-\d{2}/.test(first) || /^\d{9,13}$/.test(first.replace(/\./g, "")) ||
      /^\d{9,13}\.\d+$/.test(first);
  };

  const dataLines = looksLikeData(lines[0]) ? lines : lines.slice(1);

  const raw = dataLines.map((line) => {
    const cells = line.split(/[,;\t]/);
    return {
      time: cells[timeIdx],
      open: cells[openIdx],
      high: cells[highIdx],
      low: cells[lowIdx],
      close: cells[closeIdx],
      volume: volumeIdx === -1 ? 0 : cells[volumeIdx],
    };
  });

  return normalizeCandles(raw);
}

async function fetchMt5Candles({ symbol, interval, count }) {
  const timeframe = MT5_TIMEFRAME[interval];

  if (!timeframe) {
    throw new HistoricalDataError(
      `The MT5 bridge has no ${interval} data for ${symbol}.`,
      "UNSUPPORTED_TIMEFRAME"
    );
  }

  const params = new URLSearchParams({ symbol, timeframe, count: String(count) });

  let response;
  try {
    response = await fetch(`${API_URL}/api/mt5/candles?${params}`);
  } catch {
    throw new HistoricalDataError(
      "Cannot reach the EdgeFlo backend. Start it with `npm run dev` to load MT5 candles.",
      "BACKEND_OFFLINE"
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new HistoricalDataError(
      body.message || `Backend returned HTTP ${response.status} for MT5 candles.`,
      body.error || "MT5_CANDLES_HTTP"
    );
  }

  const data = await response.json();

  if (data?.success === false) {
    throw new HistoricalDataError(
      data.message || "The MT5 bridge returned no candles.",
      "MT5_NOT_CONNECTED"
    );
  }

  return {
    raw: data.candles || [],
    reportedSymbol: data.symbol,
    reportedTimeframe: data.timeframe,
  };
}

async function fetchTwelveDataCandles({ symbol, interval, startDate, endDate }) {
  const raw = await fetchHistoricalCandles({
    symbol,
    interval,
    startDate,
    endDate,
    outputsize: 5000,
  });

  return { raw };
}

function withinRange(candles, startDate, endDate) {
  const start = startDate ? toMillis(`${startDate}T00:00`) : null;
  const end = endDate ? toMillis(`${endDate}T23:59:59.999`) : null;

  return candles.filter((c) => {
    if (Number.isFinite(start) && c.time < start) return false;
    if (Number.isFinite(end) && c.time > end) return false;
    return true;
  });
}

/**
 * @returns {Promise<{candles, provenance, source, label, meta}>}
 */
export async function loadHistoricalCandles({
  source = SOURCES.MT5,
  symbol = "EURUSD",
  interval = "15m",
  startDate = "",
  endDate = "",
  count = MAX_MT5_CANDLES,
  importedText = "",
}) {
  const cleanSymbol = String(symbol).toUpperCase().trim().replace(/\//g, "");

  if (!cleanSymbol) {
    throw new HistoricalDataError("Choose a symbol before loading data.", "NO_SYMBOL");
  }

  if (startDate && endDate && startDate > endDate) {
    throw new HistoricalDataError("Start date must be before end date.", "BAD_RANGE");
  }

  let raw;
  let provenance;
  let label;
  const meta = { symbol: cleanSymbol, interval, requestedRange: { startDate, endDate } };

  if (source === SOURCES.IMPORT) {
    const parsed = parseCandlesCsv(importedText);
    raw = parsed.candles;
    provenance = PROVENANCE.IMPORTED;

    const integrity = [
      parsed.dropped ? `${parsed.dropped} invalid rows skipped` : null,
      parsed.repaired ? `${parsed.repaired} OHLC repairs` : null,
      parsed.duplicates ? `${parsed.duplicates} duplicate stamps merged` : null,
    ].filter(Boolean);

    label = ["Imported file", ...integrity].join(" · ");
    meta.dropped = parsed.dropped;
    meta.repaired = parsed.repaired;
    meta.duplicates = parsed.duplicates;
  } else if (source === SOURCES.TWELVE_DATA) {
    try {
      ({ raw } = await fetchTwelveDataCandles({ symbol: cleanSymbol, interval, startDate, endDate }));
    } catch (error) {
      throw new HistoricalDataError(error.message, error.code || "TWELVE_DATA");
    }
    provenance = PROVENANCE.REAL;
    label = "Twelve Data · real historical OHLC";
  } else {
    ({ raw } = await fetchMt5Candles({ symbol: cleanSymbol, interval, count }));
    provenance = PROVENANCE.REAL;
    label = "MT5 bridge · real broker history";
    meta.reportedTimeframe = MT5_TIMEFRAME[interval];
    meta.cap = MAX_MT5_CANDLES;
    meta.reportedVolume = raw.some((candle) => Number(candle.volume ?? candle.tick_volume) > 0)
      ? "tick volume"
      : "none supplied by bridge";
  }

  const normalized = normalizeCandles(raw);

  if (normalized.dropped) meta.dropped = (meta.dropped || 0) + normalized.dropped;
  if (normalized.repaired) meta.repaired = (meta.repaired || 0) + normalized.repaired;
  if (normalized.duplicates) meta.duplicates = (meta.duplicates || 0) + normalized.duplicates;

  const filtered = withinRange(normalized.candles, startDate, endDate);

  if (filtered.length < 2) {
    const hint =
      source === SOURCES.MT5 && (startDate || endDate)
        ? ` MT5 only serves the most recent ${MAX_MT5_CANDLES} ${interval} candles, so older ranges may be empty.`
        : "";

    throw new HistoricalDataError(
      `Not enough usable candles for ${cleanSymbol} ${interval}.${hint}`,
      "INSUFFICIENT_DATA"
    );
  }

  const intervalSeconds = TIMEFRAME_SECONDS[interval];

  let largestGapMs = 0;
  for (let i = 1; i < filtered.length; i += 1) {
    largestGapMs = Math.max(largestGapMs, filtered[i].time - filtered[i - 1].time);
  }

  meta.firstTime = filtered[0].time;
  meta.lastTime = filtered[filtered.length - 1].time;
  meta.largestGapCandles = intervalSeconds
    ? Math.max(0, Math.round(largestGapMs / 1000 / intervalSeconds) - 1)
    : 0;

  const inferred = inferTimeframe(filtered);
  if (inferred && inferred !== interval) {
    meta.timeframeMismatch = { expected: interval, detected: inferred };
  }

  return {
    candles: filtered,
    provenance,
    source,
    label,
    meta,
  };
}

export function timeframeSeconds(interval) {
  return TIMEFRAME_SECONDS[interval] || null;
}
