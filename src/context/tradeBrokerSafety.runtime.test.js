// ============================================================
// MT5 SYNC SAFETY (Phase 3)
// ============================================================
//
// Covers src/context/TradeContext.jsx: the ways a shared provider can
// attribute one MT5 account's data to another.
//
//   1. A late GET /api/mt5/account response for account A, arriving after the
//      user selected account B, must not move B's balance, selection, events or
//      storage (src/context/TradeContext.jsx:2624-3271).
//   2. The same for GET /api/mt5/positions (src/context/TradeContext.jsx:3346-3781).
//   3. Two responses for the SAME selected account must not be applied out of
//      order — a generation counter, not just a selection check.
//   4. The account-switch render must not persist A's in-memory trade arrays
//      under B's broker-scoped storage keys (src/context/TradeContext.jsx:2482-2602).
//   5. A live MT5 login on the WRONG SERVER must not take over the local record
//      that merely shares the `mt5-<login>` id (src/context/TradeContext.jsx:2942-3104).
//   6. Background account sync must not replace the account the user selected,
//      because the MT5 terminal can be logged in somewhere else
//      (src/context/TradeContext.jsx:2860-2993).
//   7. Background account sync must not invent a selection when nothing is
//      selected yet (src/context/TradeContext.jsx:2864-2867, 2897-2900).
//   8. Background account sync must not select an account it had to create
//      after finding no local record for the live login
//      (src/context/TradeContext.jsx:3001-3235).
//   9. The explicitly selected account is the only thing that declares which
//      price feed may write the market's bid/ask pair
//      (src/context/TradeContext.jsx:1947-1955).
//
// WHAT THIS CANNOT PROVE, stated up front: it mounts the real TradeProvider
// against a fake fetch, fake storage and faked intervals. It does not contact
// the MT5 bridge, the Express server or any port, so it cannot show what a real
// terminal reports. `JournalContext` and `MarketContext` are substituted, so
// journal writes and cTrader socket events are observed at their boundary, not
// exercised end to end. The price source is the same deal: this harness proves
// which selection made which declaration, and section 7 of
// marketBrokerSafety.runtime.test.js mounts the real MarketProvider to prove
// what it does with one.
//
// Every fixture below is copied from the producers, not invented:
//   - trading account records  -> normalizeTradingAccount() shape,
//     src/components/settings/TradingAccountsPage.jsx:104-247
//   - account response body    -> bridge GET /mt5/status `account` fields as
//     forwarded by server/routes/mt5.js:193-230
//   - positions response body  -> server/routes/mt5.js:349-... plus the
//     mt5Login/mt5Server stamps normalizeMT5Position reads at :3381-3391
//   - scoped storage keys      -> accountStorageKey(),
//     src/lib/brokerAccountIdentity.js:438-448

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

import { accountStorageKey, makeAccountIdentity } from "../lib/brokerAccountIdentity.js";

const nodeRequire = createRequire(import.meta.url);

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

// Captured before any scenario could replace a timer, so the runner can always
// await a real macrotask.
const nativeSetTimeout = setTimeout;
const realTick = () =>
  new Promise((resolve) => nativeSetTimeout(resolve, 0));

const HARNESS_GLOBAL = "__EDGEFLO_TRADE_SAFETY_HARNESS__";

// A base URL that only the fake fetch ever sees. Assertions check responses came
// through this fake, so no scenario can reach a real host.
const FAKE_API_URL = "http://fake-api.invalid:4000";

const STORAGE_KEYS = {
  OPEN_TRADES: "edgeflo_open_trades",
  PENDING_ORDERS: "edgeflo_pending_orders",
  CLOSED_TRADES: "edgeflo_closed_trades",
  ACCOUNT: "edgeflo_account",
};

// ============================================================
// ACCOUNTS
// ============================================================

