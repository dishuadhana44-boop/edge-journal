export function calculateCurrentBalance(trades = [], startingBalance = 0) {

    if (!trades.length) {
      return startingBalance;
    }
  
    const totalPnL = trades.reduce((sum, trade) => {
      return sum + Number(trade.pnl || 0);
    }, 0);
  
    return startingBalance + totalPnL;
  
  }