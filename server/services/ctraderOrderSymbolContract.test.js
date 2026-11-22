import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ============================================================
   Phase 4A Task 2 — market-order symbol contract

   Offline only. Nothing here opens a socket, starts a process,
   listens on a port, places an order or reads a secret value.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

const readSource = (...parts) =>
  fs
    .readFileSync(path.join(HERE, ...parts), "utf8")
    .replace(/\r\n/g, "\n");

const SERVICE_SOURCE = readSource("ctraderService.js");
const ROUTE_SOURCE = readSource("..", "routes", "ctrader.js");
const ADAPTER_SOURCE = readSource("..", "brokers", "ctraderAdapter.js");

const { resolveOrderSymbolTarget } = await import("./ctraderService.js");

/* ============================================================
   FIXTURES — copied from the producers
   getAvailableSymbols() (server/services/ctraderService.js:3249)
   and the light records stored at :2120
   ============================================================ */

function directory() {
  return [
    {
      symbolId: "2509",
      symbolName: "EURUSD",
      minVolume: 1000,
      maxVolume: 16666000,
      volumeStep: 1000,
      lotSize: 100000,
      digits: 5,
      fullDataLoaded: true,
    },
    {
      symbolId: "2514",
      symbolName: "XAUUSD",
      minVolume: 10,
      maxVolume: 100,
      volumeStep: 10,
      lotSize: 100,
      digits: 2,
      fullDataLoaded: true,
    },
    {
      symbolId: "2530",
      symbolName: "GBPJPY",
      minVolume: null,
      maxVolume: null,
      volumeStep: null,
      lotSize: null,
      digits: null,
      fullDataLoaded: false,
    },
  ];
}

/* ============================================================
   RESOLVER — real behavior
 ============================================================ */

test("the service exports a pure order-target resolver", () => {
  assert.equal(
    typeof resolveOrderSymbolTarget,
    "function",
    "resolveOrderSymbolTarget must be exported from ctraderService.js"
  );
});

test("the resolver matches an exact symbolId", () => {
  const result = resolveOrderSymbolTarget({
    symbols: directory(),
    symbol: "2514",
  });

  assert.equal(result.ok, true);
  assert.equal(result.symbolId, "2514");
  assert.equal(result.symbolName, "XAUUSD");
  assert.equal(result.symbolData.lotSize, 100);
});

test("the resolver matches a numeric symbolId", () => {
  for (const symbol of [2509, "2509", " 2509 "]) {
    const result = resolveOrderSymbolTarget({ symbols: directory(), symbol });

    assert.equal(result.ok, true, `${JSON.stringify(symbol)} must resolve`);
    assert.equal(result.symbolId, "2509", "the id must be handed back normalised");
    assert.equal(result.symbolName, "EURUSD");
  }
});

test("the resolver matches a symbol name ignoring case and separators", () => {
  for (const symbol of ["XAUUSD", "xauusd", " xau_usd ", "XAU-USD"]) {
    const result = resolveOrderSymbolTarget({ symbols: directory(), symbol });

    assert.equal(result.ok, true, `${symbol} must resolve`);
    assert.equal(result.symbolId, "2514");
  }
});

