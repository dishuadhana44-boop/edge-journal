import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AUTH_FILE } from "../runtimePaths.js";
import { createCtraderStore } from "./ctraderStore.js";

/* ============================================================
   THE INJECTABLE cTRADER STORE

   routes/ctrader.js used to own this logic inline: a module-level
   constant named AUTH_FILE, read at import time and written by
   whichever handler happened to call saveAuth. Nothing about that
   shape let a test supply its own storage file, which is why
   Task 2.1-a had to copy the whole production closure into a
   scratch tree just to look at the loader.

   This suite holds the same behaviour behind an injected path. It
   imports ONLY the store: no route, no Express, no service, no
   socket. Every store lives in its own temporary directory and
   every value inside it is synthetic, so the repository's own
   store and configuration files are never candidates for I/O.

   THE SHAPE IS THE ONE THE STORE ACTUALLY HAS. Six keys, secrets
   beside account metadata, the legacy single-account import and the
   atomic replacement write are pinned here as the contract. What is
   NOT pinned any more is the automatic selection of a sole saved
   account: Phase 2.1-e Task 4 made the runtime loader explicit-only,
   and the tests that recorded the old inference were retargeted in
   that task rather than softened. A test that starts failing because
   a later task improved the store is retargeted in that task's plan,
   never softened here.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

const SELF_SOURCE = fs
  .readFileSync(path.join(HERE, "ctraderStore.test.js"), "utf8")
  .replace(/\r\n/g, "\n");

const STORE_SOURCE = fs
  .readFileSync(path.join(HERE, "ctraderStore.js"), "utf8")
  .replace(/\r\n/g, "\n");

const ACCESS_TOKEN = "synthetic-access-token-fixture-1001";
const REFRESH_TOKEN = "synthetic-refresh-token-fixture-1002";
const EXPIRES_IN = 86400;

const STORE_KEYS = [
  "connected",
  "accessToken",
  "refreshToken",
  "expiresIn",
  "accounts",
  "activeAccountId",
];

const CREATED = [];

function tempFilePath(name = "ctrader-auth.json") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-store-"));

  CREATED.push(dir);

  return path.join(dir, name);
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

const realConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function toLine(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Every store call logs the way the route's loader logged, and the
// noise would bury the report, so the output is captured and read.
function quiet(fn) {
  const lines = [];
  const capture = (...args) => {
    lines.push(args.map(toLine).join(" "));
  };

  Object.assign(console, {
    log: capture,
    info: capture,
    warn: capture,
    error: capture,
  });

  try {
    return { result: fn(), lines };
  } finally {
    Object.assign(console, realConsole);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/* ============================================================
   AN INJECTED FILE SYSTEM

   The atomic write is six operations long, so the interesting
   question is not only what a successful write does but what each
   individual step leaves behind when it fails. Monkey-patching the
   real module would make one failure leak into the next test; an
   injected object lets a test fail exactly one step, let the other
   steps really touch the disk, and read the bytes afterwards.

   Recorded paths are handed back for comparison only. No assertion
   below interpolates one: a directory name in a failure message
   would put a real filesystem path in the report, which is the very
   thing the store is being asked to keep out of its own messages.
   ============================================================ */

const FS_OPERATIONS = [
  "existsSync",
  "readFileSync",
  "openSync",
  "writeSync",
  "fsyncSync",
  "closeSync",
  "renameSync",
  "unlinkSync",
];

function fsFailure(code) {
  const error = new Error(`${code}: synthetic filesystem failure`);

  error.code = code;

  return error;
}

function recordingFileSystem(failures = {}) {
  const calls = [];

  const fileSystem = {};

  for (const name of FS_OPERATIONS) {
    fileSystem[name] = (...args) => {
      calls.push({
        name,
        target: typeof args[0] === "string" ? args[0] : null,
      });

      const failure = failures[name];

      if (typeof failure === "function") {
        return failure(...args);
      }

      if (failure !== undefined) {
        throw failure;
      }

      return fs[name](...args);
    };
  }

  // A store that tried to create its parent directory would get this
  // instead of the ENOENT it is supposed to report.
  fileSystem.mkdirSync = () => {
    throw new Error("the store is not allowed to create a directory");
  };

  return {
    fileSystem,
    operations: () => calls.map((call) => call.name),
    targetsOf: (name) =>
      calls.filter((call) => call.name === name).map((call) => call.target),
  };
}

// The temporary files the store is expected to have removed.
function tempLeftovers(dir) {
  return fs.readdirSync(dir).filter((entry) => entry.includes(".tmp-"));
}

function state(overrides = {}) {
  return {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account("70000001")],
    activeAccountId: "70000001",
    ...overrides,
  };
}

// A call that is expected to raise: the throw is turned into a value
// so the assertions about it stay readable, and an implementation
// that swallowed the failure leaves `failure` null and fails.
function captureThrow(fn) {
  let failure = null;

  const { lines } = quiet(() => {
    try {
      fn();
    } catch (error) {
      failure = error;
    }
  });

  return { failure, lines };
}

