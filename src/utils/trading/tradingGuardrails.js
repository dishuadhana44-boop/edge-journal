import { isSameDay } from "date-fns";

import { getRealizedTimestamp } from "../dashboardCurveEngine.js";

// ============================================================
// ONE GUARDRAIL CONFIGURATION
//
// The limits used to be duplicated across four components with different
// numbers, and the code that actually blocked orders read localStorage raw — so
// a saved object missing `maxDailyLoss` produced a limit of 0, i.e. no daily
// loss protection while the panels kept showing one. Every reader now goes
// through this module: defaults are always merged, invalid values are replaced
// by their default and reported, and nothing can silently disable a limit.
// ============================================================

export const GUARDRAIL_STORAGE_KEY = "tradingGuardrails";

export const DEFAULT_GUARDRAILS = {
  enabled: true,

  // Percentage of balance risked per trade
  riskPerTrade: 1,

  maxTradesPerDay: 10,
  maxDailyLoss: 3000,
  maxDailyProfit: 10000,

  // Stored for the settings page; not yet enforced (audit finding F3).
  maxRiskPerTrade: 1000,
  maxConsecutiveLosses: 3,
  maxPositionSize: 5,

  tradingWindowStart: "11:30",
  tradingWindowEnd: "19:30",
};

const NUMBER_LIMIT_KEYS = [
  "riskPerTrade",
  "maxTradesPerDay",
  "maxDailyLoss",
  "maxDailyProfit",
  "maxRiskPerTrade",
  "maxConsecutiveLosses",
  "maxPositionSize",
];

const CLOCK_PATTERN = /^\s*(\d{1,2}):(\d{2})\s*$/;

const UNREADABLE_MESSAGE =
  "Saved guardrail settings could not be read; the default limits are active.";

function withIssue(result, message) {
  return {
    ...result,
    issues: [...result.issues, message],
  };
}

function normalizeNumberLimit(key, rawValue, issues) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_GUARDRAILS[key];
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value) || value < 0) {
    issues.push(`${key}="${rawValue}" is not a valid number; the default ${DEFAULT_GUARDRAILS[key]} is used instead.`);
    return DEFAULT_GUARDRAILS[key];
  }

  return value;
}

function normalizeClock(key, rawValue, issues) {
  const fallback = DEFAULT_GUARDRAILS[key];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  const match = CLOCK_PATTERN.exec(String(rawValue));

  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    issues.push(`${key}="${rawValue}" is not a valid HH:MM time; the default ${fallback} is used instead.`);
    return fallback;
  }

  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

// Returns `{ guardrails, issues }`. Never throws, whatever is stored.
export function normalizeGuardrails(config) {
  const issues = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    if (config !== null && config !== undefined) {
      issues.push(UNREADABLE_MESSAGE);
    }

    return { guardrails: { ...DEFAULT_GUARDRAILS }, issues };
  }

  const guardrails = { ...DEFAULT_GUARDRAILS };

  for (const key of NUMBER_LIMIT_KEYS) {
    guardrails[key] = normalizeNumberLimit(key, config[key], issues);
  }

  for (const key of ["tradingWindowStart", "tradingWindowEnd"]) {
    guardrails[key] = normalizeClock(key, config[key], issues);
  }

  guardrails.enabled = config.enabled === false ? false : true;

  return { guardrails, issues };
}

