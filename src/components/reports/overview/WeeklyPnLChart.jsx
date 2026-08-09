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
  

  import WeeklyPnLTooltip from "./WeeklyPnLTooltip";
  
  export default function WeeklyPnLChart({
    data,
  }) {

    return (
      <div className="h-[250px]">
  
        <ResponsiveContainer width="100%" height="100%">
  
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: -5,
              bottom: 0,
            }}
          >
  
            <CartesianGrid
              vertical={false}
              stroke="#F1F5F9"
            />
  
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
            />
  
            <YAxis
              tickLine={false}
              axisLine={false}
            />
  
            <Tooltip content={<WeeklyPnLTooltip />} />
  
            <Bar
              dataKey="pnl"
              radius={[6, 6, 0, 0]}
            >
  
                   {data.map((item, index) => (
                <Cell
                  key={index}
                  fill={
                    item.pnl >= 0
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