// Only the module specifiers a file imports are pulled out, so a prose
// mention of another module cannot be mistaken for a dependency. The
// scan is anchored at the start of a line, which is where a real
// statement lives, and it refuses a silent shortfall: an `import`
// whose `from` clause wrapped onto the next line would otherwise slip
// past the guard unnoticed.
function importSpecifiers(source) {
  const matches = [
    ...source.matchAll(/^import\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm),
  ].map((match) => match[1]);

  const statements = source.match(/^import\b/gm) || [];

  assert.equal(
    matches.length,
    statements.length,
    "an import was not read as a dependency; the guard needs a wider pattern"
  );

  return matches;
}

after(() => {
  for (const dir of CREATED) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ============================================================
   THE INJECTION POINT
   ============================================================ */

test("the store exposes the four operations the route needs", () => {
  const store = createCtraderStore({ filePath: tempFilePath() });

  assert.deepEqual(Object.keys(store).sort(), [
    "clear",
    "filePath",
    "load",
    "save",
  ]);
  assert.equal(typeof store.load, "function");
  assert.equal(typeof store.save, "function");
  assert.equal(typeof store.clear, "function");
});

test("constructing a store performs no I/O at all", () => {
  const filePath = tempFilePath();

  const { lines } = quiet(() => createCtraderStore({ filePath }));

  assert.equal(fs.existsSync(path.dirname(filePath)), true);
  assert.equal(fs.existsSync(filePath), false);
  assert.deepEqual(lines, []);
});

test("an injected store never resolves to the repository path", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({ filePath });

  assert.equal(store.filePath, filePath);
  assert.notEqual(path.resolve(store.filePath), path.resolve(AUTH_FILE));

  quiet(() => store.load());

  assert.equal(fs.existsSync(filePath), false);
});

test("the default store is the anchored production path", () => {
  // Only the resolved name is checked here. Nothing in this suite can
  // reach the real store, because the default store is never loaded.
  const store = createCtraderStore();

  assert.equal(store.filePath, AUTH_FILE);
  assert.equal(path.isAbsolute(store.filePath), true);
  assert.equal(path.basename(store.filePath), "ctrader-auth.json");
});

test("the store resolves without importing the route module", () => {
  // Built from fragments so the guard cannot match its own source.
  const routeFragment = ["routes", "ctrader"].join("/");

  // The import list is the whole proof: nothing here, and nothing the
  // store itself reaches for, can pull in the route, Express or the
  // trading service. A prose mention of the route file must not trip
  // this, so specifiers are read out of the syntax rather than
  // searched for in the text.
  assert.deepEqual(importSpecifiers(SELF_SOURCE).sort(), [
    "../runtimePaths.js",
    "./ctraderStore.js",
    "node:assert/strict",
    "node:fs",
    "node:os",
    "node:path",
    "node:test",
    "node:url",
  ]);

  const storeImports = importSpecifiers(STORE_SOURCE).sort();

  assert.deepEqual(storeImports, [
    "../runtimePaths.js",
    "./ctraderAccountSelection.js",
    "fs",
    "node:process",
  ]);

  for (const specifier of [...importSpecifiers(SELF_SOURCE), ...storeImports]) {
    assert.equal(
      specifier.includes(routeFragment),
      false,
      `${specifier} is not a storage dependency`
    );
    assert.equal(
      specifier.includes(["ctrader", "Service"].join("")),
      false,
      `${specifier} would drag the live service into a storage test`
    );
  }
});

/* ============================================================
   THE DEPENDENCY CLOSURE
   ============================================================ */

const SERVER_DIR = path.resolve(HERE, "..");

/* The same walk Task 2.1-a's harness uses: follow every relative
   specifier, transitively, and name what the store actually drags
   into a test process. A store that reaches for the route, the
   service or a credential file by name is refused here rather than
   discovered later by an import that started a socket.

   The refusal happens before the file is opened: a credential file
   is never a candidate for reading, not even by a guard that is
   trying to prove it would not be read. */

const SECRET_BEARING_NAMES = new Set([
  ".env",
  ["ctrader", "auth", "json"].join("-"),
  ["ctrader", "accounts", "json"].join("-"),
]);

function closureOf(entry, seen = new Set()) {
  if (seen.has(entry)) {
    return seen;
  }

  if (SECRET_BEARING_NAMES.has(path.basename(entry))) {
    throw new Error(
      `${path.relative(SERVER_DIR, entry)} is a credential file; the closure walk refuses to open it`
    );
  }

  seen.add(entry);

  const source = fs.readFileSync(entry, "utf8");

  for (const [, specifier] of source.matchAll(
    /\bfrom\s*["'](\.[^"']+)["']/g
  )) {
    const from = path.dirname(entry);
    const target = [
      path.resolve(from, specifier),
      path.resolve(from, `${specifier}.js`),
      path.resolve(from, specifier, "index.js"),
    ].find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    );

    if (target === undefined) {
      throw new Error(
        `${path.relative(SERVER_DIR, entry)} imports ${specifier}, which cannot be resolved`
      );
    }

    closureOf(target, seen);
  }

  return seen;
}

