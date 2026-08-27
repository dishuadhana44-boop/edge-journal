import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

export default function LongShortChart({ data = [] }) {
  const chartData = data.map((item) => ({
    ...item,
    pnl: Number(item?.pnl || 0),
  }));

  const formatCurrency = (value) => {
    const number = Number(value || 0);

    return `${number < 0 ? "-" : ""}$${Math.abs(
      number
    ).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
      return null;
    }

    const item = payload[0]?.payload;

    if (!item) return null;

    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
        <p className="text-sm font-semibold text-gray-900">
          {item.direction}
        </p>

        <div className="mt-2 flex items-center justify-between gap-8">
          <span className="text-xs text-gray-500">
            P&L
          </span>

          <span
            className={`text-sm font-bold ${
              item.pnl >= 0
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {formatCurrency(item.pnl)}
          </span>
        </div>
      </div>
    );
  };

  if (!chartData.length) {
    return (
      <div className="h-[320px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">
            No trade data available
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Add Long or Short trades to see the analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer
      width="100%"
      height={320}
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{
          top: 15,
          right: 55,
          left: 20,
          bottom: 15,
        }}
      >
        <CartesianGrid
          stroke="#F1F5F9"
          horizontal={false}
        />

        <XAxis
          type="number"
          tick={{
            fontSize: 12,
            fill: "#64748B",
          }}
          axisLine={{
            stroke: "#CBD5E1",
          }}
          tickLine={false}
          tickFormatter={(value) =>
            `$${Math.abs(value / 1000)}k`
          }
        />

        <YAxis
          type="category"
          dataKey="direction"
          width={55}
          tick={{
            fontSize: 14,
            fill: "#64748B",
          }}
          axisLine={{
            stroke: "#CBD5E1",
          }}
          tickLine={false}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{
            fill: "rgba(124,58,237,0.04)",
          }}
        />

        <Bar
          dataKey="pnl"
          barSize={70}
          radius={[0, 8, 8, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.pnl >= 0
                  ? "#7C3AED"
                  : "#EF4444"
              }
            />
          ))}

          <LabelList
            dataKey="pnl"
            position="right"
            formatter={(value) =>
              formatCurrency(value)
            }
            style={{
              fontSize: 12,
              fontWeight: 600,
              fill: "#111827",
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}