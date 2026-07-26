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
  
  export default function TradeDistributionChart({ data }) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={75}
            outerRadius={105}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={COLORS[index]}
              />
            ))}
          </Pie>
  
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }