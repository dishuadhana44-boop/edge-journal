/* ============================================================
   OAUTH RETURN IS NOT ACCOUNT SELECTION

   The callback answers one question: did this browser just prove it
   may act for this cTrader identity? It also happens to be the only
   place the process learns a new access token. Nothing else belongs in
   that answer, and the thing that does not belong today is a trading
   session: `server/routes/ctrader.js` starts one whenever the state it
   just carried over still names an active account.

   Phase 2.1-e Task 8 Step 1 writes the contract before the change. The
   invariant each of these tests argues for is that an authorization
   return never starts, stops or re-points a session - a previously
   selected account is not a request to trade with it now.

   Every run here is the real route module executed inside a confined
   vm, the same way routes/ctraderAccountSaveActivation.test.js runs it.
   The storage seam, the session and the migration are injected fakes;
   the shared selection rule is loaded for real, because the route is
   required to use it rather than reinvent it. `fetch` is a recording
   stub that answers only URLs this file registered and throws on every
   other one, so a callback run cannot reach a network even by
   accident - there is no real fetch in the context to fall through to.
   Timers and WebSocket construction are refused outright.

   Every account id, name, token, authorization code, query value and
   environment value below is synthetic. Nothing reads a credential
   file, and no captured log line, redirect or persisted state is ever
   asked to quote one.
   ============================================================ */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIRECTORY = path.resolve(HERE, "..");

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
  ].map(([relative, name]) => [path.resolve(SERVER_DIRECTORY, relative), name])
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

const ACCESS_TOKEN = "synthetic-callback-access-not-a-credential";
const REFRESH_TOKEN = "synthetic-callback-refresh-not-a-credential";
const AUTHORIZATION_CODE = "synthetic-callback-code-not-a-real-code";

/* A query value the callback is not allowed to read. It is planted so
   that a route which spread req.query anywhere - into the token
   request, into a redirect, into the store, into a log - is caught by
   the assertions instead of by a reader's opinion. */
const UNREAD_QUERY_VALUE = "synthetic-canary-never-forwarded";

/* The callback reads these three through process.env, so the confined
   process carries them and nothing else. The real .env is never
   consulted: the fake process object is the whole environment. */
const ENVIRONMENT = {
  CTRADER_CLIENT_ID: "synthetic-client-id",
  CTRADER_CLIENT_SECRET: "synthetic-client-secret",
  CTRADER_REDIRECT_URI: "synthetic-redirect-uri",
};

const AUTH_FILE = path.resolve(
  SERVER_DIRECTORY,
  "synthetic-callback-auth.fixture.json"
);
const ACCOUNTS_FILE = path.resolve(
  SERVER_DIRECTORY,
  "synthetic-callback-accounts.fixture.json"
);

/* The one URL shape this file registers. Matching on the path segment
   rather than a stored full URL keeps the host out of the test and
   still refuses anything else the route might ask for. */
const TOKEN_PATH = "/apps/token";

/* What four different token-endpoint answers look like. Each is
   registered only for the test that asks for it. */
const TOKEN_ANSWERS = {
  issued: [
    {
      match: TOKEN_PATH,
      status: 200,
      ok: true,
      body: {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        expiresIn: 3600,
      },
    },
  ],

  /* An answer that also names accounts. The callback has no business
     reading them: account records come from the saved list, and an
     identity that arrived here would be an authorization deciding a
     selection. */
  issuedWithAccountData: [
    {
      match: TOKEN_PATH,
      status: 200,
      ok: true,
      body: {
        accessToken: ACCESS_TOKEN,
        refreshToken: null,
        expiresIn: 3600,
        ctidTraderAccountId: UNSAVED_ACCOUNT,
        accounts: [{ ctidTraderAccountId: UNSAVED_ACCOUNT, name: "Fixture intruder" }],
      },
    },
  ],

  withoutAccessToken: [
    {
      match: TOKEN_PATH,
      status: 200,
      ok: true,
      body: { errorCode: "synthetic_error_code", description: "synthetic refusal" },
    },
  ],

  httpFailure: [
    {
      match: TOKEN_PATH,
      status: 502,
      ok: false,
      body: { errorCode: "synthetic_unavailable" },
    },
  ],

  /* Nothing registered: the wall itself is under test. */
  none: [],
};

