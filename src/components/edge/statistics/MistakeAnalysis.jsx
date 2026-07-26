import {
    AlertTriangle,
    Clock,
    TrendingDown,
    ShieldAlert,
    Flame,
    Brain,
  } from "lucide-react";
  
  const mistakes = [
    {
      icon: Flame,
      title: "FOMO Entries",
      count: 12,
      percent: 78,
      color: "bg-red-500",
    },
    {
      icon: Clock,
      title: "Late Entries",
      count: 8,
      percent: 52,
      color: "bg-orange-500",
    },
    {
      icon: TrendingDown,
      title: "Early Exit",
      count: 16,
      percent: 86,
      color: "bg-yellow-500",
    },
    {
      icon: ShieldAlert,
      title: "No Stop Loss",
      count: 3,
      percent: 22,
      color: "bg-pink-500",
    },
    {
      icon: Brain,
      title: "Revenge Trading",
      count: 5,
      percent: 41,
      color: "bg-violet-500",
    },
    {
      icon: AlertTriangle,
      title: "Rule Violations",
      count: 19,
      percent: 91,
      color: "bg-red-600",
    },
  ];
  
  export default function MistakeAnalysis() {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
  
        {/* Header */}
  
        <div className="p-6 border-b">
  
          <h2 className="text-xl font-bold">
            Mistake Analysis
          </h2>
  
         
  
        </div>
  
        <div className="p-6 space-y-6">
  
          {mistakes.map((item, index) => {
  
            const Icon = item.icon;
  
            return (
  
              <div key={index}>
  
                <div className="flex items-center justify-between mb-2">
  
                  <div className="flex items-center gap-3">
  
                    <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
  
                      <Icon size={18} />
  
                    </div>
  
                    <div>
  
                      <h4 className="font-medium">
                        {item.title}
                      </h4>
  
                      <p className="text-xs text-gray-500">
                        {item.count} trades
                      </p>
  
                    </div>
  
                  </div>
  
                  <span className="font-semibold">
                    {item.percent}%
                  </span>
  
                </div>
  
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
  
                  <div
                    className={`h-full ${item.color}`}
                    style={{
                      width: `${item.percent}%`,
                    }}
                  />
  
                </div>
  
              </div>
  
            );
  
          })}
  
        </div>
  
      </div>
    );
  }