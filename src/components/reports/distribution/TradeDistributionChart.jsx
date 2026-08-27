import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#22C55E",
  "#EF4444",
  "#94A3B8",
];

export default function TradeDistributionChart({
  data = [],
  totalTrades = 0,
}) {
  return (
    <ResponsiveContainer
      width="100%"
      height={280}
    >
      <PieChart>

        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={78}
          outerRadius={108}
          paddingAngle={3}
          stroke="none"
        >

          {data.map((entry, index) => (
            <Cell
              key={`${entry.name}-${index}`}
              fill={
                COLORS[index % COLORS.length]
              }
            />
          ))}

        </Pie>

        <Tooltip
          formatter={(value, name) => [
            `${value} trades`,
            name,
          ]}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.08)",
          }}
        />

        {/* CENTER TOTAL */}

        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#111827"
          style={{
            fontSize: "24px",
            fontWeight: 700,
          }}
        >
          {totalTrades}
        </text>

        <text
          x="50%"
          y="57%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6B7280"
          style={{
            fontSize: "12px",
          }}
        >
          Total Trades
        </text>

      </PieChart>
    </ResponsiveContainer>
  );
}