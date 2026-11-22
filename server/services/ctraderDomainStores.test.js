import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { AUTH_FILE, ACCOUNTS_FILE } from "../runtimePaths.js";

/* ============================================================
   THE TWO SCOPED STORES

   One file has held everything the backend remembers about a cTrader
   session: tokens beside account records beside a selection. Task
   2.1-d splits that into two artifacts, and this suite is the
   contract of the two stores that will read and write them:

     - the credential store, which may hold nothing but the token,
       its refresh partner and the expiry;
     - the accounts store, which may hold nothing but the saved
       account list and which of them was selected.

   The split is only safe if each store is *incapable* of persisting
   the other domain's keys, so every test below that writes a full
   session through one store checks the bytes that came out, not the
   object that went in. A store that quietly forwarded an unexpected
   key would pass a round-trip test and fail these.

   WHAT THIS SUITE DOES NOT DO. It does not migrate anything, does
   not touch the combined store that `routes/ctrader.js` still uses,
   and does not invent a selection rule: the accounts store reports
   the selection exactly as it was stored, including a dangling one,
   because deciding what a dangling selection means is the selection
   module's job and no task in this phase has scheduled changing it.

   ATOMICITY IS NOT REIMPLEMENTED HERE. The two stores delegate every
   write and every removal to `createCtraderStore`, the module Task
   2.1-c hardened. The tests therefore assert the *engine's*
   guarantees through the new entrances: the temporary file is
   opened with `wx`, the bytes are flushed and the handle closed
   before the rename, a refused rename leaves the previous file
   byte-for-byte, the failure carries a step and a code and never a
   path, and no store ever creates a directory. If a later task
   swaps the engine for a weaker write, this suite fails.

   Every store in this file lives in its own temporary directory and
   every credential in it is invented for the test, so the
   repository's two production data files are never candidates for
   I/O. The closure walk refuses them by name before opening them.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(HERE, "..");
const MODULE_FILE = path.join(HERE, "ctraderDomainStores.js");

const SELF_SOURCE = fs
  .readFileSync(path.join(HERE, "ctraderDomainStores.test.js"), "utf8")
  .replace(/\r\n/g, "\n");

// Read lazily: the module under test has not been written yet, and an
// absent file must fail an assertion rather than crash the suite.
const MODULE_SOURCE = fs.existsSync(MODULE_FILE)
  ? fs.readFileSync(MODULE_FILE, "utf8").replace(/\r\n/g, "\n")
  : null;

const ACCESS_TOKEN = "synthetic-access-token-fixture-3001";
const REFRESH_TOKEN = "synthetic-refresh-token-fixture-3002";
const ACCOUNT_NAME = "synthetic-account-name-fixture-3003";
const ACCOUNT_ID = "70000001";
const EXPIRES_IN = 86400;

const CREDENTIAL_KEYS = [
  "connected",
  "accessToken",
  "refreshToken",
  "expiresIn",
];

const ACCOUNT_KEYS = ["accounts", "activeAccountId"];

const CREATED = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-split-"));

  CREATED.push(dir);

  return dir;
}

function account(externalId = ACCOUNT_ID, overrides = {}) {
  return {
    id: `account-stored-${externalId}`,
    accountId: externalId,
    name: ACCOUNT_NAME,
    createdAt: "2026-03-04T05:06:07.000Z",
    ...overrides,
  };
}

// The whole session, as one store's caller might still hand it over.
function session(overrides = {}) {
  return {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account()],
    activeAccountId: ACCOUNT_ID,
    ...overrides,
  };
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

   Same shape as the one Task 2.1-c uses, so a test can fail exactly
   one step of the atomic write while the other steps really touch
   the disk. Recorded paths are compared, never interpolated.
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

  // Neither store is allowed to invent a store location.
  fileSystem.mkdirSync = () => {
    throw new Error("a scoped store is not allowed to create a directory");
  };

  return {
    fileSystem,
    operations: () => calls.map((call) => call.name),
    targetsOf: (name) =>
      calls.filter((call) => call.name === name).map((call) => call.target),
  };
}

function tempLeftovers(dir) {
  return fs.readdirSync(dir).filter((entry) => entry.includes(".tmp-"));
}

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

async function stores() {
  assert.ok(
    MODULE_SOURCE !== null,
    "server/services/ctraderDomainStores.js has not been written yet"
  );

  return import(pathToFileURL(MODULE_FILE).href);
}

function moduleSource() {
  assert.ok(
    MODULE_SOURCE !== null,
    "server/services/ctraderDomainStores.js has not been written yet"
  );

  return MODULE_SOURCE;
}

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

after(() => {
  for (const dir of CREATED) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ============================================================
   THE TWO ENTRANCES
   ============================================================ */

