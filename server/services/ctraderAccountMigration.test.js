import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCtraderStore } from "./ctraderStore.js";
import { createCtraderAccountsStore, createCtraderAuthStore } from "./ctraderDomainStores.js";

const moduleUrl = new URL("./ctraderAccountMigration.js", import.meta.url);
const api = fs.existsSync(fileURLToPath(moduleUrl)) ? await import(moduleUrl.href) : {};
const TOKEN = "invented-migration-access-token";
const REFRESH = "invented-migration-refresh-token";
const row = (id) => ({
  id: `local-${id}`,
  accountId: id,
  name: `Fixture ${id}`,
  createdAt: "2026-01-02T03:04:05.000Z",
});
const state = (overrides = {}) => ({
  connected: true,
  accessToken: TOKEN,
  refreshToken: REFRESH,
  expiresIn: 86400,
  accounts: [row("7001"), row("7002")],
  activeAccountId: "7002",
  ...overrides,
});

function fixture(t, legacy = JSON.stringify(state()), destination) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "account-migration-fixture-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const legacyFilePath = path.join(dir, "legacy-state.fixture.json");
  const accountsFilePath = path.join(dir, "accounts-state.fixture.json");
  if (legacy !== null) fs.writeFileSync(legacyFilePath, legacy);
  if (destination !== undefined) fs.writeFileSync(accountsFilePath, destination);
  const logs = [];
  for (const method of ["log", "info", "warn", "error"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  return {
    dir, legacyFilePath, accountsFilePath, logs,
    options: { legacyFilePath, accountsFilePath },
    readAccounts: () => JSON.parse(fs.readFileSync(accountsFilePath, "utf8")),
  };
}

function migrate(options) {
  assert.equal(typeof api.migrateLegacyAccounts, "function", "migration API is not implemented");
  return api.migrateLegacyAccounts(options);
}

function assertSourceUnchanged(f, before) {
  assert.ok(fs.readFileSync(f.legacyFilePath).equals(before), "legacy source bytes changed");
}

function safeFailure(action, stage) {
  assert.throws(action, (error) => {
    assert.equal(error.code, "CTRADER_MIGRATION_FAILED");
    assert.equal(error.stage, stage);
    assert.equal(error.message, `cTrader account migration failed (${stage})`);
    assert.equal(Object.hasOwn(error, "cause"), false);
    return true;
  });
}

function injectedFailure(code = "EACCES") {
  return Object.assign(new Error(`unsafe fixture text ${TOKEN} ${REFRESH}`), { code });
}

test("copies multiple accounts with all metadata and only the accounts projection", (t) => {
  const input = state({ accounts: [{ ...row("7001"), accessToken: TOKEN }, row("7002")] });
  const f = fixture(t, JSON.stringify(input, null, 4) + "\n");
  const before = fs.readFileSync(f.legacyFilePath);
  assert.equal(migrate(f.options), "migrated");
  assert.deepEqual(f.readAccounts(), { accounts: [row("7001"), row("7002")], activeAccountId: "7002" });
  assertSourceUnchanged(f, before);
  assert.equal(fs.readFileSync(f.accountsFilePath, "utf8").includes(TOKEN), false);
  assert.equal(fs.readFileSync(f.accountsFilePath, "utf8").includes(REFRESH), false);
  const auth = createCtraderAuthStore({ filePath: f.legacyFilePath }).load();
  assert.equal(auth.accessToken === TOKEN, true);
  assert.equal(auth.refreshToken === REFRESH, true);
});

for (const [name, activeAccountId] of [
  ["explicit", "7002"], ["null", null], ["dangling", "7999"],
  ["numeric", 7002], ["padded", " 7002 "],
]) {
  test(`preserves ${name} active account selection`, (t) => {
    const f = fixture(t, JSON.stringify(state({ activeAccountId })));
    assert.equal(migrate(f.options), "migrated");
    assert.equal(f.readAccounts().activeAccountId, activeAccountId);
  });
}

test("does not select a sole account when the selection is absent", (t) => {
  const input = state({ accounts: [row("7001")] });
  delete input.activeAccountId;
  const f = fixture(t, JSON.stringify(input));
  migrate(f.options);
  assert.equal(f.readAccounts().activeAccountId, null);
  assert.deepEqual(f.readAccounts().accounts, input.accounts);
});

test("imports a legacy top-level account without using it as selection", (t) => {
  const f = fixture(t, JSON.stringify({ accountId: "7001", accessToken: TOKEN }));
  migrate(f.options);
  const result = f.readAccounts();
  assert.equal(result.activeAccountId, null);
  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].accountId, "7001");
});

test("copies an explicitly stored empty account list, not invented defaults", (t) => {
  const f = fixture(t, JSON.stringify(state({ accounts: [], activeAccountId: null })));
  migrate(f.options);
  assert.deepEqual(f.readAccounts(), { accounts: [], activeAccountId: null });
});

