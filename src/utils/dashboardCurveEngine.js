import { format, addDays, subDays } from "date-fns";

import { normalizePeriodBounds } from "./dateRangeUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getCloseTimestamp(trade) {
  const raw =
    trade?.exitTime ??
    trade?.closedAt ??
    trade?.closeTime ??
    trade?.closingTime ??
    trade?.exitedAt ??
    null;

  return toTimestamp(raw);
}

function toTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 100000000000 ? value * 1000 : value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const number = Number(value);
    return number < 100000000000 ? number * 1000 : number;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getOpenTimestamp(trade) {
  const raw =
    trade?.entryTime ??
    trade?.openedAt ??
    trade?.openTime ??
    trade?.creationTime ??
    trade?.time_msc ??
    trade?.timeMsc ??
    trade?.time ??
    null;

  return toTimestamp(raw);
}

function getLocalDayTimestamp(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ).getTime();
}

// The timestamp a realised result is attributed to. Closed trades use their close
// time; broker records that never carried one fall back to the entry time, then to
// the trade's own local date label, so manual journal entries are not silently
// dropped from a period.
export function getRealizedTimestamp(trade) {
  return (
    getCloseTimestamp(trade) ??
    getOpenTimestamp(trade) ??
    getLocalDayTimestamp(trade?.date) ??
    null
  );
}

export function isClosedTrade(trade) {
  const status = String(trade?.status ?? "").toUpperCase();

  // Open positions and pending orders are never closed-trade performance.
  if (status && status !== "CLOSED") return false;

  return getRealizedTimestamp(trade) !== null;
}

// The one period filter every Dashboard metric and chart uses for closed-trade
// performance: realised trades only, attributed to their close timestamp, inside
// local-calendar bounds that include the whole of the end date.
export function selectRealizedTrades(trades = [], { startDate = null, endDate = null } = {}) {
  const { start, end } = normalizePeriodBounds(startDate, endDate);

  return trades
    .filter(isClosedTrade)
    .map((trade) => ({ trade, closedAt: getRealizedTimestamp(trade) }))
    .filter(({ closedAt }) => {
      if (start !== null && closedAt < start) return false;
      if (end !== null && closedAt > end) return false;
      return true;
    })
    .sort((a, b) => a.closedAt - b.closedAt);
}

// Equity the account stood at when the period opened: its own starting balance plus
// every realised result closed before the range. Period views continue from here
// instead of restarting at the starting balance, which would report a balance the
// account never held.
export function getPeriodStartingBalance(
  trades = [],
  { startingBalance = 0, startDate = null } = {}
) {
  const baseline = toNumber(startingBalance);

  const { start } = normalizePeriodBounds(startDate, null);

  if (start === null) return baseline;

  const priorPnl = selectRealizedTrades(trades, {
    endDate: new Date(start - 1),
  }).reduce((sum, entry) => sum + toNumber(entry.trade.pnl), 0);

  return Number((baseline + priorPnl).toFixed(2));
}

