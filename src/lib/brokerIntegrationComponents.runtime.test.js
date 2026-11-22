// ============================================================
// PHASE 3 BROKER INTEGRATION COMPONENTS (Task 7)
// ============================================================
//
// WHAT IS REAL HERE
//
// The three Task 7 components are bundled with esbuild and mounted with the
// installed React 19 runtime in a jsdom document, exactly like
// src/lib/journalUiRuntime.test.js does for the journal chain. They are rendered
// from values produced by the real pure model (src/lib/brokerIntegrationModel.js)
// - sessions come out of validateMt5Session() and validateCtraderSession(), rows
// come out of buildAccountRows() - so a component cannot pass by agreeing with a
// fixture this file invented.
//
// WHAT IS SUBSTITUTED, AND WHY
//
// Only lucide-react, and only so the bundle does not pull an icon package into a
// Node process. No context provider, service or page is mounted: these three
// components are presentational, so the bundle allowlist in
// scenarioBundleGraph is the structural proof of that. A component that started
// fetching, or reached TradeContext for global account selection, would add an
// input this test rejects.
//
// THE OLD connected PROP
//
// Plan Task 7 Step 1 asks for a check "that no new prop is supplied as
// connected={true}". Two sides of that are pinned here:
//   - assertBrokerCardContract() reads the source and rejects a BrokerCard that
//     still destructures `connected`;
//   - every card scenario passes the approved five props only, and the stale
//     -contract scenario additionally passes `connected: true` and asserts the
//     pill still comes from uiStatus.
// Removing connected={true} from the CALL SITE is Task 8 work (it lives in
// src/components/settings/BrokerIntegrationPage.jsx:650-657), so nothing here
// asserts the page's JSX.
//
// ISOLATION, STATED EXACTLY
//
//   - No runScripts and no resources:"usable" on the JSDOM instance.
//   - fetch, XMLHttpRequest, WebSocket, EventSource and setInterval on both
//     globalThis and the jsdom window are recording tripwires, and the runner
//     asserts they recorded nothing after every scenario.
//   - localStorage, sessionStorage and indexedDB are recording tripwires too, so
//     "writes no storage" is evidence rather than an assumption.
//   - A fresh bundle is built per scenario; every installed descriptor is
//     restored in reverse order in finally, including after a failure.
//   - Mutation probes are applied to the text esbuild reads, never to a
//     repository file.
//
// WHAT THIS CANNOT PROVE
//
// This is jsdom, not Chrome. It proves the components render the copy and
// branches their props ask for. It proves nothing about real CSS layout, hover
// styling, or a live broker session.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

import { getBrokerById } from "../brokers/brokerRegistry.js";
import {
  UI_STATUS,
  UNAVAILABLE,
  buildAccountRows,
  createEmptySession,
  mapBrokerUiStatus,
  validateCtraderSession,
  validateMt5Session,
} from "./brokerIntegrationModel.js";

const nodeRequire = createRequire(import.meta.url);

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

// ============================================================
// THE CONTRACT UNDER TEST
// ============================================================

const COMPONENT_FILES = Object.freeze({
  BrokerCard: "src/brokers/BrokerCard.jsx",
  AccountWorkspace: "src/components/settings/broker-integration/AccountWorkspace.jsx",
  LiveSessionPanel: "src/components/settings/broker-integration/LiveSessionPanel.jsx",
});

const COMPONENT_PROPS = Object.freeze({
  BrokerCard: ["broker", "snapshot", "uiStatus", "selected", "onSelect"],
  AccountWorkspace: [
    "brokerKey",
    "rows",
    "selectedAccountId",
    "onSelectAccount",
    "onConnect",
    "onDisconnect",
    "onStartService",
    "onAddCtraderAccount",
    "busy",
    "error",
  ],
  LiveSessionPanel: ["brokerKey", "session", "loading"],
});

// A sentinel that appears in payload fields no component is allowed to render.
const SECRET = "FAKE_SECRET_TOKEN";

// The only explanatory sentence the approved workspace keeps: it tells the user
// what the form is for without describing the service behind it.
const CT_SETUP_COPY = "Add a cTrader account id so you can select it after authorizing.";

const MT5_LOGIN = "1001";
const MT5_SERVER = "documents-4";
const CT_TRADING_ACCOUNT_ID = "395823";
const CT_TRADER_LOGIN = "556677";
const OBSERVED_AT = "2026-11-05T10:00:00.000Z";
const SYNCED_AT = "2026-11-05T10:00:05.000Z";

// The pill each approved status must produce, and the tone the card is allowed
// to use for it. loading and disconnected share a tone, so the label is the
// discriminator; every other pair is separated by colour as well.
const EXPECTED_PILL = Object.freeze({
  loading: { label: "Loading", tone: /bg-slate-100/ },
  connected: { label: "Connected", tone: /bg-emerald-100/ },
  connecting: { label: "Connecting", tone: /bg-blue-100/ },
  disconnected: { label: "Disconnected", tone: /bg-slate-100/ },
  unreachable: { label: "Unreachable", tone: /bg-amber-100/ },
  error: { label: "Error", tone: /bg-red-100/ },
});

const FORBIDDEN_INPUTS = Object.freeze([
  "src/main.jsx",
  "src/App.jsx",
  "src/components/settings/BrokerIntegrationPage.jsx",
  "src/context/TradeContext.jsx",
  "src/context/MarketContext.jsx",
  "src/context/JournalContext.jsx",
  "src/services/brokerApi.js",
  "src/brokers/AddBrokerModal.jsx",
  "src/brokers/BrokerDetailsModal.jsx",
  "src/brokers/brokerRegistry.js",
]);

// ============================================================
// PRESENCE + CONTRACT GATES (plan Task 7 Step 1)
// ============================================================
//
// Every render scenario calls these before the bundle is built, so a missing
// module fails as an assertion instead of as an uncaught esbuild error.

function missingComponentFiles() {
  return Object.entries(COMPONENT_FILES)
    .filter(([, relative]) => !existsSync(`${repoRoot}/${relative}`))
    .map(([name, relative]) => `${name} (${relative})`);
}

function assertComponentFilesExist() {
  const missing = missingComponentFiles();

  assert.equal(
    missing.length === 0,
    true,
    `the Task 7 presentational components must exist on disk; missing ${missing.join(", ")}`,
  );
}

function readComponent(name) {
  assert.ok(
    Object.prototype.hasOwnProperty.call(COMPONENT_FILES, name),
    `${name} is not a Task 7 component`,
  );

  return readFileSync(`${repoRoot}/${COMPONENT_FILES[name]}`, "utf8");
}

function propsOfSignature(source, componentName) {
  const signature = source.match(
    new RegExp(`export default function ${componentName}\\(\\{([^}]*)\\}`),
  );

  assert.ok(
    signature,
    `${componentName} must be a default export with a destructured props object`,
  );

  return signature[1]
    .split(",")
    .map((entry) => entry.trim().split(/[=:]/)[0].trim())
    .filter(Boolean);
}

function assertBrokerCardContract() {
  const props = propsOfSignature(readComponent("BrokerCard"), "BrokerCard");

  assert.equal(
    props.includes("connected"),
    false,
    "BrokerCard must drop the old connected prop and derive its pill from uiStatus",
  );

  for (const required of COMPONENT_PROPS.BrokerCard) {
    assert.ok(
      props.includes(required),
      `BrokerCard must accept the approved prop ${required}, got ${props.join(", ")}`,
    );
  }
}

