import { calculateRiskAmount } from "../../utils/calculator/riskCalculator.js";

// ============================================================
// BROKER-MEASURED POSITION SIZING
//
// Every number that reaches the trade comes from the broker itself: the volume
// grid from the symbol metadata the caller already fetched, and the monetary
// loss from GET /api/mt5/calc-profit, which is the only place money is measured
// here. No contract size, tick value or pip value is used to price risk, so an
// instrument this app has never heard of can still be sized correctly — and a
// broker that refuses to measure risk stops the trader with a reason instead of
// an estimate.
// ============================================================

export const BROKER_SIZING_CODES = {
  OK: "OK",

  INVALID_INPUT: "INVALID_INPUT",
  INVALID_BALANCE: "INVALID_BALANCE",
  INVALID_RISK_PERCENT: "INVALID_RISK_PERCENT",
  MISSING_ACCOUNT_CURRENCY: "MISSING_ACCOUNT_CURRENCY",

  UNUSABLE_SYMBOL_METADATA: "UNUSABLE_SYMBOL_METADATA",
  UNUSABLE_VOLUME_GRID: "UNUSABLE_VOLUME_GRID",
  METADATA_SYMBOL_MISMATCH: "METADATA_SYMBOL_MISMATCH",

  PRICE_UNUSABLE: "PRICE_UNUSABLE",
  STOP_ON_WRONG_SIDE: "STOP_ON_WRONG_SIDE",

  REQUEST_BUDGET_EXCEEDED: "REQUEST_BUDGET_EXCEEDED",
  NETWORK_ERROR: "NETWORK_ERROR",
  REQUEST_CANCELLED: "REQUEST_CANCELLED",
  REQUEST_TIMED_OUT: "REQUEST_TIMED_OUT",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  BROKER_MEASUREMENT_FAILED: "BROKER_MEASUREMENT_FAILED",
  PROFIT_DIRECTION_MISMATCH: "PROFIT_DIRECTION_MISMATCH",
  RESPONSE_MISMATCH: "RESPONSE_MISMATCH",
  ACCOUNT_CURRENCY_MISMATCH: "ACCOUNT_CURRENCY_MISMATCH",
  VOLUME_GRID_CHANGED: "VOLUME_GRID_CHANGED",

  BELOW_BROKER_MINIMUM: "BELOW_BROKER_MINIMUM",
  ABOVE_BROKER_MAXIMUM: "ABOVE_BROKER_MAXIMUM",
  OFF_GRID_VOLUME: "OFF_GRID_VOLUME",

  NO_VOLUME_WITHIN_BUDGET: "NO_VOLUME_WITHIN_BUDGET",
};

export const CALC_PROFIT_CALCULATION = "mt5.order_calc_profit";

const DEFAULT_MAX_REQUESTS = 32;

// The Express proxy gives up on the bridge after 10 s for this endpoint
// (server/routes/mt5.js), so the client waits past the server's own bound and a
// slow-but-answerable measurement still gets its real refusal rather than a
// local abort.
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_TIMEOUT_MS = 120_000;

const MAX_PRICE_DIGITS = 8;
const MAX_VOLUME_DECIMALS = 8;

// The grid only exists if all three broker volume values land on whole steps of
// one scale. This tolerance absorbs float noise (0.07 * 100 is
// 7.000000000000001) while staying far below a real precision difference, which
// would be at least a tenth of a scaled unit.
const GRID_REPRESENTATION_TOLERANCE = 1e-9;

// Compares a broker echo against the volume this module asked to be measured.
// The bridge echoes the volume it normalised, so equality is checked in the
// grid's own decimal space rather than on raw float bits.
const VOLUME_ECHO_TOLERANCE = 1e-9;

const BLOCKED_MESSAGES = {
  [BROKER_SIZING_CODES.INVALID_BALANCE]:
    "No usable account balance is loaded, so risk per trade cannot be turned into a position size.",
  [BROKER_SIZING_CODES.INVALID_RISK_PERCENT]:
    "Risk per trade is not a positive number, so there is no risk budget to size against.",
  [BROKER_SIZING_CODES.MISSING_ACCOUNT_CURRENCY]:
    "The account currency is unknown, so a broker risk measurement cannot be confirmed to be in the currency this account holds.",
  [BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA]:
    "The broker's symbol metadata is missing or unusable, so this order cannot be sized.",
  [BROKER_SIZING_CODES.METADATA_SYMBOL_MISMATCH]:
    "The broker returned metadata for a different symbol than the one being traded.",
  [BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID]:
    "The broker did not report a usable volume grid for this symbol.",
  [BROKER_SIZING_CODES.PRICE_UNUSABLE]:
    "Entry and stop-loss must be two different positive prices, rounded to the broker's own digits.",
  [BROKER_SIZING_CODES.STOP_ON_WRONG_SIDE]:
    "The stop-loss is on the wrong side of entry for this order side, so there is no loss to measure.",
};

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function text(value) {
  return String(value ?? "").trim();
}

