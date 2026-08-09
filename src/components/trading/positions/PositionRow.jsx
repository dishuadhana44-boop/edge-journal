import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useMarket } from "../../../context/MarketContext";
import { calculatePnL } from "../../../utils/trading/calculatePnL";
import useTradeDuration from "../../../hooks/useTradeDuration";
import { useTrade } from "../../../context/TradeContext";

export default function PositionRow({ trade }) {
  const { bid, ask } = useMarket();
  const { closeTrade, deleteTrade } = useTrade();
  const navigate = useNavigate();
const [menuOpen, setMenuOpen] = useState(false);

  const currentPrice =
    trade.side?.toLowerCase() === "buy"
      ? bid
      : ask;

  // Support both old and new field names
  const quantity = Number(
    trade.quantity ?? trade.lots ?? 0
  );
  const margin = Number(
    trade.margin ?? 0
  );

  const entry = Number(trade.entry ?? 0);

  const stopLoss = Number(
    trade.stopLoss ?? trade.sl ?? 0
  );

  const takeProfit = Number(
    trade.takeProfit ?? trade.tp ?? 0
  );

  // Closed trade ke liye saved P/L use karo.
  // Open trade ke liye live P/L calculate karo.
  const pnl =
    trade.status === "CLOSED"
      ? Number(trade.pnl ?? 0)
      : calculatePnL(
          trade.side,
          entry,
          currentPrice,
          quantity
        );

        const liveDuration = useTradeDuration(
          trade.openedAt
        );
        
        const getDuration = () => {
          // CLOSED trade → fixed saved duration
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
        
            const seconds = totalSeconds % 60;
        
            if (hours > 0) {
              return `${hours}h ${minutes}m`;
            }
        
            if (minutes > 0) {
              return `${minutes}m ${seconds}s`;
            }
        
            return `${seconds}s`;
          }
        
          // OPEN trade → live timer
          return formatDuration(liveDuration);
        };
        
        const duration = getDuration();

  const formatDuration = (duration) => {
    if (!duration) return "0s";
  
    const parts = duration.split(":");
  
    if (parts.length !== 3) return duration;
  
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

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition">

      {/* Instrument */}
      <td className="px-4 py-4">
        <div className="flex flex-col">

          <span className="font-semibold text-gray-900">
            {trade.symbol}
          </span>

          

        </div>
      </td>

      {/* Direction */}
      <td className="text-center">

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
          {trade.side?.toUpperCase() ?? "-"}
        </span>

      </td>

      {/* Lots */}
      <td className="text-center">

        <div className="font-medium">
          {quantity.toFixed(2)}
        </div>

      

      </td>

      {/* Entry / Current */}
      <td className="text-right">

        <div className="font-medium">
          {entry.toFixed(5)}
        </div>

      

      </td>

     

     

      {/* TP */}
      <td className="text-right">

        <div className="text-emerald-600">
          {takeProfit
            ? takeProfit.toFixed(5)
            : "-"}
        </div>

       

      </td>

      {/* SL */}
      <td className="text-right">

        <div className="text-red-600">
          {stopLoss
            ? stopLoss.toFixed(5)
            : "-"}
        </div>

     

      </td>

      {/* P/L */}
      <td className="text-right">

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

      {/* Duration */}
      <td className="text-right">

      <div className="font-medium text-gray-700 whitespace-nowrap">
      {duration}
  </div>

      </td>

     {/* Margin */}
     <td className="text-right">
  <div className="font-medium text-gray-700">
    ${margin.toFixed(2)}
  </div>
</td>


{/* Actions */}
<td className="text-center relative">

  <button
    type="button"
    onClick={() => setMenuOpen((prev) => !prev)}
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

      {/* Open Journal */}
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          navigate(`/trade/${trade.id}`);
        }}
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

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          deleteTrade(trade.id);
        }}
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