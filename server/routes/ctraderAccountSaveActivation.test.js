/* ============================================================
   SAVE IS NOT ACTIVATION

   Three routes change what this process knows about cTrader
   accounts: POST /account saves or renames a record,
   POST /accounts/select activates one, and
   DELETE /accounts/:accountId removes one. Phase 2.1-e Task 5
   separates the first two: saving a record is a bookkeeping
   operation that must leave the selection and the running session
   exactly as they were, and only an explicit selection may move the
   account this process trades with.

   Each of these runs is a real execution of the route module inside
   a confined vm. The storage seam, the service and the migration are
   injected fakes; the shared selection rule is loaded for real,
   because the routes are required to use it rather than reinvent it;
   no filesystem, socket or timer is reachable. So the evidence is
   what the service was asked to do, what the store was handed, and
   what the module's own state says afterwards — not a pattern
   matched in the source.

   Every fixture account id, name and token is synthetic. Nothing here
   reads a real credential file.
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
const ACCOUNT_C = "66009900";
const UNSAVED_ACCOUNT = "99003344";

const ACCESS_TOKEN = "synthetic-save-access-not-a-credential";
const REFRESH_TOKEN = "synthetic-save-refresh-not-a-credential";

const AUTH_FILE = path.resolve(
  SERVER_DIRECTORY,
  "synthetic-save-auth.fixture.json"
);
const ACCOUNTS_FILE = path.resolve(
  SERVER_DIRECTORY,
  "synthetic-save-accounts.fixture.json"
);

/* The four keys ctraderStore.normalizeAccount leaves on a saved
   account record, copied from the producer so a record built here
   cannot drift from a record the runtime would have written. */
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
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: 3600,
    accounts,
    activeAccountId,
  };
}

/* What the injected session reports about itself. The default is a
   session that is up and serving ACCOUNT_A, because that is the state
   a saved selection is most likely to meet. */
function sessionFlags({
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

const SAVE_ROUTE = {
  label: "POST /account",
  method: "post",
  route: "/account",
  body: { accountId: ACCOUNT_C, accountName: "Fixture third" },
};

const SELECT_ROUTE = {
  label: "POST /accounts/select",
  method: "post",
  route: "/accounts/select",
  body: { accountId: ACCOUNT_B },
};

const REMOVAL_ROUTE = {
  label: "DELETE /accounts/:accountId",
  method: "delete",
  route: "/accounts/:accountId",
};

const SESSION_OPERATIONS = ["startCTraderService", "stopCTraderService"];

// ============================================================
// THE HARNESS
// ============================================================

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function harness({
  route = SAVE_ROUTE,
  body,
  params,
  auth = {},
  session = {},
  start = "requested",
  persistence = "ok",
  source = ROUTE_SOURCE,
} = {}) {
  const state = savedState(auth);
  const pristine = clone(state);
  const status = sessionFlags(session);

  const calls = [];
  const savedStates = [];
  const refusedWrites = [];
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
              return typeof value === "string"
                ? value
                : JSON.stringify(value);
            } catch {
              return "";
            }
          })
          .join(" ");

        logs.push({
          level,
          tokenPresent:
            text.includes(ACCESS_TOKEN) || text.includes(REFRESH_TOKEN),
        });
      },
    ])
  );

  /* The session is a state machine, not a recording. Starting it
     adopts the account it was asked for (that is what Task 2 made
     the real service guarantee), and stopping it tears the session
     down — so a route that stops a session has to start one again
     before it can claim anything is ready. */
  const sessionExports = {
    startCTraderService: async (priceCallback, execCallback, token, accountId) => {
      record("startCTraderService", [priceCallback, execCallback, token, accountId]);

      if (start === "fails") {
        throw new Error("synthetic cTrader session could not be authenticated");
      }

      status.running = true;
      status.connected = true;
      status.authenticated = true;
      status.ready = true;
      status.tradingAccountId =
        start === "another" ? ACCOUNT_A : String(accountId);

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
          new Error("The confined route run touched the filesystem"),
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

    const resolved = fileURLToPath(
      new URL(specifier, referencingModule.identifier)
    );
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

    if (stubName === "store") {
      return synthetic("stub:store", {
        createCtraderStore: (options) => {
          storeCreations.push(options);

          return {
            filePath: options?.filePath ?? AUTH_FILE,

            load: () => {
              const loaded = clone(state);
              calls.push({
                name: "store.load",
                args: [loaded.activeAccountId],
              });
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

  /* The module's own state, read the way the rest of the process
     reads it. A route that adopted a state the store refused would
     show up here rather than on disk.

     Values built inside the vm carry that realm's prototypes, which
     deepStrictEqual reads as a difference, so everything the route
     hands back is normalised through the host's JSON first. */
  const summary = () => clone(routeModule.namespace.getBrokerAuthSummary());

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
    redirect(location) {
      violations.push("redirect");
      response.sent.push("redirect");
      response.body = { redirect: location };
      return res;
    },
  };

  const handler = registrations.find(
    (entry) =>
      entry.method === route.method && entry.route === route.route
  );

  assert.ok(
    handler,
    `${route.method.toUpperCase()} ${route.route} must be registered`
  );

  let thrown = null;

  try {
    await handler.handler(
      {
        body: body === undefined ? clone(route.body ?? {}) : clone(body),
        params: clone(params ?? {}),
      },
      res
    );
  } catch (error) {
    thrown = error;
  }

  const sessionCalls = calls.filter((entry) =>
    SESSION_OPERATIONS.includes(entry.name)
  );

  return {
    route,
    response,
    summary,
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

/* Every run in this file, accepted or refused, has to stay inside the
   capabilities the harness handed it. */
function assertConfined(run) {
  assert.deepEqual(
    run.violations,
    [],
    "the confined route run reached a capability it was not given"
  );
  assert.equal(
    run.thrown,
    null,
    `the handler must answer, not throw: ${run.thrown && run.thrown.message}`
  );
  assert.equal(
    run.logs.some((entry) => entry.tokenPresent),
    false,
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
    "a save, a selection and a removal of a saved account all keep the shared authorization"
  );
}

function assertNoTokenInResponse(run) {
  const text = JSON.stringify(run.response.body ?? null);

  assert.equal(
    text.includes(ACCESS_TOKEN) || text.includes(REFRESH_TOKEN),
    false,
    `the response body carries credential material: ${text.slice(0, 160)}`
  );
}

function assertNoSessionChange(run, label) {
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    [],
    `${label} must leave the running session alone`
  );
}

/* The three ways a route can move the selection: the state it adopted
   in memory, the state it handed the store, and the state the store
   would have had if nothing was written. All three have to agree. */
function assertSelectionUnmoved(run, expected, label) {
  const persisted = run.savedStates.at(-1);

  assert.ok(
    persisted,
    `${label} must still persist the account records it changed`
  );
  assert.deepEqual(
    persisted.activeAccountId,
    expected,
    `${label} wrote a different selection to the store than ${JSON.stringify(expected)}`
  );
  assert.deepEqual(
    run.summary().activeAccountId,
    expected,
    `${label} adopted a different selection in memory than the one it persisted`
  );
  assert.equal(
    JSON.stringify(run.summary().activeAccountId),
    JSON.stringify(run.pristine.activeAccountId),
    `${label} moved the selection the process was already holding`
  );
}

function accountIds(accounts) {
  return accounts.map((account) => account.accountId);
}

function findRecord(accounts, accountId) {
  return accounts.find((account) => account.accountId === accountId);
}

// ============================================================
// SAVING AN ACCOUNT ACTIVATES NOTHING
// ============================================================

test("saving a new account leaves the account that was active still active", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: { activeAccountId: ACCOUNT_A, accounts: [accountRecord(ACCOUNT_A)] },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.equal(run.response.body.success, true);
  assert.ok(
    accountIds(run.summary().accounts).includes(ACCOUNT_B),
    "the saved record has to be there, or the save did not happen"
  );
  assertSelectionUnmoved(
    run,
    ACCOUNT_A,
    "saving a second account beside an active first one"
  );
  assertNoSessionChange(run, "saving an account");
  assertNoTokenInResponse(run);
});

test("saving the first account of an unselected process leaves it unselected", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: { activeAccountId: null, accounts: [] },
    body: { accountId: ACCOUNT_A, accountName: "Fixture only" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.equal(run.response.body.success, true);
  assert.deepEqual(
    run.savedStates.at(-1).activeAccountId,
    null,
    "the sole saved account is a record, not a selection"
  );
  assert.deepEqual(
    run.summary().activeAccountId,
    null,
    "a save that selected the only account it knew would activate without being asked"
  );
  assertNoSessionChange(run, "saving the only saved account");
});

test("saving a new account preserves the selection that was already active", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    body: { accountId: ACCOUNT_C, accountName: "Fixture third" },
  });

  assertConfined(run);

  assertSelectionUnmoved(run, ACCOUNT_A, "saving a third account");
  assertNoSessionChange(run, "saving a third account");

  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A, ACCOUNT_B, ACCOUNT_C],
    "the records that were saved before have to stay saved, in order"
  );
});

test("saving an account leaves a stored selection naming nothing untouched", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: UNSAVED_ACCOUNT,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  /* The route is not the place that decides what a stored id means, and
     it has no business repairing one it was not asked about. */
  assertSelectionUnmoved(
    run,
    UNSAVED_ACCOUNT,
    "saving a record beside a stored id that names no account"
  );
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A, ACCOUNT_B],
    "and both records have to be saved"
  );
});