function currencyText(value) {
  return text(value).toUpperCase();
}

function defaultApiBaseUrl() {
  return import.meta.env?.VITE_API_URL || "http://localhost:4000";
}

// ============================================================
// PRICE NORMALISATION
//
// Mirrors the bridge's own rule (finite, positive, rounded to the symbol's
// digits) so the prices this module measures risk at are the prices the broker
// will accept. The broker's digits are the only source of precision.
// ============================================================

export function normalizePriceToDigits(value, digits) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return { ok: false, code: BROKER_SIZING_CODES.PRICE_UNUSABLE, price: null };
  }

  const scaled = Number(number.toFixed(digits));

  if (!Number.isFinite(scaled) || scaled <= 0) {
    return { ok: false, code: BROKER_SIZING_CODES.PRICE_UNUSABLE, price: null };
  }

  return { ok: true, price: scaled, asString: scaled.toFixed(digits) };
}

// ============================================================
// VOLUME GRID
//
// Built in integer step space from the broker's own volume_min / volume_max /
// volume_step. The grid is anchored at volume_min, exactly like the bridge, and
// candidates are always min + k * step, so a volume this module measures is
// always a volume the broker would accept for an order.
// ============================================================

function decimalPlaces(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  const text = String(value);

  if (/e-/i.test(text)) {
    const exponent = Number(text.split(/e-/i)[1]);
    const decimals = Number(text.split(".")[1]?.split(/e-/i)[0]?.length ?? 0);
    return Number.isFinite(exponent) ? decimals + exponent : null;
  }

  const fraction = text.split(".")[1];
  return fraction ? fraction.length : 0;
}

export function buildVolumeGrid({ volume_min, volume_max, volume_step }) {
  const fail = (message) => ({
    ok: false,
    code: BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID,
    message,
  });

  const min = positiveInteger(volume_min);
  const max = positiveInteger(volume_max);
  const step = positiveInteger(volume_step);

  if (min === null || max === null || step === null) {
    return fail(
      "The broker did not report a usable volume grid for this symbol."
    );
  }

  // Scaled by the finest precision of all three values, not by volume_step
  // alone: anchoring on the step's precision would push volume_min onto the
  // step grid (0.01 on a 0.1 scale rounds to 0), which moves every candidate
  // off the broker's own grid.
  const decimals = [min, max, step].reduce((finest, value) => {
    const places = decimalPlaces(value);
    return places === null ? null : Math.max(finest, places);
  }, 0);

  if (decimals === null || decimals > MAX_VOLUME_DECIMALS) {
    return fail(
      "The broker's volume grid is finer than the 8 decimal places this app can place on a grid."
    );
  }

  const scale = 10 ** decimals;

  const scaled = [min, max, step].map((value) => {
    const raw = value * scale;
    const whole = Math.round(raw);

    if (
      !Number.isSafeInteger(whole) ||
      Math.abs(raw - whole) >
        GRID_REPRESENTATION_TOLERANCE * Math.max(1, Math.abs(whole))
    ) {
      return null;
    }

    return whole;
  });

  if (scaled.some((value) => value === null)) {
    return fail(
      "The broker's volume grid cannot be represented exactly as whole steps, so no volume was placed on it."
    );
  }

  const [minScaled, maxScaled, stepScaled] = scaled;

  if (minScaled < 1 || stepScaled <= 0 || maxScaled < minScaled) {
    return fail(
      "The broker's volume grid is inconsistent (maximum below minimum, or a step that cannot be counted)."
    );
  }

  return {
    ok: true,
    decimals,
    scale,
    minScaled,
    maxScaled,
    stepScaled,
    volumeMin: min,
    volumeMax: max,
    volumeStep: step,
    maxIndex: Math.floor((maxScaled - minScaled) / stepScaled),
  };
}

export function volumeAtGridStep(grid, index) {
  if (!grid?.ok) return null;
  if (!Number.isInteger(index) || index < 0 || index > grid.maxIndex) return null;

  const scaled = grid.minScaled + index * grid.stepScaled;
  return Number((scaled / grid.scale).toFixed(grid.decimals));
}

// Volumes are compared in the grid's own integer step space. A float product
// like 2.28 * 100 is 228.00000000000003, so the scaled value is snapped to the
// nearest whole step with a tolerance borrowed from the bridge's own snap
// (a millionth of one step) rather than being truncated.
function scaledVolumeIndex(grid, volume) {
  const number = Number(volume);

  if (!Number.isFinite(number) || number <= 0) return null;

  const raw = number * grid.scale;
  const scaled = Math.round(raw);

  if (Math.abs(raw - scaled) > grid.stepScaled * 1e-6) return null;
  if (scaled < grid.minScaled || scaled > grid.maxScaled) return null;

  const offset = scaled - grid.minScaled;
  const index = offset / grid.stepScaled;

  if (!Number.isInteger(index) || index < 0) return null;

  return { index, scaled };
}

