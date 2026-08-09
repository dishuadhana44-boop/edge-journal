import StatCard from "../shared/StatCard";
import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

import {
  calculateNetPnL,
  calculateWinRate,
  calculateAverageRR,
  calculateProfitFactor,
  calculateExpectancy,
} from "../../../utils/statisticsEngine";


  export default function OverviewKPIs() {

    const { trades } = useJournal();

    const netPnL = calculateNetPnL(trades);
    
    const grossProfit = trades
      .filter(t => Number(t.pnl) > 0)
      .reduce((sum, t) => sum + Number(t.pnl), 0);
    
    const grossLoss = trades
      .filter(t => Number(t.pnl) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.pnl)), 0);
    
    const totalTrades = trades.length;
    
    const totalWins = trades.filter(
      t => Number(t.pnl) > 0
    ).length;
    
    const totalLosses = trades.filter(
      t => Number(t.pnl) < 0
    ).length;
    
    const winRate = calculateWinRate(trades);
    
    const averageRR = calculateAverageRR(trades);
    
    const profitFactor = calculateProfitFactor(trades);
    
    const expectancy = calculateExpectancy(trades);
    
    const largestWin = totalWins
      ? Math.max(...trades.map(t => Number(t.pnl)))
      : 0;
    
    const largestLoss = totalLosses
      ? Math.min(...trades.map(t => Number(t.pnl)))
      : 0;
    
    const averageWin = totalWins
      ? grossProfit / totalWins
      : 0;
    
    const averageLoss = totalLosses
      ? grossLoss / totalLosses
      : 0;

  const stats = useMemo(() => {
    let netPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalRR = 0;
  
    let winTrades = 0;
    let lossTrades = 0;
  
    let largestWin = 0;
    let largestLoss = 0;
  
    trades.forEach((trade) => {
      const pnl = Number(
        String(trade.pnl)
          .replace(/\$/g, "")
          .replace(/,/g, "")
      );
  
      netPnL += pnl;
  
      if (pnl > 0) {
        grossProfit += pnl;
        winTrades++;
  
        if (pnl > largestWin)
          largestWin = pnl;
      }
  
      if (pnl < 0) {
        grossLoss += Math.abs(pnl);
        lossTrades++;
  
        if (Math.abs(pnl) > largestLoss)
          largestLoss = Math.abs(pnl);
      }
  
      totalRR += Number(trade.rr || 0);
    });
  
    const totalTrades = trades.length;
  
    const winRate =
      totalTrades === 0
        ? 0
        : (winTrades / totalTrades) * 100;
  
    const averageRR =
      totalTrades === 0
        ? 0
        : totalRR / totalTrades;
  
    const averageWin =
      winTrades === 0
        ? 0
        : grossProfit / winTrades;
  
    const averageLoss =
      lossTrades === 0
        ? 0
        : grossLoss / lossTrades;
  
    const expectancy =
      totalTrades === 0
        ? 0
        : netPnL / totalTrades;
  
    const profitFactor =
      grossLoss === 0
        ? grossProfit
        : grossProfit / grossLoss;
  
        return {
          netPnL,
          grossProfit,
          grossLoss,
          totalTrades,
          winTrades,
          lossTrades,
          winRate,
          averageRR,
          largestWin,
          largestLoss,
          averageWin,
          averageLoss,
          expectancy,
          profitFactor,
        };
  }, [trades]);

    return (

        <div className="grid grid-cols-6 gap-1">
        
        <StatCard
title="Net P&L"
value={`${netPnL >= 0 ? "+" : "-"}$${Math.abs(netPnL).toLocaleString()}`}
positive={netPnL >= 0}
color={
  stats.netPnL >= 0
    ? "text-green-600"
    : "text-red-500"
}
/>
        
<StatCard
title="Gross Profit"
value={`+$${grossProfit.toLocaleString()}`}
positive={true}
color="text-green-600"
/>
        
<StatCard
title="Gross Loss"
value={`-$${grossLoss.toLocaleString()}`}
positive={false}
color="text-red-500"
/>

<StatCard
title="Total Wins"
value={stats.winTrades}
color="text-green-600"
/>

<StatCard
title="Total Loss"
value={stats.lossTrades}
color="text-red-600"
/>
        
        <StatCard
        title="Win Rate"
        value={`${winRate}%`}
        
        positive={true}
        color="text-green-600"
        />
        
        <StatCard
        title="Profit Factor"
        value={profitFactor}
        
        positive={true}
        color="text-violet-600"
        />
        
        <StatCard
        title="Expectancy"
        value={`+$${expectancy}`}
        
        positive={true}
        color="text-green-600"
        />
        
        <StatCard
        title="Average RR"
        value={`${averageRR}R`}
        
        positive={true}
        color="text-blue-600"
        />
        
        <StatCard
        title="Trades"
        value={totalTrades}
        color="text-gray-900"
        />
        
        <StatCard
        title="Largest Win"
        value={`+$${largestWin.toLocaleString()}`}

        color="text-green-600"
        />
        
        <StatCard
        title="Largest Loss"
        value={`-$${Math.abs(largestLoss).toLocaleString()}`}
        color="text-red-500"
        />
        
       
        
        </div>
        
        );
  }