test("saving an account leaves a numeric stored selection exactly as stored", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: { activeAccountId: 77001122, accounts: [accountRecord(ACCOUNT_A)] },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(
    run.savedStates.at(-1).activeAccountId,
    77001122,
    "preserving a selection is preserving the value, not a string that looks like it"
  );
  assertNoSessionChange(run, "saving a record beside a numeric selection");
});

test("renaming a saved account that is not active keeps the active account active", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [
        accountRecord(ACCOUNT_A),
        accountRecord(ACCOUNT_B, { name: "Fixture name before" }),
      ],
    },
    body: { accountId: ACCOUNT_B, accountName: "Fixture name after" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assertSelectionUnmoved(
    run,
    ACCOUNT_A,
    "renaming the inactive of two saved accounts"
  );
  assertNoSessionChange(run, "renaming the inactive of two saved accounts");

  assert.deepEqual(
    findRecord(run.summary().accounts, ACCOUNT_B).name,
    "Fixture name after",
    "and the rename itself has to land"
  );
});

test("renaming the active account keeps it active and keeps its metadata", async () => {
  const existing = accountRecord(ACCOUNT_A, {
    name: "Fixture name before",
    createdAt: "2024-03-04T05:06:07.008Z",
  });

  const run = await harness({
    route: SAVE_ROUTE,
    auth: { activeAccountId: ACCOUNT_A, accounts: [existing] },
    body: { accountId: ACCOUNT_A, accountName: "Fixture name after" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assertSelectionUnmoved(run, ACCOUNT_A, "renaming the active account");
  assertNoSessionChange(run, "renaming the active account");

  const renamed = findRecord(run.savedStates.at(-1).accounts, ACCOUNT_A);

  assert.deepEqual(
    renamed,
    {
      ...existing,
      name: "Fixture name after",
    },
    "a rename changes the name and nothing else about the record"
  );
});

test("saving an account without a name leaves an existing record as it is", async () => {
  const existing = accountRecord(ACCOUNT_B, { name: "Fixture name before" });

  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), existing],
    },
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.deepEqual(
    findRecord(run.savedStates.at(-1).accounts, ACCOUNT_B),
    existing,
    "a save with no name asked for nothing but the record being present"
  );
  assertSelectionUnmoved(run, ACCOUNT_A, "saving a record with no name");
  assertNoSessionChange(run, "saving a record with no name");
});

// ============================================================
// SAVING AN ACCOUNT DOES NOT TOUCH THE SESSION
// ============================================================

test("saving an account does not ask the service for a session", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: null,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.equal(
    run.calls.some((entry) => entry.name === "startCTraderService"),
    false,
    "a saved record is not a reason to bring a session up for it"
  );
  assertNoSessionChange(run, "saving an account while no session is up");
});

test("saving an account does not stop the session another account is using", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assertNoSessionChange(
    run,
    "saving a second account beside a session serving the first"
  );
  assert.deepEqual(
    run.status,
    sessionFlags({ tradingAccountId: ACCOUNT_A }),
    "the session that was serving an account has to still be serving it"
  );
  assertSelectionUnmoved(
    run,
    ACCOUNT_A,
    "saving a second account beside a session serving the first"
  );
});

test("saving an account reports the save and no service decision", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: { activeAccountId: ACCOUNT_A, accounts: [accountRecord(ACCOUNT_A)] },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.equal(run.response.body.success, true);
  assert.equal(
    run.response.body.activated,
    false,
    "the response has to say plainly that nothing was activated"
  );
  assert.equal(
    run.response.body.service,
    undefined,
    "a save that changed no session must not report one"
  );
  assert.match(
    String(run.response.body.message),
    /saved/i,
    `the message has to describe the save: ${run.response.body.message}`
  );
  assert.doesNotMatch(
    String(run.response.body.message),
    /switch|activated|now trading|current account/i,
    `and it must not claim activation: ${run.response.body.message}`
  );
});

// ============================================================
// SAVING AN ACCOUNT REFUSES WHAT CANNOT BE A RECORD
// ============================================================

test("saving an account with no usable account id changes nothing", async () => {
  for (const unusable of [undefined, null, "", "   ", {}, []]) {
    const run = await harness({
      route: SAVE_ROUTE,
      auth: {
        activeAccountId: ACCOUNT_A,
        accounts: [accountRecord(ACCOUNT_A)],
      },
      body: { accountId: unusable, accountName: "Fixture refused" },
    });

    assertConfined(run);

    assert.equal(
      run.response.statusCode,
      400,
      `a save of account id ${JSON.stringify(unusable)} must be refused`
    );
    assert.equal(run.response.body.success, false);
    assert.deepEqual(
      run.savedStates,
      [],
      `a refused save of ${JSON.stringify(unusable)} persisted something`
    );
    assert.deepEqual(
      accountIds(run.summary().accounts),
      [ACCOUNT_A],
      `a refused save of ${JSON.stringify(unusable)} changed the records`
    );
    assertSelectionUnmovedShape(run, ACCOUNT_A);
    assertNoSessionChange(run, `a save of ${JSON.stringify(unusable)}`);
  }
});

/* The refused runs never wrote a state at all, so the only evidence is
   the process state beside the fixture it started from. */
function assertSelectionUnmovedShape(run, expected) {
  assert.deepEqual(
    run.summary().activeAccountId,
    expected,
    "a refused save moved the selection the process was holding"
  );
}

test("saving an account without a connected OAuth reports the connection refused", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      connected: false,
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 401);
  assert.equal(run.response.body.success, false);
  assert.match(String(run.response.body.message), /OAuth/i);
  assert.deepEqual(run.savedStates, [], "and nothing was persisted");
  assertNoSessionChange(run, "a save refused for no OAuth connection");
});

// ============================================================
// EXPLICIT SELECTION ACTIVATES THE ACCOUNT IT NAMED
// ============================================================

test("selecting a saved account activates exactly that account", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.equal(run.response.body.success, true);
  assert.deepEqual(
    run.savedStates.at(-1).activeAccountId,
    ACCOUNT_B,
    "the explicit selection has to be what reached the store"
  );
  assert.deepEqual(
    run.summary().activeAccountId,
    ACCOUNT_B,
    "and the process has to trade with it"
  );
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A, ACCOUNT_B],
    "a selection is not a record edit"
  );

  const started = run.calls.filter(
    (entry) => entry.name === "startCTraderService"
  );

  assert.deepEqual(
    started.map((entry) => entry.args[3]),
    [ACCOUNT_B],
    "the session must be asked for exactly the account that was selected"
  );
  assert.equal(started.length, 1, "and one session is one session");
});

test("selecting a saved account stops the session of the account it replaces", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    ["stopCTraderService", "startCTraderService"],
    "the session serving the account being replaced is stopped, then the selected one starts"
  );
  assert.equal(
    run.calls.find((entry) => entry.name === "startCTraderService").args[3],
    ACCOUNT_B,
    "for the account that was selected"
  );
});

test("selecting the account already active does not tear down its own session", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    body: { accountId: ACCOUNT_A },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    [],
    "selecting the account a ready session already serves needs no teardown"
  );
  assert.deepEqual(run.summary().activeAccountId, ACCOUNT_A);
});

