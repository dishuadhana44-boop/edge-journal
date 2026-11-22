import { useRef, useState } from "react";

import useOrder from "../order-panel/context/useOrder";
import { useTrade } from "../../../context/TradeContext";
import {
  isPreMarketRoutineCompleteToday,
} from "../../../utils/preMarketRoutine";

const MIN_LOTS = 0.01;

function formatPrice(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value).toFixed(5)
    : "—";
}

export default function QuickTradeGrid({ onExecuted }) {
  const {
    symbol,
    bid,
    ask,
    setSide,
    sl,
    setSL,
    tp,
    setTP,
    manualLotSize,
    setManualLotSize,
    guardrails,
    tradingWindowOpen,
    tradingWindowStart,
    tradingWindowEnd,
  } = useOrder();

  const { executeTrade, getDailyGuardrailStatus } = useTrade();

  const [feedback, setFeedback] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const executionLock = useRef(false);

  // Quick trades always send an explicit volume: an empty field means the
  // auto-lot of the full order panel, which needs SL/TP and risk settings.
  const lots =
    manualLotSize === "" || !Number.isFinite(Number(manualLotSize))
      ? MIN_LOTS
      : Math.max(0, Number(manualLotSize));

  const setLots = (value) => {
    setManualLotSize(value === "" ? "" : Number(value));
  };

  const increaseLots = () => {
    setLots(Number((lots + 0.01).toFixed(2)));
  };

  const decreaseLots = () => {
    if (lots > MIN_LOTS) {
      setLots(Number((lots - 0.01).toFixed(2)));
    }
  };

  const blockReason = (orderSide, entryPrice) => {
    // ------------------------------------------------------------
    // PRE-MARKET ROUTINE LOCK
    // ------------------------------------------------------------

    if (!isPreMarketRoutineCompleteToday()) {
      return "Please complete your Pre-Market Routine before trading.";
    }

    // ------------------------------------------------------------
    // DAILY GUARDRAIL LOCK
    // ------------------------------------------------------------

    const dailyStatus = getDailyGuardrailStatus(guardrails);

    if (dailyStatus?.locked) {
      return dailyStatus.reason || "Daily trading limit reached.";
    }

    // ------------------------------------------------------------
    // TRADING WINDOW
    // ------------------------------------------------------------

    if (guardrails?.enabled !== false && !tradingWindowOpen) {
      return `Trading window is closed. Trading is allowed from ${tradingWindowStart} to ${tradingWindowEnd}.`;
    }

    // ------------------------------------------------------------
    // VOLUME
    // ------------------------------------------------------------

    if (!Number.isFinite(lots) || lots < MIN_LOTS) {
      return `Lot size must be at least ${MIN_LOTS}.`;
    }

    // ------------------------------------------------------------
    // LIVE PRICE
    // ------------------------------------------------------------

    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return `Live ${orderSide === "BUY" ? "Ask" : "Bid"} price is not available for ${symbol}.`;
    }

    // ------------------------------------------------------------
    // STOP LOSS / TAKE PROFIT GEOMETRY
    // ------------------------------------------------------------

    const stopLoss = Number(sl || 0);
    const takeProfit = Number(tp || 0);

    if (stopLoss < 0 || takeProfit < 0) {
      return "Stop Loss and Take Profit must be prices, not negative numbers.";
    }

    if (orderSide === "BUY") {
      if (stopLoss > 0 && stopLoss >= entryPrice) {
        return "For Buy orders, Stop Loss must be below Entry.";
      }

      if (takeProfit > 0 && takeProfit <= entryPrice) {
        return "For Buy orders, Take Profit must be above Entry.";
      }
    }

    if (orderSide === "SELL") {
      if (stopLoss > 0 && stopLoss <= entryPrice) {
        return "For Sell orders, Stop Loss must be above Entry.";
      }

      if (takeProfit > 0 && takeProfit >= entryPrice) {
        return "For Sell orders, Take Profit must be below Entry.";
      }
    }

    return null;
  };

  const submitQuickTrade = async (orderSide) => {
    if (executionLock.current || isExecuting) {
      return;
    }

    setFeedback(null);

    const entryPrice = Number(
      orderSide === "BUY" ? ask : bid
    );

    const reason = blockReason(orderSide, entryPrice);

    if (reason) {
      setFeedback({ type: "error", text: reason });
      return;
    }

    executionLock.current = true;
    setIsExecuting(true);

    try {
      setSide(orderSide === "BUY" ? "buy" : "sell");

      // Same payload shape the full order panel sends through TradeContext.
      const result = await executeTrade({
        symbol,
        side: orderSide,
        entry: entryPrice,
        quantity: lots,
        stopLoss: sl === "" || sl == null ? null : Number(sl),
        takeProfit: tp === "" || tp == null ? null : Number(tp),
        orderType: "Market",
        guardrails,
      });

      if (!result?.success) {
        setFeedback({
          type: "error",
          text:
            result?.error ||
            result?.message ||
            "Failed to place the order on the broker.",
        });

        return;
      }

      const brokerPrice = Number(
        result?.price ??
          result?.executionPrice ??
          result?.entryPrice ??
          entryPrice
      );

      setFeedback({
        type: "success",
        text:
          `${orderSide} ${lots} ${symbol} filled` +
          (Number.isFinite(brokerPrice)
            ? ` @ ${brokerPrice.toFixed(5)}`
            : ""),
      });

      onExecuted?.();
    } catch (error) {
      console.error("Quick trade execution failed:", error);

      setFeedback({
        type: "error",
        text:
          error?.message ||
          "Trade execution failed. Please try again.",
      });
    } finally {
      executionLock.current = false;
      setIsExecuting(false);
    }
  };

  const spreadValue =
    Number(ask) > 0 && Number(bid) > 0
      ? Number(ask) - Number(bid)
      : null;

  return (
    <div className="space-y-3">
      {feedback && (
        <div
          className={`
            rounded-xl
            border
            px-3
            py-2
            text-xs
            font-medium
            ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }
          `}
        >
          {feedback.text}
        </div>
      )}

      {/* ======================================================
          LIVE MARKET PRICE
      ====================================================== */}

      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-gray-500">
            Bid
            <span className="ml-1 font-semibold text-red-600 tabular-nums">
              {formatPrice(bid)}
            </span>
          </span>

          <span className="text-[11px] text-gray-500">
            Ask
            <span className="ml-1 font-semibold text-emerald-600 tabular-nums">
              {formatPrice(ask)}
            </span>
          </span>
        </div>

        <span className="text-[11px] text-gray-500">
          Spread
          <span className="ml-1 font-semibold text-gray-700 tabular-nums">
            {spreadValue == null
              ? "—"
              : `${(spreadValue * 100000).toFixed(1)} pts`}
          </span>
        </span>
      </div>

      {/* ======================================================
          BUY / LOTS / SELL
      ====================================================== */}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-3">
          {/* BUY */}
          <button
            type="button"
            onClick={() => submitQuickTrade("BUY")}
            disabled={isExecuting}
            className="
              flex
              flex-col
              items-center
              justify-center
              py-3
              bg-emerald-50
              hover:bg-emerald-500
              hover:text-white
              disabled:cursor-not-allowed
              disabled:opacity-50
              transition-all
              duration-200
            "
          >
            <span className="text-[10px] font-semibold uppercase">
              {isExecuting ? "..." : "Buy"}
            </span>

            <span className="mt-1 text-[12px] font-semibold">
              {formatPrice(ask)}
            </span>
          </button>

          {/* LOTS */}
          <div
            className="
              flex
              items-center
              justify-center
              gap-2
              border-x
              border-gray-200
              bg-white
              px-2
            "
          >
            <button
              type="button"
              onClick={decreaseLots}
              disabled={isExecuting}
              className="
                h-7
                w-7
                rounded-lg
                bg-gray-100
                hover:bg-gray-200
                disabled:cursor-not-allowed
                disabled:opacity-50
                text-lg
                font-semibold
                transition
              "
            >
              −
            </button>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={lots}
              disabled={isExecuting}
              onChange={(event) => {
                const value = event.target.value;
                setLots(value === "" ? "" : Number(value));
              }}
              className="
                w-12
                text-center
                font-semibold
                outline-none
                bg-transparent
                disabled:opacity-50
              "
            />

            <button
              type="button"
              onClick={increaseLots}
              disabled={isExecuting}
              className="
                h-7
                w-7
                rounded-lg
                bg-gray-100
                hover:bg-gray-200
                disabled:cursor-not-allowed
                disabled:opacity-50
                text-lg
                font-semibold
                transition
              "
            >
              +
            </button>
          </div>

          {/* SELL */}
          <button
            type="button"
            onClick={() => submitQuickTrade("SELL")}
            disabled={isExecuting}
            className="
              flex
              flex-col
              items-center
              justify-center
              py-3
              bg-red-50
              hover:bg-red-500
              hover:text-white
              disabled:cursor-not-allowed
              disabled:opacity-50
              transition-all
              duration-200
            "
          >
            <span className="text-[10px] font-semibold uppercase">
              {isExecuting ? "..." : "Sell"}
            </span>

            <span className="mt-1 text-[12px] font-semibold">
              {formatPrice(bid)}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================
          STOP LOSS / TAKE PROFIT
      ====================================================== */}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            Stop Loss
          </span>

          <input
            type="number"
            step="0.00001"
            value={sl}
            disabled={isExecuting}
            onChange={(event) => setSL(event.target.value)}
            placeholder="Optional price"
            className="
              mt-1
              w-full
              rounded-lg
              border
              border-gray-200
              px-2
              py-1.5
              text-sm
              outline-none
              focus:border-violet-400
              disabled:opacity-50
            "
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            Take Profit
          </span>

          <input
            type="number"
            step="0.00001"
            value={tp}
            disabled={isExecuting}
            onChange={(event) => setTP(event.target.value)}
            placeholder="Optional price"
            className="
              mt-1
              w-full
              rounded-lg
              border
              border-gray-200
              px-2
              py-1.5
              text-sm
              outline-none
              focus:border-violet-400
              disabled:opacity-50
            "
          />
        </label>
      </div>
    </div>
  );
}
