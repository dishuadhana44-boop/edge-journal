/* ============================================================
   TRADING ENDPOINT ACCOUNT IDENTITY

   Three routes forward a trade to the cTrader service: POST /order,
   POST /position/close and POST /position/amend. Each of them has to
   prove the same three facts before a single frame leaves the process:

     1. an account is actually selected, and the selection is usable;
     2. that exact account is one of the saved authorized accounts;
     3. the ready service session belongs to that exact account.

   These tests run the real route module inside a confined vm: the
   storage and migration seams are injected fakes, the service is an
   injected fake that records every call, and no filesystem, socket or
   timer is reachable. So a refusal here is not a pattern matched in the
   source — it is the absence of a recorded trading call, an unchanged
   in-memory selection, and nothing written to the store.
   ============================================================ */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIRECTORY = path.resolve(HERE, "..");

/* Only these three modules are loaded for real. The route's own source is
   the thing under test; the shared selection rule must stay real because
   the guard is required to use it rather than reinvent it. */
const REAL_SOURCE_PATHS = new Set(
  [
    "routes/ctrader.js",
    "services/ctraderAccountSelection.js",
    "brokers/identity.js",
  ].map((relative) => path.resolve(SERVER_DIRECTORY, relative))
);

const ROUTE_SOURCE_PATH = path.resolve(SERVER_DIRECTORY, "routes/ctrader.js");

const STUBBED_SOURCE_PATHS = new Map(
  [
    ["services/ctraderService.js", "service"],
    ["services/websocketService.js", "broadcast"],
    ["services/ctraderStore.js", "store"],
    ["services/ctraderAccountMigration.js", "migration"],
    ["runtimePaths.js", "runtimePaths"],
  ].map(([relative, name]) => [
    path.resolve(SERVER_DIRECTORY, relative),
    name,
  ])
);

/* The repo stores sources with CRLF line endings; every anchor in this
   file is written with LF, so the text is normalised once on read. */
const ROUTE_SOURCE = fs
  .readFileSync(ROUTE_SOURCE_PATH, "utf8")
  .replace(/\r\n/g, "\n");

// ============================================================
// SYNTHETIC FIXTURES
// ============================================================

const ACCOUNT_A = "77001122";
const ACCOUNT_B = "88002233";
const UNSAVED_ACCOUNT = "99003344";

const ACCESS_TOKEN = "synthetic-endpoint-access-not-a-credential";
const REFRESH_TOKEN = "synthetic-endpoint-refresh-not-a-credential";

const AUTH_FILE = path.resolve(
  SERVER_DIRECTORY,
  "synthetic-endpoint-auth.fixture.json"
);
const ACCOUNTS_FILE = path.resolve(
  SERVER_DIRECTORY,
  "synthetic-endpoint-accounts.fixture.json"
);

const SYMBOL_ID = "2509";
const SYMBOL_NAME = "EURUSD";
const POSITION_ID = "501";

