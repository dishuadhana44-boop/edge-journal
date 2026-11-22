// ============================================================
// BACKEND BASE URL RESOLUTION (production builds may not use loopback)
// ============================================================
//
// Why this suite exists: the deployed EdgeFinder build sent the browser to
// http://localhost:4000/api/ctrader/connect when a user clicked "Connect
// cTrader", because src/services/brokerApi.js:19 read
// `import.meta.env?.VITE_API_URL || "http://localhost:4000"` and the deployed
// build had no VITE_API_URL. A development convenience had silently become a
// production default.
//
// The rule this suite enforces:
//
//   1. An explicitly configured backend URL always wins.
//   2. The loopback backend is a default ONLY when the environment says this is
//      a development build (Vite's `import.meta.env.DEV`).
//   3. A production build with no configured backend is UNCONFIGURED, and an
//      unconfigured build produces no URL at all: no navigation, no request,
//      and a message that says what is missing.
//
// WHAT IS REAL HERE
//
//   - resolveApiBaseUrl() is the exported production function, called directly.
//   - Section B bundles src/services/brokerApi.js from disk with esbuild, with
//     `import.meta.env` replaced by the object a Vite build injects, then
//     evaluates it as CommonJS in this process. That is the same mechanism
//     src/context/marketBrokerSafety.runtime.test.js:294-299 and
//     src/lib/brokerIntegrationPage.runtime.test.js:1027-1029 already use, so
//     DEV: false here means what it means in a deployed bundle.
//   - fetch is replaced by a recorder, and in the unconfigured scenarios by a
//     function that fails the test if the module calls it at all.
//
// WHAT THIS CANNOT PROVE
//
// Nothing about a running backend, a real OAuth round trip, or what the hosting
// provider's environment actually contains. It proves which string this build
// chooses, and what it refuses to do when there is nothing to choose.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(here));

const API_MODULE = join(here, "brokerApi.js");
const BROKER_INTEGRATION_PAGE = join(
  repoRoot,
  "src",
  "components",
  "settings",
  "BrokerIntegrationPage.jsx",
);
const TRADING_ACCOUNTS_PAGE = join(
  repoRoot,
  "src",
  "components",
  "settings",
  "TradingAccountsPage.jsx",
);

// ============================================================
// FIXTURES
// ============================================================

// The loopback backend the local supervisor serves (Express on :4000). It is
// legitimate in development and is the exact string that must never be chosen
// silently in production.
const DEV_LOOPBACK = "http://localhost:4000";
const EXPLICIT_LOOPBACK = "http://127.0.0.1:4000";

// A host that does not exist, so a request aimed at it proves only that the
// configured value was used verbatim.
const CONFIGURED_BACKEND = "https://backend.example.test";

// Vite always defines import.meta.env, so an absent env object means a module
// loaded outside Vite.
const VITE_DEV_ENV = Object.freeze({
  BASE_URL: "/",
  MODE: "development",
  DEV: true,
  PROD: false,
});
const VITE_PROD_UNCONFIGURED_ENV = Object.freeze({
  BASE_URL: "/",
  MODE: "production",
  DEV: false,
  PROD: true,
});
const VITE_PROD_CONFIGURED_ENV = Object.freeze({
  ...VITE_PROD_UNCONFIGURED_ENV,
  VITE_API_URL: CONFIGURED_BACKEND,
});

const NOT_CONFIGURED_MESSAGE =
  "The broker backend URL is not configured in this build, so EdgeFinder cannot reach the trading service. Set VITE_API_URL when building for a deployed site.";

const LOOPBACK_PATTERN = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//;

// ============================================================
// A. resolveApiBaseUrl IS THE SINGLE DECISION
// ============================================================

async function loadApi() {
  assert.ok(
    existsSync(API_MODULE),
    "src/services/brokerApi.js must exist to resolve a backend URL",
  );

  try {
    return await import("./brokerApi.js");
  } catch (error) {
    assert.fail(`brokerApi must stay loadable: ${error.message}`);
  }
}

test("brokerApi exports a backend URL resolver and the unconfigured message", async () => {
  const api = await loadApi();

  assert.equal(
    typeof api.resolveApiBaseUrl,
    "function",
    "the loopback-versus-configured decision must be one exported function, not a copy of the ternary in each module",
  );
  assert.equal(
    api.BACKEND_URL_NOT_CONFIGURED_MESSAGE,
    NOT_CONFIGURED_MESSAGE,
    "the message a user sees when no backend is configured is part of the contract",
  );
});

