import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

const JournalContext = createContext(null);

// ============================================================
// HELPERS
// ============================================================

function normalizeNumber(value, fallback = 0) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
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

  const value = String(raw)
    .trim()
    .toLowerCase();

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
//
// Supports:
//
// 1. ISO strings
//    2026-09-15T15:02:00.000Z
//
// 2. JavaScript milliseconds
//    1757948520000
//
// 3. Unix seconds
//    1757948520
//
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

    // ----------------------------------------------------------
    // NUMBER
    // ----------------------------------------------------------

    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    ) {
      // Unix seconds → milliseconds
      if (value < 100000000000) {
        return value * 1000;
      }

      return value;
    }

    // ----------------------------------------------------------
    // NUMERIC STRING
    // ----------------------------------------------------------

    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      /^-?\d+(\.\d+)?$/.test(
        value.trim()
      )
    ) {
      const number =
        Number(value);

      if (
        Number.isFinite(number) &&
        number > 0
      ) {
        // Unix seconds → milliseconds
        if (
          number <
          100000000000
        ) {
          return number * 1000;
        }

        return number;
      }
    }

    // ----------------------------------------------------------
    // DATE STRING
    // ----------------------------------------------------------

    const date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
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

    // Nested data
    trade?.tradeData?.entryTime,
    trade?.tradeData?.openedAt,
    trade?.tradeData?.openTime,
    trade?.tradeData?.creationTime,
    trade?.tradeData?.createdAt,
    trade?.tradeData?.timestamp,

    // Nested position data
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

    // Execution timestamp
    trade?.executionTime,
    trade?.executedAt,

    // Nested data
    trade?.tradeData?.exitTime,
    trade?.tradeData?.closedAt,
    trade?.tradeData?.closeTime,
    trade?.tradeData?.closingTime,
    trade?.tradeData?.closedTime,
    trade?.tradeData?.exitedAt,

    // Nested execution
    trade?.execution?.timestamp,
    trade?.execution?.time,
    trade?.execution?.closedAt,

    // Nested position
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

  if (
    timestamp === null
  ) {
    return null;
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

// ============================================================
// DATE STRING
// ============================================================

function getDateString(trade) {
  const date =
    getTradeDate(trade);

  if (!date) {
    return (
      trade?.date ??
      new Date()
        .toISOString()
        .split("T")[0]
    );
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================
// DAY
// ============================================================

function getDayName(trade) {
  const date =
    getTradeDate(trade);

  if (!date) {
    return trade?.day ?? "";
  }

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
    }
  );
}

// ============================================================
// TIME FORMAT
// ============================================================
//
// Example:
//
// 20:30 → 8:30 PM
// 08:50 → 8:50 AM
//
// ============================================================

function formatTradeTime(timestamp) {
  if (
    timestamp === undefined ||
    timestamp === null
  ) {
    return "--";
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--";
  }

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
}

// ============================================================
// FULL DATE + TIME
// ============================================================

function formatTradeDateTime(
  timestamp
) {
  if (
    timestamp === undefined ||
    timestamp === null
  ) {
    return "--";
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--";
  }

  return date.toLocaleString(
    "en-US",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
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
    exitTimestamp -
    entryTimestamp;

  if (duration <= 0) {
    return 0;
  }

  return duration;
}

// ============================================================
// FORMAT DURATION
// ============================================================
//
// Examples:
//
// 20 seconds → 20s
// 90 seconds → 1m 30s
// 20 minutes → 20m
// 1 hour 20 minutes → 1h 20m
// 2 hours → 2h
//
// ============================================================

function formatTradeDuration(
  durationMs
) {
  const duration =
    Number(durationMs);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return "0s";
  }

  const totalSeconds =
    Math.floor(
      duration / 1000
    );

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60
    );

  const seconds =
    totalSeconds % 60;

  // ----------------------------------------------------------
  // HOURS
  // ----------------------------------------------------------

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${hours}h`;
  }

  // ----------------------------------------------------------
  // MINUTES
  // ----------------------------------------------------------

  if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${minutes}m`;
  }

  // ----------------------------------------------------------
  // SECONDS
  // ----------------------------------------------------------

  return `${seconds}s`;
}

// ============================================================
// TRADING SESSION
// ============================================================
//
// Session is derived from UTC.
//
// Asia:
// 00:00 - 07:59 UTC
//
// London:
// 08:00 - 12:59 UTC
//
// New York:
// 13:00 - 20:59 UTC
//
// Sydney:
// 21:00 - 23:59 UTC
//
// ============================================================

