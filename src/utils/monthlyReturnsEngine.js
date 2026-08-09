export function generateMonthlyReturns(trades = [], selectedYear) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
  
    const monthlyMap = Array(12).fill(0);
  
    trades.forEach((trade) => {
      if (!trade.date) return;
  
      const tradeDate = new Date(trade.date);

      if (selectedYear && tradeDate.getFullYear() !== selectedYear) {
        return;
      }
      
      const month = tradeDate.getMonth();
      monthlyMap[month] += Number(trade.pnl || 0);
    });
  
    const data = months.map((month, index) => ({
      month,
      return: monthlyMap[index],
    }));
  
    const values = data.map((m) => m.return);
  
    return {
      data,
      bestMonth: values.length ? Math.max(...values) : 0,
      worstMonth: values.length ? Math.min(...values) : 0,
      positiveMonths: values.filter((v) => v > 0).length,
      negativeMonths: values.filter((v) => v < 0).length,
    };
  }