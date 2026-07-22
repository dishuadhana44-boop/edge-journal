export function calculatePeakBalance(trades = [], startingBalance = 0) {

    let currentBalance = startingBalance;
    let peakBalance = startingBalance;
  
    for (const trade of trades) {
  
      currentBalance += Number(trade.pnl || 0);
  
      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
      }
  
    }
  
    return peakBalance;
  
  }