// ==========================================================
// MARKET PRICE SOURCE AUTHORITY - PURE CONTRACT TESTS
// ==========================================================
//
// Why this module exists. src/context/MarketContext.jsx writes its single
// `bid`/`ask` pair from two independent producers that both believe they own
// it:
//
//   1. the MT5 poll, which fetches GET /api/mt5/price?symbol=... immediately on
//      mount and then on setInterval(..., 1000)
//      (MarketContext.jsx:1313-1391, applied through handlePrice at :1354), and
//   2. the cTrader WebSocket, whose `type:"price"` frames are handed to the very
//      same handlePrice (MarketContext.jsx:1145-1150).
//
// handlePrice guards the SYMBOL (MarketContext.jsx:990-1002) and nothing else,
// so with an IC Markets / cTrader account selected the MT5 demo bridge on port
// 5001 still rewrites the ticket price once per second. That is the defect the
// product rule "Never mix MT5 prices or positions into a cTrader account"
// forbids, and it is invisible in the UI because both paths stamp the same
// state.
//
// SCOPE. Pure decision only. Nothing here is wired into React, and no
// production file was changed to make these pass. These tests prove what the
// rules decide; src/context/marketBrokerSafety.runtime.test.js is what proves
// MarketContext actually applies them, and
// src/context/tradeBrokerSafety.runtime.test.js what proves the declaration is
// made from the selected account.
//
// WHAT THIS CANNOT PROVE: that a live cTrader gateway sends prices in the
// shape assumed here, or that the selected account is the account the backend
// is actually trading on. The selection is the browser's authority and nothing
// in this module can verify it against the server.
// ==========================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  PRICE_SOURCE_MT5,
  PRICE_SOURCE_CTRADER,
  normalizePriceSource,
  priceSourceForBrokerKey,
  canApplyPrice,
  shouldPollMt5Price,
} from "./marketPriceSource.js";

// ============================================================
// 1. THE VOCABULARY IS EXACTLY TWO SOURCES, AND NOTHING ELSE
// ============================================================

test("the two price sources are the only accepted vocabulary", () => {
  assert.equal(PRICE_SOURCE_MT5, "mt5");
  assert.equal(PRICE_SOURCE_CTRADER, "ctrader");

  assert.equal(normalizePriceSource("mt5"), PRICE_SOURCE_MT5);
  assert.equal(normalizePriceSource("ctrader"), PRICE_SOURCE_CTRADER);
});

test("a price source is matched case- and space-insensitively", () => {
  // The stored account label is "cTrader" and the adapter says "ctrader"; the
  // setter must not be the reason the two disagree.
  assert.equal(normalizePriceSource(" cTrader "), PRICE_SOURCE_CTRADER);
  assert.equal(normalizePriceSource("MT5"), PRICE_SOURCE_MT5);
});

test("anything that is not a price source normalizes to null, never to a guess", () => {
  for (const value of [
    undefined,
    null,
    "",
    "   ",
    "ic markets",
    "MT4",
    "meta5",
    0,
    1,
    Number.NaN,
    {},
    [],
    true,
    false,
  ]) {
    assert.equal(
      normalizePriceSource(value),
      null,
      `${JSON.stringify(value)} must not be read as a price source`
    );
  }
});

// ============================================================
// 2. A BROKER KEY MAPS TO A SOURCE WITHOUT INVENTING ONE
// ============================================================

test("a known broker key maps to its own price source", () => {
  assert.equal(
    priceSourceForBrokerKey(PRICE_SOURCE_CTRADER),
    PRICE_SOURCE_CTRADER
  );
  assert.equal(priceSourceForBrokerKey(PRICE_SOURCE_MT5), PRICE_SOURCE_MT5);
});

test("an unknown or absent broker key declares no source at all", () => {
  // The point is the null: "we do not know" must stay unknown rather than
  // defaulting to MT5, which is exactly how an MT5 price would leak in.
  for (const value of [undefined, null, "", "unknown", "IC Markets", 42]) {
    assert.equal(
      priceSourceForBrokerKey(value),
      null,
      `${JSON.stringify(value)} must declare no price source`
    );
  }
});

