export function getMonthlyJournalData(trades, year, month) {

    const monthTrades = trades.filter((trade) => {
  
      const d = new Date(trade.date);
  
      return (
        d.getFullYear() === year &&
        d.getMonth() === month
      );
  
    });
  
    const dayMap = {};
  
    monthTrades.forEach((trade) => {
  
      const key = trade.date;
  
      if (!dayMap[key]) {
  
        dayMap[key] = {
          date: key,
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };
  
      }
  
      dayMap[key].pnl += Number(trade.pnl);
  
      dayMap[key].trades++;
  
      if (trade.result === "Win") {
  
        dayMap[key].wins++;
  
      }
  
      if (trade.result === "Loss") {
  
        dayMap[key].losses++;
  
      }
  
    });
  
    return Object.values(dayMap);
  
  }