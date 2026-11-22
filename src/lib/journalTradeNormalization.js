// ============================================================
// JOURNAL TRADE NORMALIZATION
// ============================================================
//
// Relocated verbatim from src/context/JournalContext.jsx:12-671 so that
// the rules every saved trade passes through on load and on update can be
// tested: Node cannot import a .jsx file at all. Live-trade behavior is
// unchanged. Recovered MT5 trades get exactly two compatibilities, both
// inside normalizeJournalTrade: a number the broker never reported stays
// unknown instead of becoming a misleading 0, and the broker symbol text
// survives instead of being stripped.

// ============================================================
// HELPERS
// ============================================================

function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// ============================================================
// ACCOUNT ID
// ============================================================

function normalizeAccountId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value);
}

// ============================================================
// SYMBOL
// ============================================================

function normalizeSymbol(symbol) {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// ============================================================
// DIRECTION
// ============================================================

function normalizeDirection(trade) {
  const raw =
    trade?.direction ??
    trade?.side ??
    trade?.type ??
    "";

  const value = String(raw).trim().toLowerCase();

  if (
    value === "buy" ||
    value === "long" ||
    value === "1"
  ) {
    return "Buy";
  }

  if (
    value === "sell" ||
    value === "short" ||
    value === "2"
  ) {
    return "Sell";
  }

  return "";
}

// ============================================================
// TIMESTAMP PARSER
// ============================================================

function getValidTimestamp(...values) {
  for (const value of values) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    // NUMBER
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    ) {
      if (value < 100000000000) {
        return value * 1000;
      }

      return value;
    }

    // NUMERIC STRING
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      /^-?\d+(\.\d+)?$/.test(value.trim())
    ) {
      const number = Number(value);

      if (
        Number.isFinite(number) &&
        number > 0
      ) {
        if (number < 100000000000) {
          return number * 1000;
        }

        return number;
      }
    }

    // DATE STRING
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  return null;
}

// ============================================================
// ENTRY TIMESTAMP
// ============================================================

function getEntryTimestamp(trade) {
  return getValidTimestamp(
    trade?.entryTime,
    trade?.openedAt,
    trade?.openTime,
    trade?.creationTime,
    trade?.createdAt,
    trade?.timestamp,

    trade?.tradeData?.entryTime,
    trade?.tradeData?.openedAt,
    trade?.tradeData?.openTime,
    trade?.tradeData?.creationTime,
    trade?.tradeData?.createdAt,
    trade?.tradeData?.timestamp,

    trade?.position?.entryTime,
    trade?.position?.openedAt,
    trade?.position?.openTime,
    trade?.position?.creationTime
  );
}

// ============================================================
// EXIT TIMESTAMP
// ============================================================

function getExitTimestamp(trade) {
  return getValidTimestamp(
    trade?.exitTime,
    trade?.closedAt,
    trade?.closeTime,
    trade?.closingTime,
    trade?.closedTime,
    trade?.exitedAt,
    trade?.executionTime,
    trade?.executedAt,

    trade?.tradeData?.exitTime,
    trade?.tradeData?.closedAt,
    trade?.tradeData?.closeTime,
    trade?.tradeData?.closingTime,
    trade?.tradeData?.closedTime,
    trade?.tradeData?.exitedAt,

    trade?.execution?.timestamp,
    trade?.execution?.time,
    trade?.execution?.closedAt,

    trade?.position?.exitTime,
    trade?.position?.closedAt,
    trade?.position?.closeTime,
    trade?.position?.closingTime
  );
}

// ============================================================
// DATE PARSER
// ============================================================