// ============================================================
// 3. WHO MAY WRITE THE PRICE
// ============================================================

test("the core defect: MT5 cannot write price state when cTrader is declared", () => {
  assert.equal(
    canApplyPrice(PRICE_SOURCE_CTRADER, PRICE_SOURCE_MT5),
    false,
    "an MT5 poll must not overwrite cTrader prices"
  );
});

test("the mirror defect: a cTrader frame cannot write price state when MT5 is declared", () => {
  assert.equal(
    canApplyPrice(PRICE_SOURCE_MT5, PRICE_SOURCE_CTRADER),
    false,
    "one selected account must not be served by the other platform's feed"
  );
});

test("a declared source accepts its own feed", () => {
  assert.equal(canApplyPrice(PRICE_SOURCE_CTRADER, PRICE_SOURCE_CTRADER), true);
  assert.equal(canApplyPrice(PRICE_SOURCE_MT5, PRICE_SOURCE_MT5), true);
});

test("an unasserted declaration accepts either feed, which is today's behaviour", () => {
  // Deliberate: Batch 1 may only ever narrow who writes the price, never
  // silently switch off a feed that works today for a user who has not
  // selected an account.
  assert.equal(canApplyPrice(null, PRICE_SOURCE_MT5), true);
  assert.equal(canApplyPrice(null, PRICE_SOURCE_CTRADER), true);
});

test("an untagged price cannot be applied once a source has been declared", () => {
  // A future writer that forgets to name its source must fail closed rather
  // than join whichever feed happens to be authoritative.
  assert.equal(canApplyPrice(PRICE_SOURCE_CTRADER, null), false);
  assert.equal(canApplyPrice(PRICE_SOURCE_MT5, undefined), false);
});

test("a declaration nobody understands does not lock every price out", () => {
  // A garbage declaration normalizes to null, which is the unasserted state.
  // Failing closed here would blank the terminal over a bad string.
  assert.equal(canApplyPrice("IC Markets", PRICE_SOURCE_MT5), true);
  assert.equal(canApplyPrice({}, PRICE_SOURCE_CTRADER), true);
});

test("a feed that does not name itself is not mistaken for the declared one", () => {
  assert.equal(canApplyPrice(PRICE_SOURCE_CTRADER, "mt5 "), false);
  assert.equal(
    canApplyPrice(PRICE_SOURCE_CTRADER, PRICE_SOURCE_MT5.toUpperCase()),
    false,
    "case-insensitive matching must not turn a rejection into an acceptance"
  );
});

// ============================================================
// 4. WHO MAY MAKE THE NETWORK CALL
// ============================================================

test("MT5 polling stops entirely once cTrader is declared", () => {
  // Refusing to *apply* the number is not enough: the request itself is what
  // makes a dead MT5 bridge look alive and keeps hitting port 5001.
  assert.equal(shouldPollMt5Price(PRICE_SOURCE_CTRADER), false);
});

test("MT5 polling continues when MT5 is declared or nothing is", () => {
  assert.equal(shouldPollMt5Price(PRICE_SOURCE_MT5), true);
  assert.equal(shouldPollMt5Price(null), true);
  assert.equal(shouldPollMt5Price(undefined), true);
});

test("an unreadable declaration does not stop the poll either", () => {
  assert.equal(shouldPollMt5Price("IC Markets"), true);
});

// ============================================================
// 5. THE TWO RULES MAY NOT DISAGREE
// ============================================================

test("a source that may be polled is a source that may be applied", () => {
  for (const declared of [null, PRICE_SOURCE_MT5, PRICE_SOURCE_CTRADER]) {
    assert.equal(
      shouldPollMt5Price(declared),
      canApplyPrice(declared, PRICE_SOURCE_MT5),
      "polling and applying must answer the same question about MT5"
    );
  }
});
