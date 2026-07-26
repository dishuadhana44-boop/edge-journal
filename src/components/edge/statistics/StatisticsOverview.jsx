import {
    TrendingUp,
    Target,
    Activity,
    DollarSign,
    BarChart3,
    Award,
  } from "lucide-react";
  
  const cards = [
    {
      title: "Win Rate",
      value: "74%",
      icon: Target,
      color: "text-green-600",
    },
    {
      title: "Profit Factor",
      value: "2.31",
      icon: TrendingUp,
      color: "text-violet-600",
    },
    {
      title: "Average RR",
      value: "1 : 3.5",
      icon: Activity,
      color: "text-blue-600",
    },
    {
      title: "Net P&L",
      value: "+₹42,850",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Trades",
      value: "128",
      icon: BarChart3,
      color: "text-orange-600",
    },
    {
      title: "Discipline",
      value: "92%",
      icon: Award,
      color: "text-yellow-600",
    },
  ];
  
  export default function StatisticsOverview() {
    return (
      <div className="grid grid-cols-3 gap-3">
  
        {cards.map((card, index) => {
  
          const Icon = card.icon;
  
          return (
  
            <div
              key={index}
              className="
                bg-white
                rounded-2xl
                border
                border-gray-200
                p-5
              "
            >
  
              <div className="flex items-center justify-between">
  
                <div>
  
                  <p className="text-sm text-gray-500">
                    {card.title}
                  </p>
  
                  <h2 className="text-3xl font-bold mt-2">
                    {card.value}
                  </h2>
  
                </div>
  
                <div
                  className={`
                    h-12
                    w-12
                    rounded-xl
                    bg-gray-100
                    flex
                    items-center
                    justify-center
                    ${card.color}
                  `}
                >
                  <Icon size={22} />
                </div>
  
              </div>
  
            </div>
  
          );
  
        })}
  
      </div>
    );
  }