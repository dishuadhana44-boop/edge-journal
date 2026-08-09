import { useEffect, useState } from "react";
import { useTrade } from "../../../../context/TradeContext";

export default function OpenPositionRow({
  trade,
  demo = false,
}) {
  const { closeTrade } = useTrade();

  if (!trade) return null;

  const [duration, setDuration] = useState("00:00:00");

  useEffect(() => {
    const updateDuration = () => {
      const now = new Date();
      const opened = new Date(trade.openedAt);

      const diff = Math.max(
        0,
        Math.floor((now - opened) / 1000)
      );

      const hours = String(
        Math.floor(diff / 3600)
      ).padStart(2, "0");

      const minutes = String(
        Math.floor((diff % 3600) / 60)
      ).padStart(2, "0");

      const seconds = String(
        diff % 60
      ).padStart(2, "0");

      setDuration(
        `${hours}:${minutes}:${seconds}`
      );
    };

    updateDuration();

    const interval = setInterval(
      updateDuration,
      1000
    );

    return () => clearInterval(interval);
  }, [trade.openedAt]);

  const formatDuration = (value) => {
    if (!value) return "0s";

    const parts = value.split(":");

    if (parts.length !== 3) return value;

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  };

  const quantity = Number(
    trade.quantity ?? trade.lots ?? 0
  );

  const entry = Number(
    trade.entry ?? 0
  );

  const currentPrice = Number(
    trade.currentPrice ?? trade.entry ?? 0
  );

  const takeProfit = Number(
    trade.takeProfit ?? trade.tp ?? 0
  );

  const stopLoss = Number(
    trade.stopLoss ?? trade.sl ?? 0
  );

  const pnl = Number(
    trade.pnl ?? 0
  );

  // IMPORTANT: Margin yahin se aa raha hai
  const margin = Number(
    trade.margin ?? 0
  );

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition">

      {/* Instrument */}
      <td className="w-[90px] px-6 py-4 text-left">
        <span className="font-semibold text-gray-900">
          {trade.symbol || "EURUSD"}
        </span>
      </td>

      {/* Side */}
      <td className="w-[90px] text-center">
        <span
          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
            trade.side?.toLowerCase() === "buy"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {trade.side?.toUpperCase()}
        </span>
      </td>

      {/* Lots */}
      <td className="w-[90px] text-center">
        {quantity.toFixed(2)}
      </td>

      {/* Entry */}
      <td className="w-[90px] text-right">
        {entry.toFixed(5)}
      </td>

      {/* Current */}
      <td className="w-[90px] text-right">
        {currentPrice.toFixed(5)}
      </td>

      {/* Take Profit */}
      <td className="w-[90px] text-right text-emerald-600">
        {takeProfit
          ? takeProfit.toFixed(5)
          : "-"}
      </td>

      {/* Stop Loss */}
      <td className="w-[90px] text-right text-red-600">
        {stopLoss
          ? stopLoss.toFixed(5)
          : "-"}
      </td>

      {/* P/L */}
      <td className="w-[90px] text-right">
        <span
          className={`font-semibold ${
            pnl >= 0
              ? "text-emerald-600"
              : "text-red-600"
          }`}
        >
          {pnl >= 0 ? "+" : ""}
          ${pnl.toFixed(2)}
        </span>
      </td>

      {/* MARGIN */}
      <td className="w-[90px] text-right">
        <span className="font-medium text-gray-700">
          ${margin.toFixed(2)}
        </span>
      </td>

      {/* Duration */}
      <td className="w-[90px] text-right whitespace-nowrap">
        <span className="font-medium text-gray-700">
          {formatDuration(duration)}
        </span>
      </td>

      {/* Actions */}
      <td className="w-[90px] text-center">
        <button
          type="button"
          onClick={() => closeTrade(trade.id)}
          className="
            px-3
            py-1
            rounded-lg
            bg-red-500
            hover:bg-red-600
            text-white
            text-xs
            font-medium
            transition
          "
        >
          Close
        </button>
      </td>

    </tr>
  );
}