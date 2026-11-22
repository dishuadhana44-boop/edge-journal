// src/services/backtest/backtestStatistics.js
// Every number here is derived from the trades and equity points the
// SimulationEngine actually produced — nothing is seeded or assumed.

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

const SESSIONS = [
  { id: "asia", label: "Asia", from: 0, to: 7 },
  { id: "london", label: "London", from: 7, to: 16 },
  { id: "newyork", label: "New York", from: 16, to: 24 },
];

function bucketize(trades, keyOf) {
  const buckets = new Map();

  for (const trade of trades) {
    const key = keyOf(trade);
    if (key == null) continue;

    const bucket = buckets.get(key) || { key, net: 0, trades: 0, wins: 0, gross: 0, loss: 0 };
    bucket.trades += 1;
    bucket.net += trade.netPnl;
    if (trade.netPnl > 0) {
      bucket.wins += 1;
      bucket.gross += trade.netPnl;
    } else if (trade.netPnl < 0) {
      bucket.loss += Math.abs(trade.netPnl);
    }
    buckets.set(key, bucket);
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    net: round(bucket.net),
    gross: round(bucket.gross),
    loss: round(bucket.loss),
    winRate: bucket.trades ? round((bucket.wins / bucket.trades) * 100, 1) : 0,
  }));
}

function toDateKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function toWeekKey(ms) {
  const date = new Date(ms);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function toMonthKey(ms) {
  return new Date(ms).toISOString().slice(0, 7);
}

function maxConsecutive(trades, predicate) {
  let current = 0;
  let best = 0;

  for (const trade of [...trades].reverse()) {
    if (predicate(trade)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

function drawdownFromEquity(equityCurve) {
  let peak = -Infinity;
  let maxDd = 0;
  let maxDdPct = 0;

  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak - point.equity;
    if (dd > maxDd) maxDd = dd;
    const pct = peak > 0 ? (dd / peak) * 100 : 0;
    if (pct > maxDdPct) maxDdPct = pct;
  }

  return { maxDrawdown: round(maxDd), maxDrawdownPct: round(maxDdPct, 2) };
}

export function computeBacktestStatistics({ trades = [], equityCurve = [], startingBalance = 0 }) {
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl < 0);
  const breakeven = trades.filter((t) => t.netPnl === 0);

  const grossProfit = sum(wins.map((t) => t.netPnl));
  const grossLoss = Math.abs(sum(losses.map((t) => t.netPnl)));
  const netProfit = round(grossProfit - grossLoss);

  const rValues = trades.map((t) => t.rMultiple).filter((r) => Number.isFinite(r));
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const lossRate = trades.length ? (losses.length / trades.length) * 100 : 0;

  const { maxDrawdown, maxDrawdownPct } = drawdownFromEquity(equityCurve);

  const longs = trades.filter((t) => t.side === "BUY");
  const shorts = trades.filter((t) => t.side === "SELL");

  const endingBalance = equityCurve.length
    ? equityCurve[equityCurve.length - 1].balance
    : startingBalance;

  const expectancyR = rValues.length ? sum(rValues) / rValues.length : 0;

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakeven.length,
    winRate: round(winRate, 1),
    lossRate: round(lossRate, 1),

    grossProfit: round(grossProfit),
    grossLoss: round(-grossLoss),
    netProfit,
    returnPct: startingBalance > 0 ? round((netProfit / startingBalance) * 100, 2) : 0,

    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : grossProfit > 0 ? null : 0,
    averageWin: round(avgWin),
    averageLoss: round(avgLoss),
    largestWin: round(wins.length ? Math.max(...wins.map((t) => t.netPnl)) : 0),
    largestLoss: round(losses.length ? Math.min(...losses.map((t) => t.netPnl)) : 0),

    averageR: rValues.length ? round(sum(rValues) / rValues.length, 3) : null,
    expectancy: rValues.length ? round(expectancyR, 3) : null,
    expectancyCash: trades.length ? round(netProfit / trades.length) : 0,

    maxDrawdown,
    maxDrawdownPct,
    recoveryFactor: maxDrawdown > 0 ? round(netProfit / maxDrawdown, 2) : null,
    riskRewardRatio: avgLoss > 0 ? round(avgWin / avgLoss, 2) : null,

    consecutiveWins: maxConsecutive(trades, (t) => t.netPnl > 0),
    consecutiveLosses: maxConsecutive(trades, (t) => t.netPnl < 0),

    startingBalance: round(startingBalance),
    endingBalance: round(endingBalance),

    totalPips: round(sum(trades.map((t) => t.pips || 0)), 1),
    avgDurationMs: trades.length ? Math.round(sum(trades.map((t) => t.durationMs || 0)) / trades.length) : 0,

    longPerformance: {
      trades: longs.length,
      net: round(sum(longs.map((t) => t.netPnl))),
      winRate: longs.length ? round((longs.filter((t) => t.netPnl > 0).length / longs.length) * 100, 1) : 0,
    },
    shortPerformance: {
      trades: shorts.length,
      net: round(sum(shorts.map((t) => t.netPnl))),
      winRate: shorts.length ? round((shorts.filter((t) => t.netPnl > 0).length / shorts.length) * 100, 1) : 0,
    },

    daily: bucketize(trades, (t) => (t.closedAt ? toDateKey(t.closedAt) : null)).sort((a, b) =>
      String(a.key).localeCompare(String(b.key))
    ),
    weekly: bucketize(trades, (t) => (t.closedAt ? toWeekKey(t.closedAt) : null)).sort((a, b) =>
      String(a.key).localeCompare(String(b.key))
    ),
    monthly: bucketize(trades, (t) => (t.closedAt ? toMonthKey(t.closedAt) : null)).sort((a, b) =>
      String(a.key).localeCompare(String(b.key))
    ),

    sessions: SESSIONS.map((session) => {
      const inSession = trades.filter((t) => {
        if (!t.closedAt) return false;
        const hour = new Date(t.closedAt).getUTCHours();
        return hour >= session.from && hour < session.to;
      });

      return {
        id: session.id,
        label: session.label,
        window: `${String(session.from).padStart(2, "0")}:00–${String(session.to).padStart(2, "0")}:00 UTC`,
        trades: inSession.length,
        net: round(sum(inSession.map((t) => t.netPnl))),
        winRate: inSession.length
          ? round((inSession.filter((t) => t.netPnl > 0).length / inSession.length) * 100, 1)
          : 0,
      };
    }),

    exitReasons: bucketize(trades, (t) => t.exitReason).map((bucket) => ({
      reason: bucket.key,
      trades: bucket.trades,
      net: bucket.net,
    })),

    rDistribution: rValues.length
      ? [
          { label: "≤ -2R", count: rValues.filter((r) => r <= -2).length },
          { label: "-2R to -1R", count: rValues.filter((r) => r > -2 && r <= -1).length },
          { label: "-1R to 0R", count: rValues.filter((r) => r > -1 && r < 0).length },
          { label: "0R to 1R", count: rValues.filter((r) => r >= 0 && r <= 1).length },
          { label: "1R to 2R", count: rValues.filter((r) => r > 1 && r <= 2).length },
          { label: "> 2R", count: rValues.filter((r) => r > 2).length },
        ]
      : [],
  };
}