for (const [name, accountId] of [
  ["object", {}], ["array", ["7001"]], ["empty array", []],
  ["true", true], ["false", false],
]) {
  test(`empty legacy accounts with a malformed ${name} fallback create nothing`, (t) => {
    const f = fixture(t, JSON.stringify(state({ accounts: [], accountId })));
    const before = fs.readFileSync(f.legacyFilePath);
    assert.equal(migrate(f.options), "legacy-invalid");
    assert.equal(fs.existsSync(f.accountsFilePath), false);
    assertSourceUnchanged(f, before);
  });
}

test("empty legacy accounts still import a valid top-level fallback without selection", (t) => {
  const f = fixture(t, JSON.stringify({ accounts: [], accountId: "7001", activeAccountId: null }));
  assert.equal(migrate(f.options), "migrated");
  const result = f.readAccounts();
  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].accountId, "7001");
  assert.equal(result.activeAccountId, null);
});

test("empty legacy accounts with a blank top-level fallback stay empty", (t) => {
  const f = fixture(t, JSON.stringify({ accounts: [], accountId: " ", activeAccountId: null }));
  assert.equal(migrate(f.options), "migrated");
  assert.deepEqual(f.readAccounts(), { accounts: [], activeAccountId: null });
});

test("an existing valid destination is preserved without consulting legacy storage", (t) => {
  const destination = JSON.stringify({ accounts: [row("8001")], activeAccountId: "8999" }, null, 4);
  const f = fixture(t, "not JSON", destination);
  const fileSystem = {
    ...fs,
    readFileSync(file, ...args) {
      assert.notEqual(file, f.legacyFilePath, "an existing destination must bypass legacy reading");
      return fs.readFileSync(file, ...args);
    },
  };
  assert.equal(migrate({ ...f.options, fileSystem }), "destination-present");
  assert.ok(fs.readFileSync(f.accountsFilePath).equals(Buffer.from(destination)));
});

for (const [name, destination] of [
  ["broken JSON", `{"secret":"${TOKEN}",`],
  ["null", "null"], ["array", "[]"], ["empty object", "{}"],
  ["missing selection", '{"accounts":[]}'],
  ["wrong accounts type", '{"accounts":{},"activeAccountId":null}'],
  ["invalid row", '{"accounts":[null],"activeAccountId":null}'],
  ["missing account id", '{"accounts":[{"name":"fixture"}],"activeAccountId":null}'],
  ["object selection", '{"accounts":[],"activeAccountId":{}}'],
  ["credential field", JSON.stringify({ accounts: [], activeAccountId: null, accessToken: TOKEN })],
]) {
  test(`fails closed for an existing destination with ${name}`, (t) => {
    const f = fixture(t, JSON.stringify(state()), destination);
    const before = fs.readFileSync(f.legacyFilePath);
    safeFailure(() => migrate(f.options), "destination-invalid");
    assert.ok(fs.readFileSync(f.accountsFilePath).equals(Buffer.from(destination)));
    assertSourceUnchanged(f, before);
    assert.equal(JSON.stringify(f.logs).includes(TOKEN), false);
  });
}

test("unreadable existing destination fails closed without source reads or overwrite", (t) => {
  const f = fixture(t, JSON.stringify(state()), '{"accounts":[],"activeAccountId":null}');
  const before = fs.readFileSync(f.accountsFilePath);
  const fileSystem = { ...fs, readFileSync() { throw injectedFailure(); } };
  safeFailure(() => migrate({ ...f.options, fileSystem }), "destination-read");
  assert.ok(fs.readFileSync(f.accountsFilePath).equals(before));
  assert.equal(JSON.stringify(f.logs).includes(TOKEN), false);
});

test("destination inspection permission errors are not mistaken for absence", (t) => {
  const f = fixture(t);
  const fileSystem = { ...fs, lstatSync() { throw injectedFailure(); } };
  safeFailure(() => migrate({ ...f.options, fileSystem }), "destination-read");
  assert.equal(fs.existsSync(f.accountsFilePath), false);
});

test("a directory at the destination is not overwritten or treated as missing", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.accountsFilePath);
  safeFailure(() => migrate(f.options), "destination-invalid");
  assert.equal(fs.statSync(f.accountsFilePath).isDirectory(), true);
});

test("missing legacy storage creates nothing", (t) => {
  const f = fixture(t, null);
  assert.equal(migrate(f.options), "legacy-missing");
  assert.deepEqual(fs.readdirSync(f.dir), []);
});

for (const [name, legacy] of [
  ["broken JSON", `{"accessToken":"${TOKEN}",`],
  ["null", "null"], ["array", "[]"], ["scalar", "42"],
  ["empty object", "{}"], ["wrong account list", '{"accounts":"broken"}'],
  ["invalid account row", '{"accounts":[null]}'],
  ["nested metadata", JSON.stringify(state({ accounts: [{ ...row("7001"), name: { accessToken: TOKEN } }] }))],
]) {
  test(`corrupt legacy source (${name}) creates no destination`, (t) => {
    const f = fixture(t, legacy);
    const before = fs.readFileSync(f.legacyFilePath);
    assert.equal(migrate(f.options), "legacy-invalid");
    assert.equal(fs.existsSync(f.accountsFilePath), false);
    assertSourceUnchanged(f, before);
    assert.equal(JSON.stringify(f.logs).includes(TOKEN), false);
  });
}

