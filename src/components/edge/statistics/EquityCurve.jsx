import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    CartesianGrid,
  } from "recharts";
  
  import { useState } from "react";
  
  export default function EquityCurve({ plan }) {

    const [range, setRange] = useState("ALL");

    const [startingCapital, setStartingCapital] = useState(() => {

      return Number(
        localStorage.getItem("startingCapital")
      ) || 10000;
    
    });

    const allTrades =
    JSON.parse(localStorage.getItem("trades")) || [];
  
  const planTrades = allTrades
    .filter(
      (trade) =>
        trade?.reflection?.selectedPlanId === plan?.id
    )
    .sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  
    let filteredTrades = [...planTrades];

    if (range !== "ALL") {
    
      const months =
        range === "1M"
          ? 1
          : range === "3M"
          ? 3
          : 6;
    
      const today = new Date();
    
      filteredTrades = planTrades.filter((trade) => {
    
        if (!trade.date) return true;
    
        const tradeDate = new Date(trade.date);
    
        const diffMonths =
          (today.getFullYear() - tradeDate.getFullYear()) * 12 +
          (today.getMonth() - tradeDate.getMonth());
    
        return diffMonths < months;
    
      });
    
    }
    
    let equity = startingCapital;
let highestEquity = startingCapital;

const chartData = filteredTrades.map((trade, index) => {

  const pnl = Number(
    String(trade.pnl).replace(/[₹,$,+ ]/g, "")
  );

  equity += isNaN(pnl) ? 0 : pnl;

  highestEquity = Math.max(highestEquity, equity);

  return {
    trade: index + 1,
    equity,
    peak: highestEquity,
    pnl,
    positive: pnl >= 0,
  };

});

  
  const currentEquity =
    chartData.length > 0
      ? chartData[chartData.length - 1].equity
      : 0;
  
      const totalPnL = equity - startingCapital;

      const lineColor =
  totalPnL >= 0
    ? "#22c55e"
    : "#ef4444";
  
  let peak = 0;
let maxDrawdown = 0;

chartData.forEach((point) => {

  if (point.equity > peak) {
    peak = point.equity;
  }

  if (peak > 0) {

    const dd =
      ((peak - point.equity) / peak) * 100;

    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }

  }

});

maxDrawdown = maxDrawdown.toFixed(2);

    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
  
        {/* Header */}
  
        <div className="flex items-center justify-between p-6 border-b">
  
          <div>
  
            <h2 className="text-xl font-bold">
              Equity Curve
            </h2>
  
            
  
          </div>
  
          <div className="flex gap-2">
  
          <button
onClick={() => setRange("1M")}
className={`

px-3 py-1.5 rounded-lg text-sm

${range==="1M"
?"bg-violet-600 text-white"
:"border bg-white"}

`}
>

1M

</button>
  
<button
onClick={() => setRange("3M")}
className={`

px-3 py-1.5 rounded-lg text-sm

${range==="3M"
?"bg-violet-600 text-white"
:"border bg-white"}

`}
>

3M

</button>
  
<button
onClick={() => setRange("6M")}
className={`

px-3 py-1.5 rounded-lg text-sm

${range==="6M"
?"bg-violet-600 text-white"
:"border bg-white"}

`}
>

6M

</button>
  
<button
onClick={() => setRange("ALL")}
className={`

px-3 py-1.5 rounded-lg text-sm

${range==="ALL"
?"bg-violet-600 text-white"
:"border bg-white"}

`}
>

ALL

</button>
  
          </div>
  
        </div>
  
        {/* Top Stats */}
  
        <div className="grid grid-cols-3 gap-6 p-6 border-b">
  
          <div>
  
            <p className="text-gray-500 text-sm">
              Current Equity
            </p>
  
            <h2
className={`text-3xl font-bold mt-1 ${
currentEquity >= 0
? "text-green-600"
: "text-red-600"
}`}
>

${currentEquity.toLocaleString()}

</h2>
  
          </div>
  
          <div>
  
            <p className="text-gray-500 text-sm">
              Net Profit
            </p>
  
            <h2
className={`text-3xl font-bold mt-1 ${
totalPnL >= 0
? "text-green-600"
: "text-red-600"
}`}
>

${totalPnL.toLocaleString()}

</h2>
  
          </div>
  
          <div>
  
            <p className="text-gray-500 text-sm">
              Max Drawdown
            </p>
  
            <h2 className="text-3xl font-bold text-red-500 mt-1">
            <span
className={
Number(maxDrawdown) > 0
? "text-red-600"
: "text-green-600"
}
>

-{maxDrawdown}%

</span>
            </h2>
  
          </div>
  
        </div>
  
        {/* Chart */}
  
        <div className="h-[420px] p-6">
  
        {chartData.length === 0 ? (

<div className="h-full flex items-center justify-center text-gray-400">

No trades for this plan yet

</div>

) : (

<ResponsiveContainer width="100%" height="100%">
  
          <AreaChart data={chartData}>

              <defs>
  
                <linearGradient
                  id="equityFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
  
  <stop
  offset="5%"
  stopColor={lineColor}
  stopOpacity={0.35}
/>

<stop
  offset="95%"
  stopColor={lineColor}
  stopOpacity={0}
/>
  
                </linearGradient>
  
              </defs>
  
              <CartesianGrid

stroke="#f1f1f1"

strokeDasharray="3 3"

vertical={false}

/>
  
  <XAxis
  dataKey="trade"
  tickLine={false}
  axisLine={false}
/>
  
<Tooltip

contentStyle={{

  borderRadius: 16,

  border: "none",

  boxShadow:
    "0 10px 30px rgba(0,0,0,.12)",

}}

formatter={(value) => [

  `₹${Number(value).toLocaleString()}`,

  "Equity",

]}

labelFormatter={(label) =>

  `Trade #${label}`

}

/>

<Area

type="natural"

dataKey="peak"

stroke="#94a3b8"

strokeWidth={2}

fillOpacity={0}

strokeDasharray="6 6"

isAnimationActive

/>
  
<Area

type="natural"

dataKey="equity"

stroke={lineColor}

strokeWidth={3}

fill="url(#equityFill)"

animationDuration={1200}

isAnimationActive

activeDot={{
  r: 8,
  stroke: lineColor,
  strokeWidth: 2,
}}

dot={(props) => {

  const { cx, cy, payload } = props;

  return (

    <circle

      cx={cx}

      cy={cy}

      r={4}

      fill={
        payload.positive
          ? "#22c55e"
          : "#ef4444"
      }

      stroke="white"

      strokeWidth={2}

    />

  );

}}

/>
  
            </AreaChart>
  
          </ResponsiveContainer>
)}
        </div>
  
      </div>
    );
  }