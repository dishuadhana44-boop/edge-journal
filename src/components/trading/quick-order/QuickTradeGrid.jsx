
import { useRef, useState } from "react";
import useOrder from "../order-panel/context/useOrder";
import { useMarket } from "../../../context/MarketContext";
import { useTrade } from "../../../context/TradeContext";

const DEFAULT_GUARDRAILS = {
  enabled: true,
  tradingWindowStart: "11:30",
  tradingWindowEnd: "19:30",
};

function timeToMinutes(time) {
  if (!time || !time.includes(":")) return 0;

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinTradingWindow(start, end) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes === endMinutes) return false;

  if (startMinutes < endMinutes) {
    return (
      currentMinutes >= startMinutes &&
      currentMinutes <= endMinutes
    );
  }

  return (
    currentMinutes >= startMinutes ||
    currentMinutes <= endMinutes
  );
}

function getGuardrails() {
  try {
    const saved = localStorage.getItem("tradingGuardrails");

    return {
      ...DEFAULT_GUARDRAILS,
      ...(saved ? JSON.parse(saved) : {}),
    };
  } catch {
    return DEFAULT_GUARDRAILS;
  }
}

export default function QuickTradeGrid() {
  const {
    lots,
    setLots,
    setEntry,
    setSide,
  } = useOrder();

  const { bid, ask } = useMarket();
  const { executeTrade } = useTrade();

  const [isExecuting, setIsExecuting] = useState(false);
  const [warning, setWarning] = useState("");

  const executionLock = useRef(false);

  const increaseLots = () => {
    setLots(Number((Number(lots) + 0.01).toFixed(2)));
  };

  const decreaseLots = () => {
    if (Number(lots) > 0.01) {
      setLots(Number((Number(lots) - 0.01).toFixed(2)));
    }
  };

  const canExecuteTrade = () => {
    const guardrails = getGuardrails();

    if (!guardrails.enabled) {
      return true;
    }

    const withinWindow = isWithinTradingWindow(
      guardrails.tradingWindowStart,
      guardrails.tradingWindowEnd
    );

    if (!withinWindow) {
      setWarning(
        `Trading window closed. Allowed time: ${guardrails.tradingWindowStart} - ${guardrails.tradingWindowEnd}`
      );

      return false;
    }

    if (!lots || Number(lots) <= 0) {
      setWarning("Please enter a valid lot size.");

      return false;
    }

    if (!Number.isFinite(Number(lots))) {
      setWarning("Invalid lot size.");

      return false;
    }

    return true;
  };

  const submitQuickTrade = async (side, price) => {
    if (executionLock.current || isExecuting) {
      return;
    }

    setWarning("");

    if (!canExecuteTrade()) {
      return;
    }

    if (!price || !Number.isFinite(Number(price))) {
      setWarning("Live market price is not available.");
      return;
    }

    executionLock.current = true;
    setIsExecuting(true);

    try {
      setSide(side === "BUY" ? "buy" : "sell");
      setEntry(Number(price).toFixed(5));

      await executeTrade({
        symbol: "EURUSD",
        side,
        lots: Number(lots),
        entry: Number(price),
        sl: 0,
        tp: 0,
      });
    } catch (error) {
      console.error("Quick trade execution failed:", error);

      setWarning(
        error?.message || "Trade execution failed. Please try again."
      );
    } finally {
      executionLock.current = false;
      setIsExecuting(false);
    }
  };

  const handleBuy = () => {
    submitQuickTrade("BUY", ask);
  };

  const handleSell = () => {
    submitQuickTrade("SELL", bid);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {warning && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          {warning}
        </div>
      )}

      <div className="grid grid-cols-3">
        {/* BUY */}
        <button
          type="button"
          onClick={handleBuy}
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
            {Number.isFinite(Number(ask))
              ? Number(ask).toFixed(5)
              : "—"}
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
          onClick={handleSell}
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
            {Number.isFinite(Number(bid))
              ? Number(bid).toFixed(5)
              : "—"}
          </span>
        </button>
      </div>
    </div>
  );
}