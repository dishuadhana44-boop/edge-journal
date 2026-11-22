// ============================================================
// TRADING ACCOUNTS PAGE - EXPLICIT SELECTION ONLY (Task 10, Step 1)
// ============================================================
//
// THE RULE THESE TESTS EXIST FOR
//
//   Saving an account list, opening the Trading Accounts page, and looking at
//   one of those accounts are three different things from choosing the account
//   the journal works on. The global selection (JournalContext
//   "selectedAccountId", mirrored into localStorage under the same key) changes
//   only when the user activates a row's selection control. S1 to S5 pin which
//   element carries that activation, and S6 pins what the other control in a row
//   reports about the preference it holds; every other scenario here reads the
//   rule, not the element.
//
//   T1 and T2 measure that rule across a mount, T3 is the one path that is
//   allowed to write, T4 measures it across a deletion, C1/C2 hold the two
//   halves a fix must not lose or overshoot - an earlier choice survives the
//   mount, and deleting an account nobody chose moves nothing - and E1/E2
//   measure it against the MT5 update event and E3/E4 against the cTrader one,
//   each of which reaches the page with no click behind it at all. D1 and D2
//   measure it against the Default star: the one control that sits inside a row
//   and must move that row's preference without choosing the row it is drawn on.
//   D1 and D2 reach that star by mouse, K1, K2, K3 and K4 by keyboard. S1 to S5
//   read the sidebar's own structure: the account name is the control that
//   chooses, and the star and the trash sit beside it rather than inside it. S6
//   reads what that star reports, which is the half no scenario before it looked
//   at.
//
// WHAT IS REAL HERE
//
//   - src/components/settings/TradingAccountsPage.jsx is bundled from disk and
//     mounted with the installed React 19 runtime in a jsdom document, in the
//     same in-memory pattern as brokerIntegrationPage.runtime.test.js.
//   - src/components/settings/TradingAccountsSidebar.jsx and
//     TradingAccountsView.jsx are real, so every click below lands on the same
//     buttons and rows a user sees, and the panel text is produced by the code
//     that ships.
//   - src/lib/brokerAccountIdentity.js is real, both inside the bundle and for
//     the fixture builder below, so the seeded storage is exactly what a
//     migrated user's "tradingAccounts" key holds.
//
// WHAT IS SUBSTITUTED, AND WHY
//
//   - lucide-react, framer-motion: no icon package or animation runtime has any
//     business running in a Node process.
//   - src/context/JournalContext.jsx: a fake that keeps the selection in one
//     place, writes and removes the "selectedAccountId" key exactly like the
//     real setter, and re-renders subscribers - so a global selection write is
//     evidence rather than a side effect inside a provider that would also read
//     and write the real journal storage.
//   - src/services/brokerApi.js: this page only builds an OAuth URL when the
//     user presses Connect, which is Task 10 scope nowhere. The fake records any
//     call, and every scenario asserts the record stayed empty.
//   - TradingAccountsEdit, AddTradingAccountModal, MT5ConnectionModal: the edit
//     form and both connection workflows belong to other suites and to other
//     tasks; the MT5 modal in particular posts with fetch. E1 to E4 are not
//     those workflows - they dispatch the window events the two syncs fire and
//     read what the page's own listeners do with them, which touches no
//     transport.
//   - localStorage: a working in-memory fake that records every set and remove,
//     because "opening this page persisted nothing" is the second half of the
//     rule above.
//
// ISOLATION, STATED EXACTLY
//
//   - No runScripts and no resources:"usable" on the JSDOM instance.
//   - fetch, XMLHttpRequest, WebSocket, EventSource and setInterval on both
//     globalThis and the jsdom window throw and are recorded.
//   - The jsdom window is closed in finally and every installed descriptor is
//     restored in reverse order.
//   - After every mount the runner asserts the token sentinel never reached the
//     DOM and that React logged no error.
//
// WHAT THIS CANNOT PROVE
//
// jsdom with a fake context proves this page's state machine: what it writes to
// the global selection, when, and what it renders. It proves nothing about a
// real browser session, about CSS, or about the other pages that read the same
// storage keys - those are reached through the shared keys, not through a live
// listener here.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

import { migrateTradingAccounts } from "./brokerAccountIdentity.js";

const nodeRequire = createRequire(import.meta.url);

const NATIVE_SET_TIMEOUT = globalThis.setTimeout;

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

const PAGE_FILE = "src/components/settings/TradingAccountsPage.jsx";

const ACCOUNTS_KEY = "tradingAccounts";
const SELECTION_KEY = "selectedAccountId";

// A value that belongs only in a broker payload. The page has no business
// rendering it, and a saved cTrader account here carries it.
const SECRET = "FAKE_SECRET_TOKEN";

const ALPHA_ID = "alpha-manual";
const BETA_ID = "beta-ctrader";
const GAMMA_ID = "gamma-manual";

// Two saved MT5 accounts. The background MT5 sync reports one of them while the
// user works on the other, so an update arriving for "someone else's account"
// has a real broker identity to be matched against.
const ECHO_ID = "mt5-1001";
const FOXTROT_ID = "mt5-2002";

// The same pair on the other platform, because the cTrader update event is a
// different listener with a different merge and its own selection bug.
const GOLF_ID = "golf-ctrader";
const HOTEL_ID = "hotel-ctrader";

// ============================================================
// FIXTURES
// ============================================================

function alphaAccount() {
  return {
    id: ALPHA_ID,
    accountName: "Alpha Manual",
    accountType: "Manual",
    currency: "USD",
    startingBalance: 1000,
    balance: 1000,
    isDefault: true,
  };
}

function betaAccount() {
  return {
    id: BETA_ID,
    accountName: "Beta cTrader",
    accountType: "Live",
    broker: "cTrader",
    brokerAccountId: 395823,
    accessToken: SECRET,
    currency: "USD",
    startingBalance: 2000,
    balance: 2000,
  };
}

function gammaAccount() {
  return {
    id: GAMMA_ID,
    accountName: "Gamma Manual",
    accountType: "Manual",
    currency: "USD",
    startingBalance: 3000,
    balance: 3000,
  };
}

// Saved MT5 accounts, field for field as the sync leaves them in
// "tradingAccounts": broker plus login is the identity, and the id carries the
// mt5- prefix that identity was derived from.
function echoAccount() {
  return {
    id: ECHO_ID,
    accountName: "Echo MT5 1001",
    accountType: "MT5",
    currency: "USD",
    startingBalance: 5000,
    balance: 5000,
    equity: 5000,
    leverage: 100,
    isDefault: false,
    isBrokerAccount: true,
    broker: "MT5",
    brokerAccountId: "1001",
    connectionStatus: "connected",
    mt5Login: "1001",
    mt5Server: "server-a",
    mt5Connected: true,
    mt5TerminalId: null,
    strategyId: null,
    strategyName: null,
    marginUsed: 10,
    freeMargin: 4990,
    floatingPnL: 0,
    lastSynced: "2026-11-14T09:00:00.000Z",
    createdAt: "2026-11-01T09:00:00.000Z",
  };
}

function foxtrotAccount() {
  return {
    ...echoAccount(),
    id: FOXTROT_ID,
    accountName: "Foxtrot MT5 2002",
    brokerAccountId: "2002",
    mt5Login: "2002",
    mt5Server: "server-b",
    startingBalance: 6000,
    balance: 6000,
    equity: 6000,
    marginUsed: 20,
    freeMargin: 5980,
  };
}

// What the terminal reported for each login while the user was on the other
// one. Fixed strings, because a sync that stamps lastSynced must still be
// recognizable in storage afterwards.
const LIVE_FOXTROT = Object.freeze({
  balance: 7777.5,
  equity: 8123.25,
  marginUsed: 30,
  freeMargin: 8093.25,
  floatingPnL: 45.75,
  leverage: 100,
  currency: "USD",
  lastSynced: "2026-11-14T09:30:00.000Z",
});

const LIVE_ECHO = Object.freeze({
  balance: 5250.5,
  equity: 5400.75,
  marginUsed: 25,
  freeMargin: 5375.75,
  floatingPnL: 50.25,
  leverage: 100,
  currency: "USD",
  lastSynced: "2026-11-14T09:30:00.000Z",
});

// The event payload, built from the producer rather than invented:
// src/context/TradeContext.jsx:2918-2980 spreads the stored record, restates
// the live identity fields, replaces the numbers and re-stamps lastSynced.
function mt5SyncedAccount(account, live) {
  return {
    ...account,
    mt5Connected: true,
    isBrokerAccount: true,
    broker: "MT5",
    brokerAccountId: account.mt5Login,
    connectionStatus: "connected",
    balance: live.balance,
    equity: live.equity,
    marginUsed: live.marginUsed,
    freeMargin: live.freeMargin,
    floatingPnL: live.floatingPnL,
    leverage: live.leverage,
    currency: live.currency,
    lastSynced: live.lastSynced,
  };
}

// Saved cTrader accounts, as the platform's own save path leaves them in
// "tradingAccounts": broker plus the login as a string is the identity
// (src/components/settings/BrokerIntegrationPage.jsx:247-261 builds exactly
// these four fields), and the token the legacy record carried is the sentinel
// the DOM may never show.
function golfAccount() {
  return {
    id: GOLF_ID,
    accountName: "Golf cTrader 771201",
    accountType: "Live",
    currency: "USD",
    startingBalance: 20000,
    balance: 20000,
    equity: 20000,
    leverage: 100,
    isDefault: false,
    isBrokerAccount: true,
    broker: "cTrader",
    brokerAccountId: "771201",
    connectionStatus: "connected",
    marginUsed: 35,
    freeMargin: 19965,
    floatingPnL: 0,
    accessToken: SECRET,
    lastSynced: "2026-11-13T09:00:00.000Z",
    createdAt: "2026-11-01T09:00:00.000Z",
  };
}

