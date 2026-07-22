export function calculateTotalPnL(trades = []) {

    return trades.reduce((total, trade) => {
      return total + Number(trade.pnl || 0);
    }, 0);
  
  }