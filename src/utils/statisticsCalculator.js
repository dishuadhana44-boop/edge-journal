export function generateTradingStatistics(trades = []) {
    const totalPnL = trades.reduce(
      (sum, trade) => sum + Number(trade.pnl || 0),
      0
    );
  
    const winningTrades = trades.filter(
      (trade) => Number(trade.pnl) > 0
    );
  
    const losingTrades = trades.filter(
      (trade) => Number(trade.pnl) < 0
    );
  
    const breakEvenTrades = trades.filter(
      (trade) => Number(trade.pnl) === 0
    );
  
    const averageWinningTrade =
      winningTrades.length > 0
        ? winningTrades.reduce(
            (sum, trade) => sum + Number(trade.pnl),
            0
          ) / winningTrades.length
        : 0;
  
    const averageLosingTrade =
      losingTrades.length > 0
        ? losingTrades.reduce(
            (sum, trade) => sum + Number(trade.pnl),
            0
          ) / losingTrades.length
        : 0;
  
    const largestProfit =
      winningTrades.length > 0
        ? Math.max(...winningTrades.map((trade) => Number(trade.pnl)))
        : 0;
  
    const largestLoss =
      losingTrades.length > 0
        ? Math.min(...losingTrades.map((trade) => Number(trade.pnl)))
        : 0;
  
    const grossProfit = winningTrades.reduce(
      (sum, trade) => sum + Number(trade.pnl),
      0
    );
  
    const grossLoss = Math.abs(
      losingTrades.reduce(
        (sum, trade) => sum + Number(trade.pnl),
        0
      )
    );
  
    const profitFactor =
      grossLoss === 0
        ? 0
        : Number((grossProfit / grossLoss).toFixed(2));
  
// Daily P&L by date
const dailyMap = {};

trades.forEach((trade) => {
  if (!trade.date) return;

  dailyMap[trade.date] =
    (dailyMap[trade.date] || 0) + Number(trade.pnl || 0);
});

const dailyPnL = Object.values(dailyMap);

const tradingDays = dailyPnL.length;

const winningDays = dailyPnL.filter((pnl) => pnl > 0).length;

const losingDays = dailyPnL.filter((pnl) => pnl < 0).length;

const breakevenDays = dailyPnL.filter((pnl) => pnl === 0).length;

const averageDailyPnL =
  tradingDays > 0 ? totalPnL / tradingDays : 0;

const largestWinningDay =
  tradingDays > 0 ? Math.max(...dailyPnL) : 0;

const largestLosingDay =
  tradingDays > 0 ? Math.min(...dailyPnL) : 0;

// Win streak
let maxWinStreak = 0;
let currentWinStreak = 0;

dailyPnL.forEach((pnl) => {
  if (pnl > 0) {
    currentWinStreak++;
    maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
  } else {
    currentWinStreak = 0;
  }
});

// Loss streak
let maxLossStreak = 0;
let currentLossStreak = 0;

dailyPnL.forEach((pnl) => {
  if (pnl < 0) {
    currentLossStreak++;
    maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
  } else {
    currentLossStreak = 0;
  }
});

const leftStats = [
    { label: "Total P&L", value: `$${totalPnL.toLocaleString()}` },
  
    { label: "Average Daily Volume", value: "$0.00" },
  
    {
      label: "Average Winning Trade",
      value: `$${averageWinningTrade.toFixed(2)}`,
      color: "text-green-600",
    },
  
    {
      label: "Average Losing Trade",
      value: `$${averageLosingTrade.toFixed(2)}`,
      color: "text-red-500",
    },
  
    { label: "Total Trades", value: trades.length },
  
    { label: "Winning Trades", value: winningTrades.length },
  
    { label: "Losing Trades", value: losingTrades.length },
  
    { label: "Break Even Trades", value: breakEvenTrades.length },
  
    { label: "Max Consecutive Wins", value: maxWinStreak },
  
    { label: "Max Consecutive Losses", value: maxLossStreak },
  
    { label: "Commission", value: "$0.00" },
  
    { label: "Fees", value: "$0.00" },
  
    { label: "Swap", value: "$0.00" },
  
    {
      label: "Largest Profit",
      value: `$${largestProfit.toLocaleString()}`,
      color: "text-green-600",
    },
  
    {
      label: "Largest Loss",
      value: `$${largestLoss.toLocaleString()}`,
      color: "text-red-500",
    },
  
    { label: "Average Hold Time", value: "0m" },
  
    { label: "Average Winner Hold", value: "0m" },
  
    { label: "Average Loser Hold", value: "0m" },
  
    { label: "Average Scratch Hold", value: "0m" },
  
    {
      label: "Average Trade P&L",
      value: `$${(trades.length ? totalPnL / trades.length : 0).toFixed(2)}`,
    },
  
    {
      label: "Profit Factor",
      value: profitFactor.toFixed(2),
    },
  ];
  
  const averageWinningDay =
    winningDays > 0
      ? dailyPnL.filter((p) => p > 0).reduce((a, b) => a + b, 0) / winningDays
      : 0;
  
  const averageLosingDay =
    losingDays > 0
      ? dailyPnL.filter((p) => p < 0).reduce((a, b) => a + b, 0) / losingDays
      : 0;
  
  const rightStats = [
    { label: "Open Trades", value: 0 },
  
    { label: "Trading Days", value: tradingDays },
  
    { label: "Winning Days", value: winningDays },
  
    { label: "Losing Days", value: losingDays },
  
    { label: "Breakeven Days", value: breakevenDays },
  
    { label: "Logged Days", value: tradingDays },
  
    { label: "Max Winning Days", value: maxWinStreak },
  
    { label: "Max Losing Days", value: maxLossStreak },
  
    {
      label: "Average Daily P&L",
      value: `$${averageDailyPnL.toFixed(2)}`,
    },
  
    {
      label: "Average Winning Day",
      value: `$${averageWinningDay.toFixed(2)}`,
      color: "text-green-600",
    },
  
    {
      label: "Average Losing Day",
      value: `$${averageLosingDay.toFixed(2)}`,
      color: "text-red-500",
    },
  
    {
      label: "Largest Winning Day",
      value: `$${largestWinningDay.toLocaleString()}`,
      color: "text-green-600",
    },
  
    {
      label: "Largest Losing Day",
      value: `$${largestLosingDay.toLocaleString()}`,
      color: "text-red-500",
    },
  
    { label: "Average Planned R", value: "0R" },
  
    { label: "Average Realized R", value: "0R" },
  
    {
      label: "Trade Expectancy",
      value: `$${(trades.length ? totalPnL / trades.length : 0).toFixed(2)}`,
    },
  
    {
      label: "Max Drawdown",
      value: "$0.00",
      color: "text-red-500",
    },
  
    { label: "Max Drawdown %", value: "0%" },
  
    { label: "Average Drawdown", value: "$0.00" },
  
    { label: "Average Drawdown %", value: "0%" },
  ];
    return {
      leftStats,
      rightStats,
    };
  }