/* The four keys ctraderStore.normalizeAccount leaves on a saved account
   record, copied from the producer so a record built here cannot drift
   from a record the runtime would have written. */
function accountRecord(accountId, overrides = {}) {
  return {
    id: `fixture-${accountId}`,
    accountId,
    name: `Fixture ${accountId}`,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function savedState({
  activeAccountId = ACCOUNT_A,
  accounts = [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
  connected = true,
} = {}) {
  return {
    connected,
    accessToken: connected ? ACCESS_TOKEN : null,
    refreshToken: connected ? REFRESH_TOKEN : null,
    expiresIn: connected ? 3600 : null,
    accounts,
    activeAccountId,
  };
}

/* What the injected session reports about itself. The default is a
   session that is down, because that is the state a returning
   authorization is most likely to meet and the one a start would
   actually reach. */
function sessionFlags({
  running = false,
  connected = false,
  authenticated = false,
  ready = false,
  tradingAccountId = null,
} = {}) {
  return { running, connected, authenticated, ready, tradingAccountId };
}

const CALLBACK_ROUTE = { method: "get", route: "/callback" };

const SESSION_OPERATIONS = ["startCTraderService", "stopCTraderService"];

// ============================================================
// THE HARNESS
// ============================================================

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* Only the parameter NAMES of an outbound URL are kept. A value that
   is not retained cannot leak into an assertion message. */
function queryKeyNames(text) {
  const index = String(text).indexOf("?");

  if (index === -1) {
    return [];
  }

  return String(text)
    .slice(index + 1)
    .split("&")
    .filter(Boolean)
    .map((pair) => decodeURIComponent(pair.split("=")[0]))
    .sort();
}

function redirectParams(location) {
  const index = String(location).indexOf("?");

  return Object.fromEntries(
    new URLSearchParams(index === -1 ? "" : String(location).slice(index + 1)).entries()
  );
}

async function harness({
  query = { code: AUTHORIZATION_CODE },
  auth = {},
  session = {},
  token = "issued",
  persistence = "ok",
  start = "requested",
  source = ROUTE_SOURCE,
} = {}) {
  const state = savedState(auth);
  const pristine = clone(state);
  const status = sessionFlags(session);
  const registry = TOKEN_ANSWERS[token];

  const calls = [];
  const savedStates = [];
  const refusedWrites = [];
  const cleared = { count: 0 };
  const storeCreations = [];
  const broadcasts = [];
  const migrations = [];
  const violations = [];
  const logs = [];
  const redirects = [];
  const fetchLog = [];

  const record = (name, args) => {
    calls.push({ name, args: clone(args) });
  };

  const refuse = (name) => () => {
    violations.push(name);
    throw Object.assign(new Error(`Confined callback run reached ${name}`), {
      code: "HARNESS_FORBIDDEN_CALL",
    });
  };

  const fakeProcess = { env: { ...ENVIRONMENT }, pid: 4242 };

  /* Booleans only: a captured log line must be able to say whether it
     repeated a credential without this file ever holding the text that
     did. */
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

        logs.push({
          level,
          tokenPresent: text.includes(ACCESS_TOKEN) || text.includes(REFRESH_TOKEN),
          codePresent: text.includes(AUTHORIZATION_CODE),
          canaryPresent: text.includes(UNREAD_QUERY_VALUE),
        });
      },
    ])
  );

  /* The session is a state machine, not a recording: starting it adopts
     the account it was asked for, and stopping it tears the session
     down. So a route that starts one leaves a visible trace in
     sessionCalls even if the answer it returns looks unchanged. */
  const sessionExports = {
    startCTraderService: async (priceCallback, execCallback, token2, accountId) => {
      record("startCTraderService", [token2, accountId]);

      if (start === "fails") {
        throw new Error("synthetic cTrader session could not be authenticated");
      }

      status.running = true;
      status.connected = true;
      status.authenticated = true;
      status.ready = true;
      status.tradingAccountId = start === "another" ? ACCOUNT_B : String(accountId);

      return { ...status };
    },

    stopCTraderService: async () => {
      record("stopCTraderService", []);

      status.running = false;
      status.connected = false;
      status.authenticated = false;
      status.ready = false;
      status.tradingAccountId = null;

      return { stopped: true };
    },

    getCTraderServiceStatus: () => {
      record("getCTraderServiceStatus", []);
      return { ...status };
    },
  };

  for (const name of [
    "placeMarketOrder",
    "closePosition",
    "amendPositionSLTP",
    "getOpenPositions",
    "getAvailableSymbols",
    "resolvePositionSymbolId",
    "resolveOrderSymbolTarget",
    "buildExecutionBroadcastMessage",
  ]) {
    sessionExports[name] = refuse(`ctraderService.${name}`);
  }

  /* There is no real fetch in this context. A URL the test did not
     register has nowhere to go. */
  const offlineFetch = async (url, init) => {
    const text = String(url);
    const entry = registry.find((candidate) => text.includes(candidate.match));

    if (!entry) {
      fetchLog.push({ outcome: "refused", queryKeys: queryKeyNames(text) });
      throw Object.assign(
        new Error("Offline callback run asked for a URL the harness never registered"),
        { code: "HARNESS_UNREGISTERED_URL" }
      );
    }

    fetchLog.push({
      outcome: "answered",
      method: (init && init.method) || "GET",
      headerNames: Object.keys((init && init.headers) || {}).sort(),
      queryKeys: queryKeyNames(text),
    });

    return {
      ok: entry.ok,
      status: entry.status,
      json: async () => clone(entry.body),
      text: async () => JSON.stringify(clone(entry.body)),
    };
  };

  /* A vm context inherits no WHATWG globals, so the two the route
     actually builds are handed to it deliberately. Both are pure
     parsers; neither opens a socket. */
  const context = createContext(
    {
      process: fakeProcess,
      console: quietConsole,
      TextEncoder,
      URL,
      URLSearchParams,
      fetch: offlineFetch,
      WebSocket: refuse("WebSocket"),
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
    throw Object.assign(
      new Error(`Route run imported ${specifier}, outside the allowlist`),
      { code: "HARNESS_DEPENDENCY" }
    );
  }

  const filesystem = new Proxy(
    {},
    {
      get(_target, key) {
        violations.push(`node:fs.${String(key)}`);
        throw Object.assign(
          new Error("The confined callback run touched the filesystem"),
          { code: "HARNESS_FILESYSTEM" }
        );
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
        new SourceTextModule(text, {
          context,
          identifier,
          importModuleDynamically: rejectDependency,
        })
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
      return synthetic("stub:service", sessionExports);
    }

    if (stubName === "broadcast") {
      return synthetic("stub:broadcast", {
        broadcast: (message) => {
          broadcasts.push(message);
          return 0;
        },
      });
    }

    /* The store stub answers load() with exactly the state this test
       described - it runs no selection policy. That is how a dangling
       saved selection can be placed in front of the callback at all:
       the real loader would have dropped it at boot, and the callback
       only ever sees what the process is already holding. */
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
              if (persistence === "fails") {
                refusedWrites.push(clone(next));
                throw new Error("synthetic store write was refused");
              }

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

  /* The module's own state, read the way the rest of the process reads
     it. Values built inside the vm carry that realm's prototypes, which
     deepStrictEqual reads as a difference, so everything the route
     hands back is normalised through the host's JSON first. */
  const summary = () => clone(routeModule.namespace.getBrokerAuthSummary());

  const summaryBefore = summary();

  const response = { statusCode: null, body: null, sent: [] };
  const res = {
    status(code) {
      response.statusCode = code;
      return res;
    },
    json(payload) {
      if (response.statusCode === null) {
        response.statusCode = 200;
      }

      response.body = clone(payload);
      response.sent.push("json");
      return res;
    },
    send(payload) {
      response.body = clone(payload);
      response.sent.push("send");
      return res;
    },
    /* A callback answers with a redirect. That is its whole outward
       effect on the browser, so the location is captured for parsing
       rather than treated as a capability the route was not given. */
    redirect(location) {
      redirects.push(String(location));
      response.sent.push("redirect");
      return res;
    },
  };

  const handler = registrations.find(
    (entry) => entry.method === CALLBACK_ROUTE.method && entry.route === CALLBACK_ROUTE.route
  );

  assert.ok(handler, "GET /callback must be registered");

  let thrown = null;

  try {
    await handler.handler({ query: clone(query) }, res);
  } catch (error) {
    thrown = error;
  }

  const sessionCalls = calls.filter((entry) => SESSION_OPERATIONS.includes(entry.name));

  return {
    response,
    redirects,
    redirect: redirectParams(redirects[0] ?? ""),
    summary,
    summaryBefore,
    calls,
    sessionCalls,
    savedStates,
    refusedWrites,
    cleared,
    storeCreations,
    broadcasts,
    migrations,
    violations,
    logs,
    fetchLog,
    thrown,
    pristine,
    state,
    status,
    registrations,
  };
}

// ============================================================
// SHARED PROOFS
// ============================================================

/* Every run, accepted or refused, has to stay inside the capabilities
   the harness handed it. */
function assertConfined(run) {
  assert.deepEqual(
    run.violations,
    [],
    "the confined callback run reached a capability it was not given"
  );
  assert.equal(
    run.thrown,
    null,
    `the callback must answer, not throw: ${run.thrown && run.thrown.message}`
  );
  assert.equal(
    run.logs.every((entry) => entry.tokenPresent === false),
    true,
    "no captured log may carry a synthetic token"
  );
  assert.equal(
    run.migrations.length,
    1,
    "only the boot-time migration may have run"
  );
  assert.deepEqual(
    run.storeCreations.map((options) => options.filePath),
    [AUTH_FILE],
    "the route must build its store on the injected path"
  );
  assert.equal(
    run.cleared.count,
    0,
    "an authorization return never revokes the shared credential store"
  );
  assert.equal(
    run.redirects.length,
    1,
    `exactly one redirect, got ${JSON.stringify(run.redirects)}`
  );
}

/* The invariant, stated once so every test states the same thing. */
function assertNoSessionChange(run, label) {
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    [],
    `${label} must not start, stop or restart a trading session`
  );
}

function assertAuthorizationSucceeded(run) {
  assert.equal(
    run.redirect.ctrader,
    "connected",
    `the return must be reported as an authorization that came back: ${JSON.stringify(run.redirect)}`
  );
  assert.equal(run.summary().connected, true);
  assert.equal(run.summary().hasAccessToken, true);
}

function assertReturnedAnError(run) {
  assert.equal(
    run.redirect.ctrader,
    "error",
    `a failed authorization must not look like a connected one: ${JSON.stringify(run.redirect)}`
  );
}

/* The values a callback must never repeat: onward, into the store, or
   into a log line. */
function assertNothingCarries(run, values, label) {
  const corpus = [
    run.redirects.join(" "),
    JSON.stringify(run.response.body ?? null),
    JSON.stringify(run.savedStates),
    JSON.stringify(run.refusedWrites),
  ].join(" ");

  for (const value of values) {
    assert.equal(
      corpus.includes(value),
      false,
      `${label} carried ${JSON.stringify(value)} somewhere it does not belong`
    );
  }

  assert.equal(
    run.logs.every((entry) => entry.canaryPresent === false),
    true,
    `${label} logged a query value it was never given permission to read`
  );
}

function accountIds(accounts) {
  return accounts.map((account) => account.accountId);
}

// ============================================================
// 1. AN AUTHORIZATION RETURN STARTS NOTHING
// ============================================================

/* The case Task 8 exists for. A process that remembers an active
   account is asked only to prove a new token; the remembered account
   is not a request to trade with it now. */
test("an authorization return for a process that remembers an active account starts no session", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);
  assert.deepEqual(
    run.fetchLog.map((entry) => entry.outcome),
    ["answered"],
    "the exchange was asked for once"
  );
  assertAuthorizationSucceeded(run);
  assertNoSessionChange(run, "an authorization return beside a remembered selection");
  assert.equal(
    run.summary().activeAccountId,
    ACCOUNT_A,
    "answering without a session is not the same as forgetting the selection"
  );
});

/* The same invariant for a process that is holding a saved selection
   without holding credentials. The route's own connected guard cannot
   save it here, because the callback adopts connected:true one line
   before it asks. */
test("a first authorization for a process holding a saved selection starts no session", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: false,
    },
    token: "issued",
  });

  assertConfined(run);
  assertAuthorizationSucceeded(run);
  assertNoSessionChange(run, "a first authorization beside a saved selection");
});

/* An authorization return that reached the session would have had to
   write something about it to the store on the way. It does not, even
   on the way to starting one, so a single persisted state that differs
   from memory only in credentials is the other half of the proof. */
test("an authorization return persists credentials and carries the saved records over", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);

  assert.equal(run.savedStates.length, 1, "one write, and it is the session");
  assert.equal(run.savedStates[0].connected, true);
  assert.equal(run.savedStates[0].accessToken, ACCESS_TOKEN);
  assert.deepEqual(
    accountIds(run.savedStates[0].accounts),
    [ACCOUNT_A, ACCOUNT_B],
    "the account records are not the callback's to rebuild"
  );
});

// ============================================================
// 2. NO SELECTION IS STILL A SUCCESSFUL AUTHORIZATION
// ============================================================

test("an authorization return with no active account is still a successful authorization", async () => {
  const run = await harness({
    auth: { activeAccountId: null, accounts: [accountRecord(ACCOUNT_A)], connected: false },
    token: "issued",
  });

  assertConfined(run);
  assertAuthorizationSucceeded(run);
  assertNoSessionChange(run, "an authorization return with nothing selected");

  assert.equal(
    run.savedStates[0].activeAccountId,
    null,
    "the sole saved account is a record, not a selection waiting to be made"
  );
  assert.equal(
    run.summary().activeAccountId,
    null,
    "an authorization return that selected the only account it knew would be making a choice it was never asked to make"
  );
});