test("selecting an account with no usable id selects nothing", async () => {
  for (const [unusable, status] of [
    [undefined, 400],
    [null, 400],
    ["", 400],
    ["   ", 400],
    [{ label: "not an id" }, 400],
  ]) {
    const run = await harness({
      route: SELECT_ROUTE,
      auth: {
        activeAccountId: ACCOUNT_A,
        accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
      },
      session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
      body: { accountId: unusable },
    });

    assertConfined(run);

    assert.equal(
      run.response.statusCode,
      status,
      `a selection of ${JSON.stringify(unusable)} must be refused with ${status}`
    );
    assert.equal(run.response.body.success, false);
    assert.equal(
      typeof run.response.body.message,
      "string",
      "and it has to explain itself"
    );
    assert.ok(
      run.response.body.message.length > 20,
      `a refusal message has to be usable: ${run.response.body.message}`
    );
    assert.deepEqual(
      run.savedStates,
      [],
      `a refused selection of ${JSON.stringify(unusable)} persisted a selection`
    );
    assert.deepEqual(
      run.summary().activeAccountId,
      ACCOUNT_A,
      `a refused selection of ${JSON.stringify(unusable)} moved the in-memory selection`
    );
    assertNoSessionChange(run, `a selection of ${JSON.stringify(unusable)}`);
  }
});

test("selecting an account that is not saved selects nothing and substitutes none", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    body: { accountId: UNSAVED_ACCOUNT },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 404);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(run.savedStates, [], "nothing was persisted");
  assert.deepEqual(
    run.summary().activeAccountId,
    ACCOUNT_A,
    "the account that was active stays active"
  );
  assertNoSessionChange(run, "a selection of an unsaved account");
});

test("selecting from a process that has saved no accounts selects nothing", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: { activeAccountId: null, accounts: [] },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    body: { accountId: ACCOUNT_A },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 404);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(run.savedStates, []);
  assert.deepEqual(run.summary().activeAccountId, null);
  assertNoSessionChange(run, "a selection with no saved accounts");
});

test("selecting the only saved account activates it because it was asked for", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: { activeAccountId: null, accounts: [accountRecord(ACCOUNT_A)] },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    body: { accountId: ACCOUNT_A },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.deepEqual(run.summary().activeAccountId, ACCOUNT_A);
  assert.deepEqual(run.savedStates.at(-1).activeAccountId, ACCOUNT_A);
});

// ============================================================
// ACTIVATION IS PROVEN, NOT PERSISTED
// ============================================================

test("a selection whose session could not start does not report an activated account", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    start: "fails",
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(
    run.response.body.success,
    false,
    `a selection with no session cannot be a success: ${JSON.stringify(run.response.body)}`
  );
  assert.ok(
    run.response.statusCode >= 500,
    "an activation that could not be completed is not an accepted request"
  );
  assert.doesNotMatch(
    String(run.response.body.message),
    /switched successfully|activated successfully/i,
    `the message must not claim activation: ${run.response.body.message}`
  );
  assert.match(
    String(run.response.body.message),
    /saved/i,
    `and it has to say what did happen: ${run.response.body.message}`
  );
  assert.equal(
    run.status.ready,
    false,
    "the harness session really did not come up"
  );
});

test("a session that names another account does not report an activated account", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    /* The service comes up, reports itself ready, and is serving the
       account that was replaced. Persistence succeeded, so a route
       that trusts persistence would call this a switch. */
    start: "another",
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.status.tradingAccountId, ACCOUNT_A);
  assert.equal(
    run.response.body.success,
    false,
    `activation cannot be claimed for a session serving ${ACCOUNT_A}: ${JSON.stringify(run.response.body)}`
  );
  assert.equal(run.response.statusCode, 409);
  assert.equal(
    run.response.body.code,
    "session_identity_mismatch",
    "the refusal has to name the identity rule that refused it"
  );
  assert.equal(
    typeof run.response.body.message,
    "string",
    "and explain itself"
  );
  assert.doesNotMatch(
    String(run.response.body.message),
    /switched successfully/i
  );
});

// ============================================================
// NOTHING ADOPTED BEFORE IT PERSISTED
// ============================================================

test("a save the store refused leaves the in-memory state as it was", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    persistence: "fails",
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 500);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(
    run.refusedWrites.length,
    1,
    "the candidate state has to be built in full and handed to the store"
  );
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A],
    "the record the disk refused must not be in memory either"
  );
  assert.deepEqual(
    run.summary().activeAccountId,
    ACCOUNT_A,
    "and the selection has to be exactly where it was"
  );
  assertNoSessionChange(run, "a save the store refused");
});

