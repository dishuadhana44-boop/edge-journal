// src/services/twelveData.js
// Historical forex data fetcher using Twelve Data free tier
// Docs: https://twelvedata.com/docs#time-series

const API_KEY = import.meta.env.VITE_TWELVE_DATA_KEY;
const BASE_URL = "https://api.twelvedata.com";

// Twelve Data uses "EUR/USD" format, not "EURUSD" — convert automatically
function toTwelveDataSymbol(symbol) {
  if (symbol.includes("/")) return symbol;
  return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
}

// Maps your app's interval labels to Twelve Data's expected values
const INTERVAL_MAP = {
  "1m": "1min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

export class TwelveDataError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "TwelveDataError";
    this.code = code;
  }
}

export async function fetchHistoricalCandles({
  symbol,
  interval,
  startDate,
  endDate,
  outputsize = 5000,
}) {
  if (!API_KEY) {
    throw new TwelveDataError(
      "Missing VITE_TWELVE_DATA_KEY. Add it to your .env file.",
      "NO_API_KEY"
    );
  }

  const mappedInterval = INTERVAL_MAP[interval] || interval;

  const params = new URLSearchParams({
    symbol: toTwelveDataSymbol(symbol),
    interval: mappedInterval,
    outputsize: String(outputsize),
    apikey: API_KEY,
    format: "JSON",
    order: "ASC",
  });

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${BASE_URL}/time_series?${params.toString()}`);

  if (!res.ok) {
    throw new TwelveDataError(`HTTP ${res.status} fetching candles`, "HTTP_ERROR");
  }

  const data = await res.json();

  if (data.status === "error") {
    throw new TwelveDataError(data.message, data.code || "API_ERROR");
  }

  if (!data.values || data.values.length === 0) {
    throw new TwelveDataError(
      "No candle data returned for this symbol/date range.",
      "EMPTY_RESULT"
    );
  }

  return data.values.map((c) => ({
    time: Math.floor(new Date(c.datetime).getTime() / 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));
}

const cache = new Map();

export async function fetchHistoricalCandlesCached(params) {
  const key = JSON.stringify(params);
  if (cache.has(key)) return cache.get(key);

  const result = await fetchHistoricalCandles(params);
  cache.set(key, result);
  return result;
}