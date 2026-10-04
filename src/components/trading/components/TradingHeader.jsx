import { useEffect, useState } from "react";
import {
  Zap,
  Info,
  ChevronsRight,
  PlayCircle,
  Lock,
  AlertCircle,
  X,
} from "lucide-react";

import { useUI } from "../../../context/UIContext";
import { useTrade } from "../../../context/TradeContext";
import PageHeader from "../../common/PageHeader";
import PreMarketRoutine from "./pre-market/PreMarketRoutine";

export default function TradingHeader() {
  // ============================================================
  // STATE
  // ============================================================

  const getTodayDate = () => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const PRE_MARKET_STORAGE_KEY =
    "edgeflo_pre_market_completed_date";

  const [preMarketCompleted, setPreMarketCompleted] =
    useState(() => {
      try {
        const savedDate = localStorage.getItem(
          PRE_MARKET_STORAGE_KEY
        );

        return savedDate === getTodayDate();
      } catch (error) {
        console.error(
          "Failed to load pre-market status:",
          error
        );

        return false;
      }
    });

  const [guardrails, setGuardrails] = useState(null);

  const [showLockModal, setShowLockModal] =
    useState(false);

  const [preMarketOpen, setPreMarketOpen] =
    useState(false);

  const [preMarketWarning, setPreMarketWarning] =
    useState(false);

  const [tradingWindowWarning, setTradingWindowWarning] =
    useState(false);

  // Used to refresh trading-window status in real time.
  const [currentTime, setCurrentTime] = useState(
    () => new Date()
  );

  // ============================================================
  // PERSIST PRE-MARKET ROUTINE STATUS
  // ============================================================

  useEffect(() => {
    try {
      if (preMarketCompleted) {
        localStorage.setItem(
          PRE_MARKET_STORAGE_KEY,
          getTodayDate()
        );
      } else {
        localStorage.removeItem(
          PRE_MARKET_STORAGE_KEY
        );
      }
    } catch (error) {
      console.error(
        "Failed to save pre-market status:",
        error
      );
    }
  }, [preMarketCompleted]);

  // ============================================================
  // UI CONTEXT
  // ============================================================

  const {
    setOrderOpen,
    setQuickOrderOpen,
    rightPanel,
    setRightPanel,
  } = useUI();

  // ============================================================
  // TRADE CONTEXT
  // ============================================================

  const {
    balance,
    floatingPnL,
    equity,
    getDailyGuardrailStatus,
  } = useTrade();

  // ============================================================
  // LOAD GUARDRAILS
  // ============================================================

  useEffect(() => {
    const loadGuardrails = () => {
      try {
        const saved = localStorage.getItem(
          "tradingGuardrails"
        );

        if (saved) {
          setGuardrails(JSON.parse(saved));
        } else {
          setGuardrails({
            enabled: true,
            maxTradesPerDay: 10,
            maxDailyLoss: 3000,
            maxDailyProfit: 10000,
            tradingWindowStart: "11:30",
            tradingWindowEnd: "19:30",
          });
        }
      } catch (error) {
        console.error(
          "Failed to load guardrails:",
          error
        );

        setGuardrails({
          enabled: true,
          maxTradesPerDay: 10,
          maxDailyLoss: 3000,
          maxDailyProfit: 10000,
          tradingWindowStart: "11:30",
          tradingWindowEnd: "19:30",
        });
      }
    };

    loadGuardrails();

    window.addEventListener(
      "guardrailsUpdated",
      loadGuardrails
    );

    window.addEventListener(
      "storage",
      loadGuardrails
    );

    return () => {
      window.removeEventListener(
        "guardrailsUpdated",
        loadGuardrails
      );

      window.removeEventListener(
        "storage",
        loadGuardrails
      );
    };
  }, []);

  // ============================================================
  // REAL-TIME CLOCK
  // ============================================================

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // FORMAT MONEY
  // ============================================================

  const formatMoney = (value) => {
    const number = Number(value || 0);

    return number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // ============================================================
  // FORMAT P&L
  // ============================================================

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

  // ============================================================
  // DAILY GUARDRAIL STATUS
  // ============================================================

  const dailyGuardrailStatus =
    typeof getDailyGuardrailStatus === "function"
      ? getDailyGuardrailStatus(guardrails)
      : {
          locked: false,
          reason: "",
          dailyPnL: 0,
          dailyTradeCount: 0,
        };

  const tradeLocked =
    dailyGuardrailStatus?.locked === true;

  const lockReason =
    dailyGuardrailStatus?.reason || "";

  // ============================================================
  // TRADING WINDOW
  // ============================================================

  const isTradingWindowOpen = () => {
    // If guardrails are disabled,
    // trading window is not enforced.
    if (
      !guardrails ||
      guardrails.enabled === false
    ) {
      return true;
    }

    const startTime =
      guardrails.tradingWindowStart || "11:30";

    const endTime =
      guardrails.tradingWindowEnd || "19:30";

    const [startHour, startMinute] = String(
      startTime
    )
      .split(":")
      .map(Number);

    const [endHour, endMinute] = String(
      endTime
    )
      .split(":")
      .map(Number);

    if (
      !Number.isFinite(startHour) ||
      !Number.isFinite(startMinute) ||
      !Number.isFinite(endHour) ||
      !Number.isFinite(endMinute)
    ) {
      return true;
    }

    const currentMinutes =
      currentTime.getHours() * 60 +
      currentTime.getMinutes();

    const startMinutes =
      startHour * 60 + startMinute;

    const endMinutes =
      endHour * 60 + endMinute;

    // Same start and end = closed window.
    if (startMinutes === endMinutes) {
      return false;
    }

    // Normal window.
    // Example: 11:30 -> 19:30
    if (startMinutes < endMinutes) {
      return (
        currentMinutes >= startMinutes &&
        currentMinutes < endMinutes
      );
    }

    // Overnight window.
    // Example: 22:00 -> 02:00
    return (
      currentMinutes >= startMinutes ||
      currentMinutes < endMinutes
    );
  };

  const tradingWindowOpen =
    isTradingWindowOpen();

  // ============================================================
  // FORMAT TRADING WINDOW
  // ============================================================

  const formatTime12Hour = (timeValue) => {
    if (!timeValue) {
      return "--";
    }

    const [hourString, minuteString] =
      String(timeValue).split(":");

    const hour = Number(hourString);
    const minute = Number(minuteString);

    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return String(timeValue);
    }

    const date = new Date();

    date.setHours(
      hour,
      minute,
      0,
      0
    );

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const tradingStart =
    guardrails?.tradingWindowStart ||
    "11:30";

  const tradingEnd =
    guardrails?.tradingWindowEnd ||
    "19:30";

  // ============================================================
  // PRE-MARKET WARNING
  // ============================================================

  const showPreMarketWarning = () => {
    setPreMarketWarning(true);

    setTimeout(() => {
      setPreMarketWarning(false);
    }, 3000);
  };

  // ============================================================
  // TRADING WINDOW WARNING
  // ============================================================

  const showTradingWindowWarning = () => {
    setTradingWindowWarning(true);

    setTimeout(() => {
      setTradingWindowWarning(false);
    }, 3000);
  };

  // ============================================================
  // TRADE BUTTON
  // ============================================================

  const handleTradeClick = () => {
    // ----------------------------------------------------------
    // 1. GUARDRAIL LOCK
    // ----------------------------------------------------------

    if (tradeLocked) {
      setShowLockModal(true);
      return;
    }

    // ----------------------------------------------------------
    // 2. TRADING WINDOW LOCK
    // ----------------------------------------------------------

    if (!isTradingWindowOpen()) {
      showTradingWindowWarning();
      return;
    }

    // ----------------------------------------------------------
    // 3. PRE-MARKET LOCK
    // ----------------------------------------------------------

    if (!preMarketCompleted) {
      setPreMarketOpen(true);
      setPreMarketWarning(true);
      return;
    }

    // ----------------------------------------------------------
    // 4. ALLOWED
    // ----------------------------------------------------------

    setRightPanel(false);
    setOrderOpen(true);
  };

  // ============================================================
  // QUICK ORDER BUTTON
  // ============================================================

  const handleQuickOrderClick = () => {
    // ----------------------------------------------------------
    // 1. GUARDRAIL LOCK
    // ----------------------------------------------------------

    if (tradeLocked) {
      setShowLockModal(true);
      return;
    }

    // ----------------------------------------------------------
    // 2. TRADING WINDOW LOCK
    // ----------------------------------------------------------

    if (!isTradingWindowOpen()) {
      showTradingWindowWarning();
      return;
    }

    // ----------------------------------------------------------
    // 3. PRE-MARKET LOCK
    // ----------------------------------------------------------

    if (!preMarketCompleted) {
      showPreMarketWarning();
      return;
    }

    // ----------------------------------------------------------
    // 4. ALLOWED
    // ----------------------------------------------------------

    setQuickOrderOpen(true);
  };

  // ============================================================
  // PRE-MARKET COMPLETE
  // ============================================================

  const handlePreMarketComplete = () => {
    setPreMarketCompleted(true);
    setPreMarketOpen(false);
    setPreMarketWarning(false);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between mb-0 w-full">
        {/* ====================================================
            LEFT
        ==================================================== */}

        <PageHeader
          title="Trading"
          subtitle="Execute and monitor your trading activity."
          icon="trading"
        />

        {/* ====================================================
            RIGHT
        ==================================================== */}

        <div className="flex items-center gap-3">
          {/* ==================================================
              BALANCE
          ================================================== */}

          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
              Balance
              <Info size={11} />
            </div>

            <span className="text-[14px] font-semibold text-black">
              ${formatMoney(balance)}
            </span>
          </div>

          <div className="h-10 w-px bg-gray-200" />

          {/* ==================================================
              OPEN P&L
          ================================================== */}

          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
              Open P&L
              <Info size={11} />
            </div>

            <span
              className={`text-[14px] font-semibold ${
                Number(floatingPnL) > 0
                  ? "text-emerald-500"
                  : Number(floatingPnL) < 0
                  ? "text-red-500"
                  : "text-gray-700"
              }`}
            >
              {formatPnL(floatingPnL)}
            </span>
          </div>

          <div className="h-10 w-px bg-gray-200" />

          {/* ==================================================
              EQUITY
          ================================================== */}

          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
              Equity
              <Info size={11} />
            </div>

            <span className="text-[14px] font-semibold text-black">
              ${formatMoney(equity)}
            </span>
          </div>

          {/* ==================================================
              QUICK ACTION
          ================================================== */}

          <button
            type="button"
            onClick={handleQuickOrderClick}
            title={
              tradeLocked
                ? "Trading is locked"
                : !tradingWindowOpen
                ? "Trading window is closed"
                : !preMarketCompleted
                ? "Complete Pre-Market Routine first"
                : "Quick Order"
            }
            className={`
              w-8
              h-8
              rounded-xl
              flex
              items-center
              justify-center
              transition-all
              duration-200
              ${
                tradingWindowOpen &&
                preMarketCompleted &&
                !tradeLocked
                  ? `
                    bg-violet-600
                    hover:bg-violet-700
                    hover:-translate-y-1
                    hover:shadow-lg
                  `
                  : `
                    bg-gray-400
                    cursor-not-allowed
                    opacity-80
                  `
              }
            `}
          >
            {tradeLocked ? (
              <Lock
                className="w-4 h-4 text-white"
                strokeWidth={2}
              />
            ) : (
              <Zap
                className="w-4 h-4 text-white"
                strokeWidth={2}
              />
            )}
          </button>

          {/* ==================================================
              TRADE BUTTON
          ================================================== */}

          <button
            type="button"
            onClick={handleTradeClick}
            title={
              tradeLocked
                ? lockReason || "Trading is locked"
                : !tradingWindowOpen
                ? "Trading window is closed"
                : !preMarketCompleted
                ? "Complete Pre-Market Routine first"
                : "Open Order Panel"
            }
            className={`
              h-9
              px-6
              rounded-xl
              flex
              items-center
              gap-2
              text-[14px]
              font-semibold
              text-white
              transition-all
              duration-200
              ${
                tradeLocked ||
                !tradingWindowOpen ||
                !preMarketCompleted
                  ? "bg-gray-400 cursor-pointer opacity-80 hover:bg-gray-500"
                  : "bg-emerald-500 hover:bg-emerald-600 hover:-translate-y-[1px] hover:shadow-md"
              }
            `}
          >
            {(
              tradeLocked ||
              !tradingWindowOpen ||
              !preMarketCompleted
            ) && <Lock size={14} />}

            Trade
          </button>

          {/* ==================================================
              PRE-MARKET ROUTINE
          ================================================== */}

          <button
            type="button"
            onClick={() => setPreMarketOpen(true)}
            className="
              h-9
              px-5
              flex
              items-center
              gap-2
              rounded-xl
              bg-violet-600
              hover:bg-violet-700
              text-white
              text-[14px]
              font-semibold
              transition-all
              duration-200
              hover:-translate-y-[2px]
              hover:shadow-md
            "
          >
            <PlayCircle size={16} />
            Pre-Market Routine
          </button>

          {/* ==================================================
              COLLAPSE
          ================================================== */}

          <button
            type="button"
            onClick={() => {
              setOrderOpen(false);

              setRightPanel(
                rightPanel === "insights"
                  ? false
                  : "insights"
              );
            }}
            className="
              w-10
              h-10
              rounded-xl
              flex
              items-center
              justify-center
              text-gray-500
              transition-all
              duration-200
              hover:bg-gray-100
              hover:text-black
              hover:-translate-y-[2px]
              hover:shadow-sm
            "
            title={
              rightPanel === "insights"
                ? "Show Order Panel"
                : "Open Trading Panel"
            }
          >
            <ChevronsRight
              className={`
                w-5
                h-5
                transition-transform
                duration-300
                ${
                  rightPanel === "insights"
                    ? "rotate-180"
                    : ""
                }
              `}
            />
          </button>
        </div>
      </div>

      {/* ======================================================
          GUARDRAIL LOCK MODAL
      ====================================================== */}

      {showLockModal && (
        <div
          className="
            fixed
            inset-0
            z-[999]
            flex
            items-center
            justify-center
            bg-black/20
            backdrop-blur-[2px]
          "
          onClick={() => setShowLockModal(false)}
        >
          <div
            className="
              w-[380px]
              rounded-2xl
              bg-white
              border
              border-gray-200
              shadow-[0_20px_60px_rgba(0,0,0,0.15)]
              p-5
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="
                    w-10
                    h-10
                    rounded-xl
                    bg-gray-100
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Lock
                    size={18}
                    className="text-gray-600"
                  />
                </div>

                <div>
                  <h3 className="text-[16px] font-semibold text-gray-900">
                    Trading Locked
                  </h3>

                  <p className="text-[12px] text-gray-500 mt-0.5">
                    Guardrail rule triggered
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowLockModal(false)
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
                  hover:text-gray-700
                "
              >
                <X size={16} />
              </button>
            </div>

            {/* REASON */}

            <div
              className="
                mt-5
                rounded-xl
                bg-red-50
                border
                border-red-100
                px-4
                py-3
              "
            >
              <p className="text-[11px] font-medium text-red-500 uppercase tracking-wide">
                Reason
              </p>

              <p className="mt-1 text-[13px] font-medium text-red-700">
                {lockReason ||
                  "One of your daily trading guardrails has been reached."}
              </p>
            </div>

            {/* INFO */}

            <p className="mt-4 text-[12px] leading-5 text-gray-500">
              Trading is disabled because one of your
              active guardrails has been reached. Review
              your trading rules before taking another
              trade.
            </p>

            {/* CLOSE */}

            <button
              type="button"
              onClick={() =>
                setShowLockModal(false)
              }
              className="
                mt-5
                w-full
                h-10
                rounded-xl
                bg-gray-900
                hover:bg-gray-800
                text-white
                text-[13px]
                font-semibold
                transition
              "
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          PRE-MARKET MODAL
      ====================================================== */}

      {preMarketOpen && (
        <PreMarketRoutine
          onClose={() => setPreMarketOpen(false)}
          onComplete={handlePreMarketComplete}
        />
      )}

      {/* ======================================================
          PRE-MARKET WARNING
      ====================================================== */}

      {preMarketWarning && (
        <div
          className="
            fixed
            top-6
            right-6
            z-[10000]
            w-[340px]
            flex
            items-center
            gap-3
            px-4
            py-3
            rounded-xl
            bg-white
            border
            border-amber-200
            shadow-xl
          "
        >
          <div
            className="
              w-9
              h-9
              shrink-0
              rounded-lg
              bg-amber-50
              flex
              items-center
              justify-center
              text-amber-600
            "
          >
            <AlertCircle size={18} />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              Trading Locked
            </div>

            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Please complete your Pre-Market Routine
              before trading.
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          TRADING WINDOW WARNING
      ====================================================== */}

      {tradingWindowWarning && (
        <div
          className="
            fixed
            top-6
            right-6
            z-[10000]
            w-[340px]
            flex
            items-center
            gap-3
            px-4
            py-3
            rounded-xl
            bg-white
            border
            border-red-200
            shadow-xl
          "
        >
          <div
            className="
              w-9
              h-9
              shrink-0
              rounded-lg
              bg-red-50
              flex
              items-center
              justify-center
              text-red-500
            "
          >
            <Lock size={18} />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              Trading Window Closed
            </div>

            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Trading is allowed from{" "}
              <span className="font-medium text-gray-700">
                {formatTime12Hour(tradingStart)}
              </span>{" "}
              to{" "}
              <span className="font-medium text-gray-700">
                {formatTime12Hour(tradingEnd)}
              </span>
              .
            </div>
          </div>
        </div>
      )}
    </>
  );
}