// ============================================================
// 3-4. THE SELECTION IS CARRIED, NEVER RECOMPUTED
// ============================================================

/* Two saved records, the active one listed second, and a token answer
   that also names an account. Every wrong way to choose is visible
   here: taking the first record, taking the only record, or taking the
   identity that just arrived in the response body. */
test("the callback carries the saved selection over instead of choosing one", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_B), accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "issuedWithAccountData",
  });

  assertConfined(run);
  assertAuthorizationSucceeded(run);

  assert.deepEqual(
    accountIds(run.savedStates[0].accounts),
    [ACCOUNT_B, ACCOUNT_A],
    "the order of the saved records is the order they were saved in"
  );
  assert.equal(
    run.savedStates[0].activeAccountId,
    ACCOUNT_A,
    "the selection written is the selection that was stored"
  );
  assert.equal(
    run.summary().activeAccountId,
    ACCOUNT_A,
    "and the selection adopted is the same one"
  );

  for (const state of [run.savedStates[0], run.summary()]) {
    assert.equal(
      JSON.stringify(state).includes(UNSAVED_ACCOUNT),
      false,
      "an account id that arrived in the token answer belongs to no decision here"
    );
  }
});

test("the selection the process held before the callback is the selection it holds after", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);

  assert.equal(
    JSON.stringify(run.summary().activeAccountId),
    JSON.stringify(run.summaryBefore.activeAccountId),
    "the callback moved the selection the process was already holding"
  );
  assert.deepEqual(
    accountIds(run.summary().accounts),
    accountIds(run.summaryBefore.accounts),
    "the callback changed the account records it was handed"
  );
  assert.equal(
    run.savedStates.length,
    1,
    "one persisted state, and it is the one the route answered with"
  );
  assert.equal(
    run.savedStates.every((entry) => entry.activeAccountId === ACCOUNT_A),
    true,
    "no write made by the callback may name any other selection"
  );
});

