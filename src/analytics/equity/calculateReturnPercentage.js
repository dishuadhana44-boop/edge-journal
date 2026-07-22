export function calculateReturnPercentage(
    trades = [],
    startingBalance = 0
  ) {
  
    if (startingBalance <= 0) {
      return 0;
    }
  
    const totalPnL = trades.reduce((total, trade) => {
      return total + Number(trade.pnl || 0);
    }, 0);
  
    const returnPercentage =
      (totalPnL / startingBalance) * 100;
  
    return Number(returnPercentage.toFixed(2));
  
  }