test("the module builds both stores without touching the filesystem", async () => {
  const api = await stores();
  const { fileSystem, operations } = recordingFileSystem();

  const { result } = quiet(() => {
    const credentials = api.createCtraderAuthStore({
      filePath: path.join(tempDir(), "credentials.json"),
      fileSystem,
    });

    const accounts = api.createCtraderAccountsStore({
      filePath: path.join(tempDir(), "accounts.json"),
      fileSystem,
    });

    return { credentials, accounts };
  });

  assert.equal(operations().length, 0, "constructing a store performed I/O");
  assert.equal(result.credentials.filePath.length > 0, true);
  assert.equal(typeof result.credentials.load, "function");
  assert.equal(typeof result.accounts.load, "function");
});

test("each store exposes the four operations a caller needs", async () => {
  const api = await stores();
  const { fileSystem } = recordingFileSystem();

  for (const build of [
    ["createCtraderAuthStore", path.join(tempDir(), "credentials.json")],
    ["createCtraderAccountsStore", path.join(tempDir(), "accounts.json")],
  ]) {
    const [name, filePath] = build;

    const store = api[name]({ filePath, fileSystem });

    assert.deepEqual(Object.keys(store).sort(), [
      "clear",
      "filePath",
      "load",
      "save",
    ]);
    assert.equal(store.filePath, filePath);
  }
});

test("the credential store defaults to the file that holds the token", async () => {
  const api = await stores();
  const { fileSystem } = recordingFileSystem();

  const store = api.createCtraderAuthStore({ fileSystem });

  assert.equal(store.filePath, AUTH_FILE);
  assert.notEqual(store.filePath, ACCOUNTS_FILE);
});

test("the accounts store defaults to the file that holds the account list", async () => {
  const api = await stores();
  const { fileSystem } = recordingFileSystem();

  const store = api.createCtraderAccountsStore({ fileSystem });

  assert.equal(store.filePath, ACCOUNTS_FILE);
  assert.notEqual(store.filePath, AUTH_FILE);
});

/* ============================================================
   WHAT EACH STORE MAY PERSIST
   ============================================================ */

test("the credential store cannot persist account metadata", async () => {
  const api = await stores();
  const filePath = path.join(tempDir(), "credentials.json");
  const store = api.createCtraderAuthStore({ filePath });

  quiet(() => store.save(session()));

  const written = JSON.parse(read(filePath));

  assert.deepEqual(Object.keys(written), CREDENTIAL_KEYS);
  assert.equal(
    read(filePath).includes(ACCOUNT_NAME),
    false,
    "an account name reached the credential file"
  );
  assert.equal(read(filePath).includes(ACCOUNT_ID), false);
});

test("the accounts store cannot persist a credential", async () => {
  const api = await stores();
  const filePath = path.join(tempDir(), "accounts.json");
  const store = api.createCtraderAccountsStore({ filePath });

  quiet(() => store.save(session()));

  const written = JSON.parse(read(filePath));

  assert.deepEqual(Object.keys(written), ACCOUNT_KEYS);
  assert.equal(
    read(filePath).includes(ACCESS_TOKEN),
    false,
    "an access token reached the accounts file"
  );
  assert.equal(read(filePath).includes(REFRESH_TOKEN), false);
  assert.equal(written.connected, undefined, "the accounts file holds a flag");
});

test("the credential store reads the four keys and no more", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "credentials.json");

  fs.writeFileSync(filePath, JSON.stringify(session()), "utf8");

  const store = api.createCtraderAuthStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(Object.keys(result), CREDENTIAL_KEYS);
  assert.equal(result.accessToken, ACCESS_TOKEN);
  assert.equal(result.refreshToken, REFRESH_TOKEN);
  assert.equal(result.expiresIn, EXPIRES_IN);
  assert.equal(result.connected, true);
  assert.equal(result.accounts, undefined);
  assert.equal(result.activeAccountId, undefined);
});

test("the accounts store reads the two keys and keeps every field", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  const stored = {
    accounts: [
      account("70000001"),
      account("70000002", { name: "Second" }),
    ],
    activeAccountId: "70000002",
  };

  fs.writeFileSync(filePath, JSON.stringify(stored), "utf8");

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(Object.keys(result), ACCOUNT_KEYS);
  assert.deepEqual(result.accounts, stored.accounts);
  assert.equal(result.activeAccountId, "70000002");
});

