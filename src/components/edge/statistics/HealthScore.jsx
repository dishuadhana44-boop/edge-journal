import {
    ShieldCheck,
    Target,
    Activity,
    TrendingUp,
  } from "lucide-react";
  
  const scores = [
    {
      title: "Overall Health",
      value: "92",
      subtitle: "/100",
      icon: ShieldCheck,
      color: "bg-violet-100 text-violet-600",
    },
   
    {
      title: "Execution",
      value: "89%",
      icon: Activity,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Consistency",
      value: "91%",
      icon: TrendingUp,
      color: "bg-orange-100 text-orange-600",
    },
  ];
  
  export default function HealthScore() {
    return (
        
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
  
        {/* Header */}
  
        <div className="mb-6">
  
          <h2 className="text-xl font-bold">
            Plan Health Score
          </h2>
  
          
          
  
        </div>
  
        {/* Cards */}
  
        <div className="grid grid-cols-3 gap-4">
  
          {scores.map((item, index) => {
  
            const Icon = item.icon;
  
            return (
  
              <div
                key={index}
                className="rounded-xl border border-gray-200 p-5"
              >
  
                <div className="flex items-center justify-between">
  
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${item.color}`}
                  >
                    <Icon size={18} />
                  </div>
  
                </div>
  
                <p className="text-gray-500 text-sm mt-5">
                  {item.title}
                </p>
  
                <div className="flex items-end gap-1 mt-2">
  
                  <h2 className="text-4xl font-bold">
                    {item.value}
                  </h2>
  
                  {item.subtitle && (
                    <span className="text-gray-400 mb-1">
                      {item.subtitle}
                    </span>
                  )}
  
                </div>
  
              </div>
  
            );
  
          })}
  
        </div>
  
      </div>
    );
  }