import { useState } from "react";
import { useEffect } from "react";
import { format } from "date-fns";
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

  const [chartFilter, setChartFilter] = useState(null);

  useEffect(() => {
    setChartFilter(null);
  }, [startDate, endDate]);

  const effectiveRange = chartFilter
  ? getDateRange(chartFilter)
  : {
      startDate,
      endDate,
    };

  const startingBalance = Number(account?.startingBalance) || 0;

  const balanceCurve = generateBalanceCurve(
    startingBalance,
    trades,
    effectiveRange.startDate,
    effectiveRange.endDate
  );

  // The curve opens at the balance the account stood at when the period started, so
  // the header reads the period's own baseline instead of the lifetime starting
  // balance. It is a reconstruction from realised journal trades, not broker equity
  // history.
  const periodBaseline = balanceCurve[0]?.balance ?? startingBalance;

  const currentBalance =
    balanceCurve[balanceCurve.length - 1]?.value ?? periodBaseline;

  const peakBalance = balanceCurve.length
    ? Math.max(...balanceCurve.map((point) => point.value))
    : periodBaseline;

  const totalPnL = currentBalance - periodBaseline;

  const returnPercent = periodBaseline
    ? ((totalPnL / periodBaseline) * 100).toFixed(2)
    : 0;

  const baselineNote = `Reconstructed from the journal: $${periodBaseline.toLocaleString()} at the start of ${format(
    effectiveRange.startDate,
    "dd MMM yyyy"
  )} – ${format(
    effectiveRange.endDate,
    "dd MMM yyyy"
  )}, advanced by each closed trade in close-timestamp order. Not broker equity history.`;

  // Without a recorded starting balance there is no honest baseline to plot from, so
  // the curve states the limitation instead of inventing one.
  const hasBaseline = startingBalance > 0;

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

    <div className="h-full min-h-0 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
{/* Header */}

<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 border-b border-gray-100 shrink-0">

  <div className="min-w-0">

    <h2 className="text-base font-semibold text-gray-900">
      Account Balance
    </h2>


  </div>

  <div className="flex flex-wrap items-center gap-1">

    {periods.map((item) => (

      <button
        key={item}
        onClick={() => setChartFilter(item)}
        className={`px-2 py-1 whitespace-nowrap rounded-lg text-xs transition ${
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

<div className="grid grid-cols-4 border-b border-gray-100 shrink-0">

  <div className="min-w-0 px-3.5 py-2.5">

    <p className="truncate text-[10px] uppercase tracking-wide text-gray-500" title={baselineNote}>
      Balance at period end
    </p>

    <h2 className="truncate text-[17px] font-bold tabular-nums text-gray-900" title={`$${currentBalance.toLocaleString()}`}>
    ${currentBalance.toLocaleString()}
    </h2>

  </div>

  <div className="min-w-0 px-3.5 py-2.5 border-l border-gray-100">

    <p className="truncate text-[10px] uppercase tracking-wide text-gray-500" title={`Highest reconstructed balance within the selected range. ${baselineNote}`}>
      Peak Balance
    </p>

    <h2 className="truncate text-[17px] font-bold tabular-nums text-green-600" title={`$${peakBalance.toLocaleString()}`}>
    ${peakBalance.toLocaleString()}
    </h2>

  </div>

  <div className="min-w-0 px-3.5 py-2.5 border-l border-gray-100">

    <p className="truncate text-[10px] uppercase tracking-wide text-gray-500" title="Return over the selected range, measured from the balance at its opening.">
      Return
    </p>

    <h2 className={`truncate text-[17px] font-bold tabular-nums ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
    {returnPercent >= 0 ? "+" : ""}
{returnPercent}%
    </h2>

  </div>

  <div className="min-w-0 px-3.5 py-2.5 border-l border-gray-100">

    <p className="truncate text-[10px] uppercase tracking-wide text-gray-500" title="Realised P&L of trades that closed inside the selected range.">
      Total P&L
    </p>

    <h2 className={`truncate text-[17px] font-bold tabular-nums ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
    {totalPnL >= 0 ? "+" : "-"}$
    {Math.abs(totalPnL).toLocaleString()}
    </h2>

  </div>

</div>

      {/* Chart */}

      <div className="flex-1 min-h-[150px] px-3 pt-3 pb-2">

      {equityData.length <= 1 || !hasBaseline ? (

<div className="flex h-full items-center justify-center px-4 text-center text-xs leading-relaxed text-gray-500">

  {!hasBaseline
    ? "This trading account has no starting balance recorded, so the reconstructed equity curve has no baseline to plot from."
    : "No trades closed in the selected date range."}

</div>

) : (

      <ResponsiveContainer width="100%" height="100%">

<AreaChart
  data={equityData}
  margin={{
    top: 8,
    right: 12,
    left: 0,
    bottom: 0,
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
axisLine={{ stroke: "#E2E8F0" }}
tickMargin={6}
height={24}
minTickGap={16}
interval="preserveStartEnd"
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
    if (view === "%") return periodBaseline ? `${(((v - periodBaseline) / periodBaseline) * 100).toFixed(1)}%` : "—";

    if (view === "R") return `${(v / 100).toFixed(1)}R`;

    return `$${(v / 1000).toFixed(0)}k`;
  }}
  tick={{
    fontSize: 11,
    fill: "#64748B",
  }}
/>



<Tooltip
allowEscapeViewBox={{ x: false, y: false }}
wrapperStyle={{ zIndex: 20 }}
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