test("the store closure is storage and the pure selection rule, nothing else", () => {
  const names = [...closureOf(path.join(HERE, "ctraderStore.js"))]
    .map((file) => path.relative(SERVER_DIR, file).split(path.sep).join("/"))
    .sort();

  assert.deepEqual(names, [
    "brokers/identity.js",
    "runtimePaths.js",
    "services/ctraderAccountSelection.js",
    "services/ctraderStore.js",
  ]);
});

test("the closure walk refuses a credential file instead of opening it", () => {
  /* A synthetic tree in a temporary directory, because the only way to
     show the refusal happens before the read is to put a file that
     looks like a credential one in the path and prove it stays shut. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-store-refusal-"));

  CREATED.push(dir);

  const credential = path.join(dir, ".env");

  fs.writeFileSync(credential, "PROBE_SENTINEL=never-read\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "reaches-for-it.js"),
    'import { value } from "./.env";\n\nexport const value = value;\n',
    "utf8"
  );

  assert.throws(
    () => closureOf(path.join(dir, "reaches-for-it.js")),
    /is a credential file; the closure walk refuses to open it/
  );

  assert.equal(
    fs.readFileSync(credential, "utf8"),
    "PROBE_SENTINEL=never-read\n",
    "the refusal must not alter the file it refuses"
  );
});

test("the closure walk refuses the accounts file the same way", () => {
  /* The second credential name has to be refused on the same terms as the
     first: a future reader of account metadata must not be able to drag
     the accounts store into a storage test by importing it by name. The
     name is built from the same fragments as the guard set, so the test
     and the guard cannot drift apart. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-store-refusal-"));

  CREATED.push(dir);

  const accountsName = ["ctrader", "accounts", "json"].join("-");
  const accountsFile = path.join(dir, accountsName);

  fs.writeFileSync(accountsFile, "PROBE_SENTINEL=never-read\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "reaches-for-accounts.js"),
    `import { value } from "./${accountsName}";\n\nexport const value = value;\n`,
    "utf8"
  );

  assert.throws(
    () => closureOf(path.join(dir, "reaches-for-accounts.js")),
    /is a credential file; the closure walk refuses to open it/
  );

  assert.equal(
    fs.readFileSync(accountsFile, "utf8"),
    "PROBE_SENTINEL=never-read\n",
    "the refusal must not alter the file it refuses"
  );
});

/* ============================================================
   LOAD: THE SIX-KEY SHAPE
   ============================================================ */
test("load returns the six keys in the order the store holds them", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, fullStore(), "utf8");

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(Object.keys(result), STORE_KEYS);
  assert.equal(result.connected, true);
  assert.equal(result.expiresIn, EXPIRES_IN);
});

test("load carries the stored tokens through unchanged", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, fullStore(), "utf8");

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  // Compared, never interpolated: an assertion message would print
  // whatever it was given.
  assert.equal(result.accessToken === ACCESS_TOKEN, true);
  assert.equal(result.refreshToken === REFRESH_TOKEN, true);
});

test("load keeps account order, local ids, names and createdAt", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    fullStore({
      accounts: [
        account("70000003"),
        account("70000001"),
        account("70000002"),
      ],
      activeAccountId: "70000001",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(
    result.accounts.map((entry) => entry.accountId),
    ["70000003", "70000001", "70000002"]
  );
  assert.deepEqual(
    result.accounts.map((entry) => entry.id),
    [
      "account-stored-70000003",
      "account-stored-70000001",
      "account-stored-70000002",
    ]
  );
  assert.deepEqual(
    result.accounts.map((entry) => entry.name),
    ["IC Markets 70000003", "IC Markets 70000001", "IC Markets 70000002"]
  );
  assert.deepEqual(
    result.accounts.map((entry) => entry.createdAt),
    [
      "2026-03-04T05:06:07.000Z",
      "2026-03-04T05:06:07.000Z",
      "2026-03-04T05:06:07.000Z",
    ]
  );
  assert.equal(result.activeAccountId, "70000001");
});

test("load normalizes every record to the four fields the format knows", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    fullStore({
      accounts: [
        account("70000011", {
          traderLogin: "555001",
          environment: "demo",
        }),
      ],
      activeAccountId: "70000011",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(Object.keys(result.accounts[0]).sort(), [
    "accountId",
    "createdAt",
    "id",
    "name",
  ]);
});

test("load gives a bare record a generated id and defaults", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({ accounts: [{ accountId: "70000031" }] }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.match(result.accounts[0].id, /^account-\d+-[a-z0-9]{1,6}$/);
  assert.equal(result.accounts[0].name, "Trading Account");
  assert.equal(
    typeof Date.parse(result.accounts[0].createdAt),
    "number"
  );
});

test("load drops a record that carries no account id", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [{ name: "no identifier at all" }, account("70000031")],
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(
    result.accounts.map((entry) => entry.accountId),
    ["70000031"]
  );
});

test("load coerces a padded numeric account id to trimmed text", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [{ id: "account-1", accountId: " 70000041 ", name: "x" }],
      activeAccountId: 70000041,
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.accounts[0].accountId, "70000041");
  assert.equal(result.activeAccountId, "70000041");
});

