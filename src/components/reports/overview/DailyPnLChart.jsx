import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    CartesianGrid,
  } from "recharts";
  
  import DailyPnLData from "./DailyPnLData";
  import DailyPnLTooltip from "./DailyPnLTooltip";
  
  export default function DailyPnLChart() {
    return (
      <div className="h-[250px]">
  
        <ResponsiveContainer width="100%" height="100%">
  
          <BarChart
            data={DailyPnLData}
            margin={{
              top: 10,
              right: 10,
              left: -20,
              bottom: 0,
            }}
          >
  
            <CartesianGrid
              vertical={false}
              stroke="#F1F5F9"
            />
  
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
            />
  
            <YAxis
              tickLine={false}
              axisLine={false}
            />
  
            <Tooltip content={<DailyPnLTooltip />} />
  
            <Bar
              dataKey="pnl"
              radius={[6, 6, 0, 0]}
            >
  
              {DailyPnLData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.pnl >= 0
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