test("a store pointed at the other domain's file finds nothing", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "shared.json");

  quiet(() =>
    api.createCtraderAccountsStore({ filePath }).save(session())
  );

  const { result } = quiet(() =>
    api.createCtraderAuthStore({ filePath }).load()
  );

  assert.deepEqual(Object.keys(result), CREDENTIAL_KEYS);
  assert.equal(result.connected, false);
  assert.equal(result.accessToken, null);
  assert.equal(result.refreshToken, null);
  assert.equal(result.expiresIn, null);

  quiet(() =>
    api.createCtraderAuthStore({ filePath }).save(session())
  );

  const other = quiet(() =>
    api.createCtraderAccountsStore({ filePath }).load()
  );

  assert.deepEqual(other.result.accounts, []);
  assert.equal(other.result.activeAccountId, null);
});

/* ============================================================
   THE ACCOUNTS STORE INVENTS NOTHING
   ============================================================ */

test("the accounts store keeps a record whose fields are missing", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  const stored = [{ accountId: ACCOUNT_ID }];

  fs.writeFileSync(
    filePath,
    JSON.stringify({ accounts: stored, activeAccountId: null }),
    "utf8"
  );

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(result.accounts, stored);
  assert.equal(
    "id" in result.accounts[0],
    false,
    "the accounts store generated a local id Task 2.1-c forbids inventing"
  );
  assert.equal("createdAt" in result.accounts[0], false);
  assert.equal(result.accounts[0].name, undefined);
});

test("the accounts store drops a record with no account id", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [
        account(),
        { accountId: "   " },
        { name: "No id at all" },
        null,
      ],
      activeAccountId: ACCOUNT_ID,
    }),
    "utf8"
  );

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].accountId, ACCOUNT_ID);
});

test("the accounts store never selects a sole account on the caller's behalf", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  fs.writeFileSync(
    filePath,
    JSON.stringify({ accounts: [account()], activeAccountId: null }),
    "utf8"
  );

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.accounts.length, 1);
  assert.equal(
    result.activeAccountId,
    null,
    "a sole saved account was selected without anyone asking"
  );
});

test("the accounts store reports a dangling selection as stored", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  fs.writeFileSync(
    filePath,
    JSON.stringify({
      accounts: [account()],
      activeAccountId: "70000999",
    }),
    "utf8"
  );

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.equal(result.activeAccountId, "70000999");
});

test("the accounts store reads an absent account list as empty", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  fs.writeFileSync(filePath, JSON.stringify({ activeAccountId: null }), "utf8");

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(result.accounts, []);
  assert.equal(result.activeAccountId, null);
});

test("the accounts store ignores an account value that is not a list", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "accounts.json");

  fs.writeFileSync(
    filePath,
    JSON.stringify({ accounts: "not a list", activeAccountId: ACCOUNT_ID }),
    "utf8"
  );

  const store = api.createCtraderAccountsStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(result.accounts, []);
});

/* ============================================================
   ABSENT AND CORRUPT FILES
   ============================================================ */

test("a store of a missing file reports the absence and creates nothing", async () => {
  const api = await stores();
  const dir = tempDir();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(dir, `${name}.json`);
    const store = api[name]({ filePath });

    const { result } = quiet(() => store.load());

    assert.equal(result, null, `${name} invented a state for a missing file`);
    assert.equal(fs.existsSync(filePath), false);
  }
});

test("a store of unparseable content returns null and leaves the bytes alone", async () => {
  const api = await stores();
  const dir = tempDir();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(dir, `${name}.json`);

    fs.writeFileSync(filePath, "{ not json", "utf8");

    const store = api[name]({ filePath });
    const { result } = quiet(() => store.load());

    assert.equal(result, null);
    assert.equal(read(filePath), "{ not json");
  }
});

test("a store of content that is not an object reports nothing readable", async () => {
  const api = await stores();
  const dir = tempDir();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(dir, `${name}-scalar.json`);

    fs.writeFileSync(filePath, "null", "utf8");

    const store = api[name]({ filePath });
    const { result } = quiet(() => store.load());

    assert.equal(result, null);
  }
});

test("the credential store reports an empty file as disconnected", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "credentials.json");

  fs.writeFileSync(filePath, JSON.stringify({}), "utf8");

  const store = api.createCtraderAuthStore({ filePath });
  const { result } = quiet(() => store.load());

  assert.deepEqual(Object.keys(result), CREDENTIAL_KEYS);
  assert.equal(result.connected, false);
  assert.equal(result.accessToken, null);
});