function mt5Account(overrides = {}) {
  return {
    id: "mt5-1001",
    accountName: "MT5 Account 1001",
    currency: "USD",
    startingBalance: 1000,
    balance: 1000,
    equity: 1000,
    accountType: "MT5",
    leverage: 100,
    isDefault: true,
    isBrokerAccount: true,
    broker: "MT5",
    brokerAccountId: "1001",
    connectionStatus: "connected",
    lastSynced: "2026-11-03T10:00:00.000Z",
    mt5Login: "1001",
    mt5Server: "server-a",
    mt5Connected: true,
    mt5TerminalId: null,
    strategyId: null,
    strategyName: null,
    marginUsed: 10,
    freeMargin: 990,
    floatingPnL: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const ACCOUNT_A = mt5Account();
const ACCOUNT_B = mt5Account({
  id: "mt5-2002",
  accountName: "MT5 Account 2002",
  brokerAccountId: "2002",
  mt5Login: "2002",
  mt5Server: "server-b",
  startingBalance: 5000,
  balance: 5000,
  equity: 5000,
  marginUsed: 50,
  freeMargin: 4950,
  isDefault: false,
});

// The candidate a saved cTrader account is built from is a four-key allowlist
// (src/components/settings/BrokerIntegrationPage.jsx:247-261): id, name, broker,
// login. Inventing a fifth key here would test a shape production never stores,
// and the broker label is the only one of the four the price source reads.
function ctraderAccount(overrides = {}) {
  return {
    id: "ctrader-7001",
    accountName: "IC Markets cTrader 7001",
    broker: "cTrader",
    brokerAccountId: "7001",
    ...overrides,
  };
}

const ACCOUNT_CTRADER = ctraderAccount();

// A record the identity authority cannot name a broker for. "IC Markets" is the
// label this app writes today and it is not in BROKER_ALIASES, so
// makeAccountIdentity() reports `identityStatus: "unsupported"` with a null
// brokerKey (src/lib/brokerAccountIdentity.js:140-158) - which is exactly the
// answer the price source must receive as "declare nothing" rather than as a
// guessed feed. Only the two keys the identity reads are supplied; inventing
// MT5 or cTrader fields here would describe an account production cannot name.
function unnameableAccount(overrides = {}) {
  return {
    id: "icmarkets-5005",
    accountName: "IC Markets 5005",
    broker: "IC Markets",
    brokerAccountId: "5005",
    ...overrides,
  };
}

const ACCOUNT_UNNAMEABLE = unnameableAccount();

const IDENTITY_A = makeAccountIdentity(ACCOUNT_A);
const IDENTITY_B = makeAccountIdentity(ACCOUNT_B);

function scopedKey(baseKey, identity) {
  return accountStorageKey(baseKey, identity);
}

// A's open position, shaped the way normalizeMT5Position consumes it
// (src/context/TradeContext.jsx:845-900): ticket + type + volume + price_open.
const POSITION_A = {
  ticket: 501,
  symbol: "EURUSD",
  type: 0,
  volume: 0.1,
  price_open: 1.1,
  price_current: 1.11,
  profit: 10,
  swap: 0,
  commission: 0,
  time: 1762156800,
  time_msc: 1762156800000,
};

function accountBody(login, server, balance) {
  return {
    success: true,
    account: {
      login,
      server,
      balance,
      equity: balance,
      margin: 10,
      freeMargin: balance - 10,
      currency: "USD",
      leverage: 100,
      profit: 0,
    },
  };
}

function positionsBody(login, server, positions) {
  return {
    success: true,
    mt5Login: login,
    mt5Server: server,
    broker_time_msc: 1762156800000,
    positions,
  };
}

function seedStorage(entries = {}) {
  return {
    tradingAccounts: JSON.stringify([ACCOUNT_A, ACCOUNT_B]),
    [scopedKey(STORAGE_KEYS.ACCOUNT, IDENTITY_A)]: JSON.stringify({
      balance: 1000,
      equity: 1000,
      marginUsed: 10,
      freeMargin: 990,
      currency: "USD",
      leverage: 100,
      balanceRefreshedAt: null,
      balanceRefreshedAccountId: null,
    }),
    [scopedKey(STORAGE_KEYS.ACCOUNT, IDENTITY_B)]: JSON.stringify({
      balance: 5000,
      equity: 5000,
      marginUsed: 50,
      freeMargin: 4950,
      currency: "USD",
      leverage: 100,
      balanceRefreshedAt: null,
      balanceRefreshedAccountId: null,
    }),
    [scopedKey(STORAGE_KEYS.OPEN_TRADES, IDENTITY_A)]: JSON.stringify([]),
    [scopedKey(STORAGE_KEYS.OPEN_TRADES, IDENTITY_B)]: JSON.stringify([]),
    [scopedKey(STORAGE_KEYS.PENDING_ORDERS, IDENTITY_A)]: JSON.stringify([]),
    [scopedKey(STORAGE_KEYS.PENDING_ORDERS, IDENTITY_B)]: JSON.stringify([]),
    [scopedKey(STORAGE_KEYS.CLOSED_TRADES, IDENTITY_A)]: JSON.stringify([]),
    [scopedKey(STORAGE_KEYS.CLOSED_TRADES, IDENTITY_B)]: JSON.stringify([]),
    ...entries,
  };
}

// ============================================================
// FAKE STORAGE
// ============================================================

function createFakeStorage(initial) {
  const values = new Map(Object.entries(initial));
  const writes = [];

  const storage = {
    getItem(key) {
      const name = String(key);

      return values.has(name) ? values.get(name) : null;
    },
    setItem(key, value) {
      const name = String(key);

      writes.push({ key: name, value: String(value) });
      values.set(name, String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
  };

  return {
    storage,
    writes,
    keys: () => [...values.keys()].sort(),
    raw: (key) => (values.has(key) ? values.get(key) : null),
    read: (key) => (values.has(key) ? JSON.parse(values.get(key)) : null),
    writesTo: (key) => writes.filter((write) => write.key === key),
  };
}

// ============================================================
// FAKE FETCH
//
// Every response is a deferred the scenario resolves by hand, which is what
// makes "arrives after the user switched account" testable at all.
// ============================================================

function createFakeFetch(sink) {
  const calls = [];

  const fetchImpl = (url, options = {}) => {
    const href = String(url);
    let settle = null;

    const promise = new Promise((resolve) => {
      settle = resolve;
    });

    const record = {
      index: calls.length,
      url: href,
      options,
      settled: false,
      resolve(body, status = 200) {
        record.settled = true;

        settle({
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
        });
      },
      reject(error = new Error("fake fetch aborted")) {
        record.settled = true;

        settle(Promise.reject(error));
      },
    };

    calls.push(record);
    sink.fetchCalls.push(record);

    return promise;
  };

  return {
    fetchImpl,
    calls,
    pending(matcher) {
      return calls.filter(
        (call) => !call.settled && (matcher ? matcher(call.url) : true)
      );
    },
    latest(matcher) {
      const matched = calls.filter((call) => matcher(call.url));

      return matched[matched.length - 1] ?? null;
    },
    countFor(matcher) {
      return calls.filter((call) => matcher(call.url)).length;
    },
    settleAllRemaining() {
      calls
        .filter((call) => !call.settled)
        .forEach((call) => call.resolve({ success: false }, 599));
    },
  };
}

const isAccountCall = (url) => url.includes("/api/mt5/account");
const isPositionsCall = (url) => url.includes("/api/mt5/positions");

// The positions URL carries the local account id the request was issued for
// (src/context/TradeContext.jsx:3361-3363), so a scenario can tell which
// account a still-open positions request belongs to.
const isPositionsCallFor = (accountId) => (url) =>
  isPositionsCall(url) &&
  url.includes(`accountId=${encodeURIComponent(accountId)}`);

// ============================================================
// SUBSTITUTED CONTEXTS
//
// TradeProvider reads exactly one useJournal() and one useMarket()
// (src/context/TradeContext.jsx:1912-1924). The doubles expose their current
// value on the harness so a scenario can switch accounts through the real
// setter, which is what makes React re-render the provider.
//
// TradeContext.jsx imports both extensionless ("./JournalContext"), so the
// filters match the bare module name rather than a "context/" prefix.
// ============================================================

const REACT_IMPORT = 'import { createContext, createElement, useContext, useState } from "react";\n';

const STUBS = Object.freeze({
  journalContext: `${REACT_IMPORT}
const JournalContext = createContext(null);

export function JournalProvider({ children, initialAccountId }) {
  const [selectedAccountId, setSelected] = useState(initialAccountId);
  const trades = [];

  const value = {
    selectedAccountId,
    setSelectedAccountId: (id) => {
      globalThis["${HARNESS_GLOBAL}"].selections.push(id);
      setSelected(id);
    },
    trades,
    addTrade: (trade) => {
      globalThis["${HARNESS_GLOBAL}"].journalTrades.push(trade);
      trades.push(trade);
    },
  };

  // What the price-source recorder stamps alongside each declaration: the
  // selection that was current when TradeProvider declared it.
  globalThis["${HARNESS_GLOBAL}"].lastSelectedAccountId =
    selectedAccountId;

  globalThis["${HARNESS_GLOBAL}"].journalValues.push(value);

  return createElement(JournalContext.Provider, { value }, children);
}

export function useJournal() {
  return useContext(JournalContext);
}

export const JournalProviderMarker = "journalContextStub";
`,

  marketContext: `${REACT_IMPORT}
const value = {
  bid: 1.1,
  ask: 1.10002,
  symbol: "EURUSD",
  positions: [],
  cTraderAccountId: null,
  priceSource: null,
  setPriceSource: (source) => {
    // Recorded, never applied: which feed the real MarketProvider would let
    // write its bid/ask is proven by marketBrokerSafety.runtime.test.js. What
    // this harness can prove is that the selected account is what declares it.
    globalThis["${HARNESS_GLOBAL}"].priceSources.push({
      source,
      selectedAccountId:
        globalThis["${HARNESS_GLOBAL}"].lastSelectedAccountId,
    });

    value.priceSource = source;
  },
};

export function MarketProvider({ children }) {
  return children;
}

export function useMarket() {
  return value;
}

export const MarketProviderMarker = "marketContextStub";
`,
});

const SUBSTITUTIONS = Object.freeze([
  [/JournalContext$/, "journalContext"],
  [/MarketContext$/, "marketContext"],
]);

function stubPlugin(substitutions) {
  return {
    name: "edgeflo-trade-safety-stubs",
    setup(build) {
      for (const [filter, key] of substitutions) {
        build.onResolve({ filter }, () => ({
          path: key,
          namespace: "edgeflo-trade-safety-stub",
        }));
      }

      build.onLoad(
        { filter: /.*/, namespace: "edgeflo-trade-safety-stub" },
        (args) => ({
          contents: STUBS[args.path],
          loader: "js",
          resolveDir: `${repoRoot}/src`,
        })
      );
    },
  };
}

// ============================================================
// BUNDLE
// ============================================================

const ENTRY = [
  'export { TradeProvider, useTrade } from "./context/TradeContext.jsx";',
  'export { JournalProvider } from "./context/JournalContext";',
  'import { useTrade } from "./context/TradeContext.jsx";',
  `export function Probe() {
  const trade = useTrade();

  globalThis["${HARNESS_GLOBAL}"].tradeValue = trade;

  globalThis["${HARNESS_GLOBAL}"].trades.push({
    account: trade.account,
    openTrades: trade.openTrades,
    pendingOrders: trade.pendingOrders,
    closedTrades: trade.closedTrades,
    selectedAccountId: trade.selectedAccountId,
  });

  return null;
}`,
].join("\n");

async function buildRuntimeBundle() {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "tradeBrokerSafetyEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    // TradeContext.jsx:10-12 reads import.meta.env, which the cjs output would
    // otherwise empty and then throw on during evaluation.
    define: {
      "import.meta.env": JSON.stringify({ VITE_API_URL: FAKE_API_URL }),
    },
    plugins: [stubPlugin(SUBSTITUTIONS)],
    external: ["react", "react/jsx-runtime", "react-dom/client"],
  });

  assert.equal(
    result.outputFiles.length,
    1,
    "the runtime harness must stay in memory"
  );

  return {
    code: result.outputFiles[0].text,
    inputs: Object.keys(result.metafile.inputs).sort(),
  };
}

function evaluateBundle(code, shared) {
  const loaded = { exports: {} };

  const guardedRequire = (specifier) => {
    const supplied = shared[specifier];

    assert.ok(
      supplied,
      `the trade safety bundle may only require shared React modules, got ${specifier}`
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(
    guardedRequire,
    loaded,
    loaded.exports
  );

  return loaded.exports;
}

// ============================================================
// SCENARIO RUNNER
// ============================================================

const TRANSPORT_GLOBALS = Object.freeze([
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
]);

async function withTradeScenario(options, runScenario) {
  const {
    initialAccountId = ACCOUNT_A.id,
    storageEntries = {},
    accounts = [ACCOUNT_A, ACCOUNT_B],
  } = options;

  const sink = {
    trades: [],
    tradeValue: null,
    selections: [],
    journalTrades: [],
    journalValues: [],
    fetchCalls: [],
    events: [],
    intervals: [],
    priceSources: [],
    lastSelectedAccountId: null,
  };

  globalThis[HARNESS_GLOBAL] = sink;

  const fake = createFakeStorage(seedStorage(storageEntries));
  fake.storage.setItem(
    "tradingAccounts",
    JSON.stringify(accounts)
  );
  fake.writes.length = 0;

  const fakeFetch = createFakeFetch(sink);

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const win = dom.window;
  const restoreSteps = [];
  const touched = [];

  function define(target, name, descriptor) {
    const previous = Object.getOwnPropertyDescriptor(target, name);

    restoreSteps.push(() => {
      if (previous) {
        Object.defineProperty(target, name, previous);
      } else {
        delete target[name];
      }
    });

    Object.defineProperty(target, name, descriptor);
  }

  function tripwire(target, label) {
    for (const name of TRANSPORT_GLOBALS) {
      define(target, name, {
        configurable: true,
        enumerable: true,
        get() {
          touched.push(`${label}.${name}`);

          throw new Error(`the trade safety harness reached ${label}.${name}`);
        },
      });
    }
  }

  let scenarioFailure = null;
  let unmountFailure = null;
  let scenarioResult;
  let root = null;
  let shared = null;

  const ctx = {
    sink,
    fake,
    fetch: fakeFetch,
    win,
    modules: null,
    React: null,
    latest() {
      return sink.trades[sink.trades.length - 1];
    },
    journal() {
      return sink.journalValues[sink.journalValues.length - 1];
    },
    // The live context value the probe last read, so a scenario can call
    // syncMT5Positions() through the real context API.
    trade() {
      assert.ok(
        sink.tradeValue,
        "the probe must have rendered inside TradeProvider"
      );

      return sink.tradeValue;
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    // Polling never runs on its own, but the load effect schedules a real
    // setTimeout(syncMT5Account, 0), so scenarios await one macrotask.
    async tick() {
      await ctx.act(async () => {
        await realTick();
      });
    },
    async mount() {
      await ctx.act(() => {
        root.render(
          ctx.React.createElement(
            ctx.modules.JournalProvider,
            { initialAccountId },
            ctx.React.createElement(
              ctx.modules.TradeProvider,
              null,
              ctx.React.createElement(ctx.modules.Probe)
            )
          )
        );
      });

      await ctx.tick();
    },
    // Every still-open request matching the matcher, in issue order.
    open(matcher) {
      return fakeFetch.pending(matcher);
    },
    // Answer every open request matching the matcher with the same body.
    async answer(matcher, body, status = 200) {
      const pending = fakeFetch.pending(matcher);

      await ctx.act(async () => {
        for (const record of pending) {
          record.resolve(body, status);
        }

        await realTick();
      });

      return pending;
    },
    async resolve(record, body, status = 200) {
      await ctx.act(async () => {
        record.resolve(body, status);
        await realTick();
      });
    },
    async reject(record, error) {
      await ctx.act(async () => {
        record.reject(error);
        await realTick();
      });
    },
    // The provider listens for this to re-sync the selected account
    // (src/context/TradeContext.jsx:3430-3453).
    async requestAccountSync(accountId) {
      const before = fakeFetch.calls.length;

      await ctx.act(async () => {
        win.dispatchEvent(
          new win.CustomEvent("requestMT5AccountSync", {
            detail: { accountId },
          })
        );
        await realTick();
      });

      assert.ok(
        fakeFetch.calls.length > before,
        "a sync request for the selected account must start a new request"
      );

      return fakeFetch.calls[fakeFetch.calls.length - 1];
    },
    async switchAccount(accountId) {
      await ctx.act(async () => {
        ctx.journal().setSelectedAccountId(accountId);
        await realTick();
      });
    },
    async syncPositions() {
      await ctx.act(async () => {
        await ctx.trade().syncMT5Positions();
        await realTick();
      });
    },
    // Start a positions sync and leave its request outstanding, which is the
    // only way a response can still be in flight when the account changes.
    async firePositionsSync() {
      const before = fakeFetch.calls.length;

      await ctx.act(async () => {
        void ctx.trade().syncMT5Positions();
        await realTick();
      });

      assert.ok(
        fakeFetch.calls.length > before,
        "firing a positions sync must start a new request"
      );

      return fakeFetch.calls[fakeFetch.calls.length - 1];
    },
    // Every price-source declaration TradeProvider has pushed at the market,
    // each stamped with the selection that was current when it was made.
    priceDeclarations() {
      return sink.priceSources.map(
        (entry) => entry.source
      );
    },
    latestDeclaration() {
      return sink.priceSources[sink.priceSources.length - 1] ?? null;
    },
  };

  try {
    tripwire(globalThis, "globalThis");
    tripwire(win, "window");

    for (const name of [
      "window",
      "self",
      "document",
      "navigator",
      "HTMLElement",
      "HTMLDivElement",
      "Element",
      "Node",
      "Text",
      "Event",
      "CustomEvent",
      "getComputedStyle",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "MessageChannel",
    ]) {
      if (name in win) {
        define(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: win[name],
        });
      }
    }

    define(globalThis, "localStorage", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fake.storage,
    });

    define(win, "localStorage", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fake.storage,
    });

    // fetch is faked rather than tripped: the scenarios need to control when a
    // response arrives. Every call is recorded and asserted to stay inside the
    // fake base URL.
    define(globalThis, "fetch", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fakeFetch.fetchImpl,
    });

    define(win, "fetch", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fakeFetch.fetchImpl,
    });

    // Polling must not fire on its own: intervals are recorded and never run.
    for (const target of [globalThis, win]) {
      define(target, "setInterval", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (handler, ms) => {
          sink.intervals.push({ handler, ms, target: target === win ? "window" : "globalThis" });

          return sink.intervals.length;
        },
      });

      define(target, "clearInterval", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: () => undefined,
      });
    }

    // Window custom events are the other channel a stale response can use.
    const dispatchEvent = win.dispatchEvent;

    define(win, "dispatchEvent", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: (event, ...rest) => {
        sink.events.push(event?.type ?? "unknown");

        return dispatchEvent.call(win, event, ...rest);
      },
    });

    define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });

    // The provider logs every sync step verbosely; the scenarios assert on
    // behaviour, so the noise is silenced and restored by the same ledger.
    for (const method of ["log", "error", "warn"]) {
      define(console, method, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: () => undefined,
      });
    }

    shared = {
      react: nodeRequire("react"),
      "react/jsx-runtime": nodeRequire("react/jsx-runtime"),
      "react-dom/client": nodeRequire("react-dom/client"),
    };

    assert.equal(
      typeof shared.react.act,
      "function",
      "React 19 must expose act"
    );

    const built = await buildRuntimeBundle();

    // The bundle must really contain the provider under test, and must not
    // contain the two contexts that were substituted.
    assert.ok(
      built.inputs.some((input) => input.endsWith("src/context/TradeContext.jsx")),
      "the bundle must include the real TradeContext.jsx"
    );
    assert.ok(
      !built.inputs.some((input) => input.endsWith("src/context/JournalContext.jsx")),
      "JournalContext must stay substituted"
    );
    assert.ok(
      !built.inputs.some((input) => input.endsWith("src/context/MarketContext.jsx")),
      "MarketContext must stay substituted"
    );

    const exports = evaluateBundle(built.code, shared);

    assert.deepEqual(
      Object.keys(exports).sort(),
      ["JournalProvider", "Probe", "TradeProvider", "useTrade"],
      "the trade safety entry must export the provider, the hook, the stub and the probe"
    );

    ctx.modules = exports;
    ctx.React = shared.react;

    const container = win.document.createElement("div");

    win.document.body.appendChild(container);
    ctx.container = container;
    root = shared["react-dom/client"].createRoot(container);

    await ctx.mount();

    scenarioResult = await runScenario(ctx);
  } catch (error) {
    scenarioFailure = error;
  } finally {
    if (root !== null) {
      try {
        fakeFetch.settleAllRemaining();

        await ctx.React.act(async () => {
          await realTick();
          root.unmount();
        });
      } catch (error) {
        unmountFailure = error;
      }

      root = null;
    }

    for (let index = restoreSteps.length - 1; index >= 0; index -= 1) {
      restoreSteps[index]();
    }

    delete globalThis[HARNESS_GLOBAL];
  }

  if (scenarioFailure) {
    throw scenarioFailure;
  }

  if (unmountFailure) {
    throw unmountFailure;
  }

  assert.deepEqual(touched, [], "no scenario may read a real transport entry point");

  return scenarioResult;
}