function hotelAccount() {
  return {
    ...golfAccount(),
    id: HOTEL_ID,
    accountName: "Hotel cTrader 771302",
    brokerAccountId: "771302",
    startingBalance: 30000,
    balance: 30000,
    equity: 30000,
    marginUsed: 75,
    freeMargin: 29925,
  };
}

const LIVE_HOTEL = Object.freeze({
  balance: 31250.75,
  equity: 31891,
  marginUsed: 75,
  freeMargin: 31816,
  floatingPnL: 640.25,
  leverage: 100,
  currency: "USD",
});

const LIVE_GOLF = Object.freeze({
  balance: 19540.25,
  equity: 19120,
  marginUsed: 35,
  freeMargin: 19085,
  floatingPnL: -420.25,
  leverage: 100,
  currency: "USD",
});

// The cTrader update event, field for field as the sync path reports it:
// TradingAccountsPage.jsx:997-1005 hands whatever the sync returned straight
// into the event, and BrokerIntegrationPage.jsx:777-802 announces the record as
// it now stands. Two things are absent on purpose. No token, because a report
// is an allowlist and never a response copy. No lastSynced, because the page's
// own listener replaces it with new Date() at
// src/components/settings/TradingAccountsPage.jsx:720, so no scenario below can
// assert that stamp as a value - only that it moved.
function ctraderSyncedAccount(account, live) {
  return {
    id: account.id,
    accountName: account.accountName,
    accountType: account.accountType,
    broker: "cTrader",
    brokerAccountId: account.brokerAccountId,
    isBrokerAccount: true,
    connectionStatus: "connected",
    currency: live.currency,
    startingBalance: account.startingBalance,
    balance: live.balance,
    equity: live.equity,
    leverage: live.leverage,
    marginUsed: live.marginUsed,
    freeMargin: live.freeMargin,
    floatingPnL: live.floatingPnL,
    createdAt: account.createdAt,
  };
}

// The list is written back by the page itself after it migrates, so a seed that
// was never migrated would make the mount persist and this suite would be
// reading its own fixture instead of the page's behaviour.
function seedStorage(accounts) {
  return {
    [ACCOUNTS_KEY]: JSON.stringify(
      migrateTradingAccounts(accounts).accounts
    ),
  };
}

function seedIds(accounts) {
  return accounts.map((account) => account.id);
}

// ============================================================
// GATE
// ============================================================
//
// Checked before anything is bundled so a page that stopped rendering the real
// rows fails as this sentence rather than as a missing button deep in a
// scenario.

function readPage() {
  assert.equal(
    existsSync(`${repoRoot}/${PAGE_FILE}`),
    true,
    `the page must exist on disk at ${PAGE_FILE}`,
  );

  return readFileSync(`${repoRoot}/${PAGE_FILE}`, "utf8");
}

function assertPageSourceContract() {
  const source = readPage();
  const problems = [];

  if (!/from "\.\/TradingAccountsSidebar"/u.test(source)) {
    problems.push("the page must render the real TradingAccountsSidebar");
  }

  if (!/from "\.\/TradingAccountsView"/u.test(source)) {
    problems.push("and the real TradingAccountsView");
  }

  if (!/setSelectedAccountId/u.test(source)) {
    problems.push(
      "and must reach the global selection through the journal setter",
    );
  }

  if (/fetch\(/u.test(source)) {
    problems.push("but the page must not reach the network itself");
  }

  assert.deepEqual(
    problems,
    [],
    "the Trading Accounts page must keep the shape this suite mounts",
  );
}

// ============================================================
// STUBS
// ============================================================

const REACT_IMPORT =
  'import { createElement, useState, useEffect } from "react";\n';

function iconStub(names) {
  return `${REACT_IMPORT}
const icon = (name) => function Icon() {
  return createElement("svg", { "data-icon": name });
};
${names.map((name) => `export const ${name} = icon("${name}");`).join("\n")}`;
}

// A superset of the icons the page and its two real children import. Anything
// outside this list fails the build with "No matching export", which is the
// signal to widen the stub deliberately rather than silently.
const LUCIDE_NAMES = [
  "BadgeCheck",
  "CheckCircle2",
  "CircleDollarSign",
  "Landmark",
  "Link2",
  "Pencil",
  "Plus",
  "RefreshCw",
  "Server",
  "Star",
  "Trash2",
  "Unplug",
  "UserRound",
  "Wallet",
];

// framer-motion only ever adds animation to a node here. Passing the child
// through and dropping the animation props keeps the DOM a plain div, which is
// what a settled panel is anyway.
const MOTION_PROPS = [
  "initial",
  "animate",
  "exit",
  "transition",
  "whileHover",
  "whileTap",
  "variants",
  "custom",
];

function motionStub() {
  return `${REACT_IMPORT}
const plain = (props) => {
  const rest = { ...props };

  for (const key of ${JSON.stringify(MOTION_PROPS)}) {
    delete rest[key];
  }

  return rest;
};

export const AnimatePresence = ({ children }) => children;

export const motion = new Proxy({}, {
  get(_target, tag) {
    if (typeof tag !== "string") return undefined;

    return function Motion(props) {
      return createElement(tag, plain(props));
    };
  },
});`;
}

// Only the two exports the page reads. A call is recorded, and every scenario
// below asserts the record is empty: this page owns no request.
const API_NAMES = ["ctraderConnectUrl"];

const BACKEND_URL_NOT_CONFIGURED_MESSAGE =
  "The broker backend URL is not configured in this build, so EdgeFinder cannot reach the trading service. Set VITE_API_URL when building for a deployed site.";

function brokerApiStub() {
  return `export const BACKEND_URL_NOT_CONFIGURED_MESSAGE = ${JSON.stringify(
    BACKEND_URL_NOT_CONFIGURED_MESSAGE,
  )};
${API_NAMES.map(
  (name) => `export const ${name} = (...args) => {
  globalThis.__pageBrokerApi.calls.push({ name: "${name}", args });

  throw new Error("the Trading Accounts page reached the broker transport through ${name}");
};`,
).join("\n")}`;
}

// The real context holds the selection in provider state, mirrors it into
// localStorage, and removes the key for a null selection. The fake is the same
// three facts with the writes recorded, and it re-renders the subscriber the way
// a context value change does, so a second render driven by the page's own write
// is part of what these scenarios observe.
function journalStub() {
  return `${REACT_IMPORT}
export function useJournal() {
  const store = globalThis.__pageJournal;

  if (!store) {
    throw new Error("the page read the journal selection without a fake context");
  }

  const [selectedAccountId, notify] = useState(() => store.get());

  useEffect(() => {
    store.subscribe(notify);
    notify(store.get());

    return () => store.unsubscribe(notify);
  }, []);

  return {
    selectedAccountId,
    setSelectedAccountId: store.set,
  };
}`;
}

function markerStub(name) {
  return `${REACT_IMPORT}
export default function ${name}() {
  return createElement("div", { "data-stub": ${JSON.stringify(name)} });
}`;
}

const STUBS = Object.freeze({
  lucide: iconStub(LUCIDE_NAMES),
  motion: motionStub(),
  brokerApi: brokerApiStub(),
  journal: journalStub(),
  edit: markerStub("TradingAccountsEdit"),
  addModal: markerStub("AddTradingAccountModal"),
  mt5Modal: markerStub("MT5ConnectionModal"),
});

const SUBSTITUTIONS = Object.freeze([
  [/^lucide-react$/, "lucide"],
  [/^framer-motion$/, "motion"],
  [/services\/brokerApi(\.js)?$/, "brokerApi"],
  [/context\/JournalContext(\.jsx)?$/, "journal"],
  [/TradingAccountsEdit(\.jsx)?$/, "edit"],
  [/AddTradingAccountModal(\.jsx)?$/, "addModal"],
  [/MT5ConnectionModal(\.jsx)?$/, "mt5Modal"],
]);

function stubPlugin(substitutions) {
  return {
    name: "edgeflo-trading-accounts-stubs",
    setup(build) {
      for (const [filter, key] of substitutions) {
        build.onResolve({ filter }, () => ({
          path: key,
          namespace: "edgeflo-page-stub",
        }));
      }

      build.onLoad(
        { filter: /.*/, namespace: "edgeflo-page-stub" },
        (args) => ({
          contents: STUBS[args.path],
          loader: "js",
          resolveDir: `${repoRoot}/src`,
        }),
      );
    },
  };
}

// ============================================================
// BUNDLE
// ============================================================

const ENTRY =
  'export { default as TradingAccountsPage } from "./components/settings/TradingAccountsPage.jsx";';

async function buildPageBundle() {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "tradingAccountsSelectionRuntimeEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    define: {
      "import.meta.env": JSON.stringify({ VITE_API_URL: "http://127.0.0.1:4000" }),
    },
    plugins: [stubPlugin(SUBSTITUTIONS)],
    external: ["react", "react/jsx-runtime", "react-dom/client"],
  });

  assert.equal(result.outputFiles.length, 1, "the harness must stay in memory");

  return {
    code: result.outputFiles[0].text,
    inputs: Object.keys(result.metafile.inputs).sort(),
  };
}