/* ============================================================
   LOAD: WHICH ACCOUNT ENDS UP ACTIVE
   ============================================================ */

test("load honours a stored selection that names a saved record", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000002",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.activeAccountId, "70000002");
});

test("load leaves an ambiguous store unselected", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [account("70000001"), account("70000002")],
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.activeAccountId, null);
});

test("load does not rescue a selection that names no saved record", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    fullStore({
      accounts: [account("70000001"), account("70000002")],
      activeAccountId: "70000099",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.activeAccountId, null);
  assert.equal(result.accounts.length, 2);
});

test("load does not select the only saved account when nothing was selected", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({ accounts: [account("70000001")] }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  // CHANGED ON PURPOSE BY TASK 2.1-e. This assertion used to pin
  // "70000001" and say a later task would remove the automatic
  // choice. That task is this one: one record in the store is a
  // fact about what the token was handed, not a decision about what
  // to trade, and an account that is active because nobody said
  // otherwise is exactly what a restart cannot tell apart from one
  // the owner picked.
  assert.equal(result.activeAccountId, null);
  assert.equal(result.accounts.length, 1);
});

/* ============================================================
   LOAD: THE LEGACY SINGLE-ACCOUNT STORE
   ============================================================ */

test("load imports a legacy top-level account as one saved record", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      connected: true,
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresIn: EXPIRES_IN,
      accountId: "70000009",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result, lines } = quiet(() => store.load());

  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].accountId, "70000009");
  assert.equal(result.accounts[0].name, "Imported Trading Account");

  // CHANGED ON PURPOSE BY TASK 2.1-e. The import stays — a historical
  // record nobody can read another way is still a record. What goes is
  // the import doubling as a selection: the top-level key was written
  // before an active account could even be chosen, so it says which
  // account the token belonged to, not which one to trade.
  assert.equal(result.activeAccountId, null);
  assert.equal(
    lines.some((line) =>
      line.includes("Migrated old single account to multi-account system")
    ),
    true,
    "the migration still says so on the console"
  );
});

test("load does not treat a legacy top-level id as a selection beside a full array", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [account("70000021"), account("70000022")],
      accountId: "70000022",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  // CHANGED ON PURPOSE BY TASK 2.1-e, and this is the shape that made
  // the inference dangerous rather than merely untidy: a half-finished
  // migration holds both a real account list and a key nobody
  // maintains, and the key used to win over the absence of a choice.
  assert.equal(result.activeAccountId, null);
  assert.equal(result.accounts.length, 2);
});

/* ============================================================
   LOAD: WHAT THE RUNTIME LOADER MAY TREAT AS A SELECTION

   Phase 2.1-e Task 4. These are the invariants the startup loader is
   held to: the only value that can make an account active is the
   `activeAccountId` the file stored, and only when it names a record
   that is really there. Anything else — nothing stored, nothing
   usable, an id that names no record — loads unselected, with every
   account record still readable and the file untouched.
   ============================================================ */

test("a sole saved account without a stored selection loads unselected", () => {
  const filePath = tempFilePath();
  const contents = { accounts: [account("70000051")] };

  fs.writeFileSync(filePath, JSON.stringify(contents), "utf8");

  assert.equal(
    Object.hasOwn(JSON.parse(read(filePath)), "activeAccountId"),
    false,
    "the fixture wrote a selection, so an absent one was never tested"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.activeAccountId, null);
  assert.deepEqual(
    result.accounts.map((entry) => entry.accountId),
    ["70000051"]
  );
});

test("several saved accounts without a stored selection load unselected", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [account("70000051"), account("70000052"), account("70000053")],
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(
    result.activeAccountId,
    null,
    "the first record in the list was made the active account"
  );
  assert.equal(result.accounts.length, 3);
});

test("an explicit null selection is respected beside a sole account", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({ accounts: [account("70000051")], activeAccountId: null }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  // A stored null is the file saying "nothing is active". It is the
  // one value a repair cannot be told apart from an absence by, which
  // is exactly why both have to mean the same thing here.
  assert.equal(result.activeAccountId, null);
  assert.equal(result.accounts.length, 1);
});

