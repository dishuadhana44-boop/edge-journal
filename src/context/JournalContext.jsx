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
// NORMALIZE JOURNAL TRADE
// ============================================================

function normalizeJournalTrade(trade) {
  if (
    !trade ||
    typeof trade !== "object"
  ) {
    return trade;
  }

  const direction =
    normalizeDirection(trade);

  const symbol = normalizeSymbol(
    trade.symbol ??
      trade.pair ??
      trade.instrument
  );

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

  const rr =
    calculateRiskReward(trade);

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

    entryPrice: normalizeNumber(
      trade.entryPrice ??
        trade.entry
    ),

    exitPrice: normalizeNumber(
      trade.exitPrice ??
        trade.exit ??
        trade.currentPrice
    ),

    stopLoss: normalizeNumber(
      trade.stopLoss ??
        trade.sl
    ),

    takeProfit: normalizeNumber(
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

// ============================================================
// LOAD SAVED TRADES
// ============================================================

function loadSavedTrades() {
  try {
    const saved =
      localStorage.getItem("trades");

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeJournalTrade)
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
// LOAD SELECTED ACCOUNT
// ============================================================

function loadSelectedAccountId() {
  try {
    const saved =
      localStorage.getItem(
        "selectedAccountId"
      );

    return normalizeAccountId(saved);
  } catch (error) {
    console.error(
      "❌ Failed to load selected account:",
      error
    );

    return null;
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

  const [trades, setTrades] = useState(() =>
    loadSavedTrades()
  );

  // ==========================================================
  // SELECTED ACCOUNT
  // ==========================================================

  const [
    selectedAccountId,
    setSelectedAccountIdState,
  ] = useState(() =>
    loadSelectedAccountId()
  );

  // ==========================================================
  // SELECTED ACCOUNT SETTER
  // ==========================================================

  const setSelectedAccountId =
    useCallback((accountId) => {
      const normalizedId =
        normalizeAccountId(accountId);

      setSelectedAccountIdState(
        normalizedId
      );

      try {
        if (normalizedId !== null) {
          localStorage.setItem(
            "selectedAccountId",
            normalizedId
          );
        } else {
          localStorage.removeItem(
            "selectedAccountId"
          );
        }
      } catch (error) {
        console.error(
          "❌ Failed to save selected account:",
          error
        );
      }
    }, []);

  // ==========================================================
  // RELOAD TRADES
  // ==========================================================

  const reloadTrades = useCallback(() => {
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
        JSON.stringify(trades)
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
    const handleStorage = (event) => {
      // Another tab/window changed selected account.
      if (
        event.key ===
        "selectedAccountId"
      ) {
        setSelectedAccountIdState(
          normalizeAccountId(
            event.newValue
          )
        );
      }

      // Another tab/window changed trades.
      if (
        event.key === "trades"
      ) {
        reloadTrades();
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [reloadTrades]);

  // ==========================================================
  // ADD TRADE
  // ==========================================================

  const addTrade = useCallback(
    (trade) => {
      if (
        !trade ||
        typeof trade !== "object"
      ) {
        console.error(
          "❌ Cannot add invalid journal trade:",
          trade
        );

        return;
      }

      // ======================================================
      // ACCOUNT SAFETY
      // ======================================================

      const tradeAccountId =
        normalizeAccountId(
          trade.accountId ??
            trade.accountID
        );

      // If the caller did not provide an account,
      // automatically attach the currently selected account.
      const accountId =
        tradeAccountId ??
        selectedAccountId;

      // Never create an account-less journal trade
      // when an account is selected.
      if (!accountId) {
        console.warn(
          "⚠️ Cannot add journal trade: no trading account selected."
        );

        return;
      }

      const normalizedTrade =
        normalizeJournalTrade({
          ...trade,
          accountId,
        });

      console.log(
        "📘 AUTOMATIC JOURNAL TRADE:",
        normalizedTrade
      );

      // ======================================================
      // DUPLICATE / UPDATE CHECK
      // ======================================================

      setTrades((prev) => {
        const exists = prev.some(
          (existingTrade) =>
            String(existingTrade.id) ===
            String(normalizedTrade.id)
        );

        // ====================================================
        // UPDATE EXISTING
        // ====================================================

        if (exists) {
          return prev.map(
            (existingTrade) => {
              if (
                String(existingTrade.id) !==
                String(normalizedTrade.id)
              ) {
                return existingTrade;
              }

              // Prevent moving an existing trade
              // between trading accounts.
              const existingAccountId =
                normalizeAccountId(
                  existingTrade.accountId
                );

              if (
                existingAccountId &&
                existingAccountId !==
                  accountId
              ) {
                console.warn(
                  "⚠️ Prevented moving a trade to another account."
                );

                return existingTrade;
              }

              return normalizeJournalTrade({
                ...existingTrade,
                ...normalizedTrade,
                accountId:
                  existingAccountId ??
                  accountId,
              });
            }
          );
        }

        // ====================================================
        // ADD NEW
        // ====================================================

        return [
          ...prev,
          {
            ...normalizedTrade,
            accountId,
            id:
              normalizedTrade.id ??
              `journal-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
          },
        ];
      });
    },
    [selectedAccountId]
  );

  // ==========================================================
  // UPDATE TRADE
  // ==========================================================

  const updateTrade = useCallback(
    (updatedTrade) => {
      if (
        !updatedTrade ||
        updatedTrade.id === undefined ||
        updatedTrade.id === null
      ) {
        console.error(
          "❌ Cannot update trade without ID:",
          updatedTrade
        );

        return;
      }

      setTrades((prev) =>
        prev.map((trade) => {
          if (
            String(trade.id) !==
            String(updatedTrade.id)
          ) {
            return trade;
          }

          const existingAccountId =
            normalizeAccountId(
              trade.accountId
            );

          const incomingAccountId =
            normalizeAccountId(
              updatedTrade.accountId ??
                updatedTrade.accountID
            );

          // Prevent changing the account of
          // an existing trade.
          if (
            existingAccountId &&
            incomingAccountId &&
            existingAccountId !==
              incomingAccountId
          ) {
            console.warn(
              "⚠️ Prevented changing trade account."
            );

            return trade;
          }

          return normalizeJournalTrade({
            ...trade,
            ...updatedTrade,
            accountId:
              existingAccountId ??
              incomingAccountId ??
              selectedAccountId,
          });
        })
      );
    },
    [selectedAccountId]
  );

  // ==========================================================
  // DELETE TRADE
  // ==========================================================

  const deleteTrade = useCallback(
    (id) => {
      setTrades((prev) =>
        prev.filter(
          (trade) =>
            String(trade.id) !==
            String(id)
        )
      );
    },
    []
  );

  // ==========================================================
  // FILTERED TRADES
  // ==========================================================

  const filteredTrades = useMemo(() => {
    // No selected account = no account-scoped data.
    if (!selectedAccountId) {
      return [];
    }

    return trades.filter((trade) => {
      const tradeAccountId =
        normalizeAccountId(
          trade?.accountId ??
            trade?.accountID
        );

      // IMPORTANT:
      // Old/unassigned trades are NOT shown
      // inside any account.
      if (!tradeAccountId) {
        return false;
      }

      return (
        tradeAccountId ===
        String(selectedAccountId)
      );
    });
  }, [
    trades,
    selectedAccountId,
  ]);

  // ==========================================================
  // ACCOUNT-SCOPED ADD TRADE
  // ==========================================================

  const addAccountTrade = useCallback(
    (trade) => {
      if (!selectedAccountId) {
        console.warn(
          "⚠️ Cannot add account trade: no account selected."
        );

        return;
      }

      const providedAccountId =
        normalizeAccountId(
          trade?.accountId ??
            trade?.accountID
        );

      // If an account ID was supplied, it must
      // match the currently selected account.
      if (
        providedAccountId &&
        providedAccountId !==
          String(selectedAccountId)
      ) {
        console.warn(
          "⚠️ Prevented adding trade to another account."
        );

        return;
      }

      addTrade({
        ...trade,
        accountId:
          providedAccountId ??
          String(selectedAccountId),
      });
    },
    [
      addTrade,
      selectedAccountId,
    ]
  );

  // ==========================================================
  // ACCOUNT-SCOPED UPDATE TRADE
  // ==========================================================

  const updateAccountTrade =
    useCallback(
      (updatedTrade) => {
        if (
          !updatedTrade ||
          updatedTrade.id === undefined ||
          updatedTrade.id === null
        ) {
          return;
        }

        if (!selectedAccountId) {
          console.warn(
            "⚠️ Cannot update account trade: no account selected."
          );

          return;
        }

        const existingTrade =
          trades.find(
            (trade) =>
              String(trade.id) ===
              String(
                updatedTrade.id
              )
          );

        if (!existingTrade) {
          console.warn(
            "⚠️ Trade not found."
          );

          return;
        }

        const existingAccountId =
          normalizeAccountId(
            existingTrade.accountId
          );

        // Prevent accidentally editing
        // another account's trade.
        if (
          existingAccountId !==
          String(selectedAccountId)
        ) {
          console.warn(
            "⚠️ Prevented updating a trade belonging to another account."
          );

          return;
        }

        const incomingAccountId =
          normalizeAccountId(
            updatedTrade.accountId ??
              updatedTrade.accountID
          );

        // Prevent changing the trade's account.
        if (
          incomingAccountId &&
          incomingAccountId !==
            String(selectedAccountId)
        ) {
          console.warn(
            "⚠️ Prevented moving trade to another account."
          );

          return;
        }

        updateTrade({
          ...updatedTrade,
          accountId:
            String(selectedAccountId),
        });
      },
      [
        trades,
        selectedAccountId,
        updateTrade,
      ]
    );

  // ==========================================================
  // ACCOUNT-SCOPED DELETE TRADE
  // ==========================================================

  const deleteAccountTrade =
    useCallback(
      (tradeId) => {
        if (!selectedAccountId) {
          console.warn(
            "⚠️ Cannot delete account trade: no account selected."
          );

          return;
        }

        const existingTrade =
          trades.find(
            (trade) =>
              String(trade.id) ===
              String(tradeId)
          );

        if (!existingTrade) {
          return;
        }

        const tradeAccountId =
          normalizeAccountId(
            existingTrade.accountId
          );

        // Never allow deleting a trade
        // belonging to another account.
        if (
          tradeAccountId !==
          String(selectedAccountId)
        ) {
          console.warn(
            "⚠️ Prevented deleting a trade belonging to another account."
          );

          return;
        }

        deleteTrade(tradeId);
      },
      [
        trades,
        selectedAccountId,
        deleteTrade,
      ]
    );

  // ==========================================================
  // ACCOUNT-SCOPED STATISTICS
  // ==========================================================

  const accountTradeStats = useMemo(() => {
    const totalTrades =
      filteredTrades.length;

    const winningTrades =
      filteredTrades.filter(
        (trade) =>
          Number(trade.pnl) > 0
      ).length;

    const losingTrades =
      filteredTrades.filter(
        (trade) =>
          Number(trade.pnl) < 0
      ).length;

    const breakevenTrades =
      filteredTrades.filter(
        (trade) =>
          Number(trade.pnl) === 0
      ).length;

    const totalPnL =
      filteredTrades.reduce(
        (sum, trade) =>
          sum +
          normalizeNumber(
            trade.pnl
          ),
        0
      );

    const winRate =
      totalTrades > 0
        ? Number(
            (
              (winningTrades /
                totalTrades) *
              100
            ).toFixed(2)
          )
        : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      totalPnL,
      winRate,
    };
  }, [filteredTrades]);

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {
    // --------------------------------------------------------
    // ALL TRADES
    // --------------------------------------------------------

    trades,
    setTrades,

    // --------------------------------------------------------
    // CURRENT ACCOUNT TRADES
    // --------------------------------------------------------

    filteredTrades,

    // --------------------------------------------------------
    // CURRENT ACCOUNT STATISTICS
    // --------------------------------------------------------

    accountTradeStats,

    // --------------------------------------------------------
    // TRADE ACTIONS
    // --------------------------------------------------------

    addTrade,
    addAccountTrade,

    updateTrade,
    updateAccountTrade,

    deleteTrade,
    deleteAccountTrade,

    reloadTrades,

    // --------------------------------------------------------
    // GLOBAL ACCOUNT
    // --------------------------------------------------------

    selectedAccountId,
    setSelectedAccountId,
  };

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useJournal() {
  const context =
    useContext(JournalContext);

  if (!context) {
    throw new Error(
      "useJournal must be used inside JournalProvider"
    );
  }

  return context;
}