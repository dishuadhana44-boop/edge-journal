import test from "node:test";
import assert from "node:assert/strict";

import {
  DEAL_MONEY_FIELDS,
  DEAL_AMOUNT_REASONS,
  sumDealMoney,
  sumDecimalTexts,
} from "./mt5DealAmounts.js";

// ============================================================
// Fixtures
//
// A broker deal row reports profit, commission, swap and fee as exact
// fixed-point decimal strings (mt5-bridge/app.py history_decimal
// :5957-5993, validate_history_deal :6189-6195, :6260-6263). Only the
// money fields this module reads are built here.
// ============================================================

function moneyRow(overrides = {}) {
  return {
    ticket: "1001",
    profit: "0",
    commission: "0",
    swap: "0",
    fee: "0",
    ...overrides,
  };
}

function rows(...money) {
  return money.map((entry, index) => moneyRow({ ticket: String(1001 + index), ...entry }));
}

// ============================================================
// 1. The field list is the broker's, in order
// ============================================================

test("sums exactly the four broker money fields the deal contract reports", () => {
  assert.deepEqual([...DEAL_MONEY_FIELDS], ["profit", "commission", "swap", "fee"]);
  assert.equal(Object.isFrozen(DEAL_MONEY_FIELDS), true);
});

// ============================================================
// 2. Exact decimal arithmetic — no floating point
// ============================================================

test("adds 0.1 and 0.2 to exactly 0.3", () => {
  const outcome = sumDealMoney(rows({ profit: "0.1" }, { profit: "0.2" }));

  assert.equal(outcome.ok, true);
  assert.equal(outcome.components.profit, "0.3");
  assert.equal(outcome.total, "0.3");
});

test("adds 1.005 and 2.005 to exactly 3.01", () => {
  const outcome = sumDealMoney(rows({ commission: "1.005" }, { commission: "2.005" }));

  assert.equal(outcome.components.commission, "3.01");
  assert.equal(outcome.total, "3.01");
});

test("adds 0.7 and 0.1 to exactly 0.8", () => {
  const outcome = sumDealMoney(rows({ swap: "0.7" }, { swap: "0.1" }));

  assert.equal(outcome.components.swap, "0.8");
  assert.equal(outcome.total, "0.8");
});

test("adds 1.4 and 0.7 to exactly 2.1", () => {
  const outcome = sumDealMoney(rows({ profit: "1.4" }, { profit: "0.7" }));

  assert.equal(outcome.components.profit, "2.1");
  assert.equal(outcome.total, "2.1");
});

test("sums values reported at different precisions without rounding", () => {
  const outcome = sumDealMoney(
    rows({ profit: "0.10" }, { profit: "0.200" }, { profit: "0.3" })
  );

  assert.equal(outcome.components.profit, "0.6");
});

// ============================================================
// 3. Zero and sign handling
// ============================================================

test("reports -0 as 0", () => {
  const outcome = sumDealMoney(rows({ fee: "-0" }));

  assert.equal(outcome.components.fee, "0");
  assert.equal(outcome.total, "0");
});

test("reports a cancelling sum as 0, never as -0", () => {
  const outcome = sumDealMoney(rows({ profit: "1.5" }, { profit: "-1.5" }));

  assert.equal(outcome.components.profit, "0");
  assert.equal(outcome.total, "0");
});

test("keeps a signed negative total", () => {
  const outcome = sumDealMoney(rows({ commission: "-0.35" }, { commission: "-0.35" }));

  assert.equal(outcome.components.commission, "-0.7");
  assert.equal(outcome.total, "-0.7");
});

// ============================================================
// 4. Every component is preserved, and fee is part of the total
// ============================================================

test("keeps each broker component separate and adds all four into the total", () => {
  const outcome = sumDealMoney(
    rows(
      { profit: "0", commission: "-0.35" },
      { profit: "2.5", commission: "-0.35", swap: "-0.1", fee: "-0.05" }
    )
  );

  assert.equal(outcome.ok, true);
  assert.deepEqual(
    { ...outcome.components },
    { profit: "2.5", commission: "-0.7", swap: "-0.1", fee: "-0.05" }
  );
  assert.equal(outcome.total, "1.65");
  assert.equal(outcome.dealCount, 2);
});

