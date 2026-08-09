export function filterTradesByPeriod(
    trades,
    period
  ) {
  
    if (period === "ALL")
      return trades;
  
    const today = new Date();
  
    let days = 0;
  
    switch (period) {
  
      case "1D":
        days = 1;
        break;
  
      case "1W":
        days = 7;
        break;
  
      case "1M":
        days = 30;
        break;
  
      case "3M":
        days = 90;
        break;
  
      case "6M":
        days = 180;
        break;
  
      case "1Y":
        days = 365;
        break;
  
      default:
        return trades;
  
    }
  
    const start = new Date();
  
    start.setDate(today.getDate() - days);
  
    return trades.filter((trade) => {
  
      const tradeDate = new Date(trade.date);
  
      return tradeDate >= start;
  
    });
  
  }