let sharedPromise = null;

function loadSharedModules() {
  if (sharedPromise === null) {
    sharedPromise = Promise.resolve().then(() => ({
      react: nodeRequire("react"),
      "react/jsx-runtime": nodeRequire("react/jsx-runtime"),
      "react-dom/client": nodeRequire("react-dom/client"),
    }));
  }

  return sharedPromise;
}

function evaluateBundle(code, shared) {
  const loaded = { exports: {} };

  const guardedRequire = (specifier) => {
    const supplied = shared[specifier];

    assert.ok(
      supplied,
      `a page bundle may only require shared React modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(
    guardedRequire,
    loaded,
    loaded.exports,
  );

  return loaded.exports;
}

// ============================================================
// FAKE STORAGE, TRANSPORT AND JOURNAL
// ============================================================

function normalizeId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value);
}

function createFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];

  return {
    writes,
    data,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      writes.push({ type: "set", key, value: String(value) });

      data.set(key, String(value));
    },
    removeItem(key) {
      writes.push({ type: "remove", key });

      data.delete(key);
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    clear() {
      throw new Error("the page must not clear storage");
    },
    get length() {
      return data.size;
    },
  };
}

function createFakeApi() {
  return { calls: [] };
}

function createFakeJournalStore(storage) {
  const listeners = new Set();
  const selection = [];

  let value = normalizeId(storage.getItem(SELECTION_KEY));

  const set = (accountId) => {
    const next = normalizeId(accountId);

    selection.push(next);

    if (next === null) {
      storage.removeItem(SELECTION_KEY);
    } else {
      storage.setItem(SELECTION_KEY, next);
    }

    if (next !== value) {
      value = next;

      for (const listener of listeners) {
        listener(value);
      }
    }
  };

  return {
    selection,
    get: () => value,
    set,
    subscribe: (listener) => listeners.add(listener),
    unsubscribe: (listener) => listeners.delete(listener),
  };
}

// ============================================================
// SCENARIO RUNNER
// ============================================================

const TRANSPORT_GLOBALS = Object.freeze([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "setInterval",
]);

const DOM_GLOBAL_CANDIDATES = Object.freeze([
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "Element",
  "Node",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "getComputedStyle",
]);

// The delete control of a sidebar row: the real labelled button, still checked
// for the trash icon so a row is never mistaken for its own action.
function deleteButtonsOf(node) {
  return [...node.querySelectorAll('button[aria-label^="Delete"]')].filter(
    (button) => button.querySelector('svg[data-icon="Trash2"]') !== null,
  );
}

// The Default control of a sidebar row: the same shape of locator, named by its
// accessible label and confirmed by the star inside it, so a row that stopped
// rendering the control - or renders the icon without the button around it - is
// reported here as a missing button instead of as a storage assertion that
// mysteriously still passes.
function defaultButtonsOf(node) {
  return [...node.querySelectorAll('button[aria-label^="Set "]')].filter(
    (button) => button.querySelector('svg[data-icon="Star"]') !== null,
  );
}

// The selection control of a sidebar row, and the reason it is confirmed the way
// the other two are: a row that lost the control must be reported here as a
// missing control, not as a click that silently selected nothing. Its identity is
// the account name itself, so the label is checked against the row's own heading
// rather than against a name the caller happened to pass.
function selectButtonsOf(node) {
  const heading = node.querySelector("h3");
  const accountName = heading === null ? "" : heading.textContent.trim();

  if (accountName === "") {
    return [];
  }

  return [...node.querySelectorAll('button[aria-label^="Select "]')].filter(
    (button) =>
      button.getAttribute("aria-label") === `Select ${accountName}` &&
      button.textContent.includes(accountName),
  );
}

async function withPage(options, scenario) {
  const { storage = {}, url = "http://localhost/settings" } = options ?? {};

  // The gate runs before anything is bundled, so a page that no longer renders
  // the real rows fails as an assertion instead of as a missing button.
  assertPageSourceContract();

  const fakeStorage = createFakeStorage(storage);
  const journalFake = createFakeJournalStore(fakeStorage);
  const apiFake = createFakeApi();

  const touched = [];
  const logged = { log: [], error: [], warn: [] };

  const globalSelection = journalFake.selection;

  let root = null;
  let scenarioFailure = null;
  let teardownFailure = null;

  const restoreSteps = [];

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

  function tripwire(target, label, names) {
    for (const name of names) {
      define(target, name, {
        configurable: true,
        enumerable: true,
        get() {
          touched.push(`${label}.${name}`);

          throw new Error(`the page reached ${label}.${name} directly`);
        },
      });
    }
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  const win = dom.window;

  const ctx = {
    React: null,
    Page: null,
    container: null,
    apiCalls: apiFake.calls,
    globalSelection,
    storageWrites: fakeStorage.writes,
    selectionWrites: () =>
      fakeStorage.writes.filter((write) => write.key === SELECTION_KEY),
    stored(key) {
      return fakeStorage.data.has(key) ? fakeStorage.data.get(key) : null;
    },
    savedIds() {
      const saved = ctx.stored(ACCOUNTS_KEY);

      return saved === null ? null : JSON.parse(saved).map((a) => a.id);
    },
    // The merged list as the next page load will see it: read back out of
    // storage after the page's own save effect has run, not out of a render.
    savedAccounts() {
      const saved = ctx.stored(ACCOUNTS_KEY);

      assert.notEqual(saved, null, "the saved list must still be in storage");

      return JSON.parse(saved);
    },
    saved(id) {
      const matches = ctx.savedAccounts().filter((account) => account.id === id);

      assert.equal(
        matches.length,
        1,
        `exactly one saved account must carry ${id}, got ${matches.length}`,
      );

      return matches[0];
    },
    html() {
      return ctx.container.innerHTML;
    },
    findAll(selector) {
      return [...ctx.container.querySelectorAll(selector)];
    },
    row(accountName) {
      const rows = ctx.rows().filter((node) =>
        node.textContent.includes(accountName),
      );

      assert.equal(
        rows.length,
        1,
        `exactly one sidebar row must render ${accountName}, got ${rows.length}`,
      );

      return rows[0];
    },
    // An account row is a list item that holds exactly one labelled delete
    // button, so the delete control identifies the row without the row having to
    // be a control itself. The selection control is deliberately NOT part of this
    // filter: rows() finding nothing then means "no listitem role", and
    // selectControl() finding nothing means "no selection control", and a
    // scenario that conflated the two would report the wrong half of a broken
    // sidebar. Document order is the saved order, which is what rowNames() is
    // asserted against.
    rows() {
      return ctx.findAll('[role="listitem"]').filter(
        (node) => deleteButtonsOf(node).length === 1,
      );
    },
    rowNames() {
      return ctx.rows().map((node) => node.querySelector("h3").textContent);
    },
    deleteIcon(accountName) {
      const [button] = deleteButtonsOf(ctx.row(accountName));

      assert.ok(button, `the ${accountName} row must render its delete icon`);

      return button;
    },
    // The star renders on every row, default or not, so a row that lost the
    // control - or lost the button around the icon - is a count of zero here.
    defaultStar(accountName) {
      const stars = defaultButtonsOf(ctx.row(accountName));

      assert.equal(
        stars.length,
        1,
        `the ${accountName} row must render exactly one Default star button, got ${stars.length}`,
      );

      return stars[0];
    },
    // The one control in a row that chooses the account the journal works on.
    // Every selection-state read in this suite goes through here, so a row that
    // carries that state somewhere else - on the card around the control, which
    // is where this suite used to read it - fails as a missing control rather
    // than as a state nobody can find.
    selectControl(accountName) {
      const controls = selectButtonsOf(ctx.row(accountName));

      assert.equal(
        controls.length,
        1,
        `the ${accountName} row must render exactly one selection button, got ${controls.length}`,
      );

      return controls[0];
    },
    // Every row's selection state, read from the control that owns it, in the
    // order the rows are listed. A scenario that means "nothing was chosen here"
    // says it about this vector rather than about the one row it happened to
    // touch, so a control that started reporting pressed for an account the user
    // never activated cannot pass by being the row nobody looked at.
    pressedVector() {
      const rows = ctx.rows();

      // A vector of nothing would compare equal to a vector of nothing, and a
      // scenario reading it would report that nothing moved when the real fault
      // is that nothing was found to read.
      assert.ok(
        rows.length > 0,
        "the pressed state can only be read from rows that are listed",
      );

      return rows.map((node) => {
        const accountName = node.querySelector("h3").textContent;

        return `${accountName}:${ctx.pressedStateOf(ctx.selectControl(accountName), accountName, "selection")}`;
      });
    },
    // The same presence discipline for the star, whose reported state is what a
    // screen reader reads as "this is the account the preference points at".
    defaultVector() {
      const rows = ctx.rows();

      assert.ok(
        rows.length > 0,
        "the default state can only be read from rows that are listed",
      );

      return rows.map((node) => {
        const accountName = node.querySelector("h3").textContent;

        return `${accountName}:${ctx.pressedStateOf(ctx.defaultStar(accountName), accountName, "default")}`;
      });
    },
    // One control's pressed state, read as the two strings it is allowed to be.
    // A missing attribute reads as null, and null is not a state: a scenario
    // that only compared two vectors would find "no aria-pressed anywhere"
    // perfectly stable, which is a gap the 5F.3(c)-7 probes measured rather than
    // guessed at.
    pressedStateOf(control, accountName, kind) {
      const pressed = control.getAttribute("aria-pressed");

      assert.ok(
        pressed === "true" || pressed === "false",
        `the ${accountName} ${kind} control must report aria-pressed as "true" or "false", got ${pressed}`,
      );

      return pressed;
    },
    modalButton(label) {
      const buttons = ctx.findAll("button").filter(
        (node) => node.textContent.trim() === label,
      );

      assert.equal(
        buttons.length,
        1,
        `the delete confirmation must render exactly one ${label} button, got ${buttons.length}`,
      );

      return buttons[0];
    },
    panelField(label) {
      const labels = ctx.findAll("p").filter(
        (node) => node.textContent.trim() === label,
      );

      assert.equal(
        labels.length,
        1,
        `the account panel must render exactly one ${label} field, got ${labels.length}`,
      );

      const value = labels[0].nextElementSibling;

      assert.equal(
        value ? value.tagName : null,
        "H2",
        `the ${label} field must be followed by its value`,
      );

      return value.textContent.trim();
    },
    isEmptyPanel() {
      return ctx.findAll("h3").some(
        (node) => node.textContent.trim() === "No Trading Account",
      );
    },
    drain() {
      return new Promise((resolve) => {
        NATIVE_SET_TIMEOUT(resolve, 0);
      });
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    async click(node) {
      await ctx.act(async () => {
        node.click();

        await ctx.drain();
        await ctx.drain();
      });
    },
    // The click a user means when they mean "that account", aimed at the control
    // that carries the selection state. It is aimed at the control and not at the
    // card around it because a card that is not a control cannot be clicked
    // reliably, and because a click that lands on the control and bubbles to a
    // handler on the card would be the second selection write T3 refuses.
    async clickRow(accountName) {
      await ctx.click(ctx.selectControl(accountName));
    },
    async clickDeleteIcon(accountName) {
      await ctx.click(ctx.deleteIcon(accountName));
    },
    async clickDefaultStar(accountName) {
      await ctx.click(ctx.defaultStar(accountName));
    },
    // Keyboard, not mouse: a real bubbling, cancelable KeyboardEvent aimed at
    // the rendered control, so only the page's own key handlers can answer it.
    // jsdom synthesises no click from a key press - measured, not assumed - so
    // these scenarios state what the authored handlers do and never what a
    // browser would add on top. The two drains are the same flush ctx.click uses.
    // `repeat` is the flag a held-down key carries, and the only thing that
    // separates K3's press from K1's. The event itself comes back so a scenario
    // can read what the page's handlers did to it - `defaultPrevented` is the
    // only way to see a cancel, because nothing else on this page changes when a
    // key is refused. React's synthetic preventDefault calls through to the
    // native event, so the flag on the object dispatched here is the flag the
    // handler set.
    async press(node, type, key, repeat = false) {
      let event = null;

      await ctx.act(async () => {
        event = new win.KeyboardEvent(type, {
          key,
          bubbles: true,
          cancelable: true,
          repeat,
        });

        node.dispatchEvent(event);

        await ctx.drain();
        await ctx.drain();
      });

      return event;
    },
    // Focusable as a native button means focus lands with no tabIndex and no
    // help from the row around it.
    focusDefaultStar(accountName) {
      const button = ctx.defaultStar(accountName);

      button.focus();

      assert.equal(
        ctx.container.ownerDocument.activeElement,
        button,
        `the ${accountName} Default star must take focus as a native button`,
      );

      return button;
    },
    // The background MT5 sync reaches this page only through a window event, so
    // dispatching it is the way to run the page's own listener. The two drains
    // are the same flush ctx.click uses: the merge, its save and any re-render
    // it causes all land before the scenario reads the result.
    async dispatch(eventName, detail) {
      await ctx.act(async () => {
        win.dispatchEvent(new win.CustomEvent(eventName, { detail }));

        await ctx.drain();
        await ctx.drain();
      });
    },
  };

  try {
    tripwire(globalThis, "globalThis", TRANSPORT_GLOBALS);
    tripwire(win, "window", TRANSPORT_GLOBALS);

    for (const name of DOM_GLOBAL_CANDIDATES) {
      if (name in win) {
        define(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: win[name],
        });
      }
    }

    for (const name of ["localStorage", "sessionStorage"]) {
      define(globalThis, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: fakeStorage,
      });

      define(win, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: fakeStorage,
      });
    }

    define(globalThis, "indexedDB", {
      configurable: true,
      enumerable: true,
      get() {
        touched.push("globalThis.indexedDB");

        throw new Error("the page must not use indexedDB");
      },
    });

    define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });

    define(globalThis, "__pageBrokerApi", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: apiFake,
    });

    define(globalThis, "__pageJournal", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: journalFake,
    });

    const shared = await loadSharedModules();

    ctx.React = shared.react;

    assert.equal(typeof shared.react.act, "function", "React 19 must expose act");
    assert.equal(
      typeof shared["react-dom/client"].createRoot,
      "function",
      "react-dom/client must expose createRoot",
    );

    const natives = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    console.log = (...args) => logged.log.push(args.map(String).join(" "));
    console.error = (...args) => logged.error.push(args.map(String).join(" "));
    console.warn = (...args) => logged.warn.push(args.map(String).join(" "));

    restoreSteps.push(() => {
      console.log = natives.log;
      console.error = natives.error;
      console.warn = natives.warn;
    });

    const built = await buildPageBundle();

    ctx.Page = evaluateBundle(built.code, shared).TradingAccountsPage;

    const container = win.document.createElement("div");

    win.document.body.appendChild(container);

    ctx.container = container;
    root = shared["react-dom/client"].createRoot(container);

    await ctx.act(async () => {
      root.render(ctx.React.createElement(ctx.Page));

      await ctx.drain();
      await ctx.drain();
    });

    await scenario(ctx);

    assert.equal(
      ctx.html().includes(SECRET),
      false,
      "the page must never render a token that belongs to a broker payload",
    );
  } catch (error) {
    scenarioFailure = error;
  } finally {
    define(globalThis, "__pageBrokerApi", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined,
    });

    define(globalThis, "__pageJournal", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined,
    });

    if (root !== null) {
      try {
        await ctx.React.act(async () => {
          root.unmount();
        });
      } catch (error) {
        teardownFailure = error;
      }

      root = null;
    }

    try {
      win.close();
    } catch (error) {
      teardownFailure = teardownFailure ?? error;
    }

    for (let index = restoreSteps.length - 1; index >= 0; index -= 1) {
      restoreSteps[index]();
    }
  }

  if (scenarioFailure) {
    throw scenarioFailure;
  }

  if (teardownFailure) {
    throw teardownFailure;
  }

  assert.deepEqual(
    touched,
    [],
    "this page owns no transport: nothing it renders may reach the network",
  );

  assert.deepEqual(
    ctx.apiCalls,
    [],
    "and no call may reach the broker API module either",
  );

  assert.deepEqual(logged.error, [], "rendering must not log a React error");
}

// ============================================================
// HARNESS HONESTY
// ============================================================
//
// These two are about the fixtures and the bundle, not the page's selection
// rule, and they run first so a RED below can only mean the rule.

test("the seeded list is already migrated, so a mount persists nothing of its own", () => {
  const seed = seedStorage([alphaAccount(), betaAccount(), gammaAccount()]);
  const saved = JSON.parse(seed[ACCOUNTS_KEY]);

  assert.equal(
    migrateTradingAccounts(saved).changed,
    false,
    "a second migration of the seed must find nothing to change",
  );

  assert.deepEqual(
    saved.map((account) => account.id),
    seedIds([alphaAccount(), betaAccount(), gammaAccount()]),
    "and the seed must hold the accounts the scenarios name",
  );

  assert.equal(
    saved.some((account) => account.accessToken === SECRET),
    true,
    "and one of them must carry the token the DOM may never show",
  );
});

test("the bundle carries the real rows and panel and none of the excluded workflows", async () => {
  const { inputs } = await buildPageBundle();

  for (const real of [
    "src/components/settings/TradingAccountsPage.jsx",
    "src/components/settings/TradingAccountsSidebar.jsx",
    "src/components/settings/TradingAccountsView.jsx",
    "src/lib/brokerAccountIdentity.js",
  ]) {
    assert.equal(
      inputs.includes(real),
      true,
      `the clicks and text of these scenarios come from ${real}`,
    );
  }

  for (const excluded of [
    "src/components/settings/MT5ConnectionModal.jsx",
    "src/components/settings/AddTradingAccountModal.jsx",
    "src/components/settings/TradingAccountsEdit.jsx",
    "src/services/brokerApi.js",
    "src/context/JournalContext.jsx",
  ]) {
    assert.equal(
      inputs.includes(excluded),
      false,
      `${excluded} belongs to another suite`,
    );
  }
});

// ============================================================
// T1 - OPENING THE PAGE WITH A SAVED LIST CHOOSES NOTHING
// ============================================================

async function scenarioOpeningManyAccountsChoosesNothing() {
  await withPage(
    { storage: seedStorage([alphaAccount(), betaAccount(), gammaAccount()]) },
    async (ctx) => {
      assert.deepEqual(
        ctx.rowNames(),
        ["Alpha Manual", "Beta cTrader", "Gamma Manual"],
        "every saved account must be listed and clickable",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "opening the Trading Accounts page may not write the global selection, " +
          "even when one saved account is flagged as the default",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "and the selection key must stay untouched in storage",
      );

      assert.deepEqual(
        ctx.storageWrites,
        [],
        "while opening the page may persist nothing of its own",
      );

      // Last, because it is the one expectation here that reads the panel rather
      // than the pointer: the page shows an account it never earned, so a fix
      // that stops choosing locally clears this too.
      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "with nothing chosen the panel must say so instead of showing an account",
      );
    },
  );
}

test("T1 opening the page with several saved accounts selects none of them", async () => {
  await scenarioOpeningManyAccountsChoosesNothing();
});

// ============================================================
// T2 - THE ONLY SAVED ACCOUNT IS STILL NOT A SELECTION
// ============================================================

async function scenarioOpeningTheOnlyAccountChoosesItNobody() {
  await withPage(
    { storage: seedStorage([alphaAccount()]) },
    async (ctx) => {
      assert.deepEqual(
        ctx.rowNames(),
        ["Alpha Manual"],
        "one saved account must still be listed",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "one saved account is one more reason to list it than to select it",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "with no write to the selection key",
      );

      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "and the panel must still wait for a click",
      );
    },
  );
}

test("T2 one saved account is not selected merely because it is the only one", async () => {
  await scenarioOpeningTheOnlyAccountChoosesItNobody();
});

// ============================================================
// T3 - A CLICK SELECTS EXACTLY THE ACCOUNT CLICKED
// ============================================================

async function scenarioClickSelectsTheClickedAccount() {
  await withPage(
    { storage: seedStorage([alphaAccount(), betaAccount(), gammaAccount()]) },
    async (ctx) => {
      const beforeClick = ctx.globalSelection.length;

      await ctx.clickRow("Beta cTrader");

      assert.deepEqual(
        ctx.globalSelection.slice(beforeClick),
        [BETA_ID],
        "one click on a row must write exactly one global selection: that row",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        BETA_ID,
        "and the selection key must hold that account",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Beta cTrader",
        "with the panel showing the account that was clicked",
      );

      assert.deepEqual(
        ctx.savedIds(),
        [ALPHA_ID, BETA_ID, GAMMA_ID],
        "while selecting an account may not change the saved list",
      );
    },
  );
}

test("T3 clicking a row makes exactly that account the global selection", async () => {
  await scenarioClickSelectsTheClickedAccount();
});

// ============================================================
// T4 - DELETING THE SELECTED ACCOUNT LEAVES NOTHING SELECTED
// ============================================================

async function scenarioDeletingTheSelectedAccountLeavesNothing() {
  await withPage(
    { storage: seedStorage([alphaAccount(), betaAccount(), gammaAccount()]) },
    async (ctx) => {
      await ctx.clickRow("Beta cTrader");

      await ctx.clickDeleteIcon("Beta cTrader");

      assert.equal(
        ctx.findAll("h2").some(
          (node) => node.textContent.trim() === "Delete Account",
        ),
        true,
        "the row's trash icon must open the confirmation this flow answers",
      );

      await ctx.click(ctx.modalButton("Delete"));

      assert.deepEqual(
        ctx.savedIds(),
        [ALPHA_ID, GAMMA_ID],
        "deleting an account must leave the other saved accounts intact",
      );

      assert.deepEqual(
        ctx.rowNames(),
        ["Alpha Manual", "Gamma Manual"],
        "with only those two still listed",
      );

      assert.equal(
        ctx.globalSelection.at(-1),
        null,
        "and the account that was selected went away with it: the page may not " +
          "hand the global selection to whichever account is default or first",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        null,
        "so the selection key must be cleared, not pointed at a successor",
      );

      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "and the panel must go back to waiting for a click",
      );
    },
  );
}

test("T4 deleting the selected account selects no successor", async () => {
  await scenarioDeletingTheSelectedAccountLeavesNothing();
});

// ============================================================
// C1 - THE HALF THAT IS ALREADY TRUE, SO A FIX MAY NOT LOSE IT
// ============================================================
//
// A selection the user made earlier is data the page has to respect, and this
// is the one mount that reads storage and changes nothing. It also proves the
// two panel locators above discriminate: the same helpers that report no panel
// in T1 and T2 report this account here.

async function scenarioAnEarlierChoiceSurvivesTheMount() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: GAMMA_ID,
      },
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.rowNames(),
        ["Alpha Manual", "Beta cTrader", "Gamma Manual"],
        "the saved list must render in the order it was stored",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Gamma Manual",
        "with the account chosen earlier on screen",
      );

      assert.equal(
        ctx.isEmptyPanel(),
        false,
        "so the panel is not the empty one",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and a mount may not write the global selection it was handed",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        GAMMA_ID,
        "while that selection must still be the one in storage",
      );
    },
  );
}

test("C1 a selection the user already made survives opening the page", async () => {
  await scenarioAnEarlierChoiceSurvivesTheMount();
});

// ============================================================
// C2 - DELETING SOMEONE ELSE'S ACCOUNT IS NOT A SELECTION EITHER
// ============================================================
//
// The mirror of T4, and the guard against over-correcting it: removing an
// account the user is not working on must leave that work where it was.

async function scenarioDeletingAnUnselectedAccountKeepsTheChoice() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: GAMMA_ID,
      },
    },
    async (ctx) => {
      await ctx.clickDeleteIcon("Alpha Manual");

      await ctx.click(ctx.modalButton("Delete"));

      assert.deepEqual(
        ctx.savedIds(),
        [BETA_ID, GAMMA_ID],
        "the other two accounts must stay saved",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and deleting an account the user was not working on may not write the " +
          "global selection at all",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        GAMMA_ID,
        "with the selection key still naming the account that was chosen",
      );
    },
  );
}

test("C2 deleting an unselected account leaves the selection alone", async () => {
  await scenarioDeletingAnUnselectedAccountKeepsTheChoice();
});

// ============================================================
// E1 - A BACKGROUND MT5 UPDATE MAY NOT TAKE OVER A CHOSEN ACCOUNT
// ============================================================
//
// The MT5 sync runs on its own and announces whichever login the terminal is
// actually on. TradingAccountsPage.jsx:637-647 treats that announcement as an
// instruction: it merges the record and then moves the global selection to it,
// so a user working on Echo loses their account the moment the terminal starts
// reporting Foxtrot. The event is data, and the choice is the user's.

async function scenarioMT5UpdateKeepsTheChosenAccount() {
  await withPage(
    {
      storage: {
        ...seedStorage([echoAccount(), foxtrotAccount()]),
        [SELECTION_KEY]: ECHO_ID,
      },
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.storageWrites,
        [],
        "the mount this scenario starts from persisted nothing, so every write " +
          "read below belongs to the event",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Echo MT5 1001",
        "and it starts on the account the user chose",
      );

      await ctx.dispatch(
        "mt5AccountUpdated",
        mt5SyncedAccount(foxtrotAccount(), LIVE_FOXTROT),
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "an update about an account the user never clicked may not write the " +
          "global selection",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ECHO_ID,
        "and the selection key must still name the account the user chose",
      );

      // Refusing the account is not refusing the data it carried.
      assert.deepEqual(
        ctx.savedIds(),
        [ECHO_ID, FOXTROT_ID],
        "the update describes an account that is already saved, so the list may " +
          "not grow a second copy of it",
      );

      const foxtrot = ctx.saved(FOXTROT_ID);

      assert.equal(
        foxtrot.balance,
        LIVE_FOXTROT.balance,
        "while the account it describes must still get its reported balance",
      );

      assert.equal(
        foxtrot.equity,
        LIVE_FOXTROT.equity,
        "and its reported equity",
      );

      assert.equal(
        foxtrot.floatingPnL,
        LIVE_FOXTROT.floatingPnL,
        "and its reported floating profit",
      );

      assert.equal(
        foxtrot.lastSynced,
        LIVE_FOXTROT.lastSynced,
        "and the stamp of the sync that reported them",
      );

      assert.equal(
        foxtrot.mt5Server,
        "server-b",
        "merged into the account the payload identified, not into the selected one",
      );

      assert.equal(
        ctx.saved(ECHO_ID).balance,
        5000,
        "and the account the user is working on keeps the numbers it had",
      );

      // Last, because it reads the panel rather than the pointer: the user
      // looking at the page while the sync runs must still see their own
      // account, not the one the terminal happened to report.
      assert.equal(
        ctx.panelField("Name"),
        "Echo MT5 1001",
        "so the panel stays on the account the user is working on",
      );
    },
  );
}

test("E1 a background MT5 account update may not replace the chosen account", async () => {
  await scenarioMT5UpdateKeepsTheChosenAccount();
});

// ============================================================
// E2 - A BACKGROUND MT5 UPDATE INVENTS NO SELECTION
// ============================================================
//
// The event-path mirror of C1: with no choice on record there is no earlier
// selection to preserve, and an announcement still may not become one.

async function scenarioMT5UpdateInventsNoSelection() {
  await withPage(
    { storage: seedStorage([echoAccount(), foxtrotAccount()]) },
    async (ctx) => {
      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "the scenario starts with nothing chosen",
      );

      assert.deepEqual(
        ctx.storageWrites,
        [],
        "by a mount that persisted nothing of its own",
      );

      await ctx.dispatch(
        "mt5AccountUpdated",
        mt5SyncedAccount(echoAccount(), LIVE_ECHO),
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "an MT5 update may not choose an account for a user who has chosen none",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        null,
        "so the selection key must stay absent rather than name whatever the " +
          "sync reported",
      );

      assert.deepEqual(
        ctx.savedIds(),
        [ECHO_ID, FOXTROT_ID],
        "the update still may not disturb the saved list beyond the account it " +
          "describes",
      );

      const echo = ctx.saved(ECHO_ID);

      assert.equal(
        echo.balance,
        LIVE_ECHO.balance,
        "with the reported numbers of the account it described",
      );

      assert.equal(echo.equity, LIVE_ECHO.equity, "and its reported equity");

      assert.equal(
        echo.lastSynced,
        LIVE_ECHO.lastSynced,
        "and the stamp of the sync that reported them",
      );

      assert.equal(
        ctx.saved(FOXTROT_ID).balance,
        6000,
        "while the account the update said nothing about keeps its own numbers",
      );

      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "and the panel must still be waiting for a click",
      );
    },
  );
}

test("E2 a background MT5 account update invents no selection where there is none", async () => {
  await scenarioMT5UpdateInventsNoSelection();
});

// ============================================================
// E3 - A BACKGROUND cTRADER UPDATE MAY NOT TAKE OVER A CHOSEN ACCOUNT
// ============================================================
//
// The twin of E1 on the other platform. TradingAccountsPage.jsx:771 ends the
// cTrader listener with handleSelectAccount(normalizedAccount), so the account
// the service happened to report becomes the account the journal works on,
// moved by nobody. Same rule: the announcement is data, and a row click is what
// chooses.

async function scenarioCTraderUpdateKeepsTheChosenAccount() {
  await withPage(
    {
      storage: {
        ...seedStorage([golfAccount(), hotelAccount()]),
        [SELECTION_KEY]: GOLF_ID,
      },
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.storageWrites,
        [],
        "the mount this scenario starts from persisted nothing, so every write " +
          "read below belongs to the event",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Golf cTrader 771201",
        "and it starts on the account the user chose",
      );

      await ctx.dispatch(
        "ctraderAccountUpdated",
        ctraderSyncedAccount(hotelAccount(), LIVE_HOTEL),
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "an update about an account the user never clicked may not write the " +
          "global selection",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        GOLF_ID,
        "and the selection key must still name the account the user chose",
      );

      // Refusing the account is not refusing the data it carried.
      assert.deepEqual(
        ctx.savedIds(),
        [GOLF_ID, HOTEL_ID],
        "the update describes an account that is already saved, so the list may " +
          "not grow a second copy of it",
      );

      const hotel = ctx.saved(HOTEL_ID);

      assert.equal(
        hotel.balance,
        LIVE_HOTEL.balance,
        "while the account it describes must still get its reported balance",
      );

      assert.equal(
        hotel.equity,
        LIVE_HOTEL.equity,
        "and its reported equity",
      );

      assert.equal(
        hotel.marginUsed,
        LIVE_HOTEL.marginUsed,
        "and its reported margin",
      );

      assert.equal(
        hotel.floatingPnL,
        LIVE_HOTEL.floatingPnL,
        "and its reported floating profit",
      );

      assert.equal(
        hotel.brokerAccountId,
        "771302",
        "merged into the account the payload identified, not into the selected one",
      );

      assert.equal(
        hotel.accessToken,
        SECRET,
        "merged rather than replaced, so the credential the event never carried " +
          "is still the record's own",
      );

      assert.notEqual(
        hotel.lastSynced,
        hotelAccount().lastSynced,
        "and stamped by the sync that reported it",
      );

      assert.equal(
        ctx.saved(GOLF_ID).balance,
        20000,
        "while the account the user is working on keeps the numbers it had",
      );

      // Last, because it reads the panel rather than the pointer: the user
      // looking at the page while the sync runs must still see their own
      // account, not the one the service happened to report.
      assert.equal(
        ctx.panelField("Name"),
        "Golf cTrader 771201",
        "so the panel stays on the account the user is working on",
      );
    },
  );
}

test("E3 a background cTrader account update may not replace the chosen account", async () => {
  await scenarioCTraderUpdateKeepsTheChosenAccount();
});

// ============================================================
// E4 - A BACKGROUND cTRADER UPDATE INVENTS NO SELECTION
// ============================================================
//
// The event-path mirror of C1 on cTrader: with no choice on record there is no
// earlier selection to preserve, and an announcement still may not become one.
// This is the case that leaves the storage key absent, because the listener
// would otherwise be writing a selection the user has never made anywhere.

async function scenarioCTraderUpdateInventsNoSelection() {
  await withPage(
    { storage: seedStorage([golfAccount(), hotelAccount()]) },
    async (ctx) => {
      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "the scenario starts with nothing chosen",
      );

      assert.deepEqual(
        ctx.storageWrites,
        [],
        "by a mount that persisted nothing of its own",
      );

      await ctx.dispatch(
        "ctraderAccountUpdated",
        ctraderSyncedAccount(golfAccount(), LIVE_GOLF),
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "a cTrader update may not choose an account for a user who has chosen " +
          "none",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        null,
        "so the selection key must stay absent rather than name whatever the " +
          "sync reported",
      );

      assert.deepEqual(
        ctx.savedIds(),
        [GOLF_ID, HOTEL_ID],
        "the update still may not disturb the saved list beyond the account it " +
          "describes",
      );

      const golf = ctx.saved(GOLF_ID);

      assert.equal(
        golf.balance,
        LIVE_GOLF.balance,
        "with the reported numbers of the account it described",
      );

      assert.equal(golf.equity, LIVE_GOLF.equity, "and its reported equity");

      assert.equal(
        golf.floatingPnL,
        LIVE_GOLF.floatingPnL,
        "and its reported floating loss, which is a number the page must carry " +
          "with its sign",
      );

      assert.notEqual(
        golf.lastSynced,
        golfAccount().lastSynced,
        "and stamped by the sync that reported them",
      );

      assert.equal(
        ctx.saved(HOTEL_ID).balance,
        30000,
        "while the account the update said nothing about keeps its own numbers",
      );

      assert.equal(
        ctx.isEmptyPanel(),
        true,
        "and the panel must still be waiting for a click",
      );
    },
  );
}

test("E4 a background cTrader account update invents no selection where there is none", async () => {
  await scenarioCTraderUpdateInventsNoSelection();
});

// ============================================================
// D1 - THE DEFAULT STAR MOVES THE PREFERENCE, NOT THE POINTER
// ============================================================
//
// The star is the one control drawn inside a row, so it is the one click that
// has to prove two things at once: the preference lands on the account whose
// star was pressed, and the row around it is not treated as a choice. A default
// is a stored preference; the working account only ever moves when the user
// clicks a row. If the star ever stops stopping propagation, the click that set
// the default silently becomes a row click, and the selection assertions below
// fail with it.

async function scenarioDefaultStarMovesOnlyThePreference() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      assert.equal(
        ctx.saved(ALPHA_ID).isDefault,
        true,
        "the scenario starts with Alpha holding the default",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and with Alpha chosen by an earlier click, which is the state the " +
          "star must leave alone",
      );

      await ctx.clickDefaultStar("Beta cTrader");

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [BETA_ID],
        "the account whose star was clicked must be the only default",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and the click may write no global selection: behind that star is a " +
          "row nobody clicked",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "not even a write repeating the account already chosen",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "so the key still names the account chosen earlier",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel must still be reading it, not the new default",
      );

      assert.equal(
        ctx.selectControl("Alpha Manual").getAttribute("aria-pressed"),
        "true",
        "with the sidebar still marking Alpha as the live account",
      );

      assert.equal(
        ctx.selectControl("Beta cTrader").getAttribute("aria-pressed"),
        "false",
        "and the account that only gained a preference still unpressed",
      );
    },
  );
}

test("D1 the Default star moves the default and never the selection", async () => {
  await scenarioDefaultStarMovesOnlyThePreference();
});

// ============================================================
// D2 - THE STAR ALREADY ON THE DEFAULT CHANGES NOTHING
// ============================================================
//
// The same pointer, from the other side: an account that is both chosen and
// default may be clicked again without losing either, and without the list
// handing the default to whoever happens to be first.

async function scenarioDefaultStarOnTheDefaultAccountChangesNothing() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      await ctx.clickDefaultStar("Alpha Manual");

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "pressing the star on the default account may not clear the default",
      );

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => !account.isDefault)
          .map((account) => account.id),
        [BETA_ID, GAMMA_ID],
        "nor hand it to either of the others",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and the click may not reach the row it is drawn inside",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "with no write to the selection key at all",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "so the pointer still holds the account it started on",
      );

      assert.equal(
        ctx.selectControl("Alpha Manual").getAttribute("aria-pressed"),
        "true",
        "and Alpha's control is still the pressed one",
      );
    },
  );
}

test("D2 clicking the already-default star changes neither default nor selection", async () => {
  await scenarioDefaultStarOnTheDefaultAccountChangesNothing();
});

// ============================================================
// K1 - ENTER ON THE STAR SETS THE DEFAULT, NOT THE SELECTION
// ============================================================
//
// The keyboard half of D1. These scenarios dispatch a real bubbling, cancelable
// KeyboardEvent at the rendered button, which is the only way a key press can
// reach this page's own handlers in jsdom - and the star's activation is now
// authored code rather than a browser courtesy, so it is genuinely exercised.
// What no test here can show is the browser's own activation click: jsdom never
// fires one, so these scenarios say nothing about whether the handler's
// preventDefault would have suppressed a duplicate.

async function scenarioEnterOnStarSetsDefaultWithoutSelecting() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      const star = ctx.focusDefaultStar("Beta cTrader");

      await ctx.press(star, "keydown", "Enter");

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [BETA_ID],
        "Enter on the star must set that account as the only default",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and the keypress may not become a row click: behind the star is still " +
          "a row nobody chose",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "with no write to the selection key at all",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "so the pointer still holds the account chosen earlier",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel still reads that account, not the new default",
      );

      assert.equal(
        ctx.selectControl("Alpha Manual").getAttribute("aria-pressed"),
        "true",
        "with Alpha's selection control still the pressed one",
      );

      assert.equal(
        ctx.selectControl("Beta cTrader").getAttribute("aria-pressed"),
        "false",
        "and the account that only gained a preference still unpressed",
      );
    },
  );
}

test("K1 Enter on the Default star sets the default and never the selection", async () => {
  await scenarioEnterOnStarSetsDefaultWithoutSelecting();
});

// ============================================================
// K2 - SPACE HOLDS THE DEFAULT UNTIL RELEASE
// ============================================================
//
// Space is the key a button must not act on while it is still down, and it is
// also the key that would scroll the page if the handler forgot to cancel it.
// So this scenario reads the state twice: once on the way down, where nothing
// may have moved, and once on the way up, where the default has moved and the
// selection has still not.

async function scenarioSpaceOnStarActivatesOnReleaseOnly() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      const star = ctx.focusDefaultStar("Beta cTrader");

      await ctx.press(star, "keydown", " ");

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "holding Space must not move the default before the key is released",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and the held key must not reach the row either",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "so the selection key is still untouched",
      );

      await ctx.press(star, "keyup", " ");

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [BETA_ID],
        "releasing Space must set the default on the account whose star is focused",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and the whole press must write no global selection",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "with the pointer still on the account chosen earlier",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel still showing it",
      );

      assert.equal(
        ctx.selectControl("Alpha Manual").getAttribute("aria-pressed"),
        "true",
        "and the pressed state still on Alpha's control",
      );
    },
  );
}

test("K2 Space on the Default star activates on release without selecting", async () => {
  await scenarioSpaceOnStarActivatesOnReleaseOnly();
});

// ============================================================
// K3 - A HELD ENTER SETS THE DEFAULT ONCE, NOT ON EVERY REPEAT
// ============================================================
//
// The same keypress K1 sends, carrying the flag only a key that is still down
// sends with it. This is the one scenario that can tell the two apart, because
// the only difference between its event and K1's is that flag - so a handler
// that forgot to read it sets a default here that the guard leaves alone. It is
// also the scenario that reads the write count rather than the written list: a
// guarded repeat must persist nothing at all, whereas an unguarded one would
// hand the default over.

async function scenarioHeldEnterOnStarChangesNothing() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "the scenario starts with Alpha holding the default",
      );

      const star = ctx.focusDefaultStar("Beta cTrader");

      await ctx.press(star, "keydown", "Enter", true);

      assert.deepEqual(
        ctx.storageWrites.filter((write) => write.key === ACCOUNTS_KEY),
        [],
        "a repeated Enter must reach the page's default handler no times at all, " +
          "so the list is never even re-saved",
      );

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "and the held key may not move the default off the account holding it",
      );

      assert.equal(
        Boolean(ctx.saved(BETA_ID).isDefault),
        false,
        "nor put it on the account whose star was focused",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "and the keypress may not become a row click: behind that star is still " +
          "a row nobody chose",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "with no write to the selection key at all",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "so the pointer still holds the account chosen earlier",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel still reads that account, not the star under focus",
      );

      assert.equal(
        ctx.selectControl("Alpha Manual").getAttribute("aria-pressed"),
        "true",
        "with Alpha's selection control still the pressed one",
      );

      assert.equal(
        ctx.selectControl("Beta cTrader").getAttribute("aria-pressed"),
        "false",
        "and the account that was only focused still unpressed",
      );
    },
  );
}

test("K3 a held Enter on the Default star moves neither default nor selection", async () => {
  await scenarioHeldEnterOnStarChangesNothing();
});

// ============================================================
// K4 - A KEY THE STAR IGNORES IS NOT A KEY THE STAR CANCELS
// ============================================================
//
// Activation has two halves and D1/D2/K1/K2/K3 only ever read the one that
// changes state. The other half is the event: a handler that reaches for
// preventDefault too widely would break the page in a way no state assertion
// can see, and a handler that forgets it on Space lets the press scroll the page
// out from under the user. Tab stands for every key the star must not touch - it
// is how a keyboard user leaves a control, so a blanket cancel would trap focus
// inside this row.
//
// What this can show and what it cannot: jsdom records a cancel on the event
// faithfully, but it implements no default action for any key, so a scenario here
// proves the page refused the event and never that the browser then withheld a
// scroll. K2 covers the other half of this press - that Space activates on
// release - so this scenario stops at the keydown deliberately.

async function scenarioStarCancelsOnlyTheKeysItOwns() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "the scenario starts with Alpha holding the default",
      );

      const star = ctx.focusDefaultStar("Beta cTrader");

      const tab = await ctx.press(star, "keydown", "Tab");

      assert.equal(
        tab.defaultPrevented,
        false,
        "a key the star does not own must reach the browser uncanceled, or Tab " +
          "would never move focus off the star",
      );

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "and an ignored key must not move the default",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "nor write to the selection key at all",
      );

      const space = await ctx.press(star, "keydown", " ");

      assert.equal(
        space.defaultPrevented,
        true,
        "Space, which the star does own, must be cancelled on the way down",
      );

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "and cancelling it must still leave the default where it was: a held " +
          "Space activates nothing",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "nor may either press reach the row behind the star",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "so the pointer is still on the account chosen earlier",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel still shows it",
      );
    },
  );
}

test("K4 the star cancels only Space, and never a key it does not own", async () => {
  await scenarioStarCancelsOnlyTheKeysItOwns();
});

// ============================================================
// S1 - THE ACCOUNT NAME IS THE CONTROL THAT CHOSES
// ============================================================
//
// The rule the whole suite reads is that nothing but an explicit activation
// chooses the working account. Until now the element carrying that activation
// was the card itself, drawn as a div wearing role="button" around two real
// buttons: an interactive control cannot legally contain interactive controls,
// and a card labelled "Select <name>" hides everything it displays behind that
// label - the account type, the balance, the live marker and which account is
// the default all stop reaching a screen reader. So these five scenarios pin the
// shape the fix has to land in: the row is a list item, the account name is a
// native button that owns both the click and the pressed state, and the star and
// the trash are its siblings.
//
// What no scenario here can show is what a browser adds on top of a native
// button: jsdom fires no click for Enter or Space, measured rather than
// assumed, so the keyboard half of the new control is delegated to the platform
// and is unverifiable offline. These tests are about which element answers a
// click and which element reports the state.

async function scenarioTheTitleCarriesSelectionAndNothingElseDoes() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      assert.deepEqual(
        ctx.rowNames(),
        ["Alpha Manual", "Beta cTrader", "Gamma Manual"],
        "every saved account must still be listed as its own row",
      );

      for (const accountName of ctx.rowNames()) {
        const row = ctx.row(accountName);
        const control = ctx.selectControl(accountName);

        assert.equal(
          row.getAttribute("role"),
          "listitem",
          `the ${accountName} row must be a list item, not a control`,
        );

        assert.equal(
          row.hasAttribute("tabindex"),
          false,
          `and the ${accountName} row must not be a tab stop of its own, which would put two focusable things on one choice`,
        );

        assert.equal(
          row.hasAttribute("aria-label"),
          false,
          `nor may the ${accountName} row carry a label, which hides the type, balance and live marker drawn inside it`,
        );

        assert.equal(
          control.tagName,
          "BUTTON",
          `the ${accountName} selection control must be a native button, so the browser owns its keyboard activation`,
        );

        assert.equal(
          control.getAttribute("aria-label"),
          `Select ${accountName}`,
          `and it must name the account it chooses, the way the star and the trash name theirs`,
        );

        assert.equal(
          control.getAttribute("aria-pressed"),
          accountName === "Alpha Manual" ? "true" : "false",
          `only the account already chosen may report pressed on the ${accountName} control`,
        );

        assert.equal(
          control.contains(ctx.defaultStar(accountName)) ||
            control.contains(ctx.deleteIcon(accountName)),
          false,
          `and neither the ${accountName} star nor its trash may sit inside the control that chooses the account`,
        );
      }
    },
  );
}

test("S1 the account title is the control that selects, and the row is not", async () => {
  await scenarioTheTitleCarriesSelectionAndNothingElseDoes();
});

// ============================================================
// S2 - ONE ACTIVATION OF THE TITLE WRITES ONE SELECTION
// ============================================================
//
// The count, not just the destination: a control nested in a container that also
// answers clicks writes twice, and the second write is invisible to every
// assertion that only reads where the pointer ended up. T3 measures the same
// rule from the outside; this measures it from the control the fix installs.

async function scenarioTitleClickWritesOneSelectionAndFlipsBothRows() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      const beforeClick = ctx.globalSelection.length;
      const writesBeforeClick = ctx.storageWrites.length;

      assert.equal(
        ctx.pressedVector().includes("Beta cTrader:false"),
        true,
        "the scenario starts with Beta not chosen",
      );

      await ctx.click(ctx.selectControl("Beta cTrader"));

      assert.deepEqual(
        ctx.globalSelection.slice(beforeClick),
        [BETA_ID],
        "one click on the title must write exactly one global selection: that account",
      );

      assert.deepEqual(
        ctx.storageWrites
          .slice(writesBeforeClick)
          .filter((write) => write.key === SELECTION_KEY),
        [{ type: "set", key: SELECTION_KEY, value: BETA_ID }],
        "and exactly one set of the storage key behind it, not a pair from a click that bubbled",
      );

      assert.deepEqual(
        ctx.pressedVector(),
        ["Alpha Manual:false", "Beta cTrader:true", "Gamma Manual:false"],
        "the pressed state must move onto the account chosen and off the one it was on",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        BETA_ID,
        "so the pointer holds the account whose title was clicked",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Beta cTrader",
        "and the panel reads that account rather than the one clicked out of",
      );
    },
  );
}

test("S2 clicking the account title selects it and writes exactly one selection", async () => {
  await scenarioTitleClickWritesOneSelectionAndFlipsBothRows();
});

// ============================================================
// S3 - CHOOSING AN ACCOUNT MOVES NO PREFERENCE
// ============================================================
//
// The other direction of D1. Clicking a row is allowed to move the pointer and
// nothing else, so a selection may not quietly claim, clear or hand over the
// default - and may not re-save the list on the way, which is how a selection
// that "also" touched a preference would first show up.

async function scenarioSelectingLeavesTheDefaultAlone() {
  await withPage(
    {
      storage: {
        ...seedStorage([
          { ...alphaAccount(), isDefault: false },
          { ...betaAccount(), isDefault: true },
          gammaAccount(),
        ]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      const writesBeforeClick = ctx.storageWrites.length;

      // Id and preference only, so a failure prints which account moved instead
      // of printing the saved list - one of these accounts carries a token.
      const preferenceOf = (accounts) =>
        accounts
          .map((account) => `${account.id}:${Boolean(account.isDefault)}`)
          .join("|");

      const preferencesBeforeClick = preferenceOf(ctx.savedAccounts());

      assert.equal(
        ctx.saved(BETA_ID).isDefault,
        true,
        "the scenario starts with Beta holding the default",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        ALPHA_ID,
        "and with Alpha chosen, so the two concepts start apart",
      );

      await ctx.click(ctx.selectControl("Beta cTrader"));

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [BETA_ID],
        "choosing an account may not move the default to or off it",
      );

      assert.equal(
        preferenceOf(ctx.savedAccounts()),
        preferencesBeforeClick,
        "and may not change any other account's preference either",
      );

      assert.equal(
        ctx.storageWrites
          .slice(writesBeforeClick)
          .filter((write) => write.key === ACCOUNTS_KEY).length,
        0,
        "nor persist the list on the way, which is how a selection that also " +
          "reached for a preference would first show up",
      );

      assert.deepEqual(
        ctx.pressedVector(),
        ["Alpha Manual:false", "Beta cTrader:true", "Gamma Manual:false"],
        "while the choice itself must land on the control",
      );
    },
  );
}

test("S3 choosing the default account activates it without touching the preference", async () => {
  await scenarioSelectingLeavesTheDefaultAlone();
});

// ============================================================
// S4 - THE STAR IS NOT A SELECTION CONTROL
// ============================================================
//
// D1 reads the two rows its click touches. This reads all three, because the
// claim that matters after the reshape is that setting a default leaves every
// row's pressed state exactly where it was - including the rows nobody pressed
// and the row whose preference moved.

async function scenarioStarPressLeavesEveryPressedStateAlone() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      const beforePress = ctx.pressedVector();

      // Pinned, and not only compared with itself afterwards. "Nothing moved"
      // between two vectors that report nothing is the assertion this scenario
      // used to be, and the 5F.3(c)-7 probe B sidebar - with no aria-pressed on
      // any title button at all - satisfied it. Naming the expected state is what
      // makes the stability claim mean something.
      assert.deepEqual(
        beforePress,
        ["Alpha Manual:true", "Beta cTrader:false", "Gamma Manual:false"],
        "the row chosen before the press must report pressed, and the other two must report unpressed",
      );

      await ctx.clickDefaultStar("Beta cTrader");

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [BETA_ID],
        "the star must still set the default it is drawn for",
      );

      assert.deepEqual(
        ctx.pressedVector(),
        beforePress,
        "and every row's selection state must be exactly what it was, row for row",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "with no write to the selection key at all",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel still reading the account chosen earlier",
      );
    },
  );
}

test("S4 the Default star moves the preference and no row's pressed state", async () => {
  await scenarioStarPressLeavesEveryPressedStateAlone();
});

// ============================================================
// S5 - THE TRASH IS NOT A SELECTION CONTROL EITHER
// ============================================================
//
// Exercised only as far as it is safe: the trash icon opens the page's own
// confirmation, and this scenario stops there, because what is being proved is
// that reaching for a deletion selects nothing. The deletion itself - and the
// rule that it hands the pointer to no successor - is T4 and C2, which answer
// the confirmation and are not repeated here.

async function scenarioReachingForDeletionSelectsNothing() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: ALPHA_ID,
      },
    },
    async (ctx) => {
      // The same projection discipline as S3: id, preference and balance, never
      // the whole saved object, because one account carries a token.
      const savedOf = (accounts) =>
        accounts
          .map(
            (account) =>
              `${account.id}:${Boolean(account.isDefault)}:${account.balance}`,
          )
          .join("|");

      const beforeClick = ctx.pressedVector();
      const savedBeforeClick = savedOf(ctx.savedAccounts());

      await ctx.clickDeleteIcon("Beta cTrader");

      assert.equal(
        ctx.findAll("h2").some(
          (node) => node.textContent.trim() === "Delete Account",
        ),
        true,
        "the trash icon must really have been reached: the confirmation is open",
      );

      assert.deepEqual(
        ctx.pressedVector(),
        beforeClick,
        "and asking to delete an account may not choose it, or any other row",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "with no global selection written by the click",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "and no write to the selection key",
      );

      assert.equal(
        savedOf(ctx.savedAccounts()),
        savedBeforeClick,
        "and the saved list unmoved, since nothing was confirmed",
      );

      assert.deepEqual(
        ctx.savedIds(),
        [ALPHA_ID, BETA_ID, GAMMA_ID],
        "so all three accounts are still saved",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Alpha Manual",
        "and the panel is still reading the account chosen earlier",
      );
    },
  );
}

test("S5 opening the delete confirmation selects nothing and deletes nothing", async () => {
  await scenarioReachingForDeletionSelectsNothing();
});

// ============================================================
// S6 - THE DEFAULT STAR REPORTS THE PREFERENCE IT HOLDS
// ============================================================
//
// D1, D2 and the K series all prove what a press on the star DOES - it moves the
// stored preference and never the pointer - and none of them reads what the star
// SAYS. That left the star's own accessibility contract unpinned: the 5F.3(c)-7
// probe C deleted aria-pressed from it and this suite stayed entirely green,
// because every default check here went through storage. Storage is the truth the
// page acts on, but aria-pressed is the truth a screen reader is told, and a star
// that reports nothing tells a user there is no default account at all. So this
// scenario reads the state off the control the star is - located, like every
// other star read here, by its "Set <name> as default" label.
//
// What it cannot show is that the reported state agrees with the picture on the
// icon. The fill and the yellow class are styling, and nothing in this harness
// measures computed style; the two are pinned to agree only by the fact that both
// are drawn from the same acc.isDefault.

async function scenarioStarReportsThePreferenceItHolds() {
  await withPage(
    {
      storage: {
        ...seedStorage([alphaAccount(), betaAccount(), gammaAccount()]),
        [SELECTION_KEY]: BETA_ID,
      },
    },
    async (ctx) => {
      // Alpha is the stored default and Beta the chosen account, so the two
      // states this scenario separates are held by different rows from the start.
      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [ALPHA_ID],
        "the seed must put the preference on Alpha and nowhere else",
      );

      assert.deepEqual(
        ctx.defaultVector(),
        ["Alpha Manual:true", "Beta cTrader:false", "Gamma Manual:false"],
        "only the star of the account the preference points at may report pressed, and the other two must report unpressed rather than report nothing",
      );

      const titlesBefore = ctx.pressedVector();

      await ctx.clickDefaultStar("Gamma Manual");

      assert.deepEqual(
        ctx.defaultVector(),
        ["Alpha Manual:false", "Beta cTrader:false", "Gamma Manual:true"],
        "pressing a star must move the reported preference onto that row and off the row that held it",
      );

      assert.deepEqual(
        ctx.savedAccounts()
          .filter((account) => account.isDefault)
          .map((account) => account.id),
        [GAMMA_ID],
        "with the reported preference and the stored one still the same fact",
      );

      assert.deepEqual(
        ctx.pressedVector(),
        titlesBefore,
        "and no row's selection state moved, because a preference is not a choice",
      );

      assert.deepEqual(
        ctx.globalSelection,
        [],
        "the press may not even reach the selection setter",
      );

      assert.deepEqual(
        ctx.selectionWrites(),
        [],
        "and may not write the selection key",
      );

      assert.equal(
        ctx.stored(SELECTION_KEY),
        BETA_ID,
        "with the stored selection still naming the account chosen before the press",
      );

      assert.equal(
        ctx.panelField("Name"),
        "Beta cTrader",
        "and the panel still reading that account, not the new default one",
      );
    },
  );
}

test("S6 the Default star reports the preference it holds and moves it to no account", async () => {
  await scenarioStarReportsThePreferenceItHolds();
});