export function gridIndexOf(grid, volume) {
  if (!grid?.ok) return null;

  return scaledVolumeIndex(grid, volume)?.index ?? null;
}

function flooredGridVolume(grid, volume) {
  const number = Number(volume);

  if (!Number.isFinite(number) || number <= 0) return null;

  const scaled = Math.floor(number * grid.scale + grid.stepScaled * 1e-6);

  if (scaled < grid.minScaled) return null;

  const index = Math.floor((scaled - grid.minScaled) / grid.stepScaled);

  return volumeAtGridStep(grid, index);
}

// Manual volumes must be judged against the broker grid before they reach an
// order, using the broker's own refusal names.
export function validateBrokerVolume(volume, grid) {
  const number = Number(volume);

  if (!Number.isFinite(number) || number <= 0) {
    return {
      ok: false,
      code: BROKER_SIZING_CODES.INVALID_INPUT,
      volume: null,
      message: "The requested volume is missing, not a number, or not greater than zero.",
      volume_min: grid?.volumeMin ?? null,
      volume_max: grid?.volumeMax ?? null,
      volume_step: grid?.volumeStep ?? null,
    };
  }

  if (!grid?.ok) {
    return {
      ok: false,
      code: BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID,
      volume: number,
      message:
        "The broker did not report a usable volume grid for this symbol, so this volume cannot be validated.",
    };
  }

  if (number < grid.volumeMin - VOLUME_ECHO_TOLERANCE) {
    return {
      ok: false,
      code: BROKER_SIZING_CODES.BELOW_BROKER_MINIMUM,
      volume: number,
      message:
        `The requested volume ${number} is below the broker minimum ${grid.volumeMin}. ` +
        "It was not raised to the minimum, because that would increase the risk of the order.",
      volume_min: grid.volumeMin,
      volume_max: grid.volumeMax,
      volume_step: grid.volumeStep,
    };
  }

  if (number > grid.volumeMax + VOLUME_ECHO_TOLERANCE) {
    return {
      ok: false,
      code: BROKER_SIZING_CODES.ABOVE_BROKER_MAXIMUM,
      volume: number,
      message: `The requested volume ${number} is above the broker maximum ${grid.volumeMax}.`,
      volume_min: grid.volumeMin,
      volume_max: grid.volumeMax,
      volume_step: grid.volumeStep,
    };
  }

  if (gridIndexOf(grid, number) === null) {
    return {
      ok: false,
      code: BROKER_SIZING_CODES.OFF_GRID_VOLUME,
      volume: number,
      message:
        `The requested volume ${number} is not on the broker volume grid ` +
        `(volume_min ${grid.volumeMin}, volume_step ${grid.volumeStep}).`,
      nearest_valid_volume: flooredGridVolume(grid, number),
    };
  }

  return {
    ok: true,
    code: BROKER_SIZING_CODES.OK,
    volume: number,
    message: "",
    volume_min: grid.volumeMin,
    volume_max: grid.volumeMax,
    volume_step: grid.volumeStep,
  };
}

// ============================================================
// SYMBOL METADATA
// ============================================================

function readSymbolMetadata({ symbolInfo, symbol }) {
  const fail = (code, message) => ({ ok: false, code, message });

  if (!symbolInfo || typeof symbolInfo !== "object") {
    return fail(
      BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA,
      BLOCKED_MESSAGES[BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA]
    );
  }

  if (symbolInfo.success !== true) {
    return fail(
      BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA,
      "The broker's symbol metadata request did not report success."
    );
  }

  if (
    text(symbolInfo.symbol).toUpperCase() !==
    currencyText(symbol)
  ) {
    return fail(
      BROKER_SIZING_CODES.METADATA_SYMBOL_MISMATCH,
      `The broker returned metadata for ${text(symbolInfo.symbol) || "(blank)"}, not for ${currencyText(symbol)}.`
    );
  }

  const digits = Number(symbolInfo.digits);

  if (
    !Number.isInteger(digits) ||
    digits < 0 ||
    digits > MAX_PRICE_DIGITS
  ) {
    return fail(
      BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA,
      "The broker did not report a usable price precision (digits) for this symbol."
    );
  }

  const spec =
    symbolInfo.spec && typeof symbolInfo.spec === "object"
      ? symbolInfo.spec
      : null;

  if (!spec) {
    return fail(
      BROKER_SIZING_CODES.UNUSABLE_SYMBOL_METADATA,
      "The broker's symbol metadata carries no specification object, so the volume grid cannot be read."
    );
  }

  if (symbolInfo.volume_grid_usable === false) {
    return fail(
      BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID,
      "The broker reported that this symbol's volume grid is not usable."
    );
  }

  const specStatus = symbolInfo.spec_status;

  if (specStatus && typeof specStatus === "object") {
    const unusable = ["volume_min", "volume_max", "volume_step"].filter(
      (field) => specStatus[field] && specStatus[field] !== "ok"
    );

    if (unusable.length > 0) {
      return fail(
        BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID,
        `The broker reported ${unusable.join(", ")} as unusable for this symbol, so no volume can be placed on its grid.`
      );
    }
  }

  const grid = buildVolumeGrid(spec);

  if (!grid.ok) {
    return { ...grid, code: BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID };
  }

  return { ok: true, digits, grid };
}