test("resolveApiBaseUrl uses an explicitly configured backend in every mode", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  for (const env of [
    VITE_PROD_CONFIGURED_ENV,
    { ...VITE_DEV_ENV, VITE_API_URL: CONFIGURED_BACKEND },
    { VITE_API_URL: CONFIGURED_BACKEND },
  ]) {
    assert.equal(
      resolveApiBaseUrl(env),
      CONFIGURED_BACKEND,
      "a configured backend URL wins over any default",
    );
  }
});

test("resolveApiBaseUrl trims the configured value", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  assert.equal(
    resolveApiBaseUrl({ VITE_API_URL: `  ${CONFIGURED_BACKEND}  ` }),
    CONFIGURED_BACKEND,
    "a hosted env var with trailing whitespace must not produce a broken origin",
  );
});

test("resolveApiBaseUrl treats a blank or non-text configured value as unset", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  for (const value of ["", "   ", null, undefined, 0, 4000, {}, false]) {
    assert.equal(
      resolveApiBaseUrl({ MODE: "production", DEV: false, VITE_API_URL: value }),
      "",
      `${JSON.stringify(value)} is not a usable backend URL, so the build is unconfigured`,
    );
  }
});

test("resolveApiBaseUrl defaults to loopback only in a development build", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  assert.equal(
    resolveApiBaseUrl(VITE_DEV_ENV),
    DEV_LOOPBACK,
    "local development keeps working with an empty env file",
  );
});

test("resolveApiBaseUrl reports a production build with no backend as unconfigured", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  for (const env of [
    VITE_PROD_UNCONFIGURED_ENV,
    {},
    { MODE: "production" },
    { DEV: "false" },
    undefined,
    null,
  ]) {
    assert.equal(
      resolveApiBaseUrl(env),
      "",
      "an unconfigured, unrecognised or non-Vite environment must yield no base URL at all",
    );
  }
});

test("resolveApiBaseUrl never resolves a loopback URL outside a development build", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  for (const env of [
    VITE_PROD_UNCONFIGURED_ENV,
    {},
    { DEV: false },
    { DEV: 0 },
    { DEV: "truthy-string" },
    undefined,
  ]) {
    const resolved = resolveApiBaseUrl(env);

    assert.equal(
      LOOPBACK_PATTERN.test(resolved),
      false,
      `${JSON.stringify(env)} resolved to ${JSON.stringify(resolved)}, which sends a browser to a machine it is not running on`,
    );
  }
});

test("resolveApiBaseUrl honors a loopback an operator configured on purpose", async () => {
  const { resolveApiBaseUrl } = await loadApi();

  assert.equal(
    resolveApiBaseUrl({
      MODE: "production",
      DEV: false,
      VITE_API_URL: EXPLICIT_LOOPBACK,
    }),
    EXPLICIT_LOOPBACK,
    "the rule forbids a loopback FALLBACK; an explicit value is the operator's choice, and overriding it silently would break a deliberate tunnel setup",
  );
});

// ============================================================
// B. THE REAL MODULE IN A SIMULATED BUILD
// ============================================================

async function buildApiModule(envDefine = VITE_PROD_UNCONFIGURED_ENV) {
  const result = await esbuild.build({
    stdin: {
      contents: 'export * from "./brokerApi.js";',
      resolveDir: here,
      loader: "js",
      sourcefile: "brokerApiBaseUrlEntry.js",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    logLevel: "silent",
    // The cjs output would otherwise empty import.meta and the module would
    // throw while loading, so every scenario states its build environment.
    define: {
      "import.meta.env": JSON.stringify(envDefine),
    },
  });

  assert.equal(result.outputFiles.length, 1, "the harness must stay in memory");

  const loaded = { exports: {} };

  const noRequires = (specifier) =>
    assert.fail(`brokerApi must stay dependency-free, tried to require ${specifier}`);

  new Function("require", "module", "exports", result.outputFiles[0].text)(
    noRequires,
    loaded,
    loaded.exports,
  );

  return loaded.exports;
}

function withFetch(handler, run) {
  const previous = globalThis.fetch;

  globalThis.fetch = handler;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = previous;
    });
}