// ============================================================
// 1. CONTROL: a response for the selected account does apply
//
// Without this the race tests below could pass vacuously.
// ============================================================

test("control: an account response for the selected account applies its balance", async () => {
  await withTradeScenario({}, async (ctx) => {
    assert.equal(
      ctx.fetch.countFor(isAccountCall),
      1,
      "mount fires exactly one account sync for the selected account"
    );

    const answered = await ctx.answer(
      isAccountCall,
      accountBody("1001", "server-a", 4321.5)
    );

    assert.equal(answered.length, 1, "one open account request was answered");
    assert.equal(ctx.latest().account.balance, 4321.5);
    assert.equal(ctx.latest().selectedAccountId, ACCOUNT_A.id);
  });
});

// ============================================================
// 2. LATE ACCOUNT RESPONSE
// ============================================================

test("a late MT5 account response for the previous account cannot move the new account", async () => {
  await withTradeScenario({}, async (ctx) => {
    const staleCalls = ctx.open(isAccountCall);

    assert.equal(staleCalls.length, 1, "one account request is open for A");

    await ctx.switchAccount(ACCOUNT_B.id);

    // The stub records the harness's own switch as a selection request, so the
    // safety assertion is about requests that arrive after it: neither the
    // stale response nor the fresh one may drive the journal selection.
    const selectionsFromHarness = ctx.sink.selections.length;

    const freshCall = ctx.fetch.latest(isAccountCall);

    assert.notEqual(
      freshCall.index,
      staleCalls[0].index,
      "switching accounts must start a new sync"
    );

    await ctx.resolve(freshCall, accountBody("2002", "server-b", 5000));
    await ctx.resolve(staleCalls[0], accountBody("1001", "server-a", 1000));

    const view = ctx.latest();

    assert.equal(view.selectedAccountId, ACCOUNT_B.id, "a stale response may not reselect A");
    assert.equal(view.account.balance, 5000, "a stale response may not overwrite B's balance");
    assert.equal(
      view.account.mt5Login,
      "2002",
      "a stale response may not restamp B with A's login"
    );

    assert.equal(
      ctx.sink.events.includes("mt5AccountUpdated"),
      false,
      "a stale response may not broadcast an account update"
    );

    assert.deepEqual(
      ctx.sink.selections.slice(selectionsFromHarness),
      [],
      "a response may not ask the journal to select another account"
    );

    assert.deepEqual(
      ctx.fetch
        .calls.filter((call) => call.settled && isAccountCall(call.url))
        .every((call) => call.url.startsWith(FAKE_API_URL)),
      true,
      "every account request must stay inside the fake base URL"
    );
  });
});

