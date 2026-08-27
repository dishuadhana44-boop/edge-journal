export function analyzePerformance(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      lossRate: 0,
      netPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      largestWin: 0,
      largestLoss: 0,
    };
  }

  const pnlValues = trades.map((trade) => {
    const value = Number(
      String(trade?.pnl ?? 0).replace(/[₹,$+ ]/g, "")
    );

    return Number.isFinite(value) ? value : 0;
  });

  const winningTrades = pnlValues.filter((pnl) => pnl > 0);
  const losingTrades = pnlValues.filter((pnl) => pnl < 0);
  const breakEvenTrades = pnlValues.filter((pnl) => pnl === 0);

  const totalTrades = pnlValues.length;

  const grossProfit = winningTrades.reduce(
    (sum, pnl) => sum + pnl,
    0
  );

  const grossLoss = Math.abs(
    losingTrades.reduce((sum, pnl) => sum + pnl, 0)
  );

  const netPnL = grossProfit - grossLoss;

  const winRate =
    totalTrades > 0
      ? (winningTrades.length / totalTrades) * 100
      : 0;

  const lossRate =
    totalTrades > 0
      ? (losingTrades.length / totalTrades) * 100
      : 0;

  const averageWin =
    winningTrades.length > 0
      ? grossProfit / winningTrades.length
      : 0;

  const averageLoss =
    losingTrades.length > 0
      ? grossLoss / losingTrades.length
      : 0;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const expectancy =
    totalTrades > 0
      ? netPnL / totalTrades
      : 0;

  const largestWin =
    winningTrades.length > 0
      ? Math.max(...winningTrades)
      : 0;

  const largestLoss =
    losingTrades.length > 0
      ? Math.min(...losingTrades)
      : 0;

  return {
    totalTrades,

    winningTrades: winningTrades.length,

    losingTrades: losingTrades.length,

    breakEvenTrades: breakEvenTrades.length,

    winRate: Number(winRate.toFixed(2)),

    lossRate: Number(lossRate.toFixed(2)),

    netPnL: Number(netPnL.toFixed(2)),

    grossProfit: Number(grossProfit.toFixed(2)),

    grossLoss: Number(grossLoss.toFixed(2)),

    averageWin: Number(averageWin.toFixed(2)),

    averageLoss: Number(averageLoss.toFixed(2)),

    profitFactor:
      Number.isFinite(profitFactor)
        ? Number(profitFactor.toFixed(2))
        : Infinity,

    expectancy: Number(expectancy.toFixed(2)),

    largestWin: Number(largestWin.toFixed(2)),

    largestLoss: Number(largestLoss.toFixed(2)),
  };
}