const forbiddingFetch = () =>
  assert.fail(
    "an unconfigured build must not issue a request; it has nowhere correct to send one",
  );

const REQUEST_EXPORTS = Object.freeze([
  ["getBrokerStatus", []],
  ["getMt5Positions", ["mt5-1001"]],
  ["getMt5Orders", []],
  ["disconnectMt5", []],
  ["getCtraderStatus", []],
  ["selectCtraderAccount", ["77001122"]],
  ["addCtraderAccount", [{ accountId: "77001122" }]],
  ["startCtraderService", []],
  ["disconnectCtrader", []],
]);

test("a production build with no backend produces no connect URL instead of a localhost one", async () => {
  const api = await buildApiModule();

  assert.equal(
    api.ctraderConnectUrl(),
    null,
    "ctraderConnectUrl() must report the unconfigured build by returning null, because any string it returns is followed by the browser",
  );
});

test("a production build with no backend refuses every request with the configured message", async () => {
  const api = await buildApiModule();

  await withFetch(forbiddingFetch, async () => {
    for (const [name, args] of REQUEST_EXPORTS) {
      const failure = await api[name](...args).then(
        () => null,
        (error) => error,
      );

      assert.ok(
        failure instanceof Error,
        `${name} must reject when no backend is configured`,
      );
      assert.equal(
        failure.message,
        NOT_CONFIGURED_MESSAGE,
        `${name} must say what is missing rather than blame a network failure`,
      );
    }
  });
});

test("a production build with a configured backend uses it verbatim", async () => {
  const api = await buildApiModule(VITE_PROD_CONFIGURED_ENV);

  assert.equal(
    api.ctraderConnectUrl(),
    `${CONFIGURED_BACKEND}/api/ctrader/connect`,
    "the deployed OAuth entry point is the configured backend plus the route the server already answers",
  );

  const calls = [];

  await withFetch(
    async (url) => {
      calls.push(String(url));

      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
    async () => {
      await api.getBrokerStatus();
      await api.selectCtraderAccount("77001122");
    },
  );

  assert.deepEqual(calls, [
    `${CONFIGURED_BACKEND}/api/brokers/status`,
    `${CONFIGURED_BACKEND}/api/ctrader/accounts/select`,
  ]);
});

test("a development build with no configured backend still reaches the local server", async () => {
  const api = await buildApiModule(VITE_DEV_ENV);

  assert.equal(
    api.ctraderConnectUrl(),
    `${DEV_LOOPBACK}/api/ctrader/connect`,
    "the local supervisor workflow must keep working with an empty env file",
  );

  const calls = [];

  await withFetch(
    async (url) => {
      calls.push(String(url));

      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
    async () => {
      await api.getCtraderStatus();
    },
  );

  assert.deepEqual(calls, [`${DEV_LOOPBACK}/api/ctrader/status`]);
});

// ============================================================
// C. THE TWO ENTRY POINTS GUARD THE NULL
// ============================================================

function readSource(file, label) {
  assert.ok(existsSync(file), `${label} must exist at ${relative(repoRoot, file)}`);

  return readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

test("the Broker Details entry point guards the connect URL before navigating", () => {
  const source = readSource(BROKER_INTEGRATION_PAGE, "BrokerIntegrationPage");

  assert.match(
    source,
    /ctraderConnectUrl\(\)/,
    "it must keep asking the shared transport for the URL",
  );
  assert.match(
    source,
    /if \(!connectUrl\)/,
    "it must refuse to navigate when the transport reports unconfigured",
  );
  assert.match(
    source,
    /window\.location\.href = connectUrl;/,
    "it must navigate to the value the transport returned, not to a URL it assembled itself",
  );
});

test("the Trading Accounts entry point uses the shared transport, not its own base URL", () => {
  const source = readSource(TRADING_ACCOUNTS_PAGE, "TradingAccountsPage");

  assert.match(
    source,
    /ctraderConnectUrl\(\)/,
    "both connect entry points must resolve the URL the same way, which is what let one of them drift",
  );
  assert.match(
    source,
    /if \(!connectUrl\)/,
    "it must refuse to navigate when the transport reports unconfigured",
  );
  assert.equal(
    /VITE_API_URL/.test(source),
    false,
    "a page-level VITE_API_URL read is how a second, unguarded default appears",
  );
  assert.equal(
    /localhost|127\.0\.0\.1/.test(source),
    false,
    "no loopback host may appear in a settings page at all",
  );
});

// ============================================================
// D. LOOPBACK DEFAULTS ARE COUNTED, NOT ASSUMED
// ============================================================

const CONNECT_PATH_FILES = Object.freeze([
  "src/services/brokerApi.js",
  "src/components/settings/BrokerIntegrationPage.jsx",
  "src/components/settings/TradingAccountsPage.jsx",
]);

const DEV_DEFAULT_DECLARATION = "export const DEV_API_BASE_URL";

test("the cTrader connect path names loopback exactly once, as the development default", () => {
  for (const relativePath of CONNECT_PATH_FILES) {
    const source = readSource(join(repoRoot, relativePath), relativePath);

    if (relativePath === "src/services/brokerApi.js") {
      assert.ok(
        source.includes(DEV_DEFAULT_DECLARATION),
        "the single development default must be one named constant",
      );
      assert.equal(
        source.split(DEV_DEFAULT_DECLARATION).length - 1,
        1,
        "and it must be declared exactly once",
      );

      continue;
    }

    assert.equal(
      /localhost|127\.0\.0\.1/.test(source),
      false,
      `${relativePath} may not contain any loopback host`,
    );
  }
});

function findUngatedLoopbackDefaults() {
  const offenders = [];
  const ungated =
    /VITE_API_URL\s*\|\|\s*[\r\n\s]*"http:\/\/(localhost|127\.0\.0\.1):4000"/;

  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const full = join(directory, name);

      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }

      if (!/\.jsx?$/.test(name) || /\.test\.js$/.test(name)) {
        continue;
      }

      if (ungated.test(readFileSync(full, "utf8").replace(/\r\n/g, "\n"))) {
        offenders.push(relative(repoRoot, full).split(sep).join("/"));
      }
    }
  };

  walk(join(repoRoot, "src"));

  return offenders.sort();
}

