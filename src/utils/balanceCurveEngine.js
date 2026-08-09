import { format } from "date-fns";

export function generateBalanceCurve(
  startingBalance = 0,
  trades = [],
  startDate = null,
  endDate = null
) {
  let balance = Number(startingBalance);
  let equityValue = Number(startingBalance);

  const curve = [];

  // Start Point
  curve.push({
    date: "Start",
    balance,
    equity: equityValue,
    drawdown: 0,
    value: balance,
    percent: 0,
    r: 0,
    pnl: 0,
  });

  if (!trades.length) return curve;

  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  sortedTrades.forEach((trade) => {

    console.log(
      "Checking:",
      trade.date,
      new Date(trade.date),
      "Start:",
      startDate,
      "End:",
      endDate
    );
    
    const tradeDate = new Date(trade.date);
    
    if (startDate && tradeDate < startDate) {
      console.log("Skipped (before start)", trade.date);
      return;
    }
    
    if (endDate && tradeDate > endDate) {
      console.log("Skipped (after end)", trade.date);
      return;
    }
    
    console.log("Included:", trade.date);

    

    if (startDate && tradeDate < startDate) return;
    if (endDate && tradeDate > endDate) return;

    const pnl = Number(trade.pnl || 0);

    balance += pnl;
    equityValue = balance;

    const totalPnL = balance - startingBalance;

    curve.push({
      date: format(tradeDate, "dd MMM"),
      balance: balance,
      equity: equityValue, // <-- Yeh equity key add kar di gayi hai
      drawdown: 0,
      value: balance,
      percent:
        startingBalance === 0
          ? 0
          : Number(
              (
                (totalPnL / startingBalance) *
                100
              ).toFixed(2)
            ),
      r: Number((totalPnL / 100).toFixed(2)),
      pnl,
      tradeId: trade.id,
    });
  });

  // Drawdown Calculation
  let peak = startingBalance;

  curve.forEach((item) => {
    if (item.balance > peak) {
      peak = item.balance;
    }
    item.drawdown = Number(
      (
        ((item.balance - peak) / peak) * 100
      ).toFixed(2)
    );
  });

  return curve;
}