test("unreadable legacy source aborts safely without inventing accounts", (t) => {
  const f = fixture(t);
  const fileSystem = { ...fs, readFileSync() { throw injectedFailure(); } };
  safeFailure(() => migrate({ ...f.options, fileSystem }), "legacy-read");
  assert.equal(fs.existsSync(f.accountsFilePath), false);
});

for (const operation of ["openSync", "writeSync", "fsyncSync", "linkSync"]) {
  test(`propagates safe write failure from ${operation} without changing the source`, (t) => {
    const f = fixture(t);
    const before = fs.readFileSync(f.legacyFilePath);
    const fileSystem = { ...fs, [operation]() { throw injectedFailure(); } };
    safeFailure(() => migrate({ ...f.options, fileSystem }), "write");
    assertSourceUnchanged(f, before);
    assert.equal(fs.existsSync(f.accountsFilePath), false);
    assert.deepEqual(fs.readdirSync(f.dir), [path.basename(f.legacyFilePath)]);
    assert.equal(JSON.stringify(f.logs).includes(TOKEN), false);
  });
}

test("does not create missing parent directories or backups", (t) => {
  const f = fixture(t);
  const parent = path.join(f.dir, "missing-parent");
  safeFailure(() => migrate({ ...f.options, accountsFilePath: path.join(parent, "accounts.fixture.json") }), "write");
  assert.equal(fs.existsSync(parent), false);
  assert.deepEqual(fs.readdirSync(f.dir), [path.basename(f.legacyFilePath)]);
});

test("does not replace a destination created concurrently before publication", (t) => {
  const f = fixture(t);
  const winner = Buffer.from('{"accounts":[],"activeAccountId":"concurrent"}');
  const fileSystem = {
    ...fs,
    linkSync(source, destination) {
      fs.writeFileSync(destination, winner, { flag: "wx" });
      return fs.linkSync(source, destination);
    },
  };
  safeFailure(() => migrate({ ...f.options, fileSystem }), "write");
  assert.ok(fs.readFileSync(f.accountsFilePath).equals(winner));
  assert.equal(fs.readdirSync(f.dir).some((name) => name.includes(".tmp-")), false);
});

test("repeated migration never updates a completed destination", (t) => {
  const f = fixture(t);
  assert.equal(migrate(f.options), "migrated");
  const before = fs.readFileSync(f.accountsFilePath);
  fs.writeFileSync(f.legacyFilePath, JSON.stringify(state({ accounts: [row("9001")] })));
  assert.equal(migrate(f.options), "destination-present");
  assert.ok(fs.readFileSync(f.accountsFilePath).equals(before));
});

test("does not mutate frozen options or source input", (t) => {
  const input = Object.freeze(state({ accounts: Object.freeze([Object.freeze(row("7001"))]) }));
  const serialized = JSON.stringify(input);
  const f = fixture(t, serialized);
  const options = Object.freeze({ ...f.options });
  migrate(options);
  assert.equal(JSON.stringify(input) === serialized, true);
  assert.deepEqual(options, f.options);
  assert.ok(fs.readFileSync(f.legacyFilePath).equals(Buffer.from(serialized)));
});

test("reads one immutable legacy snapshot for validation and normalization", (t) => {
  const f = fixture(t);
  let reads = 0;
  const fileSystem = {
    ...fs,
    readFileSync(file, ...args) {
      if (file === f.legacyFilePath) assert.equal(++reads, 1, "legacy source was reread after validation");
      return fs.readFileSync(file, ...args);
    },
  };
  migrate({ ...f.options, fileSystem });
  assert.equal(reads, 1);
});

test("migration logs only the authored outcome and never source values", (t) => {
  const f = fixture(t);
  migrate(f.options);
  assert.deepEqual(f.logs, [["cTrader account migration: migrated"]]);
});

test("migration cannot use the legacy source as its destination", (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.legacyFilePath);
  safeFailure(() => migrate({ ...f.options, accountsFilePath: f.legacyFilePath }), "paths");
  assertSourceUnchanged(f, before);
});

test("the legacy loader supports injected logging without leaking parse errors", (t) => {
  const f = fixture(t, `{"accessToken":"${TOKEN}",`);
  const logs = [];
  const logger = { log: (...args) => logs.push(args), error: (...args) => logs.push(args) };
  const store = createCtraderStore({ filePath: f.legacyFilePath, selectionPolicy: "preserve-explicit", logger });
  assert.equal(store.load(), null);
  assert.ok(logs.length > 0, "the supplied logger was ignored");
  assert.deepEqual(f.logs, []);
});

test("the accounts store forwards injected logging to its atomic writer", (t) => {
  const f = fixture(t, null);
  const logs = [];
  const logger = { log: (...args) => logs.push(args), error: (...args) => logs.push(args) };
  const store = createCtraderAccountsStore({ filePath: f.accountsFilePath, logger });
  store.save({ accounts: [], activeAccountId: null });
  assert.ok(logs.length > 0, "the supplied writer logger was ignored");
  assert.deepEqual(f.logs, []);
});
