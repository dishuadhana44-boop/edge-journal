import { useTrade } from "../../../context/TradeContext";

export default function PositionCard({ trade }) {

  return (

    <div className="rounded-xl border border-gray-200 bg-white p-4">

      <div className="flex justify-between">

        <div>

          <div className="font-semibold">

            {trade.side === "BUY" ? "🟢 BUY" : "🔴 SELL"} {trade.symbol}

          </div>

          <div className="text-sm text-gray-500 mt-2">

            Lots : {trade.lots}

          </div>

          <div className="text-sm text-gray-500">

            Entry : {trade.entry}

          </div>

        </div>

        <div className="text-right">

          <div className="font-bold text-emerald-500">

            ${trade.pnl.toFixed(2)}

          </div>

        </div>

      </div>

    </div>

  );

}