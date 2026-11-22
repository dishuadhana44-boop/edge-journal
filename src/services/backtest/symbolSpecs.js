// src/services/backtest/symbolSpecs.js
// Instrument contracts used by the backtest simulator. These are the
// specification assumptions the engine trades against — they are surfaced in
// the settings panel so a user can see exactly what a lot is worth.

const FOREX_LOT = 100000;

export const SYMBOL_SPECS = {
  EURUSD: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "EUR", quote: "USD", spreadPips: 1.0 },
  GBPUSD: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "GBP", quote: "USD", spreadPips: 1.2 },
  AUDUSD: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "AUD", quote: "USD", spreadPips: 1.4 },
  NZDUSD: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "NZD", quote: "USD", spreadPips: 1.8 },
  USDCAD: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "USD", quote: "CAD", spreadPips: 1.6 },
  USDCHF: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "USD", quote: "CHF", spreadPips: 1.8 },
  USDJPY: { digits: 3, pipSize: 0.01, contractSize: FOREX_LOT, base: "USD", quote: "JPY", spreadPips: 1.5 },
  EURJPY: { digits: 3, pipSize: 0.01, contractSize: FOREX_LOT, base: "EUR", quote: "JPY", spreadPips: 1.8 },
  GBPJPY: { digits: 3, pipSize: 0.01, contractSize: FOREX_LOT, base: "GBP", quote: "JPY", spreadPips: 2.5 },
  EURGBP: { digits: 5, pipSize: 0.0001, contractSize: FOREX_LOT, base: "EUR", quote: "GBP", spreadPips: 1.6 },
  XAUUSD: { digits: 2, pipSize: 0.1, contractSize: 100, base: "XAU", quote: "USD", spreadPips: 3.0 },
  XAGUSD: { digits: 3, pipSize: 0.01, contractSize: 5000, base: "XAG", quote: "USD", spreadPips: 2.0 },
  BTCUSD: { digits: 2, pipSize: 1, contractSize: 1, base: "BTC", quote: "USD", spreadPips: 25, crypto: true },
  ETHUSD: { digits: 2, pipSize: 0.1, contractSize: 10, base: "ETH", quote: "USD", spreadPips: 30, crypto: true },
};

export const LOT_STEP = 0.01;
export const MIN_LOT = 0.01;
export const MAX_LOT = 100;

export const SUPPORTED_ACCOUNT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

export function getSymbolSpec(symbol) {
  const key = String(symbol || "").toUpperCase().replace(/\//g, "");
  return SYMBOL_SPECS[key] || null;
}

export function listSymbols() {
  return Object.keys(SYMBOL_SPECS);
}

// The backtest only knows the price stream it is replaying, so a currency can
// only be converted when it is one leg of the traded symbol.
export function convertCurrency(from, to, symbolPrice, spec) {
  if (!spec || !Number.isFinite(symbolPrice)) return null;

  const source = String(from).toUpperCase();
  const target = String(to).toUpperCase();

  if (source === target) return 1;
  if (source === spec.quote && target === spec.base) return 1 / symbolPrice;
  if (source === spec.base && target === spec.quote) return symbolPrice;

  return null;
}

export function pipValuePerLot({ symbol, price, accountCurrency }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return null;

  const perLotInQuote = spec.pipSize * spec.contractSize;
  const rate = convertCurrency(spec.quote, accountCurrency, price, spec);
  if (rate == null) return null;

  return perLotInQuote * rate;
}

export function priceToPips({ symbol, from, to }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return null;
  return (Number(to) - Number(from)) / spec.pipSize;
}

export function pipsToPrice({ symbol, from, pips, direction }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return null;

  const offset = Math.abs(Number(pips)) * spec.pipSize;
  const above = direction === "above";
  return Number(from) + (above ? offset : -offset);
}

export function spreadInPrice({ symbol, spreadPips }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return 0;
  return Math.max(0, Number(spreadPips) || 0) * spec.pipSize;
}

export function roundToLotStep(volume) {
  return Math.round(Number(volume) / LOT_STEP) * LOT_STEP;
}

/**
 * Volume for a risk-percentage stop, or null when the maths cannot be done
 * honestly (unknown symbol, zero stop distance, non-convertible currency).
 */
export function riskVolume({ symbol, price, accountCurrency, balance, riskPercent, stopDistancePrice }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return null;

  const pipValue = pipValuePerLot({ symbol, price, accountCurrency });
  if (pipValue == null || pipValue <= 0) return null;

  const distancePips = Math.abs(Number(stopDistancePrice)) / spec.pipSize;
  if (!Number.isFinite(distancePips) || distancePips <= 0) return null;

  const riskAmount = (Number(balance) * Number(riskPercent)) / 100;
  if (!(riskAmount > 0)) return null;

  return roundToLotStep(riskAmount / (distancePips * pipValue));
}

export function notionalInAccount({ symbol, price, volume, accountCurrency }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return null;

  const rate = convertCurrency(spec.quote, accountCurrency, price, spec);
  if (rate == null) return null;

  // contractSize * price is quoted in the symbol's quote currency.
  return spec.contractSize * Number(volume) * price * rate;
}

export function requiredMargin({ symbol, price, volume, accountCurrency, leverage }) {
  const notional = notionalInAccount({ symbol, price, volume, accountCurrency });
  if (notional == null) return null;

  const lev = Number(leverage);
  if (!(lev > 0)) return null;

  return notional / lev;
}

export function positionPnl({ symbol, side, entry, price, volume, accountCurrency }) {
  const spec = getSymbolSpec(symbol);
  if (!spec) return null;

  const direction = String(side).toUpperCase() === "BUY" ? 1 : -1;
  const delta = (Number(price) - Number(entry)) * direction * spec.contractSize * Number(volume);

  const rate = convertCurrency(spec.quote, accountCurrency, price, spec);
  if (rate == null) return null;

  return delta * rate;
}

export function formatPrice(symbol, value) {
  const spec = getSymbolSpec(symbol);
  return Number(value).toFixed(spec?.digits ?? 5);
}
