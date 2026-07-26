import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Cell,
  } from "recharts";
  
  const COLORS = [
    "#7C3AED",
    "#22C55E",
    "#3B82F6",
    "#F59E0B",
    "#EF4444",
  ];
  
  export default function InstrumentProfitChart({ data }) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
  
        <h3 className="text-lg font-semibold mb-4">
          Profit by Instrument
        </h3>
  
        <ResponsiveContainer width="100%" height={320}>
  
          <BarChart
            data={data}
            layout="vertical"
            margin={{
              top: 10,
              right: 20,
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
              tickFormatter={(v) => `$${v / 1000}k`}
            />
  
            <YAxis
              type="category"
              dataKey="instrument"
              width={90}
            />
  
            <Tooltip
              formatter={(value) => [
                `$${value.toLocaleString()}`,
                "Net P&L",
              ]}
            />
  
            <Bar
              dataKey="pnl"
              radius={[8, 8, 8, 8]}
            >
  
              {data.map((item, index) => (
  
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