// Recorded the day this suite was written. Each entry still reads
// VITE_API_URL || "http://localhost:4000" at module scope, so each one will
// aim at loopback in a deployed build exactly as brokerApi.js did. They are
// outside this connect-redirect bug and stay open until they are migrated to
// resolveApiBaseUrl(), which removes them from this list.
const RECORDED_LOOPBACK_DEBT = Object.freeze([
  "src/components/trading/positions/PositionTerminal.jsx",
  "src/components/trading/positions/actions/PositionActions.jsx",
  "src/context/MarketContext.jsx",
  "src/context/TradeContext.jsx",
  "src/services/assistantService.js",
  "src/services/backtest/historicalData.js",
  "src/utils/trading/brokerSizing.js",
].sort());

test("the remaining modules that still default to loopback are exactly the recorded debt", () => {
  assert.deepEqual(
    findUngatedLoopbackDefaults(),
    RECORDED_LOOPBACK_DEBT,
    "adding an ungated loopback fallback to another client module is how this bug happened, and migrating one off the list is the only way it shrinks",
  );
});

test("the dead ConnectBroker component is not reachable from the connect flow", () => {
  const source = readSource(
    join(repoRoot, "src", "components", "ConnectBroker.jsx"),
    "ConnectBroker",
  );

  assert.match(
    source,
    /http:\/\/localhost:4000\/api\/ctrader\/login/,
    "its hardcoded loopback is recorded here as dead-code debt: nothing imports it, so it cannot redirect a deployed user",
  );

  const importers = [];
  const ungatedHardcoded =
    /from\s+["'][^"']*ConnectBroker["']/;

  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const full = join(directory, name);

      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }

      if (!/\.jsx?$/.test(name)) {
        continue;
      }

      const text = readFileSync(full, "utf8");

      if (ungatedHardcoded.test(text) && !full.endsWith(join("components", "ConnectBroker.jsx"))) {
        importers.push(relative(repoRoot, full).split(sep).join("/"));
      }
    }
  };

  walk(join(repoRoot, "src"));

  assert.deepEqual(
    importers,
    [],
    "ConnectBroker stays dead while it hardcodes loopback; importing it would put a localhost-only client back on a real path",
  );
});
