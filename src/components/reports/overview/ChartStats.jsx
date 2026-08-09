import {
    TrendingUp,
    Trophy,
    Target,
    Activity,
    BarChart3,
  } from "lucide-react";

  import {
    calculateNetPnL,
  } from "../../../utils/statisticsEngine";

  export default function ChartStats({
    trades,
    startingBalance,
    equityData,
  }) {
  
    const currentEquity =
    equityData.length > 0
      ? equityData[equityData.length - 1].value
      : startingBalance;

  const peakEquity =
    equityData.length > 0
      ? Math.max(...equityData.map(i => i.value))
      : startingBalance;

  const netPnL =
    calculateNetPnL(trades);

  const returnPercent =
    (
      ((currentEquity - startingBalance) /
        startingBalance) *
      100
    ).toFixed(2);

const stats = [

{
title:"Current Equity",
value:`$${currentEquity.toLocaleString()}`,
icon:TrendingUp,
color:"text-green-600",
bg:"bg-green-50",
},

{
title:"Peak Equity",
value:`$${peakEquity.toLocaleString()}`,
icon:Trophy,
color:"text-yellow-600",
bg:"bg-yellow-50",
},

{
title:"Net Return",
value:`${returnPercent}%`,
icon:Target,
color:"text-violet-600",
bg:"bg-violet-50",
},

{
title:"Net P&L",
value:`${netPnL>=0?"+":"-"}$${Math.abs(netPnL).toLocaleString()}`,
icon:Activity,
color:netPnL>=0
?"text-green-600"
:"text-red-600",
bg:"bg-blue-50",
},

{
title:"High Watermark",
value:`$${peakEquity.toLocaleString()}`,
icon:BarChart3,
color:"text-orange-600",
bg:"bg-orange-50",
},

];
  


    return (
      <div className="grid grid-cols-5 border-b">
  
        {stats.map((item) => {
          const Icon = item.icon;
  
          return (
            <div
              key={item.title}
              className="px-5 py-2 border-r last:border-r-0 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
  
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.bg}`}
                >
                  <Icon
                    size={20}
                    className={item.color}
                  />
                </div>
  
                <div>
  
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">
                    {item.title}
                  </p>
  
                  <h2
                    className={`text-xl font-bold mt-1 ${item.color}`}
                  >
                    {item.value}
                  </h2>
  
                </div>
  
              </div>
            </div>
          );
        })}
  
      </div>
    );
  }