// ============================================================
// 3. LATE POSITIONS RESPONSE
// ============================================================

test("a late MT5 positions response for the previous account cannot fill the new account", async () => {
  await withTradeScenario({}, async (ctx) => {
    // Resolve A's mount-time request so the provider really holds A's position.
    await ctx.answer(
      isPositionsCallFor(ACCOUNT_A.id),
      positionsBody("1001", "server-a", [POSITION_A])
    );

    assert.equal(
      ctx.latest().openTrades.some((trade) => String(trade.brokerPositionId) === "501"),
      true,
      "the control half of this test: A's position must be present before the switch"
    );

    // Leave a second request issued while A is selected in flight.
    await ctx.firePositionsSync();

    await ctx.switchAccount(ACCOUNT_B.id);

    const stalePositions = ctx.open(isPositionsCallFor(ACCOUNT_A.id));
    const freshPositions = ctx.open(isPositionsCallFor(ACCOUNT_B.id));

    assert.equal(
      stalePositions.length,
      1,
      "the in-flight request issued for A is still outstanding after the switch"
    );

    assert.equal(
      freshPositions.length,
      1,
      "the switch starts exactly one request for B"
    );

    await ctx.resolve(freshPositions[0], positionsBody("2002", "server-b", []));
    await ctx.resolve(stalePositions[0], positionsBody("1001", "server-a", [POSITION_A]));

    const view = ctx.latest();

    assert.equal(
      view.openTrades.some((trade) => String(trade.brokerPositionId) === "501"),
      false,
      "A's position may not appear in B's open trades"
    );

    assert.equal(
      ctx.sink.journalTrades.length,
      0,
      "a stale positions response may not write the journal"
    );
  });
});