test("a blank or unusable selection loads unselected instead of guessing", () => {
  /* The sole-account store is in this table on purpose. A blank
     selection beside two records was already refused by the shared
     rule; beside exactly one record it used to be rescued by the
     inference Task 4 removed, so this second column is the one that
     can only pass a loader that selects nothing it was not told. */
  const accountLists = [
    [account("70000051"), account("70000052")],
    [account("70000051")],
  ];

  for (const accounts of accountLists) {
    for (const unusable of ["", "   ", {}, [], true, "[object Object]"]) {
      const filePath = tempFilePath();

      fs.writeFileSync(
        filePath,
        JSON.stringify({
          accounts,
          activeAccountId: unusable,
        }),
        "utf8"
      );

      const store = createCtraderStore({ filePath });
      const { result } = quiet(() => store.load());

      assert.equal(
        result.activeAccountId,
        null,
        `a stored selection of ${JSON.stringify(unusable)} beside ${accounts.length} saved account(s) was turned into an account`
      );
      assert.equal(result.accounts.length, accounts.length);
    }
  }
});

test("a dangling selection names no account and substitutes none", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [account("70000051"), account("70000052")],
      activeAccountId: "70000099",
    }),
    "utf8"
  );

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.activeAccountId, null);
  assert.equal(
    ["70000051", "70000052"].includes(result.activeAccountId),
    false,
    "another saved account was substituted for the stored selection"
  );
  assert.deepEqual(
    result.accounts.map((entry) => entry.accountId),
    ["70000051", "70000052"]
  );
});

test("the order of the account records never changes what is selected", () => {
  for (const ids of [
    ["70000061", "70000062", "70000063"],
    ["70000063", "70000062", "70000061"],
    ["70000062", "70000063", "70000061"],
  ]) {
    const selected = ids[1];
    const filePath = tempFilePath();

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        accounts: ids.map((id) => account(id)),
        activeAccountId: selected,
      }),
      "utf8"
    );

    const store = createCtraderStore({ filePath });
    const { result } = quiet(() => store.load());

    assert.deepEqual(
      result.accounts.map((entry) => entry.accountId),
      ids,
      "the records came back rearranged"
    );
    assert.equal(
      result.activeAccountId,
      selected,
      `with ${ids.join(", ")} stored, selecting ${selected} did not survive the order`
    );
  }

  // And with no selection stored, no order is enough to make one.
  for (const ids of [["70000061", "70000062"], ["70000062", "70000061"]]) {
    const filePath = tempFilePath();

    fs.writeFileSync(
      filePath,
      JSON.stringify({ accounts: ids.map((id) => account(id)) }),
      "utf8"
    );

    const store = createCtraderStore({ filePath });
    const { result } = quiet(() => store.load());

    assert.equal(result.activeAccountId, null);
  }
});

test("loading to decide selection does not rewrite the stored file", () => {
  const filePath = tempFilePath();
  const contents = JSON.stringify(
    {
      accounts: [account("70000071"), account("70000072")],
      activeAccountId: "70000099",
    },
    null,
    2
  );

  fs.writeFileSync(filePath, contents, "utf8");

  const store = createCtraderStore({ filePath });

  quiet(() => store.load());
  const { result } = quiet(() => store.load());

  assert.equal(read(filePath), contents, "loading rewrote the stored bytes");
  assert.equal(
    result.activeAccountId,
    null,
    "and a second load disagreed with the first"
  );
});

/* ============================================================
   LOAD: NOTHING WORTH READING
   ============================================================ */

test("load of a missing store reports the absence and creates nothing", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({ filePath });
  const { result, lines } = quiet(() => store.load());

  assert.equal(result, null);
  assert.equal(fs.existsSync(filePath), false);
  assert.equal(
    lines.some((line) => line.includes("No saved cTrader authentication found")),
    true
  );
});

test("load of unparseable content returns null and leaves the bytes alone", () => {
  const filePath = tempFilePath();
  const contents = '{"connected":true,"accessToken":"';

  fs.writeFileSync(filePath, contents, "utf8");

  const store = createCtraderStore({ filePath });
  const { result, lines } = quiet(() => store.load());

  assert.equal(result, null);
  assert.equal(read(filePath) === contents, true);
  assert.equal(
    lines.some((line) =>
      line.includes("Failed to load saved cTrader auth")
    ),
    true
  );
});

test("load of an empty store returns null", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, "", "utf8");

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result, null);
});

test("load of an empty object returns the six keys unselected", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, "{}", "utf8");

  const store = createCtraderStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(Object.keys(result), STORE_KEYS);
  assert.equal(result.connected, false);
  assert.equal(result.accessToken, null);
  assert.equal(result.accounts.length, 0);
  assert.equal(result.activeAccountId, null);
});

