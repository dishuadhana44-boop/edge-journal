import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_BALANCE_CODES,
  BALANCE_FRESHNESS_CODES,
  BALANCE_MAX_AGE_MS,
  assessBalanceFreshness,
  resolveAccountBalance,
  riskAmountForAccount,
} from "../accountBalance.js";
import { SIZING_CODES, sizePosition } from "../positionSizing.js";

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

const stamp = (ageMs) => new Date(NOW - ageMs).toISOString();

const FRESHNESS = {
  ownerAccountId: "mt5-4401",
  expectedAccountId: "mt5-4401",
  now: NOW,
};

function closeTo(actual, expected, tolerance = 1e-9, message = "") {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`
  );
}

test("a loaded positive balance drives the risk percentage", () => {
  const result = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
  });

  assert.equal(result.code, ACCOUNT_BALANCE_CODES.OK);
  assert.equal(result.available, true);
  assert.equal(result.balance, 10000);
  closeTo(result.riskAmount, 100, 1e-9);

  // Broker payloads arrive as strings on some paths.
  const fromString = riskAmountForAccount({
    balance: "18500.50",
    riskPercent: 2,
  });

  assert.equal(fromString.available, true);
  closeTo(fromString.riskAmount, 370.01, 1e-9);
});

test("an account that has never loaded blocks instead of inventing a balance", () => {
  // Before this fix an unloaded account still sized trades as 1% of a
  // hardcoded 100158.75, i.e. $1001.59 of risk nobody held.
  for (const raw of [undefined, null, ""]) {
    const resolved = resolveAccountBalance(raw);

    assert.equal(resolved.code, ACCOUNT_BALANCE_CODES.NOT_LOADED, String(raw));
    assert.equal(resolved.available, false, String(raw));
    assert.equal(resolved.balance, 0, String(raw));

    const result = riskAmountForAccount({
      balance: raw,
      riskPercent: 1,
    });

    assert.equal(result.riskAmount, 0, String(raw));
    assert.match(result.message, /No account balance is loaded/);
  }
});

test("a zero or negative balance cannot carry percentage risk", () => {
  for (const raw of [0, -0.01, -250]) {
    const resolved = resolveAccountBalance(raw);

    assert.equal(resolved.code, ACCOUNT_BALANCE_CODES.NON_POSITIVE, String(raw));
    assert.equal(resolved.available, false, String(raw));
    assert.equal(resolved.balance, 0, String(raw));
    assert.equal(riskAmountForAccount({ balance: raw, riskPercent: 1 }).riskAmount, 0, String(raw));
  }

  assert.match(
    riskAmountForAccount({ balance: -250, riskPercent: 1 }).message,
    /balance is -250/
  );
});

test("a non-numeric or unbounded balance is invalid", () => {
  for (const raw of ["abc", {}, Number.NaN, Infinity, -Infinity, "1e"]) {
    const resolved = resolveAccountBalance(raw);

    assert.equal(resolved.code, ACCOUNT_BALANCE_CODES.INVALID, String(raw));
    assert.equal(resolved.available, false, String(raw));
    assert.equal(resolved.balance, 0, String(raw));
    assert.equal(
      riskAmountForAccount({ balance: raw, riskPercent: 1 }).riskAmount,
      0,
      String(raw)
    );
  }

  assert.match(
    resolveAccountBalance("abc").message,
    /balance "abc" is not a number/
  );
});

test("an unusable risk percentage yields no risk amount", () => {
  for (const percent of [0, -1, "wide", undefined]) {
    const result = riskAmountForAccount({
      balance: 10000,
      riskPercent: percent,
    });

    assert.equal(result.code, ACCOUNT_BALANCE_CODES.OK, String(percent));
    assert.equal(result.riskAmount, 0, String(percent));
  }
});

test("an unusable balance blocks automatic sizing rather than guessing lots", () => {
  const result = riskAmountForAccount({ balance: 0, riskPercent: 1 });

  const sizing = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: result.riskAmount,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, false);
  assert.equal(sizing.code, SIZING_CODES.INVALID_INPUT);
  assert.equal(sizing.lots, 0);

  const funded = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: riskAmountForAccount({ balance: 10000, riskPercent: 1 }).riskAmount,
    accountCurrency: "USD",
  });

  assert.equal(funded.ok, true);
  assert.equal(funded.lots, 0.2);
});

test("the approved freshness window is thirty seconds", () => {
  assert.equal(BALANCE_MAX_AGE_MS, 30_000);
});

test("a recently refreshed balance is still usable for risk maths", () => {
  const result = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
    freshness: { ...FRESHNESS, refreshedAt: stamp(2_000) },
  });

  assert.equal(result.code, ACCOUNT_BALANCE_CODES.OK);
  assert.equal(result.available, true);
  closeTo(result.riskAmount, 100, 1e-9);
  assert.equal(result.ageMs, 2_000);
  assert.equal(result.maxAgeMs, BALANCE_MAX_AGE_MS);
});

test("a balance refreshed exactly thirty seconds ago is still fresh", () => {
  const status = assessBalanceFreshness({
    ...FRESHNESS,
    refreshedAt: stamp(BALANCE_MAX_AGE_MS),
  });

  assert.equal(status.fresh, true);
  assert.equal(status.code, BALANCE_FRESHNESS_CODES.FRESH);
  assert.equal(status.ageMs, BALANCE_MAX_AGE_MS);
});

test("one second past the window stops automatic sizing", () => {
  const status = assessBalanceFreshness({
    ...FRESHNESS,
    refreshedAt: stamp(BALANCE_MAX_AGE_MS + 1),
  });

  assert.equal(status.fresh, false);
  assert.equal(status.code, ACCOUNT_BALANCE_CODES.STALE);
  assert.match(
    status.message,
    /not been refreshed for 30 seconds/
  );

  const result = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
    freshness: { ...FRESHNESS, refreshedAt: stamp(BALANCE_MAX_AGE_MS + 1) },
  });

  assert.equal(result.code, ACCOUNT_BALANCE_CODES.STALE);
  assert.equal(result.available, false);

  // The remembered balance is not invented away, it simply cannot be risked.
  assert.equal(result.balance, 10000);
  assert.equal(result.riskAmount, 0);

  const sizing = sizePosition({
    symbol: "EURUSD",
    entryPrice: 1.1,
    stopLoss: 1.095,
    riskAmount: result.riskAmount,
    accountCurrency: "USD",
  });

  assert.equal(sizing.ok, false);
  assert.equal(sizing.code, SIZING_CODES.INVALID_INPUT);
});

test("a balance timestamp proves the app received it, not that the broker is live", () => {
  // A stale stamp survives a reload, so the gate ages out on its own clock
  // instead of trusting that the number is still what the broker holds.
  const before = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
    freshness: { ...FRESHNESS, refreshedAt: stamp(10_000) },
  });

  const after = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
    freshness: { ...FRESHNESS, refreshedAt: stamp(40_000) },
  });

  assert.equal(before.available, true);
  assert.equal(after.available, false);
  assert.equal(after.code, ACCOUNT_BALANCE_CODES.STALE);
});

test("callers that do not ask about freshness keep the old behaviour", () => {
  const legacy = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
  });

  assert.equal(legacy.code, ACCOUNT_BALANCE_CODES.OK);
  assert.equal(legacy.available, true);
  closeTo(legacy.riskAmount, 100, 1e-9);
  assert.equal(legacy.ageMs, undefined);
});

test("a balance whose freshness was never recorded cannot drive automatic sizing", () => {
  for (
    const refreshedAt of [
      undefined,
      null,
      "",
      "   ",
      "not a date",
      {},
      Number.NaN,
    ]
  ) {
    const status = assessBalanceFreshness({
      ...FRESHNESS,
      refreshedAt,
    });

    assert.equal(status.fresh, false, String(refreshedAt));
    assert.equal(
      status.code,
      ACCOUNT_BALANCE_CODES.FRESHNESS_UNKNOWN,
      String(refreshedAt)
    );

    const result = riskAmountForAccount({
      balance: 10000,
      riskPercent: 1,
      freshness: { ...FRESHNESS, refreshedAt },
    });

    assert.equal(result.available, false, String(refreshedAt));
    assert.equal(result.riskAmount, 0, String(refreshedAt));
    assert.match(result.message, /no record of when/i);
  }
});

test("a stamp belonging to another account is not this account's balance", () => {
  const result = riskAmountForAccount({
    balance: 10000,
    riskPercent: 1,
    freshness: {
      refreshedAt: stamp(5_000),
      ownerAccountId: "MT5-4401",
      expectedAccountId: "mt5-9999",
      now: NOW,
    },
  });

  assert.equal(result.code, ACCOUNT_BALANCE_CODES.ACCOUNT_MISMATCH);
  assert.equal(result.available, false);
  assert.equal(result.balance, 10000);
  assert.equal(result.riskAmount, 0);
  assert.match(result.message, /different account/);

  // Ownership only means something when both sides can state it.
  for (
    const partial of [
      { ownerAccountId: null, expectedAccountId: "mt5-4401" },
      { ownerAccountId: "mt5-4401", expectedAccountId: null },
      { ownerAccountId: "mt5-4401", expectedAccountId: "  " },
    ]
  ) {
    const status = assessBalanceFreshness({
      ...partial,
      refreshedAt: stamp(5_000),
      now: NOW,
    });

    assert.equal(status.fresh, false);
    assert.equal(status.code, ACCOUNT_BALANCE_CODES.FRESHNESS_UNKNOWN);
    assert.match(status.message, /not tied to a selected account/);
  }
});

test("a timestamp ahead of this clock is unknown, not infinitely fresh", () => {
  const status = assessBalanceFreshness({
    ...FRESHNESS,
    refreshedAt: stamp(-1_000),
  });

  assert.equal(status.fresh, false);
  assert.equal(status.code, ACCOUNT_BALANCE_CODES.FRESHNESS_UNKNOWN);
  assert.match(status.message, /in the future/);
});

test("an unusable balance is reported before freshness is considered", () => {
  const result = riskAmountForAccount({
    balance: 0,
    riskPercent: 1,
    freshness: { ...FRESHNESS, refreshedAt: stamp(60_000) },
  });

  assert.equal(result.code, ACCOUNT_BALANCE_CODES.NON_POSITIVE);
  assert.match(result.message, /balance is 0/);
});

test("an invalid freshness window falls back to the approved 30 seconds", () => {
  for (const maxAgeMs of [0, -1, "wide", undefined, null]) {
    const status = assessBalanceFreshness({
      ...FRESHNESS,
      refreshedAt: stamp(31_000),
      maxAgeMs,
    });

    assert.equal(status.maxAgeMs, BALANCE_MAX_AGE_MS, String(maxAgeMs));
    assert.equal(status.fresh, false, String(maxAgeMs));
    assert.equal(status.code, ACCOUNT_BALANCE_CODES.STALE, String(maxAgeMs));
  }
});

test("a Date instance and an epoch number are read the same as a string", () => {
  const asDate = assessBalanceFreshness({
    ...FRESHNESS,
    refreshedAt: new Date(NOW - 10_000),
  });

  const asEpoch = assessBalanceFreshness({
    ...FRESHNESS,
    refreshedAt: NOW - 10_000,
  });

  assert.equal(asDate.fresh, true);
  assert.equal(asDate.ageMs, 10_000);
  assert.deepEqual(asEpoch, asDate);
});