test("a selection the store refused is not adopted and starts no session", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    persistence: "fails",
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 500);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(
    run.refusedWrites.at(-1).activeAccountId,
    ACCOUNT_B,
    "the refused write still has to be the selection that was asked for"
  );
  assert.deepEqual(
    run.summary().activeAccountId,
    ACCOUNT_A,
    "a selection nobody persisted cannot become the account this process trades with"
  );
  assertNoSessionChange(
    run,
    "a selection the store refused — no session may be torn down for it"
  );
});

// ============================================================
// REMOVAL INVARIANTS
// ============================================================

test("removing a non-active account leaves the active account active", async () => {
  const run = await harness({
    route: REMOVAL_ROUTE,
    params: { accountId: ACCOUNT_B },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  assert.equal(
    run.response.statusCode,
    200,
    JSON.stringify(run.response.body)
  );
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A],
    "only the named record goes"
  );
  assert.deepEqual(
    run.savedStates.at(-1).activeAccountId,
    ACCOUNT_A,
    "the selection has to be persisted unchanged"
  );
  assert.deepEqual(run.summary().activeAccountId, ACCOUNT_A);
  assertNoSessionChange(run, "removing an account that was not active");
});

test("removing the active account leaves no account active", async () => {
  const run = await harness({
    route: REMOVAL_ROUTE,
    params: { accountId: ACCOUNT_A },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [
        accountRecord(ACCOUNT_A),
        accountRecord(ACCOUNT_B),
        accountRecord(ACCOUNT_C),
      ],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  assert.equal(
    run.response.statusCode,
    200,
    JSON.stringify(run.response.body)
  );
  assert.deepEqual(run.savedStates.at(-1).activeAccountId, null);
  assert.deepEqual(run.summary().activeAccountId, null);
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_B, ACCOUNT_C],
    "the records that were not removed stay, in order"
  );
  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    ["stopCTraderService"],
    "the session of a removed account is stopped, and nothing is started in its place"
  );
});

test("removing an account never activates the account that remains", async () => {
  const run = await harness({
    route: REMOVAL_ROUTE,
    params: { accountId: ACCOUNT_A },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 200, JSON.stringify(run.response.body));
  assert.deepEqual(
    run.summary().activeAccountId,
    null,
    "one saved account left behind is not a reason to select it"
  );
  assert.deepEqual(
    run.savedStates.at(-1).activeAccountId,
    null,
    "and the store must not be handed a successor either"
  );
  assert.equal(
    run.calls.some((entry) => entry.name === "startCTraderService"),
    false,
    "a removal starts no session for the account that remains"
  );
});

test("removing an account that is not saved changes nothing", async () => {
  const run = await harness({
    route: REMOVAL_ROUTE,
    params: { accountId: UNSAVED_ACCOUNT },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 404);
  assert.equal(run.response.body.success, false);
  assert.deepEqual(run.savedStates, [], "nothing was persisted");
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A, ACCOUNT_B],
    "every record stayed"
  );
  assert.deepEqual(run.summary().activeAccountId, ACCOUNT_A);
  assertNoSessionChange(run, "a removal of an unsaved account");
});