// ============================================================
// 4. SAME ACCOUNT, TWO RESPONSES
// ============================================================

test("two responses for the same account are applied newest-first, not arrival-first", async () => {
  await withTradeScenario({}, async (ctx) => {
    const older = ctx.fetch.latest(isAccountCall);

    await ctx.requestAccountSync(ACCOUNT_A.id);

    const newer = ctx.fetch.latest(isAccountCall);

    assert.notEqual(newer.index, older.index, "a second sync must start a second request");

    await ctx.resolve(newer, accountBody("1001", "server-a", 3000));

    assert.equal(ctx.latest().account.balance, 3000);

    await ctx.resolve(older, accountBody("1001", "server-a", 1000));

    assert.equal(
      ctx.latest().account.balance,
      3000,
      "the older response may not overwrite the newer one for the same account"
    );
  });
});

// ============================================================
// 5. PERSISTENCE RACE
// ============================================================

test("switching accounts does not persist the previous account's data under the new keys", async () => {
  await withTradeScenario({}, async (ctx) => {
    await ctx.answer(isAccountCall, accountBody("1001", "server-a", 1000));
    await ctx.answer(
      isPositionsCallFor(ACCOUNT_A.id),
      positionsBody("1001", "server-a", [POSITION_A])
    );

    assert.equal(ctx.latest().openTrades.length, 1, "A holds one open position");

    ctx.fake.writes.length = 0;

    await ctx.switchAccount(ACCOUNT_B.id);

    const bOpenKey = scopedKey(STORAGE_KEYS.OPEN_TRADES, IDENTITY_B);
    const bAccountKey = scopedKey(STORAGE_KEYS.ACCOUNT, IDENTITY_B);

    const pollutedOpen = ctx.fake
      .writesTo(bOpenKey)
      .filter((write) => {
        const stored = JSON.parse(write.value);

        return Array.isArray(stored)
          ? stored.some((trade) => String(trade.brokerPositionId ?? trade.id) === "501")
          : false;
      });

    assert.deepEqual(
      pollutedOpen,
      [],
      "A's open position may never be written under B's open-trades key"
    );

    const pollutedAccount = ctx.fake
      .writesTo(bAccountKey)
      .filter((write) => JSON.parse(write.value)?.balance === 1000);

    assert.deepEqual(
      pollutedAccount,
      [],
      "A's balance may never be written under B's account key"
    );

    assert.equal(
      JSON.parse(ctx.fake.raw(bOpenKey) ?? "[]").some(
        (trade) => String(trade.brokerPositionId ?? trade.id) === "501"
      ),
      false,
      "B's stored open trades must not end up holding A's position"
    );
  });
});