function accountRecord(accountId) {
  /* The exact keys ctraderStore.normalizeAccount produces, copied from the
     producer so a drift in either direction is a test failure and not a
     fixture that quietly stops resembling runtime state. */
  return {
    id: `fixture-${accountId}`,
    accountId,
    name: `Fixture ${accountId}`,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

function savedState({
  activeAccountId = ACCOUNT_A,
  accounts = [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
  connected = true,
} = {}) {
  return {
    connected,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: 3600,
    accounts,
    activeAccountId,
  };
}

function readyStatus({
  running = true,
  connected = true,
  authenticated = true,
  ready = true,
  tradingAccountId = ACCOUNT_A,
} = {}) {
  return { running, connected, authenticated, ready, tradingAccountId };
}

// ============================================================
// THE ROUTES UNDER TEST
// ============================================================

const TRADING_ROUTES = [
  {
    label: "POST /order",
    method: "post",
    route: "/order",
    operation: "placeMarketOrder",
    body: { symbol: SYMBOL_NAME, side: "Buy", lots: 0.1 },
  },
  {
    label: "POST /position/close",
    method: "post",
    route: "/position/close",
    operation: "closePosition",
    body: { positionId: POSITION_ID, lots: 0.1 },
  },
  {
    label: "POST /position/amend",
    method: "post",
    route: "/position/amend",
    operation: "amendPositionSLTP",
    body: { positionId: POSITION_ID, stopLoss: "1.1000", takeProfit: "1.2000" },
  },
];

/* Every way the three identities can disagree, with the refusal the shared
   rules are expected to name. The codes come out of
   ctraderAccountSelection.js unchanged — the route adds vocabulary for
   nothing but "the service was never ready in the first place". */
const REFUSALS = [
  {
    label: "no account is selected",
    auth: { activeAccountId: null },
    code: "explicit_selection_required",
    status: 400,
  },
  {
    label: "the selected account id is blank",
    auth: { activeAccountId: "   " },
    code: "explicit_selection_required",
    status: 400,
  },
  {
    label: "the selected account id names no account",
    auth: { activeAccountId: { label: "not an id" } },
    code: "explicit_selection_required",
    status: 400,
  },
  {
    label: "the selected account is not one of the saved accounts",
    auth: { activeAccountId: UNSAVED_ACCOUNT },
    code: "requested_account_not_available",
    status: 409,
  },
  {
    /* The session really is serving this account, and the account is
       still not one of the authorized records. Only the second proof
       can refuse this one, so it is the case that proves the saved
       accounts are consulted at all. */
    label: "the session serves an account that was never authorized",
    auth: { activeAccountId: UNSAVED_ACCOUNT },
    service: { tradingAccountId: UNSAVED_ACCOUNT },
    code: "requested_account_not_available",
    status: 409,
  },
  {
    label: "the service is not ready",
    auth: { activeAccountId: ACCOUNT_A },
    service: { ready: false },
    code: "service_not_ready",
    status: 409,
  },
  {
    label: "the service socket is disconnected",
    auth: { activeAccountId: ACCOUNT_A },
    service: { connected: false },
    code: "service_not_ready",
    status: 409,
  },
  {
    label: "the ready service names no account",
    auth: { activeAccountId: ACCOUNT_A },
    service: { tradingAccountId: null },
    code: "session_identity_unverifiable",
    status: 409,
  },
  {
    label: "the ready service belongs to another account",
    auth: { activeAccountId: ACCOUNT_A },
    service: { tradingAccountId: ACCOUNT_B },
    code: "session_identity_mismatch",
    status: 409,
  },
];

// ============================================================
// THE HARNESS
// ============================================================

const TRADING_OPERATIONS = ["placeMarketOrder", "closePosition", "amendPositionSLTP"];
const SESSION_OPERATIONS = ["startCTraderService", "stopCTraderService"];
const SERVICE_OPERATIONS = [...TRADING_OPERATIONS, ...SESSION_OPERATIONS];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function harness({
  auth,
  service,
  source = ROUTE_SOURCE,
  route = TRADING_ROUTES[0],
  body,
} = {}) {
  const state = savedState(auth);
  const pristine = clone(state);
  const status = readyStatus(service);

  const calls = [];
  const savedStates = [];
  const cleared = { count: 0 };
  const storeCreations = [];
  const broadcasts = [];
  const migrations = [];
  const violations = [];
  const logs = [];

  const record = (name, args) => {
    calls.push({ name, args: clone(args) });
  };

  const refuse = (name) => () => {
    violations.push(name);
    throw Object.assign(new Error(`Confined route run reached ${name}`), {
      code: "HARNESS_FORBIDDEN_CALL",
    });
  };

  const fakeProcess = { env: {}, pid: 4242 };

  const quietConsole = Object.fromEntries(
    ["log", "warn", "error", "info", "debug"].map((level) => [
      level,
      (...args) => {
        const text = args
          .map((value) => {
            try {
              return typeof value === "string" ? value : JSON.stringify(value);
            } catch {
              return "";
            }
          })
          .join(" ");

        logs.push({ level, tokenPresent: text.includes(ACCESS_TOKEN) || text.includes(REFRESH_TOKEN) });
      },
    ])
  );

  const serviceExports = Object.fromEntries(
    [
      ...SERVICE_OPERATIONS,
      "getOpenPositions",
      "getAvailableSymbols",
      "resolvePositionSymbolId",
      "resolveOrderSymbolTarget",
      "getCTraderServiceStatus",
      "buildExecutionBroadcastMessage",
    ].map((name) => [name, refuse(`ctraderService.${name}`)])
  );

  const statusFlags = () => status;

  Object.assign(serviceExports, {
    getCTraderServiceStatus: () => {
      record("getCTraderServiceStatus", []);
      return statusFlags();
    },

    startCTraderService: async (...args) => {
      record("startCTraderService", args);
      return statusFlags();
    },

    stopCTraderService: async (...args) => {
      record("stopCTraderService", args);
      return { stopped: true };
    },

    getAvailableSymbols: () => {
      record("getAvailableSymbols", []);
      return [symbolEntry()];
    },

    resolveOrderSymbolTarget: ({ symbol } = {}) => {
      record("resolveOrderSymbolTarget", [symbol]);
      return {
        ok: true,
        symbolId: SYMBOL_ID,
        symbolName: SYMBOL_NAME,
        symbolData: symbolEntry(),
      };
    },

    getOpenPositions: () => {
      record("getOpenPositions", []);
      return [{ positionId: POSITION_ID, symbolId: SYMBOL_ID, symbol: SYMBOL_NAME, lots: 0.1 }];
    },

    resolvePositionSymbolId: ({ positionId } = {}) => {
      record("resolvePositionSymbolId", [positionId]);
      return { ok: true, positionId: String(positionId), symbolId: SYMBOL_ID };
    },

    buildExecutionBroadcastMessage: (execution) => {
      record("buildExecutionBroadcastMessage", [execution]);
      return { type: "execution", execution };
    },
  });

  for (const name of TRADING_OPERATIONS) {
    serviceExports[name] = async (args) => {
      record(name, [args]);
      return name === "placeMarketOrder"
        ? { status: "accepted", orderId: "9001", symbol: SYMBOL_ID }
        : { status: "accepted", positionId: POSITION_ID };
    };
  }

  const context = createContext(
    {
      process: fakeProcess,
      console: quietConsole,
      TextEncoder,
      fetch: refuse("fetch"),
      setTimeout: refuse("setTimeout"),
      setInterval: refuse("setInterval"),
    },
    { codeGeneration: { strings: false, wasm: false } }
  );

  const registrations = [];
  const router = {};
  for (const method of ["get", "post", "put", "delete"]) {
    router[method] = (routePath, handler) => {
      registrations.push({ method, route: routePath, handler });
      return router;
    };
  }

  const modules = new Map();

  function synthetic(identifier, exports) {
    if (!modules.has(identifier)) {
      modules.set(
        identifier,
        new SyntheticModule(
          Object.keys(exports),
          function () {
            for (const [name, value] of Object.entries(exports)) {
              this.setExport(name, value);
            }
          },
          { context, identifier }
        )
      );
    }
    return modules.get(identifier);
  }

  function rejectDependency(specifier) {
    violations.push(`dependency:${specifier}`);
    throw Object.assign(new Error(`Route run imported ${specifier}, outside the allowlist`), {
      code: "HARNESS_DEPENDENCY",
    });
  }

  const filesystem = new Proxy(
    {},
    {
      get(_target, key) {
        violations.push(`node:fs.${String(key)}`);
        throw Object.assign(new Error("The confined route run touched the filesystem"), {
          code: "HARNESS_FILESYSTEM",
        });
      },
    }
  );

  function sourceModule(filename) {
    if (!REAL_SOURCE_PATHS.has(filename)) {
      return rejectDependency(filename);
    }

    const identifier = pathToFileURL(filename).href;

    if (!modules.has(identifier)) {
      const text =
        filename === ROUTE_SOURCE_PATH
          ? source
          : fs.readFileSync(filename, "utf8").replace(/\r\n/g, "\n");

      modules.set(
        identifier,
        new SourceTextModule(text, { context, identifier, importModuleDynamically: rejectDependency })
      );
    }

    return modules.get(identifier);
  }

  function link(specifier, referencingModule) {
    if (specifier === "express") {
      return synthetic("stub:express", { default: { Router: () => router } });
    }

    if (specifier === "fs" || specifier === "node:fs") {
      return synthetic("stub:fs", { ...filesystem, default: filesystem });
    }

    if (specifier === "process" || specifier === "node:process") {
      return synthetic("stub:process", { default: fakeProcess });
    }

    if (specifier === "path" || specifier === "node:path") {
      return synthetic("stub:path", { ...path, default: path });
    }

    if (!specifier.startsWith(".")) {
      return rejectDependency(specifier);
    }

    const resolved = fileURLToPath(new URL(specifier, referencingModule.identifier));
    const stubName = STUBBED_SOURCE_PATHS.get(resolved);

    if (stubName === "runtimePaths") {
      return synthetic("stub:runtimePaths", { AUTH_FILE, ACCOUNTS_FILE });
    }

    if (stubName === "service") {
      return synthetic("stub:service", serviceExports);
    }

    if (stubName === "broadcast") {
      return synthetic("stub:broadcast", {
        broadcast: (message) => {
          broadcasts.push(message);
          return 0;
        },
      });
    }

    if (stubName === "store") {
      return synthetic("stub:store", {
        createCtraderStore: (options) => {
          storeCreations.push(options);
          return {
            filePath: options?.filePath ?? AUTH_FILE,
            load: () => {
              const loaded = clone(state);
              calls.push({ name: "store.load", args: [loaded.activeAccountId] });
              return loaded;
            },
            save: (next) => {
              savedStates.push(clone(next));
            },
            clear: () => {
              cleared.count += 1;
            },
          };
        },
      });
    }

    if (stubName === "migration") {
      return synthetic("stub:migration", {
        migrateLegacyAccounts: () => {
          migrations.push({});
        },
      });
    }

    return sourceModule(resolved);
  }

  const routeModule = sourceModule(ROUTE_SOURCE_PATH);

  await routeModule.link(link);
  await routeModule.evaluate({ timeout: 2000 });

  const summary = () => routeModule.namespace.getBrokerAuthSummary();

  const response = { statusCode: null, body: null, sent: [] };
  const res = {
    status(code) {
      response.statusCode = code;
      return res;
    },
    json(payload) {
      /* Express answers 200 when a handler only calls res.json, and two of
         these routes do exactly that. */
      if (response.statusCode === null) {
        response.statusCode = 200;
      }

      response.body = payload;
      response.sent.push("json");
      return res;
    },
    send(payload) {
      response.body = payload;
      response.sent.push("send");
      return res;
    },
    redirect(location) {
      violations.push("redirect");
      response.sent.push("redirect");
      response.body = { redirect: location };
      return res;
    },
  };

  const handler = registrations.find(
    (entry) => entry.method === route.method && entry.route === route.route
  );

  assert.ok(handler, `${route.method.toUpperCase()} ${route.route} must be registered`);

  let thrown = null;

  try {
    await handler.handler({ body: body ?? clone(route.body) }, res);
  } catch (error) {
    thrown = error;
  }

  const tradingCalls = calls.filter((entry) => TRADING_OPERATIONS.includes(entry.name));
  const sessionCalls = calls.filter((entry) => SESSION_OPERATIONS.includes(entry.name));

  return {
    response,
    summary,
    calls,
    tradingCalls,
    sessionCalls,
    savedStates,
    cleared,
    storeCreations,
    migrations,
    broadcasts,
    logs,
    violations,
    thrown,
    pristine,
    state,
    registrations,
  };
}

function symbolEntry() {
  return {
    symbolId: SYMBOL_ID,
    symbolName: SYMBOL_NAME,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    lotSize: 100000,
    digits: 5,
    fullDataLoaded: true,
  };
}

/* Every run in this file, successful or refused, has to stay inside the
   capabilities the harness handed it. */
function assertConfined(run) {
  assert.deepEqual(run.violations, [], "the confined route run reached a capability it was not given");
  assert.equal(run.thrown, null, `the handler must answer, not throw: ${run.thrown && run.thrown.message}`);
  assert.equal(
    run.logs.some((entry) => entry.tokenPresent),
    false,
    "no captured log may carry a synthetic token"
  );
  assert.equal(run.migrations.length, 1, "only the boot-time migration may have run");
  assert.deepEqual(
    run.storeCreations.map((options) => options.filePath),
    [AUTH_FILE],
    "the route must build its store on the injected path"
  );
}

function assertRefused(run, refusal) {
  assert.equal(run.response.body?.success, false, `a refusal must report failure: ${JSON.stringify(run.response.body)}`);
  assert.equal(
    run.response.body?.code,
    refusal.code,
    `the refusal must name the rule that refused it, not invent one`
  );
  assert.equal(typeof run.response.body?.message, "string", "a refusal must explain itself");
  assert.ok(
    run.response.body.message.length > 20,
    "a refusal message has to be usable by the person reading it"
  );
  assert.equal(run.response.statusCode, refusal.status, `a refusal must answer ${refusal.status}`);
  assert.deepEqual(
    run.tradingCalls.map((entry) => entry.name),
    [],
    "a refused request must never reach the trading service"
  );
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    [],
    "a refused request must not start, stop or replace a session"
  );
  assert.deepEqual(run.savedStates, [], "a refused request must persist nothing");
  assert.equal(run.cleared.count, 0, "a refused request must not remove the saved session");
  assert.equal(
    JSON.stringify(run.summary().activeAccountId),
    JSON.stringify(run.pristine.activeAccountId),
    "a refused request must leave the selected account exactly as it was"
  );
}

function refusalRun(route, refusal) {
  return harness({
    route,
    auth: refusal.auth,
    service: refusal.service,
  }).then((run) => {
    assertConfined(run);
    assertRefused(run, refusal);
    return run;
  });
}

// ============================================================
// MUTANTS — each proof has to be the thing that refuses
// ============================================================

function mutate(source, from, to) {
  const hits = source.split(from).length - 1;

  assert.equal(
    hits,
    1,
    `the mutation anchor must appear exactly once, found ${hits}: ${from.slice(0, 60)}`
  );

  return source.split(from).join(to);
}

async function mutantRun({ source, refusalIndex = 0, routeIndex = 0 }) {
  const route = TRADING_ROUTES[routeIndex];
  const refusal = REFUSALS[refusalIndex];

  const run = await harness({
    route,
    source,
    auth: refusal.auth,
    service: refusal.service,
  });

  assertConfined(run);

  return { run, route, refusal };
}

const NOT_READY = REFUSALS.findIndex((entry) => entry.label === "the service is not ready");
const NOT_SAVED = REFUSALS.findIndex(
  (entry) => entry.label === "the session serves an account that was never authorized"
);
const MISMATCH = REFUSALS.findIndex(
  (entry) => entry.label === "the ready service belongs to another account"
);
const NOT_IN_RECORDS = REFUSALS.findIndex(
  (entry) => entry.label === "the selected account is not one of the saved accounts"
);

test("mutant M1 a trading route that skips the guard trades on an unauthorized account", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    "\n    const identity = tradingEndpointIdentity();",
    "\n    const identity = { ok: true };"
  );

  const { run, route } = await mutantRun({
    source,
    refusalIndex: NOT_SAVED,
    routeIndex: 0,
  });

  assert.deepEqual(
    run.tradingCalls.map((entry) => entry.name),
    ["placeMarketOrder"],
    `${route.label} without the guard must forward the very request the suite refuses`
  );
  assert.equal(
    run.response.body.success,
    true,
    "and it must report that trade as a success"
  );
});