// ============================================================
// LOSS MEASUREMENT
// ============================================================

export function buildCalcProfitUrl({
  apiBaseUrl,
  symbol,
  action,
  volume,
  entryAsString,
  stopAsString,
}) {
  const params = new URLSearchParams({
    action,
    symbol: currencyText(symbol),
    volume: String(volume),
    price_open: entryAsString,
    price_close: stopAsString,
  });

  return `${String(apiBaseUrl).replace(/\/+$/, "")}/api/mt5/calc-profit?${params.toString()}`;
}

function classifyMeasurementFailure({ status, body }) {
  return {
    code: BROKER_SIZING_CODES.BROKER_MEASUREMENT_FAILED,
    brokerError: text(body?.error).toUpperCase() || null,
    httpStatus: Number.isFinite(status) ? status : null,
  };
}

// ============================================================
// ONE REQUEST, ONE DEADLINE
//
// A stalled proxy must not leave a sizing run pending forever, so every
// measurement gets its own deadline. The caller's signal is folded into that
// deadline instead of replacing it, which keeps an outside cancellation
// distinguishable from the deadline firing. The timer and the abort listener
// are released on every path, including the paths that return a result.
// ============================================================

async function sendMeasurementRequest({
  url,
  signal,
  requestTimeoutMs,
  fetchImpl,
}) {
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;

  let timedOut = false;
  let callerAborted = false;
  let timer = null;

  const onCallerAbort = () => {
    callerAborted = true;
    controller?.abort();
  };

  const listening =
    Boolean(controller) &&
    signal &&
    typeof signal.addEventListener === "function";

  if (listening) signal.addEventListener("abort", onCallerAbort);

  // Without AbortController there is nothing to fold the deadline into, and
  // inventing a second cancellation mechanism would report an abort that never
  // happened. The caller's own signal is passed through unchanged instead.
  const requestSignal = controller
    ? controller.signal
    : signal === null || signal === undefined
      ? undefined
      : signal;

  const interruption = (error) => {
    const isTimeout =
      timedOut || text(error?.name) === "TimeoutError";

    return {
      ok: false,
      code: isTimeout
        ? BROKER_SIZING_CODES.REQUEST_TIMED_OUT
        : BROKER_SIZING_CODES.REQUEST_CANCELLED,
      message: isTimeout
        ? `The broker risk measurement did not answer within ${requestTimeoutMs} ms, so no volume was confirmed.`
        : "The broker risk measurement was cancelled.",
    };
  };

  const interrupted = (error) =>
    callerAborted ||
    timedOut ||
    text(error?.name) === "AbortError" ||
    text(error?.name) === "TimeoutError" ||
    Boolean(controller?.signal?.aborted) ||
    Boolean(signal?.aborted);

  // The wait is bounded by this promise, not only by the abort signal: a
  // transport that ignores the signal and never settles would otherwise leave
  // the sizing run pending forever instead of returning a refusal.
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller?.abort();

      const error = new Error(
        `The broker risk measurement passed its ${requestTimeoutMs} ms deadline`
      );
      error.name = "TimeoutError";

      reject(error);
    }, requestTimeoutMs);
  });

  const exchange = async () => {
    const response = await fetchImpl(
      url,
      requestSignal
        ? { signal: requestSignal, cache: "no-store" }
        : { cache: "no-store" }
    );

    let body;

    try {
      body = await response.json();
    } catch (error) {
      // An abort that lands while the body is still arriving is the same
      // interruption as one that lands on the request itself.
      if (interrupted(error)) {
        return { aborted: interruption(error) };
      }

      body = null;
    }

    // A measurement the caller has already walked away from is not returned,
    // even when the broker answered it in time.
    if (interrupted()) {
      return { aborted: interruption() };
    }

    return { response, body };
  };

  try {
    return await Promise.race([exchange(), deadline]);
  } catch (error) {
    if (interrupted(error)) {
      return { aborted: interruption(error) };
    }

    return {
      failure: {
        code: BROKER_SIZING_CODES.NETWORK_ERROR,
        message:
          `The broker risk measurement could not be reached (${text(error?.message) || "network failure"}).`,
      },
    };
  } finally {
    if (timer !== null) clearTimeout(timer);

    if (listening && typeof signal.removeEventListener === "function") {
      signal.removeEventListener("abort", onCallerAbort);
    }
  }
}

// ============================================================
// SIZING
// ============================================================

