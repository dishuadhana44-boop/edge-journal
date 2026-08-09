export function generateCalendarHeatmap(trades = [], selectedMonth, selectedYear) {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  
    const dailyMap = {};
  
    trades.forEach((trade) => {
      if (!trade.date) return;
  
      const date = new Date(trade.date);
  
      if (
        date.getMonth() !== selectedMonth ||
        date.getFullYear() !== selectedYear
      ) {
        return;
      }
  
      const day = date.getDate();
  
      dailyMap[day] = (dailyMap[day] || 0) + Number(trade.pnl || 0);
    });
  
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      pnl: dailyMap[i + 1] || 0,
    }));
  }