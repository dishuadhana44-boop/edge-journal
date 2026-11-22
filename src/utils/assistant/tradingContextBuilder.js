import { format, startOfMonth, subDays } from "date-fns";

import {
  buildDirectionPerformance,
  buildPeriodPnlSeries,
  buildSymbolPerformance,
  buildWeekdayPerformance,
  selectRealizedTrades,
} from "../dashboardCurveEngine";

import {
  calculateAverageRR,
  calculateCurrentBalance,
  calculateExpectancy,
  calculateNetPnL,
  calculateProfitFactor,
  calculateWinRate,
} from "../statisticsEngine";

import { generateAIInsights } from "../aiInsights/aiInsightsEngine";

const MONEY_DIGITS = 2;

function round(value, digits = MONEY_DIGITS) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Number(number.toFixed(digits));
}

function money(value) {
  return round(value);
}

// Broker logins look like secrets to a user who reads the request payload, and
// the assistant never needs one, so long digit runs are masked.
function maskLabel(value, fallback = "Unnamed account") {
  return String(value || fallback)
    .replace(/\d{5,}/g, "•••")
    .trim();
}

function mistakeTagsOf(trade) {
  const raw = trade?.mistakes;

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item || "").trim()).filter(Boolean)
        : [raw.trim()];
    } catch {
      return [raw.trim()];
    }
  }

  return [];
}

function planNameOf(trade) {
  return (
    trade?.reflection?.selectedPlanName ||
    trade?.planName ||
    trade?.plan ||
    null
  );
}

function followedPlanOf(trade) {
  const value =
    trade?.followedPlan ?? trade?.reflection?.followedPlan;

  if (value === true || value === "true" || value === "yes" || value === "Yes") {
    return true;
  }

  if (value === false || value === "false" || value === "no" || value === "No") {
    return false;
  }

  return null;
}

// One metric bundle, computed identically for every window so the assistant can
// never see two different definitions of "win rate".
function summarize(entries) {
  const trades = entries.map((entry) => entry.trade);

  if (trades.length === 0) {
    return {
      closedTrades: 0,
      netPnL: 0,
      winRate: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      profitFactor: 0,
      averagePlannedR: 0,
      expectancyPerTrade: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      payoffRatio: 0,
    };
  }

  const winners = trades.filter((trade) => Number(trade.pnl) > 0);
  const losers = trades.filter((trade) => Number(trade.pnl) < 0);

  const averageWin = winners.length
    ? calculateNetPnL(winners) / winners.length
    : 0;

  const averageLoss = losers.length
    ? Math.abs(calculateNetPnL(losers) / losers.length)
    : 0;

  return {
    closedTrades: trades.length,
    netPnL: money(calculateNetPnL(trades)),
    winRate: round(calculateWinRate(trades), 1),
    wins: winners.length,
    losses: losers.length,
    breakeven: trades.length - winners.length - losers.length,
    profitFactor: calculateProfitFactor(trades),
    averagePlannedR: round(calculateAverageRR(trades)),
    expectancyPerTrade: money(calculateExpectancy(trades)),
    averageWin: money(averageWin),
    averageLoss: money(averageLoss),
    largestWin: money(
      Math.max(0, ...winners.map((trade) => Number(trade.pnl || 0)))
    ),
    largestLoss: money(
      Math.min(0, ...losers.map((trade) => Number(trade.pnl || 0)))
    ),
    payoffRatio: averageLoss > 0 ? round(averageWin / averageLoss) : 0,
  };
}

// Signed length of the run at the end of the chronologically ordered results.
function currentStreak(entries) {
  let streak = 0;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const pnl = Number(entries[index].trade.pnl || 0);
    const sign = pnl > 0 ? 1 : pnl < 0 ? -1 : 0;

    if (sign === 0) break;
    if (streak === 0) {
      streak = sign;
      continue;
    }
    if ((streak > 0 ? 1 : -1) !== sign) break;
    streak += sign;
  }

  return streak;
}

