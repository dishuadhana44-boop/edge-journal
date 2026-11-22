import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import envIsolation from "../testsupport/envIsolationPreload.mjs";

/* ============================================================
   THE CURRENT cTRADER STORE FORMAT, PINNED BEFORE IT CHANGES

   Phase 2 Task 2.1-a. These tests describe the store as it is
   today: one JSON artifact that holds OAuth tokens and account
   metadata side by side, four-field account records with no
   broker, platform or environment, and a load path that can pick
   an active account without being asked. Several assertions pin
   behavior the rebuild is going to REMOVE. That is deliberate: a
   characterization test records the starting point so a later task
   changes it on purpose and can see every place it had to be
   retargeted. When one of these fails, the fix is never to soften
   the assertion — it is to decide, in that task's plan, that the
   recorded behavior is gone and to rewrite the expectation to the
   new contract.

   Task 2.1-c did exactly that in one place: the write is no longer a
   direct truncating write, and a failed persistence is no longer
   reported as success. Nothing recorded above was softened to
   accommodate it — section 15 is the new contract.

   HOW THE HARNESS STAYS OFF THE REAL STORE

   The production loader runs as a side effect of importing the
   route module, and it reads the file named beside its own
   runtimePaths.js, so no working directory and no injected option
   can redirect it. The harness therefore copies the route's
   relative-import closure into a fresh directory per case, writes a
   synthetic store beside that copy, and imports the copy. Relative
   imports resolve inside the copy; bare imports (express, dotenv,
   protobufjs, ws) resolve upward to server/node_modules, which is
   also where the scratch directory lives, so git never sees it.

   Nothing here edits production code, extracts a helper or changes
   a selection rule. Every assertion is about what the current
   implementation does to a store it is handed.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(HERE, "..");
const ROUTE_ENTRY = path.join(SERVER_DIR, "routes", "ctrader.js");

// Paths are only ever computed and compared. None of these files is opened.
const REPO_STORE_FILE = path.join(SERVER_DIR, "ctrader-auth.json");
const REPO_ACCOUNTS_FILE = path.join(SERVER_DIR, "ctrader-accounts.json");
const REPO_SERVER_ENV_FILE = path.join(SERVER_DIR, ".env");
const REPO_ROOT_ENV_FILE = path.join(SERVER_DIR, "..", ".env");
const REAL_CREDENTIAL_FILES = new Set([
  REPO_STORE_FILE,
  REPO_ACCOUNTS_FILE,
  REPO_SERVER_ENV_FILE,
  REPO_ROOT_ENV_FILE,
]);

const SCRATCH_DIR = path.join(
  SERVER_DIR,
  "node_modules",
  ".cache",
  "ctrader-store-characterization"
);

const SECRET_BEARING_NAMES = new Set([
  "ctrader-auth.json",
  "ctrader-accounts.json",
  ".env",
]);

// The six keys the current artifact holds, sorted.
const STORE_KEYS = [
  "accessToken",
  "accounts",
  "activeAccountId",
  "connected",
  "expiresIn",
  "refreshToken",
];

// The four fields the current account record holds, sorted.
const ACCOUNT_KEYS = ["accountId", "createdAt", "id", "name"];

// Every credential in these fixtures is invented for the test and is
// compared only through booleans, so no assertion message can carry it.
const ACCESS_TOKEN = "synthetic-access-token-fixture-0001";
const REFRESH_TOKEN = "synthetic-refresh-token-fixture-0002";
const EXPIRES_IN = 86400;

/* ============================================================
   RECORDING: SECRET-FILE TRAFFIC AND CONSOLE OUTPUT
   ============================================================ */

const secretFileTraffic = [];
const outputLines = [];

const realFs = {
  existsSync: fs.existsSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
  unlinkSync: fs.unlinkSync,
  statSync: fs.statSync,
};

const realConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function noteSecretTraffic(target) {
  let text = null;

  if (typeof target === "string") {
    text = target;
  } else if (target instanceof URL) {
    text = fileURLToPath(target);
  } else if (target !== null && typeof target === "object") {
    text = String(target);
  }

  if (typeof text !== "string") {
    return;
  }

  if (SECRET_BEARING_NAMES.has(path.basename(text))) {
    secretFileTraffic.push({ name: path.basename(text), path: path.resolve(text) });
  }
}

for (const name of ["existsSync", "readFileSync", "writeFileSync", "unlinkSync"]) {
  fs[name] = function recorded(...args) {
    noteSecretTraffic(args[0]);

    return realFs[name].apply(fs, args);
  };
}

function toLine(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// Production logs a banner and an account object on every load and
// removal. Silence it into a buffer: the run stays readable, and the
// buffer is what the leak check below can search.
for (const name of ["log", "info", "warn", "error"]) {
  console[name] = (...args) => {
    outputLines.push(args.map(toLine).join(" "));
  };
}

/* ============================================================
   THE COPYING HARNESS
   ============================================================ */

const RELATIVE_SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["'](\.[^"']+)["']/g;

function resolveClosure(entry) {
  const seen = new Set();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift();

    if (seen.has(file)) {
      continue;
    }

    seen.add(file);

    const source = realFs.readFileSync.call(fs, file, "utf8");

    for (const [, specifier] of source.matchAll(RELATIVE_SPECIFIER)) {
      const from = path.dirname(file);
      const candidates = [
        path.resolve(from, specifier),
        path.resolve(from, `${specifier}.js`),
        path.resolve(from, specifier, "index.js"),
      ];

      // A copied source that reached for a real credential file by name
      // would defeat the whole harness, so it is refused, not copied.
      if (SECRET_BEARING_NAMES.has(path.basename(candidates[0]))) {
        throw new Error(
          `${path.relative(SERVER_DIR, file)} reaches for ${specifier}, which the harness must never copy`
        );
      }

      const target = candidates.find(
        (candidate) =>
          realFs.existsSync.call(fs, candidate) &&
          realFs.statSync.call(fs, candidate).isFile()
      );

      if (target === undefined) {
        throw new Error(
          `${path.relative(SERVER_DIR, file)} imports ${specifier}, which the harness cannot resolve`
        );
      }

      queue.push(target);
    }
  }

  return [...seen];
}

const PRODUCTION_CLOSURE = resolveClosure(ROUTE_ENTRY);

let caseCounter = 0;

function buildCase(storeContents) {
  const dir = path.join(
    SCRATCH_DIR,
    `case-${String(++caseCounter).padStart(2, "0")}`
  );

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // The scratch tree sits inside server/node_modules, where the real
  // package.json already says "type": "module"; the stub keeps that
  // true even if the scratch location ever changes.
  realFs.writeFileSync.call(
    fs,
    path.join(dir, "package.json"),
    '{ "type": "module" }\n',
    "utf8"
  );

  for (const file of PRODUCTION_CLOSURE) {
    const destination = path.join(dir, path.relative(SERVER_DIR, file));

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }

  if (storeContents !== undefined) {
    realFs.writeFileSync.call(
      fs,
      path.join(dir, "ctrader-auth.json"),
      storeContents,
      "utf8"
    );
  }

  return dir;
}

function makeResponse() {
  const res = {
    statusCode: null,
    payload: undefined,
    headersSent: false,
    status(code) {
      res.statusCode = code;

      return res;
    },
    json(body) {
      if (res.statusCode === null) {
        res.statusCode = 200;
      }

      res.payload = body;

      return res;
    },
    send(body) {
      return res.json(body);
    },
    setHeader() {
      return res;
    },
    getHeader() {
      return undefined;
    },
    end(body) {
      if (body !== undefined) {
        res.payload = body;
      }

      return res;
    },
  };

  return res;
}

// The handlers are ordinary request handlers; driving them through
// router.handle keeps express doing the path matching and parameter
// filling it does in a live server, without a server, a port or a
// socket. Nothing here opens a connection: the routes reached below
// touch state and the store only.
async function callRoute(router, { method, route, url, body = {} }) {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route !== undefined &&
      candidate.route.path === route &&
      candidate.route.methods[method.toLowerCase()] === true
  );

  assert.ok(
    layer,
    `the cTrader routes expose no ${method.toUpperCase()} ${route} handler to characterize`
  );

  const res = makeResponse();
  const req = {
    method,
    url,
    originalUrl: url,
    body,
    query: {},
    params: {},
    headers: {},
  };

  let failure = null;

  router.handle(req, res, (error) => {
    if (error) {
      failure = error;
    }
  });

  // Give an awaited continuation one macrotask to settle, then report.
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  return {
    statusCode: res.statusCode,
    payload: res.payload,
    accountIdParam: req.params?.accountId,
    failure,
  };
}

async function openCase(storeContents) {
  const dir = buildCase(storeContents);
  const storeFile = path.join(dir, "ctrader-auth.json");
  const imported = await import(pathToFileURL(path.join(dir, "routes", "ctrader.js")).href);

  return {
    dir,
    router: imported.default,
    runtimePaths: await import(pathToFileURL(path.join(dir, "runtimePaths.js")).href),
    summary: imported.getBrokerAuthSummary(),
    storeExists: () => realFs.existsSync.call(fs, storeFile),
    readStore: () => realFs.readFileSync.call(fs, storeFile, "utf8"),
    call: (options) => callRoute(imported.default, options),
  };
}

function account(externalId, overrides = {}) {
  return {
    id: `account-stored-${externalId}`,
    accountId: externalId,
    name: `IC Markets ${externalId}`,
    createdAt: "2026-03-04T05:06:07.000Z",
    ...overrides,
  };
}

function fullStore(overrides = {}) {
  return JSON.stringify({
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account("70000001")],
    activeAccountId: "70000001",
    ...overrides,
  });
}

function getStatus(savedCase) {
  return savedCase.call({ method: "GET", route: "/status", url: "/status" });
}

// Token material is only ever compared, never interpolated: an
// assertion that prints its operands would put a credential value in
// the test output.
function holdsToken(observed, expected, label) {
  assert.equal(
    observed === expected,
    true,
    `${label} must survive unchanged in the store`
  );
}

/* ============================================================
   1. THE SIX-KEY STORAGE SHAPE
   ============================================================ */

test("requirement 1: a complete store loads every key it holds", async () => {
  const savedCase = await openCase(fullStore());

  assert.equal(savedCase.summary.connected, true);
  assert.equal(savedCase.summary.hasAccessToken, true);
  assert.equal(savedCase.summary.hasRefreshToken, true);
  assert.equal(savedCase.summary.activeAccountId, "70000001");
  assert.deepEqual(savedCase.summary.accounts.map((entry) => entry.accountId), [
    "70000001",
  ]);

  const status = await getStatus(savedCase);

  assert.equal(status.failure, null);
  assert.equal(status.statusCode, 200);
  assert.equal(status.payload.connected, true);
  assert.equal(status.payload.hasAccessToken, true);
  assert.equal(status.payload.hasRefreshToken, true);
  assert.equal(status.payload.activeAccountId, "70000001");

  // Token values stay out of the read surface even while the store
  // itself holds them, so the mixed artifact is a storage property,
  // not a response property.
  assert.deepEqual(
    Object.keys(status.payload).sort(),
    [
      "accounts",
      "activeAccount",
      "activeAccountId",
      "connected",
      "hasAccessToken",
      "hasRefreshToken",
      "service",
      "success",
    ]
  );
});

test("requirement 1b: a store write persists the six keys with secrets and account metadata together", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000001",
    })
  );

  // Removing an account that is not the active one is the one
  // production write that persists state without touching a socket.
  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(removed.failure, null);
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.accountIdParam, "70000002");

  const written = JSON.parse(savedCase.readStore());

  assert.deepEqual(Object.keys(written).sort(), STORE_KEYS);
  holdsToken(written.accessToken, ACCESS_TOKEN, "the stored access token");
  holdsToken(written.refreshToken, REFRESH_TOKEN, "the stored refresh token");
  assert.equal(written.expiresIn, EXPIRES_IN);
  assert.equal(written.connected, true);
  assert.deepEqual(written.accounts, [account("70000001")]);
  assert.equal(
    written.activeAccountId,
    "70000001",
    "removing an inactive account must preserve the explicit selection"
  );
});

test("requirement 1c: a sparse store gains the whole six-key shape on the next write", async () => {
  const savedCase = await openCase(
    JSON.stringify({
      accounts: [account("70000001"), account("70000002")],
    })
  );

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(removed.statusCode, 200);

  const written = JSON.parse(savedCase.readStore());

  assert.deepEqual(Object.keys(written).sort(), STORE_KEYS);
  assert.equal(written.connected, false);
  assert.equal(written.accessToken, null);
  assert.equal(written.refreshToken, null);
  assert.equal(written.expiresIn, null);
  assert.equal(
    written.activeAccountId,
    null,
    "a store with several accounts and no stored selection loads unselected"
  );
});

/* ============================================================
   2. THE LEGACY SINGLE-ACCOUNT FORMAT
   ============================================================ */

test("requirement 2: a top-level accountId with no accounts array becomes one saved record", async () => {
  const savedCase = await openCase(
    JSON.stringify({
      connected: true,
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresIn: EXPIRES_IN,
      accountId: "70000009",
    })
  );

  const status = await getStatus(savedCase);

  assert.equal(status.payload.accounts.length, 1);
  assert.deepEqual(
    Object.keys(status.payload.accounts[0]).sort(),
    ACCOUNT_KEYS
  );
  assert.equal(status.payload.accounts[0].accountId, "70000009");
  assert.equal(status.payload.accounts[0].name, "Imported Trading Account");
  assert.match(status.payload.accounts[0].id, /^account-\d+-[a-z0-9]{1,6}$/);

  // CHANGED ON PURPOSE BY TASK 2.1-e. This assertion used to pin the
  // imported sole account as also being selected, "without anyone
  // asking", and named the task that would remove it. That task is
  // this one: the record is still imported, and nothing is active.
  assert.equal(status.payload.activeAccountId, null);
  assert.equal(status.payload.activeAccount, null);
});

/* ============================================================
   2b. THE LEGACY TOP-LEVEL ID ALSO ACTS AS A SELECTION
   ============================================================ */

