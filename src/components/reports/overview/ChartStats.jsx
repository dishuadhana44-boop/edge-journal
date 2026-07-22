import {
    TrendingUp,
    Trophy,
    Target,
    Activity,
    BarChart3,
  } from "lucide-react";
  
  const stats = [
    {
      title: "Current Equity",
      value: "$23,400",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Peak Equity",
      value: "$23,800",
      icon: Trophy,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Net Return",
      value: "+138%",
      icon: Target,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "CAGR",
      value: "31.2%",
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "High Watermark",
      value: "$23,800",
      icon: BarChart3,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];
  
  export default function ChartStats() {
    return (
      <div className="grid grid-cols-5 border-b">
  
        {stats.map((item) => {
          const Icon = item.icon;
  
          return (
            <div
              key={item.title}
              className="px-5 py-4 border-r last:border-r-0 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
  
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.bg}`}
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