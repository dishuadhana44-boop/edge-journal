import { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  AlertTriangle,
  ChevronUp,
  List,
  Bell,
  ClipboardList,
  Plus,
  Trash2,
  X,
  Save,
} from "lucide-react";

import { useTrade } from "../../../context/TradeContext";

const DEFAULT_GUARDRAILS = {
  enabled: true,
  maxTradesPerDay: 10,
  maxDailyLoss: 500,
  maxDailyProfit: 1000,
  tradingWindowStart: "10:30",
  tradingWindowEnd: "13:30",
};

export default function TradingInsightsPanel() {
  const { trades = [] } = useTrade();

  const [activeTab, setActiveTab] = useState("watchlist");
  

  const [guardrails, setGuardrails] = useState(() => {
    try {
      const saved = localStorage.getItem("tradingGuardrails");

      return saved
        ? {
            ...DEFAULT_GUARDRAILS,
            ...JSON.parse(saved),
          }
        : DEFAULT_GUARDRAILS;
    } catch {
      return DEFAULT_GUARDRAILS;
    }
  });

  const [selectedPlan, setSelectedPlan] =
  useState(null);
  const [selectedEdgePlan, setSelectedEdgePlan] = useState(null);

  useEffect(() => {
    const loadSelectedPlan = () => {
      try {
        const saved = localStorage.getItem("selectedEdgePlan");
  
        setSelectedEdgePlan(
          saved ? JSON.parse(saved) : null
        );
      } catch (error) {
        console.error("Failed to load selected Edge plan:", error);
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

  const getChecklistItems = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item === "object") {
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

  /*
  ============================================================
  LOAD GUARDRAILS
  ============================================================
  */

  useEffect(() => {
    const loadGuardrails = () => {
      try {
        const saved = localStorage.getItem("tradingGuardrails");

        if (saved) {
          setGuardrails({
            ...DEFAULT_GUARDRAILS,
            ...JSON.parse(saved),
          });
        }
      } catch (error) {
        console.error("Failed to load guardrails:", error);
      }
    };

    loadGuardrails();

    window.addEventListener("storage", loadGuardrails);
    window.addEventListener("guardrailsUpdated", loadGuardrails);

    return () => {
      window.removeEventListener("storage", loadGuardrails);
      window.removeEventListener(
        "guardrailsUpdated",
        loadGuardrails
      );
    };
  }, []);

  /*
  ============================================================
  TODAY'S TRADES
  ============================================================
  */

  const todayTrades = useMemo(() => {
    const today = new Date();

    return trades.filter((trade) => {
      const dateValue =
        trade.date ??
        trade.createdAt ??
        trade.openedAt;

      if (!dateValue) return false;

      const tradeDate = new Date(dateValue);

      if (Number.isNaN(tradeDate.getTime())) {
        return false;
      }

      return (
        tradeDate.getFullYear() === today.getFullYear() &&
        tradeDate.getMonth() === today.getMonth() &&
        tradeDate.getDate() === today.getDate()
      );
    });
  }, [trades]);

  /*
  ============================================================
  TRADE COUNT
  ============================================================
  */

  const tradeCount = todayTrades.length;

  const maxTrades = Math.max(
    Number(guardrails.maxTradesPerDay) || 1,
    1
  );

  /*
  ============================================================
  DAILY P&L
  ============================================================
  */

  const dailyPnL = useMemo(() => {
    return todayTrades.reduce((total, trade) => {
      const pnl = Number(
        trade.pnl ??
          trade.profit ??
          trade.realizedPnL ??
          trade.netPnL ??
          0
      );

      return total + pnl;
    }, 0);
  }, [todayTrades]);

  /*
  ============================================================
  GUARDRAIL LIMITS
  ============================================================
  */

  const maxDailyLoss = Math.max(
    Number(guardrails.maxDailyLoss) || 0,
    0
  );

  const maxDailyProfit = Math.max(
    Number(guardrails.maxDailyProfit) || 0,
    0
  );

  /*
  ============================================================
  PROGRESS
  ============================================================
  */

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

  /*
  ============================================================
  FORMATTERS
  ============================================================
  */

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

  /*
  ============================================================
  RULE STATUS
  ============================================================
  */

  const ruleViolation = useMemo(() => {
    if (!guardrails.enabled) {
      return null;
    }

    if (
      maxTrades > 0 &&
      tradeCount >= maxTrades
    ) {
      return `Daily trade limit reached (${tradeCount}/${maxTrades}).`;
    }

    if (
      maxDailyLoss > 0 &&
      dailyPnL <= -maxDailyLoss
    ) {
      return `Maximum daily loss reached (${formatPnL(
        dailyPnL
      )}).`;
    }

    if (
      maxDailyProfit > 0 &&
      dailyPnL >= maxDailyProfit
    ) {
      return `Daily profit target reached (${formatPnL(
        dailyPnL
      )}).`;
    }

    return null;
  }, [
    guardrails.enabled,
    maxTrades,
    tradeCount,
    maxDailyLoss,
    maxDailyProfit,
    dailyPnL,
  ]);

  const tradingStart =
    guardrails.tradingWindowStart || "10:30";

  const tradingEnd =
    guardrails.tradingWindowEnd || "13:30";

  /*
  ============================================================
  UI
  ============================================================
  */

  return (
    <div
      className="
        w-full
        h-full
        flex
        flex-col
        gap-1
      "
    >

      {/* ======================================================
          PART 1 — GUARDRAILS CARD
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

        <div className="px-4 pt-4 pb-4">

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
                gap-2
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

              <span
                className="
                  text-[12px]
                  font-semibold
                  text-violet-600
                "
              >
                {tradeCount}/{maxTrades}
              </span>

              <div
                className="
                  flex
                  items-center
                  gap-1
                "
              >
                {Array.from({
                  length: maxTrades,
                }).map((_, index) => (
                  <span
                    key={index}
                    className={`
                      w-[7px]
                      h-[7px]
                      rounded-full
                      transition-all
                      duration-200
                      ${
                        index < tradeCount
                          ? "bg-red-400"
                          : "bg-gray-200"
                      }
                    `}
                  />
                ))}
              </div>

              <span
                className="
                  text-[11px]
                  text-gray-500
                  ml-1
                "
              >
                Daily limit
              </span>

            </div>

            <button
              type="button"
              className="
                w-6
                h-6
                rounded-md
                flex
                items-center
                justify-center
                text-gray-400
                hover:bg-gray-100
              "
            >
              <ChevronUp size={14} />
            </button>

          </div>


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
                className="
                  px-2
                  py-0.5
                  rounded-full
                  bg-violet-50
                  border
                  border-violet-100
                  text-violet-700
                  text-[10px]
                  font-medium
                "
              >
                Open
              </span>

            </div>

            <p
              className="
                mt-1
                text-[12px]
                font-medium
                text-gray-900
              "
            >
              {tradingStart} - {tradingEnd} (UTC)
            </p>

          </div>


          {/* P&L */}

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


            {/* CENTERED BAR */}

            <div className="mt-2">

              <div
                className="
                  relative
                  w-full
                  h-[9px]
                  rounded-full
                  bg-gray-100
                  overflow-hidden
                "
              >

                {/* LOSS */}

                {dailyPnL < 0 && (
                  <div
                    className="
                      absolute
                      right-1/2
                      top-0
                      h-full
                      bg-red-400
                      rounded-l-full
                      transition-all
                      duration-300
                    "
                    style={{
                      width: `${lossProgress * 50}%`,
                    }}
                  />
                )}

                {/* PROFIT */}

                {dailyPnL > 0 && (
                  <div
                    className="
                      absolute
                      left-1/2
                      top-0
                      h-full
                      bg-emerald-400
                      rounded-r-full
                      transition-all
                      duration-300
                    "
                    style={{
                      width: `${profitProgress * 50}%`,
                    }}
                  />
                )}

                {/* CENTER */}

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
                    rounded-full
                    z-10
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
                  -{formatCompactMoney(maxDailyLoss)}
                </span>

                <span className="text-gray-400">
                  $0
                </span>

                <span className="text-gray-500">
                  +{formatCompactMoney(maxDailyProfit)}
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
                {formatCompactMoney(maxDailyLoss)}
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
                {formatCompactMoney(maxDailyProfit)}
              </p>

            </div>

          </div>


          {/* RULE STATUS */}

          <div
            className={`
              mt-5
              flex
              items-center
              gap-2
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
                  className="text-red-500 shrink-0"
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

        </div>

      </div>


      {/* ======================================================
          PART 2 — WATCHLIST / ALERTS / TRADE PLAN
      ====================================================== */}

     <div
  className="
    flex-1
    min-h-[441px]
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
            bg-white
          "
        >

          {/* WATCHLIST */}

          <button
            type="button"
            onClick={() => setActiveTab("watchlist")}
            className={`
              relative
              h-12
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              transition
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
                  rounded-full
                "
              />
            )}

          </button>


          {/* ALERTS */}

          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`
              relative
              h-12
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              transition
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
                  rounded-full
                "
              />
            )}

          </button>


          {/* TRADE PLAN */}

          <button
            type="button"
            onClick={() => setActiveTab("tradeplan")}
            className={`
              relative
              h-12
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              transition
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
                  rounded-full
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

          {/* WATCHLIST */}

          {activeTab === "watchlist" && (
            <div className="h-full">

              <div
                className="
                  flex
                  items-center
                  justify-between
                  mb-2
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
                    hover:bg-violet-100
                    transition
                  "
                >
                  <Plus size={12} />
                  Add
                </button>

              </div>


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
                  No instruments in your watchlist
                </p>

              </div>

            </div>
          )}


          {/* ALERTS */}

          {activeTab === "alerts" && (
            <div className="h-full">

              <div
                className="
                  flex
                  items-center
                  justify-between
                  mb-2
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

              </div>

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

            </div>
          )}


          {/* TRADE PLAN */}

          {activeTab === "tradeplan" && (
  <div className="h-full">

    <div className="flex items-center justify-between mb-1">
      <h3 className="text-[12px] font-semibold text-gray-900">
        Trade Plan
      </h3>
    </div>

    {!selectedEdgePlan ? (
      <div className="
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
      ">
        <ClipboardList
          size={20}
          className="text-gray-300 mb-2"
        />

        <p className="text-[11px] text-gray-500">
          Select a plan from Edge
        </p>
      </div>
   ) : (

    <div className="space-y-2">
  
      {/* CHARTING PROCESS */}
  
      {selectedEdgePlan.chartingProcess?.length > 0 && (
  
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
              mb-2
            "
          >
            Charting Process
          </p>
  
          <div className="space-y-2">
  
            {selectedEdgePlan.chartingProcess.map(
              (item, index) => (
  
                <label
                  key={index}
                  className="
                    flex
                    items-start
                    gap-2
                    cursor-pointer
                  "
                >
  
                  <input
                    type="checkbox"
                    className="
                      mt-[2px]
                      accent-violet-600
                    "
                  />
  
                  <span
                    className="
                      text-[11px]
                      text-gray-700
                    "
                  >
                    {typeof item === "string"
                      ? item
                      : item.name ||
                        item.text ||
                        item.title}
                  </span>
  
                </label>
  
              )
            )}
  
          </div>
  
        </div>
  
      )}
  
  
      {/* ENTRY CRITERIA */}
  
      {selectedEdgePlan.entryCriteria?.length > 0 && (
  
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
              mb-2
            "
          >
            Entry Criteria
          </p>
  
          <div className="space-y-2">
  
            {selectedEdgePlan.entryCriteria.map(
              (item, index) => (
  
                <label
                  key={index}
                  className="
                    flex
                    items-start
                    gap-2
                    cursor-pointer
                  "
                >
  
                  <input
                    type="checkbox"
                    className="
                      mt-[2px]
                      accent-violet-600
                    "
                  />
  
                  <span
                    className="
                      text-[11px]
                      text-gray-700
                    "
                  >
                    {typeof item === "string"
                      ? item
                      : item.name ||
                        item.text ||
                        item.title}
                  </span>
  
                </label>
  
              )
            )}
  
          </div>
  
        </div>
  
      )}
  
  
      {/* EXIT CRITERIA */}
  
      {selectedEdgePlan.exitCriteria?.length > 0 && (
  
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
              mb-2
            "
          >
            Exit Criteria
          </p>
  
          <div className="space-y-2">
  
            {selectedEdgePlan.exitCriteria.map(
              (item, index) => (
  
                <label
                  key={index}
                  className="
                    flex
                    items-start
                    gap-2
                    cursor-pointer
                  "
                >
  
                  <input
                    type="checkbox"
                    className="
                      mt-[2px]
                      accent-violet-600
                    "
                  />
  
                  <span
                    className="
                      text-[11px]
                      text-gray-700
                    "
                  >
                    {typeof item === "string"
                      ? item
                      : item.name ||
                        item.text ||
                        item.title}
                  </span>
  
                </label>
  
              )
            )}
  
          </div>
  
        </div>
  
      )}
  
    </div>
  
  )}

  </div>
)}

        </div>

      </div>

    </div>
  );
}