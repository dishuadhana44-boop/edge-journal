import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

// Lazy VM linking makes missing wiring fail behavior assertions, not host imports.
const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
const sourcePaths = Object.fromEntries(
  [
    ["route", "routes/ctrader.js"],
    ["migration", "services/ctraderAccountMigration.js"],
    ["projection", "services/ctraderMigrationProjection.js"],
    ["domains", "services/ctraderDomainStores.js"],
    ["combined", "services/ctraderStore.js"],
    ["selection", "services/ctraderAccountSelection.js"],
  ].map(([name, relative]) => [name, path.resolve(serverDirectory, relative)])
);
const sourceAllowlist = new Set(Object.values(sourcePaths));
const runtimePaths = path.resolve(serverDirectory, "runtimePaths.js");
const servicePath = path.resolve(serverDirectory, "services/ctraderService.js");
const broadcastPath = path.resolve(serverDirectory, "services/websocketService.js");
const identityPath = path.resolve(serverDirectory, "brokers/identity.js");
const serviceExports = [
  "startCTraderService",
  "stopCTraderService",
  "placeMarketOrder",
  "closePosition",
  "amendPositionSLTP",
  "getOpenPositions",
  "resolvePositionSymbolId",
  "getAvailableSymbols",
  "resolveOrderSymbolTarget",
  "getCTraderServiceStatus",
  "buildExecutionBroadcastMessage",
];
const accessToken = "synthetic-startup-access-not-a-credential";
const refreshToken = "synthetic-startup-refresh-not-a-credential";