test("an unknown symbol fails closed without offering any id", () => {
  const result = resolveOrderSymbolTarget({
    symbols: directory(),
    symbol: "BTCUSD",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "symbol_not_found");
  assert.equal(typeof result.message, "string");
  assert.notEqual(result.message.length, 0);
  assert.equal(result.symbolId, undefined);
  assert.equal(result.symbolData, undefined);
});

test("a symbol known but not fully configured fails closed", () => {
  const result = resolveOrderSymbolTarget({
    symbols: directory(),
    symbol: "GBPJPY",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "symbol_not_configured");
  assert.equal(result.symbolId, undefined);
  assert.match(result.message, /GBPJPY/);
  assert.match(result.message, /not sent/i);
});

test("a symbol listed but never loaded from the broker fails closed", () => {
  const listed = { ...directory()[1], fullDataLoaded: false };

  const result = resolveOrderSymbolTarget({
    symbols: [listed],
    symbol: "2514",
  });

  assert.equal(
    result.ok,
    false,
    "the full-data flag alone must be enough to refuse an order"
  );
  assert.equal(result.code, "symbol_not_configured");
  assert.equal(result.symbolData, undefined);
});

test("a configured symbol missing sizing data fails closed", () => {
  const base = directory()[1];

  for (const field of ["lotSize", "volumeStep"]) {
    const broken = { ...base, [field]: null };
    const result = resolveOrderSymbolTarget({
      symbols: [broken],
      symbol: "2514",
    });

    assert.equal(result.ok, false, `a null ${field} must be refused`);
    assert.equal(result.code, "symbol_not_configured");
  }

  const zeroStep = resolveOrderSymbolTarget({
    symbols: [{ ...base, lotSize: 0 }],
    symbol: "2514",
  });

  assert.equal(zeroStep.ok, false, "a zero lot size must be refused");
});

test("an absent or blank symbol fails closed", () => {
  for (const symbol of [undefined, null, "", "   ", 0]) {
    const result = resolveOrderSymbolTarget({ symbols: directory(), symbol });

    assert.equal(result.ok, false, `${String(symbol)} must be refused`);
    assert.equal(result.code, "symbol_missing");
  }
});

test("an unusable symbol directory fails closed instead of throwing", () => {
  for (const symbols of [undefined, null, "EURUSD", {}, 42]) {
    const result = resolveOrderSymbolTarget({ symbols, symbol: "EURUSD" });

    assert.equal(result.ok, false);
    assert.equal(result.code, "symbol_directory_unavailable");
    assert.equal(result.symbolId, undefined);
  }
});

test("resolution never depends on which symbol is activated", () => {
  const first = resolveOrderSymbolTarget({ symbols: directory(), symbol: "XAUUSD" });
  const second = resolveOrderSymbolTarget({ symbols: directory(), symbol: "EURUSD" });
  const third = resolveOrderSymbolTarget({ symbols: directory(), symbol: "2514" });

  assert.equal(first.symbolId, "2514");
  assert.equal(second.symbolId, "2509", "a later request must not inherit the earlier symbol");
  assert.equal(third.symbolId, "2514");
});

test("the resolver is pure and leaves its inputs untouched", () => {
  const symbols = directory();
  const snapshot = JSON.stringify(symbols);

  resolveOrderSymbolTarget({ symbols, symbol: "XAUUSD" });

  assert.equal(JSON.stringify(symbols), snapshot);
});

/* Documented gap, not an oversight: normalizing the directory entry's own
   symbolName is defensive. Broker symbol names arrive canonical, so no honest
   fixture separates normalizeSymbolName(entry.symbolName) from
   String(entry.symbolName); that mutant survived testing on 2026-11-07 and was
   deliberately left unpinned rather than answered with an invented record. */

/* ============================================================
   SERVICE CONTRACT — placeMarketOrder may not substitute a symbol
   ============================================================ */

function sectionOf(source, declaration) {
  const start = source.indexOf(declaration);

  if (start === -1) {
    throw new Error(`${declaration} is missing`);
  }

  const end = source.indexOf("\nexport ", start + 1);

  return source.slice(start, end === -1 ? source.length : end);
}

const ORDER_RULES = [
  {
    label: "symbol-is-an-argument",
    passes: (body) =>
      /function placeMarketOrder\(\s*\{\s*symbol,/.test(body),
  },
  {
    label: "order-target-never-reads-the-activated-symbol",
    passes: (body) => !/selectedSymbol/.test(body),
  },
  {
    label: "symbol-is-resolved-from-the-directory",
    passes: (body) =>
      /resolveOrderSymbolTarget\s*\(\s*\{[^}]*symbols:[^}]*getAvailableSymbols\s*\(\s*\)/s.test(
        body
      ),
  },
  {
    label: "failed-resolution-blocks-the-send",
    passes: (body) => {
      const bail = body.search(/if\s*\(\s*!target\.ok\s*\)/);
      const send = body.search(/NewOrderReq\s*\.\s*create/);

      return bail !== -1 && send !== -1 && bail < send;
    },
  },
  {
    label: "request-carries-the-resolved-symbol",
    passes: (body) => /symbolId:\s*symbolData\.symbolId/.test(body),
  },
  {
    label: "result-echoes-the-resolved-symbol",
    passes: (body) =>
      /symbol:\s*symbolData\.symbolName/.test(body) &&
      /symbolId:\s*toStringSafe\(\s*symbolData\.symbolId\s*\)/.test(body),
  },
];

function orderViolations(body) {
  return ORDER_RULES.filter((rule) => !rule.passes(body)).map((r) => r.label);
}

const ORDER_DECLARATION = "export async function placeMarketOrder";

test("service: placeMarketOrder satisfies the symbol contract", () => {
  assert.deepEqual(orderViolations(sectionOf(SERVICE_SOURCE, ORDER_DECLARATION)), []);
});

test("service: the pre-fix placeMarketOrder is rejected by the contract", () => {
  const preFix = `export async function placeMarketOrder({
  side,
  lots,
}) {
  if (!selectedSymbolId) {
    throw new Error("Trading symbol is unavailable.");
  }

  const symbolData = getSymbolById(selectedSymbolId);

  const requestData = { symbolId: selectedSymbolId, volume };

  const request = NewOrderReq.create(requestData);

  return { success: true, symbol: selectedSymbolName, symbolId: toStringSafe(selectedSymbolId) };
}`;

  assert.deepEqual(orderViolations(preFix), ORDER_RULES.map((r) => r.label));
});

test("service: a placeMarketOrder that falls back is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const fallback = body.replace(
    /symbolId:\s*symbolData\.symbolId,/,
    "symbolId: symbolData?.symbolId ?? selectedSymbolId,"
  );

  assert.notEqual(fallback, body, "anchor must exist");
  assert.ok(
    orderViolations(fallback).includes(
      "order-target-never-reads-the-activated-symbol"
    ),
    "a fallback to the activated symbol must be rejected"
  );
});

test("service: an order request built from the raw client symbol is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const raw = body.replace(
    /symbolId:\s*symbolData\.symbolId,/,
    "symbolId:\n      symbol,"
  );

  assert.notEqual(raw, body, "anchor must exist");
  assert.ok(
    orderViolations(raw).includes("request-carries-the-resolved-symbol"),
    "the client string must not reach the broker request"
  );
});