test("mutant M2 a guard that never reads the saved accounts lets an unauthorized account trade", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `    accountIds: (
      Array.isArray(ctraderAuth.accounts) ? ctraderAuth.accounts : []
    ).map((account) => account?.accountId),`,
    "    accountIds: [ctraderAuth.activeAccountId],"
  );

  const { run } = await mutantRun({ source, refusalIndex: NOT_SAVED });

  assert.deepEqual(
    run.tradingCalls.map((entry) => entry.name),
    ["placeMarketOrder"],
    "an account the guard only asked itself for is an account nobody authorized"
  );
});

test("mutant M3 a guard that skips the ready check starts a session to trade on", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `  if (
    !status.running ||
    !status.connected ||
    !status.authenticated ||
    !status.ready
  ) {`,
    "  if (false) {"
  );

  const { run } = await mutantRun({ source, refusalIndex: NOT_READY });

  /* The injected session never becomes ready, so this mutant does not
     reach a trade — but it has already done the thing the proof forbids.
     The endpoint asked the service to bring a session up for a request
     it must refuse, which is the identity decision the guard exists to
     stop, and the caller is handed a 500 instead of a named refusal. */
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    ["startCTraderService"],
    "a trading endpoint that brings a session up is making the identity decision the guard exists to refuse"
  );
  assert.equal(run.response.statusCode, 500);
  assert.equal(
    run.response.body.code,
    undefined,
    "the refusal is what names the rule that refused"
  );
});

