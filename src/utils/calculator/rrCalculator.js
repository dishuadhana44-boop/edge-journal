export function calculateRR(entry, stopLoss, takeProfit) {

    const risk =
      Math.abs(Number(entry) - Number(stopLoss));
  
    const reward =
      Math.abs(Number(takeProfit) - Number(entry));
  
    if (risk === 0) return 0;
  
    return reward / risk;
  
  }