import { useState } from "react";

import useOrder from "./context/useOrder";

import { useTrade } from "../../../context/TradeContext";

export default function RiskSection() {
  // ============================================================
  // STATES
  // ============================================================

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [orderMessage, setOrderMessage] =
    useState(null);

  // ============================================================
  // ORDER CONTEXT
  // ============================================================

  const {
    risk,
    setRisk,

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

    validation,
  } = useOrder();

  // ============================================================
  // TRADE CONTEXT
  // ============================================================

  const {
    addPendingOrder,
  } = useTrade();

  // ============================================================
  // EXECUTE ORDER
  // ============================================================

  const handleExecuteTrade = async () => {
    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!validation?.valid) {
      console.warn(
        "Order validation failed:",
        validation?.errors
      );

      return;
    }

    // ==========================================================
    // PREVENT DOUBLE CLICKING
    // ==========================================================

    if (placingOrder) {
      return;
    }

    setPlacingOrder(true);

    setOrderMessage(null);

    // ==========================================================
    // CREATE TRADE OBJECT
    // ==========================================================

    const trade = {
      symbol: "EURUSD",

      side,

      entry:
        orderType === "Market"
          ? effectiveEntry
          : entry,

      stopLoss: sl,

      takeProfit: tp,

      quantity: Number(lotSize),

      risk: Number(risk),

      orderType,
    };

    try {
      // ========================================================
      // MARKET ORDER → REAL cTRADER
      // ========================================================

      if (orderType === "Market") {
        console.log(
          "🚀 Sending REAL cTrader order:",
          trade
        );

        const response = await fetch(
          "http://localhost:4000/api/ctrader/order",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              symbol: "EURUSD",
            
              side: String(side).trim().toUpperCase(),
            
              lots: Number(lotSize),
            
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
            
              label: "EDGEFLO",
            
              comment: "Order placed from EdgeFlo",
            }),
          }
        );

        // ======================================================
        // READ RESPONSE SAFELY
        // ======================================================

        const data =
          await response.json();

        console.log(
          "📩 cTrader order response:",
          data
        );

        // ======================================================
        // ERROR
        // ======================================================

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
            "Failed to place cTrader order"
          );
        }

        // ======================================================
        // SUCCESS
        // ======================================================

        setOrderMessage({
          type: "success",

          text:
            "Order request sent to cTrader...",
        });

        console.log(
          "✅ MARKET ORDER SENT TO cTRADER"
        );

        return;
      }

      // ========================================================
      // LIMIT / STOP → LOCAL PENDING ORDER SYSTEM
      // ========================================================

      addPendingOrder(trade);

      setOrderMessage({
        type: "success",

        text:
          `${orderType} order added successfully`,
      });

    } catch (error) {
      // ========================================================
      // ERROR HANDLING
      // ========================================================

      console.error(
        "❌ Order execution error:",
        error
      );

      setOrderMessage({
        type: "error",

        text:
          error.message ||
          "Failed to place order",
      });

    } finally {
      // ========================================================
      // STOP LOADING
      // ========================================================

      setPlacingOrder(false);
    }
  };

  // ============================================================
  // DISPLAY VALUES
  // ============================================================

  const safeRisk =
    Number(risk || 0);

  const safeRiskAmount =
    Number(riskAmount || 0);

  const safeRewardAmount =
    Number(rewardAmount || 0);

  const safeRR =
    Number(rr || 0);

  const safeLotSize =
    Number(lotSize || 0);

  const displayEntry =
    Number(
      orderType === "Market"
        ? effectiveEntry
        : entry
    );

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="px-4 pt-5">

      {/* =====================================================
          TOP INPUTS
      ===================================================== */}

      <div className="grid grid-cols-2 gap-3">

        {/* RISK */}

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Risk per Trade
          </label>

          <input
            type="number"
            min="0.25"
            max="10"
            step="0.25"
            value={safeRisk}
            onChange={(e) =>
              setRisk(
                Number(e.target.value)
              )
            }
            className="
              w-full
              rounded-lg
              border
              border-gray-200
              px-3
              py-2
              text-sm
              focus:border-violet-500
              focus:ring-2
              focus:ring-violet-100
              outline-none
            "
          />
        </div>

        {/* LOT SIZE */}

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Lots
          </label>

          <input
            value={
              Number(
                lotSize || 0
              ).toFixed(2)
            }
            readOnly
            className="
              w-full
              rounded-lg
              border
              border-gray-200
              px-3
              py-2
              text-sm
              outline-none
              bg-gray-50
              text-gray-600
              cursor-not-allowed
            "
          />
        </div>

      </div>

      {/* =====================================================
          PIP INFORMATION
      ===================================================== */}

      <div className="flex items-center justify-between mt-3">

        <span className="text-[11px] text-gray-400">
          SL:{" "}
          {Number(
            riskPips || 0
          ).toFixed(1)}{" "}
          pips
        </span>

        <span className="text-[11px] text-gray-400">
          TP:{" "}
          {Number(
            rewardPips || 0
          ).toFixed(1)}{" "}
          pips
        </span>

      </div>

      {/* =====================================================
          RR
      ===================================================== */}

      <div className="mt-4 text-xs text-gray-800">

        R:R{" "}

        <span className="font-semibold">
          1 : {safeRR.toFixed(2)}
        </span>

      </div>

      {/* =====================================================
          RISK / RETURN CARD
      ===================================================== */}

      <div
        className="
          mt-2
          flex
          rounded-xl
          overflow-hidden
          border
          border-gray-200
        "
      >

        {/* RISK */}

        <div
          className="
            flex-1
            bg-red-50
            px-4
            py-3
          "
        >

          <div
            className="
              text-red-500
              text-xs
              font-medium
            "
          >
            Risk {safeRisk.toFixed(0)}%
          </div>

          <div
            className="
              mt-1
              text-red-600
              font-bold
              text-lg
            "
          >
            -${safeRiskAmount.toFixed(2)}
          </div>

        </div>

        <div className="w-px bg-gray-200" />

        {/* REWARD */}

        <div
          className="
            flex-1
            bg-emerald-50
            px-4
            py-3
            text-right
          "
        >

          <div
            className="
              text-emerald-500
              text-xs
              font-medium
            "
          >
            Reward{" "}

            {(safeRisk * safeRR)
              .toFixed(2)
              .replace(/\.00$/, "")}%

          </div>

          <div
            className="
              mt-1
              text-emerald-600
              font-bold
              text-lg
            "
          >
            +${safeRewardAmount.toFixed(2)}
          </div>

        </div>

      </div>

      {/* =====================================================
          VALIDATION MESSAGE
      ===================================================== */}

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

          <p
            className="
              text-[11px]
              font-medium
              text-red-600
            "
          >
            {validation.errors[0]}
          </p>

        </div>

      )}

      {/* =====================================================
          EXECUTE BUTTON
      ===================================================== */}

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

        {placingOrder

          ? "Placing Order..."

          : (
            <>
              {side === "buy"
                ? "Buy"
                : "Sell"}{" "}

              {safeLotSize.toFixed(2)} Lots

              {" @ "}

              {displayEntry
                ? displayEntry.toFixed(5)
                : "—"}
            </>
          )}

      </button>

      {/* =====================================================
          ORDER MESSAGE
      ===================================================== */}

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

      {/* =====================================================
          ORDER TYPE
      ===================================================== */}

      <p
        className="
          text-center
          text-[10px]
          text-gray-400
          mt-2
        "
      >

        {orderType === "Market"

          ? "Market order • Sends order to cTrader"

          : `${orderType} order • Pending until price condition is met`
        }

      </p>

    </div>
  );
}