test("mutant M4 a guard that skips the session proof answers 500 instead of refusing", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    "  if (!session.ok) {",
    "  if (!session.ok && false) {"
  );

  const { run } = await mutantRun({ source, refusalIndex: MISMATCH });

  /* The service's own ready branch still catches this one, so no trade
     is forwarded — what the mutant loses is the refusal itself: the
     request reaches the session, and the answer is a 500 with no rule
     named. That is the difference between "this process disagreed with
     itself" and "your request was refused before anything was touched". */
  assert.equal(run.response.statusCode, 500);
  assert.equal(
    run.response.body.code,
    undefined,
    "the refusal is what names the rule that refused"
  );
});

test("mutant M5 a guard that picks a saved account instead of the selected one refuses for a different rule", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `    requestedAccountId: ctraderAuth.activeAccountId,
  });`,
    `    requestedAccountId: (
      Array.isArray(ctraderAuth.accounts) ? ctraderAuth.accounts : []
    )[0]?.accountId,
  });`
  );

  const { run } = await mutantRun({ source, refusalIndex: NOT_IN_RECORDS });

  /* The request is still stopped, but by a rule further down the route
     that was never asked to make this decision: the proof that the
     selected account is one of the authorized records was skipped, so
     the caller gets a 500 that names the session instead of the 409
     that names the selection. A guard that answers somebody else's
     failure has stopped guarding. */
  assert.notEqual(
    run.response.body.code,
    "requested_account_not_available",
    "the refusal the second proof exists to give is gone"
  );
  assert.equal(
    run.response.statusCode,
    500,
    "and the request was stopped by a later rule, not refused by the guard"
  );
  assert.equal(
    JSON.stringify(run.summary().activeAccountId),
    JSON.stringify(UNSAVED_ACCOUNT),
    "the mutant chose an account the selection never named"
  );
});

