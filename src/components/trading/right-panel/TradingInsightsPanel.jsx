import { useEffect, useMemo, useState } from "react";

import {
  CircleCheck,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  List,
  Bell,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";

import { useTrade } from "../../../context/TradeContext";

/* ============================================================
   DEFAULT GUARDRAILS
   ============================================================ */

const DEFAULT_GUARDRAILS = {
  enabled: true,
  maxTradesPerDay: 10,
  maxDailyLoss: 3000,
  maxDailyProfit: 10000,

  // 24-hour internal format
  // Display will be 12-hour format.
  tradingWindowStart: "11:30",
  tradingWindowEnd: "19:30",
};

/* ============================================================
   DEFAULT WATCHLIST
   ============================================================ */

const DEFAULT_WATCHLIST = [];

/* ============================================================
   GUARDRAIL NORMALIZER
   ============================================================ */

const normalizeGuardrails = (saved) => {
  const parsed = saved && typeof saved === "object" ? saved : {};

  // Migrate the previous default window automatically.
  const oldDefaultWindow =
    parsed.tradingWindowStart === "10:30" &&
    parsed.tradingWindowEnd === "13:30";

  return {
    ...DEFAULT_GUARDRAILS,
    ...parsed,

    ...(oldDefaultWindow
      ? {
          tradingWindowStart: "11:30",
          tradingWindowEnd: "19:30",
        }
      : {}),
  };
};

/* ============================================================
   COMPONENT
   ============================================================ */

export default function TradingInsightsPanel() {
  const {
    openTrades = [],
    closedTrades = [],
  } = useTrade();
  /* ============================================================
     MT5 HISTORY
     ============================================================ */

  const [mt5History, setMt5History] = useState([]);
  const [mt5HistoryLoading, setMt5HistoryLoading] = useState(false);
  const [mt5HistoryError, setMt5HistoryError] = useState(null);

  /* ============================================================
     MAIN UI STATE
     ============================================================ */

  const [activeTab, setActiveTab] = useState("watchlist");
  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState(true);

  /* ============================================================
     WATCHLIST
     ============================================================ */

  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem("edgefloWatchlist");

      if (!saved) {
        return DEFAULT_WATCHLIST;
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed)
        ? parsed
        : DEFAULT_WATCHLIST;
    } catch (error) {
      console.error("Failed to load watchlist:", error);
      return DEFAULT_WATCHLIST;
    }
  });

  const [showWatchlistInput, setShowWatchlistInput] =
    useState(false);

  const [newSymbol, setNewSymbol] = useState("");

  /* ============================================================
     ALERTS
     ============================================================ */

  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem("edgefloAlerts");

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to load alerts:", error);
      return [];
    }
  });

  const [showAlertForm, setShowAlertForm] = useState(false);

  const [alertSymbol, setAlertSymbol] = useState("EURUSD");

  const [alertCondition, setAlertCondition] =
    useState("above");

  const [alertPrice, setAlertPrice] = useState("");

  /* ============================================================
     GUARDRAILS
     ============================================================ */

  const [guardrails, setGuardrails] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "tradingGuardrails"
      );

      if (!saved) {
        return DEFAULT_GUARDRAILS;
      }

      return normalizeGuardrails(JSON.parse(saved));
    } catch (error) {
      console.error("Failed to load guardrails:", error);
      return DEFAULT_GUARDRAILS;
    }
  });

  /* ============================================================
     SELECTED EDGE PLAN
     ============================================================ */

  const [selectedEdgePlan, setSelectedEdgePlan] =
    useState(null);

  /* ============================================================
     TRADE PLAN CHECKLIST
     ============================================================ */

  const [checkedItems, setCheckedItems] = useState({});

  /* ============================================================
     SAVE WATCHLIST
     ============================================================ */

  useEffect(() => {
    try {
      localStorage.setItem(
        "edgefloWatchlist",
        JSON.stringify(watchlist)
      );
    } catch (error) {
      console.error(
        "Failed to save watchlist:",
        error
      );
    }
  }, [watchlist]);

  /* ============================================================
     SAVE ALERTS
     ============================================================ */

  useEffect(() => {
    try {
      localStorage.setItem(
        "edgefloAlerts",
        JSON.stringify(alerts)
      );
    } catch (error) {
      console.error(
        "Failed to save alerts:",
        error
      );
    }
  }, [alerts]);

  /* ============================================================
     LOAD CHECKLIST STATE
     ============================================================ */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        "edgefloTradePlanChecklist"
      );

      if (!saved) {
        setCheckedItems({});
        return;
      }

      const parsed = JSON.parse(saved);

      setCheckedItems(
        parsed && typeof parsed === "object"
          ? parsed
          : {}
      );
    } catch (error) {
      console.error(
        "Failed to load trade plan checklist:",
        error
      );

      setCheckedItems({});
    }
  }, []);

  /* ============================================================
     SAVE CHECKLIST STATE
     ============================================================ */

  useEffect(() => {
    try {
      localStorage.setItem(
        "edgefloTradePlanChecklist",
        JSON.stringify(checkedItems)
      );
    } catch (error) {
      console.error(
        "Failed to save trade plan checklist:",
        error
      );
    }
  }, [checkedItems]);

  /* ============================================================
     LOAD SELECTED EDGE PLAN
     ============================================================ */

  useEffect(() => {
    const loadSelectedPlan = () => {
      try {
        const saved = localStorage.getItem(
          "selectedEdgePlan"
        );

        setSelectedEdgePlan(
          saved ? JSON.parse(saved) : null
        );
      } catch (error) {
        console.error(
          "Failed to load selected Edge plan:",
          error
        );

        setSelectedEdgePlan(null);
      }
    };

    loadSelectedPlan();

    window.addEventListener(
      "selectedEdgePlanUpdated",
      loadSelectedPlan
    );

    window.addEventListener(
      "storage",
      loadSelectedPlan
    );

    return () => {
      window.removeEventListener(
        "selectedEdgePlanUpdated",
        loadSelectedPlan
      );

      window.removeEventListener(
        "storage",
        loadSelectedPlan
      );
    };
  }, []);

  /* ============================================================
     LOAD GUARDRAILS
     ============================================================ */

  useEffect(() => {
    const loadGuardrails = () => {
      try {
        const saved = localStorage.getItem(
          "tradingGuardrails"
        );

        if (!saved) {
          setGuardrails(DEFAULT_GUARDRAILS);
          return;
        }

        const normalized = normalizeGuardrails(
          JSON.parse(saved)
        );

        setGuardrails(normalized);

        // Save migrated values so they persist.
        localStorage.setItem(
          "tradingGuardrails",
          JSON.stringify(normalized)
        );
      } catch (error) {
        console.error(
          "Failed to load guardrails:",
          error
        );
      }
    };

    loadGuardrails();

    window.addEventListener(
      "storage",
      loadGuardrails
    );

    window.addEventListener(
      "guardrailsUpdated",
      loadGuardrails
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadGuardrails
      );

      window.removeEventListener(
        "guardrailsUpdated",
        loadGuardrails
      );
    };
  }, []);

  /* ============================================================
     LOAD MT5 TRADE HISTORY
     ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const loadMT5History = async () => {
      try {
        setMt5HistoryLoading(true);
        setMt5HistoryError(null);

        const response = await fetch(
          "http://localhost:4000/api/mt5/history?days=1"
        );

        if (!response.ok) {
          throw new Error(
            `MT5 history request failed: ${response.status}`
          );
        }

        const data = await response.json();

        if (cancelled) {
          return;
        }

        const history = Array.isArray(data)
          ? data
          : Array.isArray(data.history)
          ? data.history
          : Array.isArray(data.deals)
          ? data.deals
          : [];

        setMt5History(history);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load MT5 history:",
          error
        );

        setMt5HistoryError(
          error?.message ||
            "Unable to load MT5 history."
        );

        setMt5History([]);
      } finally {
        if (!cancelled) {
          setMt5HistoryLoading(false);
        }
      }
    };

    loadMT5History();

    const interval = setInterval(
      loadMT5History,
      5000
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

 /* ============================================================
   TODAY'S TRADES - LOCAL + MT5 HISTORY
============================================================ */