test("service: resolving against a directory other than the account's is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const hardcoded = body.replace(
    /symbols:\s*getAvailableSymbols\(\),/,
    "symbols: [{ symbolId: symbol, fullDataLoaded: true }],"
  );

  assert.notEqual(hardcoded, body, "anchor must exist");
  assert.ok(
    orderViolations(hardcoded).includes("symbol-is-resolved-from-the-directory"),
    "the live symbol directory is the only valid source"
  );
});

test("service: a placeMarketOrder that sends before checking is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const unchecked = body.replace("if (!target.ok) {", "if (false) {");

  assert.notEqual(unchecked, body, "anchor must exist");
  assert.ok(
    orderViolations(unchecked).includes("failed-resolution-blocks-the-send"),
    "a disabled resolution gate must be rejected"
  );
});

test("service: a placeMarketOrder that echoes the wrong symbol is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const mislabelled = body.replace(
    /symbolId:\s*toStringSafe\(\s*symbolData\.symbolId/,
    "symbolId:\n      toStringSafe(\n        symbolData.digits"
  );

  assert.notEqual(mislabelled, body, "anchor must exist");
  assert.ok(
    orderViolations(mislabelled).includes("result-echoes-the-resolved-symbol")
  );
});

/* ============================================================
   ROUTE CONTRACT — /order resolves before it places
   ============================================================ */

function routeBlock(source, routePath) {
  const marker = source.indexOf(`"${routePath}"`);

  if (marker === -1) {
    throw new Error(`route ${routePath} is not registered`);
  }

  const start = source.lastIndexOf("router.", marker);
  const end = source.indexOf("router.", start + 1);

  return source.slice(start, end === -1 ? source.length : end);
}