test("the unmutated route names the refusal each mutant above loses", async () => {
  for (const refusalIndex of [NOT_READY, NOT_SAVED, NOT_IN_RECORDS, MISMATCH]) {
    const { run, refusal } = await mutantRun({ source: ROUTE_SOURCE, refusalIndex });

    assertRefused(run, refusal);
  }
});

// ============================================================
// REQUIREMENTS 1-6 AND 8-12 — every route refuses the same way
// ============================================================

for (const route of TRADING_ROUTES) {
  for (const refusal of REFUSALS) {
    test(`${route.label} is refused when ${refusal.label}`, async () => {
      await refusalRun(route, refusal);
    });
  }
}

// ============================================================
// REQUIREMENT 7 AND 13 — agreeing identities still trade, unchanged
// ============================================================

test("a fully matching order request still reaches the service and answers 200", async () => {
  const run = await harness({ route: TRADING_ROUTES[0] });
  assertConfined(run);

  assert.deepEqual(
    run.tradingCalls.map((entry) => entry.name),
    ["placeMarketOrder"],
    "the order must be forwarded exactly once"
  );
  assert.equal(run.tradingCalls[0].args[0].symbol, SYMBOL_ID, "the resolved symbol id must be forwarded");
  assert.equal(run.response.statusCode, 200);
  assert.equal(run.response.body.success, true);
  assert.equal(run.response.body.status, "accepted");
  assert.equal(run.response.body.activeAccountId, ACCOUNT_A);
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    [],
    "a ready matching session must neither be restarted nor stopped"
  );
  assert.ok(
    run.calls.some((entry) => entry.name === "getCTraderServiceStatus"),
    "the route must read the service status it claims to trust"
  );
});

