import { useState } from "react";
import { useEffect } from "react";
import {
  DATE_FILTERS,
  getDateRange,
} from "../../utils/dateRangeUtils";
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

import EquityTooltip from "./EquityTooltip";

import { useEquityCurveFilter } from "../../context/EquityCurveFilterContext";
import { generateBalanceCurve } from "../../utils/balanceCurveEngine";

import { useDashboardFilter } from "../../context/DashboardFilterContext";

export default function EquityCurve({
  account,
  trades = [],
}) {

  const {
    selectedFilter,
    startDate,
    endDate,
  } = useDashboardFilter();
  
  console.log("Dashboard Start:", startDate);
  console.log("Dashboard End:", endDate);
  

  useEffect(() => {
    setChartFilter(null);
  }, [startDate, endDate]);


  const [chartFilter, setChartFilter] = useState(null);
  console.log("Chart Filter =", chartFilter);
  const dashboardRange = getDateRange(selectedFilter);

  const effectiveRange = chartFilter
  ? getDateRange(chartFilter)
  : {
      startDate,
      endDate,
    };
    
  console.log("Chart Filter:", chartFilter);
  console.log("Effective Start:", effectiveRange.startDate);
  console.log("Effective End:", effectiveRange.endDate);
  const startingBalance =
  account?.startingBalance ?? 10000;

  console.log("Trades received in EquityCurve:", trades);
  console.log("Trade count:", trades.length);
  const balanceCurve = generateBalanceCurve(
    startingBalance,
    trades,
    effectiveRange.startDate,
    effectiveRange.endDate
);
console.log("Balance Curve:", balanceCurve);

  const currentBalance =
  balanceCurve.length > 0
    ? balanceCurve[balanceCurve.length-1].value
    : startingBalance;
  
    const peakBalance =
    balanceCurve.length > 0
      ? Math.max(...balanceCurve.map(i=>i.value))
      : startingBalance;
  
      const totalPnL = currentBalance - startingBalance;
  
      const returnPercent =
      startingBalance
        ? ((totalPnL / startingBalance) * 100).toFixed(2)
        : 0;

  const [view, setView] = useState("$");

  const periods = [
    "Today",
    "1W",
    "2W",
    "1M",
    "3M",
    "6M",
    "1Y",
    "ALL",
  ];

  const equityData = balanceCurve;

  const peakPoint =
  equityData.length > 0
    ? equityData.reduce((highest, point) =>
        point.value > highest.value
          ? point
          : highest
      )
    : {
        date: "",
        value: 0,
        percent: 0,
        r: 0,
      };

  return (

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
{/* Header */}

<div className="flex items-center justify-between px-5 py-4 border-b">

  <div>

    <h2 className="text-lg font-semibold text-gray-900">
      Account Balance
    </h2>

    
  </div>

  <div className="flex items-center gap-1">

    {periods.map((item) => (

      <button
        key={item}
        onClick={() => {
          console.log("Clicked:", item);
          setChartFilter(item);
        }}
        className={`px-2 py-1 rounded-lg text-xs transition ${
          chartFilter === item
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
    ${currentBalance.toLocaleString()}
    </h2>

  </div>

  <div className="px-5 py-3 border-l">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Peak Balance
    </p>

    <h2 className="text-xl font-bold text-green-600">
    ${peakBalance.toLocaleString()}
    </h2>

  </div>

  <div className="px-5 py-3 border-l">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Return
    </p>

    <h2 className="text-xl font-bold text-green-600">
    {returnPercent >= 0 ? "+" : ""}
{returnPercent}%
    </h2>

  </div>

  <div className="px-5 py-3 border-l">

    <p className="text-[10px] uppercase tracking-wide text-gray-500">
      Total P&L
    </p>

    <h2 className="text-xl font-bold text-green-600">
    {totalPnL >= 0 ? "+" : "-"}$
    {Math.abs(totalPnL).toLocaleString()}
    </h2>

  </div>

</div>

      {/* Chart */}

      <div className="h-[280px] px-3 pt-1 pb-0">

      {equityData.length <= 1 ? (

<div className="flex h-[280px] items-center justify-center text-gray-400">

  No trades available

</div>

) : (

      <ResponsiveContainer width="100%" height="100%">

<AreaChart
  data={equityData}
  onMouseMove={() => console.log(equityData)}
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
  tickFormatter={(v) => {
    if (view === "%") return `${(((v - startingBalance) / startingBalance) * 100).toFixed(1)}%`;

    if (view === "R") return `${(v / 100).toFixed(1)}R`;

    return `$${(v / 1000).toFixed(0)}k`;
  }}
  tick={{
    fontSize: 11,
    fill: "#64748B",
  }}
/>



<Tooltip
content={<EquityTooltip view={view} />}
/>

<Area
type="natural"
dataKey={
  view === "$"
    ? "value"
    : view === "%"
    ? "percent"
    : "r"
}

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
  x={peakPoint.date}
  y={
    view === "$"
      ? peakPoint.value
      : view === "%"
      ? peakPoint.percent
      : peakPoint.r
  }
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
  x={equityData[equityData.length - 1]?.date}
  y={
    view === "$"
      ? equityData[equityData.length - 1]?.value
      : view === "%"
      ? equityData[equityData.length - 1]?.percent
      : equityData[equityData.length - 1]?.r
  }
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

)}
</div>


</div>  

    

  );

}