test("requirement 2b: a legacy top-level id beside a full accounts array selects that record", async () => {
  // The store a partially completed migration leaves behind: the array
  // was written, the old single-account fields were never cleared, and
  // no activeAccountId was ever stored.
  const savedCase = await openCase(
    JSON.stringify({
      connected: true,
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresIn: EXPIRES_IN,
      accounts: [account("70000021"), account("70000022")],
      accountId: "70000022",
    })
  );

  const status = await getStatus(savedCase);

  // CHANGED ON PURPOSE BY TASK 2.1-e. This used to pin one account
  // being picked out of an ambiguous store without anyone asking for
  // it, and said that after the removal "this store must load
  // unselected". It now does: the stale top-level key is history, not
  // a choice, and the order endpoints see no active account until the
  // owner selects one.
  assert.equal(status.payload.activeAccountId, null);
  assert.equal(status.payload.activeAccount, null);

  // The legacy id names a record; it does not become a second one.
  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["70000021", "70000022"]
  );
});


test("requirement 3: three saved accounts load in stored order with all four fields", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [
        account("70000001"),
        account("70000002"),
        account("70000003"),
      ],
      activeAccountId: "70000002",
    })
  );

  const status = await getStatus(savedCase);

  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["70000001", "70000002", "70000003"]
  );
  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.id),
    [
      "account-stored-70000001",
      "account-stored-70000002",
      "account-stored-70000003",
    ]
  );
  assert.deepEqual(
    Object.keys(status.payload.accounts[2]).sort(),
    ACCOUNT_KEYS
  );
  assert.equal(status.payload.activeAccountId, "70000002");
});

/* ============================================================
   4. A VALID activeAccountId
   ============================================================ */

test("requirement 4: a stored id naming a saved account comes back active and resolves to its record", async () => {
  const second = account("70000002");
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), second],
      activeAccountId: "70000002",
    })
  );

  const status = await getStatus(savedCase);

  assert.equal(status.payload.activeAccountId, "70000002");
  assert.deepEqual(status.payload.activeAccount, second);
  assert.equal(savedCase.summary.activeAccountId, "70000002");
});

test("requirement 4b: a numeric stored id is coerced to text before it is honored", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("31415926"), account("70000002")],
      activeAccountId: 31415926,
    })
  );

  const status = await getStatus(savedCase);

  // The shared selection rule keys on trimmed text, so the number in
  // the store comes back as the text id the rest of the code matches
  // against — and the next write persists that text form.
  assert.equal(status.payload.activeAccountId, "31415926");
  assert.deepEqual(
    status.payload.activeAccount,
    account("31415926"),
    "a numeric stored id resolves against the text account ids it matches"
  );
});

/* ============================================================
   5. A MISSING activeAccountId
   ============================================================ */

test("requirement 5: no stored id among several saved accounts loads unselected", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: undefined,
    })
  );

  const status = await getStatus(savedCase);

  assert.equal(status.payload.activeAccountId, null);
  assert.equal(status.payload.activeAccount, null);
  assert.equal(status.payload.accounts.length, 2);
});

test("requirement 5b: no stored id with exactly one saved account loads unselected", async () => {
  const savedCase = await openCase(
    fullStore({ accounts: [account("70000001")], activeAccountId: undefined })
  );

  const status = await getStatus(savedCase);

  // CHANGED ON PURPOSE BY TASK 2.1-e. This is where the sole-account
  // fallback used to live: one record in the store was enough for the
  // loader to decide an account was active, and the order endpoints
  // followed that decision into a trade. A record is what the token
  // was handed; an active account is a choice somebody has to have
  // made.
  assert.equal(
    status.payload.activeAccountId,
    null,
    "the loader still promoted the only saved account to active"
  );
  assert.equal(status.payload.activeAccount, null);
  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["70000001"],
    "refusing to select came back as refusing to keep the record"
  );
});

test("requirement 5c: an explicit null selection with one saved account stays null", async () => {
  const savedCase = await openCase(
    fullStore({ accounts: [account("70000001")], activeAccountId: null })
  );

  const status = await getStatus(savedCase);

  // CHANGED ON PURPOSE BY TASK 2.1-e. A stored `null` used to fall
  // through to the same sole-account pick, which made an owner's
  // deliberate "nothing is active" indistinguishable from a file that
  // had never been asked. Both now mean nothing — and both have to,
  // because nothing on disk tells them apart.
  assert.equal(
    status.payload.activeAccountId,
    null,
    "the loader treated a stored null as a request to select something"
  );
  assert.equal(status.payload.activeAccount, null);
});

/* ============================================================
   6. A DANGLING activeAccountId
   ============================================================ */