// ============================================================
// 5. A TOKEN EXCHANGE THAT FAILED SELECTS AND STARTS NOTHING
// ============================================================

test("an unsuccessful token response is an error return with nothing written", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "httpFailure",
  });

  assertConfined(run);
  assertReturnedAnError(run);
  assert.deepEqual(
    run.fetchLog.map((entry) => entry.outcome),
    ["answered"],
    "the exchange was attempted once"
  );
  assert.deepEqual(run.savedStates, [], "a failed exchange writes no session");
  assert.equal(run.summary().connected, run.pristine.connected);
  assert.equal(
    run.summary().hasAccessToken,
    run.pristine.accessToken !== null,
    "a failed exchange leaves the credentials the process already had"
  );
  assertNoSessionChange(run, "a failed token exchange");
});

test("a token response without an access token is an error return with nothing written", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "withoutAccessToken",
  });

  assertConfined(run);
  assertReturnedAnError(run);
  assert.deepEqual(run.savedStates, [], "a body with no access token is not a session");
  assert.equal(run.summary().hasAccessToken, true, "the old credential is still what it was");
  assert.equal(run.summary().activeAccountId, ACCOUNT_A);
  assertNoSessionChange(run, "a token answer with no access token");
});

test("a return with no authorization code never asks the token endpoint", async () => {
  const run = await harness({
    query: { state: UNREAD_QUERY_VALUE },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);
  assertReturnedAnError(run);
  assert.equal(run.redirect.message, "no_code");
  assert.deepEqual(run.fetchLog, [], "no code, so no exchange to attempt");
  assert.deepEqual(run.savedStates, []);
  assertNoSessionChange(run, "a return that carried no code");
  assertNothingCarries(run, [UNREAD_QUERY_VALUE], "a no-code return");
});

test("an authorization the user refused is returned without touching credentials", async () => {
  const run = await harness({
    query: { error: "access_denied", description: "synthetic refusal" },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);
  assertReturnedAnError(run);
  assert.deepEqual(run.fetchLog, [], "a refusal is not an exchange");
  assert.deepEqual(run.savedStates, [], "a refusal writes nothing");
  assert.equal(run.summary().connected, true, "the session the process already had survives");
  assert.equal(run.summary().activeAccountId, ACCOUNT_A);
  assertNoSessionChange(run, "an authorization the user refused");
});

// ============================================================
// 6 + 9. WRITE FIRST, ADOPT ONLY WHAT WAS WRITTEN
// ============================================================

test("a store that refuses the callback's write leaves the process holding what it held", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: false,
    },
    token: "issued",
    persistence: "fails",
  });

  assertConfined(run);
  assertReturnedAnError(run);

  assert.equal(run.refusedWrites.length, 1, "the write was asked for");
  assert.deepEqual(run.savedStates, [], "and nothing was persisted");
  assert.deepEqual(
    run.summary(),
    run.summaryBefore,
    "a session nobody persisted must not become the process's session"
  );
  assertNoSessionChange(run, "a callback whose write was refused");
});

