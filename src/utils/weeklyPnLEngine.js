import {
    startOfWeek,
    endOfWeek,
    format,
  } from "date-fns";
  
  export function generateWeeklyPnL(trades = []) {
    const weeks = {};
  
    trades.forEach((trade) => {
      const date = new Date(trade.date);
  
      const weekStart = startOfWeek(date, {
        weekStartsOn: 1,
      });
  
      const key = format(weekStart, "dd MMM");
  
      if (!weeks[key]) {
        weeks[key] = {
          week: key,
          start: weekStart,
          end: endOfWeek(date, {
            weekStartsOn: 1,
          }),
          pnl: 0,
        };
      }
  
      weeks[key].pnl += Number(trade.pnl || 0);
    });
  
    const data = Object.values(weeks).sort(
      (a, b) => a.start - b.start
    );
  
    const total =
      data.reduce((sum, item) => sum + item.pnl, 0);
  
    const average =
      data.length > 0 ? total / data.length : 0;
  
    const bestWeek =
      data.length > 0
        ? Math.max(...data.map((i) => i.pnl))
        : 0;
  
    const worstWeek =
      data.length > 0
        ? Math.min(...data.map((i) => i.pnl))
        : 0;
  
    const thisWeek =
      data.length > 0
        ? data[data.length - 1].pnl
        : 0;
  
    return {
      data,
      thisWeek,
      average,
      bestWeek,
      worstWeek,
    };
  }