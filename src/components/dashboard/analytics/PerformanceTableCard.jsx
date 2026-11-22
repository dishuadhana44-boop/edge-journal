import CardShell from "./CardShell";

function money(value) {
  const amount = Number(value) || 0;
  return `${amount >= 0 ? "+" : "−"}$${Math.abs(amount).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

export default function PerformanceTableCard({
  title,
  subtitle,
  rows = [],
  labelHeader = "Segment",
  emptyMessage = "No closed trades in the selected date range.",
  note,
}) {
  const magnitude = Math.max(
    ...rows.map((row) => Math.abs(Number(row.netPnl) || 0)),
    1
  );

  return (
    <CardShell
      title={title}
      subtitle={subtitle}
      bodyClassName="px-0 py-0"
      footer={note}
    >
      {rows.length === 0 ? (
        <div className="h-full flex items-center justify-center px-6 text-center text-xs leading-relaxed text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                <th className="sticky top-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold">
                  {labelHeader}
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2 py-2 text-right font-semibold">
                  Trades
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2 py-2 text-right font-semibold">
                  Win %
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2 py-2 text-right font-semibold">
                  Avg R
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-3 py-2 text-right font-semibold">
                  Net P&amp;L
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 text-xs text-gray-700">
                  <td className="px-3 py-2 align-middle">
                    <p className="max-w-[160px] truncate font-medium text-gray-900" title={row.label}>
                      {row.label}
                    </p>

                    <div className="mt-1 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${
                          Number(row.netPnl) >= 0 ? "bg-green-500" : "bg-red-500"
                        }`}
                        style={{
                          width: `${(Math.abs(Number(row.netPnl) || 0) / magnitude) * 100}%`,
                        }}
                      />
                    </div>
                  </td>

                  <td className="px-2 py-2 text-right tabular-nums">{row.trades}</td>

                  <td className="px-2 py-2 text-right tabular-nums">{row.winRate}%</td>

                  <td className="px-2 py-2 text-right tabular-nums">
                    {row.avgR === null || row.avgR === undefined ? "—" : `${row.avgR}R`}
                  </td>

                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                      Number(row.netPnl) >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {money(row.netPnl)}
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
