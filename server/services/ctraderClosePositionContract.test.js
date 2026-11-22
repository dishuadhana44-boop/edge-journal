import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ============================================================
   Phase 4A Task 1 — close-position symbol contract

   Offline only. Nothing here opens a socket, starts a process,
   listens on a port or reads a secret value.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* Sources are normalised to \n so the anchors below behave identically on a
   working tree checked out with CRLF and one checked out with LF. */
const readSource = (...parts) =>
  fs
    .readFileSync(path.join(HERE, ...parts), "utf8")
    .replace(/\r\n/g, "\n");

const SERVICE_SOURCE = readSource("ctraderService.js");

const ROUTE_SOURCE = readSource("..", "routes", "ctrader.js");

const { resolvePositionSymbolId } = await import("./ctraderService.js");

/* ============================================================
   ROUTE BLOCK READING
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

/* ============================================================
   CLOSE-POSITION CONTRACT RULES

   Every rule is a thing a wrong implementation could do that the
   broker data would let through. The auditor returns the labels of
   the rules the block fails, so each rule is provably load-bearing.
 ============================================================ */

const CLOSE_RULES = [
  {
    label: "live-positions-are-read-server-side",
    passes: (block) => /getOpenPositions\s*\(/.test(block),
  },
  {
    label: "symbol-is-resolved-from-the-live-record",
    passes: (block) => /resolvePositionSymbolId\s*\(/.test(block),
  },
  {
    label: "client-supplied-symbol-is-ignored",
    passes: (block) => {
      const bodyMatch = block.match(/const\s*\{([^}]*)\}\s*=\s*req\.body/);

      if (!bodyMatch) return false;

      return !/\bsymbolId\b/.test(bodyMatch[1]);
    },
  },
  {
    label: "unresolved-target-fails-closed-before-sending",
    passes: (block) => {
      const bail = block.search(/res\s*\.\s*status\s*\(\s*409\s*\)/);
      const send = block.search(/closePosition\s*\(/);

      return bail !== -1 && send !== -1 && bail < send;
    },
  },
  {
    label: "resolved-symbol-is-handed-to-the-service",
    passes: (block) =>
      /closePosition\s*\(\s*\{[^}]*symbolId:\s*target\.symbolId\s*,/s.test(
        block
      ),
  },
  {
    label: "resolved-id-is-handed-to-the-service",
    passes: (block) =>
      /closePosition\s*\(\s*\{[^}]*positionId:\s*target\.positionId\s*,/s.test(
        block
      ),
  },
];

function closeContractViolations(block) {
  return CLOSE_RULES.filter((rule) => !rule.passes(block)).map(
    (rule) => rule.label
  );
}

/* ============================================================
   RESOLVER — real behavior
 ============================================================ */

test("the service exports a pure close-target resolver", () => {
  assert.equal(
    typeof resolvePositionSymbolId,
    "function",
    "resolvePositionSymbolId must be exported from ctraderService.js"
  );
});

test("the resolver reads the symbol off the live position record", () => {
  const positions = [
    { positionId: "501", symbolId: "2509", symbol: "EURUSD", lots: 0.1 },
    { positionId: "502", symbolId: "3140", symbol: "GBPUSD", lots: 0.2 },
  ];

  assert.deepEqual(resolvePositionSymbolId({ positions, positionId: "502" }), {
    ok: true,
    positionId: "502",
    symbolId: "3140",
  });
});

test("the resolver matches positionId across numeric and string forms", () => {
  const numericRecord = [{ positionId: 501, symbolId: 2509 }];
  const stringRecord = [{ positionId: "501", symbolId: "2509" }];

  assert.equal(
    resolvePositionSymbolId({ positions: numericRecord, positionId: "501" }).ok,
    true
  );
  assert.equal(
    resolvePositionSymbolId({ positions: stringRecord, positionId: 501 }).ok,
    true
  );
  assert.equal(
    resolvePositionSymbolId({ positions: numericRecord, positionId: 501 })
      .symbolId,
    "2509",
    "a numeric broker symbolId must be normalised to a string"
  );
});

test("an unknown position fails closed without inventing a symbol", () => {
  const positions = [{ positionId: "501", symbolId: "2509" }];

  const result = resolvePositionSymbolId({ positions, positionId: "999" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "position_not_found");
  assert.equal(typeof result.message, "string");
  assert.notEqual(result.message.length, 0);
  assert.equal(
    result.symbolId,
    undefined,
    "a failed resolution must not carry any symbolId, not even a guess"
  );
});

test("a position whose symbol is unresolved fails closed", () => {
  const positions = [
    { positionId: "501", symbolId: null, symbol: "SYMBOL_undefined" },
  ];

  const result = resolvePositionSymbolId({ positions, positionId: "501" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "symbol_unavailable");
  assert.equal(result.symbolId, undefined);
});

test("a missing positionId fails closed", () => {
  const positions = [{ positionId: "501", symbolId: "2509" }];

  for (const positionId of [undefined, null, "", 0]) {
    const result = resolvePositionSymbolId({ positions, positionId });

    assert.equal(result.ok, false, `${String(positionId)} must be rejected`);
    assert.equal(result.code, "position_id_missing");
  }
});

test("an unusable positions list fails closed instead of throwing", () => {
  for (const positions of [undefined, null, "EURUSD", {}]) {
    const result = resolvePositionSymbolId({ positions, positionId: "501" });

    assert.equal(result.ok, false);
    assert.equal(result.code, "position_not_found");
  }
});

test("the resolver is pure and leaves its inputs untouched", () => {
  const positions = [{ positionId: "501", symbolId: "2509", lots: 0.1 }];
  const snapshot = JSON.stringify(positions);

  resolvePositionSymbolId({ positions, positionId: "501" });

  assert.equal(JSON.stringify(positions), snapshot);
});

/* ============================================================
   ROUTE — close-position contract, with negative controls
 ============================================================ */

test("route: POST /position/close satisfies the symbol contract", () => {
  const violations = closeContractViolations(
    routeBlock(ROUTE_SOURCE, "/position/close")
  );

  assert.deepEqual(violations, []);
});

test("route: the pre-fix close handler is rejected by the contract", () => {
  /* The real code as it stood before Phase 4A Task 1, kept here as a
     fixture so the rules above are proven to catch the actual bug. */
  const preFix = `router.post(
  "/position/close",
  async (req, res) => {
    try {
      const {
        positionId,
        lots,
      } = req.body;

      await ensureServiceRunning();

      const result =
        await closePosition({
          positionId,
          lots,
        });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);`;

  assert.deepEqual(closeContractViolations(preFix), [
    "live-positions-are-read-server-side",
    "symbol-is-resolved-from-the-live-record",
    "unresolved-target-fails-closed-before-sending",
    "resolved-symbol-is-handed-to-the-service",
    "resolved-id-is-handed-to-the-service",
  ]);
});

test("route: trusting a client-supplied symbol is rejected", () => {
  const trusting = routeBlock(ROUTE_SOURCE, "/position/close").replace(
    /const\s*\{([^}]*)\}\s*=\s*req\.body/,
    "const { positionId, lots, symbolId } = req.body"
  );

  assert.ok(
    closeContractViolations(trusting).includes(
      "client-supplied-symbol-is-ignored"
    ),
    "a handler that reads symbolId from the request body must be rejected"
  );
});

test("route: sending before the resolution check is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/position/close");

  const sendFirst = block.replace(
    /res\s*\.\s*status\s*\(\s*409\s*\)/,
    "noop(409)"
  );

  assert.ok(
    closeContractViolations(sendFirst).includes(
      "unresolved-target-fails-closed-before-sending"
    ),
    "a handler that only mentions 409 after the send must be rejected"
  );
});

test("route: substituting any other symbol source is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/position/close");

  const hardcoded = block.replace(
    "symbolId:\n            target.symbolId,",
    'symbolId: "2509",'
  );

  assert.notEqual(hardcoded, block, "the probe anchor must exist");

  assert.ok(
    closeContractViolations(hardcoded).includes(
      "resolved-symbol-is-handed-to-the-service"
    ),
    "a handler that sends a symbol other than the resolved one must be rejected"
  );

  const rawId = block.replace(
    "positionId:\n            target.positionId,",
    "positionId,"
  );

  assert.notEqual(rawId, block, "the probe anchor must exist");

  assert.ok(
    closeContractViolations(rawId).includes("resolved-id-is-handed-to-the-service"),
    "a handler that re-sends the client id instead of the verified one must fail"
  );
});

/* ============================================================
   RESOLVER CONTRACT — it may use nothing but its own arguments
 ============================================================ */

function resolverSection(source) {
  const start = source.indexOf("export function resolvePositionSymbolId");

  if (start === -1) {
    throw new Error("resolvePositionSymbolId is not exported");
  }

  const end = source.indexOf("\nexport ", start + 1);

  return source.slice(start, end === -1 ? source.length : end);
}

/* Every way the resolver can be handed nothing usable has to answer with a
   failure. Neutralising a gate, or deleting a failure branch, is rejected. */
const FAILURE_GATES = [
  /if\s*\(\s*!target\b/,
  /if\s*\(\s*!Array\.isArray\(\s*positions\s*\)\s*\)/,
  /if\s*\(\s*!match\s*\)/,
  /if\s*\(\s*!symbolId\s*\)/,
];

const RESOLVER_RULES = [
  {
    label: "resolver-reads-nothing-but-its-arguments",
    passes: (section) =>
      !/\bselectedSymbol|\bpositionsMap\b|getSymbolById\s*\(|\bsymbolsMap\b/.test(
        section
      ),
  },
  {
    label: "resolver-cannot-be-handed-a-symbol",
    passes: (section) =>
      /\(\s*\{\s*positions,\s*positionId,\s*\}\s*=\s*\{\}\s*\)/.test(section),
  },
  {
    label: "resolver-fails-closed-on-every-unknown",
    passes: (section) =>
      FAILURE_GATES.every((gate) => gate.test(section)) &&
      (section.match(/ok: false/g) ?? []).length === 4 &&
      /ok: true/.test(section),
  },
];

function resolverViolations(section) {
  return RESOLVER_RULES.filter((rule) => !rule.passes(section)).map(
    (rule) => rule.label
  );
}

test("service: the resolver satisfies its purity contract", () => {
  assert.deepEqual(resolverViolations(resolverSection(SERVICE_SOURCE)), []);
});

test("service: a resolver that guesses the symbol is rejected", () => {
  const guessing = resolverSection(SERVICE_SOURCE).replace(
    "const symbolId = toStringSafe(match.symbolId);",
    "const symbolId =\n    toStringSafe(match.symbolId) ??\n    toStringSafe(selectedSymbolId);"
  );

  assert.notEqual(guessing, resolverSection(SERVICE_SOURCE), "anchor must exist");

  assert.deepEqual(resolverViolations(guessing), [
    "resolver-reads-nothing-but-its-arguments",
  ]);
});

test("service: a resolver that accepts an outside symbol is rejected", () => {
  const section = resolverSection(SERVICE_SOURCE);

  const handed = section.replace(
    "  positions,\n  positionId,\n} = {}) {",
    "  positions,\n  positionId,\n  symbolId,\n} = {}) {"
  );

  assert.notEqual(handed, section, "anchor must exist");

  assert.ok(
    resolverViolations(handed).includes("resolver-cannot-be-handed-a-symbol")
  );
});

test("service: a resolver that stops failing closed is rejected", () => {
  const section = resolverSection(SERVICE_SOURCE);

  const neutralised = section.replace("  if (!symbolId) {", "  if (false) {");

  assert.notEqual(neutralised, section, "anchor must exist");

  assert.ok(
    resolverViolations(neutralised).includes(
      "resolver-fails-closed-on-every-unknown"
    ),
    "a disabled gate must be rejected"
  );

  const deleted = section.replace(
    /  if \(!match\) \{[\s\S]*?\n  \}\n/,
    ""
  );

  assert.notEqual(deleted, section, "deletion anchor must exist");

  assert.ok(
    resolverViolations(deleted).includes("resolver-fails-closed-on-every-unknown"),
    "a deleted failure branch must be rejected"
  );
});

/* ============================================================
   SERVICE GUARD — the symbol requirement stays required
 ============================================================ */

test("service: closePosition still refuses to run without a symbolId", () => {
  const marker = SERVICE_SOURCE.indexOf("export async function closePosition");

  assert.notEqual(marker, -1, "closePosition must remain exported");

  const head = SERVICE_SOURCE.slice(
    marker,
    marker + 900
  );

  assert.match(
    head,
    /if\s*\(\s*!symbolId\s*\)\s*\{[\s\S]{0,120}throw new Error/,
    "the symbolId guard is the last line of defence and must not be relaxed"
  );
});