// ============================================================
// 6. WRONG SERVER FALLBACK
// ============================================================

test("a live login on the wrong server may not take over the local record that shares its id", async () => {
  await withTradeScenario({ initialAccountId: ACCOUNT_B.id }, async (ctx) => {
    await ctx.answer(isAccountCall, accountBody("1001", "server-zzz", 999999));

    const view = ctx.latest();

    assert.equal(
      view.selectedAccountId,
      ACCOUNT_B.id,
      "a wrong-server login may not select the same-id local record"
    );
    assert.equal(
      ctx.sink.selections.length,
      0,
      "no selection change may be requested at all"
    );
    assert.notEqual(
      view.account.balance,
      999999,
      "a wrong-server login may not restamp the balance"
    );
    assert.equal(
      ctx.sink.events.includes("mt5AccountUpdated"),
      false,
      "a wrong-server login may not broadcast an account update"
    );
    assert.deepEqual(
      ctx.fake.writesTo("tradingAccounts"),
      [],
      "a wrong-server login may not rewrite the stored account list"
    );
  });
});

// ============================================================
// 7. BACKGROUND SYNC VS AN EXPLICIT SELECTION
//
// The provider polls the MT5 terminal on its own, so a response can arrive
// that describes an account other than the one the user chose
// (src/context/TradeContext.jsx:3437-3475). Choosing which account EdgeFinder
// works on belongs to the user, so the sync may report that other account but
// may not switch to it.
// ============================================================

