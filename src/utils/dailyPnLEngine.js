import { format } from "date-fns";

export function generateDailyPnL(trades = []) {
  const map = {};

  trades.forEach((trade) => {
    const date = new Date(trade.date);

    const day = format(date, "EEE");

    if (!map[day]) {
      map[day] = 0;
    }

    map[day] += Number(trade.pnl || 0);
  });

  const order = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];

  const data = order.map((day) => ({
    day,
    pnl: Number((map[day] || 0).toFixed(2)),
  }));

  const values = data.map((d) => d.pnl);

  const average =
    values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;

  const bestDay = Math.max(...values);

  const worstDay = Math.min(...values);

  const today = format(new Date(), "EEE");

  const todayPnL =
    data.find((d) => d.day === today)?.pnl || 0;

  return {
    todayPnL,
    average,
    bestDay,
    worstDay,
    data,
  };
}