export function readStoredGuardrails(storage = null) {
  const store =
    storage ??
    (typeof localStorage !== "undefined" ? localStorage : null);

  if (!store) {
    return normalizeGuardrails(undefined);
  }

  let raw;

  try {
    raw = store.getItem(GUARDRAIL_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to read trading guardrails:", error);

    return withIssue(normalizeGuardrails(undefined), UNREADABLE_MESSAGE);
  }

  if (!raw) {
    return normalizeGuardrails(undefined);
  }

  try {
    return normalizeGuardrails(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to parse trading guardrails:", error);

    return withIssue(normalizeGuardrails(undefined), UNREADABLE_MESSAGE);
  }
}

// ------------------------------------------------------------
// DAILY P&L POLICY
//
// Realized results only: the previous enforcement code read closed trades for
// its daily figure, so that intent is preserved. A loss limit therefore does
// NOT count floating drawdown on still-open positions — a trader who wants the
// limit to include it has to close. This is stated in the returned `policy` so
// no panel can imply more protection than the number provides.
// ------------------------------------------------------------

export const DAILY_PNL_POLICY = "realized-only";

function tradePnl(trade) {
  const value = Number(trade?.netProfit ?? trade?.pnl ?? trade?.profit ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function onLocalDay(trade, day) {
  const timestamp = getRealizedTimestamp(trade);

  if (timestamp === null) return false;

  return isSameDay(new Date(timestamp), day);
}

export function evaluateDailyGuardrail({
  guardrails: rawConfig = null,
  closedTrades = [],
  openTrades = [],
  now = new Date(),
} = {}) {
  const { guardrails, issues } = normalizeGuardrails(rawConfig);

  // Trade history is the only input the daily limits can be measured against.
  // If it is missing or malformed the limits cannot be checked, and reporting
  // `enforceable: false` stops any panel from claiming protection it does not
  // have. Trading is not blocked on a data-shape problem.
  const dataIssues = [];

  if (!Array.isArray(closedTrades)) {
    dataIssues.push("Closed trade history is unavailable, so the daily limits cannot be checked.");
  }

  if (!Array.isArray(openTrades)) {
    dataIssues.push("Open trade history is unavailable, so the daily limits cannot be checked.");
  }

  const configIssues = [...issues, ...dataIssues];
  const enforceable = dataIssues.length === 0;

  const closedToday = (enforceable ? closedTrades : []).filter((trade) =>
    onLocalDay(trade, now)
  );

  const openToday = (enforceable ? openTrades : []).filter((trade) =>
    onLocalDay(trade, now)
  );

  const unlocked = {
    locked: false,
    reason: "",
    dailyPnL: 0,
    dailyTradeCount: 0,
  };

  if (!guardrails.enabled) {
    return {
      ...unlocked,
      enabled: false,
      enforceable: true,
      configIssues,
      limits: {
        maxDailyLoss: guardrails.maxDailyLoss,
        maxDailyProfit: guardrails.maxDailyProfit,
        maxTradesPerDay: guardrails.maxTradesPerDay,
      },
      policy: DAILY_PNL_POLICY,
    };
  }

  const dailyPnL = closedToday.reduce((total, trade) => total + tradePnl(trade), 0);
  const dailyTradeCount = openToday.length + closedToday.length;

  const base = {
    enabled: true,
    enforceable,
    configIssues,
    dailyPnL,
    dailyTradeCount,
    limits: {
      maxDailyLoss: guardrails.maxDailyLoss,
      maxDailyProfit: guardrails.maxDailyProfit,
      maxTradesPerDay: guardrails.maxTradesPerDay,
    },
    policy: DAILY_PNL_POLICY,
  };

  if (guardrails.maxDailyLoss > 0 && dailyPnL <= -Math.abs(guardrails.maxDailyLoss)) {
    return {
      ...base,
      locked: true,
      reason: `Maximum daily loss reached. Your P&L is ${
        dailyPnL < 0
          ? `-$${Math.abs(dailyPnL).toFixed(2)}`
          : `$${dailyPnL.toFixed(2)}`
      } and your limit is -$${Math.abs(guardrails.maxDailyLoss).toFixed(2)}.`,
    };
  }

  if (guardrails.maxDailyProfit > 0 && dailyPnL >= Math.abs(guardrails.maxDailyProfit)) {
    return {
      ...base,
      locked: true,
      reason: `Daily profit target reached. Your P&L is ${
        dailyPnL >= 0 ? `+$${dailyPnL.toFixed(2)}` : `-$${Math.abs(dailyPnL).toFixed(2)}`
      } and your target is +$${Math.abs(guardrails.maxDailyProfit).toFixed(2)}.`,
    };
  }

  if (guardrails.maxTradesPerDay > 0 && dailyTradeCount >= guardrails.maxTradesPerDay) {
    return {
      ...base,
      locked: true,
      reason: `Daily trade limit reached. You have taken ${dailyTradeCount} of ${guardrails.maxTradesPerDay} allowed trades today.`,
    };
  }

  return { ...base, locked: false, reason: "" };
}