test("a callback that persists adopts exactly what it persisted", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);

  const persisted = run.savedStates[0];

  assert.equal(run.summary().connected, persisted.connected);
  assert.equal(run.summary().hasAccessToken, persisted.accessToken !== null);
  assert.equal(
    run.summary().hasRefreshToken,
    persisted.refreshToken !== null,
    "the adopted memory reports the same credentials the store was handed"
  );
  assert.equal(run.summary().activeAccountId, persisted.activeAccountId);
  assert.deepEqual(accountIds(run.summary().accounts), accountIds(persisted.accounts));
});

// ============================================================
// 7. A DANGLING SELECTION REACHES NO SESSION
// ============================================================

/* Characterization, not endorsement. A selection that names no saved
   record is placed in front of the callback by the store stub, because
   the real loader would have dropped it at boot. What is normative
   here is that no session is reached; the redirect this returns today
   is what the current code actually answers, and Step 2 of Task 8
   changes neither half of it. */
test("a dangling saved selection reaches no session", async () => {
  const run = await harness({
    auth: {
      activeAccountId: UNSAVED_ACCOUNT,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);
  assertNoSessionChange(run, "a callback holding a selection that names no record");

  /* What the current code actually answers: the authorization half of
     the return succeeded, so the redirect says connected, while the
     session it quietly tried to start threw and was swallowed one line
     above. Pinned so Step 2 is judged on whether it changes this
     answer - not allowed to change it by accident. */
  assert.equal(
    run.redirect.ctrader,
    "connected",
    `characterization of the swallowed start failure: ${JSON.stringify(run.redirect)}`
  );

  assert.equal(
    run.summary().activeAccountId,
    UNSAVED_ACCOUNT,
    "the callback is not the route that decides what to do with a dangling selection"
  );
  assert.equal(
    run.savedStates[0].activeAccountId,
    UNSAVED_ACCOUNT,
    "and it does not rewrite it either"
  );
});

// ============================================================
// 8. THE QUERY CONTRACT
// ============================================================

/* The callback reads code, error and description. Everything else in
   the query must stay unread, which is observable because the token
   request it builds is the one place a read value has to go. */
test("only the authorization code leaves the callback, and only toward the token endpoint", async () => {
  const run = await harness({
    query: {
      code: AUTHORIZATION_CODE,
      state: UNREAD_QUERY_VALUE,
      session_id: UNREAD_QUERY_VALUE,
      description: "synthetic description",
    },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "issued",
  });

  assertConfined(run);
  assertAuthorizationSucceeded(run);

  assert.deepEqual(
    run.fetchLog.map((entry) => entry.queryKeys),
    [["client_id", "client_secret", "code", "grant_type", "redirect_uri"]],
    "the token request carries the five fields the exchange needs and no query value of its own"
  );
  assert.equal(run.fetchLog[0].method, "GET");

  assertNothingCarries(
    run,
    [UNREAD_QUERY_VALUE, AUTHORIZATION_CODE],
    "a successful callback return"
  );
  assert.equal(
    run.logs.every((entry) => entry.codePresent === false),
    true,
    "an authorization code is single-use and must not be printed"
  );
});

test("a token endpoint the harness never registered is refused rather than reached", async () => {
  const run = await harness({
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
      connected: true,
    },
    token: "none",
  });

  assertConfined(run);
  assertReturnedAnError(run);

  assert.equal(run.fetchLog.length, 1, "one attempt, refused, never retried elsewhere");
  assert.equal(run.fetchLog[0].outcome, "refused");
  assert.deepEqual(run.savedStates, [], "a refusal must not have become a session");
  assertNoSessionChange(run, "a token request that was never answered");
  assertNothingCarries(run, [AUTHORIZATION_CODE], "a refused callback");
});
