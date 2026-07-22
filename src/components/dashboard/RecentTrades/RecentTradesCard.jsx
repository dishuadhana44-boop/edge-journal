import {
    ArrowUpRight,
    ArrowDownRight,
  } from "lucide-react";
  import { useNavigate } from "react-router-dom";


  const trades = [
    {
      id: 1,
      instrument: "EURUSD",
      flag: "🇪🇺",
      direction: "Sell",
      pnl: -1500,
      outcome: "Loss",
      time: "Today, 11:15 AM",
    },
    {
      id: 2,
      instrument: "GBPJPY",
      flag: "🇬🇧",
      direction: "Sell",
      pnl: -1250,
      outcome: "Loss",
      time: "Today, 10:48 AM",
    },
    {
      id: 3,
      instrument: "XAUUSD",
      flag: "🥇",
      direction: "Sell",
      pnl: -600,
      outcome: "Loss",
      time: "Today, 10:05 AM",
    },
   
  ];
  
  export default function RecentTradesCard() {
    const navigate = useNavigate();

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
  
            {trades.map((trade) => (
  
  <tr
  key={trade.id}
  onClick={() => navigate(`/trade/${trade.id}`)}
  className="border-b last:border-none hover:bg-gray-50 cursor-pointer transition-colors"
>
  
                <td className="px-6 py-2.5">
  
                  <div className="flex items-center gap-3">
  
                    <span className="text-xl">
                      {trade.flag}
                    </span>
  
                    <span className="font-medium">
                      {trade.instrument}
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
                    trade.pnl > 0
                      ? "text-green-600"
                      : trade.pnl < 0
                      ? "text-red-500"
                      : "text-gray-700"
                  }`}
                >
  
                  {trade.pnl > 0
                    ? `+$${trade.pnl}`
                    : trade.pnl < 0
                    ? `-$${Math.abs(trade.pnl)}`
                    : "$0"}
  
                </td>
  
                <td>
  
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      trade.outcome === "Win"
                        ? "bg-green-100 text-green-700"
                        : trade.outcome === "Loss"
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
  
                    {trade.outcome}
  
                  </span>
  
                </td>
  
                <td className="text-sm text-gray-500 pr-6">
  
                  {trade.time}
  
                </td>
  
              </tr>
  
            ))}
  
          </tbody>
  
        </table>
  
      </div>
    );
  }