function startOfDayMs(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Calendar steps go through date-fns so a DST day (23 or 25 hours long) cannot
// slide a bucket label onto the neighbouring day.
function startOfWeekMs(timestamp) {
  const dayShift = (new Date(timestamp).getDay() + 6) % 7;
  return startOfDayMs(subDays(new Date(timestamp), dayShift).getTime());
}

// Bucket keys are local-period start instants so chronological sorting is numeric:
// stringified calendar parts put 15 Oct before 8 Oct.
function bucketOf(timestamp, granularity) {
  const date = new Date(timestamp);

  if (granularity === "week") {
    const weekStart = startOfWeekMs(timestamp);
    return {
      key: weekStart,
      label: `${format(weekStart, "dd MMM")}–${format(
        addDays(new Date(weekStart), 6),
        "dd MMM"
      )}`,
    };
  }

  if (granularity === "month") {
    return {
      key: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
      label: format(date, "MMM yyyy"),
    };
  }

  return {
    key: startOfDayMs(timestamp),
    label: format(date, "dd MMM"),
  };
}

function summarize(entryList, key, label) {
  const netPnl = entryList.reduce((sum, entry) => sum + toNumber(entry.trade.pnl), 0);

  const wins = entryList.filter((entry) => toNumber(entry.trade.pnl) > 0).length;
  const losses = entryList.filter((entry) => toNumber(entry.trade.pnl) < 0).length;

  return {
    key,
    label,
    pnl: Number(netPnl.toFixed(2)),
    trades: entryList.length,
    wins,
    losses,
    winRate: entryList.length
      ? Number(((wins / entryList.length) * 100).toFixed(1))
      : 0,
  };
}

export function buildPeriodPnlSeries(trades = [], options = {}) {
  const { granularity = "day", startDate = null, endDate = null } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  const buckets = new Map();

  realized.forEach((entry) => {
    const { key, label } = bucketOf(entry.closedAt, granularity);

    if (!buckets.has(key)) buckets.set(key, { label, entries: [] });
    buckets.get(key).entries.push(entry);
  });

  let points = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, bucket]) => summarize(bucket.entries, key, bucket.label));

  // Fill idle periods with true zero results so gaps read as flat days/weeks.
  if (granularity === "day" && points.length > 1) {
    const filled = [];
    let previous = null;

    points.forEach((point) => {
      const gapDays =
        previous === null ? 0 : Math.round((point.key - previous) / DAY_MS);

      if (gapDays > 2 && points.length < 120) {
        for (let step = 1; step < gapDays; step += 1) {
          const idle = startOfDayMs(
            addDays(new Date(previous), step).getTime()
          );

          filled.push({
            key: idle,
            label: format(idle, "dd MMM"),
            pnl: 0,
            trades: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
          });
        }
      }
      filled.push(point);
      previous = point.key;
    });

    points = filled;
  }

  return {
    points,
    closedTrades: realized.length,
    totalPnl: Number(
      realized.reduce((sum, entry) => sum + toNumber(entry.trade.pnl), 0).toFixed(2)
    ),
    best: points.length
      ? points.reduce((highest, point) => (point.pnl > highest.pnl ? point : highest))
      : null,
    worst: points.length
      ? points.reduce((lowest, point) => (point.pnl < lowest.pnl ? point : lowest))
      : null,
  };
}

