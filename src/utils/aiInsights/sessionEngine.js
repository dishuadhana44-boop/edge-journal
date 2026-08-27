// src/utils/aiInsights/sessionEngine.js

export function analyzeSessions(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return [];
  }

  const SESSION_NAMES = ["Asia", "London", "New York"];

  const getSession = (trade) => {
    const value = String(
      trade?.session ||
      trade?.tradingSession ||
      trade?.reflection?.session ||
      ""
    )
      .trim()
      .toLowerCase();

    if (value.includes("asia")) return "Asia";
    if (value.includes("london")) return "London";
    if (
      value.includes("new york") ||
      value.includes("newyork") ||
      value.includes("ny")
    ) {
      return "New York";
    }

    return null;
  };

  const result = SESSION_NAMES.map((session, index) => {
    const sessionTrades = trades.filter(
      (trade) => getSession(trade) === session
    );

    const tradeCount = sessionTrades.length;

    if (tradeCount === 0) {
      return {
        id: index + 1,
        session,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        netPnL: 0,
        averagePnL: 0,
        averageRR: 0,
        profitFactor: 0,
        bestTrade: 0,
        worstTrade: 0,
      };
    }

    const pnls = sessionTrades.map((trade) => {
      const value = String(trade?.pnl ?? 0)
        .replace(/[₹,$+ ]/g, "");

      return Number(value) || 0;
    });

    const wins = pnls.filter((pnl) => pnl > 0).length;
    const losses = pnls.filter((pnl) => pnl < 0).length;

    const netPnL = pnls.reduce(
      (total, pnl) => total + pnl,
      0
    );

    const grossProfit = pnls
      .filter((pnl) => pnl > 0)
      .reduce((total, pnl) => total + pnl, 0);

    const grossLoss = Math.abs(
      pnls
        .filter((pnl) => pnl < 0)
        .reduce((total, pnl) => total + pnl, 0)
    );

    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
        ? Infinity
        : 0;

    const rrValues = sessionTrades
      .map((trade) =>
        Number(
          trade?.rr ??
          trade?.riskReward ??
          trade?.averageRR ??
          0
        )
      )
      .filter((rr) => Number.isFinite(rr));

    const averageRR =
      rrValues.length > 0
        ? rrValues.reduce((a, b) => a + b, 0) /
          rrValues.length
        : 0;

    return {
      id: index + 1,
      session,

      trades: tradeCount,

      wins,
      losses,

      winRate: Number(
        ((wins / tradeCount) * 100).toFixed(1)
      ),

      netPnL: Number(netPnL.toFixed(2)),

      averagePnL: Number(
        (netPnL / tradeCount).toFixed(2)
      ),

      averageRR: Number(
        averageRR.toFixed(2)
      ),

      profitFactor:
        profitFactor === Infinity
          ? "∞"
          : Number(profitFactor.toFixed(2)),

      bestTrade: Math.max(...pnls),

      worstTrade: Math.min(...pnls),
    };
  });

  return result;
}