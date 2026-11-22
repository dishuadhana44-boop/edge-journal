import { format } from "date-fns";

import {
  getPeriodStartingBalance,
  selectRealizedTrades,
} from "./dashboardCurveEngine.js";

// Reconstructed balance curve for the selected period. The series opens at the
// balance the account stood at when the period started, so zooming into a week
// shows a true continuation of the account's history instead of resetting to the
// starting balance. Built only from realised journal trades attributed to their
// close timestamp; this is a reconstruction from the journal, not broker balance
// history.
export function generateBalanceCurve(
  startingBalance = 0,
  trades = [],
  startDate = null,
  endDate = null
) {
  const baseline = getPeriodStartingBalance(trades, {
    startingBalance,
    startDate,
  });

  let balance = baseline;

  const curve = [
    {
      date: "Start",
      balance: baseline,
      equity: baseline,
      drawdown: 0,
      value: baseline,
      percent: 0,
      r: 0,
      pnl: 0,
    },
  ];

  selectRealizedTrades(trades, { startDate, endDate }).forEach(
    ({ trade, closedAt }) => {
      const pnl = Number(trade.pnl || 0);

      balance += pnl;

      const totalPnL = balance - baseline;

      curve.push({
        date: format(closedAt, "dd MMM"),
        balance,
        equity: balance,
        drawdown: 0,
        value: balance,
        percent:
          baseline === 0
            ? 0
            : Number(((totalPnL / baseline) * 100).toFixed(2)),
        r: Number((totalPnL / 100).toFixed(2)),
        pnl,
        closedAt,
        tradeId: trade.id,
      });
    }
  );

  // Peak-and-trough depth, measured from the same baseline the curve starts at.
  let peak = baseline;

  curve.forEach((item) => {
    if (item.balance > peak) {
      peak = item.balance;
    }

    item.drawdown =
      peak === 0
        ? 0
        : Number((((item.balance - peak) / peak) * 100).toFixed(2));
  });

  return curve;
}