test("a fully matching close request still reaches the service and answers", async () => {
  const run = await harness({ route: TRADING_ROUTES[1] });
  assertConfined(run);

  assert.deepEqual(
    run.tradingCalls.map((entry) => entry.name),
    ["closePosition"],
    "the close must be forwarded exactly once"
  );
  assert.equal(run.tradingCalls[0].args[0].positionId, POSITION_ID);
  assert.equal(run.tradingCalls[0].args[0].symbolId, SYMBOL_ID);
  assert.equal(run.response.statusCode, 200);
  assert.equal(run.response.body.status, "accepted");
});

test("a fully matching amend request still reaches the service and answers", async () => {
  const run = await harness({ route: TRADING_ROUTES[2] });
  assertConfined(run);

  assert.deepEqual(
    run.tradingCalls.map((entry) => entry.name),
    ["amendPositionSLTP"],
    "the amend must be forwarded exactly once"
  );
  assert.equal(run.response.statusCode, 200);
  assert.equal(run.response.body.status, "accepted");
});

test("an unauthenticated session is still a 401 before any identity proof", async () => {
  const run = await harness({
    route: TRADING_ROUTES[0],
    auth: { connected: false },
  });
  assertConfined(run);

  assert.equal(run.response.statusCode, 401);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(run.tradingCalls, [], "an OAuth-less request must not reach the service");
  assert.equal(
    run.calls.some((entry) => entry.name === "store.save"),
    false,
    "the refusal must not write"
  );
});

