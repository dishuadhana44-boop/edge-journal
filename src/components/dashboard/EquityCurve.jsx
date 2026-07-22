import { useState } from "react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from "recharts";

import {
  Download,
  Settings2,
} from "lucide-react";

export default function EquityCurve() {

  const [period, setPeriod] = useState("30D");
  const [view, setView] = useState("$");

  const periods = [
    "1D",
    "1W",
    "1M",
    "1Y",
    "All",
  ];

  const equityData = [
    { date: "Dec 1", value: 5200 },
    { date: "Dec 3", value: 7100 },
    { date: "Dec 5", value: 6400 },
    { date: "Dec 7", value: 9800 },
    { date: "Dec 10", value: 7200 },
    { date: "Dec 14", value: 10500 },
    { date: "Dec 17", value: 13200 },
    { date: "Dec 20", value: 12800 },
    { date: "Dec 22", value: 11800 },
    { date: "Dec 24", value: 14100 },
    { date: "Dec 26", value: 13900 },
    { date: "Dec 28", value: 14700 },
  ];

  return (

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
{/* Header */}

<div className="flex items-center justify-between px-5 py-3 border-b">

  <div>

    <h2 className="text-lg font-semibold text-gray-900">
      Account Balance
    </h2>

    
  </div>

  <div className="flex items-center gap-1">

    {periods.map((item) => (

      <button
        key={item}
        onClick={() => setPeriod(item)}
        className={`px-2 py-1 rounded-lg text-xs transition ${
          period === item
            ? "bg-violet-600 text-white"
            : "hover:bg-gray-100"
        }`}
      >
        {item}
      </button>

    ))}

    <div className="w-px h-6 bg-gray-200 mx-1"></div>

    <button
      onClick={() => setView("$")}
      className={`w-8 h-8 rounded-lg text-xs ${
        view === "$"
          ? "bg-violet-600 text-white"
          : "border"
      }`}
    >
      $
    </button>

    <button
      onClick={() => setView("%")}
      className={`w-8 h-8 rounded-lg text-xs ${
        view === "%"
          ? "bg-violet-600 text-white"
          : "border"
      }`}
    >
      %
    </button>

    <button
      onClick={() => setView("R")}
      className={`w-8 h-8 rounded-lg text-xs ${
        view === "R"
          ? "bg-violet-600 text-white"
          : "border"
      }`}
    >
      R
    </button>

    <button className="w-8 h-8 border rounded-lg flex items-center justify-center">
      <Download size={14} />
    </button>

    <button className="w-8 h-8 border rounded-lg flex items-center justify-center">
      <Settings2 size={14} />
    </button>

  </div>

</div>

{/* Statistics */}

<div className="grid grid-cols-4 border-b">

  <div className="px-5 py-3">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Current Balance
    </p>

    <h2 className="text-xl font-bold text-gray-900">
      $18,427
    </h2>

  </div>

  <div className="px-5 py-3 border-l">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Peak Balance
    </p>

    <h2 className="text-xl font-bold text-green-600">
      $19,580
    </h2>

  </div>

  <div className="px-5 py-3 border-l">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Return
    </p>

    <h2 className="text-xl font-bold text-green-600">
      +84.27%
    </h2>

  </div>

  <div className="px-5 py-3 border-l">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Total P&L
    </p>

    <h2 className="text-xl font-bold text-green-600">
      +$8,427
    </h2>

  </div>

</div>

      {/* Chart */}

      <div className="h-[220px] px-3 pt-1 pb-0">

      <ResponsiveContainer width="100%" height="100%">

<AreaChart
data={equityData}
margin={{
  top: 5,
  right: 13,
  left: -25,
  bottom: -5,
}}
>

<defs>

<linearGradient
id="equityGradient"
x1="0"
y1="0"
x2="0"
y2="1"
>

<stop
offset="0%"
stopColor="#22C55E"
stopOpacity={0.35}
/>

<stop
offset="100%"
stopColor="#22C55E"
stopOpacity={0}
/>

</linearGradient>

</defs>

<CartesianGrid
vertical={false}
stroke="#F1F5F9"
/>

<XAxis
dataKey="date"
tickLine={false}
axisLine={false}
tick={{
fontSize:11,
fill:"#64748B",
}}
/>

<YAxis
tickLine={false}
axisLine={false}
width={55}
tickFormatter={(v)=>`$${(v/1000).toFixed(0)}k`}
tick={{
fontSize:11,
fill:"#64748B",
}}
/>

<Tooltip
contentStyle={{
borderRadius:14,
border:"1px solid #E5E7EB",
boxShadow:"0 10px 25px rgba(0,0,0,.08)",
}}
formatter={(value)=>[
`$${Number(value).toLocaleString()}`,
"Balance",
]}
/>

<Area

type="natural"

dataKey="value"

stroke="#22C55E"

strokeWidth={3.5}

fill="url(#equityGradient)"

dot={false}

activeDot={{
  r:8,
  fill:"#22C55E",
  stroke:"#ffffff",
  strokeWidth:4,
}}

animationDuration={1800}

/>

<ReferenceDot
  x="Dec 28"
  y={14700}
  r={6}
  fill="#22C55E"
  stroke="#fff"
  strokeWidth={3}
  label={{
    value: "Peak",
    position: "top",
    fill: "#16A34A",
    fontSize: 11,
    fontWeight: 600,
  }}
/>

<ReferenceDot
  x="Dec 24"
  y={14100}
  r={5}
  fill="#6366F1"
  stroke="#fff"
  strokeWidth={3}
  label={{
    value: "Current",
    position: "bottom",
    fill: "#6366F1",
    fontSize: 11,
    fontWeight: 600,
  }}
/>

</AreaChart>

</ResponsiveContainer>

</div>


</div>  

    

  );

}