test("a background MT5 account sync may not replace the explicitly selected account", async () => {
  await withTradeScenario({ initialAccountId: ACCOUNT_A.id }, async (ctx) => {
    // X = ACCOUNT_A is the account the user selected. Y = ACCOUNT_B is the
    // account the terminal happens to be logged into.
    assert.equal(
      ctx.latest().selectedAccountId,
      ACCOUNT_A.id,
      "the scenario starts from the user's explicit choice of X"
    );

    const answered = await ctx.answer(
      isAccountCall,
      accountBody("2002", "server-b", 7000)
    );

    assert.equal(
      answered.length,
      1,
      "the account request opened by the mount was answered with Y's identity"
    );

    assert.deepEqual(
      ctx.sink.selections,
      [],
      "a background account sync may not ask the journal to select another account"
    );

    assert.equal(
      ctx.latest().selectedAccountId,
      ACCOUNT_A.id,
      "X must still be the globally selected account after a sync that found Y"
    );

    assert.notEqual(
      ctx.latest().account.balance,
      7000,
      "and reporting Y may not stamp X's balance with Y's money"
    );

    // The invariant must not be paid for by killing the sync: a response that
    // describes the selected account still delivers its figures.
    const resync = await ctx.requestAccountSync(ACCOUNT_A.id);

    await ctx.resolve(resync, accountBody("1001", "server-a", 4321.5));

    assert.equal(
      ctx.latest().account.balance,
      4321.5,
      "the selected account's live balance must still update"
    );

    assert.equal(
      ctx.latest().selectedAccountId,
      ACCOUNT_A.id,
      "applying the selected account's own data must not move the selection either"
    );

    assert.deepEqual(
      ctx.sink.selections,
      [],
      "no sync response in this scenario may write the global selection"
    );
  });
});

// ============================================================
// 8. BACKGROUND SYNC WITH NOTHING SELECTED
//
// Nothing being selected is a decision, not an empty slot to fill: a live
// login that matches a saved record must not become the selected account on
// its own.
// ============================================================

test("a background MT5 account sync may not select an account when none is selected", async () => {
  await withTradeScenario(
    { initialAccountId: null, accounts: [ACCOUNT_A] },
    async (ctx) => {
      assert.equal(
        ctx.latest().selectedAccountId,
        null,
        "the scenario starts with no account selected"
      );

      assert.equal(
        ctx.fetch.countFor(isAccountCall),
        1,
        "the mount still asks the terminal what account it is on"
      );

      const answered = await ctx.answer(
        isAccountCall,
        accountBody("1001", "server-a", 4321.5)
      );

      assert.equal(
        answered.length,
        1,
        "the open account request was answered with a saved account's identity"
      );

      assert.deepEqual(
        ctx.sink.selections,
        [],
        "recognising a saved account from a live login may not select it"
      );

      assert.equal(
        ctx.latest().selectedAccountId,
        null,
        "the global pointer must still be null after the sync"
      );

      assert.equal(
        ctx.sink.events.includes("mt5AccountUpdated"),
        true,
        "the discovered account is still reported to the rest of the app"
      );

      assert.deepEqual(
        ctx.sink.selections,
        [],
        "reporting the discovered account must not be done by selecting it"
      );
    }
  );
});

// ============================================================
// 9. BACKGROUND SYNC THAT HAS TO CREATE A RECORD
//
// When the terminal reports a login no local record describes, the sync adds
// that account to the stored list and announces it — recording a discovered
// account is legitimate, choosing it for the user is not. This is the create
// arm of src/context/TradeContext.jsx:3001-3235, which selects the id it just
// invented.
// ============================================================

test("a background MT5 account sync may not select an account it had to create", async () => {
  await withTradeScenario(
    { initialAccountId: null, accounts: [ACCOUNT_A, ACCOUNT_B] },
    async (ctx) => {
      assert.equal(
        ctx.latest().selectedAccountId,
        null,
        "the scenario starts with no account selected"
      );

      // Login 3003 on server-c matches neither saved record, so the sync has
      // to take the branch that creates one.
      const answered = await ctx.answer(
        isAccountCall,
        accountBody("3003", "server-c", 2500)
      );

      assert.equal(
        answered.length,
        1,
        "the open account request was answered with an unknown login"
      );

      const storedAccounts = ctx.fake.read("tradingAccounts");

      assert.equal(
        storedAccounts.length,
        3,
        "the unknown live login is recorded as a third account"
      );

      assert.deepEqual(
        storedAccounts.slice(0, 2).map((account) => account.id),
        [ACCOUNT_A.id, ACCOUNT_B.id],
        "recording the new account may not disturb the saved ones"
      );

      const createdAccount = storedAccounts[2];

      // Identity fields of the record this login produced, so the test proves
      // the right account was created rather than some account appearing.
      assert.equal(createdAccount.id, "mt5-3003");
      assert.equal(createdAccount.mt5Login, "3003");
      assert.equal(createdAccount.mt5Server, "server-c");
      assert.equal(createdAccount.brokerAccountId, "3003");
      assert.equal(createdAccount.broker, "MT5");
      assert.equal(createdAccount.accountName, "MT5 Account 3003");
      assert.equal(createdAccount.balance, 2500);
      assert.equal(createdAccount.equity, 2500);
      assert.equal(
        createdAccount.isDefault,
        false,
        "a discovered account is not the default while saved accounts exist"
      );

      assert.equal(
        ctx.sink.events.includes("mt5AccountUpdated"),
        true,
        "the new account is still announced to the rest of the app"
      );

      // The invariant, asserted last so the checks above prove the create
      // branch really ran.
      assert.deepEqual(
        ctx.sink.selections,
        [],
        "creating an account from a live login may not select it"
      );

      assert.equal(
        ctx.latest().selectedAccountId,
        null,
        "the global pointer must still be null after the account was created"
      );
    }
  );
});

// ============================================================
// 10. WHAT DECLARES THE PRICE SOURCE
// ============================================================
//
// MarketContext holds one bid/ask pair with two producers, and it decides which
// may write from a source declaration it is handed from outside
// (src/context/MarketContext.jsx:1030, :1374-1461). The declaration comes from
// the broker of the explicitly selected account, read through the same identity
// authority the account-scoped storage keys use
// (src/context/TradeContext.jsx:1947-1955).
//
// What this section can prove is the seam: which selection produced which
// declaration, and what produced none. It cannot prove that a declaration
// protects the prices - the market double records declarations rather than
// applying them, and section 7 of marketBrokerSafety.runtime.test.js mounts the
// real MarketProvider to show what it does with one.
// ============================================================