function getTradeDate(trade) {
  const timestamp =
    getEntryTimestamp(trade) ??
    getExitTimestamp(trade);

  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// ============================================================
// DATE STRING
// ============================================================

function getDateString(trade) {
  const date = getTradeDate(trade);

  if (!date) {
    return (
      trade?.date ??
      new Date().toISOString().split("T")[0]
    );
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================
// DAY
// ============================================================

function getDayName(trade) {
  const date = getTradeDate(trade);

  if (!date) {
    return trade?.day ?? "";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
  });
}

// ============================================================
// TIME FORMAT
// ============================================================

function formatTradeTime(timestamp) {
  if (
    timestamp === undefined ||
    timestamp === null
  ) {
    return "--";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================================
// FULL DATE + TIME
// ============================================================

function formatTradeDateTime(timestamp) {
  if (
    timestamp === undefined ||
    timestamp === null
  ) {
    return "--";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================================
// DURATION CALCULATOR
// ============================================================

function calculateTradeDuration(
  entryTimestamp,
  exitTimestamp
) {
  if (
    entryTimestamp === null ||
    exitTimestamp === null
  ) {
    return 0;
  }

  const duration =
    exitTimestamp - entryTimestamp;

  if (duration <= 0) {
    return 0;
  }

  return duration;
}

// ============================================================
// FORMAT DURATION
// ============================================================

function formatTradeDuration(durationMs) {
  const duration = Number(durationMs);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return "0s";
  }

  const totalSeconds = Math.floor(
    duration / 1000
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${hours}h`;
  }

  if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${minutes}m`;
  }

  return `${seconds}s`;
}

// ============================================================
// TRADING SESSION
// ============================================================

function getTradingSession(trade) {
  if (
    trade?.session &&
    String(trade.session).trim() !== ""
  ) {
    return trade.session;
  }

  const timestamp =
    getEntryTimestamp(trade);

  if (timestamp === null) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const hour = date.getUTCHours();

  if (hour >= 0 && hour < 8) {
    return "Asia";
  }

  if (hour >= 8 && hour < 13) {
    return "London";
  }

  if (hour >= 13 && hour < 21) {
    return "New York";
  }

  return "Sydney";
}

// ============================================================
// RISK / REWARD
// ============================================================

function calculateRiskReward(trade) {
  const entry = normalizeNumber(
    trade?.entry ??
      trade?.entryPrice
  );

  const stopLoss = normalizeNumber(
    trade?.stopLoss ??
      trade?.sl
  );

  const takeProfit = normalizeNumber(
    trade?.takeProfit ??
      trade?.tp
  );

  const direction =
    normalizeDirection(trade);

  if (
    entry <= 0 ||
    stopLoss <= 0 ||
    takeProfit <= 0
  ) {
    return normalizeNumber(
      trade?.rr ??
        trade?.riskReward ??
        trade?.riskRewardRatio
    );
  }

  let risk = 0;
  let reward = 0;

  if (direction === "Buy") {
    risk = entry - stopLoss;
    reward = takeProfit - entry;
  }

  if (direction === "Sell") {
    risk = stopLoss - entry;
    reward = entry - takeProfit;
  }

  if (risk <= 0 || reward < 0) {
    return 0;
  }

  return Number(
    (reward / risk).toFixed(2)
  );
}

// ============================================================
// RECOVERED (MT5 HISTORY-RECOVERY) TRADES
// ============================================================

// The provenance pair the recovery adapter publishes with every record
// (mt5RecoveryJournalAdapter.js adaptRecord's source and broker) and nothing else writes.
// Both halves have to be present, so a trade the user typed, imported or
// edited keeps the normalization it has always had.
const RECOVERED_SOURCE = "history-recovery";
const RECOVERED_BROKER = "MT5";

function isRecoveredTrade(trade) {
  return trade?.source === RECOVERED_SOURCE && trade?.broker === RECOVERED_BROKER;
}

// normalizeNumber with one difference: an absent, blank or unparseable
// value stays null instead of becoming 0.
function normalizeKnownNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function isKnownNumber(value) {
  return normalizeKnownNumber(value) !== null;
}

// The broker's own symbol text, carried unchanged. Deal history rows are the
// source of a recovered trade's symbol and the adapter refuses any record
// whose rows say otherwise (:831-835), so "EURUSD.pro" is a proved fact and
// the stripped "EURUSDPRO" would be a different instrument name.
function recoveredSymbol(trade) {
  const raw =
    trade.symbol ??
    trade.pair ??
    trade.instrument;

  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "";
}

// Risk/reward is computed from entry, stop loss and take profit, and deal
// history reports none of the three. So for a recovered trade an unreported
// ratio stays unknown rather than being published as a ratio of 0, which the
// journal would read as a trade with no upside.
function recoveredRiskReward(trade) {
  const hasRiskInputs =
    isKnownNumber(trade?.entry ?? trade?.entryPrice) &&
    isKnownNumber(trade?.stopLoss ?? trade?.sl) &&
    isKnownNumber(trade?.takeProfit ?? trade?.tp);

  if (hasRiskInputs) {
    return calculateRiskReward(trade);
  }

  return normalizeKnownNumber(
    trade?.rr ??
      trade?.riskReward ??
      trade?.riskRewardRatio
  );
}

// ============================================================
// NORMALIZE JOURNAL TRADE
// ============================================================

function normalizeJournalTrade(trade) {
  if (
    !trade ||
    typeof trade !== "object"
  ) {
    return trade;
  }

  const recovered =
    isRecoveredTrade(trade);

  const direction =
    normalizeDirection(trade);

  const symbol =
    recovered
      ? recoveredSymbol(trade)
      : normalizeSymbol(
          trade.symbol ??
            trade.pair ??
            trade.instrument
        );

  // A live trade's blank amount is a form the user left empty and the
  // journal has always read as 0. A recovered trade's blank amount is a fact
  // the broker never reported; 0 there claims one exists — a stop loss at
  // price 0 is even counted as protection by the discipline panel
  // (src/components/dashboard/Discipline/DisciplineBreakdown.jsx:81-83).
  const readNumber =
    recovered ? normalizeKnownNumber : normalizeNumber;

  const rr =
    recovered ? recoveredRiskReward(trade) : calculateRiskReward(trade);

  const entryTimestamp =
    getEntryTimestamp(trade);

  const exitTimestamp =
    getExitTimestamp(trade);

  const durationMs =
    calculateTradeDuration(
      entryTimestamp,
      exitTimestamp
    );

  const duration =
    formatTradeDuration(durationMs);

  const date =
    entryTimestamp !== null
      ? getDateString({
          ...trade,
          openedAt: entryTimestamp,
        })
      : getDateString(trade);

  const day =
    entryTimestamp !== null
      ? getDayName({
          ...trade,
          openedAt: entryTimestamp,
        })
      : getDayName(trade);

  const session =
    getTradingSession({
      ...trade,
      openedAt:
        entryTimestamp ??
        trade?.openedAt ??
        trade?.openTime ??
        null,
    });

  const pnl = normalizeNumber(
    trade.pnl ??
      trade.netProfit ??
      trade.netPnL ??
      trade.profit ??
      trade.PnL ??
      0
  );

  let result = trade.result;

  if (!result) {
    if (pnl > 0) {
      result = "Win";
    } else if (pnl < 0) {
      result = "Loss";
    } else {
      result = "Breakeven";
    }
  }

  // ==========================================================
  // ACCOUNT ISOLATION
  // ==========================================================

  const accountId = normalizeAccountId(
    trade.accountId ??
      trade.accountID
  );

  return {
    ...trade,

    id:
      trade.id ??
      `journal-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    pair:
      symbol ||
      trade.pair ||
      "",

    symbol:
      symbol ||
      trade.symbol ||
      "",

    date,
    day,
    session,
    direction,
    result,

    pnl,
    PnL: pnl,
    netProfit: pnl,
    netPnL: pnl,

    rr,
    riskReward: rr,
    riskRewardRatio: rr,

    entryPrice: readNumber(
      trade.entryPrice ??
        trade.entry
    ),

    exitPrice: readNumber(
      trade.exitPrice ??
        trade.exit ??
        trade.currentPrice
    ),

    stopLoss: readNumber(
      trade.stopLoss ??
        trade.sl
    ),

    takeProfit: readNumber(
      trade.takeProfit ??
        trade.tp
    ),

    entryTime: entryTimestamp,
    openedAt: entryTimestamp,
    openTime: entryTimestamp,

    exitTime: exitTimestamp,
    closedAt: exitTimestamp,
    closeTime: exitTimestamp,

    entryTimeFormatted:
      formatTradeTime(entryTimestamp),

    exitTimeFormatted:
      formatTradeTime(exitTimestamp),

    entryDateTime:
      formatTradeDateTime(
        entryTimestamp
      ),

    exitDateTime:
      formatTradeDateTime(
        exitTimestamp
      ),

    durationMs,
    duration,
    durationFormatted: duration,

    // ========================================================
    // GLOBAL ACCOUNT
    // ========================================================

    accountId,
  };
}

export {
  normalizeAccountId,
  normalizeJournalTrade,
  normalizeNumber,
};