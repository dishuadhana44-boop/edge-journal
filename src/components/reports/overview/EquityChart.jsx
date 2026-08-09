import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceDot,
} from "recharts";

import CustomTooltip from "./CustomTooltip";

export default function EquityChart({
  equityData,
  mode = "Balance",
}) {
  const chartConfig = {
    Balance: {
      key: "balance",
      color: "#22C55E",
      gradient: "url(#balanceGradient)",
    },
    Equity: {
      key: "equity",
      color: "#3B82F6",
      gradient: "url(#equityGradient)",
    },
    Drawdown: {
      key: "drawdown",
      color: "#EF4444",
      gradient: "url(#drawdownGradient)",
    },
  };

  const activeChart = chartConfig[mode] || chartConfig["Balance"];
  console.log("MODE =", mode);
  return (
    <div className="h-[500px] p-5">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={equityData}
          margin={{
            top: 15,
            right: 20,
            left: -20,
            bottom: 0,
          }}
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.30} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>

            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>

            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={0.30} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#F1F5F9" vertical={false} />

          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748B" }}
          />

          <YAxis
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v) =>
              mode === "Drawdown"
                ? `${v}%`
                : `$${Number(v).toLocaleString()}`
            }
            tick={{ fontSize: 11, fill: "#64748B" }}
          />

          <Tooltip />

          <Legend verticalAlign="top" align="right" iconType="circle" />

          {/* Area */}
          <Area
            type="monotone"
            dataKey={activeChart.key}
            name={mode}
            stroke={activeChart.color}
            strokeWidth={3}
            fill={activeChart.gradient}
            dot={false}
            activeDot={{
              r: 7,
              stroke: activeChart.color,
              strokeWidth: 3,
              fill: "#fff",
            }}
            animationDuration={1200}
          />

          {/* Peak Reference Dot */}
          <ReferenceDot
            x={
              equityData.reduce((a, b) =>
                Number(a[activeChart.key] || 0) > Number(b[activeChart.key] || 0) ? a : b
              ).date
            }
            y={
              Math.max(...equityData.map((i) => Number(i[activeChart.key] || 0)))
            }
            r={6}
            fill={activeChart.color}
            stroke="#fff"
            strokeWidth={3}
            label={{
              value: "Peak",
              position: "top",
              fill: activeChart.color,
              fontSize: 11,
              fontWeight: 600,
            }}
          />

          {/* Current Reference Dot */}
          <ReferenceDot
            x={equityData[equityData.length - 1]?.date}
            y={equityData[equityData.length - 1]?.[activeChart.key]}
            r={6}
            fill={activeChart.color}
            stroke="#fff"
            strokeWidth={3}
            label={{
              value: "Current",
              position: "bottom",
              fill: activeChart.color,
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}