test("explicitly selecting the saved cTrader account declares cTrader as the price source", async () => {
  await withTradeScenario(
    {
      initialAccountId: ACCOUNT_A.id,
      accounts: [ACCOUNT_A, ACCOUNT_CTRADER],
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.priceDeclarations(),
        ["mt5"],
        "the MT5 account this scenario starts on declares MT5, and nothing declares twice"
      );

      await ctx.switchAccount(ACCOUNT_CTRADER.id);

      // The whole array, not just its last entry: one declaration per explicit
      // selection, in the order the selections happened.
      assert.deepEqual(
        ctx.priceDeclarations(),
        ["mt5", "ctrader"],
        "the explicit switch to the cTrader account is what adds the cTrader declaration"
      );

      assert.deepEqual(
        ctx.latestDeclaration(),
        { source: "ctrader", selectedAccountId: ACCOUNT_CTRADER.id },
        "the cTrader declaration is stamped with the selection that caused it"
      );

      assert.deepEqual(
        ctx.sink.selections,
        [ACCOUNT_CTRADER.id],
        "and only the scenario's own explicit switch moved the selection"
      );
    }
  );
});

test("explicitly selecting the saved MT5 account declares MT5 as the price source", async () => {
  await withTradeScenario(
    {
      // The cTrader account is stored FIRST while the MT5 account is selected,
      // so a provider that read the stored list instead of the selection would
      // answer "ctrader" here.
      initialAccountId: ACCOUNT_CTRADER.id,
      accounts: [ACCOUNT_CTRADER, ACCOUNT_A],
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.priceDeclarations(),
        ["ctrader"],
        "the cTrader account this scenario starts on declares cTrader"
      );

      await ctx.switchAccount(ACCOUNT_A.id);

      assert.deepEqual(
        ctx.priceDeclarations(),
        ["ctrader", "mt5"],
        "switching to the MT5 account declares MT5 rather than keeping cTrader"
      );

      assert.deepEqual(
        ctx.latestDeclaration(),
        { source: "mt5", selectedAccountId: ACCOUNT_A.id },
        "the MT5 declaration is stamped with the selection that caused it"
      );
    }
  );
});

test("with no account selected no price source is declared", async () => {
  await withTradeScenario(
    { initialAccountId: null, accounts: [ACCOUNT_CTRADER, ACCOUNT_A] },
    async (ctx) => {
      assert.ok(
        ctx.priceDeclarations().length > 0,
        "the provider does speak to the market on mount, it simply has nothing to say"
      );

      assert.deepEqual(
        [...new Set(ctx.priceDeclarations())],
        [null],
        "with no selection every declaration is unasserted, so neither feed is silently enabled by the first, sole or default account"
      );

      assert.deepEqual(
        ctx.latestDeclaration(),
        { source: null, selectedAccountId: null },
        "the unasserted declaration is stamped with the absence that caused it"
      );

      // The mount schedules the MT5 account sync, and its response is the other
      // way a source could sneak in without a user choice.
      await ctx.answer(isAccountCall, accountBody("1001", "server-a", 1000));

      assert.deepEqual(
        [...new Set(ctx.priceDeclarations())],
        [null],
        "and answering the sync for an unselected app may not declare a source"
      );
    }
  );
});

test("a selected account the identity authority cannot name declares no price source", async () => {
  await withTradeScenario(
    {
      initialAccountId: ACCOUNT_A.id,
      accounts: [ACCOUNT_A, ACCOUNT_UNNAMEABLE],
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.priceDeclarations(),
        ["mt5"],
        "the MT5 account this scenario starts on declares MT5"
      );

      await ctx.switchAccount(ACCOUNT_UNNAMEABLE.id);

      assert.deepEqual(
        ctx.priceDeclarations(),
        ["mt5", null],
        "moving to an account whose broker is not in the vocabulary declares nothing, and does not guess from the account it replaced"
      );

      assert.deepEqual(
        ctx.latestDeclaration(),
        { source: null, selectedAccountId: ACCOUNT_UNNAMEABLE.id },
        "the unasserted declaration is stamped with the selection that caused it"
      );
    }
  );
});

test("a background MT5 account sync cannot declare a source for the account it found", async () => {
  await withTradeScenario(
    {
      initialAccountId: ACCOUNT_A.id,
      accounts: [ACCOUNT_A, ACCOUNT_CTRADER],
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.priceDeclarations(),
        ["mt5"],
        "the scenario starts on the explicitly selected MT5 account"
      );

      // Login 3003 on server-c matches neither saved record, so the sync takes
      // the arm that creates a third account and announces it.
      const answered = await ctx.answer(
        isAccountCall,
        accountBody("3003", "server-c", 2500)
      );

      assert.equal(
        answered.length,
        1,
        "the account request opened by the mount was answered with an unknown login"
      );

      const storedAccounts = ctx.fake.read("tradingAccounts");

      // Without these two the last assertion would only prove that nothing
      // happened: they show the create arm really ran. Note what it does NOT
      // do - TradeContext keeps no React account-list state, it re-reads
      // storage on every sync (src/context/TradeContext.jsx:2843), so
      // discovering an account rewrites storage and dispatches an event
      // without re-rendering this provider
      // (src/context/TradeContext.jsx:3205-3226). What is under test is
      // therefore what the sync pushes AT the market, not what it renders.
      assert.equal(
        storedAccounts.length,
        3,
        "the unknown live login was recorded as a third account"
      );

      assert.equal(
        ctx.sink.events.includes("mt5AccountUpdated"),
        true,
        "and announced to the rest of the app"
      );

      assert.deepEqual(
        ctx.priceDeclarations(),
        ["mt5"],
        "neither recording nor announcing an account may re-declare the price source for data the user never selected"
      );

      assert.deepEqual(
        ctx.sink.selections,
        [],
        "and the selection the declaration is built from never moved"
      );
    }
  );
});