const ORDER_ROUTE_RULES = [
  {
    label: "symbol-directory-is-read-server-side",
    passes: (block) => /getAvailableSymbols\s*\(/.test(block),
  },
  {
    label: "order-target-is-resolved",
    passes: (block) => /resolveOrderSymbolTarget\s*\(/.test(block),
  },
  {
    label: "missing-symbol-is-still-a-400",
    passes: (block) => {
      const placed = block.search(/placeMarketOrder\s*\(/);
      const guard = block.search(/if\s*\(\s*!symbol\s*\)\s*\{/);

      if (placed === -1 || guard === -1 || guard > placed) {
        return false;
      }

      const nextGuard = block.indexOf("if (", guard + 4);
      const bodyEnd =
        nextGuard === -1 || nextGuard > placed ? placed : nextGuard;

      return /res\s*\.\s*status\s*\(\s*400\s*\)/.test(
        block.slice(guard, bodyEnd)
      );
    },
  },
  {
    label: "unusable-symbol-fails-closed-before-placing",
    passes: (block) => {
      const placed = block.search(/placeMarketOrder\s*\(/);
      const guard = block.search(/if\s*\(\s*!target\.ok\s*\)\s*\{/);

      if (placed === -1 || guard === -1 || guard > placed) {
        return false;
      }

      return /res\s*\.\s*status\s*\(\s*409\s*\)/.test(
        block.slice(guard, placed)
      );
    },
  },
  {
    label: "resolved-id-is-handed-to-the-service",
    passes: (block) =>
      /placeMarketOrder\s*\(\s*\{[^}]*symbol:\s*target\.symbolId/s.test(block),
  },
];

function orderRouteViolations(block) {
  return ORDER_ROUTE_RULES.filter((rule) => !rule.passes(block)).map(
    (r) => r.label
  );
}

test("route: POST /order satisfies the symbol contract", () => {
  assert.deepEqual(orderRouteViolations(routeBlock(ROUTE_SOURCE, "/order")), []);
});

test("route: the pre-fix order handler is rejected by the contract", () => {
  const preFix = `router.post("/order", async (req, res) => {
  const { symbol, side, lots } = req.body;

  if (!symbol) {
    return res.status(400).json({ success: false, message: "Symbol is required" });
  }

  await ensureServiceRunning();

  const result = await placeMarketOrder({ symbol, side, lots });

  return res.json(result);
});`;

  assert.deepEqual(orderRouteViolations(preFix), [
    "symbol-directory-is-read-server-side",
    "order-target-is-resolved",
    "unusable-symbol-fails-closed-before-placing",
    "resolved-id-is-handed-to-the-service",
  ]);
});

test("route: passing the raw client symbol through is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/order");

  const unverified = block.replace(
    "symbol: target.symbolId,",
    "symbol,"
  );

  assert.notEqual(unverified, block, "anchor must exist");
  assert.ok(
    orderRouteViolations(unverified).includes("resolved-id-is-handed-to-the-service")
  );
});

test("route: dropping the 400 for a missing symbol is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/order");

  const noBadRequest = block.replace(
    /if \(!symbol\) \{[\s\S]*?\n    \}\n/,
    ""
  );

  assert.notEqual(noBadRequest, block, "deletion anchor must exist");
  assert.ok(
    orderRouteViolations(noBadRequest).includes("missing-symbol-is-still-a-400")
  );
});

test("route: a 409 outside the failed-resolution guard is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/order");

  const guard = block.match(
    /if \(!target\.ok\) \{[\s\S]*?\n    \}\n/
  );

  assert.ok(guard, "the 409 guard must exist before the order is placed");

  const ungated = block.replace(guard[0], "");

  assert.ok(
    orderRouteViolations(ungated).includes(
      "unusable-symbol-fails-closed-before-placing"
    ),
    "removing the resolution gate must be rejected"
  );

  const wrongStatus = block.replace(
    /if \(!target\.ok\) \{\n\s*return res\.status\(409\)/,
    "if (!target.ok) {\n      return res.status(403)"
  );

  assert.notEqual(wrongStatus, block, "status anchor must exist");
  assert.ok(
    orderRouteViolations(wrongStatus).includes(
      "unusable-symbol-fails-closed-before-placing"
    ),
    "a non-409 refusal must be rejected"
  );
});

/* ============================================================
   STATUS CLAIMS — the adapter must not over- or under-claim
   ============================================================ */

function limitationLines(source) {
  const start = source.indexOf("const limitations = [");

  assert.notEqual(start, -1, "the ctrader adapter must declare its limitations");

  const end = source.indexOf("];", start);

  return source.slice(start, end);
}

test("status: fixed defects are no longer claimed as broken", () => {
  const lines = limitationLines(ADAPTER_SOURCE);

  assert.doesNotMatch(
    lines,
    /ignores a symbol/,
    "placeMarketOrder no longer ignores its symbol"
  );
  assert.doesNotMatch(
    lines,
    /always fails/,
    "the close route is no longer dead by construction"
  );
});

test("status: still-open defects stay disclosed", () => {
  const lines = limitationLines(ADAPTER_SOURCE);

  assert.match(lines, /hardcoded demo/);
  assert.match(lines, /heartbeat/);
  assert.match(lines, /refresh token/);
  assert.match(lines, /send time/);
  assert.match(lines, /Pending orders/);
});