function assertPresentationalSource(name) {
  const source = readComponent(name);
  const props = propsOfSignature(source, name);

  for (const required of COMPONENT_PROPS[name]) {
    assert.ok(
      props.includes(required),
      `${name} must accept the approved prop ${required}, got ${props.join(", ")}`,
    );
  }

  // Presentational only: no transport, no storage, no context, no effects.
  for (const forbidden of [
    /from\s+["'][^"']*brokerApi/,
    /from\s+["'][^"']*Context/,
    /localStorage/,
    /sessionStorage/,
    /indexedDB/,
    /\bfetch\s*\(/,
    /useEffect/,
    /useSyncExternalStore/,
  ]) {
    assert.equal(
      forbidden.test(source),
      false,
      `${name} must stay presentational; ${forbidden} found in its source`,
    );
  }
}

function assertWorkspaceAndPanelContracts() {
  assertPresentationalSource("AccountWorkspace");
  assertPresentationalSource("LiveSessionPanel");
}

// ============================================================
// FIXTURES - PRODUCER KEYS ONLY
// ============================================================
//
// Shapes copied from server/brokers/registry.js:24-63 and the adapter blocks,
// and from mt5-bridge/app.py:1623-1860 for a serialised pending order.

function mt5AccountBlock(overrides = {}) {
  return {
    login: MT5_LOGIN,
    server: MT5_SERVER,
    name: "Demo broker",
    currency: "USD",
    balance: 10000.5,
    equity: 10050.25,
    margin: 200,
    freeMargin: 9850.25,
    leverage: 100,
    floatingPnL: 49.75,
    ...overrides,
  };
}

function ctraderAccountBlock(overrides = {}) {
  return {
    accountId: CT_TRADING_ACCOUNT_ID,
    balance: 5000,
    equity: 5010.5,
    margin: 100,
    freeMargin: 4910.5,
    currency: "USD",
    leverage: 100,
    brokerName: "Demo broker",
    source: "authenticated cTrader service",
    ...overrides,
  };
}

function mt5Block({
  state = "connected",
  externalId = MT5_LOGIN,
  server = MT5_SERVER,
  account = mt5AccountBlock(),
  limitations = [],
  execution = {
    provider: "mt5-local-bridge",
    transport: "http",
    requiresLocalService: true,
    browserCompatible: false,
  },
} = {}) {
  const live = Boolean(externalId);

  return {
    id: "mt5",
    displayName: "MetaTrader 5",
    connection: {
      state,
      connected: state === "connected",
      serviceReachable: state !== "unreachable",
      observedAt: OBSERVED_AT,
      sourceTimestamp: OBSERVED_AT,
      reason: null,
    },
    session: {
      scope: "global_terminal_session",
      accountScoped: false,
      identity: { login: externalId, server },
      magic: 234567,
      limitations,
    },
    account,
    identity: {
      broker: "mt5",
      externalId: live ? externalId : null,
      server: live ? server : null,
      key: live ? `mt5:${externalId}` : null,
      // An adapter that cannot name its account must not leak a cached one.
      accessToken: live ? SECRET : SECRET,
      note: live ? null : "The MT5 terminal is not logged in.",
    },
    accounts: {
      broker: "mt5",
      enumerable: false,
      source: "none",
      isLive: false,
      items: [],
      activeAccountId: null,
      activeAccount: null,
      reason:
        "The bridge exposes no endpoint that enumerates MT5 logins, so this adapter cannot list accounts.",
    },
    execution,
    capabilities: {
      status: true,
      accountInfo: true,
      positions: true,
      orderListing: true,
      candles: true,
    },
    lifecycle: { state: "idle", detail: null },
    errors: [],
  };
}

function ctraderBlock({
  connected = true,
  authenticated = true,
  ready = true,
  serviceAccountId = CT_TRADING_ACCOUNT_ID,
  requestedAccountId = CT_TRADING_ACCOUNT_ID,
  accountSource = "live",
  limitations = [],
} = {}) {
  const live = connected && authenticated && ready;
  const authenticatedAccountId = live ? serviceAccountId : null;
  const state = live ? "connected" : connected ? "authenticating" : "disconnected";

  const liveItems = [
    {
      accountId: CT_TRADING_ACCOUNT_ID,
      traderLogin: CT_TRADER_LOGIN,
      isLive: true,
      lastLoginTime: "1762300000000",
      name: "Demo 395823",
      nameSource: "local_cache",
      accessToken: SECRET,
    },
  ];

  const cachedItems = [
    {
      accountId: CT_TRADING_ACCOUNT_ID,
      name: "Main demo",
      createdAt: "2026-11-04T00:00:00.000Z",
      traderLogin: null,
      isLive: null,
      lastLoginTime: null,
      accessToken: SECRET,
    },
  ];

  const items = accountSource === "none" ? [] : accountSource === "live" ? liveItems : cachedItems;
  const activeFromService = live ? serviceAccountId : null;
  const wanted = requestedAccountId || activeFromService;
  const active = wanted
    ? items.find((item) => item.accountId === wanted) ?? null
    : null;

  return {
    id: "ctrader",
    displayName: "cTrader",
    connection: {
      state,
      connected: state === "connected",
      serviceReachable: true,
      observedAt: OBSERVED_AT,
      sourceTimestamp: null,
      reason:
        state === "connected"
          ? null
          : `Socket connected=${connected}, authenticated=${authenticated}, ready=${ready}; OAuth stored connected=true, hasAccessToken=true.`,
    },
    transport: {
      running: true,
      connected,
      authenticated,
      ready,
      activeSymbol: "EURUSD",
      positionsCount: items.length,
    },
    authorization: {
      connected: true,
      hasAccessToken: true,
      hasRefreshToken: true,
      accessToken: SECRET,
      refreshToken: SECRET,
      note: "Token values are intentionally omitted.",
    },
    session: {
      scope: "process_singleton_socket",
      accountScoped: true,
      identity: { accountId: authenticatedAccountId },
      limitations,
    },
    account: authenticatedAccountId ? ctraderAccountBlock() : null,
    identity: {
      broker: "ctrader",
      externalId: authenticatedAccountId,
      server: null,
      traderLogin: authenticatedAccountId ? CT_TRADER_LOGIN : null,
      requestedAccountId,
      matchesRequestedAccount: Boolean(
        authenticatedAccountId && requestedAccountId === authenticatedAccountId,
      ),
      key: authenticatedAccountId ? `ctrader:${authenticatedAccountId}` : null,
      source: authenticatedAccountId
        ? "authenticated and ready cTrader service session (GET_ACCOUNTS_RES tradingAccountId)"
        : "no authenticated and ready cTrader service session; the locally cached selection is not a live identity",
      accessToken: SECRET,
      note: authenticatedAccountId
        ? null
        : "The cTrader service is not authenticated and ready, so no live account identity is claimed.",
    },
    accounts: {
      broker: "ctrader",
      activeAccountId: requestedAccountId || activeFromService || null,
      activeAccountSource: null,
      serviceReportedAccountId: activeFromService,
      requestedActiveAccountId: requestedAccountId,
      mismatch: Boolean(
        requestedAccountId &&
          activeFromService &&
          requestedAccountId !== activeFromService,
      ),
      enumerable: accountSource !== "none",
      source: accountSource,
      isLive: accountSource === "live",
      observedVia:
        accountSource === "live"
          ? "authenticated cTrader service (GET_ACCOUNTS_RES)"
          : accountSource === "cache"
            ? "server/ctrader-auth.json"
            : null,
      items,
      activeAccount: active ? { ...active, activeAccountSource: accountSource } : null,
      note: null,
    },
    execution: {
      provider: "ctrader-open-net",
      transport: "websocket",
      requiresLocalService: true,
      browserCompatible: false,
    },
    capabilities: {
      status: true,
      accountInfo: true,
      positions: true,
      orderListing: false,
      pendingOrderSubmission: false,
    },
    lifecycle: { state: "running", detail: null },
    errors: [],
  };
}

function statusOf({ mt5, ctrader } = {}) {
  const brokers = {};

  if (mt5 !== undefined) {
    brokers.mt5 = mt5;
  }

  if (ctrader !== undefined) {
    brokers.ctrader = ctrader;
  }

  return {
    success: true,
    contractVersion: 1,
    observedAt: OBSERVED_AT,
    identityConflicts: [],
    brokers,
  };
}

// ----------------------------------------------------------
// Collection fixtures
// ----------------------------------------------------------

function mt5Position({ ticket = 4400001, profit = 20, raw = {} } = {}) {
  return {
    login: MT5_LOGIN,
    mt5Login: MT5_LOGIN,
    server: MT5_SERVER,
    mt5Server: MT5_SERVER,
    ticket,
    positionId: ticket,
    brokerPositionId: ticket,
    symbol: "EURUSD",
    type: "buy",
    volume: 0.1,
    price_open: 1.1,
    price_current: 1.1002,
    sl: null,
    tp: null,
    profit,
    swap: 0,
    commission: -0.5,
    time: 1762300000,
    time_msc: 1762300000000,
    raw: { accessToken: SECRET, ...raw },
  };
}

// mt5-bridge/app.py:1623-1860 is the producer of these keys.
function mt5PendingOrder({ ticket = 5500002 } = {}) {
  return {
    ticket,
    orderId: ticket,
    id: ticket,
    symbol: "GBPUSD",
    type: "BUY_LIMIT",
    orderType: "BUY_LIMIT",
    side: "BUY",
    volume: 0.2,
    lots: 0.2,
    price: 1.27,
    entry: 1.27,
    priceOpen: 1.27,
    sl: 1.26,
    stopLoss: 1.26,
    tp: 1.29,
    takeProfit: 1.29,
    comment: "edgeflo",
    magic: 234567,
    time_setup_msc: 1762300000000,
    state: "ORDER_STATE_STARTED",
    raw: { accessToken: SECRET },
  };
}

function ctraderPosition({ positionId = 7001 } = {}) {
  return {
    positionId,
    symbolId: "1",
    symbol: "EURUSD",
    side: "buy",
    volume: 1000000,
    lots: 1,
    entryPrice: 1.1,
    stopLoss: null,
    takeProfit: null,
    commission: -0.5,
    swap: 0,
    usedMargin: 100,
    openTimestamp: 1762300000000,
    raw: { accessToken: SECRET },
  };
}

// ----------------------------------------------------------
// Stored account fixtures (the localStorage shape)
// ----------------------------------------------------------

function storedMt5Account(overrides = {}) {
  return {
    id: "mt5-1001",
    accountName: "MT5 Account 1001",
    broker: "MT5",
    brokerAccountId: MT5_LOGIN,
    mt5Server: MT5_SERVER,
    currency: "USD",
    balance: 4321.11,
    startingBalance: 5000,
    ...overrides,
  };
}

function storedCtraderAccount(overrides = {}) {
  return {
    id: "ctrader-395823",
    accountName: "cTrader 395823",
    broker: "cTrader",
    brokerAccountId: CT_TRADING_ACCOUNT_ID,
    currency: "USD",
    balance: 1111.11,
    startingBalance: 2000,
    accessToken: SECRET,
    ...overrides,
  };
}

// ----------------------------------------------------------
// Model-derived values
// ----------------------------------------------------------

function healthyMt5Session({
  positions = [mt5Position()],
  orders = [],
  account = mt5AccountBlock(),
  synchronizedAt = SYNCED_AT,
  success = true,
  block = {},
} = {}) {
  const aggregate = statusOf({ mt5: mt5Block({ account, ...block }) });

  return validateMt5Session({
    accounts: [storedMt5Account()],
    selectedAccountId: "mt5-1001",
    aggregate,
    positionsResponse:
      success === false
        ? {
            success: false,
            connected: false,
            count: 0,
            positions: [],
            message: "MT5 bridge unavailable.",
            error: "connect ECONNREFUSED 127.0.0.1:5001",
          }
        : {
            success: true,
            connected: true,
            login: MT5_LOGIN,
            mt5Login: MT5_LOGIN,
            server: MT5_SERVER,
            mt5Server: MT5_SERVER,
            count: positions.length,
            positions,
          },
    ordersResponse: {
      success: true,
      count: orders.length,
      orders,
      pendingOrders: orders,
    },
    postOrdersAggregate: aggregate,
    synchronizedAt,
  });
}

function healthyCtraderSession({
  positions = [ctraderPosition()],
  account = ctraderAccountBlock(),
  synchronizedAt = SYNCED_AT,
  includePositions = true,
} = {}) {
  const aggregate = statusOf({ ctrader: ctraderBlock() });

  const service = {
    running: true,
    connected: true,
    authenticated: true,
    ready: true,
    tradingAccountId: CT_TRADING_ACCOUNT_ID,
    account: { ...account, accessToken: SECRET },
    symbol: "EURUSD",
    positionsCount: Array.isArray(positions) ? positions.length : 0,
  };

  if (includePositions) {
    service.openPositions = positions;
  }

  return validateCtraderSession({
    accounts: [storedCtraderAccount()],
    selectedAccountId: "ctrader-395823",
    aggregate,
    serviceResponse: {
      success: true,
      connected: true,
      hasAccessToken: true,
      accessToken: SECRET,
      service,
    },
    synchronizedAt,
  });
}

function rowsFor({ brokerKey, aggregate, stored }) {
  return buildAccountRows({
    storedAccounts: stored,
    brokerKey,
    snapshot: aggregate,
  });
}

function defaultMt5Rows() {
  const aggregate = statusOf({ mt5: mt5Block() });

  return {
    aggregate,
    rows: rowsFor({
      brokerKey: "mt5",
      aggregate,
      stored: [
        storedMt5Account(),
        storedMt5Account({
          id: "mt5-2002",
          accountName: "MT5 Account 2002",
          brokerAccountId: "2002",
        }),
        // No external account number at all, and an id that cannot imply one.
        {
          id: "legacy-1",
          accountName: "Half recorded",
          broker: "MT5",
          mt5Server: MT5_SERVER,
          currency: "USD",
        },
        // A broker account with no local id is not selectable.
        storedMt5Account({
          id: "",
          accountName: "No local id",
          brokerAccountId: "3003",
        }),
      ],
    }),
  };
}

function defaultCtraderRows() {
  const aggregate = statusOf({ ctrader: ctraderBlock() });

  return {
    aggregate,
    rows: rowsFor({
      brokerKey: "ctrader",
      aggregate,
      stored: [storedCtraderAccount()],
    }),
  };
}

// ============================================================
// STUBS
// ============================================================

const REACT_IMPORT = 'import { createElement } from "react";\n';

function iconStub(names) {
  return `${REACT_IMPORT}
const icon = (name) => function Icon() {
  return createElement("svg", { "data-icon": name });
};
${names.map((name) => `export const ${name} = icon("${name}");`).join("\n")}`;
}

// A superset of the icons the three components may import. An icon outside this
// list fails the build with "No matching export", which is the signal to widen
// the stub deliberately rather than silently.
const LUCIDE_NAMES = [
  "AlertCircle",
  "AlertTriangle",
  "CheckCircle2",
  "ChevronRight",
  "CircleSlash",
  "KeyRound",
  "Landmark",
  "Link2",
  "Loader2",
  "Play",
  "Plug",
  "PlugZap",
  "Plus",
  "RefreshCw",
  "UserPlus",
];

const STUBS = Object.freeze({
  lucide: iconStub(LUCIDE_NAMES),
});

const SUBSTITUTIONS = Object.freeze([[/^lucide-react$/, "lucide"]]);

function stubPlugin(substitutions) {
  return {
    name: "edgeflo-component-stubs",
    setup(build) {
      for (const [filter, key] of substitutions) {
        build.onResolve({ filter }, () => ({
          path: key,
          namespace: "edgeflo-component-stub",
        }));
      }

      build.onLoad(
        { filter: /.*/, namespace: "edgeflo-component-stub" },
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
// IN-MEMORY MUTANTS
// ============================================================
//
// Each one is a plausible wrong component, applied only to the text esbuild
// reads. mutationPlugin asserts the anchor matched exactly once, so a stale
// anchor fails loudly instead of reporting a phantom detection.

const MUTATIONS = Object.freeze({
  // A verified account id is printed whatever the card status is.
  cardIdentityIgnoresStatus: {
    file: "src/brokers/BrokerCard.jsx",
    from: "    status === UI_STATUS.connected ? readText(block?.identity?.externalId) : null;",
    to: "    readText(block?.identity?.externalId) ?? null;",
  },
  // The supported markets reach the screen as an unseparated run-on string.
  cardMarketsRunOn: {
    file: "src/brokers/BrokerCard.jsx",
    from: 'broker.markets.map(readText).filter(Boolean).join(", ")',
    to: 'broker.markets.map(readText).filter(Boolean).join("")',
  },
  // Every stored row is labelled as a live session.
  rowAlwaysLive: {
    file: "src/components/settings/broker-integration/AccountWorkspace.jsx",
    from: "row.isLiveSession ? LIVE_BADGE : CACHED_BADGE",
    to: "LIVE_BADGE",
  },
  // Unvalidated positions are rendered as a validated empty book.
  positionsNullAsEmpty: {
    file: "src/components/settings/broker-integration/LiveSessionPanel.jsx",
    from: "  if (positions === null) {",
    to: "  if (false) {",
  },
  // A pending-order list the validator never confirmed reads as an empty book.
  pendingNullAsEmpty: {
    file: "src/components/settings/broker-integration/LiveSessionPanel.jsx",
    from: "  if (session.pendingOrders === null) {",
    to: "  if (false) {",
  },
  // The setup form accepts a blank account id.
  formGuardDropped: {
    file: "src/components/settings/broker-integration/AccountWorkspace.jsx",
    from: "    if (!accountId) return;",
    to: "    ;",
  },
});

function mutationPlugin(mutation) {
  return {
    name: "edgeflo-component-mutation",
    setup(build) {
      if (!mutation) {
        return;
      }

      build.onLoad({ filter: /\.(jsx|js)$/ }, (args) => {
        const relative = args.path.replace(/\\/g, "/");

        if (!relative.endsWith(mutation.file)) {
          return null;
        }

        const before = readFileSync(args.path, "utf8");

        const matches =
          typeof mutation.from === "string"
            ? before.split(mutation.from).length - 1
            : (before.match(new RegExp(mutation.from.source, "g")) ?? []).length;

        assert.equal(
          matches,
          1,
          `${String(mutation.from)} must match ${mutation.file} exactly once, got ${matches}`,
        );

        const after = before.replace(mutation.from, mutation.to);

        assert.notEqual(after, before, `${String(mutation.from)} must change ${mutation.file}`);

        return {
          contents: after,
          loader: /\.jsx$/.test(relative) ? "jsx" : "js",
        };
      });
    },
  };
}

// ============================================================
// BUNDLE
// ============================================================

const ENTRY = [
  'export { default as BrokerCard } from "./brokers/BrokerCard.jsx";',
  'export { default as AccountWorkspace } from "./components/settings/broker-integration/AccountWorkspace.jsx";',
  'export { default as LiveSessionPanel } from "./components/settings/broker-integration/LiveSessionPanel.jsx";',
].join("\n");

async function buildRuntimeBundle(mutation, substitutions = SUBSTITUTIONS) {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "brokerIntegrationComponentsRuntimeEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    define: { "import.meta.env": JSON.stringify({ VITE_API_URL: "http://127.0.0.1:4000" }) },
    plugins: [mutationPlugin(mutation), stubPlugin(substitutions)],
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
      `a presentational bundle may only require shared React modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(guardedRequire, loaded, loaded.exports);

  return loaded.exports;
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

const STORAGE_GLOBALS = Object.freeze(["localStorage", "sessionStorage", "indexedDB"]);

const DOM_GLOBAL_CANDIDATES = Object.freeze([
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLTableElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "getComputedStyle",
]);

async function withComponents(options, scenario) {
  const { tree = () => null, mutation = null, substitutions = SUBSTITUTIONS } = options ?? {};

  // The gates run before anything is bundled, so a missing module is an
  // assertion rather than a build crash. A mutant is built from the same disk
  // source, so the gate applies to mutated runs too.
  assertComponentFilesExist();

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const win = dom.window;

  const touched = [];
  const restoreSteps = [];
  const logged = { log: [], error: [], warn: [] };

  let root = null;
  let scenarioFailure = null;
  let unmountFailure = null;

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

          throw new Error(`a presentational component reached ${label}.${name}`);
        },
      });
    }
  }

  const ctx = {
    React: null,
    modules: null,
    inputs: null,
    container: null,
    window: win,
    touched,
    text() {
      return ctx.container.textContent;
    },
    html() {
      return ctx.container.innerHTML;
    },
    find(selector) {
      return ctx.container.querySelector(selector);
    },
    findAll(selector) {
      return [...ctx.container.querySelectorAll(selector)];
    },
    buttonFor(name) {
      const button = ctx.findAll("button").find((node) => node.textContent.includes(name));

      assert.ok(button, `a control labelled ${name} must be rendered`);

      return button;
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    async click(node) {
      await ctx.act(() => {
        node.click();
      });
    },
    async type(input, value) {
      const setter = Object.getOwnPropertyDescriptor(
        win.HTMLInputElement.prototype,
        "value",
      ).set;

      await ctx.act(() => {
        setter.call(input, value);

        input.dispatchEvent(new win.Event("input", { bubbles: true }));
      });
    },
    async submit(form) {
      await ctx.act(() => {
        form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      });
    },
  };

  try {
    tripwire(globalThis, "globalThis", TRANSPORT_GLOBALS);
    tripwire(globalThis, "globalThis", STORAGE_GLOBALS);
    tripwire(win, "window", TRANSPORT_GLOBALS);
    tripwire(win, "window", STORAGE_GLOBALS);

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

    define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
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

    const built = await buildRuntimeBundle(mutation, substitutions);

    ctx.inputs = built.inputs;
    ctx.modules = evaluateBundle(built.code, shared);

    assert.deepEqual(
      Object.keys(ctx.modules).sort(),
      ["AccountWorkspace", "BrokerCard", "LiveSessionPanel"],
    );

    const container = win.document.createElement("div");

    win.document.body.appendChild(container);

    ctx.container = container;
    root = shared["react-dom/client"].createRoot(container);

    await ctx.act(() => {
      root.render(tree(ctx.modules, ctx.React));
    });

    await scenario(ctx);
  } catch (error) {
    scenarioFailure = error;
  } finally {
    if (root !== null) {
      try {
        await ctx.React.act(async () => {
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
  }

  if (scenarioFailure) {
    throw scenarioFailure;
  }

  if (unmountFailure) {
    throw unmountFailure;
  }

  assert.deepEqual(touched, [], "a presentational component may reach no transport or storage");

  // React logs a key/type problem as an error; a silent suite must stay silent.
  assert.deepEqual(logged.error, [], "rendering must not log a React error");
}

// A failed assertion must not print a live DOM node: Node's inspect walks the
// React fibre back-references hanging off an element and exhausts the heap, so
// an absence check compares a count instead of a node.
function assertAbsent(ctx, selector, message) {
  assert.equal(ctx.findAll(selector).length, 0, message);
}

function assertPill(ctx, status) {
  const expected = EXPECTED_PILL[status];

  assert.ok(expected, `${status} is not an approved status`);

  const pill = ctx.find("[data-status]");

  assert.ok(pill, "a card must render its status pill");
  assert.equal(pill.getAttribute("data-status"), status, "the pill must carry the prop status");
  assert.equal(pill.textContent, expected.label, "the pill label must come from uiStatus");
  assert.match(pill.className, expected.tone, "the pill tone must match the status");
}

// ============================================================
// 1. PRESENCE AND CONTRACT GATES
// ============================================================

test("the three Task 7 presentational component files exist", () => {
  assertComponentFilesExist();
});

test("BrokerCard drops the old connected prop and takes the approved five", () => {
  assertComponentFilesExist();

  assertBrokerCardContract();
});

test("AccountWorkspace and LiveSessionPanel keep the approved props and stay side-effect free", () => {
  assertComponentFilesExist();

  assertWorkspaceAndPanelContracts();
});

// ============================================================
// 2. HARNESS INTEGRITY
// ============================================================

async function scenarioBundleGraph(ctx) {
  assert.deepEqual(
    ctx.inputs.filter((input) => input.includes("node_modules")),
    [],
  );

  assert.deepEqual(
    ctx.inputs.filter((input) => input.startsWith("src/")).sort(),
    [
      "src/brokerIntegrationComponentsRuntimeEntry.js",
      COMPONENT_FILES.BrokerCard,
      COMPONENT_FILES.AccountWorkspace,
      COMPONENT_FILES.LiveSessionPanel,
      "src/lib/brokerAccountIdentity.js",
      "src/lib/brokerIntegrationModel.js",
    ],
  );

  for (const forbidden of FORBIDDEN_INPUTS) {
    assert.equal(
      ctx.inputs.includes(forbidden),
      false,
      `${forbidden} must never enter the presentational bundle`,
    );
  }

  // Negative control: the allowlist watches a real boundary.
  let grew;

  try {
    const withoutStub = await buildRuntimeBundle(null, []);

    grew = withoutStub.inputs.some((input) => input.includes("lucide"));
  } catch (error) {
    grew = error instanceof Error;
  }

  assert.equal(grew, true, "removing the icon stub must grow the bundle graph");
}

test("the component bundle holds only the presentational graph", () =>
  withComponents({ tree: () => null }, scenarioBundleGraph));

// ============================================================
// 3. BROKERCARD
// ============================================================

function cardTree({ brokerKey = "mt5", snapshot, uiStatus, selected = false, onSelect, extra }) {
  return (modules, React) =>
    React.createElement(modules.BrokerCard, {
      broker: getBrokerById(brokerKey),
      snapshot,
      uiStatus,
      selected,
      onSelect,
      ...extra,
    });
}

for (const status of Object.keys(EXPECTED_PILL)) {
  test(`a ${status} card renders the ${EXPECTED_PILL[status].label} pill from props only`, () =>
    withComponents(
      {
        tree: cardTree({
          snapshot: mt5Block(),
          uiStatus: status,
          // The stale prop travels with it and must change nothing.
          extra: { connected: true },
        }),
      },
      async (ctx) => {
        assertPill(ctx, status);

        const button = ctx.find("button");

        assert.equal(button.getAttribute("type"), "button");
        assert.equal(button.getAttribute("aria-pressed"), "false");
        assert.equal(button.disabled, false);
      },
    ));
}

test("a card with no status in its props renders the loading pill", () =>
  withComponents(
    { tree: cardTree({ snapshot: mt5Block(), uiStatus: undefined }) },
    async (ctx) => {
      assertPill(ctx, UI_STATUS.loading);
    },
  ));

test("a disconnected card stays visible and selectable", () => {
  let selections = 0;

  return withComponents(
    {
      tree: cardTree({
        snapshot: mt5Block({ state: "disconnected", externalId: null, server: null, account: null }),
        uiStatus: UI_STATUS.disconnected,
        onSelect: () => {
          selections += 1;
        },
      }),
    },
    async (ctx) => {
      const button = ctx.find("button");

      assert.ok(button, "a disconnected broker must still render its card");
      assert.match(ctx.text(), /MetaTrader 5/);
      assert.equal(button.disabled, false, "a disconnected card must stay clickable");

      await ctx.click(button);

      assert.equal(selections, 1, "the approved onSelect must fire for a disconnected card");
    },
  );
});

test("the verified account id appears only from a live identity on a connected card", () =>
  withComponents(
    {
      tree: cardTree({ snapshot: mt5Block(), uiStatus: UI_STATUS.connected }),
    },
    async (ctx) => {
      const identity = ctx.find("[data-verified-identity]");

      assert.ok(identity, "a connected card with a live identity must show it");
      assert.equal(identity.getAttribute("data-verified-identity"), MT5_LOGIN);
      assert.match(identity.textContent, new RegExp(MT5_LOGIN));
    },
  ));

test("a card never prints a verified account id it was not given", () =>
  withComponents(
    {
      tree: cardTree({
        snapshot: mt5Block({ externalId: null, server: null, account: null }),
        uiStatus: UI_STATUS.connected,
      }),
    },
    async (ctx) => {
      assertAbsent(ctx, "[data-verified-identity]", "a snapshot with no live identity must not produce a verified account line");
    },
  ));

test("a card that is not connected shows no verified account id", () =>
  withComponents(
    {
      tree: cardTree({ snapshot: mt5Block(), uiStatus: UI_STATUS.loading }),
    },
    async (ctx) => {
      assertAbsent(ctx, "[data-verified-identity]", "only a connected card may show a verified account id");
    },
  ));

test("a card renders one compact supported-market line per broker", () =>
  withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.BrokerCard, {
            broker: getBrokerById("mt5"),
            snapshot: mt5Block(),
            uiStatus: UI_STATUS.connected,
          }),
          React.createElement(modules.BrokerCard, {
            broker: getBrokerById("ctrader"),
            snapshot: ctraderBlock(),
            uiStatus: UI_STATUS.connected,
          }),
        ),
    },
    async (ctx) => {
      const lines = ctx.findAll("[data-markets]");

      assert.equal(lines.length, 2, "both cards must state their own supported markets");

      for (const [index, brokerKey] of ["mt5", "ctrader"].entries()) {
        const markets = getBrokerById(brokerKey).markets;

        assert.equal(
          lines[index].textContent,
          markets.join(", "),
          `the ${brokerKey} market list must reach the screen separated`,
        );

        assert.notEqual(
          lines[index].textContent,
          markets.join(""),
          `the ${brokerKey} market list must not render as an unseparated run-on string`,
        );
      }

      assert.equal(
        ctx.text().includes("Supported Markets"),
        false,
        "the compact market line needs no explanatory heading",
      );
    },
  ));

test("a card renders no execution, provenance or limitation copy", () =>
  withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.BrokerCard, {
            broker: getBrokerById("mt5"),
            snapshot: mt5Block({
              limitations: ["The MT5 bridge serves one logged-in terminal session at a time."],
            }),
            uiStatus: UI_STATUS.connected,
          }),
          React.createElement(modules.BrokerCard, {
            broker: getBrokerById("ctrader"),
            snapshot: ctraderBlock(),
            uiStatus: UI_STATUS.connected,
          }),
        ),
    },
    async (ctx) => {
      for (const selector of ["[data-execution]", "[data-provenance]", "[data-limitations]"]) {
        assertAbsent(
          ctx,
          selector,
          `${selector} is diagnostic copy the approved card does not render`,
        );
      }

      const text = ctx.text().toLowerCase();

      for (const forbidden of [
        "desktop terminal",
        "local bridge",
        "browser-compatible",
        "authenticated backend service",
        "not enumerable",
        "live service",
        "local cache",
        "logged-in terminal session",
      ]) {
        assert.equal(
          text.includes(forbidden),
          false,
          `the approved card copy must not explain ${forbidden}`,
        );
      }
    },
  ));

test("a card still renders the props the approved fields need", () =>
  withComponents(
    {
      tree: cardTree({
        brokerKey: "ctrader",
        snapshot: ctraderBlock(),
        uiStatus: UI_STATUS.connected,
      }),
    },
    async (ctx) => {
      assert.match(ctx.text(), /cTrader/);
      assertPill(ctx, UI_STATUS.connected);

      const identity = ctx.find("[data-verified-identity]");

      assert.ok(
        identity,
        "a connected card with a live identity still shows the account number",
      );
      assert.equal(
        identity.getAttribute("data-verified-identity"),
        CT_TRADING_ACCOUNT_ID,
        "the verified account id must come from the snapshot, not the registry",
      );
    },
  ));

test("a cached cTrader card claims no verified account", () =>
  withComponents(
    {
      tree: cardTree({
        brokerKey: "ctrader",
        snapshot: ctraderBlock({ accountSource: "cache", connected: false }),
        uiStatus: UI_STATUS.disconnected,
      }),
    },
    async (ctx) => {
      assertAbsent(
        ctx,
        "[data-verified-identity]",
        "cached reconnect context is not a verified account",
      );
    },
  ));

test("a card never renders a token that travelled in the snapshot", () =>
  withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.BrokerCard, {
            broker: getBrokerById("mt5"),
            snapshot: mt5Block(),
            uiStatus: UI_STATUS.connected,
          }),
          React.createElement(modules.BrokerCard, {
            broker: getBrokerById("ctrader"),
            snapshot: ctraderBlock(),
            uiStatus: UI_STATUS.connected,
          }),
        ),
    },
    async (ctx) => {
      assert.equal(
        ctx.text().includes(SECRET),
        false,
        "no part of a token may reach the card's text",
      );
    },
  ));

test("a card's status follows the model's mapping for the same snapshot", () =>
  withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          ...[
            [UI_STATUS.connected, mt5Block()],
            [UI_STATUS.disconnected, mt5Block({ state: "disconnected", externalId: null })],
            [UI_STATUS.unreachable, mt5Block({ state: "unreachable" })],
          ].map(([expected, block]) =>
            React.createElement(modules.BrokerCard, {
              broker: getBrokerById("mt5"),
              snapshot: block,
              uiStatus: mapBrokerUiStatus({ snapshot: statusOf({ mt5: block }), brokerKey: "mt5" }),
              key: expected,
            }),
          ),
        ),
    },
    async (ctx) => {
      const pills = ctx.findAll("[data-status]").map((node) => node.getAttribute("data-status"));

      assert.deepEqual(
        pills,
        [UI_STATUS.connected, UI_STATUS.disconnected, UI_STATUS.unreachable],
        "mapBrokerUiStatus must feed the card the approved statuses",
      );
    },
  ));

// ============================================================
// 4. ACCOUNT WORKSPACE
// ============================================================

function noop() {}

function workspaceTree({
  brokerKey = "mt5",
  rows = [],
  selectedAccountId = null,
  onSelectAccount = noop,
  onConnect = noop,
  onDisconnect = noop,
  onStartService = noop,
  onAddCtraderAccount = noop,
  busy = false,
  error = null,
}) {
  return (modules, React) =>
    React.createElement(modules.AccountWorkspace, {
      brokerKey,
      rows,
      selectedAccountId,
      onSelectAccount,
      onConnect,
      onDisconnect,
      onStartService,
      onAddCtraderAccount,
      busy,
      error,
    });
}

test("a workspace states no bridge or authentication limitation copy", () => {
  const { rows } = defaultMt5Rows();

  return withComponents(
    { tree: workspaceTree({ brokerKey: "mt5", rows }) },
    async (ctx) => {
      assertAbsent(ctx, "[data-bridge-limitation]", "the enumeration limitation is diagnostic copy");
      assertAbsent(ctx, "[data-live-requirement]", "the authentication requirement is diagnostic copy");

      const text = ctx.text().toLowerCase();

      for (const forbidden of [
        "cannot enumerate",
        "local bridge",
        "cached account selection",
        "reconnect context",
      ]) {
        assert.equal(
          text.includes(forbidden),
          false,
          `the approved workspace copy must not explain ${forbidden}`,
        );
      }

      assert.match(
        ctx.text(),
        /MT5 accounts/,
        "the workspace still names the broker whose accounts it lists",
      );
    },
  );
});

test("the cTrader workspace keeps its rows, actions and one short setup line", () => {
  const { rows } = defaultCtraderRows();

  return withComponents(
    { tree: workspaceTree({ brokerKey: "ctrader", rows }) },
    async (ctx) => {
      assertAbsent(ctx, "[data-bridge-limitation]", "the MT5 note must not appear under cTrader");
      assertAbsent(ctx, "[data-live-requirement]", "the authentication requirement is diagnostic copy");

      const form = ctx.find("[data-ctrader-setup]");

      assert.ok(form, "recording an account id is a real workflow, so the form stays");
      assert.equal(
        form.querySelector("p").textContent,
        CT_SETUP_COPY,
        "the setup form states its purpose in one short line",
      );

      assert.equal(
        ctx.findAll('[data-action="connect"]').length,
        1,
        "the workspace still offers the authorize action",
      );
      assert.equal(ctx.findAll('[data-action="disconnect"]').length, 1);
      assert.equal(
        ctx.findAll('[data-action="start-service"]').length,
        1,
        "the service control is a real action, so it stays under cTrader",
      );
      assert.equal(
        ctx.findAll('[data-provenance="live"], [data-provenance="cached"]').length,
        1,
        "a row still carries its honest provenance pill",
      );
    },
  );
});

test("one external account number under two brokers stays two separate rows", () => {
  const shared = "1001";
  const aggregate = statusOf({
    mt5: mt5Block({ externalId: shared }),
    ctrader: ctraderBlock({ serviceAccountId: shared, requestedAccountId: shared }),
  });

  const stored = [
    storedMt5Account({ brokerAccountId: shared }),
    storedCtraderAccount({ id: "ctrader-1001", brokerAccountId: shared }),
  ];

  const mt5Rows = rowsFor({ brokerKey: "mt5", aggregate, stored });
  const ctraderRows = rowsFor({ brokerKey: "ctrader", aggregate, stored });

  return withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.AccountWorkspace, {
            brokerKey: "mt5",
            rows: mt5Rows,
            selectedAccountId: "mt5-1001",
          }),
          React.createElement(modules.AccountWorkspace, {
            brokerKey: "ctrader",
            rows: ctraderRows,
            selectedAccountId: "ctrader-1001",
          }),
        ),
    },
    async (ctx) => {
      const buttons = ctx.findAll("button[data-row-key]");

      assert.equal(mt5Rows.length, 1, "the MT5 workspace lists only MT5 accounts");
      assert.equal(ctraderRows.length, 1, "the cTrader workspace lists only cTrader accounts");
      assert.equal(buttons.length, 2, "both brokers must show their own row");
      assert.notEqual(
        buttons[0].getAttribute("data-row-key"),
        buttons[1].getAttribute("data-row-key"),
        "the same external id under two brokers must not collapse into one row",
      );
      assert.equal(mt5Rows[0].identity.externalId, shared);
      assert.equal(ctraderRows[0].identity.externalId, shared);
    },
  );
});

test("a live row is labelled live and every other row is labelled a cached record", () => {
  const { rows } = defaultMt5Rows();

  return withComponents(
    { tree: workspaceTree({ brokerKey: "mt5", rows, selectedAccountId: "mt5-1001" }) },
    async (ctx) => {
      assert.equal(rows.filter((row) => row.isLiveSession).length, 1);

      const live = ctx.findAll('[data-provenance="live"]');
      const cached = ctx.findAll('[data-provenance="cached"]');

      assert.equal(live.length, 1, "exactly one row may claim a live session");
      assert.equal(live[0].textContent, "Live session");
      assert.ok(
        cached.length >= 1,
        "a row the live session did not confirm must be labelled cached",
      );

      for (const node of cached) {
        assert.equal(node.textContent, "Cached record");
      }
    },
  );
});

test("a row with no broker account number is labelled incomplete", () => {
  const { rows } = defaultMt5Rows();

  const incomplete = rows.filter((row) => row.identity.externalId === null);

  return withComponents(
    { tree: workspaceTree({ brokerKey: "mt5", rows }) },
    async (ctx) => {
      assert.equal(incomplete.length, 1, "the fixture must carry one incomplete record");

      const badges = ctx.findAll("[data-incomplete]");

      assert.equal(badges.length, 1);
      assert.match(badges[0].textContent, /Incomplete/);
      assert.equal(
        ctx.text().includes("Half recorded"),
        true,
        "the stored account name must still be listed",
      );
    },
  );
});

test("a row with no local account id is listed but never selectable", () => {
  const { rows } = defaultMt5Rows();

  const unselectable = rows.filter((row) => row.identity.accountId === null);

  return withComponents(
    { tree: workspaceTree({ brokerKey: "mt5", rows }) },
    async (ctx) => {
      assert.equal(unselectable.length, 1, "the fixture must carry one id-less record");

      const buttons = ctx.findAll("button[data-row-key]");

      assert.equal(
        buttons.some((node) => node.getAttribute("data-row-key") === unselectable[0].rowKey),
        false,
        "a record with no local id must not render a selectable button",
      );

      const listed = ctx.findAll("[data-row-key]");

      assert.equal(
        listed.some((node) => node.getAttribute("data-row-key") === unselectable[0].rowKey),
        true,
        "the record must still be visible in the list",
      );
      assert.match(ctx.text(), /Not selectable/);
    },
  );
});

test("selecting a row calls onSelectAccount with exactly that row", () => {
  const { rows } = defaultMt5Rows();
  const calls = [];

  return withComponents(
    {
      tree: workspaceTree({
        brokerKey: "mt5",
        rows,
        selectedAccountId: "mt5-1001",
        onSelectAccount: (row) => calls.push(row),
      }),
    },
    async (ctx) => {
      const buttons = ctx.findAll("button[data-row-key]");
      const target = buttons.find(
        (node) => node.getAttribute("data-row-key") === rows[1].rowKey,
      );

      assert.ok(target, "the second stored account must be rendered as a row");
      assert.equal(calls.length, 0, "nothing is selected before the click");

      await ctx.click(target);

      assert.equal(calls.length, 1, "one click must produce one selection");
      assert.equal(calls[0], rows[1], "the callback must receive that row object");
    },
  );
});

test("the selected row is marked selected and every other row is not", () => {
  const { rows } = defaultMt5Rows();

  return withComponents(
    { tree: workspaceTree({ brokerKey: "mt5", rows, selectedAccountId: "mt5-1001" }) },
    async (ctx) => {
      const buttons = ctx.findAll("button[data-row-key]");
      const pressed = buttons.filter((node) => node.getAttribute("aria-pressed") === "true");

      assert.equal(pressed.length, 1, "exactly one row may read as selected");
      assert.equal(pressed[0].getAttribute("data-row-key"), rows[0].rowKey);
      assert.match(pressed[0].textContent, /Selected/);
    },
  );
});

test("the MT5 workspace offers connect, reconnect and disconnect and no service controls", () => {
  const { rows } = defaultMt5Rows();
  const calls = { connect: 0, disconnect: 0 };

  return withComponents(
    {
      tree: workspaceTree({
        brokerKey: "mt5",
        rows,
        selectedAccountId: "mt5-1001",
        onConnect: () => {
          calls.connect += 1;
        },
        onDisconnect: () => {
          calls.disconnect += 1;
        },
      }),
    },
    async (ctx) => {
      const actions = ctx.findAll("button[data-action]").map((node) => node.getAttribute("data-action"));

      assert.deepEqual(actions.sort(), ["connect", "disconnect"]);
      assert.match(ctx.buttonFor("Reconnect").textContent, /Reconnect/, "a live row means reconnect");
      assertAbsent(ctx, '[data-action="start-service"]', "MT5 has no service to start from this workspace");
      assertAbsent(ctx, "form", "MT5 records no account id through this workspace");

      await ctx.click(ctx.buttonFor("Reconnect"));
      await ctx.click(ctx.buttonFor("Disconnect"));

      assert.deepEqual(calls, { connect: 1, disconnect: 1 });
    },
  );
});

test("the MT5 workspace offers Connect when no row is live", () => {
  const aggregate = statusOf({ mt5: mt5Block({ state: "disconnected", externalId: null }) });
  const rows = rowsFor({ brokerKey: "mt5", aggregate, stored: [storedMt5Account()] });

  return withComponents(
    { tree: workspaceTree({ brokerKey: "mt5", rows }) },
    async (ctx) => {
      assert.match(ctx.buttonFor("Connect").textContent, /^Connect$/);
      assert.equal(
        ctx.text().includes("Reconnect"),
        false,
        "nothing is live, so the offer must be Connect",
      );
    },
  );
});

test("the cTrader workspace offers start service, authorize, select and disconnect", () => {
  const aggregate = statusOf({ ctrader: ctraderBlock({ connected: false, authenticated: false }) });
  const rows = rowsFor({
    brokerKey: "ctrader",
    aggregate,
    stored: [],
  });
  const calls = { connect: 0, disconnect: 0, start: 0 };

  return withComponents(
    {
      tree: workspaceTree({
        brokerKey: "ctrader",
        rows,
        onConnect: () => {
          calls.connect += 1;
        },
        onDisconnect: () => {
          calls.disconnect += 1;
        },
        onStartService: () => {
          calls.start += 1;
        },
      }),
    },
    async (ctx) => {
      const actions = ctx
        .findAll("button[data-action]")
        .map((node) => node.getAttribute("data-action"))
        .sort();

      assert.deepEqual(actions, ["connect", "disconnect", "start-service"]);
      assert.match(ctx.buttonFor("Authorize").textContent, /^Authorize$/);
      assert.ok(ctx.find('[data-ctrader-setup]'), "cTrader needs an account id setup form");

      await ctx.click(ctx.buttonFor("Start service"));
      await ctx.click(ctx.buttonFor("Authorize"));
      await ctx.click(ctx.buttonFor("Disconnect"));

      assert.deepEqual(calls, { connect: 1, disconnect: 1, start: 1 });
    },
  );
});

test("the cTrader workspace offers Reauthorize once an account is recorded", () => {
  const { rows } = defaultCtraderRows();

  return withComponents(
    { tree: workspaceTree({ brokerKey: "ctrader", rows }) },
    async (ctx) => {
      assert.match(ctx.buttonFor("Reauthorize").textContent, /Reauthorize/);
      assert.equal(
        ctx.findAll("button").some((node) => node.textContent.trim() === "Authorize"),
        false,
        "an existing account must move the offer to Reauthorize",
      );
    },
  );
});

test("the cTrader setup form submits only the trimmed account id and name", () => {
  const submissions = [];

  return withComponents(
    {
      tree: workspaceTree({
        brokerKey: "ctrader",
        rows: [],
        onAddCtraderAccount: (value) => submissions.push(value),
      }),
    },
    async (ctx) => {
      const form = ctx.find("[data-ctrader-setup]");
      const idInput = form.querySelector('input[name="accountId"]');
      const nameInput = form.querySelector('input[name="accountName"]');

      assert.ok(idInput && nameInput, "the form must carry an account id and a name field");

      await ctx.type(idInput, ` ${CT_TRADING_ACCOUNT_ID} `);
      await ctx.type(nameInput, "  Main demo  ");

      assert.equal(idInput.value.trim(), CT_TRADING_ACCOUNT_ID, "the typed id must be held");

      await ctx.submit(form);

      assert.equal(submissions.length, 1, "one submit must produce one request");
      assert.deepEqual(
        submissions[0],
        { accountId: CT_TRADING_ACCOUNT_ID, accountName: "Main demo" },
        "the form must hand over plain trimmed values and nothing else",
      );
    },
  );
});

test("the cTrader setup form submits nothing for a blank account id", () => {
  const submissions = [];

  return withComponents(
    {
      tree: workspaceTree({
        brokerKey: "ctrader",
        rows: [],
        onAddCtraderAccount: (value) => submissions.push(value),
      }),
    },
    async (ctx) => {
      const form = ctx.find("[data-ctrader-setup]");

      await ctx.type(form.querySelector('input[name="accountId"]'), "   ");
      await ctx.type(form.querySelector('input[name="accountName"]'), "Named but unknown");
      await ctx.submit(form);

      assert.deepEqual(
        submissions,
        [],
        "a blank account id must not be submitted for selection",
      );
    },
  );
});

test("every workspace control is disabled while busy", () => {
  const { rows } = defaultCtraderRows();

  return withComponents(
    { tree: workspaceTree({ brokerKey: "ctrader", rows, busy: true }) },
    async (ctx) => {
      const buttons = ctx.findAll("button");

      assert.ok(buttons.length > 0, "the workspace must render its controls");

      for (const button of buttons) {
        assert.equal(
          button.disabled,
          true,
          `the ${button.textContent.trim()} control must be disabled while busy`,
        );
      }

      for (const input of ctx.findAll("input")) {
        assert.equal(input.disabled, true, "the setup form must be disabled while busy");
      }
    },
  );
});

test("a workspace error renders in an alert role and nothing else disappears", () => {
  const { rows } = defaultMt5Rows();

  return withComponents(
    {
      tree: workspaceTree({
        brokerKey: "mt5",
        rows,
        error: "The MT5 bridge did not answer.",
      }),
    },
    async (ctx) => {
      const alert = ctx.find('[role="alert"]');

      assert.ok(alert, "an error must be announced with role=alert");
      assert.match(alert.textContent, /The MT5 bridge did not answer\./);
      assert.equal(
        ctx.findAll("button[data-row-key]").length,
        rows.filter((row) => row.identity.accountId !== null).length,
        "an error may not hide the account list",
      );
    },
  );
});

test("no workspace control or copy submits, closes or modifies an order", () => {
  const mt5 = defaultMt5Rows();
  const ctrader = defaultCtraderRows();

  return withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.AccountWorkspace, { brokerKey: "mt5", rows: mt5.rows }),
          React.createElement(modules.AccountWorkspace, {
            brokerKey: "ctrader",
            rows: ctrader.rows,
          }),
        ),
    },
    async (ctx) => {
      const labels = ctx.findAll("button").map((node) => node.textContent.trim());

      for (const label of labels) {
        assert.equal(
          /close|modify|cancel|delete|submit order|place order/i.test(label),
          false,
          `the ${label} control must not touch an order`,
        );
      }

      assert.equal(
        /close (?:this |all )?(?:position|order)|modify (?:this )?(?:position|order)/i.test(
          ctx.text(),
        ),
        false,
        "no copy may offer to change a live order",
      );
    },
  );
});

test("the workspace never renders a token carried by a stored account", () => {
  const ctrader = defaultCtraderRows();
  const mt5 = defaultMt5Rows();

  return withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.AccountWorkspace, {
            brokerKey: "ctrader",
            rows: ctrader.rows,
          }),
          React.createElement(modules.AccountWorkspace, { brokerKey: "mt5", rows: mt5.rows }),
        ),
    },
    async (ctx) => {
      assert.equal(
        ctx.text().includes(SECRET),
        false,
        "a stored account token may not reach the screen",
      );
      assert.equal(
        ctx.html().includes(SECRET),
        false,
        "a stored account token may not reach an attribute either",
      );
    },
  );
});

// ============================================================
// 5. LIVE SESSION PANEL
// ============================================================

function panelTree({ brokerKey = "mt5", session, loading = false }) {
  return (modules, React) =>
    React.createElement(modules.LiveSessionPanel, { brokerKey, session, loading });
}

test("the six MT5 metrics and the sync stamp render from a validated session", () => {
  const session = healthyMt5Session({ orders: [mt5PendingOrder()] });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.equal(session.validationError, null, "the fixture must be a validated session");

      assert.equal(ctx.find('[data-metric="balance"]').textContent, "USD 10,000.50");
      assert.equal(ctx.find('[data-metric="equity"]').textContent, "USD 10,050.25");
      assert.equal(ctx.find('[data-metric="marginUsed"]').textContent, "USD 200");
      assert.equal(ctx.find('[data-metric="freeMargin"]').textContent, "USD 9,850.25");
      assert.equal(ctx.find('[data-metric="currency"]').textContent, "USD");
      assert.equal(ctx.find('[data-metric="leverage"]').textContent, "100x");
      assert.equal(ctx.find('[data-metric="lastSuccessfulSync"]').textContent, SYNCED_AT);

      for (const label of [
        "Balance",
        "Equity",
        "Margin used",
        "Free margin",
        "Currency",
        "Leverage",
        "Last successful sync",
      ]) {
        assert.ok(ctx.text().includes(label), `${label} must be labelled`);
      }
    },
  );
});

test("the six cTrader metrics render from the live service account", () => {
  const session = healthyCtraderSession();

  return withComponents(
    { tree: panelTree({ brokerKey: "ctrader", session }) },
    async (ctx) => {
      assert.equal(session.validationError, null);
      assert.equal(ctx.find('[data-metric="balance"]').textContent, "USD 5,000");
      assert.equal(ctx.find('[data-metric="equity"]').textContent, "USD 5,010.50");
      assert.equal(ctx.find('[data-metric="marginUsed"]').textContent, "USD 100");
      assert.equal(ctx.find('[data-metric="freeMargin"]').textContent, "USD 4,910.50");
      assert.equal(ctx.find('[data-metric="leverage"]').textContent, "100x");
    },
  );
});

test("a zero metric renders zero, never Unavailable", () => {
  const session = healthyMt5Session({
    account: mt5AccountBlock({ balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "EUR" }),
  });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.equal(ctx.find('[data-metric="balance"]').textContent, "EUR 0");
      assert.equal(ctx.find('[data-metric="equity"]').textContent, "EUR 0");
      assert.equal(ctx.find('[data-metric="marginUsed"]').textContent, "EUR 0");
      assert.equal(ctx.find('[data-metric="freeMargin"]').textContent, "EUR 0");
      assert.equal(
        ctx.find('[data-metric="balance"]').textContent.includes(UNAVAILABLE),
        false,
        "a real zero may not be relabelled Unavailable",
      );
    },
  );
});

test("a negative metric keeps its sign", () => {
  const session = healthyMt5Session({
    account: mt5AccountBlock({ balance: -250.5, equity: -250.5 }),
  });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.equal(ctx.find('[data-metric="balance"]').textContent, "USD -250.50");
    },
  );
});

test("an unvalidated session renders Unavailable for every metric, not a stored number", () => {
  const session = createEmptySession();

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      for (const key of [
        "balance",
        "equity",
        "marginUsed",
        "freeMargin",
        "currency",
        "leverage",
        "lastSuccessfulSync",
      ]) {
        assert.equal(
          ctx.find(`[data-metric="${key}"]`).textContent,
          UNAVAILABLE,
          `an unvalidated ${key} must read Unavailable`,
        );
      }

      assert.equal(
        ctx.text().includes("4321.11"),
        false,
        "a stored balance may never stand in for a live one",
      );
    },
  );
});

test("a rejected MT5 session states why it shows nothing", () => {
  const session = healthyMt5Session({
    // A session the model rejects outright: the terminal is not connected, so
    // nothing in this round can be attributed to an account.
    block: { state: "disconnected", externalId: null, server: null, account: null },
  });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.ok(session.validationError, "the model must have rejected this session");

      const reason = ctx.find("[data-validation-error]");

      assert.ok(reason, "the rejection must be visible on screen");
      assert.equal(reason.textContent, session.validationError);
      assert.equal(ctx.find('[data-metric="balance"]').textContent, UNAVAILABLE);
    },
  );
});

test("validated empty positions say no open positions", () => {
  const session = healthyMt5Session({ positions: [] });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.deepEqual(session.positions, [], "an empty book must arrive as an array");
      assert.match(ctx.text(), /No open positions/);
      assertAbsent(ctx, "[data-positions-table]", "a validated empty book renders no positions table");
    },
  );
});

test("unvalidated positions say Unavailable, never an empty book", () => {
  const session = healthyMt5Session({ success: false });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.equal(session.positions, null, "an unvalidated book must arrive as null");

      const state = ctx.find("[data-positions]");

      assert.equal(state.getAttribute("data-positions"), "unavailable");
      assert.match(state.textContent, new RegExp(UNAVAILABLE));
      assert.equal(
        ctx.text().includes("No open positions"),
        false,
        "unavailable positions must not read as a validated empty book",
      );
    },
  );
});

test("MT5 positions render as a scrollable table of the fields the bridge reported", () => {
  const session = healthyMt5Session();

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      const table = ctx.find("[data-positions-table]");

      assert.ok(table, "a populated position book must render a table");
      assert.match(
        table.closest("div").className,
        /overflow-x-auto/,
        "the table must be horizontally scrollable",
      );

      assert.equal(table.querySelectorAll("tbody tr").length, 1);
      assert.match(table.textContent, /EURUSD/);
      assert.match(table.textContent, /4400001/);
      assert.match(table.textContent, /0\.1/);
      assertAbsent(ctx, '[data-pending-orders="unavailable"]', "a pending-orders response is not part of this assertion");
    },
  );
});

test("cTrader positions render the fields the service reported", () => {
  const session = healthyCtraderSession();

  return withComponents(
    { tree: panelTree({ brokerKey: "ctrader", session }) },
    async (ctx) => {
      const table = ctx.find("[data-positions-table]");

      assert.ok(table, "a validated cTrader book must render a table");
      assert.match(table.textContent, /EURUSD/);
      assert.match(table.textContent, /7001/);
      assert.match(table.textContent, /buy/);
    },
  );
});

test("MT5 pending orders render from the bridge order fields", () => {
  const session = healthyMt5Session({ orders: [mt5PendingOrder()] });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      const table = ctx.find("[data-pending-orders-table]");

      assert.ok(table, "a validated pending-order list must render a table");
      assert.match(table.textContent, /GBPUSD/);
      assert.match(table.textContent, /BUY_LIMIT/);
      assert.equal(table.querySelectorAll("tbody tr").length, 1);
    },
  );
});

test("an empty validated pending-order list says none, not unavailable", () => {
  const session = healthyMt5Session({ orders: [] });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.deepEqual(session.pendingOrders, []);
      assert.equal(session.pendingOrdersReason, null);
      assert.match(ctx.text(), /No pending orders/);
    },
  );
});

test("an unconfirmed pending-order read says Unavailable and states no reason", () => {
  const session = createEmptySession();

  session.positions = [];
  session.pendingOrders = null;
  session.pendingOrdersReason = "The MT5 bridge could not list pending orders.";

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      const state = ctx.find("[data-pending-orders]");

      assert.equal(state.getAttribute("data-pending-orders"), "unavailable");
      assert.match(state.textContent, new RegExp(UNAVAILABLE));
      assertAbsent(ctx, "[data-pending-reason]", "the reason a read failed is diagnostic copy");
      assert.equal(
        ctx.text().includes("The MT5 bridge could not list pending orders."),
        false,
        "the panel must not print the bridge reason",
      );
    },
  );
});

test("cTrader pending orders read unavailable, never as an empty list", () => {
  const session = healthyCtraderSession();

  return withComponents(
    { tree: panelTree({ brokerKey: "ctrader", session }) },
    async (ctx) => {
      assert.equal(session.pendingOrders, null, "the model never validates a cTrader order list");

      const state = ctx.find("[data-pending-orders]");

      assert.equal(state.getAttribute("data-pending-orders"), "unavailable");
      assert.match(state.textContent, new RegExp(UNAVAILABLE));
      assertAbsent(ctx, "[data-pending-orders-table]", "an unavailable pending-order list renders no table");
      assert.equal(
        ctx.text().includes("No pending orders"),
        false,
        "unavailable pending orders must not read as a validated empty book",
      );
      assert.equal(
        ctx.text().includes("Pending-order listing is unavailable for cTrader."),
        false,
        "the panel must not print the backend limitation sentence",
      );
    },
  );
});

test("the loading indicator appears beside unavailable data", () => {
  const session = createEmptySession();

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session, loading: true }) },
    async (ctx) => {
      const indicator = ctx.find("[data-loading]");

      assert.ok(indicator, "a refresh in progress must be visible");
      assert.equal(indicator.getAttribute("role"), "status");
      assert.match(indicator.textContent, /Loading/);
      assert.equal(
        ctx.find('[data-metric="balance"]').textContent,
        UNAVAILABLE,
        "a loading round must not present old numbers as current",
      );
      assert.equal(ctx.find('[data-positions]').getAttribute("data-positions"), "unavailable");
    },
  );
});

test("the panel renders no controls at all", () => {
  const session = healthyMt5Session({ orders: [mt5PendingOrder()] });

  return withComponents(
    { tree: panelTree({ brokerKey: "mt5", session }) },
    async (ctx) => {
      assert.equal(ctx.findAll("button").length, 0, "a session panel may not act on an order");
      assert.equal(ctx.findAll("form").length, 0);

      assert.equal(
        /close|modify|cancel|submit|delete/i.test(ctx.text()),
        false,
        "no panel copy may offer to change an order",
      );
    },
  );
});

test("the panel never renders a token carried by the session payload", () => {
  const mt5 = healthyMt5Session({ orders: [mt5PendingOrder()] });
  const ctrader = healthyCtraderSession();

  return withComponents(
    {
      tree: (modules, React) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(modules.LiveSessionPanel, { brokerKey: "mt5", session: mt5 }),
          React.createElement(modules.LiveSessionPanel, { brokerKey: "ctrader", session: ctrader }),
        ),
    },
    async (ctx) => {
      assert.equal(ctx.text().includes(SECRET), false, "no token may reach the panel text");
      assert.equal(ctx.html().includes(SECRET), false, "no token may reach a panel attribute");
    },
  );
});

// ============================================================
// 6. MUTATION PROBES
// ============================================================
//
// Each row names the one scenario, and the one assertion inside it, that must
// reject the mutant. The scenario re-runs unmutated first, so a rejection can
// only mean the mutant moved something.

const PROBES = Object.freeze([
  [
    "cardIdentityIgnoresStatus",
    "unconnected card shows no verified id",
    /only a connected card may show a verified account id/,
  ],
  [
    "cardMarketsRunOn",
    "compact market line",
    /must reach the screen separated/,
  ],
  ["rowAlwaysLive", "live and cached rows", /a row the live session did not confirm must be labelled cached/],
  [
    "positionsNullAsEmpty",
    "unvalidated positions",
    /unavailable positions must not read as a validated empty book/,
  ],
  [
    "pendingNullAsEmpty",
    "unconfirmed pending orders",
    /unavailable pending orders must not read as a validated empty book/,
  ],
  ["formGuardDropped", "blank account id", /a blank account id must not be submitted for selection/],
]);

// Each probe scenario is a factory of one run: it takes the mutant (or null for
// the control) and builds its own fresh state, so the control and the mutant
// never share a submissions array or a rows fixture.

const PROBE_SCENARIOS = Object.freeze({
  "unconnected card shows no verified id": (mutation) =>
    withComponents(
      {
        mutation,
        tree: cardTree({ snapshot: mt5Block(), uiStatus: UI_STATUS.loading }),
      },
      async (ctx) => {
        assertAbsent(ctx, "[data-verified-identity]", "only a connected card may show a verified account id");
      },
    ),
  "compact market line": (mutation) =>
    withComponents(
      {
        mutation,
        tree: cardTree({ snapshot: mt5Block(), uiStatus: UI_STATUS.connected }),
      },
      async (ctx) => {
        const line = ctx.find("[data-markets]");

        assert.ok(line, "the card must render a compact market line");

        assert.equal(
          line.textContent,
          getBrokerById("mt5").markets.join(", "),
          "the mt5 market list must reach the screen separated",
        );
      },
    ),
  "live and cached rows": (mutation) => {
    const { rows } = defaultMt5Rows();

    return withComponents(
      {
        mutation,
        tree: workspaceTree({ brokerKey: "mt5", rows, selectedAccountId: "mt5-1001" }),
      },
      async (ctx) => {
        assert.equal(
          ctx.findAll('[data-provenance="live"]').length,
          1,
          "a row the live session did not confirm must be labelled cached",
        );
      },
    );
  },
  "unvalidated positions": (mutation) => {
    const session = healthyMt5Session({ success: false });

    return withComponents(
      { mutation, tree: panelTree({ brokerKey: "mt5", session }) },
      async (ctx) => {
        assert.equal(
          ctx.text().includes("No open positions"),
          false,
          "unavailable positions must not read as a validated empty book",
        );
      },
    );
  },
  "unconfirmed pending orders": (mutation) => {
    const session = healthyCtraderSession();

    return withComponents(
      { mutation, tree: panelTree({ brokerKey: "ctrader", session }) },
      async (ctx) => {
        assert.equal(
          ctx.text().includes("No pending orders"),
          false,
          "unavailable pending orders must not read as a validated empty book",
        );
      },
    );
  },
  "blank account id": (mutation) => {
    const submissions = [];

    return withComponents(
      {
        mutation,
        tree: workspaceTree({
          brokerKey: "ctrader",
          rows: [],
          onAddCtraderAccount: (value) => submissions.push(value),
        }),
      },
      async (ctx) => {
        const form = ctx.find("[data-ctrader-setup]");

        await ctx.type(form.querySelector('input[name="accountId"]'), "  ");
        await ctx.submit(form);

        assert.deepEqual(
          submissions,
          [],
          "a blank account id must not be submitted for selection",
        );
      },
    );
  },
});

for (const [name, scenarioName, expects] of PROBES) {
  test(`mutation probe: ${name} is rejected by the component assertions`, async () => {
    // Control: the same scenario against the untouched disk source must pass.
    // If it does not, a rejection below only proves the scenario is broken, so
    // this run is deliberately left uncaught.
    await PROBE_SCENARIOS[scenarioName](null);

    let failure = null;

    try {
      await PROBE_SCENARIOS[scenarioName](MUTATIONS[name]);
    } catch (error) {
      failure = error;
    }

    assert.ok(
      failure,
      `${name} must make ${scenarioName} fail, and it stayed green`,
    );

    const code = failure.code ?? failure.cause?.code;

    assert.equal(
      code,
      "ERR_ASSERTION",
      `${scenarioName} must reject ${name} with an assertion, got ${String(failure)}`,
    );

    // Not every assertion counts as detection: the mutant has to be rejected by
    // the assertion that names the behaviour it broke.
    const assertionError = failure.code === "ERR_ASSERTION" ? failure : failure.cause;

    assert.match(
      String(assertionError.message),
      expects,
      `${name} must be rejected by the ${scenarioName} assertion named for it`,
    );
  });
}

// ============================================================
// 7. PROBE REGISTRY ARITY
// ============================================================

function probeRegistryProblems(probes) {
  const problems = [];

  for (const [name, scenarioName, expects] of probes) {
    if (typeof scenarioName !== "string" || !PROBE_SCENARIOS[scenarioName]) {
      problems.push(`${name} maps no scenario`);
      continue;
    }

    if (!(expects instanceof RegExp)) {
      problems.push(`${name} has no expected assertion`);
    }
  }

  return problems;
}

test("every probe row names a scenario and the assertion that rejects its mutant", () => {
  assert.deepEqual(
    probeRegistryProblems(PROBES),
    [],
    "each probe must map one scenario and one expected assertion",
  );
});
