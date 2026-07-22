export function calculatePips(entry, stopLoss) {
    const e = Number(entry);
    const sl = Number(stopLoss);
  
    if (isNaN(e) || isNaN(sl)) return 0;
  
    return Math.abs(e - sl) * 10000;
  }