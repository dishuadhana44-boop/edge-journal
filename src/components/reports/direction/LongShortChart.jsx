import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
  } from "recharts";
  
  export default function LongShortChart({ data }) {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 10,
            right: 30,
            left: 20,
            bottom: 10,
          }}
        >
          <CartesianGrid stroke="#F1F5F9" horizontal={false} />
  
          <XAxis type="number" />
  
          <YAxis
            type="category"
            dataKey="direction"
          />
  
          <Tooltip />
  
          <Bar
            dataKey="pnl"
            radius={[8, 8, 8, 8]}
            fill="#7C3AED"
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }