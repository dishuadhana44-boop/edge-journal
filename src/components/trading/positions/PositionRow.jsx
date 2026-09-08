import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useMarket } from "../../../context/MarketContext";
import { useTrade } from "../../../context/TradeContext";

import { calculatePnL } from "../../../utils/trading/calculatePnL";
import useTradeDuration from "../../../hooks/useTradeDuration";

export default function PositionRow({ trade }) {
  const { bid, ask } = useMarket();

  const { deleteTrade } = useTrade();

  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);

  // ============================================================
  // CURRENT LIVE PRICE
  // BUY positions close at BID
  // SELL positions close at ASK
  // ============================================================

  const currentPrice =
    trade.side?.toLowerCase() === "buy"
      ? Number(bid || 0)
      : Number(ask || 0);

  // ============================================================
  // TRADE VALUES
  // ============================================================

  const quantity = Number(
    trade.quantity ?? trade.lots ?? 0
  );

  const entry = Number(
    trade.entry ?? trade.entryPrice ?? 0
  );

  const stopLoss = Number(
    trade.stopLoss ?? trade.sl ?? 0
  );

  const takeProfit = Number(
    trade.takeProfit ?? trade.tp ?? 0
  );

  // ============================================================
  // LIVE / CLOSED P&L
  // ============================================================

  const pnl =
    trade.status === "CLOSED"
      ? Number(trade.pnl ?? 0)
      : calculatePnL(
          trade.side,
          entry,
          currentPrice,
          quantity
        );

  // ============================================================
  // TRADE DURATION
  // ============================================================

  const liveDuration = useTradeDuration(
    trade.openedAt
  );

  const formatDuration = (duration) => {
    if (!duration) return "0s";

    const parts = duration.split(":");

    if (parts.length !== 3) {
      return duration;
    }

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

  const getDuration = () => {
    // CLOSED TRADE → Saved duration

    if (
      trade.status === "CLOSED" &&
      trade.durationSeconds != null
    ) {
      const totalSeconds = Number(
        trade.durationSeconds
      );

      const hours = Math.floor(
        totalSeconds / 3600
      );

      const minutes = Math.floor(
        (totalSeconds % 3600) / 60
      );

      const seconds =
        totalSeconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }

      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }

      return `${seconds}s`;
    }

    // OPEN TRADE → Live timer

    return formatDuration(liveDuration);
  };

  const duration = getDuration();

  // ============================================================
  // ACTIONS
  // ============================================================

  const handleOpenJournal = () => {
    setMenuOpen(false);

    navigate(`/trade/${trade.id}`);
  };

  const handleDelete = () => {
    setMenuOpen(false);

    deleteTrade(trade.id);
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition">
      
      {/* INSTRUMENT */}

      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">
            {trade.symbol || "-"}
          </span>
        </div>
      </td>

      {/* DIRECTION */}

      <td className="text-left">
        <span
          className={`
            inline-flex
            px-2
            py-1
            rounded-lg
            text-xs
            font-semibold
            ${
              trade.side?.toLowerCase() === "buy"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }
          `}
        >
          {trade.side?.toUpperCase() || "-"}
        </span>
      </td>

      {/* SIZE */}

      <td className="text-left">
        <div className="font-medium">
          {quantity.toFixed(2)}
        </div>
      </td>

      {/* ENTRY */}

      <td className="text-left">
        <div className="font-medium text-gray-900">
          {entry > 0
            ? entry.toFixed(5)
            : "-"}
        </div>
      </td>

      {/* CURRENT */}

      <td className="text-left">
        <div className="font-medium text-gray-700">
          {currentPrice > 0
            ? currentPrice.toFixed(5)
            : "-"}
        </div>
      </td>

      {/* SL */}

      <td className="text-left">
        <div className="text-red-600">
          {stopLoss > 0
            ? stopLoss.toFixed(5)
            : "-"}
        </div>
      </td>

      {/* TP */}

      <td className="text-left">
        <div className="text-emerald-600">
          {takeProfit > 0
            ? takeProfit.toFixed(5)
            : "-"}
        </div>
      </td>

      {/* P/L */}

      <td className="text-left">
        <div
          className={`
            font-semibold
            ${
              pnl >= 0
                ? "text-emerald-600"
                : "text-red-600"
            }
          `}
        >
          {pnl >= 0 ? "+" : ""}
          ${pnl.toFixed(2)}
        </div>
      </td>

      {/* DURATION */}

      <td className="text-left">
        <div className="font-medium text-gray-700 whitespace-nowrap">
          {duration}
        </div>
      </td>

      {/* ACTIONS */}

      <td className="text-center relative">
        <button
          type="button"
          onClick={() =>
            setMenuOpen((prev) => !prev)
          }
          className="
            w-8
            h-8
            inline-flex
            items-center
            justify-center
            rounded-lg
            text-gray-500
            hover:bg-gray-100
            hover:text-gray-900
            transition
          "
          aria-label="Trade actions"
        >
          <span className="text-xl leading-none">
            ⋮
          </span>
        </button>

        {menuOpen && (
          <div
            className="
              absolute
              right-2
              top-10
              z-50
              w-40
              rounded-xl
              border
              border-gray-200
              bg-white
              shadow-lg
              py-1
              text-left
            "
          >
            {/* OPEN JOURNAL */}

            <button
              type="button"
              onClick={handleOpenJournal}
              className="
                w-full
                px-4
                py-2.5
                text-sm
                text-gray-700
                hover:bg-gray-50
                transition
              "
            >
              Open Journal
            </button>

            {/* DELETE */}

            <button
              type="button"
              onClick={handleDelete}
              className="
                w-full
                px-4
                py-2.5
                text-sm
                text-red-600
                hover:bg-red-50
                transition
              "
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}