test("a removal the store refused leaves the records and selection as they were", async () => {
  const run = await harness({
    route: REMOVAL_ROUTE,
    params: { accountId: ACCOUNT_B },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    persistence: "fails",
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  assert.equal(run.response.statusCode, 500);
  assert.deepEqual(
    accountIds(run.summary().accounts),
    [ACCOUNT_A, ACCOUNT_B],
    "the record the disk refused has to still be there"
  );
  assert.deepEqual(run.summary().activeAccountId, ACCOUNT_A);
});

// ============================================================
// RESPONSE CONTRACTS A CLIENT ALREADY READS
// ============================================================

test("the save response keeps the keys a compatible client reads", async () => {
  const run = await harness({
    route: SAVE_ROUTE,
    auth: { activeAccountId: ACCOUNT_A, accounts: [accountRecord(ACCOUNT_A)] },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  const body = run.response.body;

  for (const key of [
    "success",
    "message",
    "account",
    "accounts",
    "activeAccountId",
  ]) {
    assert.ok(
      key in body,
      `POST /account no longer answers with ${key}: ${JSON.stringify(body)}`
    );
  }

  assert.deepEqual(body.account, {
    ...findRecord(run.savedStates.at(-1).accounts, ACCOUNT_B),
  });
  assert.deepEqual(
    accountIds(body.accounts),
    accountIds(run.savedStates.at(-1).accounts),
    "the list the caller is shown is the list that was persisted"
  );
  assert.deepEqual(
    body.activeAccountId,
    ACCOUNT_A,
    "and it reports the account that is actually active"
  );
});

test("the selection response keeps the keys a compatible client reads", async () => {
  const run = await harness({
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  const body = run.response.body;

  for (const key of [
    "success",
    "message",
    "activeAccount",
    "activeAccountId",
    "service",
  ]) {
    assert.ok(
      key in body,
      `POST /accounts/select no longer answers with ${key}: ${JSON.stringify(body)}`
    );
  }

  assert.deepEqual(body.activeAccount, accountRecord(ACCOUNT_B));
  assert.deepEqual(body.activeAccountId, ACCOUNT_B);
  assert.equal(body.service.ready, true);
});

test("the removal response keeps the keys a compatible client reads", async () => {
  const run = await harness({
    route: REMOVAL_ROUTE,
    params: { accountId: ACCOUNT_B },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  const body = run.response.body;

  for (const key of ["success", "message", "accounts", "activeAccountId"]) {
    assert.ok(
      key in body,
      `DELETE /accounts/:accountId no longer answers with ${key}: ${JSON.stringify(body)}`
    );
  }

  assert.deepEqual(accountIds(body.accounts), [ACCOUNT_A]);
  assert.deepEqual(body.activeAccountId, ACCOUNT_A);
});

test("no account route answers with credential material", async () => {
  const runs = await Promise.all([
    harness({ route: SAVE_ROUTE }),
    harness({
      route: SELECT_ROUTE,
      session: sessionFlags({
        running: false,
        connected: false,
        authenticated: false,
        ready: false,
        tradingAccountId: null,
      }),
    }),
    harness({ route: REMOVAL_ROUTE, params: { accountId: ACCOUNT_B } }),
  ]);

  for (const run of runs) {
    assertConfined(run);
    assertNoTokenInResponse(run);
    assertNoTokenInResponse({ response: { body: run.summary() } });
  }
});

/* ============================================================
   MUTANTS — each proof has to be the thing that refuses

   A behaviour the suite never tested would also never regress, and
   several of the save-side proofs pass today only because the route
   no longer does the thing they forbid. Each mutant below puts the
   forbidden behaviour back into the source this file runs and checks
   that the named scenario really does come out wrong. That is also
   the pre-Task-5 behaviour, restored in memory: nothing on disk is
   touched, and no Git state is disturbed.
   ============================================================ */

function mutate(source, from, to) {
  const hits = source.split(from).length - 1;

  assert.equal(
    hits,
    1,
    `the mutation anchor must appear exactly once, found ${hits}: ${from.slice(0, 60)}`
  );

  return source.split(from).join(to);
}

test("mutant M1 a save that writes its own account id activates without being asked", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `      activeAccountId:
        ctraderAuth.activeAccountId,
    };

    saveAuth(next);`,
    `      activeAccountId:
        newAccountId,
    };

    saveAuth(next);`
  );

  const run = await harness({
    source,
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.equal(
    run.savedStates.at(-1).activeAccountId,
    ACCOUNT_B,
    "the anchor has to restore the implicit activation this suite refuses"
  );
  assert.equal(
    run.summary().activeAccountId,
    ACCOUNT_B,
    "and a route that does it must be caught moving the selection"
  );
});

test("mutant M2 a save that restarts the service runs a session for a record that was only written down", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `    ctraderAuth = next;

    console.log(
      "✅ Saved cTrader account:",`,
    `    ctraderAuth = next;

    await stopCTraderService();
    await startService();

    console.log(
      "✅ Saved cTrader account:",`
  );

  const run = await harness({
    source,
    route: SAVE_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A)],
    },
    body: { accountId: ACCOUNT_B, accountName: "Fixture second" },
  });

  assertConfined(run);

  assert.deepEqual(
    run.sessionCalls.map((entry) => entry.name),
    ["stopCTraderService", "startCTraderService"],
    "saving must be caught tearing down the session another account is using"
  );
  assert.equal(
    run.calls.find((entry) => entry.name === "startCTraderService").args[3],
    ACCOUNT_A,
    "and a save that restarts a session cannot even say which account it did it for"
  );
});

test("mutant M3 a save that promotes the sole saved account selects without being asked", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `      activeAccountId:
        ctraderAuth.activeAccountId,
    };`,
    `      activeAccountId:
        accounts.length === 1
          ? accounts[0].accountId
          : ctraderAuth.activeAccountId,
    };`
  );

  const run = await harness({
    source,
    route: SAVE_ROUTE,
    auth: { activeAccountId: null, accounts: [] },
    body: { accountId: ACCOUNT_A, accountName: "Fixture only" },
  });

  assertConfined(run);

  assert.equal(
    run.savedStates.at(-1).activeAccountId,
    ACCOUNT_A,
    "the inference the suite forbids has to be reachable through this anchor"
  );
  assert.equal(
    run.summary().activeAccountId,
    ACCOUNT_A,
    "and an inferred selection has to reach the state the process trades with"
  );
});

test("mutant M4 a selection that skips the identity proof activates on persistence alone", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `      if (!identity.ok) {
        console.error(
          "🚫 Account activation refused:",`,
    `      if (false) {
        console.error(
          "🚫 Account activation refused:",`
  );

  const run = await harness({
    source,
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({
      running: false,
      connected: false,
      authenticated: false,
      ready: false,
      tradingAccountId: null,
    }),
    start: "another",
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.status.tradingAccountId, ACCOUNT_A);
  assert.equal(
    run.response.body.success,
    true,
    "without the proof, a session serving the replaced account is reported as the switch"
  );
  assert.equal(run.response.statusCode, 200);
});