test("load ignores an accounts value that is not a list", () => {
  for (const unusable of ["not an account list", 70000001, false, null]) {
    const filePath = tempFilePath();

    fs.writeFileSync(
      filePath,
      JSON.stringify({ accounts: unusable, activeAccountId: "70000001" }),
      "utf8"
    );

    const store = createCtraderStore({ filePath });
    const { result } = quiet(() => store.load());

    assert.deepEqual(result.accounts, []);
    assert.equal(result.activeAccountId, null);
  }
});

/* ============================================================
   SAVE AND CLEAR
   ============================================================ */

test("save writes the state serialized and nothing else", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({ filePath });
  const state = {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account("70000001")],
    activeAccountId: "70000001",
  };

  const { lines } = quiet(() => store.save(state));

  assert.equal(
    read(filePath) === JSON.stringify(state, null, 2),
    true,
    "the bytes on disk are exactly the serialized state"
  );
  assert.equal(lines.some((line) => line.includes("cTrader auth saved locally")), true);
});

test("save persists whatever keys it is handed", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({ filePath });

  quiet(() =>
    store.save({
      connected: false,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      accounts: [],
      activeAccountId: null,
      writtenByAFutureMigration: true,
    })
  );

  // CHARACTERIZATION. The store is a plain serializer today: a field
  // it has never heard of survives the write and is dropped again by
  // the next load. Atomicity, splitting and migration all still have
  // to land in the task that introduces them.
  assert.deepEqual(Object.keys(JSON.parse(read(filePath))), [
    "connected",
    "accessToken",
    "refreshToken",
    "expiresIn",
    "accounts",
    "activeAccountId",
    "writtenByAFutureMigration",
  ]);
});

test("save round-trips through load without changing the state", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({ filePath });
  const state = {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account("70000001"), account("70000002")],
    activeAccountId: "70000002",
  };

  quiet(() => store.save(state));

  const { result } = quiet(() => store.load());

  assert.deepEqual(result, state);
});

test("a store whose directory is gone is reported, not created", () => {
  const filePath = path.join(tempFilePath(), "missing-parent", "ctrader-auth.json");

  const { fileSystem } = recordingFileSystem();

  const store = createCtraderStore({ filePath, fileSystem });
  const { failure, lines } = captureThrow(() => store.save(state()));

  // The chosen runtime behaviour: the store writes where it is told
  // to write and never builds a directory on the way. An
  // implementation that called mkdirSync first would either succeed
  // (leaving a state file in a directory nobody approved) or trip the
  // injected trap above, and `failure` would be null here.
  assert.equal(failure !== null, true, "a refused write was swallowed");
  assert.equal(failure.operation, "save");
  assert.equal(failure.code, "ENOENT");

  assert.equal(fs.existsSync(path.dirname(filePath)), false);
  assert.equal(fs.existsSync(filePath), false);
  assert.equal(
    lines.some((line) => line.includes(filePath)),
    false,
    "the failure log quoted the path it could not write to"
  );
});

test("clear removes the persisted state", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, fullStore(), "utf8");

  const store = createCtraderStore({ filePath });
  const { lines } = quiet(() => store.clear());

  assert.equal(fs.existsSync(filePath), false);
  assert.equal(
    lines.some((line) => line.includes("Saved cTrader auth removed")),
    true
  );
});

test("clear of a store that is already gone says so anyway", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({ filePath });
  const { lines } = quiet(() => store.clear());

  assert.equal(fs.existsSync(filePath), false);
  assert.equal(
    lines.some((line) => line.includes("Saved cTrader auth removed")),
    true,
    "CHARACTERIZATION: the notice is printed whether or not a file was there"
  );
});

/* ============================================================
   THE ATOMIC WRITE

   A direct write truncates the destination first and fills it in
   afterwards, so a crash, a full disk or a locked file in the middle
   of that window leaves the saved session as a partial file — which
   the loader then reads as "nothing saved", logging the user out of
   a broker they were connected to. These tests pin the replacement:
   the new state is serialized in full, lands in a temporary file of
   its own name, is flushed and closed, and only then is moved over
   the destination in one operation. The destination is either the
   old file or the new one, never anything in between.
   ============================================================ */

test("save performs open, write, flush, close, rename, in that order", () => {
  const filePath = tempFilePath();

  const { fileSystem, operations } = recordingFileSystem();

  const store = createCtraderStore({ filePath, fileSystem });
  const { lines } = quiet(() => store.save(state()));

  assert.deepEqual(operations(), [
    "openSync",
    "writeSync",
    "fsyncSync",
    "closeSync",
    "renameSync",
  ]);
  assert.equal(
    lines.some((line) => line.includes("cTrader auth saved locally")),
    true
  );
});

test("save never opens or truncates the destination itself", () => {
  const filePath = tempFilePath();

  const { fileSystem, targetsOf } = recordingFileSystem();

  const store = createCtraderStore({ filePath, fileSystem });
  quiet(() => store.save(state()));

  const [opened] = targetsOf("openSync");

  assert.equal(typeof opened, "string");
  assert.equal(
    opened === filePath,
    false,
    "the destination was opened for writing instead of a temporary file"
  );
  assert.equal(
    targetsOf("renameSync").some((target) => target === filePath),
    false,
    "the destination was renamed onto something else"
  );
});

