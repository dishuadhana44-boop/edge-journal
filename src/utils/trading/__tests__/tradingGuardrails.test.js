import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_GUARDRAILS,
  DAILY_PNL_POLICY,
  evaluateDailyGuardrail,
  normalizeGuardrails,
  readStoredGuardrails,
} from "../tradingGuardrails.js";

// Local-calendar fixtures built from local components, so the assertions mean
// the same thing whatever timezone the machine runs in.
const DAY_ONE = 12;
const DAY_TWO = 13;

function localMs(hour, minute = 0, second = 0, ms = 0, day = DAY_ONE) {
  return new Date(2026, 9, day, hour, minute, second, ms).getTime();
}

function closed(netProfit, exitTime = localMs(12)) {
  return { netProfit, exitTime, status: "CLOSED" };
}

function storage(value) {
  return { getItem: () => value };
}

function silenced(fn) {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

test("a missing or empty stored config falls back to the full default set", () => {
  for (const value of [null, "", undefined]) {
    const { guardrails, issues } = readStoredGuardrails(storage(value));

    assert.deepEqual(guardrails, DEFAULT_GUARDRAILS, String(value));
    assert.deepEqual(issues, [], String(value));
  }
});

test("a stored config that omits a limit cannot disable daily loss protection", () => {
  // The bug this guards against: this object used to produce a maxDailyLoss of
  // 0 in the enforcing code while the panels still displayed a limit.
  const { guardrails, issues } = readStoredGuardrails(
    storage(JSON.stringify({ maxTradesPerDay: 3 }))
  );

  assert.equal(guardrails.maxTradesPerDay, 3);
  assert.equal(guardrails.maxDailyLoss, DEFAULT_GUARDRAILS.maxDailyLoss);
  assert.equal(guardrails.maxDailyProfit, DEFAULT_GUARDRAILS.maxDailyProfit);
  assert.equal(guardrails.tradingWindowStart, DEFAULT_GUARDRAILS.tradingWindowStart);
  assert.deepEqual(issues, []);

  const status = evaluateDailyGuardrail({
    guardrails,
    closedTrades: [closed(-3500)],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 15),
  });

  assert.equal(status.locked, true);
  assert.match(status.reason, /Maximum daily loss reached/);
});

test("invalid saved values are replaced by their default and reported", () => {
  const { guardrails, issues } = normalizeGuardrails({
    maxDailyLoss: -1,
    maxTradesPerDay: "many",
    maxDailyProfit: Number.NaN,
    tradingWindowStart: "25:70",
    tradingWindowEnd: "9:5",
  });

  assert.equal(guardrails.maxDailyLoss, DEFAULT_GUARDRAILS.maxDailyLoss);
  assert.equal(guardrails.maxTradesPerDay, DEFAULT_GUARDRAILS.maxTradesPerDay);
  assert.equal(guardrails.maxDailyProfit, DEFAULT_GUARDRAILS.maxDailyProfit);
  assert.equal(guardrails.tradingWindowStart, DEFAULT_GUARDRAILS.tradingWindowStart);
  assert.equal(guardrails.tradingWindowEnd, DEFAULT_GUARDRAILS.tradingWindowEnd);
  assert.equal(issues.length, 5);
  assert.match(issues[0], /maxTradesPerDay="many"/);
  assert.match(issues[1], /maxDailyLoss="-1"/);
  assert.match(issues[4], /tradingWindowEnd="9:5"/);
});

test("a zero limit stays a zero limit: disabling one check is a choice, not a bug", () => {
  const { guardrails, issues } = normalizeGuardrails({ maxDailyLoss: 0 });

  assert.equal(guardrails.maxDailyLoss, 0);
  assert.deepEqual(issues, []);
});

test("clocks are normalised to HH:MM", () => {
  const { guardrails, issues } = normalizeGuardrails({
    tradingWindowStart: "9:30",
    tradingWindowEnd: " 18:05 ",
  });

  assert.equal(guardrails.tradingWindowStart, "09:30");
  assert.equal(guardrails.tradingWindowEnd, "18:05");
  assert.deepEqual(issues, []);
});

test("unusable saved settings report a problem instead of failing silently", () => {
  const corrupt = silenced(() =>
    readStoredGuardrails(storage("{ not json"))
  );

  assert.deepEqual(corrupt.guardrails, DEFAULT_GUARDRAILS);
  assert.equal(corrupt.issues.length, 1);
  assert.match(corrupt.issues[0], /could not be read/);

  for (const value of ['"hello"', "[1,2]", "123"]) {
    const result = normalizeGuardrails(JSON.parse(value));
    assert.deepEqual(result.guardrails, DEFAULT_GUARDRAILS, value);
    assert.equal(result.issues.length, 1, value);
  }

  const throwing = silenced(() =>
    readStoredGuardrails({
      getItem() {
        throw new Error("quota");
      },
    })
  );

  assert.deepEqual(throwing.guardrails, DEFAULT_GUARDRAILS);
  assert.equal(throwing.issues.length, 1);
});

