import { useEffect } from "react";

import useOrder from "./context/useOrder";

import { useMarket } from "../../../context/MarketContext";

export default function PriceInputs() {
  
  const {
    orderType,
    entry,
    setEntry,
    sl,
    setSL,
    tp,
    setTP,
    side,
  } = useOrder();

  const {
    bid,
    ask,
    marketLoading,
    isMarketConnected,
  } = useMarket();
  console.log("💰 PRICE INPUTS MARKET DATA:", {
    bid,
    ask,
    marketLoading,
    isMarketConnected,
    side,
    orderType,
  });
  // ============================================================
  // LIVE MARKET PRICE
  // ============================================================

  useEffect(() => {
    if (orderType !== "Market") return;

    const normalizedSide = String(side || "").toLowerCase();

    const marketPrice =
      normalizedSide === "buy"
        ? Number(ask)
        : Number(bid);

    if (
      !Number.isFinite(marketPrice) ||
      marketPrice <= 0
    ) {
      return;
    }

    setEntry(marketPrice.toFixed(5));
  }, [
    orderType,
    side,
    bid,
    ask,
    setEntry,
  ]);

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="px-4 pt-5 space-y-4">

      {/* ======================================================
          ENTRY PRICE
      ====================================================== */}

      <div>
        <div className="flex items-center justify-between mb-1">

          <label className="block text-xs font-medium text-gray-500">
            {orderType === "Market"
              ? "Entry Price"
              : orderType === "Limit"
              ? "Limit Price"
              : "Stop Price"}
          </label>

          {orderType === "Market" && (
            <span
              className={`text-[10px] font-medium ${
                isMarketConnected
                  ? "text-green-500"
                  : "text-orange-500"
              }`}
            >
              {marketLoading
                ? "Connecting..."
                : isMarketConnected
                ? "LIVE"
                : "Waiting for price"}
            </span>
          )}

        </div>

        <input
          type="number"
          step="0.00001"
          value={entry || ""}
          onChange={(e) => setEntry(e.target.value)}
          disabled={orderType === "Market"}
          placeholder={
            orderType === "Market"
              ? "Waiting for market price..."
              : orderType === "Limit"
              ? "Enter Limit Price"
              : "Enter Stop Price"
          }
          className={`
            w-full
            rounded-xl
            border
            border-gray-200
            px-4
            py-3
            text-sm
            font-medium
            outline-none
            transition
            ${
              orderType === "Market"
                ? "bg-gray-50 text-gray-700 cursor-not-allowed"
                : "bg-white"
            }
            focus:border-violet-500
            focus:ring-2
            focus:ring-violet-100
          `}
        />

      </div>

      {/* ======================================================
          STOP LOSS / TAKE PROFIT
      ====================================================== */}

      <div className="grid grid-cols-2 gap-3">

        {/* STOP LOSS */}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Stop Loss
          </label>

          <input
            type="number"
            step="0.00001"
            value={sl || ""}
            onChange={(e) => setSL(e.target.value)}
            placeholder="SL price"
            className="
              w-full
              rounded-xl
              border
              border-gray-200
              px-4
              py-3
              text-sm
              outline-none
              transition
              focus:border-red-500
              focus:ring-2
              focus:ring-red-100
            "
          />
        </div>

        {/* TAKE PROFIT */}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Take Profit
          </label>

          <input
            type="number"
            step="0.00001"
            value={tp || ""}
            onChange={(e) => setTP(e.target.value)}
            placeholder="TP price"
            className="
              w-full
              rounded-xl
              border
              border-gray-200
              px-4
              py-3
              text-sm
              outline-none
              transition
              focus:border-green-500
              focus:ring-2
              focus:ring-green-100
            "
          />
        </div>

      </div>

    </div>
  );
}