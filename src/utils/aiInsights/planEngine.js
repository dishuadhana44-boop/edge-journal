// src/utils/aiInsights/planEngine.js

export function analyzePlans(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return [];
  }

  const plans = {};

  trades.forEach((trade) => {
    const planId =
      trade?.reflection?.selectedPlanId ||
      trade?.selectedPlanId ||
      trade?.planId;

    const planName =
      trade?.reflection?.selectedPlanName ||
      trade?.planName ||
      trade?.plan ||
      "Unknown Plan";

    if (!planId && !trade?.planName && !trade?.plan) {
      return;
    }

    const key = String(planId || planName);

    if (!plans[key]) {
      plans[key] = {
        planId: planId || key,
        plan: planName,
        trades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        rrTotal: 0,
        rrCount: 0,
      };
    }

    const item = plans[key];

    item.trades += 1;

    const pnl = Number(
      String(trade?.pnl ?? 0).replace(/[₹,$+ ]/g, "")
    );

    if (Number.isFinite(pnl)) {
      item.netPnL += pnl;

      if (pnl > 0) {
        item.wins += 1;
        item.grossProfit += pnl;
      } else if (pnl < 0) {
        item.losses += 1;
        item.grossLoss += Math.abs(pnl);
      } else {
        item.breakeven += 1;
      }
    }

    const rr = Number(
      trade?.rr ??
      trade?.averageRR ??
      trade?.riskReward
    );

    if (Number.isFinite(rr) && rr !== 0) {
      item.rrTotal += rr;
      item.rrCount += 1;
    }
  });

  return Object.values(plans)
    .map((item) => {
      const winRate =
        item.trades > 0
          ? (item.wins / item.trades) * 100
          : 0;

      const profitFactor =
        item.grossLoss > 0
          ? item.grossProfit / item.grossLoss
          : item.grossProfit > 0
            ? Infinity
            : 0;

      const averageRR =
        item.rrCount > 0
          ? item.rrTotal / item.rrCount
          : 0;

      const expectancy =
        item.trades > 0
          ? item.netPnL / item.trades
          : 0;

      return {
        planId: item.planId,
        plan: item.plan,

        trades: item.trades,

        wins: item.wins,
        losses: item.losses,
        breakeven: item.breakeven,

        winRate: Number(winRate.toFixed(1)),

        netPnL: Number(item.netPnL.toFixed(2)),

        grossProfit: Number(
          item.grossProfit.toFixed(2)
        ),

        grossLoss: Number(
          item.grossLoss.toFixed(2)
        ),

        profitFactor:
          Number.isFinite(profitFactor)
            ? Number(profitFactor.toFixed(2))
            : Infinity,

        averageRR: Number(
          averageRR.toFixed(2)
        ),

        expectancy: Number(
          expectancy.toFixed(2)
        ),
      };
    })
    .sort((a, b) => b.netPnL - a.netPnL);
}