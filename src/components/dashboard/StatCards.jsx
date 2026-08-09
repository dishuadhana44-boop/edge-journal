import {
  calculateCurrentBalance,
  calculateNetPnL,
  calculateWinRate,
  calculateAverageRR,
  calculateProfitFactor,
  calculateExpectancy,
} from "../../utils/statisticsEngine";

import {
  Wallet,
  TrendingDown,
  Target,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";



  
function StatCards({
  account,
  trades = [],
}) {

  const allTrades = trades || [];

  const accountBalance = calculateCurrentBalance(
    account?.startingBalance || 0,
    allTrades
  );
    
  const netPnL = calculateNetPnL(allTrades);
    
  const winRate = calculateWinRate(allTrades);
    
  const averageRR = calculateAverageRR(allTrades);
    
  const profitFactor = calculateProfitFactor(allTrades);
    
  const expectancy = calculateExpectancy(allTrades);
    
    const cards = [
      {
        title: "Account Balance",
        value: accountBalance,
        display: `$${accountBalance.toLocaleString()}`,
        valueColor: "text-green-600",
        icon: Wallet,
        bg: "bg-purple-100",
        iconColor: "text-purple-600",
      },
    
      {
        title: "Total Closed P&L",
        value: netPnL,
        display: `${netPnL >= 0 ? "+" : "-"}$${Math.abs(netPnL).toLocaleString()}`,
        valueColor:
          netPnL >= 0
            ? "text-green-600"
            : "text-red-600",
        icon: TrendingDown,
        bg: "bg-red-100",
        iconColor: "text-red-600",
      },
    
      {
        title: "Win Rate",
        value: winRate,
        display: `${winRate}%`,
        valueColor:
          winRate >= 40
            ? "text-green-600"
            : "text-red-600",
        icon: Target,
        bg: "bg-green-100",
        iconColor: "text-green-600",
      },
    
      {
        title: "Avg R Per Trade",
        value: averageRR,
        display: `${averageRR}R`,
        valueColor:
          averageRR >= 0
            ? "text-green-600"
            : "text-red-600",
        icon: BarChart3,
        bg: "bg-blue-100",
        iconColor: "text-blue-600",
      },
    
      {
        title: "Profit Factor",
        value: profitFactor,
        display: `${profitFactor}`,
        valueColor:
          profitFactor >= 1
            ? "text-green-600"
            : "text-red-600",
        icon: PieChart,
        bg: "bg-purple-100",
        iconColor: "text-purple-600",
      },
    
      {
        title: "Expectancy",
        value: expectancy,
        display: `${expectancy >= 0 ? "+" : "-"}$${Math.abs(expectancy)}`,
        valueColor:
          expectancy >= 0
            ? "text-green-600"
            : "text-red-600",
        icon: Activity,
        bg: "bg-red-100",
        iconColor: "text-red-600",
      },
    ];

    return (
      <div className="grid grid-cols-6 gap-1 max-w-[1320px] mx-auto">
    
        {cards.map((card) => {
    
          const Icon = card.icon;
    
          return (
    
            <div
              key={card.title}
              className="bg-white rounded-xl border border-gray-200 px-3 py-3 h-[90px]"
            >
    
              <div className="flex items-start justify-between">
    
                <div>
    
                  <p className="text-[12px] font-bold uppercase tracking-wide text-gray-900">
                    {card.title}
                  </p>
    
                  <h2
                    className={`text-[18px] font-bold mt-1 ${
                      card.valueColor || "text-black"
                    }`}
                  >
                    {card.display}
                  </h2>
    
                </div>
    
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${card.bg}`}
                >
                  <Icon
                    className={card.iconColor}
                    size={16}
                  />
                </div>
    
              </div>
    
            </div>
    
          );
    
        })}
    
      </div>
    );
  }
  
  export default StatCards;