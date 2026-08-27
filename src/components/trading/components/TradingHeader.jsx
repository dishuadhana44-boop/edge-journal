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
  const [preMarketOpen, setPreMarketOpen] = useState(false);

  const [tradeLocked, setTradeLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");
  
  const [guardrails, setGuardrails] = useState(null);
  
  const [showLockModal, setShowLockModal] = useState(false);
  
  const [preMarketCompleted, setPreMarketCompleted] = useState(false);
  const [preMarketWarning, setPreMarketWarning] = useState(false);

  const {
    orderOpen,
    setOrderOpen,
    quickOrderOpen,
    setQuickOrderOpen,
  
    rightPanel,
    setRightPanel,
  
  } = useUI();

  /*
  ============================================================
  LIVE ACCOUNT DATA
  ============================================================
  */

  const {
    balance,
    floatingPnL,
    equity,
    trades = [],
  } = useTrade();

  useEffect(() => {
    const loadGuardrails = () => {
      try {
        const saved = localStorage.getItem("tradingGuardrails");
  
        if (saved) {
          setGuardrails(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Failed to load guardrails:", error);
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

  /*
  ============================================================
  FORMAT MONEY
  ============================================================
  */

  const formatMoney = (value) => {
    const number = Number(value || 0);

    return number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /*
  ============================================================
  P&L FORMAT
  ============================================================
  */

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

  const today = new Date();

  const isToday = (date) => {
    const d = new Date(date);
  
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };
  
  const todaysTrades = trades.filter((trade) =>
    isToday(trade.date || trade.createdAt)
  );
  
  const todaysTradeCount = todaysTrades.length;
  
  const todaysNetPnL = todaysTrades.reduce(
    (total, trade) =>
      total + Number(
        trade.pnl ??
        trade.profit ??
        0
      ),
    0
  );

  useEffect(() => {

    if (!guardrails || guardrails.enabled === false) {
      setTradeLocked(false);
      setLockReason("");
      return;
    }
  
    const maxTrades =
      Number(guardrails.maxTradesPerDay || 0);
  
    const maxDailyLoss =
      Number(guardrails.maxDailyLoss || 0);
  
    const maxDailyProfit =
      Number(guardrails.maxDailyProfit || 0);
  
  
    /*
    ==========================================
    MAX TRADES
    ==========================================
    */
  
    if (
      maxTrades > 0 &&
      todaysTradeCount >= maxTrades
    ) {
      setTradeLocked(true);
  
      setLockReason(
        `Daily trade limit reached. You have taken ${todaysTradeCount} of ${maxTrades} allowed trades today.`
      );
  
      return;
    }
  
  
    /*
    ==========================================
    MAX DAILY LOSS
    ==========================================
    */
  
    if (
      maxDailyLoss > 0 &&
      todaysNetPnL <= -maxDailyLoss
    ) {
      setTradeLocked(true);
  
      setLockReason(
        `Maximum daily loss reached. Your P&L is ${formatPnL(todaysNetPnL)} and your limit is -$${maxDailyLoss.toFixed(2)}.`
      );
  
      return;
    }
  
  
    /*
    ==========================================
    MAX DAILY PROFIT
    ==========================================
    */
  
    if (
      maxDailyProfit > 0 &&
      todaysNetPnL >= maxDailyProfit
    ) {
      setTradeLocked(true);
  
      setLockReason(
        `Daily profit target reached. Your P&L is ${formatPnL(todaysNetPnL)} and your target is +$${maxDailyProfit.toFixed(2)}.`
      );
  
      return;
    }
  
  
    /*
    ==========================================
    NO BREACH
    ==========================================
    */
  
    setTradeLocked(false);
    setLockReason("");
  
  }, [
    guardrails,
    todaysTradeCount,
    todaysNetPnL,
  ]);

  /*
  ============================================================
  TRADE BUTTON
  ============================================================
  */

  const handleTradeClick = () => {
    // Pre-market incomplete
    if (!preMarketCompleted) {
      setPreMarketWarning(true);

      // Automatically hide warning
      setTimeout(() => {
        setPreMarketWarning(false);
      }, 3000);

      return;
    }

    // Pre-market completed
    setOrderOpen(true);
  };

  /*
  ============================================================
  PRE-MARKET COMPLETE
  ============================================================
  */

  const handlePreMarketComplete = () => {
    setPreMarketCompleted(true);
    setPreMarketOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-0 w-full">

        {/* ====================================================
            LEFT
        ==================================================== */}

        <PageHeader
          title="Trading"
          subtitle="Execute and monitor your trading activity."
          icon="trading"
        />

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
          onClick={() => setShowLockModal(false)}
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
          {lockReason}
        </p>

      </div>


      {/* INFO */}

      <p className="mt-4 text-[12px] leading-5 text-gray-500">
        Trading is disabled because one of your active
        guardrails has been reached. Review your trading
        rules before taking another trade.
      </p>


      {/* CLOSE */}

      <button
        onClick={() => setShowLockModal(false)}
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
  onClick={() => {
    if (!preMarketCompleted) {
      setPreMarketWarning(true);

      setTimeout(() => {
        setPreMarketWarning(false);
      }, 3000);

      return;
    }

    setQuickOrderOpen(true);
  }}
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
      preMarketCompleted
        ? `
          bg-violet-600
          hover:bg-violet-700
          hover:-translate-y-1
          hover:shadow-lg
        `
        : `
          bg-gray-400
          hover:bg-gray-500
        `
    }
  `}
>
  <Zap
    className="w-4 h-4 text-white"
    strokeWidth={2}
  />
</button>


          {/* ==================================================
              TRADE
          ================================================== */}

<button
  type="button"
  onClick={() => {

    // Guardrail lock
    if (tradeLocked) {
      setShowLockModal(true);
      return;
    }

    // Pre-market lock
    if (!preMarketCompleted) {

      setPreMarketWarning(true);

      setTimeout(() => {
        setPreMarketWarning(false);
      }, 3000);

      return;
    }

    setRightPanel(false);
    setOrderOpen(true);

  }}
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
      tradeLocked
        ? "bg-gray-400 hover:bg-gray-500 cursor-pointer"
        : preMarketCompleted
        ? "bg-emerald-500 hover:bg-emerald-600"
        : "bg-gray-400 hover:bg-gray-500"
    }
  `}
>
  {(tradeLocked || !preMarketCompleted) && (
    <Lock size={14} />
  )}

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
      w-5 h-5
      transition-transform duration-300
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

          {/* ICON */}

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


          {/* MESSAGE */}

          <div className="min-w-0">

            <div className="text-sm font-semibold text-gray-900">
              Trading Locked
            </div>

            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Please complete your Pre-Market Routine before trading.
            </div>

          </div>

        </div>
      )}

    </>
  );
}