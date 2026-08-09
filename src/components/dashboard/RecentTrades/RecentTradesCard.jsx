import {
    ArrowUpRight,
    ArrowDownRight,
  } from "lucide-react";
  import { useNavigate } from "react-router-dom";
  import { useJournal } from "../../../context/JournalContext";


  
  export default function RecentTradesCard() {

    const navigate = useNavigate();

    const { trades } = useJournal();

    const recentTrades = [...trades]
    .sort(
    (a,b)=>
    new Date(b.date)-new Date(a.date)
    )
    .slice(0,3);

    const getFlag = (pair) => {
      if (pair?.includes("EUR")) return "🇪🇺";
      if (pair?.includes("GBP")) return "🇬🇧";
      if (pair?.includes("JPY")) return "🇯🇵";
      if (pair?.includes("USD")) return "🇺🇸";
      if (pair?.includes("XAU")) return "🥇";
      return "📈";
    };

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
  
        {/* Header */}
  
        <div className="flex items-center justify-between px-6 py-2 border-b">
  
          <h2 className="text-lg font-semibold">
            Recent Trades
          </h2>
  
          <button
  onClick={() => navigate("/tradelog")}
  className="text-sm text-violet-600 hover:text-violet-700 font-medium"
>
  All Trades →
</button>
  
        </div>
  
        {/* Table */}
  
        <table className="w-full">
  
          <thead className="text-xs uppercase text-gray-800">
  
            <tr className="border-b">
  
              <th className="text-left px-6 py-3">
                Instrument
              </th>
  
              <th className="text-left">
                Direction
              </th>
  
              <th className="text-left">
                P/L
              </th>
  
              <th className="text-left">
                Outcome
              </th>
  
              <th className="text-left pr-6">
                Closed At
              </th>
  
            </tr>
  
          </thead>
  
          <tbody>
  
            {recentTrades.map((trade) => (
  
  <tr
  key={trade.id}
  onClick={() => navigate(`/trade/${trade.id}`)}
  className="border-b last:border-none hover:bg-gray-50 cursor-pointer transition-colors"
>
  
                <td className="px-6 py-2.5">
  
                  <div className="flex items-center gap-3">
  
                  <span className="text-xl">
  {getFlag(trade.pair)}
</span>
  
                    <span className="font-medium">
                      {trade.pair}
                    </span>
  
                  </div>
  
                </td>
  
                <td>
  
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      trade.direction === "Buy"
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
  
                    {trade.direction === "Buy" ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
  
                    {trade.direction}
  
                  </div>
  
                </td>
  
                <td
  className={`font-semibold ${
    Number(trade.pnl) >= 0
      ? "text-green-600"
      : "text-red-500"
  }`}
>
  {Number(trade.pnl) >= 0
    ? `+$${Math.abs(Number(trade.pnl)).toLocaleString()}`
    : `-$${Math.abs(Number(trade.pnl)).toLocaleString()}`}
</td>
  
                <td>
  
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      trade.result === "Win"
                        ? "bg-green-100 text-green-700"
                        : trade.result === "Loss"
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
  
                    {trade.result}
  
                  </span>
  
                </td>
  
                <td className="text-sm text-gray-500 pr-6">
  {new Date(trade.date).toLocaleDateString()}
</td>
              </tr>
  
            ))}
  
          </tbody>
  
        </table>
  
      </div>
    );
  }