export async function sizeWithBroker(input = {}) {
  const {
    balance,
    riskPercent,
    accountCurrency,
    symbol,
    side,
    orderType,
    entry,
    stopLoss,
    symbolInfo,
    fetchImpl = globalThis.fetch,
    apiBaseUrl = defaultApiBaseUrl(),
    maxRequests = DEFAULT_MAX_REQUESTS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    signal = null,
  } = input;

  const normalizedSymbol = currencyText(symbol);
  const normalizedSide = text(side).toLowerCase();
  const normalizedOrderType = text(orderType).toLowerCase();
  const normalizedCurrency = currencyText(accountCurrency);

  let requestsUsed = 0;
  const probedVolumes = [];

  // A risk budget only exists once both account figures are usable. Reporting a
  // budget derived from a negative or unreadable balance would show the trader a
  // number the account never had, so the refusal says it is unavailable instead.
  const displayableRiskBudget = () => {
    const rawBalance = Number(balance);
    const rawRiskPercent = Number(riskPercent);

    if (
      !Number.isFinite(rawBalance) ||
      rawBalance <= 0 ||
      !Number.isFinite(rawRiskPercent) ||
      rawRiskPercent <= 0
    ) {
      return null;
    }

    const budget = calculateRiskAmount(rawBalance, rawRiskPercent);

    return Number.isFinite(budget) && budget > 0
      ? Number(budget.toFixed(2))
      : null;
  };

  const blocked = (code, message, extra = {}) => ({
    ok: false,
    code,
    lots: 0,
    lotSizeSource: "blocked",
    symbol: normalizedSymbol,
    side: normalizedSide,
    orderType: normalizedOrderType,
    accountCurrency: normalizedCurrency || null,
    riskBudget: displayableRiskBudget(),
    measuredLossAbs: null,
    requestsUsed,
    probedVolumes: [...probedVolumes],
    message,
    ...extra,
  });

  // ------------------------------------------------------------
  // INPUTS
  // ------------------------------------------------------------

  if (!["buy", "sell"].includes(normalizedSide)) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_INPUT,
      "The order side must be buy or sell before risk can be measured."
    );
  }

  if (!["market", "limit", "stop"].includes(normalizedOrderType)) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_INPUT,
      "The order type must be Market, Limit or Stop before risk can be measured."
    );
  }

  const requestBudget = Number(maxRequests);

  if (
    !Number.isInteger(requestBudget) ||
    requestBudget < 2 ||
    requestBudget > 64
  ) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_INPUT,
      "The measurement request budget must be a whole number between 2 and 64."
    );
  }

  const requestDeadline = Number(requestTimeoutMs);

  if (
    !Number.isInteger(requestDeadline) ||
    requestDeadline < 1 ||
    requestDeadline > MAX_REQUEST_TIMEOUT_MS
  ) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_INPUT,
      `The per-request broker timeout must be a whole number of milliseconds between 1 and ${MAX_REQUEST_TIMEOUT_MS}.`
    );
  }

  const rawBalance = Number(balance);

  if (!Number.isFinite(rawBalance) || rawBalance <= 0) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_BALANCE,
      BLOCKED_MESSAGES[BROKER_SIZING_CODES.INVALID_BALANCE]
    );
  }

  const rawRiskPercent = Number(riskPercent);

  if (!Number.isFinite(rawRiskPercent) || rawRiskPercent <= 0) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_RISK_PERCENT,
      BLOCKED_MESSAGES[BROKER_SIZING_CODES.INVALID_RISK_PERCENT]
    );
  }

  if (!normalizedCurrency) {
    return blocked(
      BROKER_SIZING_CODES.MISSING_ACCOUNT_CURRENCY,
      BLOCKED_MESSAGES[BROKER_SIZING_CODES.MISSING_ACCOUNT_CURRENCY]
    );
  }

  if (typeof fetchImpl !== "function") {
    return blocked(
      BROKER_SIZING_CODES.INVALID_INPUT,
      "No request function is available, so the broker cannot be asked to measure this risk."
    );
  }

  const riskBudget = calculateRiskAmount(rawBalance, rawRiskPercent);

  if (!(riskBudget > 0)) {
    return blocked(
      BROKER_SIZING_CODES.INVALID_RISK_PERCENT,
      BLOCKED_MESSAGES[BROKER_SIZING_CODES.INVALID_RISK_PERCENT]
    );
  }

  // ------------------------------------------------------------
  // BROKER METADATA
  // ------------------------------------------------------------

  const metadata = readSymbolMetadata({
    symbolInfo,
    symbol: normalizedSymbol,
  });

  if (!metadata.ok) {
    return blocked(metadata.code, metadata.message, {
      volume_min: metadata.grid?.volumeMin ?? null,
      volume_max: metadata.grid?.volumeMax ?? null,
      volume_step: metadata.grid?.volumeStep ?? null,
    });
  }

  const { digits, grid } = metadata;

  // ------------------------------------------------------------
  // PRICES
  //
  // Market orders are measured at the entry the caller already took from the
  // live ask/bid; Limit and Stop orders are measured at the price the trader
  // typed. This module never reads a market quote.
  // ------------------------------------------------------------

  const normalizedEntry = normalizePriceToDigits(entry, digits);
  const normalizedStop = normalizePriceToDigits(stopLoss, digits);

  if (!normalizedEntry.ok || !normalizedStop.ok) {
    return blocked(
      BROKER_SIZING_CODES.PRICE_UNUSABLE,
      BLOCKED_MESSAGES[BROKER_SIZING_CODES.PRICE_UNUSABLE],
      { digits, entry: entry ?? null, stopLoss: stopLoss ?? null }
    );
  }

  if (normalizedEntry.price === normalizedStop.price) {
    return blocked(
      BROKER_SIZING_CODES.PRICE_UNUSABLE,
      "Entry and stop-loss are the same price after rounding to the broker's digits, so this order has no loss to measure.",
      { digits, entry: normalizedEntry.price, stopLoss: normalizedStop.price }
    );
  }

  const stopBelowEntry =
    normalizedStop.price < normalizedEntry.price;

  if (
    (normalizedSide === "buy" && !stopBelowEntry) ||
    (normalizedSide === "sell" && stopBelowEntry)
  ) {
    return blocked(
      BROKER_SIZING_CODES.STOP_ON_WRONG_SIDE,
      normalizedSide === "buy"
        ? "This is a buy, so the stop-loss must sit below entry for there to be a loss to measure."
        : "This is a sell, so the stop-loss must sit above entry for there to be a loss to measure.",
      { digits, entry: normalizedEntry.price, stopLoss: normalizedStop.price }
    );
  }

  // ------------------------------------------------------------
  // ONE MEASUREMENT
  // ------------------------------------------------------------

  const action = normalizedSide === "buy" ? "BUY" : "SELL";

  const askForMeasurement = async (index) => {
    const volume = volumeAtGridStep(grid, index);

    // A request is only ever made for a positive, whole broker volume. Nothing
    // is sent when the grid cannot name one, so no zero volume can reach the
    // broker calculator.
    if (!(Number(volume) > 0)) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.UNUSABLE_VOLUME_GRID,
        message:
          `Tried to measure risk at grid position ${index}, which does not name a positive broker volume for ${normalizedSymbol}.`,
      };
    }

    if (signal?.aborted) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.REQUEST_CANCELLED,
        message:
          "The order was cancelled before the broker was asked to measure this risk.",
      };
    }

    if (requestsUsed >= requestBudget) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.REQUEST_BUDGET_EXCEEDED,
        message:
          `Risk measurement stopped after ${requestsUsed} broker requests without confirming a volume, ` +
          "so no size was proposed.",
      };
    }

    requestsUsed += 1;
    probedVolumes.push(volume);

    const url = buildCalcProfitUrl({
      apiBaseUrl,
      symbol: normalizedSymbol,
      action,
      volume,
      entryAsString: normalizedEntry.asString,
      stopAsString: normalizedStop.asString,
    });

    const outcome = await sendMeasurementRequest({
      url,
      signal,
      requestTimeoutMs: requestDeadline,
      fetchImpl,
    });

    if (outcome.aborted) {
      return outcome.aborted;
    }

    if (outcome.failure) {
      return { ok: false, ...outcome.failure };
    }

    const { response, body } = outcome;

    const status = Number(response?.status);

    if (!Number.isFinite(status) || status < 200 || status >= 300) {
      const failure = classifyMeasurementFailure({ status, body });

      return {
        ok: false,
        code: failure.code,
        brokerError: failure.brokerError,
        httpStatus: failure.httpStatus,
        message:
          text(body?.message) ||
          `The broker refused to measure the risk of ${volume} lots of ${normalizedSymbol} (HTTP ${status}).`,
        volume,
      };
    }

    if (!body || typeof body !== "object") {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.INVALID_RESPONSE,
        message:
          `The broker risk measurement for ${volume} lots of ${normalizedSymbol} was not a readable JSON object.`,
        volume,
      };
    }

    if (body.success !== true) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.BROKER_MEASUREMENT_FAILED,
        brokerError: text(body?.error).toUpperCase() || null,
        httpStatus: status,
        message:
          text(body?.message) ||
          `The broker did not report a successful risk measurement for ${volume} lots of ${normalizedSymbol}.`,
        volume,
      };
    }

    // Everything below is a field the endpoint really returns.
    const mismatch = (message) => ({
      ok: false,
      code: BROKER_SIZING_CODES.RESPONSE_MISMATCH,
      message,
      volume,
    });

    if (currencyText(body.symbol) !== normalizedSymbol) {
      return mismatch(
        `The broker measured ${text(body.symbol) || "(blank)"} instead of ${normalizedSymbol}.`
      );
    }

    if (text(body.action_name).toUpperCase() !== action) {
      return mismatch(
        `The broker measured this risk as a ${text(body.action_name) || "(blank)"} order, not as ${action}.`
      );
    }

    if (Math.abs(Number(body.volume) - volume) > VOLUME_ECHO_TOLERANCE) {
      return mismatch(
        `The broker measured ${String(body.volume)} lots instead of the ${volume} lots that were asked for.`
      );
    }

    if (
      Math.abs(Number(body.price_open) - normalizedEntry.price) >
      10 ** -digits / 2
    ) {
      return mismatch(
        `The broker measured entry price ${String(body.price_open)} instead of ${normalizedEntry.price}.`
      );
    }

    if (
      Math.abs(Number(body.price_close) - normalizedStop.price) >
      10 ** -digits / 2
    ) {
      return mismatch(
        `The broker measured stop price ${String(body.price_close)} instead of ${normalizedStop.price}.`
      );
    }

    if (currencyText(body.account_currency) !== normalizedCurrency) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.ACCOUNT_CURRENCY_MISMATCH,
        message:
          `The broker measured the risk in ${currencyText(body.account_currency) || "(blank)"} ` +
          `but this account is recorded as ${normalizedCurrency}, so the figure is not this account's loss.`,
        accountCurrency: normalizedCurrency,
        measuredCurrency: currencyText(body.account_currency) || null,
        currencySource: text(body.currency_source) || null,
        volume,
      };
    }

    const calculation = text(body.calculation);

    if (calculation !== CALC_PROFIT_CALCULATION) {
      return mismatch(
        `The risk figure came from "${calculation || "(blank)"}" instead of the broker's own profit calculator.`
      );
    }

    const profit = Number(body.profit);
    const lossAbs = Number(body.loss_abs);

    if (
      !Number.isFinite(profit) ||
      !Number.isFinite(lossAbs) ||
      lossAbs < 0 ||
      Math.abs(lossAbs - Math.abs(profit)) > 0.01
    ) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.INVALID_RESPONSE,
        message:
          `The broker returned an unusable risk figure (profit ${String(body.profit)}, loss ${String(body.loss_abs)}).`,
        volume,
      };
    }

    // The prices were put in as entry -> stop on the losing side of this order,
    // so the calculator's own figure must come back as a loss. A gain (or a
    // result of exactly zero, which the bridge itself refuses as
    // ZERO_RISK_RESPONSE) means the answer does not describe this order's risk,
    // and abs() of it must never be spent as if it were a loss.
    if (!(profit < 0)) {
      return {
        ok: false,
        code: BROKER_SIZING_CODES.PROFIT_DIRECTION_MISMATCH,
        message:
          `The broker returned ${profit} ${normalizedCurrency} for ${volume} lots of ${normalizedSymbol} ` +
          `from ${normalizedEntry.asString} to its ${action} stop at ${normalizedStop.asString}, ` +
          "which is not a loss on that stop, so no size was proposed.",
        volume,
        measuredProfit: profit,
      };
    }

    // The grid can move between requests (a different terminal, a reconnect). If
    // it does, the candidate indexes no longer describe the broker's grid.
    const echoedGrid = {
      volume_min: body.volume_min,
      volume_max: body.volume_max,
      volume_step: body.volume_step,
    };

    if (
      [echoedGrid.volume_min, echoedGrid.volume_max, echoedGrid.volume_step].some(
        (value) => value !== null && value !== undefined
      )
    ) {
      if (
        Math.abs(Number(echoedGrid.volume_min) - grid.volumeMin) >
          VOLUME_ECHO_TOLERANCE ||
        Math.abs(Number(echoedGrid.volume_max) - grid.volumeMax) >
          VOLUME_ECHO_TOLERANCE ||
        Math.abs(Number(echoedGrid.volume_step) - grid.volumeStep) >
          VOLUME_ECHO_TOLERANCE
      ) {
        return {
          ok: false,
          code: BROKER_SIZING_CODES.VOLUME_GRID_CHANGED,
          message:
            `The broker's volume grid changed while this order was being sized ` +
            `(volume_min ${String(echoedGrid.volume_min)}, volume_max ${String(echoedGrid.volume_max)}, volume_step ${String(echoedGrid.volume_step)}).`,
          volume_min: Number(echoedGrid.volume_min),
          volume_max: Number(echoedGrid.volume_max),
          volume_step: Number(echoedGrid.volume_step),
          volume,
        };
      }
    }

    return {
      ok: true,
      volume,
      index,
      profit,
      lossAbs,
      accountCurrency: currencyText(body.account_currency),
      currencySource: text(body.currency_source) || null,
      calculation,
      recordedAt: body.recorded_at ?? null,
    };
  };

  // ------------------------------------------------------------
  // SEARCH
  //
  // The largest grid volume is found by dividing the grid and asking the broker
  // for the measurement at each divide. The order of the probes assumes only
  // that a bigger volume cannot lose less money; it never decides the answer —
  // every volume reported below carries its own fresh broker measurement.
  // ------------------------------------------------------------

  const measurements = new Map();

  const probe = async (index, { fresh = false } = {}) => {
    if (!fresh && measurements.has(index)) {
      return measurements.get(index);
    }

    const measurement = await askForMeasurement(index);
    measurements.set(index, measurement);
    return measurement;
  };

  let low = -1;
  let high = grid.maxIndex + 1;

  const measurementExtras = (measurement) => {
    const {
      ok,
      code,
      message,
      index,
      ...rest
    } = measurement;

    void ok;
    void code;
    void message;
    void index;

    return rest;
  };

  const failure = (measurement) =>
    blocked(measurement.code, measurement.message, {
      ...measurementExtras(measurement),
      brokerError: measurement.brokerError ?? null,
      httpStatus: measurement.httpStatus ?? null,
      digits,
      volume_min: grid.volumeMin,
      volume_max: grid.volumeMax,
      volume_step: grid.volumeStep,
      volume: measurement.volume ?? null,
      riskBudget: Number(riskBudget.toFixed(2)),
    });

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);

    const measurement = await probe(middle);

    if (!measurement.ok) {
      return failure(measurement);
    }

    if (measurement.lossAbs <= riskBudget) {
      low = middle;
    } else {
      high = middle;
    }
  }

  if (low < 0) {
    const smallest = measurements.get(0);

    return blocked(
      BROKER_SIZING_CODES.NO_VOLUME_WITHIN_BUDGET,
      smallest?.ok
        ?
          `The broker's smallest volume for ${normalizedSymbol} is ${grid.volumeMin} lots, and that already loses ${smallest.lossAbs.toFixed(2)} ${normalizedCurrency} on this stop - more than the ${riskBudget.toFixed(2)} ${normalizedCurrency} risk budget. The volume was not raised to the minimum, because that would spend more risk than was asked for.`
        :
          `The broker's smallest volume for ${normalizedSymbol} already exceeds the ${riskBudget.toFixed(2)} ${normalizedCurrency} risk budget.`,
      {
        digits,
        volume_min: grid.volumeMin,
        volume_max: grid.volumeMax,
        volume_step: grid.volumeStep,
        riskBudget: Number(riskBudget.toFixed(2)),
        lossAtBrokerMinimum: smallest?.ok ? smallest.lossAbs : null,
      }
    );
  }

  // ------------------------------------------------------------
  // VERIFY, THEN STEP DOWN IN EXACT GRID STEPS
  //
  // The volume that is reported must have been measured as affordable on this
  // sizing run. If the broker's answer at that volume does not fit the budget,
  // the only move allowed is one whole grid step down, re-measured.
  // ------------------------------------------------------------

  let candidate = low;

  while (candidate >= 0) {
    const measurement = await probe(candidate, { fresh: true });

    if (!measurement.ok) {
      return failure(measurement);
    }

    if (measurement.lossAbs <= riskBudget) {
      const onGrid = validateBrokerVolume(measurement.volume, grid);

      if (!onGrid.ok) {
        return failure(onGrid);
      }

      return {
        ok: true,
        code: BROKER_SIZING_CODES.OK,
        lots: measurement.volume,
        lotSizeSource: "broker-measured",
        symbol: normalizedSymbol,
        side: normalizedSide,
        orderType: normalizedOrderType,
        action,
        digits,
        entry: normalizedEntry.price,
        entryAsString: normalizedEntry.asString,
        stopLoss: normalizedStop.price,
        stopLossAsString: normalizedStop.asString,
        riskBudget,
        accountCurrency: measurement.accountCurrency,
        currencySource: measurement.currencySource,
        calculation: measurement.calculation,
        measuredProfit: measurement.profit,
        measuredLossAbs: measurement.lossAbs,
        withinRiskBudget: measurement.lossAbs <= riskBudget,
        volume_min: grid.volumeMin,
        volume_max: grid.volumeMax,
        volume_step: grid.volumeStep,
        gridIndex: candidate,
        atBrokerMinimum: candidate === 0,
        atBrokerMaximum: candidate === grid.maxIndex,
        recordedAt: measurement.recordedAt,
        requestsUsed,
        probedVolumes: [...probedVolumes],
        message: "",
      };
    }

    candidate -= 1;
  }

  return blocked(
    BROKER_SIZING_CODES.NO_VOLUME_WITHIN_BUDGET,
    `No volume on the broker's grid for ${normalizedSymbol} was confirmed to lose no more than ${riskBudget.toFixed(2)} ${normalizedCurrency}.`,
    {
      digits,
      volume_min: grid.volumeMin,
      volume_max: grid.volumeMax,
      volume_step: grid.volumeStep,
      riskBudget: Number(riskBudget.toFixed(2)),
    }
  );
}