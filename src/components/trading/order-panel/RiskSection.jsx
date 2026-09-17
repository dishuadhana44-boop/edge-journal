
import { useState } from "react";
import { Lock } from "lucide-react";

import useOrder from "./context/useOrder";
import { useTrade } from "../../../context/TradeContext";

function getCurrentTimeInMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time) {
  if (!time || !time.includes(":")) {
    return 0;
  }

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function isWithinTradingWindow(start, end) {
  const currentMinutes = getCurrentTimeInMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return (
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

  return (
    currentMinutes >= startMinutes ||
    currentMinutes < endMinutes
  );
}

export default function RiskSection() {
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState(null);

  const {
    risk,
    guardrails,
    riskAmount,
    rewardAmount,
    riskPips,
    rewardPips,
    rr,
    side,
    entry,
    effectiveEntry,
    sl,
    tp,
    orderType,
    lotSize,
    symbol,
    validation,
  } = useOrder();

  const {
    executeTrade,
    addPendingOrder,
    showTradeNotification,
  } = useTrade();

  const tradingWindowStart =
    guardrails?.tradingWindowStart || "11:30";

  const tradingWindowEnd =
    guardrails?.tradingWindowEnd || "19:30";

  const tradingWindowOpen =
    guardrails?.enabled === false
      ? true
      : isWithinTradingWindow(
          tradingWindowStart,
          tradingWindowEnd
        );

  const handleExecuteTrade = async () => {
    // ==========================================================
    // PREVENT DOUBLE CLICK
    // ==========================================================

    if (placingOrder) {
      return;
    }

    // ==========================================================
    // LIVE TRADING WINDOW CHECK
    // ==========================================================

    const latestTradingWindowOpen =
      guardrails?.enabled === false
        ? true
        : isWithinTradingWindow(
            tradingWindowStart,
            tradingWindowEnd
          );

    if (!latestTradingWindowOpen) {
      setOrderMessage({
        type: "error",
        text: `Trading window is closed. Trading is allowed from ${tradingWindowStart} to ${tradingWindowEnd}.`,
      });

      return;
    }

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!validation?.valid) {
      console.warn(
        "Order validation failed:",
        validation?.errors
      );

      setOrderMessage({
        type: "error",
        text:
          validation?.errors?.[0] ||
          "Please complete the order correctly.",
      });

      return;
    }

    setPlacingOrder(true);
    setOrderMessage(null);

    // ==========================================================
    // CREATE TRADE OBJECT
    // ==========================================================

    const trade = {
      symbol: String(symbol || "EURUSD")
        .trim()
        .toUpperCase(),

      side: String(side || "")
        .trim()
        .toLowerCase(),

      entry:
        orderType === "Market"
          ? Number(effectiveEntry)
          : Number(entry),

      stopLoss:
        sl !== null &&
        sl !== undefined &&
        sl !== ""
          ? Number(sl)
          : null,

      takeProfit:
        tp !== null &&
        tp !== undefined &&
        tp !== ""
          ? Number(tp)
          : null,

      quantity: Number(lotSize),
      risk: Number(risk),
      orderType,
    };

    try {
      // ========================================================
      // MARKET ORDER → MT5 THROUGH TRADE CONTEXT
      // ========================================================

      if (orderType === "Market") {
        console.log(
          "🚀 Sending MT5 market order:",
          trade
        );

        const result = await executeTrade(trade);

        console.log(
          "📩 MT5 order response:",
          result
        );

        if (!result?.success) {
          throw new Error(
            result?.error ||
              result?.message ||
              "Failed to place MT5 order."
          );
        }

        const rawBrokerPrice =
          result?.price ??
          result?.executionPrice ??
          result?.entryPrice ??
          trade.entry;

        const brokerPrice = Number(rawBrokerPrice);

        setOrderMessage({
          type: "success",
          text:
            "Order successfully placed on MT5." +
            (Number.isFinite(brokerPrice)
              ? ` @ ${brokerPrice.toFixed(5)}`
              : ""),
        });

        console.log(
          "✅ MARKET ORDER SENT TO MT5"
        );

        return;
      }

      // ========================================================
      // LIMIT / STOP → LOCAL PENDING ORDER
      // ========================================================

      addPendingOrder(trade);

      if (showTradeNotification) {
        showTradeNotification({
          id: `pending-${Date.now()}`,
          symbol: trade.symbol,
          side: trade.side,
          entry: trade.entry,
          quantity: trade.quantity,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          status: "PENDING",
          broker: "EdgeFlo",
        });
      }

      setOrderMessage({
        type: "success",
        text: `${orderType} order added successfully.`,
      });
    } catch (error) {
      // ========================================================
      // ERROR HANDLING
      // ========================================================

      console.error(
        "❌ MT5 order execution error:",
        error
      );

      setOrderMessage({
        type: "error",
        text:
          error?.message ||
          "Failed to place order.",
      });
    } finally {
      // ========================================================
      // RESET BUTTON
      // ========================================================

      setPlacingOrder(false);
    }
  };

  // ============================================================
  // DISPLAY VALUES
  // ============================================================

  const safeRisk = Number(risk || 0);
  const safeRiskAmount = Number(riskAmount || 0);
  const safeRewardAmount = Number(rewardAmount || 0);
  const safeRR = Number(rr || 0);
  const safeLotSize = Number(lotSize || 0);

  const displayEntry = Number(
    orderType === "Market"
      ? effectiveEntry
      : entry
  );

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="px-4 pt-5">
      {/* TOP INPUTS */}

      <div className="grid grid-cols-2 gap-3">
        {/* RISK */}

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="text-xs text-gray-500">
              Risk per Trade
            </label>

            <Lock
              size={13}
              className="text-gray-400"
            />
          </div>

          <div className="relative">
            <input
              type="number"
              value={safeRisk}
              readOnly
              className="
                w-full
                rounded-lg
                border
                border-gray-200
                bg-gray-50
                px-3
                py-2
                pr-8
                text-sm
                text-gray-600
                cursor-not-allowed
                outline-none
              "
            />

            <Lock
              size={14}
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                text-gray-400
              "
            />
          </div>
        </div>

        {/* LOT SIZE */}

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Lots
          </label>

          <input
            value={safeLotSize.toFixed(2)}
            readOnly
            className="
              w-full
              rounded-lg
              border
              border-violet-100
              bg-violet-50
              px-3
              py-2
              text-sm
              font-semibold
              text-violet-700
              outline-none
              cursor-not-allowed
            "
          />
        </div>
      </div>

      {/* GUARDRAIL STATUS */}

      {guardrails?.enabled && (
        <div
          className="
            mt-3
            flex
            items-center
            justify-between
            rounded-lg
            border
            border-violet-100
            bg-violet-50
            px-3
            py-2
          "
        >
          <span className="text-[11px] text-violet-600">
            🛡 Trading Guardrails Active
          </span>

          <span className="text-[11px] font-semibold text-violet-700">
            {safeRisk.toFixed(2)}% Risk
          </span>
        </div>
      )}

      {/* TRADING WINDOW STATUS */}

      {guardrails?.enabled && !tradingWindowOpen && (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-amber-200
            bg-amber-50
            px-3
            py-2
          "
        >
          <p className="text-[11px] font-medium text-amber-700">
            🔒 Trading window closed
          </p>

          <p className="text-[10px] text-amber-600 mt-0.5">
            Allowed: {tradingWindowStart} – {tradingWindowEnd}
          </p>
        </div>
      )}

      {/* PIP INFORMATION */}

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-gray-400">
          SL: {Number(riskPips || 0).toFixed(1)} pips
        </span>

        <span className="text-[11px] text-gray-400">
          TP: {Number(rewardPips || 0).toFixed(1)} pips
        </span>
      </div>

      {/* RR */}

      <div className="mt-4 text-xs text-gray-800">
        R:R{" "}
        <span className="font-semibold">
          1 : {safeRR.toFixed(2)}
        </span>
      </div>

      {/* RISK / RETURN CARD */}

      <div
        className="
          mt-1
          flex
          rounded-xl
          overflow-hidden
          border
          border-gray-200
        "
      >
        <div
          className="
            flex-1
            bg-red-50
            px-4
            py-3
          "
        >
          <div className="text-red-500 text-xs font-medium">
            Risk {safeRisk.toFixed(2)}%
          </div>

          <div className="mt-1 text-red-600 font-bold text-lg">
            -${safeRiskAmount.toFixed(2)}
          </div>
        </div>

        <div className="w-px bg-gray-200" />

        <div
          className="
            flex-1
            bg-emerald-50
            px-4
            py-3
            text-right
          "
        >
          <div className="text-emerald-500 text-xs font-medium">
            Reward{" "}
            {(safeRisk * safeRR)
              .toFixed(2)
              .replace(/\.00$/, "")}%
          </div>

          <div className="mt-1 text-emerald-600 font-bold text-lg">
            +${safeRewardAmount.toFixed(2)}
          </div>
        </div>
      </div>

      {/* VALIDATION MESSAGE */}

      {validation?.errors?.length > 0 && (
        <div
          className="
            mt-3
            rounded-lg
            bg-red-50
            border
            border-red-100
            px-3
            py-2
          "
        >
          <p className="text-[11px] font-medium text-red-600">
            {validation.errors[0]}
          </p>
        </div>
      )}

      {/* EXECUTE BUTTON */}

      <button
        onClick={handleExecuteTrade}
        disabled={
          !validation?.valid ||
          placingOrder
        }
        className={`
          mt-4
          w-full
          rounded-xl
          text-white
          font-semibold
          py-3
          transition-all
          duration-200
          ${
            !validation?.valid ||
            placingOrder
              ? "bg-gray-300 cursor-not-allowed"
              : side === "buy"
                ? "bg-emerald-500 hover:bg-emerald-600 hover:-translate-y-0.5 hover:shadow-lg"
                : "bg-red-500 hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-lg"
          }
        `}
      >
        {placingOrder ? (
          "Placing Order..."
        ) : (
          <>
            {side === "buy"
              ? "Buy"
              : "Sell"}{" "}
            {safeLotSize.toFixed(2)} Lots
            {" @ "}
            {displayEntry > 0
              ? displayEntry.toFixed(5)
              : "—"}
          </>
        )}
      </button>

      {/* ORDER MESSAGE */}

      {orderMessage && (
        <div
          className={`
            mt-3
            rounded-lg
            border
            px-3
            py-2
            text-center
            text-xs
            font-medium
            ${
              orderMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : "bg-red-50 border-red-200 text-red-600"
            }
          `}
        >
          {orderMessage.text}
        </div>
      )}

      {/* ORDER TYPE */}

      <p
        className="
          text-center
          text-[10px]
          text-gray-400
          mt-2
          pb-4
        "
      >
        {orderType === "Market"
          ? ""
          : `${orderType} order • Pending until price condition is met`}
      </p>
    </div>
  );
}