/* ============================================================
   THE ATOMIC WRITE IS THE ONE TASK 2.1-C HARDENED
   ============================================================ */

test("each store performs open, write, flush, close, rename, in that order", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(tempDir(), `${name}.json`);
    const { fileSystem, operations } = recordingFileSystem();

    const store = api[name]({ filePath, fileSystem });

    quiet(() => store.save(session()));

    assert.deepEqual(
      operations().filter((call) =>
        ["openSync", "writeSync", "fsyncSync", "closeSync", "renameSync"].includes(
          call
        )
      ),
      ["openSync", "writeSync", "fsyncSync", "closeSync", "renameSync"],
      `${name} no longer writes through the atomic engine`
    );
  }
});

test("no store ever opens or truncates the destination itself", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(tempDir(), `${name}.json`);
    const { fileSystem, targetsOf } = recordingFileSystem();

    const store = api[name]({ filePath, fileSystem });

    quiet(() => store.save(session()));

    for (const target of targetsOf("openSync")) {
      assert.notEqual(target, filePath, `${name} opened the destination`);
      assert.equal(target.includes(".tmp-"), true);
    }
  }
});

test("the destination still holds the previous bytes when the rename is refused", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const dir = tempDir();
    const filePath = path.join(dir, `${name}.json`);

    fs.writeFileSync(filePath, "PREVIOUS BYTES", "utf8");

    const { fileSystem } = recordingFileSystem({
      renameSync: fsFailure("EPERM"),
    });

    const store = api[name]({ filePath, fileSystem });
    const { failure } = captureThrow(() => store.save(session()));

    assert.equal(read(filePath), "PREVIOUS BYTES");
    assert.deepEqual(tempLeftovers(dir), []);
    assert.equal(failure.operation, "save");
    assert.equal(failure.step, "rename");
    assert.equal(failure.code, "EPERM");
  }
});

test("a persistence failure never carries a path or a credential", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const dir = tempDir();
    const filePath = path.join(dir, `${name}.json`);
    const { fileSystem } = recordingFileSystem({
      renameSync: fsFailure("EACCES"),
    });

    const store = api[name]({ filePath, fileSystem });
    const { failure } = captureThrow(() => store.save(session()));

    assert.equal(failure.message.includes(dir), false);
    assert.equal(failure.message.includes(ACCESS_TOKEN), false);
    assert.equal(failure.message.includes(ACCOUNT_ID), false);
  }
});

test("a missing parent directory is reported, never created", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const dir = tempDir();
    const missing = path.join(dir, "not-created");
    const filePath = path.join(missing, "store.json");

    const store = api[name]({ filePath });
    const { failure } = captureThrow(() => store.save(session()));

    assert.equal(failure.code, "ENOENT");
    assert.equal(failure.step, "open");
    assert.equal(fs.existsSync(missing), false, `${name} created a directory`);
  }
});

test("no two saves of one store share a temporary name", async () => {
  const api = await stores();
  const dir = tempDir();
  const filePath = path.join(dir, "credentials.json");
  const { fileSystem, targetsOf } = recordingFileSystem();

  const store = api.createCtraderAuthStore({ filePath, fileSystem });

  quiet(() => {
    store.save(session());
    store.save(session({ accessToken: "second" }));
  });

  const names = targetsOf("renameSync");

  assert.equal(names.length, 2);
  assert.equal(new Set(names).size, 2);
});

test("clear removes one store's file and leaves the other alone", async () => {
  const api = await stores();
  const dir = tempDir();
  const credentialsPath = path.join(dir, "credentials.json");
  const accountsPath = path.join(dir, "accounts.json");

  fs.writeFileSync(credentialsPath, JSON.stringify(session()), "utf8");
  fs.writeFileSync(accountsPath, JSON.stringify(session()), "utf8");

  quiet(() => api.createCtraderAuthStore({ filePath: credentialsPath }).clear());

  assert.equal(fs.existsSync(credentialsPath), false);
  assert.equal(fs.existsSync(accountsPath), true);

  quiet(() => api.createCtraderAccountsStore({ filePath: accountsPath }).clear());

  assert.equal(fs.existsSync(accountsPath), false);
});