test("mutant M5 a selection that hand-parses the id persists an account nobody saved", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `      const selection = selectAccountById({
        accountIds: (
          Array.isArray(ctraderAuth.accounts)
            ? ctraderAuth.accounts
            : []
        ).map((account) => account?.accountId),

        requestedAccountId:
          accountId,
      });`,
    `      const selection = {
        ok: true,
        accountId: String(accountId ?? "").trim(),
      };`
  );

  const run = await harness({
    source,
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    body: { accountId: UNSAVED_ACCOUNT },
  });

  assertConfined(run);

  assert.equal(
    run.savedStates.at(-1).activeAccountId,
    UNSAVED_ACCOUNT,
    "an id that names no record has to be provable as something this anchor selects"
  );
  assert.equal(
    run.summary().activeAccountId,
    UNSAVED_ACCOUNT,
    "and the process adopts what the anchor persisted"
  );

  /* The anchor still has to be a route that ran, not an unrelated
     crash on the way in: it got as far as the store and the adoption,
     then answered with its own failure. */
  assert.equal(
    run.response.statusCode,
    500,
    `the refused id has to be reached by the run this suite refuses: ${JSON.stringify(run.response.body)}`
  );
  assert.equal(run.response.body.success, false);
});

test("mutant M6 a selection that reports a start it never completed claims an activation", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `        return res.status(500).json({
          success: false,

          code:
            "session_not_started",`,
    `        return res.json({
          success: true,

          code:
            "session_not_started",`
  );

  const run = await harness({
    source,
    route: SELECT_ROUTE,
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
    start: "fails",
    body: { accountId: ACCOUNT_B },
  });

  assertConfined(run);

  assert.equal(run.status.ready, false);
  assert.equal(
    run.response.body.success,
    true,
    "a route that answers a failed start with success is exactly what the proof forbids"
  );
});

test("mutant M7 a removal that promotes the account left behind activates without being asked", async () => {
  const source = mutate(
    ROUTE_SOURCE,
    `        activeAccountId:
          plan.activeAccountId,`,
    `        activeAccountId:
          plan.accounts.length === 1
            ? plan.accounts[0].accountId
            : plan.activeAccountId,`
  );

  const run = await harness({
    source,
    route: REMOVAL_ROUTE,
    params: { accountId: ACCOUNT_A },
    auth: {
      activeAccountId: ACCOUNT_A,
      accounts: [accountRecord(ACCOUNT_A), accountRecord(ACCOUNT_B)],
    },
    session: sessionFlags({ tradingAccountId: ACCOUNT_A }),
  });

  assertConfined(run);

  assert.equal(
    run.savedStates.at(-1).activeAccountId,
    ACCOUNT_B,
    "the successor the removal rule refuses has to be provable through this anchor"
  );
  assert.equal(
    run.summary().activeAccountId,
    ACCOUNT_B,
    "and it has to reach the state the process trades with"
  );
});

