import { useMemo } from "react";

import CurveCard from "./analytics/CurveCard";

import { buildDrawdownSeries } from "../../utils/dashboardCurveEngine";

// Drawdown is derived from the reconstructed equity curve. Its baseline is the
// account starting balance plus every result realised before the selected period,
// so zooming into a week measures depth against the equity the account actually
// stood at rather than resetting to the starting balance.
export default function DrawdownCurve({
  trades = [],
  startingBalance = 0,
  startDate = null,
  endDate = null,
  mode = "percent",
}) {
  const percent = mode === "percent";

  const series = useMemo(
    () =>
      buildDrawdownSeries(trades, {
        startingBalance,
        startDate,
        endDate,
      }),
    [trades, startingBalance, startDate, endDate]
  );

  const format = (value) =>
    percent ? `${Number(value).toFixed(1)}%` : `−$${Math.abs(Number(value)).toLocaleString()}`;

  return (
    <CurveCard
      title={percent ? "Drawdown Percentage" : "Drawdown Curve"}
      subtitle="Depth below the peak of the reconstructed equity curve: account starting balance plus every result realised before the range, advanced by in-range closes."
      unit={percent ? "Drawdown %" : "Drawdown $"}
      data={series.points}
      dataKeys={[
        {
          key: percent ? "drawdownPercent" : "drawdown",
          label: percent ? "Drawdown %" : "Drawdown",
          color: "#EF4444",
          metaKeys: [
            {
              key: "balance",
              label: "Equity",
              format: (value) => `$${Number(value).toLocaleString()}`,
            },
            {
              key: "peak",
              label: "Peak",
              format: (value) => `$${Number(value).toLocaleString()}`,
            },
          ],
        },
      ]}
      type="area"
      formatter={format}
      emptyMessage={
        series.reason ||
        "No closed trades in the selected date range, so drawdown cannot be calculated."
      }
      stats={[
        {
          label: "Max",
          value: percent
            ? `${series.maxDrawdownPercent}%`
            : `−$${Math.abs(series.maxDrawdown).toLocaleString()}`,
          tone: "text-red-700",
        },
        {
          label: "Current",
          value: percent
            ? `${series.currentDrawdownPercent}%`
            : `−$${Math.abs(series.currentDrawdown).toLocaleString()}`,
          tone: "text-red-600",
        },
        {
          label: "Avg",
          value: percent
            ? `${series.averageDrawdownPercent}%`
            : `−$${Math.abs(series.averageDrawdown).toLocaleString()}`,
          tone: "text-orange-500",
        },
      ]}
    />
  );
}