test("requirement 6: a stored id naming no saved account loads unselected and keeps every record", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000099",
    })
  );

  const status = await getStatus(savedCase);

  assert.equal(status.payload.activeAccountId, null);
  assert.equal(status.payload.activeAccount, null);
  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["70000001", "70000002"]
  );
});

test("requirement 6b: a dangling id is not rescued by the sole-account fallback", async () => {
  const savedCase = await openCase(
    fullStore({ accounts: [account("70000001")], activeAccountId: "70000099" })
  );

  const status = await getStatus(savedCase);

  assert.equal(
    status.payload.activeAccountId,
    null,
    "a stored id that names no account leaves the store unselected rather than picking the only record"
  );
});

/* ============================================================
   7. MISSING OPTIONAL FIELDS
   ============================================================ */

test("requirement 7: a record with only an account id gains a generated local id and defaults", async () => {
  const before = new Date().toISOString();
  const savedCase = await openCase(
    JSON.stringify({
      connected: true,
      accessToken: ACCESS_TOKEN,
      accounts: [{ accountId: "70000010" }],
      activeAccountId: "70000010",
    })
  );

  const status = await getStatus(savedCase);
  const loaded = status.payload.accounts[0];

  assert.deepEqual(Object.keys(loaded).sort(), ACCOUNT_KEYS);
  assert.equal(loaded.accountId, "70000010");
  assert.equal(
    loaded.name,
    "Trading Account",
    "a saved record without a name gets the generic label"
  );
  assert.match(
    loaded.id,
    /^account-\d+-[a-z0-9]{1,6}$/,
    "a saved record without a local id gets a generated one"
  );
  assert.ok(
    loaded.createdAt >= before,
    "a saved record without createdAt is stamped at load time"
  );
});

test("requirement 7b: a record without an account id is dropped from the store", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), { id: "account-no-id", name: "No Id" }],
      activeAccountId: "70000001",
    })
  );

  const status = await getStatus(savedCase);

  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["70000001"],
    "the loader keeps only records that name an account id"
  );
});

/* ============================================================
   8. UNKNOWN ADDITIONAL FIELDS
   ============================================================ */

test("requirement 8: fields the current format does not know are dropped on load", async () => {
  const rich = account("70000011", {
    brokerId: "ic-markets",
    platformId: "ctrader",
    environment: "demo",
    externalAccountId: "70000011",
    label: "IC Markets Demo",
    isLive: false,
    traderLogin: "555001",
    note: "written by a future migration",
  });
  const savedCase = await openCase(
    fullStore({
      accounts: [rich, account("70000002")],
      activeAccountId: "70000011",
    })
  );

  const status = await getStatus(savedCase);
  const loaded = status.payload.accounts[0];

  assert.deepEqual(Object.keys(loaded).sort(), ACCOUNT_KEYS);
  assert.equal(loaded.environment, undefined);
  assert.equal(loaded.platformId, undefined);
  assert.equal(loaded.externalAccountId, undefined);
  assert.equal(loaded.label, undefined);

  // CHARACTERIZATION. Anything a future migration writes today would
  // be erased by the next load, which is why the migration and the
  // normalization have to land in the same task. Removing the other,
  // inactive account rewrites the store with the rich record still in
  // it, so the erased fields are proven gone on disk as well as in
  // memory.
  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(removed.statusCode, 200);

  const written = JSON.parse(savedCase.readStore());

  assert.equal(written.accounts.length, 1);
  assert.deepEqual(Object.keys(written.accounts[0]).sort(), ACCOUNT_KEYS);
  assert.equal(written.accounts[0].accountId, "70000011");
  assert.equal(
    JSON.stringify(written).includes("555001"),
    false,
    "a field the current format does not know must not survive a rewrite"
  );
});

test("requirement 8b: unknown keys on the store object itself are dropped on the next write", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      lastRefreshedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:30:00.000Z",
    })
  );

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(removed.statusCode, 200);

  assert.deepEqual(
    Object.keys(JSON.parse(savedCase.readStore())).sort(),
    STORE_KEYS,
    "only the six known keys survive a rewrite"
  );
});

/* ============================================================
   9. AN INVALID accounts TYPE
   ============================================================ */

for (const [label, value] of [
  ["a string", "70000001"],
  ["null", null],
  ["an object", { accountId: "70000001" }],
  ["a number", 7],
  ["false", false],
]) {
  test(`requirement 9: accounts as ${label} loads no saved record and survives load`, async () => {
    const savedCase = await openCase(
      JSON.stringify({
        connected: true,
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        expiresIn: EXPIRES_IN,
        accounts: value,
        activeAccountId: "70000001",
      })
    );

    const status = await getStatus(savedCase);

    assert.equal(status.failure, null);
    assert.deepEqual(status.payload.accounts, []);
    assert.equal(
      status.payload.activeAccountId,
      null,
      "with no records to name, the stored selection cannot be honored"
    );
    assert.equal(
      status.payload.connected,
      true,
      "the stored authorization is kept even though the account list was unusable"
    );
    assert.equal(status.payload.hasAccessToken, true);
  });
}

