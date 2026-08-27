import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    LabelList,
  } from "recharts";
  
  const COLORS = [
    "#2563EB", // New York
    "#7C3AED", // London
    "#22C55E", // Asia
  ];
  
  export default function SessionProfitChart({ data = [] }) {
    const chartData = data.map((item) => ({
      ...item,
      netPnL: Number(item?.netPnL || 0),
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
  
      if (!item) {
        return null;
      }
  
      return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
          <p className="text-sm font-semibold text-gray-900">
            {item.session}
          </p>
  
          <div className="mt-2 flex items-center justify-between gap-8">
            <span className="text-xs text-gray-500">
              Net P&L
            </span>
  
            <span
              className={`text-sm font-bold ${
                item.netPnL >= 0
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {formatCurrency(item.netPnL)}
            </span>
          </div>
        </div>
      );
    };
  
    if (!chartData.length) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold mb-5">
            Profit by Session
          </h3>
  
          <div className="h-[320px] flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">
                No session data available.
              </p>
  
              <p className="mt-1 text-xs text-gray-400">
                Add trades with London, Asia, or New York sessions.
              </p>
            </div>
          </div>
        </div>
      );
    }
  
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
  
        <h3 className="text-lg font-semibold mb-5">
          Profit by Session
        </h3>
  
        <ResponsiveContainer
          width="100%"
          height={320}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              top: 10,
              right: 65,
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
              tick={{
                fontSize: 12,
                fill: "#64748B",
              }}
              axisLine={{
                stroke: "#CBD5E1",
              }}
              tickLine={false}
              tickFormatter={(value) => {
                const number = Number(value || 0);
  
                if (Math.abs(number) >= 1000) {
                  return `$${number / 1000}k`;
                }
  
                return `$${number}`;
              }}
            />
  
            <YAxis
              type="category"
              dataKey="session"
              width={90}
              tick={{
                fontSize: 13,
                fill: "#475569",
              }}
              axisLine={{
                stroke: "#CBD5E1",
              }}
              tickLine={false}
            />
  
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                fill: "rgba(124, 58, 237, 0.04)",
              }}
            />
  
            <Bar
              dataKey="netPnL"
              barSize={48}
              radius={[0, 8, 8, 0]}
            >
  
              {chartData.map((item, index) => (
                <Cell
                  key={`session-${item.session}-${index}`}
                  fill={
                    item.netPnL < 0
                      ? "#EF4444"
                      : COLORS[index % COLORS.length]
                  }
                />
              ))}
  
              <LabelList
                dataKey="netPnL"
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
      </div>
    );
  }