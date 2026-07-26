import {
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ReferenceDot,
  } from "recharts";
  
  import OverviewEquityData from "./OverviewEquityData";
  import CustomTooltip from "./CustomTooltip";
  
  export default function EquityChart() {
    return (
      <div className="h-[500px] p-5">
  
        <ResponsiveContainer width="100%" height="100%">
  
          <AreaChart
            data={OverviewEquityData}
            margin={{
              top: 15,
              right: 20,
              left: -20,
              bottom: 0,
            }}
          >
  
            {/* Gradient */}
            <defs>
  
              <linearGradient
                id="balanceGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#22C55E"
                  stopOpacity={0.30}
                />
  
                <stop
                  offset="100%"
                  stopColor="#22C55E"
                  stopOpacity={0}
                />
              </linearGradient>
  
              <linearGradient
                id="equityGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#3B82F6"
                  stopOpacity={0.25}
                />
  
                <stop
                  offset="100%"
                  stopColor="#3B82F6"
                  stopOpacity={0}
                />
              </linearGradient>
  
            </defs>
  
            <CartesianGrid
              stroke="#F1F5F9"
              vertical={false}
            />
  
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: "#64748B",
              }}
            />
  
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{
                fontSize: 11,
                fill: "#64748B",
              }}
            />

<Tooltip
  content={<CustomTooltip />}
/>

<Legend
  verticalAlign="top"
  align="right"
  iconType="circle"
/>

{/* Balance */}

<Area
  type="monotone"
  dataKey="balance"
  name="Balance"
  stroke="#22C55E"
  strokeWidth={3}
  fill="url(#balanceGradient)"
  dot={false}
  activeDot={{
    r: 7,
    stroke: "#22C55E",
    strokeWidth: 3,
    fill: "#fff",
  }}
  animationDuration={1200}
/>

{/* Equity */}

<Area
  type="monotone"
  dataKey="equity"
  name="Equity"
  stroke="#3B82F6"
  strokeWidth={3}
  fill="url(#equityGradient)"
  dot={false}
  activeDot={{
    r: 7,
    stroke: "#3B82F6",
    strokeWidth: 3,
    fill: "#fff",
  }}
  animationDuration={1200}
/>

{/* Peak */}

<ReferenceDot
  x="Dec"
  y={23800}
  r={6}
  fill="#22C55E"
  stroke="#fff"
  strokeWidth={3}
  label={{
    value: "Peak",
    position: "top",
    fill: "#22C55E",
    fontSize: 11,
    fontWeight: 600,
  }}
/>

{/* Current */}

<ReferenceDot
  x="Dec"
  y={23400}
  r={6}
  fill="#3B82F6"
  stroke="#fff"
  strokeWidth={3}
  label={{
    value: "Current",
    position: "bottom",
    fill: "#3B82F6",
    fontSize: 11,
    fontWeight: 600,
  }}
/>
  
          </AreaChart>
  
        </ResponsiveContainer>
  
      </div>
    );
  }