function sampleVerdict(closedTrades) {
  if (closedTrades === 0) return "no closed trades in the journal";
  if (closedTrades < 10) return "very small sample — treat every pattern as provisional";
  if (closedTrades < 30) return "small sample — describe tendencies, not proven patterns";
  return "usable sample for pattern analysis";
}

export function buildAssistantContext({
  trades = [],
  account = null,
  openPositions = 0,
  pendingOrders = 0,
}) {
  const realizedAll = selectRealizedTrades(trades);

  const now = Date.now();
  const last30Start = startOfDaySafe(subDays(new Date(now), 29));
  const monthStart = startOfMonth(new Date(now));

  const last30 = realizedAll.filter((entry) => entry.closedAt >= last30Start);
  const thisMonth = realizedAll.filter((entry) => entry.closedAt >= monthStart);
  const last20 = realizedAll.slice(-20);

  const startingBalance = Number(account?.startingBalance ?? 0) || 0;
  const reconstructedBalance = calculateCurrentBalance(
    startingBalance,
    realizedAll.map((entry) => entry.trade)
  );

  const insights = generateAIInsights(realizedAll.map((entry) => entry.trade));

  const mistakes = (insights.mistakes || [])
    .slice(0, 8)
    .map(({ mistake, count, frequency, averagePnL, pnlImpact }) => ({
      mistake,
      count,
      frequencyPercent: round(frequency, 1),
      averagePnL: money(averagePnL),
      totalPnLImpact: money(pnlImpact),
    }));

  const plans = (insights.plans || [])
    .slice(0, 5)
    .map(({ plan, trades: planTrades, wins, losses, netPnL, winRate }) => ({
      plan,
      closedTrades: planTrades ?? 0,
      wins,
      losses,
      winRate: round(winRate ?? 0, 1),
      netPnL: money(netPnL ?? 0),
    }));

  const sessions = (insights.sessions || [])
    .slice(0, 5)
    .map(({ session, trades: sessionTrades, winRate, netPnL, pnl }) => ({
      session,
      closedTrades: sessionTrades ?? 0,
      winRate: round(winRate ?? 0, 1),
      netPnL: money(netPnL ?? pnl ?? 0),
    }));

  const behaviour = insights.behavior || {};
  const psychology = insights.psychology || {};

  const daily = buildPeriodPnlSeries(trades, { granularity: "day" });
  const monthly = buildPeriodPnlSeries(trades, { granularity: "month" });

  const recent = realizedAll
    .slice(-15)
    .reverse()
    .map(({ trade, closedAt }) => {
      const tags = mistakeTagsOf(trade);
      const plan = planNameOf(trade);
      const followed = followedPlanOf(trade);
      const note = String(trade?.notes ?? trade?.reflection?.notes ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);

      return {
        symbol: String(trade.symbol ?? trade.pair ?? "—").toUpperCase(),
        direction: trade.direction || trade.side || "—",
        closedAt: format(closedAt, "dd MMM yyyy HH:mm"),
        pnl: money(trade.pnl),
        plannedR: round(trade.rr ?? 0),
        duration: trade.durationFormatted ?? trade.duration ?? "—",
        stopLoss:
          trade.stopLoss === undefined || trade.stopLoss === null || trade.stopLoss === ""
            ? null
            : Number(trade.stopLoss),
        ...(tags.length ? { mistakes: tags } : {}),
        ...(plan ? { plan } : {}),
        ...(followed === null ? {} : { followedPlan: followed }),
        ...(note ? { note } : {}),
      };
    });

  const rrRecorded = realizedAll.filter(
    (entry) => Number(entry.trade.rr || 0) > 0
  ).length;

  const stopsRecorded = realizedAll.filter(
    (entry) =>
      entry.trade.stopLoss !== undefined &&
      entry.trade.stopLoss !== null &&
      entry.trade.stopLoss !== "" &&
      Number(entry.trade.stopLoss) !== 0
  ).length;

  const taggedMistakes = realizedAll.filter(
    (entry) => mistakeTagsOf(entry.trade).length > 0
  ).length;

  const planned = realizedAll.filter(
    (entry) => planNameOf(entry.trade)
  ).length;

  const dataQuality = [
    realizedAll.length > 0
      ? `${planned} of ${realizedAll.length} closed trades carry a strategy/plan tag.`
      : null,
    `${rrRecorded} of ${realizedAll.length} closed trades record a planned risk-reward (R). Average R is computed from those only.`,
    `${stopsRecorded} of ${realizedAll.length} closed trades record a stop-loss price.`,
    `${taggedMistakes} of ${realizedAll.length} closed trades have self-reported mistake tags. Without tags, mistake questions can only be answered from price action, not intent.`,
    "Balance and equity here are reconstructed from the journal (starting balance plus realised results); they are not the broker's own balance history.",
    `${openPositions} open position(s) and ${pendingOrders} pending order(s) exist and are excluded from every closed-trade statistic above.`,
  ].filter(Boolean);

  return {
    generatedAt: format(now, "dd MMM yyyy HH:mm"),
    localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    account: {
      label: maskLabel(account?.accountName ?? account?.name),
      currency: account?.currency || "USD",
      startingBalance: money(startingBalance),
      balanceReconstructedAllTime: money(reconstructedBalance),
    },

    dataSufficiency: {
      journalTrades: Array.isArray(trades) ? trades.length : 0,
      closedTradesWithTimestamp: realizedAll.length,
      firstClosedAt: realizedAll.length
        ? format(realizedAll[0].closedAt, "dd MMM yyyy")
        : null,
      lastClosedAt: realizedAll.length
        ? format(realizedAll[realizedAll.length - 1].closedAt, "dd MMM yyyy")
        : null,
      verdict: sampleVerdict(realizedAll.length),
    },

    windows: {
      allTime: summarize(realizedAll),
      last30Days: summarize(last30),
      thisMonth: summarize(thisMonth),
      last20Trades: summarize(last20),
    },

    currentStreak: currentStreak(realizedAll),

    breakdowns: {
      bySymbol: compactRows(buildSymbolPerformance(trades, { limit: 10 }).rows),
      byWeekday: compactRows(buildWeekdayPerformance(trades).rows),
      byDirection: compactRows(buildDirectionPerformance(trades).rows),
    },

    dailyPnl: daily.points.slice(-20).map((point) => ({
      day: point.label,
      pnl: money(point.pnl),
      trades: point.trades,
      winRate: round(point.winRate, 1),
    })),

    monthlyPnl: monthly.points.slice(-12).map((point) => ({
      month: point.label,
      pnl: money(point.pnl),
      trades: point.trades,
      winRate: round(point.winRate, 1),
    })),

    recentTrades: recent,

    behaviour: {
      mistakes,
      plans,
      sessions,
      disciplineScore: behaviour.disciplineScore ?? null,
      planFollowingRate: round(behaviour.planFollowingRate ?? 0, 1),
      riskManagementRate: round(behaviour.riskManagementRate ?? 0, 1),
      consistencyScore: behaviour.consistencyScore ?? null,
      averageTradesPerDay: round(behaviour.averageTradesPerDay ?? 0, 1),
      revengeTrading: behaviour.revengeTrading?.detected
        ? { count: behaviour.revengeTrading.count }
        : null,
      psychology: {
        score: psychology.score ?? null,
        grade: psychology.grade ?? null,
        trend: psychology.trend ?? null,
        emotionalRate: round(psychology.emotionalRate ?? 0, 1),
        impulsiveRate: round(psychology.impulsiveRate ?? 0, 1),
      },
      recommendations: (insights.recommendations || [])
        .slice(0, 6)
        .map((item) =>
          typeof item === "string" ? item : item?.message || item?.recommendation || ""
        )
        .filter(Boolean),
    },

    dataQuality,
  };
}

function compactRows(rows = []) {
  return rows.map((row) => ({
    key: row.label ?? row.key,
    trades: row.trades,
    winRate: round(row.winRate ?? 0, 1),
    netPnL: money(row.netPnl ?? 0),
    averageRealizedR: row.avgR === null ? null : round(row.avgR),
    shareOfAbsolutePnlPercent: round(row.share ?? 0, 1),
  }));
}

function startOfDaySafe(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}