test("reports money as decimal text, never as a Number", () => {
  const outcome = sumDealMoney(rows({ profit: "2.5", fee: "-0.05" }));

  assert.equal(typeof outcome.total, "string");
  assert.equal(Object.isFrozen(outcome), true);
  assert.equal(Object.isFrozen(outcome.components), true);
});

// ============================================================
// 5. Refusals — missing data is never read as zero
// ============================================================

test("refuses an empty row list with a named reason", () => {
  const outcome = sumDealMoney([]);

  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, DEAL_AMOUNT_REASONS.NO_DEAL_ROWS);
  assert.equal("total" in outcome, false);
  assert.equal("components" in outcome, false);
});

test("refuses a row list that is not a list", () => {
  for (const value of [null, undefined, {}, "0", 0, new Map()]) {
    const outcome = sumDealMoney(value);

    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, DEAL_AMOUNT_REASONS.NO_DEAL_ROWS);
  }
});

test("refuses a row that is not an object", () => {
  const outcome = sumDealMoney([null]);

  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, DEAL_AMOUNT_REASONS.DEAL_ROW_INVALID);
});

test("refuses a row that does not report a money field", () => {
  const row = moneyRow();
  delete row.profit;

  const outcome = sumDealMoney([row]);

  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, DEAL_AMOUNT_REASONS.AMOUNT_FIELD_MISSING);
  assert.equal(outcome.field, "profit");
  assert.equal(outcome.ticket, "1001");
});

test("refuses a reported amount that is null", () => {
  const outcome = sumDealMoney([moneyRow({ swap: null })]);

  assert.equal(outcome.reason, DEAL_AMOUNT_REASONS.AMOUNT_FIELD_MISSING);
  assert.equal(outcome.field, "swap");
});

test("refuses a reported amount the broker sent as a number", () => {
  const outcome = sumDealMoney([moneyRow({ profit: 2.5 })]);

  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, DEAL_AMOUNT_REASONS.AMOUNT_NOT_A_DECIMAL_STRING);
  assert.equal(outcome.field, "profit");
});

test("refuses amounts that are not canonical decimal text", () => {
  for (const value of [
    "",
    "NaN",
    "1,000",
    "1e3",
    ".5",
    "05",
    "+1",
    " 1",
    "1 ",
    "1.",
    "Infinity",
    "-Infinity",
    "0x10",
    "abc",
    "-0.5.5",
    "--1",
  ]) {
    const outcome = sumDealMoney([moneyRow({ fee: value })]);

    assert.equal(outcome.ok, false, `accepted ${JSON.stringify(value)}`);
    assert.equal(
      outcome.reason,
      DEAL_AMOUNT_REASONS.AMOUNT_MALFORMED_DECIMAL,
      `wrong reason for ${JSON.stringify(value)}`
    );
    assert.equal(outcome.field, "fee");
  }
});

// ============================================================
// 6. The shared decimal sum used for non-money fields too
// ============================================================

test("sums a list of decimal texts exactly", () => {
  assert.deepEqual(
    { ...sumDecimalTexts(["0.10", "0.20"]) },
    { ok: true, total: "0.3" }
  );
  assert.deepEqual(
    { ...sumDecimalTexts(["1"]) },
    { ok: true, total: "1" }
  );
  assert.deepEqual(
    { ...sumDecimalTexts(["1", "-0.25"]) },
    { ok: true, total: "0.75" }
  );
});

test("refuses an empty or malformed decimal list", () => {
  assert.equal(sumDecimalTexts([]).reason, DEAL_AMOUNT_REASONS.NO_DECIMAL_VALUES);
  assert.equal(sumDecimalTexts(null).reason, DEAL_AMOUNT_REASONS.NO_DECIMAL_VALUES);

  const numeric = sumDecimalTexts(["0.1", 0.2]);

  assert.equal(numeric.ok, false);
  assert.equal(numeric.reason, DEAL_AMOUNT_REASONS.AMOUNT_NOT_A_DECIMAL_STRING);
  assert.equal(numeric.index, 1);

  const malformed = sumDecimalTexts(["0.1", "1,000"]);

  assert.equal(malformed.reason, DEAL_AMOUNT_REASONS.AMOUNT_MALFORMED_DECIMAL);
  assert.equal(malformed.index, 1);
});
