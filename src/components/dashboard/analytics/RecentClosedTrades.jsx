import CardShell from "./CardShell";

export default function RecentClosedTrades({
  title = "Recent Trades",
  subtitle,
  trades = [],
  emptyMessage = "No closed trades in the selected date range.",
}) {
  return (
    <CardShell title={title} subtitle={subtitle} bodyClassName="px-0 py-0">
      {trades.length === 0 ? (
        <div className="h-full flex items-center justify-center px-6 text-center text-xs leading-relaxed text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-auto">
          <table className="w-full min-w-[360px] border-collapse text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                <th className="sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold">
                  Symbol
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2 py-2 font-semibold">
                  Side
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2 py-2 font-semibold">
                  Closed
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2 py-2 font-semibold">
                  Duration
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-3 py-2 text-right font-semibold">
                  Net P&amp;L
                </th>
              </tr>
            </thead>

            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="border-t border-gray-100 text-xs text-gray-700">
                  <td className="px-3 py-2 font-medium text-gray-900">{trade.symbol}</td>

                  <td className="px-2 py-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        trade.direction === "Sell"
                          ? "bg-red-50 text-red-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-2 py-2 text-gray-500">
                    {trade.closedLabel}
                  </td>

                  <td className="whitespace-nowrap px-2 py-2 text-gray-500">
                    {trade.duration}
                  </td>

                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${
                      trade.pnl >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {trade.pnl >= 0 ? "+" : "-"}$
                    {Math.abs(trade.pnl).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  );
}
