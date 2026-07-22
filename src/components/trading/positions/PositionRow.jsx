import { useMarket } from "../../../context/MarketContext";
import { calculatePnL } from "../../../utils/trading/calculatePnL";
import useTradeDuration from "../../../hooks/useTradeDuration";
import { useTrade } from "../../../context/TradeContext";
import { X } from "lucide-react";
import PositionActions from "./actions/PositionActions";

export default function PositionRow({ trade }) {

  const { bid, ask } = useMarket();
  const { closeTrade } = useTrade();
  const currentPrice =
    trade.side === "BUY"
      ? bid
      : ask;

  // LIVE PNL
  const pnl = calculatePnL(
    trade.side,
    trade.entry,
    currentPrice,
    trade.lots
  );
  const duration = useTradeDuration(trade.openedAt);
  

  return (

    <tr className="border-t border-gray-100 hover:bg-gray-50 transition">

      {/* Instrument */}
      <td className="px-4 py-4">

        <div className="flex items-center gap-2">

          <img
            src="https://flagcdn.com/w20/eu.png"
            className="w-4 h-4 rounded-full"
          />

          <span className="font-medium">
            {trade.symbol}
          </span>

        </div>

      </td>

      {/* Direction */}
      <td>

        <span
          className={`
            px-2
            py-1
            rounded-lg
            text-xs
            font-semibold
            ${
              trade.side === "BUY"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }
          `}
        >
          {trade.side}
        </span>

      </td>

      {/* Lots */}
      <td>
        {trade.lots.toFixed(2)}
      </td>

      {/* Entry / Current */}
      <td>

        {trade.entry.toFixed(5)}

        <span className="mx-2 text-gray-300">
          /
        </span>

        {currentPrice.toFixed(5)}

      </td>

      {/* SL */}
      <td>
        {trade.sl.toFixed(5)}
      </td>

      {/* TP */}
      <td>
        {trade.tp.toFixed(5)}
      </td>

      {/* LIVE PNL */}
      <td>

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

      {/* Duration */}
      <td>

  {duration}

</td>

<td className="text-center">

  <PositionActions trade={trade} />

</td>

    </tr>

  );

}