function getTradingSession(trade) {
  // If an explicit session exists,
  // preserve it.

  if (
    trade?.session &&
    String(
      trade.session
    ).trim() !== ""
  ) {
    return trade.session;
  }

  const timestamp =
    getEntryTimestamp(trade);

  if (
    timestamp === null
  ) {
    return "";
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const hour =
    date.getUTCHours();

  if (
    hour >= 0 &&
    hour < 8
  ) {
    return "Asia";
  }

  if (
    hour >= 8 &&
    hour < 13
  ) {
    return "London";
  }

  if (
    hour >= 13 &&
    hour < 21
  ) {
    return "New York";
  }

  return "Sydney";
}

// ============================================================
// RISK / REWARD
// ============================================================

function calculateRiskReward(
  trade
) {
  const entry =
    normalizeNumber(
      trade?.entry ??
        trade?.entryPrice
    );

  const stopLoss =
    normalizeNumber(
      trade?.stopLoss ??
        trade?.sl
    );

  const takeProfit =
    normalizeNumber(
      trade?.takeProfit ??
        trade?.tp
    );

  const direction =
    normalizeDirection(
      trade
    );

  // ----------------------------------------------------------
  // If price data is unavailable,
  // use existing RR.
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // BUY
  // ----------------------------------------------------------

  if (
    direction === "Buy"
  ) {
    risk =
      entry - stopLoss;

    reward =
      takeProfit - entry;
  }

  // ----------------------------------------------------------
  // SELL
  // ----------------------------------------------------------

  if (
    direction === "Sell"
  ) {
    risk =
      stopLoss - entry;

    reward =
      entry - takeProfit;
  }

  if (
    risk <= 0 ||
    reward < 0
  ) {
    return 0;
  }

  return Number(
    (
      reward / risk
    ).toFixed(2)
  );
}

// ============================================================
// NORMALIZE JOURNAL TRADE
// ============================================================

function normalizeJournalTrade(
  trade
) {
  if (
    !trade ||
    typeof trade !== "object"
  ) {
    return trade;
  }

  // ==========================================================
  // BASIC DATA
  // ==========================================================

  const direction =
    normalizeDirection(
      trade
    );

  const symbol =
    normalizeSymbol(
      trade.symbol ??
        trade.pair ??
        trade.instrument
    );

  // ==========================================================
  // ACTUAL ENTRY TIMESTAMP
  // ==========================================================

  const entryTimestamp =
    getEntryTimestamp(
      trade
    );

  // ==========================================================
  // ACTUAL EXIT TIMESTAMP
  // ==========================================================

  const exitTimestamp =
    getExitTimestamp(
      trade
    );

  // ==========================================================
  // DURATION
  // ==========================================================

  const durationMs =
    calculateTradeDuration(
      entryTimestamp,
      exitTimestamp
    );

  const duration =
    formatTradeDuration(
      durationMs
    );

  // ==========================================================
  // DATE
  // ==========================================================

  const date =
    entryTimestamp !== null
      ? getDateString({
          ...trade,
          openedAt:
            entryTimestamp,
        })
      : getDateString(
          trade
        );

  // ==========================================================
  // DAY
  // ==========================================================

  const day =
    entryTimestamp !== null
      ? getDayName({
          ...trade,
          openedAt:
            entryTimestamp,
        })
      : getDayName(
          trade
        );

  // ==========================================================
  // SESSION
  // ==========================================================

  const session =
    getTradingSession({
      ...trade,

      openedAt:
        entryTimestamp ??
        trade?.openedAt ??
        trade?.openTime ??
        null,
    });

  // ==========================================================
  // RISK / REWARD
  // ==========================================================

  const rr =
    calculateRiskReward(
      trade
    );

  // ==========================================================
  // P&L
  // ==========================================================

  const pnl =
    normalizeNumber(
      trade.pnl ??
        trade.netProfit ??
        trade.netPnL ??
        trade.profit ??
        trade.PnL ??
        0
    );

  // ==========================================================
  // RESULT
  // ==========================================================

  let result =
    trade.result;

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
  // FINAL NORMALIZED TRADE
  // ==========================================================

  return {
    ...trade,

    // ========================================================
    // ID
    // ========================================================

    id:
      trade.id ??
      `journal-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    // ========================================================
    // MAIN JOURNAL DATA
    // ========================================================

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

    // ========================================================
    // P&L
    // ========================================================

    pnl,

    PnL:
      pnl,

    netProfit:
      pnl,

    netPnL:
      pnl,

    // ========================================================
    // RISK / REWARD
    // ========================================================

    rr,

    riskReward:
      rr,

    riskRewardRatio:
      rr,

    // ========================================================
    // PRICE DATA
    // ========================================================

    entryPrice:
      normalizeNumber(
        trade.entryPrice ??
          trade.entry
      ),

    exitPrice:
      normalizeNumber(
        trade.exitPrice ??
          trade.exit ??
          trade.currentPrice
      ),

    stopLoss:
      normalizeNumber(
        trade.stopLoss ??
          trade.sl
      ),

    takeProfit:
      normalizeNumber(
        trade.takeProfit ??
          trade.tp
      ),

    // ========================================================
    // ENTRY TIME
    // ========================================================
    //
    // IMPORTANT:
    // Keep the ORIGINAL timestamp.
    //
    // UI can display it as:
    //
    // 8:30 PM
    //
    // ========================================================

    entryTime:
      entryTimestamp,

    openedAt:
      entryTimestamp,

    openTime:
      entryTimestamp,

    // ========================================================
    // EXIT TIME
    // ========================================================

    exitTime:
      exitTimestamp,

    closedAt:
      exitTimestamp,

    closeTime:
      exitTimestamp,

    // ========================================================
    // READABLE TIME
    // ========================================================

    entryTimeFormatted:
      formatTradeTime(
        entryTimestamp
      ),

    exitTimeFormatted:
      formatTradeTime(
        exitTimestamp
      ),

    entryDateTime:
      formatTradeDateTime(
        entryTimestamp
      ),

    exitDateTime:
      formatTradeDateTime(
        exitTimestamp
      ),

    // ========================================================
    // DURATION
    // ========================================================
    //
    // durationMs:
    // raw milliseconds
    //
    // duration:
    // UI-ready string
    //
    // Example:
    // 1200000 → "20m"
    //
    // ========================================================

    durationMs,

    duration,

    durationFormatted:
      duration,

    // ========================================================
    // ACCOUNT
    // ========================================================

    accountId:
      trade.accountId ??
      trade.accountID ??
      null,
  };
}

// ============================================================
// LOAD SAVED TRADES
// ============================================================

function loadSavedTrades() {
  try {
    const saved =
      localStorage.getItem(
        "trades"
      );

    if (!saved) {
      return [];
    }

    const parsed =
      JSON.parse(saved);

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    // Normalize old trades too.

    return parsed
      .map(
        normalizeJournalTrade
      )
      .filter(Boolean);
  } catch (error) {
    console.error(
      "❌ Failed to load journal trades:",
      error
    );

    return [];
  }
}

// ============================================================
// JOURNAL PROVIDER
// ============================================================

export function JournalProvider({
  children,
}) {
  // ==========================================================
  // TRADES
  // ==========================================================

  const [
    trades,
    setTrades,
  ] = useState(() =>
    loadSavedTrades()
  );

  // ==========================================================
  // RELOAD TRADES
  // ==========================================================

  const reloadTrades =
    useCallback(() => {
      const loaded =
        loadSavedTrades();

      setTrades(loaded);
    }, []);

  // ==========================================================
  // SAVE TRADES
  // ==========================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "trades",
        JSON.stringify(
          trades
        )
      );
    } catch (error) {
      console.error(
        "❌ Failed to save journal trades:",
        error
      );
    }
  }, [trades]);

  // ==========================================================
  // STORAGE EVENT
  // ==========================================================

  useEffect(() => {
    window.addEventListener(
      "storage",
      reloadTrades
    );

    return () => {
      window.removeEventListener(
        "storage",
        reloadTrades
      );
    };
  }, [
    reloadTrades,
  ]);

  // ==========================================================
  // ADD TRADE
  // ==========================================================

  const addTrade =
    useCallback(
      (trade) => {
        if (
          !trade ||
          typeof trade !==
            "object"
        ) {
          console.error(
            "❌ Cannot add invalid journal trade:",
            trade
          );

          return;
        }

        // ----------------------------------------------------
        // NORMALIZE
        // ----------------------------------------------------

        const normalizedTrade =
          normalizeJournalTrade(
            trade
          );

        console.log(
          "📘 AUTOMATIC JOURNAL TRADE:",
          normalizedTrade
        );

        // ----------------------------------------------------
        // DUPLICATE / UPDATE CHECK
        // ----------------------------------------------------

        setTrades(
          (prev) => {
            const exists =
              prev.some(
                (
                  existingTrade
                ) =>
                  String(
                    existingTrade.id
                  ) ===
                  String(
                    normalizedTrade.id
                  )
              );

            // --------------------------------------------------
            // UPDATE EXISTING
            // --------------------------------------------------

            if (exists) {
              return prev.map(
                (
                  existingTrade
                ) =>
                  String(
                    existingTrade.id
                  ) ===
                  String(
                    normalizedTrade.id
                  )
                    ? normalizeJournalTrade(
                        {
                          ...existingTrade,
                          ...normalizedTrade,
                        }
                      )
                    : existingTrade
              );
            }

            // --------------------------------------------------
            // ADD NEW
            // --------------------------------------------------

            return [
              ...prev,
              {
                ...normalizedTrade,

                id:
                  normalizedTrade.id ??
                  `journal-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
              },
            ];
          }
        );
      },
      []
    );

  // ==========================================================
  // UPDATE TRADE
  // ==========================================================

  const updateTrade =
    useCallback(
      (updatedTrade) => {
        if (
          !updatedTrade ||
          updatedTrade.id ===
            undefined ||
          updatedTrade.id ===
            null
        ) {
          console.error(
            "❌ Cannot update trade without ID:",
            updatedTrade
          );

          return;
        }

        const normalizedTrade =
          normalizeJournalTrade(
            updatedTrade
          );

        setTrades(
          (prev) =>
            prev.map(
              (trade) =>
                String(
                  trade.id
                ) ===
                String(
                  normalizedTrade.id
                )
                  ? normalizeJournalTrade(
                      {
                        ...trade,
                        ...normalizedTrade,
                      }
                    )
                  : trade
            )
        );
      },
      []
    );

  // ==========================================================
  // DELETE TRADE
  // ==========================================================

  const deleteTrade =
    useCallback(
      (id) => {
        setTrades(
          (prev) =>
            prev.filter(
              (trade) =>
                String(
                  trade.id
                ) !==
                String(id)
            )
        );
      },
      []
    );

  // ==========================================================
  // SELECTED ACCOUNT
  // ==========================================================

  const [
    selectedAccountId,
    setSelectedAccountId,
  ] = useState(() => {
    try {
      const saved =
        localStorage.getItem(
          "selectedAccountId"
        );

      return saved
        ? Number(saved)
        : null;
    } catch {
      return null;
    }
  });

  // ==========================================================
  // SAVE SELECTED ACCOUNT
  // ==========================================================

  useEffect(() => {
    try {
      if (
        selectedAccountId !==
        null
      ) {
        localStorage.setItem(
          "selectedAccountId",
          String(
            selectedAccountId
          )
        );
      }
    } catch (error) {
      console.error(
        "❌ Failed to save selected account:",
        error
      );
    }
  }, [
    selectedAccountId,
  ]);

  // ==========================================================
  // FILTERED TRADES
  // ==========================================================

  const filteredTrades =
    useMemo(() => {
      return trades.filter(
        (trade) => {
          // Old trades without
          // accountId remain visible.

          if (
            !trade.accountId
          ) {
            return true;
          }

          return (
            Number(
              trade.accountId
            ) ===
            Number(
              selectedAccountId
            )
          );
        }
      );
    }, [
      trades,
      selectedAccountId,
    ]);

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {
    // --------------------------------------------------------
    // TRADES
    // --------------------------------------------------------

    trades,

    filteredTrades,

    setTrades,

    // --------------------------------------------------------
    // TRADE ACTIONS
    // --------------------------------------------------------

    addTrade,

    updateTrade,

    deleteTrade,

    reloadTrades,

    // --------------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------------

    selectedAccountId,

    setSelectedAccountId,
  };

  return (
    <JournalContext.Provider
      value={value}
    >
      {children}
    </JournalContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useJournal() {
  const context =
    useContext(
      JournalContext
    );

  if (!context) {
    throw new Error(
      "useJournal must be used inside JournalProvider"
    );
  }

  return context;
}