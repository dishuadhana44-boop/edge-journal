import { getSymbolSpec, pipValuePerLot, LOT_STEP, MIN_LOT, MAX_LOT } from "../../services/backtest/symbolSpecs.js";

// The live order panel used to size every instrument as if it were a USD-quoted
// 5-digit FX pair ($10 per pip per lot, 0.0001 pip). This module is the single
// instrument-aware replacement: the per-symbol contract comes from the app's own
// specification table, and sizing stops with an explicit reason whenever that
// table has no entry for the symbol or cannot convert the symbol's quote
// currency into the account currency. Nothing is ever guessed.
export const LEGACY_PIP_SIZE = 0.0001;

export const SIZING_CODES = {
  OK: "OK",
  INVALID_INPUT: "INVALID_INPUT",
  NO_SPEC: "NO_SPEC",
  NO_CONVERSION: "NO_CONVERSION",
  BELOW_MIN_LOT: "BELOW_MIN_LOT",
};

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Volume is floored, never rounded up: a rounded-up lot sizes the trade above the
// risk the trader asked for.
export function floorToLotStep(volume, step = LOT_STEP) {
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  if (!(step > 0)) return volume;

  // floored in the step grid, with the float noise of 0.01*3 removed afterwards.
  const steps = Math.floor(Number((volume / step).toFixed(9)));
  return Number((steps * step).toFixed(8));
}

export function distanceInPips({ symbol, from, to }) {
  const spec = getSymbolSpec(symbol);
  const distance = Math.abs(Number(from) - Number(to));

  if (!Number.isFinite(distance)) {
    return { pips: 0, distance: 0, pipSize: null, approximate: false };
  }

  if (!spec) {
    // Display only — sizing refuses on an unknown symbol before it ever reads
    // this value, so an approximate pip count can never move a lot size.
    return {
      pips: distance / LEGACY_PIP_SIZE,
      distance,
      pipSize: LEGACY_PIP_SIZE,
      approximate: true,
    };
  }

  return {
    pips: distance / spec.pipSize,
    distance,
    pipSize: spec.pipSize,
    approximate: false,
  };
}

export function sizePosition({ symbol, entryPrice, stopLoss, riskAmount, accountCurrency }) {
  const entry = finiteNumber(entryPrice);
  const stop = finiteNumber(stopLoss);
  const risk = finiteNumber(riskAmount);
  const currency = String(accountCurrency || "").trim().toUpperCase();

  const blocked = (code, message, extra = {}) => ({
    ok: false,
    lots: 0,
    code,
    message,
    symbol: String(symbol || "").toUpperCase(),
    accountCurrency: currency || null,
    ...extra,
  });

  if (!(risk > 0)) {
    return blocked(
      SIZING_CODES.INVALID_INPUT,
      "Risk per trade is not configured, so no position size can be calculated."
    );
  }

  if (!(entry > 0) || !(stop > 0) || entry === stop) {
    return blocked(
      SIZING_CODES.INVALID_INPUT,
      "Entry and stop-loss prices are both required to size this position.",
      { riskAmount: risk }
    );
  }

  if (!currency) {
    return blocked(
      SIZING_CODES.NO_CONVERSION,
      "The account currency is unknown, so pip value cannot be converted.",
      { riskAmount: risk }
    );
  }

  const spec = getSymbolSpec(symbol);

  if (!spec) {
    return blocked(
      SIZING_CODES.NO_SPEC,
      `No contract specification is available for ${String(symbol).toUpperCase()}, so lot size cannot be calculated. Size this order manually.`,
      { riskAmount: risk }
    );
  }

  const perLot = pipValuePerLot({
    symbol,
    price: entry,
    accountCurrency: currency,
  });

  if (perLot == null || !(perLot > 0)) {
    return blocked(
      SIZING_CODES.NO_CONVERSION,
      `Cannot convert ${spec.quote} profit for ${spec.base}${spec.quote} into a ${currency} account. Use a symbol whose currency you hold, or size manually.`,
      { riskAmount: risk, spec }
    );
  }

  const distance = Math.abs(entry - stop);
  const distancePips = distance / spec.pipSize;

  if (!(distancePips > 0)) {
    return blocked(
      SIZING_CODES.INVALID_INPUT,
      "Stop distance is zero, so the position has no risk to size against.",
      { riskAmount: risk, spec, pipValuePerLot: perLot }
    );
  }

  const rawLots = risk / (distancePips * perLot);
  const lots = floorToLotStep(rawLots);

  const detail = {
    code: SIZING_CODES.OK,
    symbol: String(symbol).toUpperCase(),
    spec,
    accountCurrency: currency,
    riskAmount: risk,
    entryPrice: entry,
    stopLoss: stop,
    distancePips,
    pipValuePerLot: perLot,
    rawLots,
    lotStep: LOT_STEP,
    minLot: MIN_LOT,
    maxLot: MAX_LOT,
  };

  if (lots < MIN_LOT) {
    const riskAtMinLot = MIN_LOT * distancePips * perLot;

    return {
      ...detail,
      code: SIZING_CODES.BELOW_MIN_LOT,
      ok: false,
      lots: 0,
      riskAtMinLot,
      message:
        `The ${MIN_LOT}-lot minimum would risk ${riskAtMinLot.toFixed(2)} ${currency} on this stop, ` +
        `more than the requested ${risk.toFixed(2)} ${currency}. ` +
        "Widen the stop, raise the risk per trade, or size this order manually.",
    };
  }

  // Above the maximum the volume is clamped down, which only ever reduces risk.
  const cappedLots = Number(Math.min(lots, MAX_LOT).toFixed(2));

  return {
    ...detail,
    ok: true,
    lots: cappedLots,
    cappedAtMaxLot: lots > MAX_LOT,
    plannedRisk: Number((cappedLots * distancePips * perLot).toFixed(2)),
  };
}