/* ============================================================
   10. CORRUPT JSON
   ============================================================ */

test("requirement 10: unparseable content loads as the default state without throwing", async () => {
  const savedCase = await openCase("{ this was never json ]");

  assert.equal(savedCase.summary.connected, false);
  assert.equal(savedCase.summary.hasAccessToken, false);
  assert.equal(savedCase.summary.hasRefreshToken, false);
  assert.deepEqual(savedCase.summary.accounts, []);
  assert.equal(savedCase.summary.activeAccountId, null);

  const status = await getStatus(savedCase);

  assert.equal(status.failure, null);
  assert.equal(status.statusCode, 200);
  assert.equal(status.payload.connected, false);
});

test("requirement 10b: a store truncated mid-write loads as the default state", async () => {
  const savedCase = await openCase(fullStore().slice(0, 40));

  const status = await getStatus(savedCase);

  assert.equal(status.payload.connected, false);
  assert.deepEqual(status.payload.accounts, []);
  assert.equal(status.payload.activeAccountId, null);
});

test("requirement 10c: a corrupt store is not repaired by a refused removal", async () => {
  const savedCase = await openCase('{"connected":true,"accessToken":"');

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000001",
  });

  assert.equal(removed.statusCode, 404);
  assert.equal(
    savedCase.readStore(),
    '{"connected":true,"accessToken":"',
    "a refused removal never rewrites the file, so a corrupt store stays corrupt"
  );
});

/* ============================================================
   11. AN EMPTY JSON FILE
   ============================================================ */

test("requirement 11: an empty file loads as the default state", async () => {
  const savedCase = await openCase("");

  assert.equal(savedCase.summary.connected, false);
  assert.deepEqual(savedCase.summary.accounts, []);
  assert.equal(savedCase.summary.activeAccountId, null);
});

test("requirement 11b: an empty object loads as the default state", async () => {
  const savedCase = await openCase("{}");

  const status = await getStatus(savedCase);

  assert.equal(status.payload.connected, false);
  assert.equal(status.payload.hasAccessToken, false);
  assert.deepEqual(status.payload.accounts, []);
  assert.equal(status.payload.activeAccountId, null);
});

/* ============================================================
   12. A MISSING STORAGE FILE
   ============================================================ */

test("requirement 12: no store file at all loads the default state and creates nothing", async () => {
  const savedCase = await openCase(undefined);

  assert.equal(savedCase.storeExists(), false);
  assert.equal(savedCase.summary.connected, false);
  assert.deepEqual(savedCase.summary.accounts, []);
  assert.equal(savedCase.summary.activeAccountId, null);

  const status = await getStatus(savedCase);

  assert.equal(status.statusCode, 200);
  assert.deepEqual(status.payload.accounts, []);
  assert.equal(
    savedCase.storeExists(),
    false,
    "reading the store must not create it"
  );
});

/* ============================================================
   13. LEGACY ACCOUNT IDS AND NAMES UNCHANGED
   ============================================================ */

test("requirement 13: stored local ids, account ids and names come back unchanged", async () => {
  const kept = account("31415926", {
    id: "account-1700000000000-abc123",
    name: "IC Markets Live 31415926",
  });
  const savedCase = await openCase(
    fullStore({
      accounts: [kept, account("88990011", { name: "IC Markets Demo" })],
      activeAccountId: "31415926",
    })
  );

  const status = await getStatus(savedCase);

  assert.deepEqual(status.payload.accounts[0], kept);
  assert.equal(status.payload.accounts[0].id, "account-1700000000000-abc123");
  assert.equal(status.payload.accounts[0].name, "IC Markets Live 31415926");
  assert.equal(status.payload.accounts[1].name, "IC Markets Demo");

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/88990011",
  });

  assert.equal(removed.statusCode, 200);
  assert.deepEqual(
    JSON.parse(savedCase.readStore()).accounts,
    [kept],
    "the untouched record is rewritten field for field"
  );
});

test("requirement 13b: a padded numeric account id is trimmed and stringified", async () => {
  const savedCase = await openCase(
    JSON.stringify({
      connected: true,
      accessToken: ACCESS_TOKEN,
      accounts: [{ accountId: 31415926 }, { accountId: "  70000002  " }],
      activeAccountId: "70000002",
    })
  );

  const status = await getStatus(savedCase);

  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["31415926", "70000002"]
  );
  assert.equal(status.payload.activeAccountId, "70000002");

  // The padded record keeps its trimmed id and gains the same
  // defaults any other incomplete record does.
  assert.deepEqual(
    Object.keys(status.payload.activeAccount).sort(),
    ACCOUNT_KEYS
  );
  assert.equal(status.payload.activeAccount.name, "Trading Account");
  assert.match(status.payload.activeAccount.id, /^account-\d+-[a-z0-9]{1,6}$/);
});

