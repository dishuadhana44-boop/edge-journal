import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    CartesianGrid,
  } from "recharts";
  
  const data = [
    { day: "1", equity: 10000 },
    { day: "2", equity: 10150 },
    { day: "3", equity: 10080 },
    { day: "4", equity: 10320 },
    { day: "5", equity: 10460 },
    { day: "6", equity: 10610 },
    { day: "7", equity: 10520 },
    { day: "8", equity: 10850 },
    { day: "9", equity: 11010 },
    { day: "10", equity: 11240 },
  ];
  
  export default function EquityCurve() {
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
  
            <button className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm">
              1M
            </button>
  
            <button className="px-3 py-1.5 rounded-lg border text-sm">
              3M
            </button>
  
            <button className="px-3 py-1.5 rounded-lg border text-sm">
              6M
            </button>
  
            <button className="px-3 py-1.5 rounded-lg border text-sm">
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
  
            <h2 className="text-3xl font-bold mt-1">
              $11,240
            </h2>
  
          </div>
  
          <div>
  
            <p className="text-gray-500 text-sm">
              Net Profit
            </p>
  
            <h2 className="text-3xl font-bold text-green-600 mt-1">
              +12.4%
            </h2>
  
          </div>
  
          <div>
  
            <p className="text-gray-500 text-sm">
              Max Drawdown
            </p>
  
            <h2 className="text-3xl font-bold text-red-500 mt-1">
              -3.1%
            </h2>
  
          </div>
  
        </div>
  
        {/* Chart */}
  
        <div className="h-[420px] p-6">
  
          <ResponsiveContainer width="100%" height="100%">
  
            <AreaChart data={data}>
  
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
                    stopColor="#7c3aed"
                    stopOpacity={0.4}
                  />
  
                  <stop
                    offset="95%"
                    stopColor="#7c3aed"
                    stopOpacity={0}
                  />
  
                </linearGradient>
  
              </defs>
  
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
              />
  
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
              />
  
              <Tooltip />
  
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#7c3aed"
                strokeWidth={3}
                fill="url(#equityFill)"
              />
  
            </AreaChart>
  
          </ResponsiveContainer>
  
        </div>
  
      </div>
    );
  }