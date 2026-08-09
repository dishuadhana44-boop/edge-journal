import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
  } from "recharts";
  
  
  import MonthlyReturnsTooltip from "./MonthlyReturnsTooltip";
  
  export default function MonthlyReturnsChart({ data }) {
    return (
      <div className="h-[250px]">
  
        <ResponsiveContainer width="100%" height="100%">
  
        <BarChart data={data}>
  
            <CartesianGrid
              vertical={false}
              stroke="#F1F5F9"
            />
  
  <XAxis
  dataKey="month"
  interval={0}
  tickLine={false}
  axisLine={false}
  tick={{
    fontSize: 12,
    fill: "#64748B",
  }}
/>
  
<YAxis
  tickFormatter={(v) => `$${v.toLocaleString()}`}
  tickLine={false}
  axisLine={false}
/>
  
            <Tooltip content={<MonthlyReturnsTooltip />} />
  
            <Bar
              dataKey="return"
              radius={[6, 6, 0, 0]}
            >
              {data.map((item, index) => (
                <Cell
                  key={index}
                  fill={
                    item.return >= 0
                      ? "#22C55E"
                      : "#EF4444"
                  }
                />
              ))}
            </Bar>
  
          </BarChart>
  
        </ResponsiveContainer>
  
      </div>
    );
  }