/* ============================================================
   14. EXISTING createdAt VALUES UNCHANGED
   ============================================================ */

test("requirement 14: a stored createdAt survives load and rewrite verbatim", async () => {
  const older = account("70000001", {
    createdAt: "2024-11-12T13:14:15.000Z",
  });
  const newer = account("70000002", {
    createdAt: "2025-06-07T08:09:10.000Z",
  });
  const savedCase = await openCase(
    fullStore({ accounts: [older, newer], activeAccountId: "70000001" })
  );

  const status = await getStatus(savedCase);

  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.createdAt),
    ["2024-11-12T13:14:15.000Z", "2025-06-07T08:09:10.000Z"]
  );

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(removed.statusCode, 200);

  const written = JSON.parse(savedCase.readStore());

  assert.deepEqual(
    written.accounts.map((entry) => entry.createdAt),
    ["2024-11-12T13:14:15.000Z"],
    "the timestamp the owner already had is not re-stamped"
  );
});

/* ============================================================
   15. A PERSISTENCE FAILURE IS AN ANSWER, NOT A SILENCE
   ============================================================ */

/* The store's own suite fails one filesystem operation at a time.
   These cases ask the question that only a route can answer: when a
   handler cannot put the new state on disk, does the caller find out,
   and does the process go on holding the state it really has? A
   handler that replies "saved" while the file still holds the old
   state — or that drops the session from memory because a removal it
   never performed was reported as success — is the failure Task
   2.1-c exists to remove. The two ways to make persistence refuse
   without a mock are both portable: take away the directory the
   temporary file needs, and put a directory where the store file is.
   ============================================================ */

test("durability: a write the disk refused is answered as a failure", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000001",
    })
  );

  const statusBefore = await getStatus(savedCase);

  assert.deepEqual(
    statusBefore.payload.accounts.map((entry) => entry.accountId),
    ["70000001", "70000002"]
  );

  // The case directory goes, so the directory beside the store goes
  // with it: the write has nowhere to put its temporary file, and
  // inventing one is not the store's decision to make.
  fs.rmSync(savedCase.dir, { recursive: true, force: true });

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(
    removed.failure,
    null,
    "the persistence failure escaped the handler instead of being answered"
  );
  assert.equal(
    removed.statusCode === 200,
    false,
    "a state nobody persisted was reported as saved"
  );
  assert.equal(removed.statusCode, 500);
  assert.equal(removed.payload.success, false);

  const status = await getStatus(savedCase);

  assert.deepEqual(
    status.payload.accounts.map((entry) => entry.accountId),
    ["70000001", "70000002"],
    "the in-memory account list advanced past a write that never happened"
  );
  assert.equal(status.payload.activeAccountId, "70000001");

  assert.equal(
    String(removed.payload.message).includes(SCRATCH_DIR),
    false,
    "the answer to the caller quoted where the store lives"
  );
});

test("durability: a removal the disk refused is answered as a failure", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000001",
    })
  );

  fs.rmSync(savedCase.runtimePaths.AUTH_FILE);
  fs.mkdirSync(savedCase.runtimePaths.AUTH_FILE);

  const disconnected = await savedCase.call({
    method: "POST",
    route: "/disconnect",
    url: "/disconnect",
  });

  assert.equal(disconnected.failure, null);
  assert.equal(disconnected.statusCode, 500);
  assert.equal(disconnected.payload.success, false);

  const status = await getStatus(savedCase);

  assert.equal(
    status.payload.connected,
    true,
    "a disconnect that removed nothing dropped the session it still holds"
  );
  assert.equal(
    String(disconnected.payload.message).includes(SCRATCH_DIR),
    false,
    "the answer to the caller quoted where the store lives"
  );
});

test("durability: a route write leaves only the store file beside it", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000001",
    })
  );

  const removed = await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  assert.equal(removed.statusCode, 200);

  const leftovers = fs
    .readdirSync(savedCase.dir)
    .filter((entry) => entry.includes(".tmp-"));

  assert.deepEqual(
    leftovers,
    [],
    "a temporary file survived the replacement and is now a second copy of the session"
  );
  assert.deepEqual(
    JSON.parse(savedCase.readStore()).accounts.map((entry) => entry.accountId),
    ["70000001"]
  );
});

/* ============================================================
   ISOLATION GUARDS
   ============================================================ */