test("the destination still holds the previous bytes at the moment it is replaced", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, "PREVIOUS-STATE", "utf8");

  let heldAtRename = null;

  const { fileSystem } = recordingFileSystem({
    renameSync: (from, to) => {
      heldAtRename = fs.readFileSync(to, "utf8");

      return fs.renameSync(from, to);
    },
  });

  const store = createCtraderStore({ filePath, fileSystem });
  quiet(() => store.save(state()));

  assert.equal(
    heldAtRename === "PREVIOUS-STATE",
    true,
    "the previous file was overwritten in place before the rename"
  );
  assert.equal(
    read(filePath) === JSON.stringify(state(), null, 2),
    true,
    "the replacement did not land"
  );
});

test("the temporary file is created beside the destination, never on another volume", () => {
  const filePath = tempFilePath();

  const { fileSystem, targetsOf } = recordingFileSystem();

  const store = createCtraderStore({ filePath, fileSystem });
  quiet(() => store.save(state()));

  const [opened] = targetsOf("openSync");

  assert.equal(
    path.dirname(opened) === path.dirname(filePath),
    true,
    "a temporary file elsewhere would be copied over the destination instead of moved"
  );
  assert.deepEqual(tempLeftovers(path.dirname(filePath)), []);
});

test("no two saves share a temporary name", () => {
  const filePath = tempFilePath();

  const { fileSystem, targetsOf } = recordingFileSystem();

  const store = createCtraderStore({ filePath, fileSystem });

  quiet(() => {
    store.save(state());
    store.save(state({ connected: false }));
    store.save(state({ expiresIn: 7 }));
  });

  const opened = targetsOf("openSync");

  assert.equal(opened.length, 3);
  assert.equal(
    new Set(opened).size === opened.length,
    true,
    "a fixed temporary name collides with the file the previous save left behind"
  );
  assert.equal(JSON.parse(read(filePath)).expiresIn, 7);
  assert.deepEqual(tempLeftovers(path.dirname(filePath)), []);
});

test("a short write is completed instead of reported as finished", () => {
  const filePath = tempFilePath();

  let writes = 0;

  const { fileSystem } = recordingFileSystem({
    writeSync: (handle, buffer, offset = 0, length = buffer.length - offset) => {
      writes += 1;

      return fs.writeSync(handle, buffer, offset, Math.min(7, length));
    },
  });

  const store = createCtraderStore({ filePath, fileSystem });
  quiet(() => store.save(state()));

  assert.equal(writes > 1, true, "the injected file system wrote the whole buffer at once");
  assert.equal(
    read(filePath) === JSON.stringify(state(), null, 2),
    true,
    "only the first chunk of the state reached the file"
  );
});

test("a state that cannot be serialized is refused before the filesystem is touched", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, "PREVIOUS-STATE", "utf8");

  const { fileSystem, operations } = recordingFileSystem();

  const store = createCtraderStore({ filePath, fileSystem });

  const circular = state();
  circular.accounts[0].parent = circular;

  const { failure } = captureThrow(() => store.save(circular));

  assert.equal(failure !== null, true, "an unserializable state was reported as saved");
  assert.equal(failure.operation, "save");
  assert.equal(failure.step, "serialize");
  assert.deepEqual(
    operations(),
    [],
    "the store reached for the disk before it had the complete bytes"
  );
  assert.equal(read(filePath) === "PREVIOUS-STATE", true);
});

/* Each step of the write can be the one that fails. Every one of them
   has to leave the same three things behind: the previous file intact,
   no temporary file, and a caller who was told. */

for (const step of ["openSync", "writeSync", "fsyncSync", "closeSync", "renameSync"]) {
  test(`save raises and leaves the previous file intact when ${step} fails`, () => {
    const filePath = tempFilePath();

    const previous = JSON.stringify(state({ connected: false }), null, 2);

    fs.writeFileSync(filePath, previous, "utf8");

    const injected = {
      openSync: fsFailure("EACCES"),
      writeSync: fsFailure("ENOSPC"),
      fsyncSync: fsFailure("EIO"),
      closeSync: fsFailure("EIO"),
      renameSync: fsFailure("EPERM"),
    };

    const failures = {
      ...injected,
      // The close is allowed to really close, then report failure, so
      // the handle is not left open on a platform that would then
      // refuse the cleanup for the wrong reason.
      closeSync: (handle) => {
        fs.closeSync(handle);

        throw injected.closeSync;
      },
    };

    const { fileSystem } = recordingFileSystem({ [step]: failures[step] });

    const store = createCtraderStore({ filePath, fileSystem });
    const { failure, lines } = captureThrow(() => store.save(state()));

    assert.equal(failure !== null, true, `a ${step} failure was swallowed`);
    assert.equal(failure.operation, "save");
    assert.equal(failure.code, injected[step].code);

    assert.equal(
      read(filePath) === previous,
      true,
      `a ${step} failure replaced the saved session with a partial file`
    );
    assert.deepEqual(
      tempLeftovers(path.dirname(filePath)),
      [],
      `a ${step} failure left a temporary file behind`
    );
    assert.equal(
      lines.some((line) => line.includes(path.dirname(filePath))),
      false,
      `the ${step} failure was reported with a filesystem path`
    );
  });
}