function account(accountId) {
  return {
    id: `fixture-${accountId}`,
    accountId,
    name: `Fixture ${accountId}`,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

function legacyState(activeAccountId = "101") {
  return {
    connected: true,
    accessToken,
    refreshToken,
    expiresIn: 3600,
    accounts: [account("101")],
    activeAccountId,
  };
}

function fixture(t, { legacy = legacyState(), destination } = {}) {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-startup-copy-"))
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const paths = {
    directory,
    legacy: path.join(directory, "legacy.fixture.json"),
    destination: path.join(directory, "accounts.fixture.json"),
  };
  for (const [target, value] of [
    [paths.legacy, legacy],
    [paths.destination, destination],
  ]) {
    if (value !== undefined && value !== null) {
      fs.writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
    }
  }
  return paths;
}

function filesystemGuard(paths, events, violations, faults) {
  const handles = new Map();
  const refuse = () => {
    violations.push("filesystem");
    throw Object.assign(new Error("Filesystem operation outside test capabilities"), {
      code: "HARNESS_FILESYSTEM",
    });
  };
  const targetName = (target) =>
    target === paths.legacy
      ? "legacy"
      : target === paths.destination
        ? "destination"
        : target.startsWith(`${paths.destination}.tmp-`)
          ? "temporary"
          : "scratch";

  function checkedPath(value) {
    if (value instanceof URL) value = fileURLToPath(value);
    if (typeof value !== "string" || !path.isAbsolute(value)) return refuse();
    const resolved = path.resolve(value);
    const relative = path.relative(paths.directory, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return refuse();
    }
    // Lexical confinement alone would not stop a symlink escaping scratch.
    let cursor = paths.directory;
    for (const part of relative.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      try {
        if (fs.lstatSync(cursor).isSymbolicLink()) return refuse();
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return resolved;
  }

  function mark(operation, target) {
    // Stack inspection distinguishes the two readers without replacing either.
    const normalLoader = /\bat loadSavedAuth \(/.test(new Error().stack);
    const event = { kind: "filesystem", operation, target: targetName(target), normalLoader };
    events.push(event);
    return event;
  }

  function mutable(target) {
    if (target === paths.legacy) refuse();
  }

  const guarded = { constants: Object.freeze({ ...fs.constants }) };
  for (const operation of ["existsSync", "readFileSync", "statSync", "lstatSync", "accessSync"]) {
    guarded[operation] = (value, ...args) => {
      const target = checkedPath(value);
      mark(operation, target);
      if (operation === "readFileSync" && target === paths.destination && faults.destinationRead) {
        events.push({ kind: "injected-destination-read-failure" });
        throw Object.assign(new Error("Synthetic read refusal"), { code: "EACCES" });
      }
      return fs[operation](target, ...args);
    };
  }
  guarded.openSync = (value, flags, ...args) => {
    const target = checkedPath(value);
    // The shared engine writes only a fresh, exclusively created temporary file.
    if (flags !== "wx" || targetName(target) !== "temporary") return refuse();
    mark("openSync", target);
    const handle = fs.openSync(target, flags, ...args);
    handles.set(handle, target);
    return handle;
  };
  for (const operation of ["writeSync", "fsyncSync", "closeSync"]) {
    guarded[operation] = (handle, ...args) => {
      if (!handles.has(handle)) return refuse();
      const target = handles.get(handle);
      mark(operation, target);
      if (operation === "writeSync" && faults.write) {
        events.push({ kind: "injected-write-failure" });
        throw Object.assign(new Error("Synthetic write refusal"), { code: "EIO" });
      }
      const result = fs[operation](handle, ...args);
      if (operation === "closeSync") handles.delete(handle);
      return result;
    };
  }
  for (const operation of ["renameSync", "linkSync"]) {
    guarded[operation] = (from, to) => {
      const source = checkedPath(from);
      const destination = checkedPath(to);
      mutable(source);
      mutable(destination);
      mark(operation, destination);
      const result = fs[operation](source, destination);
      if (destination === paths.destination) events.push({ kind: "publication", operation });
      return result;
    };
  }
  guarded.unlinkSync = (value) => {
    const target = checkedPath(value);
    mutable(target);
    mark("unlinkSync", target);
    return fs.unlinkSync(target);
  };
  const fileSystem = new Proxy(guarded, {
    get(target, key) {
      if (Object.hasOwn(target, key)) return target[key];
      return refuse();
    },
  });
  return {
    fileSystem,
    closeRemainingHandles() {
      const count = handles.size;
      for (const handle of handles.keys()) fs.closeSync(handle);
      handles.clear();
      return count;
    },
  };
}

async function startup(paths, faults = {}) {
  const events = [];
  const sourceReads = [];
  const violations = [];
  const forbiddenCalls = [];
  const logs = [];
  const registrations = [];
  const fakeProcess = { env: {}, pid: 4242 };
  const quietConsole = Object.fromEntries(
    ["log", "warn", "error", "info", "debug"].map((level) => [
      level,
      (...args) => {
        // Retain booleans so assertion diagnostics cannot expose fixture values.
        const strings = args.map((value) => {
          try { return typeof value === "string" ? value : JSON.stringify(value); }
          catch { return ""; }
        });
        logs.push({
          level,
          tokenPresent: strings.some((value) =>
            value?.includes(accessToken) || value?.includes(refreshToken)
          ),
          normalLoadMessage: strings.some((value) => value?.includes("SAVED cTRADER AUTH LOADED")),
        });
      },
    ])
  );
  const forbidden = (name) => () => {
    forbiddenCalls.push(name);
    throw Object.assign(new Error("Offline startup called a forbidden capability"), {
      code: "HARNESS_FORBIDDEN_CALL",
    });
  };
  const context = createContext(
    { process: fakeProcess, console: quietConsole, TextEncoder, fetch: forbidden("fetch") },
    { codeGeneration: { strings: false, wasm: false } }
  );
  const guard = filesystemGuard(paths, events, violations, faults);
  const router = {};
  for (const method of ["get", "post", "delete"]) {
    router[method] = (route, handler) => {
      registrations.push({ method, route, handler });
      events.push({ kind: "registration" });
      return router;
    };
  }
  const modules = new Map();
  function synthetic(identifier, exports) {
    if (!modules.has(identifier)) {
      modules.set(identifier, new SyntheticModule(Object.keys(exports), function () {
        for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
      }, { context, identifier }));
    }
    return modules.get(identifier);
  }
  function rejectDependency() {
    violations.push("dependency");
    throw Object.assign(new Error("Module outside startup source allowlist"), {
      code: "HARNESS_DEPENDENCY",
    });
  }
  function source(filename) {
    if (!sourceAllowlist.has(filename)) return rejectDependency();
    const identifier = pathToFileURL(filename).href;
    if (!modules.has(identifier)) {
      sourceReads.push(filename);
      modules.set(identifier, new SourceTextModule(fs.readFileSync(filename, "utf8"), {
        context,
        identifier,
        importModuleDynamically: rejectDependency,
      }));
    }
    return modules.get(identifier);
  }
  function link(specifier, referencingModule) {
    if (specifier === "express") {
      return synthetic("stub:express", { default: { Router: () => router } });
    }
    if (specifier === "fs" || specifier === "node:fs") {
      return synthetic("stub:fs", { ...guard.fileSystem, default: guard.fileSystem });
    }
    if (specifier === "process" || specifier === "node:process") {
      return synthetic("stub:process", { default: fakeProcess, ...fakeProcess });
    }
    if (specifier === "path" || specifier === "node:path") {
      return synthetic("stub:path", { ...path, default: path });
    }
    if (!specifier.startsWith(".")) return rejectDependency();
    const resolved = fileURLToPath(new URL(specifier, referencingModule.identifier));
    if (resolved === runtimePaths) {
      return synthetic("stub:runtimePaths", {
        AUTH_FILE: paths.legacy,
        ACCOUNTS_FILE: paths.destination,
      });
    }
    if (resolved === servicePath) {
      return synthetic("stub:service", Object.fromEntries(
        serviceExports.map((name) => [name, forbidden(name)])
      ));
    }
    if (resolved === broadcastPath) {
      return synthetic("stub:broadcast", { broadcast: forbidden("broadcast") });
    }
    // Unused identity bindings must not expand the graph into broker adapters.
    if (resolved === identityPath) {
      return synthetic("stub:identity", {
        makeTradingAccount: forbidden("makeTradingAccount"),
        normalizeTradingEnvironment: forbidden("normalizeTradingEnvironment"),
        UNKNOWN_ENVIRONMENT: "unknown",
      });
    }
    return source(resolved);
  }

  let route;
  let error = null;
  try {
    route = source(sourcePaths.route);
    await route.link(link);
    await route.evaluate({ timeout: 2000 });
  } catch (caught) {
    error = caught;
  }
  const leakedHandles = guard.closeRemainingHandles();
  // Swallowed capability violations must still fail the harness.
  assert.equal(violations.length, 0, "Startup must stay inside the explicit module/filesystem capabilities");
  assert.equal(forbiddenCalls.length, 0, "Startup must not call a service, broadcaster, or network capability");
  assert.equal(leakedHandles, 0, "Startup must close every fixture file handle");
  assert.equal(sourceReads.every((entry) => sourceAllowlist.has(entry)), true);
  assert.equal(sourceReads.includes(sourcePaths.route), true);
  assert.equal(logs.some((entry) => entry.tokenPresent), false, "Captured logs must not contain synthetic tokens");
  return { route, error, events, sourceReads, logs, registrations };
}

const legacyReads = (result) => result.events.filter((event) =>
  event.kind === "filesystem" && event.target === "legacy" && event.operation === "readFileSync"
);
const normalLoaderEvents = (result) => result.events.filter((event) => event.normalLoader);
const publications = (result) => result.events.filter((event) => event.kind === "publication");

function assertStarted(result) {
  assert.equal(result.error === null, true, "Actual route startup must complete");
  assert.equal(result.registrations.length > 0, true, "Normal handlers must register after loading");
  assert.equal(normalLoaderEvents(result).length > 0, true, "The unchanged normal loader must run");
  return result.route.namespace.getBrokerAuthSummary();
}

function assertLegacyRuntime(summary, activeAccountId = "101") {
  assert.equal(summary.connected, true);
  assert.equal(summary.hasAccessToken, true);
  assert.equal(summary.hasRefreshToken, true);
  assert.equal(summary.activeAccountId === activeAccountId, true);
  assert.equal(summary.accounts.length, 1);
  assert.equal(summary.accounts[0].accountId === "101", true, "Runtime must use legacy accounts");
}

function assertDefaults(summary) {
  assert.equal(summary.connected, false);
  assert.equal(summary.hasAccessToken, false);
  assert.equal(summary.hasRefreshToken, false);
  assert.equal(summary.activeAccountId, null);
  assert.equal(summary.accounts.length, 0);
}

function assertAborted(result, stage) {
  assert.equal(result.error !== null, true, "Migration failure must abort actual route startup");
  assert.equal(result.error.code === "CTRADER_MIGRATION_FAILED", true, "Failure must have the authored migration code");
  assert.equal(result.error.stage === stage, true, "Failure must identify its authored stage");
  assert.equal(normalLoaderEvents(result).length, 0, "Failure must happen before the normal legacy loader");
  assert.equal(result.registrations.length, 0, "Failed startup must not register handlers");
  assert.equal(publications(result).length, 0);
}

function assertUnchanged(filename, before) {
  assert.equal(fs.readFileSync(filename).equals(before), true, "Original fixture bytes must remain unchanged");
}

function assertNoDestination(paths) {
  assert.equal(fs.existsSync(paths.destination), false, "No accounts destination may be created");
  assert.equal(fs.readdirSync(paths.directory).some((name) => name.includes(".tmp-")), false);
}

function destinationBytes(paths) {
  assert.equal(fs.existsSync(paths.destination), true, "Startup must publish the copied accounts destination");
  return fs.readFileSync(paths.destination);
}

test("successful startup publishes an accounts-only copy before normal legacy loading", async (t) => {
  const paths = fixture(t);
  const before = fs.readFileSync(paths.legacy);
  const result = await startup(paths);
  assertLegacyRuntime(assertStarted(result));
  const bytes = destinationBytes(paths);
  const projected = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(Object.keys(projected).sort(), ["accounts", "activeAccountId"]);
  assert.equal(JSON.stringify(projected.accounts) === JSON.stringify(legacyState().accounts), true);
  assert.equal(projected.activeAccountId === "101", true);
  assert.equal(bytes.includes(accessToken) || bytes.includes(refreshToken), false, "Accounts copy must contain no tokens");
  assert.equal(result.sourceReads.includes(sourcePaths.migration), true);
  assert.equal(publications(result).length, 1);
  assert.equal(publications(result)[0].operation, "linkSync", "Publication must be create-only");
  const publicationIndex = result.events.findIndex((event) => event.kind === "publication");
  const normalIndex = result.events.findIndex((event) => event.normalLoader);
  const registrationIndex = result.events.findIndex((event) => event.kind === "registration");
  assert.equal(publicationIndex < normalIndex && normalIndex < registrationIndex, true);
  assert.equal(legacyReads(result).filter((event) => !event.normalLoader).length, 1, "Migration must read legacy bytes once");
  assert.equal(legacyReads(result).filter((event) => event.normalLoader).length, 1);
  assert.equal(result.logs.filter((entry) => entry.normalLoadMessage).length, 1, "Migration's combined-store snapshot must be quiet");
  assertUnchanged(paths.legacy, before);
});

test("preexisting destination is validated but unchanged and runtime still uses legacy accounts", async (t) => {
  const paths = fixture(t, {
    destination: { accounts: [account("202")], activeAccountId: "202" },
  });
  const legacyBefore = fs.readFileSync(paths.legacy);
  const destinationBefore = fs.readFileSync(paths.destination);
  const result = await startup(paths);
  assertLegacyRuntime(assertStarted(result));
  assertUnchanged(paths.legacy, legacyBefore);
  assertUnchanged(paths.destination, destinationBefore);
  assert.equal(publications(result).length, 0);
  assert.equal(legacyReads(result).length, 1, "Only the normal loader should read legacy when a destination exists");
  const validationIndex = result.events.findIndex((event) => event.target === "destination" && event.operation === "readFileSync");
  const normalIndex = result.events.findIndex((event) => event.normalLoader);
  assert.equal(validationIndex >= 0 && validationIndex < normalIndex, true, "Destination validation must precede normal loading");
});

test("migration and the normal loader both leave a sole saved account unselected", async (t) => {
  const paths = fixture(t, { legacy: legacyState(null) });
  const before = fs.readFileSync(paths.legacy);
  const result = await startup(paths);
  // CHANGED ON PURPOSE BY TASK 2.1-e. This used to be the one place
  // where the copy and the runtime disagreed: the copy preserved the
  // stored null and the loader inferred the single record out of the
  // list. Task 4 removed that inference, so both answers are now the
  // stored one — and the copy still has a job, because a dangling
  // selection is preserved here and refused by the loader.
  assertLegacyRuntime(assertStarted(result), null);
  const projected = JSON.parse(destinationBytes(paths).toString("utf8"));
  assert.equal(projected.activeAccountId, null, "Copy-only migration must not invent a selection");
  assert.equal(projected.accounts.length, 1);
  assertUnchanged(paths.legacy, before);
});

test("malformed existing destination aborts before the normal loader and handler registration", async (t) => {
  const paths = fixture(t, { destination: "{" });
  const legacyBefore = fs.readFileSync(paths.legacy);
  const destinationBefore = fs.readFileSync(paths.destination);
  const result = await startup(paths);
  assertAborted(result, "destination-invalid");
  assert.equal(legacyReads(result).length, 0);
  assertUnchanged(paths.legacy, legacyBefore);
  assertUnchanged(paths.destination, destinationBefore);
});

test("unreadable existing destination aborts rather than falling back to legacy loading", async (t) => {
  const paths = fixture(t, {
    destination: { accounts: [account("202")], activeAccountId: null },
  });
  const legacyBefore = fs.readFileSync(paths.legacy);
  const destinationBefore = fs.readFileSync(paths.destination);
  const result = await startup(paths, { destinationRead: true });
  assertAborted(result, "destination-read");
  assert.equal(result.events.some((event) => event.kind === "injected-destination-read-failure"), true);
  assert.equal(legacyReads(result).length, 0);
  assertUnchanged(paths.legacy, legacyBefore);
  assertUnchanged(paths.destination, destinationBefore);
});

test("migration write failure aborts before normal loading and leaves only unchanged legacy bytes", async (t) => {
  const paths = fixture(t);
  const before = fs.readFileSync(paths.legacy);
  const result = await startup(paths, { write: true });
  assertAborted(result, "write");
  assert.equal(result.events.some((event) => event.kind === "injected-write-failure"), true);
  assert.equal(legacyReads(result).length, 1);
  assertUnchanged(paths.legacy, before);
  assertNoDestination(paths);
});

test("missing legacy creates no destination and leaves normal runtime defaults", async (t) => {
  const paths = fixture(t, { legacy: null });
  const result = await startup(paths);
  assertDefaults(assertStarted(result));
  assertNoDestination(paths);
  assert.equal(fs.existsSync(paths.legacy), false);
  assert.equal(publications(result).length, 0);
});

test("corrupt legacy creates no destination and preserves tolerant normal loader behavior", async (t) => {
  const paths = fixture(t, { legacy: "{" });
  const before = fs.readFileSync(paths.legacy);
  const result = await startup(paths);
  assertDefaults(assertStarted(result));
  assertNoDestination(paths);
  assertUnchanged(paths.legacy, before);
  assert.equal(publications(result).length, 0);
});

test("repeat route startup is idempotent and still reloads the unchanged legacy session", async (t) => {
  const paths = fixture(t);
  const before = fs.readFileSync(paths.legacy);
  const first = await startup(paths);
  assertLegacyRuntime(assertStarted(first));
  const copied = destinationBytes(paths);
  const second = await startup(paths);
  assertLegacyRuntime(assertStarted(second));
  assertUnchanged(paths.legacy, before);
  assertUnchanged(paths.destination, copied);
  assert.equal(publications(first).length, 1);
  assert.equal(publications(second).length, 0);
  assert.equal(legacyReads(second).length, 1, "Repeat startup must leave legacy loading to the normal loader");
});