export function buildCumulativePnlSeries(trades = [], options = {}) {
  const { startDate = null, endDate = null } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  let running = 0;

  const points = realized.map((entry) => {
    const pnl = toNumber(entry.trade.pnl);
    running += pnl;

    return {
      key: entry.closedAt,
      label: format(entry.closedAt, "dd MMM"),
      cumulative: Number(running.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      trades: realized.length,
    };
  });

  return {
    points,
    closedTrades: realized.length,
    totalPnl: Number(running.toFixed(2)),
  };
}

// Reconstructed equity: the balance the account stood at when the period opened
// (its starting balance plus realised results closed earlier) with in-period trade
// P&L applied in close-timestamp order.
export function buildDrawdownSeries(trades = [], options = {}) {
  const { startingBalance = 0, startDate = null, endDate = null } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  const balance = getPeriodStartingBalance(trades, {
    startingBalance,
    startDate,
  });

  if (!(toNumber(startingBalance) > 0)) {
    return {
      points: [],
      closedTrades: realized.length,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      currentDrawdown: 0,
      averageDrawdownPercent: 0,
      reason: "This trading account has no starting balance, so equity drawdown cannot be calculated.",
    };
  }

  let peak = balance;
  let current = balance;

  const points = [
    {
      key: "start",
      label: "Start",
      balance: Number(balance.toFixed(2)),
      peak: Number(balance.toFixed(2)),
      drawdown: 0,
      drawdownPercent: 0,
    },
  ];

  realized.forEach((entry) => {
    current += toNumber(entry.trade.pnl);

    if (current > peak) peak = current;

    const drawdown = current - peak;

    points.push({
      key: entry.closedAt,
      label: format(entry.closedAt, "dd MMM HH:mm"),
      balance: Number(current.toFixed(2)),
      peak: Number(peak.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
      drawdownPercent: Number(((drawdown / peak) * 100).toFixed(2)),
    });
  });

  const ddPoints = points.slice(1);

  const maxDrawdown = ddPoints.length
    ? ddPoints.reduce((lowest, point) => (point.drawdown < lowest.drawdown ? point : lowest))
    : null;

  const averageDrawdownPercent = ddPoints.length
    ? Number(
        (
          ddPoints.reduce((sum, point) => sum + point.drawdownPercent, 0) /
          ddPoints.length
        ).toFixed(2)
      )
    : 0;

  const averageDrawdown = ddPoints.length
    ? Number(
        (
          ddPoints.reduce((sum, point) => sum + point.drawdown, 0) / ddPoints.length
        ).toFixed(2)
      )
    : 0;

  const last = points[points.length - 1];

  return {
    points: realized.length ? points : [],
    closedTrades: realized.length,
    maxDrawdown: maxDrawdown ? maxDrawdown.drawdown : 0,
    maxDrawdownPercent: maxDrawdown ? maxDrawdown.drawdownPercent : 0,
    currentDrawdown: last.drawdown,
    currentDrawdownPercent: last.drawdownPercent,
    averageDrawdown,
    averageDrawdownPercent,
    reason: realized.length
      ? null
      : "No closed trades with a valid close timestamp in the selected date range.",
  };
}

function groupPerformance(realized, keyFn, labelFn, preferredOrder = null) {
  const groups = new Map();

  realized.forEach((entry) => {
    const key = keyFn(entry);
    if (key === null || key === undefined || key === "") return;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  const rows = [...groups.entries()].map(([key, entries]) => {
    const netPnl = entries.reduce((sum, entry) => sum + toNumber(entry.trade.pnl), 0);
    const wins = entries.filter((entry) => toNumber(entry.trade.pnl) > 0).length;

    const rValues = entries
      .map((entry) => toNumber(entry.trade.realizedR))
      .filter((value) => value !== 0);

    return {
      key,
      label: labelFn(key),
      trades: entries.length,
      netPnl: Number(netPnl.toFixed(2)),
      winRate: Number(((wins / entries.length) * 100).toFixed(1)),
      avgR: rValues.length
        ? Number((rValues.reduce((sum, value) => sum + value, 0) / rValues.length).toFixed(2))
        : null,
    };
  });

  const total = rows.reduce((sum, row) => sum + Math.abs(row.netPnl), 0);

  rows.forEach((row) => {
    row.share = total > 0 ? Number(((Math.abs(row.netPnl) / total) * 100).toFixed(1)) : 0;
  });

  if (preferredOrder) {
    rows.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a.key);
      const indexB = preferredOrder.indexOf(b.key);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  } else {
    rows.sort((a, b) => b.netPnl - a.netPnl);
  }

  return rows;
}

export function buildDirectionPerformance(trades = [], options = {}) {
  const { startDate = null, endDate = null } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  const rows = groupPerformance(
    realized,
    ({ trade }) => {
      const direction = String(trade.direction ?? trade.side ?? "").toLowerCase();

      if (direction === "buy" || direction === "long") return "long";
      if (direction === "sell" || direction === "short") return "short";
      return null;
    },
    (key) => (key === "long" ? "Long (Buy)" : "Short (Sell)")
  );

  return {
    rows,
    closedTrades: realized.length,
    expectedKeys: ["long", "short"],
  };
}

export function buildSymbolPerformance(trades = [], options = {}) {
  const { startDate = null, endDate = null, limit = 8 } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  const rows = groupPerformance(
    realized,
    ({ trade }) => String(trade.symbol ?? trade.pair ?? "").toUpperCase() || null,
    (key) => key
  );

  return {
    rows: rows.slice(0, limit),
    hiddenRows: Math.max(rows.length - limit, 0),
    closedTrades: realized.length,
  };
}

export function buildWeekdayPerformance(trades = [], options = {}) {
  const { startDate = null, endDate = null } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  const rows = groupPerformance(
    realized,
    ({ closedAt }) => WEEKDAY_LABELS[(new Date(closedAt).getDay() + 6) % 7],
    (key) => key,
    WEEKDAY_LABELS
  );

  return { rows, closedTrades: realized.length };
}

export function buildRecentClosedTrades(trades = [], options = {}) {
  const { startDate = null, endDate = null, limit = 12 } = options;

  const realized = selectRealizedTrades(trades, { startDate, endDate });

  return realized
    .slice()
    .reverse()
    .slice(0, limit)
    .map(({ trade, closedAt }) => ({
      id: trade.id ?? closedAt,
      symbol: String(trade.symbol ?? trade.pair ?? "--").toUpperCase(),
      direction:
        String(trade.direction ?? trade.side ?? "").toLowerCase() === "sell" ||
        String(trade.direction ?? trade.side ?? "").toLowerCase() === "short"
          ? "Sell"
          : String(trade.direction ?? trade.side ?? "").toLowerCase() === "buy" ||
              String(trade.direction ?? trade.side ?? "").toLowerCase() === "long"
            ? "Buy"
            : "--",
      closedAt,
      closedLabel: format(closedAt, "dd MMM HH:mm"),
      pnl: Number(toNumber(trade.pnl).toFixed(2)),
      realizedR: toNumber(trade.realizedR) || null,
      duration: trade.durationFormatted ?? trade.duration ?? "--",
      result: trade.result ?? (toNumber(trade.pnl) >= 0 ? "Win" : "Loss"),
    }));
}
