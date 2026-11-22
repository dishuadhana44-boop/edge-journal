import {
  calculateCurrentBalance,
  calculateNetPnL,
  calculateTotalTrades,
  calculateWinRate,
  calculateAverageRR,
  calculateProfitFactor,
  calculateExpectancy,
} from "../../utils/statisticsEngine";

import { selectRealizedTrades } from "../../utils/dashboardCurveEngine";

import {
  Wallet,
  TrendingDown,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Layers,
} from "lucide-react";

import { useDashboardFilter } from "../../context/DashboardFilterContext";

import { useMemo } from "react";

  

function StatCards({
  account,
  trades = [],
}) {

  const {
    sections,
    startDate,
    endDate,
  } = useDashboardFilter();

  // Closed trades that realised inside the applied date range — the one slice every
  // Dashboard metric and chart is built from.
  const periodTrades = useMemo(
    () =>
      selectRealizedTrades(trades, { startDate, endDate }).map(
        (entry) => entry.trade
      ),
    [trades, startDate, endDate]
  );

  // The balance is a current snapshot over the whole closed history. Restricting it
  // to the selected period would present a period result as the account's worth.
  const allTimeClosedTrades = useMemo(
    () => selectRealizedTrades(trades).map((entry) => entry.trade),
    [trades]
  );

  const accountBalance = calculateCurrentBalance(
    account?.startingBalance || 0,
    allTimeClosedTrades
  );
    
  const netPnL = calculateNetPnL(periodTrades);
    
  const winRate = calculateWinRate(periodTrades);
    
  const averageRR = calculateAverageRR(periodTrades);
    
  const profitFactor = calculateProfitFactor(periodTrades);
    
  const expectancy = calculateExpectancy(periodTrades);

  const totalTrades = calculateTotalTrades(periodTrades);
    
    const cards = [
      {
        section: "accountOverview",
        title: "Balance (All Time)",
        hint: `Current snapshot, not limited to the selected range: starting balance $${(
          Number(account?.startingBalance) || 0
        ).toLocaleString()} plus all ${allTimeClosedTrades.length} closed trades in the journal.`,
        value: accountBalance,
        display: `$${accountBalance.toLocaleString()}`,
        valueColor: "text-green-600",
        icon: Wallet,
        bg: "bg-purple-100",
        iconColor: "text-purple-600",
      },
    
      {
        section: "netPnl",
        title: "Total Closed P&L",
        hint: "Realised P&L of trades that closed inside the selected date range.",
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
        section: "winRate",
        title: "Win Rate",
        hint: "Share of closed trades in the selected date range that finished in profit.",
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
        section: "avgRisk",
        title: "Avg R Per Trade",
        hint: "Average planned risk-to-reward of closed trades in the selected date range.",
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
        section: "profitFactor",
        title: "Profit Factor",
        hint: "Gross profit divided by gross loss over the closed trades in the selected date range.",
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
        section: "expectancy",
        title: "Expectancy",
        hint: "Average realised result per closed trade in the selected date range.",
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
      {
        section: "totalTrades",
        title: "Total Trades",
        hint: "Closed trades in the selected date range. Open positions and pending orders are counted separately.",
        value: totalTrades,
        display: `${totalTrades}`,
        valueColor: "text-gray-900",
        icon: Layers,
        bg: "bg-indigo-100",
        iconColor: "text-indigo-600",
      },
    ].filter((card) => sections[card.section]);

    if (cards.length === 0) return null;

    return (
      <div className="grid w-full grid-cols-2 sm:grid-cols-6 lg:grid-cols-6 2xl:grid-cols-7 gap-3">
    
        {cards.map((card) => {
    
          const Icon = card.icon;
    
          return (
    
            <div
              key={card.title}
              className="flex min-h-[68px] min-w-0 items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3"
            >
    
                <div className="min-w-0 flex-1">
    
                  <p
                    className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                    title={card.hint || card.title}
                  >
                    {card.title}
                  </p>
    
                  <h2
                    className={`mt-1.5 truncate text-[16px] font-bold leading-tight ${
                      card.valueColor || "text-gray-900"
                    }`}
                    title={card.display}
                  >
                    {card.display}
                  </h2>
    
                </div>
    
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${card.bg}`}
                >
                  <Icon
                    className={card.iconColor}
                    size={15}
                  />
                </div>
    
            </div>
    
          );
    
        })}
    
      </div>
    );
  }
  
  export default StatCards;