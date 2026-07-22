import { useState } from "react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import {
  Download,
  Settings2,
} from "lucide-react";

export default function DrawdownCurve() {

  const [period, setPeriod] = useState("1M");

  const [mode, setMode] = useState("%");

  const periods = [
    "1D",
    "1W",
    "1M",
    "6M",
    "ALL",
  ];

  const drawdownData = [

    {
      day: "Mon",
      percent: -0.8,
      amount: -820,
    },

    {
      day: "Tue",
      percent: -2.1,
      amount: -2150,
    },

    {
      day: "Wed",
      percent: -1.4,
      amount: -1420,
    },

    {
      day: "Thu",
      percent: -3.8,
      amount: -3840,
    },

    {
      day: "Fri",
      percent: -2.7,
      amount: -2710,
    },

    {
      day: "Sat",
      percent: -5.4,
      amount: -5420,
    },

    {
      day: "Sun",
      percent: -3.2,
      amount: -3210,
    },

  ];

  return (

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}

      <div className="flex items-center justify-between px-5 py-2 border-b">

     {/* Left Side */}
        <div className="flex items-center gap-6">

          <h2 className="text-lg font-semibold">

            Drawdown Curve

          </h2>

          

      {/* Right Side */}
          <div className="flex ">

            {periods.map((item) => (

              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`
                  px-2
                  py-1
                  rounded-lg
                  text-xs
                  transition
                  ${
                    period === item
                      ? "bg-violet-600 text-white"
                      : "hover:bg-gray-100"
                  }
                `}
              >
                {item}
              </button>

            ))}

          </div>

        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => setMode("%")}
            className={`
              px-2
              py-1
              rounded-lg
              text-sm
              transition
              ${
                mode === "%"
                  ? "bg-red-600 text-white"
                  : "border"
              }
            `}
          >
            %
          </button>

          <button
            onClick={() => setMode("$")}
            className={`
              px-2
              py-1
              rounded-lg
              text-sm
              transition
              ${
                mode === "$"
                  ? "bg-red-600 text-white"
                  : "border"
              }
            `}
          >
            $
          </button>

        

        </div>

      </div>
      

      {/* Top Statistics */}

<div className="grid grid-cols-3 border-b">

<div className="px-4 py-2">

  <p className="text-[11px] uppercase tracking-wide text-gray-500">
    Current DD
  </p>

  <h2 className="text-xl font-bold text-red-600">
    -3.20%
  </h2>

  
</div>

<div className="px-4 py-2 border-l">

  <p className="text-[11px] uppercase tracking-wide text-gray-500">
    Max DD
  </p>

  <h2 className="text-xl font-bold text-red-700">
    -8.42%
  </h2>

 
</div>

<div className="px-4 py-2 border-l">

  <p className="text-[11px] uppercase tracking-wide text-gray-500">
    Avg DD
  </p>

  <h2 className="text-xl font-bold text-orange-500">
    -2.74%
  </h2>

 

</div>

</div>

{/* Chart */}

<div className="h-[235px] px-2 pt-2 pb-1">

  <ResponsiveContainer width="100%" height="100%">

    <AreaChart
      data={drawdownData}
      margin={{
        top: 8,
        right: 8,
        left: -18,
        bottom: -8,
      }}
    >

      <defs>

        <linearGradient
          id="drawdownFill"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >

          <stop
            offset="5%"
            stopColor="#EF4444"
            stopOpacity={0.35}
          />

          <stop
            offset="100%"
            stopColor="#EF4444"
            stopOpacity={0.05}
          />

        </linearGradient>

      </defs>

      <CartesianGrid
        stroke="#F1F5F9"
        vertical={false}
      />

      <XAxis
        dataKey="day"
        tickLine={false}
        axisLine={false}
        tickMargin={2}
        tick={{
          fill: "#64748B",
          fontSize: 11,
        }}
      />

      <YAxis
        tickLine={false}
        axisLine={false}
        width={50}
        tick={{
          fill: "#64748B",
          fontSize: 11,
        }}
        tickFormatter={(value) =>
          mode === "%"
            ? `${value}%`
            : `$${Math.abs(value)}`
        }
      />

      <Tooltip
        cursor={{
          stroke: "#EF4444",
          strokeWidth: 1,
          strokeDasharray: "5 5",
        }}
        contentStyle={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          boxShadow:
            "0 10px 25px rgba(0,0,0,.08)",
        }}
        formatter={(value) => [

          mode === "%"
            ? `${value}%`
            : `$${Math.abs(value)}`,

          "Drawdown",

        ]}
      />

      <Area
        type="natural"
        dataKey={
          mode === "%"
            ? "percent"
            : "amount"
        }
        stroke="#EF4444"
        strokeWidth={3}
        fill="url(#drawdownFill)"
        dot={false}
        activeDot={{
          r: 6,
          fill: "#EF4444",
          stroke: "#fff",
          strokeWidth: 3,
        }}
        isAnimationActive
        animationDuration={1500}
      />

    </AreaChart>

  </ResponsiveContainer>

</div>

</div>

);

}