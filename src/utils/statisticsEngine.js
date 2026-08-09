// src/utils/statisticsEngine.js



// -------------------------------
// Current Balance
// -------------------------------
export function calculateCurrentBalance(startingBalance = 0, trades = []) {
    const netPnL = calculateNetPnL(trades);
    return startingBalance + netPnL;
  }
  
  // -------------------------------
  // Net P&L
  // -------------------------------
  export function calculateNetPnL(trades = []) {
    return trades.reduce((total, trade) => {
      return total + Number(trade.pnl || 0);
    }, 0);
  }
  
  // -------------------------------
  // Total Trades
  // -------------------------------
  export function calculateTotalTrades(trades = []) {
    return trades.length;
  }
  
  // -------------------------------
  // Win Rate
  // -------------------------------
  export function calculateWinRate(trades = []) {
    if (trades.length === 0) return 0;
  
    const wins = trades.filter(
      (trade) => Number(trade.pnl) > 0
    ).length;
  
    return Number(((wins / trades.length) * 100).toFixed(2));
  }
  
  // -------------------------------
  // Average RR
  // -------------------------------
  export function calculateAverageRR(trades = []) {
    if (trades.length === 0) return 0;
  
    const totalRR = trades.reduce((sum, trade) => {
      return sum + Number(trade.rr || 0);
    }, 0);
  
    return Number((totalRR / trades.length).toFixed(2));
  }
  
  // -------------------------------
  // Profit Factor
  // -------------------------------
  export function calculateProfitFactor(trades = []) {
  
    let grossProfit = 0;
    let grossLoss = 0;
  
    trades.forEach((trade) => {
  
      const pnl = Number(trade.pnl || 0);
  
      if (pnl > 0) {
        grossProfit += pnl;
      }
  
      if (pnl < 0) {
        grossLoss += Math.abs(pnl);
      }
  
    });
  
    if (grossLoss === 0) {
      return grossProfit > 0 ? "∞" : 0;
    }
  
    return Number((grossProfit / grossLoss).toFixed(2));
  }

  // -------------------------------
// Expectancy
// -------------------------------
export function calculateExpectancy(trades = []) {

    if (trades.length === 0) return 0;
  
    const winningTrades = trades.filter(
      trade => Number(trade.pnl) > 0
    );
  
    const losingTrades = trades.filter(
      trade => Number(trade.pnl) < 0
    );
  
    const winRate = winningTrades.length / trades.length;
  
    const lossRate = losingTrades.length / trades.length;
  
    const avgWin =
      winningTrades.length === 0
        ? 0
        : winningTrades.reduce(
            (sum, trade) => sum + Number(trade.pnl),
            0
          ) / winningTrades.length;
  
    const avgLoss =
      losingTrades.length === 0
        ? 0
        : Math.abs(
            losingTrades.reduce(
              (sum, trade) => sum + Number(trade.pnl),
              0
            ) / losingTrades.length
          );
  
    return Number(
      (winRate * avgWin - lossRate * avgLoss).toFixed(2)
    );
  }