test("the daily figure is realised-only and uses the documented P&L precedence", () => {
  const status = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: [
      { netProfit: -120, pnl: 999, profit: 999, exitTime: localMs(10) },
      { pnl: 45, profit: -999, exitTime: localMs(11) },
      { profit: -30, exitTime: localMs(12) },
      { netProfit: 500, exitTime: localMs(13, 0, 0, 0, DAY_TWO) },
    ],
    openTrades: [{ netProfit: -99999, floating: -5000, entryTime: localMs(9) }],
    now: new Date(2026, 9, DAY_ONE, 18),
  });

  assert.equal(status.policy, DAILY_PNL_POLICY);
  assert.equal(status.dailyPnL, -120 + 45 - 30);

  // An open position counts against the daily trade allowance (3 closed today +
  // 1 open today) but its floating result is not a realised loss, so it never
  // moves the daily P&L.
  assert.equal(status.dailyTradeCount, 4);
  assert.equal(status.locked, false);
});

test("results are attributed to the local calendar day, not UTC", () => {
  const lastMinute = closed(-4000, localMs(23, 59, 59, 999, DAY_ONE));
  const firstMillisecond = closed(-4000, localMs(0, 0, 0, 1, DAY_TWO));

  const endOfDay = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: [lastMinute],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 23, 59, 59, 999),
  });

  assert.equal(endOfDay.dailyPnL, -4000);
  assert.equal(endOfDay.locked, true);

  const afterMidnight = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: [lastMinute],
    openTrades: [],
    now: new Date(2026, 9, DAY_TWO, 0, 0, 0),
  });

  assert.equal(afterMidnight.dailyPnL, 0);
  assert.equal(afterMidnight.locked, false);

  const justAfterMidnight = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: [firstMillisecond],
    openTrades: [],
    now: new Date(2026, 9, DAY_TWO, 0, 0, 0, 500),
  });

  assert.equal(justAfterMidnight.dailyPnL, -4000);
  assert.equal(justAfterMidnight.locked, true);
});

test("trades without a close time fall back to entry time then to their date label", () => {
  const status = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: [
      { netProfit: -10, entryTime: localMs(8) },
      { netProfit: -20, date: "2026-10-12" },
      { netProfit: -30, date: "2026-10-11" },
    ],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 20),
  });

  assert.equal(status.dailyPnL, -30);
});

test("the loss limit takes priority over the profit target and trade count", () => {
  const status = evaluateDailyGuardrail({
    guardrails: {
      ...DEFAULT_GUARDRAILS,
      maxDailyLoss: 100,
      maxDailyProfit: 50,
      maxTradesPerDay: 1,
    },
    closedTrades: [closed(-500)],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(status.locked, true);
  assert.match(status.reason, /Maximum daily loss reached/);
});

test("profit target and trade count lock with their own messages", () => {
  const profit = evaluateDailyGuardrail({
    guardrails: { ...DEFAULT_GUARDRAILS, maxDailyProfit: 1000 },
    closedTrades: [closed(1200)],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(profit.locked, true);
  assert.match(profit.reason, /Daily profit target reached/);

  const count = evaluateDailyGuardrail({
    guardrails: { ...DEFAULT_GUARDRAILS, maxTradesPerDay: 2 },
    closedTrades: [closed(-5), closed(-5)],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(count.locked, true);
  assert.match(count.reason, /Daily trade limit reached/);
});

test("disabled guardrails never lock and still report their limits", () => {
  const status = evaluateDailyGuardrail({
    guardrails: { ...DEFAULT_GUARDRAILS, enabled: false },
    closedTrades: [closed(-999999)],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(status.enabled, false);
  assert.equal(status.locked, false);
  assert.equal(status.reason, "");
  assert.equal(status.dailyPnL, 0);
  assert.equal(status.limits.maxDailyLoss, DEFAULT_GUARDRAILS.maxDailyLoss);
});

test("missing trade data is reported as unenforceable rather than as a clean sheet", () => {
  const status = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: null,
    openTrades: null,
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(status.enforceable, false);
  assert.equal(status.locked, false);
  assert.equal(status.configIssues.length, 2);
  assert.match(status.configIssues[0], /Closed trade history is unavailable/);

  const omitted = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(omitted.enforceable, true);
  assert.deepEqual(omitted.configIssues, []);

  const healthy = evaluateDailyGuardrail({
    guardrails: DEFAULT_GUARDRAILS,
    closedTrades: [],
    openTrades: [],
    now: new Date(2026, 9, DAY_ONE, 14),
  });

  assert.equal(healthy.enforceable, true);
  assert.deepEqual(healthy.configIssues, []);
});