test("an invalid argument is still refused before the service is asked to trade", async () => {
  const run = await harness({
    route: TRADING_ROUTES[0],
    body: { side: "Buy", lots: 0.1 },
  });
  assertConfined(run);

  assert.equal(run.response.statusCode, 400);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(run.tradingCalls, [], "a bad order must not reach the service");
});

// ============================================================
// WIRING — the guard is the shared rule, and no variant skips it
// ============================================================

function tradingRouteBlocks(source) {
  const blocks = [];

  for (const route of TRADING_ROUTES) {
    const marker = source.indexOf(`"${route.route}"`);

    assert.notEqual(marker, -1, `${route.route} must still be registered`);

    const start = source.lastIndexOf("router.", marker);
    const end = source.indexOf("router.", start + 1);

    blocks.push({
      route: route.route,
      operation: route.operation,
      text: source.slice(start, end === -1 ? source.length : end),
    });
  }

  return blocks;
}

test("wiring: every trading route proves the account identity before forwarding", () => {
  for (const block of tradingRouteBlocks(ROUTE_SOURCE)) {
    const forwarded = block.text.indexOf(block.operation);

    assert.notEqual(forwarded, -1, `${block.route} must still call ${block.operation}`);

    const guard = block.text.indexOf("tradingEndpointIdentity(");

    assert.notEqual(
      guard,
      -1,
      `${block.route} must ask the shared endpoint identity rule before it forwards anything`
    );
    assert.ok(guard < forwarded, `${block.route} must refuse before it calls ${block.operation}`);

    const ensured = block.text.indexOf("ensureServiceRunning(");

    assert.ok(
      ensured === -1 || guard < ensured,
      `${block.route} must not start or reuse a session before the identity is proven`
    );
  }
});

test("wiring: the endpoint guard compares nothing itself and reads the shared rules", () => {
  const start = ROUTE_SOURCE.indexOf("function tradingEndpointIdentity(");

  assert.notEqual(start, -1, "the route must own one named endpoint identity rule");

  const end = ROUTE_SOURCE.indexOf("\n}\n", start);

  assert.notEqual(end, -1, "the endpoint identity rule must be readable on its own");

  const body = ROUTE_SOURCE.slice(start, end);

  for (const shared of ["selectAccountById(", "verifySessionAccountIdentity("]) {
    assert.ok(body.includes(shared), `the guard must delegate to ${shared}`);
  }

  /* A second comparison in the route is how the two rules drift apart. */
  assert.equal(
    /String\s*\([^)]*\)\s*===\s*String\s*\(/.test(body),
    false,
    "the guard must not hand-roll an account id comparison"
  );
  assert.equal(
    /\.find\s*\(/.test(body) || /\.some\s*\(/.test(body) || /\.includes\s*\(/.test(body),
    false,
    "the guard must not search the saved accounts itself"
  );
  assert.equal(
    /\bstopCTraderService\b|\bswitchActiveAccount\b|activeAccountId\s*=[^=]/.test(body),
    false,
    "the guard must not touch the session or the selection"
  );
});

/* Every handler block, however it is registered: a second route that
   trades would otherwise be a way around the guard nobody looked at. */
test("wiring: no route handler forwards a trading operation without the guard", () => {
  const blocks = ROUTE_SOURCE.split(/\brouter\.(?:get|post|put|delete)\b/).slice(1);

  assert.ok(blocks.length > 10, "every registered handler must be inspected");

  const unprotected = [];

  for (const operation of TRADING_OPERATIONS) {
    const called = new RegExp(`\\b${operation}\\s*\\(`);
    const guarded = /\btradingEndpointIdentity\s*\(/;

    blocks.forEach((block, index) => {
      if (called.test(block) && !guarded.test(block)) {
        unprotected.push(`${operation} in handler #${index + 1}`);
      }
    });
  }

  assert.deepEqual(unprotected, [], "a route that trades without the endpoint identity rule can trade on the wrong account");
});