const allTrades = useMemo(() => {
  const combinedTrades = [
    ...openTrades,
    ...closedTrades,
    ...mt5History,
  ];

  const uniqueTrades = Array.from(
    new Map(
      combinedTrades.map((trade, index) => {
        const tradeId =
          trade.id ??
          trade.ticket ??
          trade.deal ??
          `trade-${index}`;

        return [String(tradeId), trade];
      })
    ).values()
  );

  return uniqueTrades;
}, [
  openTrades,
  closedTrades,
  mt5History,
]);

const getTradeDate = (trade) => {
  const dateValue =
    trade.closedAt ??
    trade.closeTime ??
    trade.time ??
    trade.openedAt ??
    trade.openTime ??
    trade.createdAt ??
    trade.date ??
    trade.timestamp;

  if (!dateValue) {
    return null;
  }

  let date;

  if (
    typeof dateValue === "number" &&
    dateValue < 100000000000
  ) {
    date = new Date(dateValue * 1000);
  } else {
    date = new Date(dateValue);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const todayTrades = useMemo(() => {
  const today = new Date();

  return allTrades.filter((trade) => {
    const tradeDate = getTradeDate(trade);

    if (!tradeDate) {
      return false;
    }

    return (
      tradeDate.getFullYear() === today.getFullYear() &&
      tradeDate.getMonth() === today.getMonth() &&
      tradeDate.getDate() === today.getDate()
    );
  });
}, [allTrades]);

  /* ============================================================
     TRADE COUNT
     ============================================================ */

  const tradeCount = todayTrades.length;

  const maxTrades = Math.max(
    Number(guardrails.maxTradesPerDay) || 1,
    1
  );

  /* ============================================================
   TODAY'S NET P&L
============================================================ */

const dailyPnL = useMemo(() => {
  return todayTrades.reduce((total, trade) => {
    const pnlValue =
      trade.netProfit ??
      trade.netPnL ??
      trade.realizedPnL ??
      trade.profit ??
      trade.pnl ??
      trade.profitLoss ??
      0;

    const pnl = Number(pnlValue);

    if (!Number.isFinite(pnl)) {
      return total;
    }

    return total + pnl;
  }, 0);
}, [todayTrades]);
  /* ============================================================
     GUARDRAIL LIMITS
     ============================================================ */

  const maxDailyLoss = Math.max(
    Number(guardrails.maxDailyLoss) || 0,
    0
  );

  const maxDailyProfit = Math.max(
    Number(guardrails.maxDailyProfit) || 0,
    0
  );

  /* ============================================================
     P&L PROGRESS
     ============================================================ */

  const lossProgress =
    maxDailyLoss > 0
      ? Math.min(
          Math.abs(Math.min(dailyPnL, 0)) /
            maxDailyLoss,
          1
        )
      : 0;

  const profitProgress =
    maxDailyProfit > 0
      ? Math.min(
          Math.max(dailyPnL, 0) /
            maxDailyProfit,
          1
        )
      : 0;

  /* ============================================================
     FORMATTERS
     ============================================================ */

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  const formatCompactMoney = (value) => {
    const number = Number(value || 0);

    if (number >= 1000000) {
      return `$${(number / 1000000).toFixed(1)}M`;
    }

    if (number >= 1000) {
      return `$${(number / 1000).toFixed(1)}K`;
    }

    return `$${formatMoney(number)}`;
  };

  const formatPnL = (value) => {
    const number = Number(value || 0);

    if (number > 0) {
      return `+$${formatMoney(number)}`;
    }

    if (number < 0) {
      return `-$${formatMoney(Math.abs(number))}`;
    }

    return "$0.00";
  };

  /* ============================================================
     12-HOUR TIME FORMATTER
     ============================================================ */

  const formatTime12Hour = (time) => {
    if (!time) {
      return "--";
    }

    const [hours, minutes] = String(time)
      .split(":")
      .map(Number);

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return time;
    }

    const period = hours >= 12 ? "PM" : "AM";

    const hour12 = hours % 12 || 12;

    return `${hour12}:${String(minutes).padStart(
      2,
      "0"
    )} ${period}`;
  };

  /* ============================================================
     TRADING WINDOW
     Uses user's local/system timezone.
     Internal values remain 24-hour format.
     Display uses 12-hour format.
     ============================================================ */

  const isTradingWindowOpen = () => {
    if (!guardrails.enabled) {
      return true;
    }

    const now = new Date();

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    const [
      startHour,
      startMinute,
    ] = (
      guardrails.tradingWindowStart ||
      "11:30"
    )
      .split(":")
      .map(Number);

    const [
      endHour,
      endMinute,
    ] = (
      guardrails.tradingWindowEnd ||
      "19:30"
    )
      .split(":")
      .map(Number);

    const startMinutes =
      startHour * 60 +
      startMinute;

    const endMinutes =
      endHour * 60 +
      endMinute;

    /* NORMAL WINDOW */

    if (startMinutes <= endMinutes) {
      return (
        currentMinutes >= startMinutes &&
        currentMinutes <= endMinutes
      );
    }

    /* OVERNIGHT WINDOW */

    return (
      currentMinutes >= startMinutes ||
      currentMinutes <= endMinutes
    );
  };

  const tradingWindowOpen =
    isTradingWindowOpen();

  /* ============================================================
   RULE VIOLATION
============================================================ */

const ruleViolation = useMemo(() => {
  if (!guardrails.enabled) {
    return null;
  }

  if (
    maxDailyLoss > 0 &&
    dailyPnL <= -maxDailyLoss
  ) {
    return `MAX LOSS HIT: ${formatPnL(dailyPnL)}`;
  }

  if (
    maxDailyProfit > 0 &&
    dailyPnL >= maxDailyProfit
  ) {
    return `DAILY P&L HIT: ${formatPnL(dailyPnL)}`;
  }

  if (
    maxTrades > 0 &&
    tradeCount >= maxTrades
  ) {
    return `DAILY TRADE LIMIT HIT: ${tradeCount}/${maxTrades}`;
  }

  if (!tradingWindowOpen) {
    return "TRADING WINDOW CLOSED";
  }

  return null;
}, [
  guardrails.enabled,
  maxDailyLoss,
  maxDailyProfit,
  dailyPnL,
  maxTrades,
  tradeCount,
  tradingWindowOpen,
]);

  /* ============================================================
     WATCHLIST FUNCTIONS
     ============================================================ */

  const addToWatchlist = () => {
    const symbol = newSymbol
      .trim()
      .toUpperCase();

    if (!symbol) {
      return;
    }

    const alreadyExists = watchlist.some(
      (item) =>
        String(item.symbol).toUpperCase() ===
        symbol
    );

    if (alreadyExists) {
      setNewSymbol("");
      setShowWatchlistInput(false);
      return;
    }

    const item = {
      id: Date.now(),
      symbol,
      createdAt: new Date().toISOString(),
    };

    setWatchlist((previous) => [
      ...previous,
      item,
    ]);

    setNewSymbol("");
    setShowWatchlistInput(false);
  };

  const removeFromWatchlist = (id) => {
    setWatchlist((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );
  };

  const selectWatchlistSymbol = (symbol) => {
    try {
      localStorage.setItem(
        "selectedSymbol",
        symbol
      );
    } catch (error) {
      console.error(
        "Failed to save selected symbol:",
        error
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        "selectedSymbolUpdated",
        {
          detail: {
            symbol,
          },
        }
      )
    );
  };

  /* ============================================================
     ALERT FUNCTIONS
     ============================================================ */

  const addAlert = () => {
    const symbol = alertSymbol
      .trim()
      .toUpperCase();

    const price = Number(alertPrice);

    if (
      !symbol ||
      !Number.isFinite(price)
    ) {
      return;
    }

    const newAlert = {
      id: Date.now(),
      symbol,
      condition: alertCondition,
      price,
      active: true,
      createdAt: new Date().toISOString(),
    };

    setAlerts((previous) => [
      ...previous,
      newAlert,
    ]);

    setAlertPrice("");
    setShowAlertForm(false);
  };

  const removeAlert = (id) => {
    setAlerts((previous) =>
      previous.filter(
        (alert) => alert.id !== id
      )
    );
  };

  /* ============================================================
     TRADE PLAN FUNCTIONS
     ============================================================ */

  const getChecklistItems = (value) => {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (
            typeof item === "object" &&
            item !== null
          ) {
            return (
              item.text ??
              item.title ??
              item.name ??
              item.description ??
              ""
            );
          }

          return "";
        })
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split("\n")
        .map((item) =>
          item
            .replace(/^[-•*]\s*/, "")
            .trim()
        )
        .filter(Boolean);
    }

    return [];
  };

  const toggleChecklistItem = (key) => {
    setCheckedItems((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  /* ============================================================
     TRADE PLAN SECTION
     ============================================================ */

  const TradePlanSection = ({
    title,
    items,
    sectionKey,
  }) => {
    if (!items.length) {
      return null;
    }

    return (
      <div
        className="
          rounded-xl
          border
          border-gray-200
          bg-gray-50
          p-3
        "
      >
        <p
          className="
            text-[11px]
            font-semibold
            text-gray-800
            mb-3
          "
        >
          {title}
        </p>

        <div className="space-y-2">
          {items.map((item, index) => {
            const key = `${sectionKey}-${index}`;

            return (
              <label
                key={key}
                className="
                  flex
                  items-start
                  gap-2
                  cursor-pointer
                "
              >
                <input
                  type="checkbox"
                  checked={!!checkedItems[key]}
                  onChange={() =>
                    toggleChecklistItem(key)
                  }
                  className="
                    mt-[2px]
                    accent-violet-600
                  "
                />

                <span
                  className={`
                    text-[11px]
                    leading-relaxed
                    ${
                      checkedItems[key]
                        ? "text-gray-400 line-through"
                        : "text-gray-700"
                    }
                  `}
                >
                  {item}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  /* ============================================================
     UI
     ============================================================ */

  return (
    <div
      className="
        w-full
        h-full
        min-h-0
        flex
        flex-col
        gap-1
      "
    >
      {/* ======================================================
          GUARDRAILS
          ====================================================== */}

      <div
        className="
          shrink-0
          w-full
          rounded-2xl
          border
          border-violet-100
          bg-[#faf9ff]
          shadow-[0_2px_12px_rgba(0,0,0,0.05)]
          overflow-hidden
        "
      >
        <div className="px-4 py-4">
          {/* HEADER */}

          <div
            className="
              flex
              items-center
              justify-between
            "
          >
            <div
              className="
                flex
                items-center
                gap-5
                min-w-0
              "
            >
              <h3
                className="
                  text-[13px]
                  font-semibold
                  text-gray-900
                "
              >
                Trades Today
              </h3>

              {/* DYNAMIC TRADE COUNT */}

              <span
                className="
                  text-[12px]
                  font-semibold
                  text-violet-600
                "
              >
                {tradeCount}/{maxTrades}
              </span>

              {/* TRADE DOTS */}

              <div className="flex gap-2">
                {Array.from({
                  length: Math.min(
                    maxTrades,
                    8
                  ),
                }).map((_, index) => (
                  <span
                    key={index}
                    className={`
                      w-[7px]
                      h-[7px]
                      rounded-full
                      ${
                        index < tradeCount
                          ? "bg-violet-500"
                          : "bg-gray-200"
                      }
                    `}
                  />
                ))}
              </div>

              <span
                className="
                  text-[10px]
                  text-gray-500
                "
              >
                Daily limit
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setIsGuardrailsOpen(
                  !isGuardrailsOpen
                )
              }
              className="
                w-7
                h-7
                rounded-lg
                flex
                items-center
                justify-center
                text-gray-400
                hover:bg-gray-100
                transition
              "
            >
              {isGuardrailsOpen ? (
                <ChevronUp size={15} />
              ) : (
                <ChevronDown size={15} />
              )}
            </button>
          </div>

          {/* CONTENT */}

          {isGuardrailsOpen && (
            <>
              {/* TRADING WINDOW */}

              <div className="mt-4">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >
                  <span
                    className="
                      text-[11px]
                      uppercase
                      tracking-wide
                      font-medium
                      text-gray-800
                    "
                  >
                    Trading Window
                  </span>

                  <span
                    className={`
                      px-2
                      py-0.5
                      rounded-full
                      border
                      text-[10px]
                      font-medium
                      ${
                        tradingWindowOpen
                          ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                          : "bg-red-50 border-red-100 text-red-600"
                      }
                    `}
                  >
                    {tradingWindowOpen
                      ? "Open"
                      : "Closed"}
                  </span>
                </div>

                {/* 12-HOUR DISPLAY */}

                <p
                  className="
                    mt-1
                    text-[12px]
                    font-medium
                    text-gray-900
                  "
                >
                {formatTime12Hour(
  guardrails.tradingWindowStart
)}{" "}
-{" "}
{formatTime12Hour(
  guardrails.tradingWindowEnd
)}
                </p>
              </div>

              {/* PNL */}

              <div className="mt-5">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >
                  <p
                    className="
                      text-[11px]
                      uppercase
                      tracking-wide
                      font-medium
                      text-gray-800
                    "
                  >
                    Today's Net P&L
                  </p>

                  <p
                    className={`
                      text-[13px]
                      font-semibold
                      ${
                        dailyPnL < 0
                          ? "text-red-500"
                          : dailyPnL > 0
                          ? "text-emerald-500"
                          : "text-gray-900"
                      }
                    `}
                  >
                    {formatPnL(dailyPnL)}
                  </p>
                </div>

                <div className="mt-1">
                  <div
                    className="
                      relative
                      w-full
                      h-[8px]
                      rounded-full
                      bg-gray-100
                      overflow-visible
                    "
                  >
                    {dailyPnL < 0 && (
                      <div
                        className="
                          absolute
                          right-1/2
                          top-0
                          h-full
                          bg-red-400
                          rounded-l-full
                        "
                        style={{
                          width: `${
                            lossProgress * 50
                          }%`,
                        }}
                      />
                    )}

                    {dailyPnL > 0 && (
                      <div
                        className="
                          absolute
                          left-1/2
                          top-0
                          h-full
                          bg-emerald-400
                          rounded-r-full
                        "
                        style={{
                          width: `${
                            profitProgress * 50
                          }%`,
                        }}
                      />
                    )}

                    <div
                      className="
                        absolute
                        left-1/2
                        top-1/2
                        -translate-x-1/2
                        -translate-y-1/2
                        w-[2px]
                        h-[13px]
                        bg-gray-400
                      "
                    />
                  </div>

                  <div
                    className="
                      mt-1
                      flex
                      justify-between
                      text-[9px]
                    "
                  >
                    <span className="text-gray-500">
                      -
                      {formatCompactMoney(
                        maxDailyLoss
                      )}
                    </span>

                    <span className="text-gray-400">
                      $0
                    </span>

                    <span className="text-gray-500">
                      +
                      {formatCompactMoney(
                        maxDailyProfit
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* LIMITS */}

              <div
                className="
                  grid
                  grid-cols-2
                  gap-4
                  mt-5
                "
              >
                <div>
                  <p
                    className="
                      text-[11px]
                      uppercase
                      tracking-wide
                      font-medium
                      text-gray-800
                    "
                  >
                    Max Loss
                  </p>

                  <p
                    className="
                      mt-1
                      text-[12px]
                      font-semibold
                      text-gray-900
                    "
                  >
                    {formatCompactMoney(
                      maxDailyLoss
                    )}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-[11px]
                      uppercase
                      tracking-wide
                      font-medium
                      text-gray-800
                    "
                  >
                    Daily Target
                  </p>

                  <p
                    className="
                      mt-1
                      text-[12px]
                      font-semibold
                      text-gray-900
                    "
                  >
                    {formatCompactMoney(
                      maxDailyProfit
                    )}
                  </p>
                </div>
              </div>

              {/* RULE STATUS */}

              <div
                className={`
                  mt-3
                  flex
                  items-center
                  gap-3
                  rounded-lg
                  border
                  px-3
                  py-2.5
                  ${
                    ruleViolation
                      ? "bg-red-50 border-red-100"
                      : "bg-emerald-50 border-emerald-100"
                  }
                `}
              >
                {ruleViolation ? (
                  <>
                    <AlertTriangle
                      size={14}
                      className="
                        text-red-500
                        shrink-0
                      "
                    />

                    <span
                      className="
                        text-[11px]
                        font-medium
                        text-red-600
                      "
                    >
                      {ruleViolation}
                    </span>
                  </>
                ) : (
                  <>
                    <CircleCheck
                      size={14}
                      className="
                        text-emerald-500
                        shrink-0
                      "
                    />

                    <span
                      className="
                        text-[11px]
                        font-medium
                        text-emerald-600
                      "
                    >
                      No rule violations today
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ======================================================
          BOTTOM PANEL
          ====================================================== */}

      <div
        className="
          flex-1
          min-h-0
          h-full
          w-full
          rounded-2xl
          border
          border-gray-200
          bg-white
          shadow-[0_2px_12px_rgba(0,0,0,0.05)]
          overflow-hidden
          flex
          flex-col
        "
      >
        {/* TABS */}

        <div
          className="
            shrink-0
            grid
            grid-cols-3
            border-b
            border-gray-200
          "
        >
          {/* WATCHLIST TAB */}

          <button
            type="button"
            onClick={() =>
              setActiveTab("watchlist")
            }
            className={`
              relative
              h-12
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              ${
                activeTab === "watchlist"
                  ? "text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            <List size={15} />

            Watchlist

            {activeTab === "watchlist" && (
              <span
                className="
                  absolute
                  bottom-0
                  left-3
                  right-3
                  h-[2px]
                  bg-violet-600
                "
              />
            )}
          </button>

          {/* ALERTS TAB */}

          <button
            type="button"
            onClick={() =>
              setActiveTab("alerts")
            }
            className={`
              relative
              h-12
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              ${
                activeTab === "alerts"
                  ? "text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            <Bell size={15} />

            Alerts

            {activeTab === "alerts" && (
              <span
                className="
                  absolute
                  bottom-0
                  left-3
                  right-3
                  h-[2px]
                  bg-violet-600
                "
              />
            )}
          </button>

          {/* TRADE PLAN TAB */}

          <button
            type="button"
            onClick={() =>
              setActiveTab("tradeplan")
            }
            className={`
              relative
              h-12
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              ${
                activeTab === "tradeplan"
                  ? "text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            <ClipboardList size={15} />

            Trade Plan

            {activeTab === "tradeplan" && (
              <span
                className="
                  absolute
                  bottom-0
                  left-3
                  right-3
                  h-[2px]
                  bg-violet-600
                "
              />
            )}
          </button>
        </div>

        {/* TAB CONTENT */}

        <div
          className="
            flex-1
            min-h-0
            overflow-y-auto
            p-4
          "
        >
          {/* ==================================================
              WATCHLIST
              ================================================== */}

          {activeTab === "watchlist" && (
            <div>
              <div
                className="
                  flex
                  items-center
                  justify-between
                  mb-3
                "
              >
                <h3
                  className="
                    text-[12px]
                    font-semibold
                    text-gray-900
                  "
                >
                  Watchlist
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setShowWatchlistInput(
                      !showWatchlistInput
                    )
                  }
                  className="
                    flex
                    items-center
                    gap-1
                    px-3
                    py-1.5
                    rounded-lg
                    bg-violet-50
                    text-violet-600
                    text-[10px]
                    font-medium
                  "
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>

              {/* ADD SYMBOL */}

              {showWatchlistInput && (
                <div
                  className="
                    flex
                    gap-2
                    mb-3
                  "
                >
                  <input
                    value={newSymbol}
                    onChange={(event) =>
                      setNewSymbol(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter"
                      ) {
                        addToWatchlist();
                      }
                    }}
                    placeholder="EURUSD"
                    className="
                      flex-1
                      px-3
                      py-2
                      rounded-lg
                      border
                      border-gray-200
                      text-[11px]
                      outline-none
                      focus:border-violet-400
                    "
                  />

                  <button
                    type="button"
                    onClick={addToWatchlist}
                    className="
                      px-3
                      rounded-lg
                      bg-violet-600
                      text-white
                      text-[11px]
                    "
                  >
                    Add
                  </button>
                </div>
              )}

              {/* EMPTY */}

              {watchlist.length === 0 && (
                <div
                  className="
                    min-h-[115px]
                    rounded-xl
                    border
                    border-dashed
                    border-gray-200
                    flex
                    flex-col
                    items-center
                    justify-center
                  "
                >
                  <List
                    size={20}
                    className="
                      text-gray-300
                      mb-2
                    "
                  />

                  <p
                    className="
                      text-[11px]
                      text-gray-500
                    "
                  >
                    No instruments in your
                    watchlist
                  </p>
                </div>
              )}

              {/* WATCHLIST ITEMS */}

              <div className="space-y-2">
                {watchlist.map((item) => (
                  <div
                    key={item.id}
                    className="
                      flex
                      items-center
                      justify-between
                      px-3
                      py-2.5
                      rounded-xl
                      border
                      border-gray-100
                      hover:border-violet-200
                      transition
                    "
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectWatchlistSymbol(
                          item.symbol
                        )
                      }
                      className="
                        text-[12px]
                        font-semibold
                        text-gray-800
                        hover:text-violet-600
                      "
                    >
                      {item.symbol}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        removeFromWatchlist(
                          item.id
                        )
                      }
                      className="
                        text-gray-400
                        hover:text-red-500
                      "
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================
              ALERTS
              ================================================== */}

          {activeTab === "alerts" && (
            <div>
              <div
                className="
                  flex
                  items-center
                  justify-between
                  mb-3
                "
              >
                <h3
                  className="
                    text-[12px]
                    font-semibold
                    text-gray-900
                  "
                >
                  Alerts
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setShowAlertForm(
                      !showAlertForm
                    )
                  }
                  className="
                    flex
                    items-center
                    gap-1
                    px-3
                    py-1.5
                    rounded-lg
                    bg-violet-50
                    text-violet-600
                    text-[10px]
                    font-medium
                  "
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>

              {/* ALERT FORM */}

              {showAlertForm && (
                <div
                  className="
                    mb-4
                    p-3
                    rounded-xl
                    bg-gray-50
                    border
                    border-gray-200
                    space-y-2
                  "
                >
                  <input
                    value={alertSymbol}
                    onChange={(event) =>
                      setAlertSymbol(
                        event.target.value
                      )
                    }
                    placeholder="Symbol"
                    className="
                      w-full
                      px-3
                      py-2
                      rounded-lg
                      border
                      border-gray-200
                      text-[11px]
                    "
                  />

                  <div className="flex gap-2">
                    <select
                      value={alertCondition}
                      onChange={(event) =>
                        setAlertCondition(
                          event.target.value
                        )
                      }
                      className="
                        flex-1
                        px-2
                        py-2
                        rounded-lg
                        border
                        border-gray-200
                        text-[11px]
                      "
                    >
                      <option value="above">
                        Above
                      </option>

                      <option value="below">
                        Below
                      </option>
                    </select>

                    <input
                      type="number"
                      value={alertPrice}
                      onChange={(event) =>
                        setAlertPrice(
                          event.target.value
                        )
                      }
                      placeholder="Price"
                      className="
                        flex-1
                        px-3
                        py-2
                        rounded-lg
                        border
                        border-gray-200
                        text-[11px]
                      "
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addAlert}
                    className="
                      w-full
                      py-2
                      rounded-lg
                      bg-violet-600
                      text-white
                      text-[11px]
                      font-medium
                    "
                  >
                    Create Alert
                  </button>
                </div>
              )}

              {/* EMPTY */}

              {alerts.length === 0 && (
                <div
                  className="
                    min-h-[115px]
                    rounded-xl
                    border
                    border-dashed
                    border-gray-200
                    flex
                    flex-col
                    items-center
                    justify-center
                  "
                >
                  <Bell
                    size={20}
                    className="
                      text-gray-300
                      mb-2
                    "
                  />

                  <p
                    className="
                      text-[11px]
                      text-gray-500
                    "
                  >
                    No active alerts
                  </p>
                </div>
              )}

              {/* ALERT LIST */}

              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="
                      flex
                      items-center
                      justify-between
                      p-3
                      rounded-xl
                      border
                      border-gray-100
                    "
                  >
                    <div>
                      <p
                        className="
                          text-[12px]
                          font-semibold
                          text-gray-800
                        "
                      >
                        {alert.symbol}
                      </p>

                      <p
                        className="
                          mt-1
                          text-[10px]
                          text-gray-500
                        "
                      >
                        {alert.condition ===
                        "above"
                          ? "Above"
                          : "Below"}{" "}
                        {alert.price}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeAlert(
                          alert.id
                        )
                      }
                      className="
                        text-gray-400
                        hover:text-red-500
                      "
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================
              TRADE PLAN
              ================================================== */}

          {activeTab === "tradeplan" && (
            <div>
              <div className="mb-0">
                <h3
                  className="
                    text-[12px]
                    font-semibold
                    text-gray-900
                  "
                >
                  Trade Plan
                </h3>

                {selectedEdgePlan?.name && (
                  <p
                    className="
                      mt-1
                      text-[10px]
                      text-violet-600
                    "
                  >
                    {selectedEdgePlan.name}
                  </p>
                )}
              </div>

              {!selectedEdgePlan ? (
                <div
                  className="
                    min-h-[115px]
                    rounded-xl
                    border
                    border-dashed
                    border-gray-200
                    flex
                    flex-col
                    items-center
                    justify-center
                    text-center
                  "
                >
                  <ClipboardList
                    size={20}
                    className="
                      text-gray-300
                      mb-2
                    "
                  />

                  <p
                    className="
                      text-[11px]
                      text-gray-500
                    "
                  >
                    Select a plan from Edge
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <TradePlanSection
                    title="Charting Process"
                    items={getChecklistItems(
                      selectedEdgePlan.chartingProcess
                    )}
                    sectionKey="charting"
                  />

                  <TradePlanSection
                    title="Entry Criteria"
                    items={getChecklistItems(
                      selectedEdgePlan.entryCriteria
                    )}
                    sectionKey="entry"
                  />

                  <TradePlanSection
                    title="Exit Criteria"
                    items={getChecklistItems(
                      selectedEdgePlan.exitCriteria
                    )}
                    sectionKey="exit"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}