import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

const COLORS = [
  "#7C3AED",
  "#22C55E",
  "#3B82F6",
  "#F59E0B",
  "#06B6D4",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
];

export default function PlanProfitChart({ data = [] }) {
  const chartData = data.map((item) => ({
    ...item,
    netPnL: Number(item?.netPnL || 0),
  }));

  if (!chartData.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-lg font-semibold mb-5">
          Profit by Plan
        </h3>

        <div className="h-[350px] flex items-center justify-center">
          <p className="text-sm text-gray-500">
            No trading plan data available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">

      <h3 className="text-lg font-semibold mb-5">
        Profit by Plan
      </h3>

      <ResponsiveContainer
        width="100%"
        height={350}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{
            top: 10,
            right: 25,
            left: 20,
            bottom: 10,
          }}
        >

          <CartesianGrid
            stroke="#F1F5F9"
            horizontal={false}
          />

          <XAxis
            type="number"
            tickFormatter={(value) =>
              `$${(Number(value) / 1000).toLocaleString()}k`
            }
          />

          <YAxis
            type="category"
            dataKey="plan"
            width={130}
          />

          <Tooltip
            formatter={(value) => [
              `$${Number(value).toLocaleString()}`,
              "Net P&L",
            ]}
          />

          <Bar
            dataKey="netPnL"
            radius={[8, 8, 8, 8]}
          >
            {chartData.map((item, index) => (
              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>

        </BarChart>
      </ResponsiveContainer>

    </div>
  );
}