test("a cleanup that also fails does not replace the failure the caller needs", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, "PREVIOUS-STATE", "utf8");

  const { fileSystem } = recordingFileSystem({
    renameSync: fsFailure("EPERM"),
    unlinkSync: fsFailure("EBUSY"),
  });

  const store = createCtraderStore({ filePath, fileSystem });
  const { failure, lines } = captureThrow(() => store.save(state()));

  assert.equal(failure.step, "rename", "the cleanup failure was reported instead of the write failure");
  assert.equal(failure.code, "EPERM");
  assert.equal(read(filePath) === "PREVIOUS-STATE", true);

  // The temporary file could not be removed, so the store says so —
  // with a reason, and without naming where it is.
  assert.equal(tempLeftovers(path.dirname(filePath)).length, 1);
  assert.equal(
    lines.some((line) => line.includes("left behind") && line.includes("EBUSY")),
    true,
    "an undeletable temporary file was not mentioned"
  );
  assert.equal(
    lines.some((line) => line.includes(path.dirname(filePath))),
    false
  );
});

test("clear raises when the saved state cannot be removed", () => {
  const filePath = tempFilePath();

  fs.writeFileSync(filePath, fullStore(), "utf8");

  const { fileSystem } = recordingFileSystem({ unlinkSync: fsFailure("EPERM") });

  const store = createCtraderStore({ filePath, fileSystem });
  const { failure, lines } = captureThrow(() => store.clear());

  assert.equal(failure !== null, true, "a state that survived the removal was reported as gone");
  assert.equal(failure.operation, "clear");
  assert.equal(failure.code, "EPERM");
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(
    lines.some((line) => line.includes(filePath)),
    false
  );
});

test("a persistence failure names a step and a code, never a path or a token", () => {
  const filePath = tempFilePath();

  const { fileSystem } = recordingFileSystem({ renameSync: fsFailure("EPERM") });

  const store = createCtraderStore({ filePath, fileSystem });
  const { failure, lines } = captureThrow(() => store.save(state()));

  const reports = [failure.message, ...lines];

  for (const text of reports) {
    for (const forbidden of [
      filePath,
      path.dirname(filePath),
      path.basename(filePath),
      ".tmp-",
      ACCESS_TOKEN,
      REFRESH_TOKEN,
    ]) {
      assert.equal(
        text.includes(forbidden),
        false,
        `a failure report carried ${forbidden === ACCESS_TOKEN || forbidden === REFRESH_TOKEN ? "a credential" : "a filesystem location"}`
      );
    }
  }

  assert.equal(typeof failure.step, "string");
  assert.equal(failure.code, "EPERM");
});

test("the store does no asynchronous work, so two writes cannot interleave", () => {
  // The store's operations are synchronous, which is what makes an
  // overlapping write impossible: nothing between the temporary file
  // and the rename can be resumed into. A future async refactor has
  // to bring its own serialization, and this test says so out loud.
  for (const forbidden of [
    /\basync\b/,
    /\bawait\b/,
    /\.then\(/,
    /queueMicrotask/,
    /setTimeout/,
    /setImmediate/,
    /createWriteStream/,
    /fs\/promises/,
  ]) {
    assert.equal(
      forbidden.test(STORE_SOURCE),
      false,
      `the store contains ${forbidden}, which would let two writes overlap`
    );
  }
});

/* ============================================================
   OUTPUT HYGIENE
   ============================================================ */

test("no token material reaches the console from any store operation", () => {
  const filePath = tempFilePath();
  const store = createCtraderStore({ filePath });
  const lines = [];

  const collect = (...args) => {
    lines.push(args.map(toLine).join(" "));
  };

  Object.assign(console, {
    log: collect,
    info: collect,
    warn: collect,
    error: collect,
  });

  try {
    store.load();

    fs.writeFileSync(filePath, fullStore(), "utf8");
    store.load();

    store.save({
      connected: true,
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresIn: EXPIRES_IN,
      accounts: [account("70000001")],
      activeAccountId: "70000001",
    });

    store.clear();
  } finally {
    Object.assign(console, realConsole);
  }

  assert.ok(lines.length > 0, "the operations above are meant to be chatty");

  for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN]) {
    assert.equal(
      lines.some((line) => line.includes(secret)),
      false,
      "the store must summarize credentials, never print them"
    );
  }
});
