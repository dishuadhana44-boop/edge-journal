
  
  import {
    Wallet,
    TrendingDown,
    Target,
    BarChart3,
    PieChart,
    Activity,
  } from "lucide-react";
  
  const cards = [
    {
        title: "Account Balance",
        value: 18427.59,
        display: "$18,427.59",
        change: "+$1,250.75",
        color: "text-green-600",
        icon: Wallet,
        bg: "bg-purple-100",
        iconColor: "text-purple-600",
      
        chartData: [
          { value: 18 },
          { value: 19 },
          { value: 18.5 },
          { value: 20 },
          { value: 19.8 },
          { value: 21 },
        ],
      },
      {
        title: "Total Closed P&L",
      
        value: -3285.40,
      
        display: "-$3,285.40",
      
        valueColor:
          -3285.40 >= 0
            ? "text-green-600"
            : "text-red-600",
      
        change: "-$480.20",
      color: "text-red-600",
      icon: TrendingDown,
      bg: "bg-red-100",
      iconColor: "text-red-600",
      chartData: [
        { value: 30 },
        { value: 28 },
        { value: 24 },
        { value: 26 },
        { value: 20 },
        { value: 18 },
        { value: 19 },
      ],
      lineColor: "#EF4444",
    },
    {
        title: "Win Rate",
        value: 28.21,
        display: "28.21%",
        valueColor:
        28.21 >= 40
          ? "text-green-600"
          : "text-red-600",
        change: "-2.35%",
        icon: Target,
        bg: "bg-green-100",
        iconColor: "text-green-600",
      
        progress: 28.21,
      },
    {
      title: "Avg R Per Trade",
      value: "+0.42R",
      change: "+0.12R",
      color: "text-green-600",
      icon: BarChart3,
      bg: "bg-blue-100",
      iconColor: "text-blue-600",
      chartData: [
        { value: 10 },
        { value: 11 },
        { value: 12 },
        { value: 18 },
        { value: 16 },
        { value: 20 },
        { value: 19 },
      ],
      lineColor: "#3B82F6",
    },
    {
  title: "Profit Factor",
  value: 1.15,
  display: "1.15",
  change: "+0.23",
  icon: PieChart,
  bg: "bg-purple-100",
  iconColor: "text-purple-600",

  progress: 58,
},
    {
      title: "Expectancy",
      value: "-$12.45",
      change: "-$5.34",
      color: "text-red-600",
      icon: Activity,
      bg: "bg-red-100",
      iconColor: "text-red-600",
      chartData: [
        { value: 25 },
        { value: 23 },
        { value: 22 },
        { value: 20 },
        { value: 18 },
        { value: 16 },
        { value: 15 },
      ],
      lineColor: "#EF4444",
    },
  ];
  
  function StatCards() {
    return (
        <div className="grid grid-cols-6 gap-2 max-w-[1320px] mx-auto">
        {cards.map((card) => {
          const Icon = card.icon;
  
          return (
            <div
                 key={card.title}
                 className="bg-white rounded-xl border border-gray-200 px-3 py-2 h-[90px]"
                >
              <div className="flex items-start justify-between">
                <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-700">
                   {card.title}
                   </p>
  
                   <h2
  className={`text-[18px] font-bold mt-1 ${
    card.valueColor || "text-black"
  }`}
>
  {card.display || card.value}
</h2>
  
                  <p className="text-[14px] mt-1 text-green-500">
                    {card.change}
                  </p>
                </div>
  
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${card.bg}`}
                >
                  <Icon className={card.iconColor} size={16} />
                </div>
              </div>
  
            
            </div>
          );
        })}
      </div>
    );
  }
  
  export default StatCards;