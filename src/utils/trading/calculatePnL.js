export function calculatePnL(

    side,
    entry,
    current,
    lots
  
  ) {
  
    const pipValue = 10;
  
    const pipSize = 0.0001;
  
    const pips =
      side === "BUY"
        ? (current - entry) / pipSize
        : (entry - current) / pipSize;
  
    return pips * pipValue * lots;
  
  }