test("isolation: the loaded module reads the case store, never the repository store", async () => {
  const savedCase = await openCase(fullStore());

  assert.equal(
    path.resolve(savedCase.runtimePaths.AUTH_FILE),
    path.join(savedCase.dir, "ctrader-auth.json")
  );
  assert.notEqual(path.resolve(savedCase.runtimePaths.AUTH_FILE), REPO_STORE_FILE);
  assert.ok(savedCase.runtimePaths.AUTH_FILE.startsWith(savedCase.dir));
  assert.equal(savedCase.storeExists(), true);
});

test("isolation: the accounts path the copied module resolves stays in the case tree", async () => {
  /* The same copy that anchors the credential path anchors the accounts
     path, so a future reader of account metadata inherits this
     isolation instead of escaping it. The name is checked as data, never
     opened. */
  const savedCase = await openCase(fullStore());

  assert.equal(
    path.resolve(savedCase.runtimePaths.ACCOUNTS_FILE),
    path.join(savedCase.dir, "ctrader-accounts.json")
  );
  assert.notEqual(
    path.resolve(savedCase.runtimePaths.ACCOUNTS_FILE),
    REPO_ACCOUNTS_FILE
  );
  assert.ok(savedCase.runtimePaths.ACCOUNTS_FILE.startsWith(savedCase.dir));
  assert.notEqual(
    savedCase.runtimePaths.ACCOUNTS_FILE,
    savedCase.runtimePaths.AUTH_FILE,
    "the two store paths would be the same file, which hands every account reader the token"
  );
});

test("isolation: the closure that gets copied holds no secret-bearing file", () => {
  const names = PRODUCTION_CLOSURE.map((file) => path.basename(file));

  assert.equal(names.includes("ctrader-auth.json"), false);
  assert.equal(names.includes("ctrader-accounts.json"), false);
  assert.equal(names.includes(".env"), false);
  assert.equal(
    names.some((name) => name.endsWith(".test.js")),
    false,
    "the harness copies only the modules the route imports"
  );
  assert.ok(
    PRODUCTION_CLOSURE.length >= 2,
    "the harness must copy the route and the store path it derives"
  );
});

test("isolation: every credential-file access in this run stayed inside the scratch tree", async () => {
  // Drive one more mixed read/write so the traffic log covers both
  // directions before it is examined.
  const savedCase = await openCase(fullStore());

  await getStatus(savedCase);

  assert.ok(
    secretFileTraffic.length > 0,
    "the harness expected to record store traffic in the scratch tree"
  );

  for (const entry of secretFileTraffic) {
    assert.equal(
      entry.path.startsWith(SCRATCH_DIR),
      true,
      `something reached for ${entry.name} outside the scratch tree`
    );
    assert.equal(
      REAL_CREDENTIAL_FILES.has(entry.path),
      false,
      `the real ${entry.name} must never be opened by these tests`
    );
  }

  assert.equal(
    envIsolation.attempts.some(
      (attempt) => attempt === REPO_SERVER_ENV_FILE || attempt === REPO_ROOT_ENV_FILE
    ),
    false,
    "the dotenv guard never had to answer for a repository .env"
  );
});

test("isolation: loading the store performs no write", async () => {
  const contents = fullStore({
    accounts: [account("70000001"), account("70000002")],
    activeAccountId: "70000001",
  });
  const savedCase = await openCase(contents);

  assert.equal(
    savedCase.readStore() === contents,
    true,
    "importing and reading the store must leave the file byte-for-byte as it was"
  );
});

test("isolation: synthetic token values never reach the captured output", async () => {
  const savedCase = await openCase(
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000001",
    })
  );

  await getStatus(savedCase);

  const accounts = await savedCase.call({
    method: "GET",
    route: "/accounts",
    url: "/accounts",
  });

  const debug = await savedCase.call({
    method: "GET",
    route: "/debug",
    url: "/debug",
  });

  assert.deepEqual(
    Object.keys(accounts.payload).sort(),
    ["accounts", "activeAccount", "activeAccountId", "success"]
  );
  assert.deepEqual(
    Object.keys(debug.payload).sort(),
    ["activeAccount", "auth", "service", "success"]
  );
  assert.equal(debug.payload.auth.hasAccessToken, true);
  assert.equal(Object.hasOwn(debug.payload.auth, "accessToken"), false);
  assert.equal(Object.hasOwn(debug.payload.auth, "refreshToken"), false);

  await savedCase.call({
    method: "DELETE",
    route: "/accounts/:accountId",
    url: "/accounts/70000002",
  });

  const leaked = outputLines.filter(
    (line) => line.includes(ACCESS_TOKEN) || line.includes(REFRESH_TOKEN)
  );

  assert.deepEqual(
    leaked.length,
    0,
    "the run printed token material that belongs only in the case store"
  );
});

before(() => {
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
});

after(() => {
  Object.assign(console, realConsole);
  Object.assign(fs, realFs);

  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
});
