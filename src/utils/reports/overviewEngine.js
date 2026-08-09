// src/utils/reports/overviewEngine.js

export function generateOverviewReport(trades = []) {
    if (!trades.length) {
      return {
        netPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        profitFactor: 0,
        expectancy: 0,
        averageRR: 0,
        largestWin: 0,
        largestLoss: 0,
        averageWin: 0,
        averageLoss: 0,
      };
    }
  
    const pnlValues = trades.map((t) => Number(t.pnl || 0));
    const rrValues = trades.map((t) => Number(t.rr || 0));
  
    const grossProfit = pnlValues
      .filter((p) => p > 0)
      .reduce((a, b) => a + b, 0);
  
    const grossLoss = Math.abs(
      pnlValues
        .filter((p) => p < 0)
        .reduce((a, b) => a + b, 0)
    );
  
    const netPnL = grossProfit - grossLoss;
  
    const wins = pnlValues.filter((p) => p > 0).length;
    const losses = pnlValues.filter((p) => p < 0).length;
  
    const totalTrades = trades.length;
  
    const winRate =
      totalTrades === 0 ? 0 : (wins / totalTrades) * 100;
  
    const averageRR =
      rrValues.length === 0
        ? 0
        : rrValues.reduce((a, b) => a + b, 0) / rrValues.length;
  
    const averageWin =
      wins === 0 ? 0 : grossProfit / wins;
  
    const averageLoss =
      losses === 0 ? 0 : grossLoss / losses;
  
    const expectancy =
      totalTrades === 0
        ? 0
        : netPnL / totalTrades;
  
    const profitFactor =
      grossLoss === 0
        ? grossProfit > 0
          ? Infinity
          : 0
        : grossProfit / grossLoss;
  
    return {
      netPnL,
      grossProfit,
      grossLoss,
      totalTrades,
      wins,
      losses,
      winRate,
      averageRR,
      expectancy,
      profitFactor,
      largestWin: Math.max(...pnlValues, 0),
      largestLoss: Math.min(...pnlValues, 0),
      averageWin,
      averageLoss,
    };
  }