test("clear of a store that is already gone is the outcome asked for", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(tempDir(), `${name}.json`);
    const store = api[name]({ filePath });

    const { failure } = captureThrow(() => store.clear());

    assert.equal(failure, null);
  }
});

test("no credential value reaches the console from either store", async () => {
  const api = await stores();

  for (const name of ["createCtraderAuthStore", "createCtraderAccountsStore"]) {
    const filePath = path.join(tempDir(), `${name}.json`);
    const store = api[name]({ filePath });

    const captured = [];

    for (const step of [
      () => store.save(session()),
      () => store.load(),
      () => store.clear(),
    ]) {
      captured.push(...quiet(step).lines);
    }

    const text = captured.join("\n");

    assert.equal(text.includes(ACCESS_TOKEN), false);
    assert.equal(text.includes(REFRESH_TOKEN), false);
  }
});

test("a store is synchronous, so two writes cannot interleave", async () => {
  const api = await stores();
  const filePath = path.join(tempDir(), "accounts.json");
  const store = api.createCtraderAccountsStore({ filePath });

  const returned = quiet(() => store.save(session())).result;

  assert.equal(returned, undefined);
  assert.equal(
    typeof quiet(() => store.load()).result.then,
    "undefined"
  );
});

/* ============================================================
   SOURCE CONTRACTS
   ============================================================ */

test("the scoped stores reuse the store Task 2.1-c hardened", () => {
  assert.deepEqual(
    importSpecifiers(moduleSource()).sort(),
    ["../runtimePaths.js", "./ctraderStore.js", "fs"]
  );
});

test("neither file name is spelled out beside a directory in the module", () => {
  const text = moduleSource();

  assert.equal(
    /["'`]ctrader-auth\.json/.test(text),
    false,
    "the credential name is spelled out in the module"
  );
  assert.equal(
    /["'`]ctrader-accounts\.json/.test(text),
    false,
    "the accounts name is spelled out in the module"
  );
  assert.equal(/path\.join\(/.test(text), false);
  assert.equal(/process\.cwd\(/.test(text), false);
});

test("the module names both scoped paths it takes as defaults", () => {
  const text = moduleSource();

  assert.equal(/AUTH_FILE/.test(text), true);
  assert.equal(/ACCOUNTS_FILE/.test(text), true);
  assert.equal(
    /createCtraderStore\(/.test(text),
    true,
    "the module writes without delegating to the atomic engine"
  );
});

test("the closure of the scoped stores holds storage and the engine, nothing else", () => {
  // Ask for the module first, so its absence is reported as a missing
  // deliverable rather than as a filesystem error from the walk.
  moduleSource();

  const names = [...closureOf(MODULE_FILE)]
    .map((file) => path.relative(SERVER_DIR, file).split(path.sep).join("/"))
    .sort();

  assert.deepEqual(names, [
    "brokers/identity.js",
    "runtimePaths.js",
    "services/ctraderAccountSelection.js",
    "services/ctraderDomainStores.js",
    "services/ctraderStore.js",
  ]);
});

test("the closure walk refuses a credential file instead of opening it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "split-refusal-"));

  CREATED.push(dir);

  for (const name of [
    ".env",
    ["ctrader", "auth", "json"].join("-"),
    ["ctrader", "accounts", "json"].join("-"),
  ]) {
    const credential = path.join(dir, name);

    fs.writeFileSync(credential, "PROBE_SENTINEL=never-read\n", "utf8");

    const reacher = path.join(dir, `reaches-for-${name}`);

    fs.writeFileSync(
      reacher,
      `import { value } from "./${name}";\n\nexport const value = value;\n`,
      "utf8"
    );

    assert.throws(
      () => closureOf(reacher),
      /is a credential file; the closure walk refuses to open it/,
      `the walk opened a file named ${name}`
    );

    assert.equal(
      fs.readFileSync(credential, "utf8"),
      "PROBE_SENTINEL=never-read\n"
    );
  }
});

test("the accounts file is a credential for the walk even beside a case", () => {
  assert.equal(
    SECRET_BEARING_NAMES.has(["ctrader", "accounts", "json"].join("-")),
    true
  );
  assert.equal(
    SECRET_BEARING_NAMES.has(["ctrader", "auth", "json"].join("-")),
    true
  );
});

test("this suite imports nothing but the module under test and Node", () => {
  assert.deepEqual(importSpecifiers(SELF_SOURCE).sort(), [
    "../runtimePaths.js",
    "node:assert/strict",
    "node:fs",
    "node:os",
    "node:path",
    "node:test",
    "node:url",
  ]);
});
