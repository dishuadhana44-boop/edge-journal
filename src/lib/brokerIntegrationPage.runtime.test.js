// ============================================================
// PHASE 3 BROKER INTEGRATION PAGE ORCHESTRATION (Tasks 8 and 9)
// ============================================================
//
// WHAT IS REAL HERE
//
// The page is bundled with esbuild and mounted with the installed React 19
// runtime in a jsdom document, in the same in-memory pattern as
// src/lib/brokerIntegrationComponents.runtime.test.js. The three Task 7
// components, src/lib/brokerIntegrationModel.js and
// src/lib/brokerAccountIdentity.js are the real modules, so every pill, row and
// metric below is derived by the code that ships.
//
// WHAT IS SUBSTITUTED, AND WHY
//
//   - lucide-react: an icon package has no business running in a Node process.
//   - src/services/brokerApi.js: a fake module with one function per export.
//     This is the only way to observe the request ORDER, the arguments and the
//     late-response behaviour without a server, and it is exactly the seam the
//     plan names ("brokerApi replaced by a controllable fake module"). The real
//     contracts are already pinned by src/services/brokerApi.test.js, and the
//     page bundle is asserted not to contain it.
//   - src/context/JournalContext.jsx: a fake useJournal, so the global account
//     selection is an input with a recorded setter instead of a provider that
//     reads and writes the real journal storage.
//   - localStorage: a working in-memory fake that RECORDS every set and remove.
//     Storage is legitimate for a page (it is not a presentational component),
//     so "opening this page wrote nothing" is an assertion over that log rather
//     than a tripwire.
//
// Task 9 adds three more seams, each opt-in per scenario:
//
//   - navigation: jsdom refuses every cross-document navigation and its
//     Location.href is a non-configurable own accessor, so no property can be
//     installed over it. A scenario with navigation:true runs the bundle
//     against a Proxy of the jsdom window whose location forwards reads and
//     records writes, which is how "Authorize went to ctraderConnectUrl()" is
//     observed as an exact string.
//   - fetchHandler: the MT5 connect request belongs to the existing
//     MT5ConnectionModal, which posts with its own base URL. The modal is real
//     here, so a scenario that opens it installs a fetch that records
//     {url, method, body} and answers with the body the scenario chose. Those
//     scenarios assert the recorded request list itself, which says more than
//     the tripwire would.
//   - manualTimers: the modal closes itself 700ms after a success. Fake
//     setTimeout makes that a step the scenario takes when it wants to, and the
//     runner's own drains use the timer captured before the fake was installed.
//
// ISOLATION, STATED EXACTLY
//
//   - No runScripts and no resources:"usable" on the JSDOM instance.
//   - fetch, XMLHttpRequest, WebSocket, EventSource and setInterval on both
//     globalThis and the jsdom window throw and are recorded: the page reaches
//     the network only through the substituted brokerApi.
//   - The jsdom window is closed in finally, which kills any timer the page
//     armed, and every installed descriptor is restored in reverse order.
//   - Mutation probes are applied to the text esbuild reads, never to a
//     repository file. Each probe re-runs its scenario unmutated first.
//   - After every mount the runner asserts no payload sentinel reached the DOM
//     and that React logged no error.
//
// WHAT THIS CANNOT PROVE
//
// This is jsdom with a fake transport. It proves the page's state machine:
// which requests it makes, in what order, what it renders from the answers, and
// what it refuses to render when an answer is stale or unvalidated. It proves
// nothing about a real MT5 terminal, a real cTrader service, real CSS layout, or
// the OAuth round trip - connection workflows are Task 9.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

import { CTRADER_BROKER_LABEL_KEY, UNAVAILABLE } from "./brokerIntegrationModel.js";
import {
  makeAccountIdentity,
  migrateTradingAccounts,
} from "./brokerAccountIdentity.js";
import {
  ENVELOPE_VERSION,
  RESUME_TTL_MS,
  STORAGE_KEY as WIZARD_STORAGE_KEY,
  deserialize as deserializeWizardEnvelope,
  serialize as serializeWizardEnvelope,
} from "./brokerWizardModel.js";

const nodeRequire = createRequire(import.meta.url);

// Captured before any scenario can install a fake, because the runner's own
// waits have to keep working while the page under test sees manual timers.
const NATIVE_SET_TIMEOUT = globalThis.setTimeout;

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

const PAGE_FILE = "src/components/settings/BrokerIntegrationPage.jsx";

// ============================================================
// THE CONTRACT UNDER TEST
// ============================================================

// A sentinel that appears in payload fields the page is never allowed to render.
const SECRET = "FAKE_SECRET_TOKEN";

const MT5_LOGIN = "1001";
const MT5_LOGIN_B = "2002";
const MT5_SERVER = "documents-4";
const CT_TRADING_ACCOUNT_ID = "395823";
const CT_TRADER_LOGIN = "556677";
const OBSERVED_AT = "2026-11-05T10:00:00.000Z";

const ACCOUNTS_KEY = "tradingAccounts";

// The address a browser comes back to after the cTrader hand-off. It is the only
// way this page opens a workspace without a validated session, which is what the
// connection workflows need: the broker is selected, no account is chosen and
// nothing has been read yet.
const WORKSPACE_URL = "http://localhost/settings?ctrader=connected";

// Listed in the order Array.prototype.sort puts them in, because the graph
// check compares a sorted array and deepEqual on arrays is order-sensitive.
// The wizard files are on this list because the page mounts the wizard: a page
// that grew its own copy of these screens would show up here as an extra module,
// not as a passing test.
const APPROVED_INPUTS = Object.freeze([
  "src/brokerIntegrationPageRuntimeEntry.js",
  "src/brokers/BrokerCard.jsx",
  "src/brokers/brokerRegistry.js",
  "src/components/settings/BrokerIntegrationPage.jsx",
  "src/components/settings/MT5ConnectionModal.jsx",
  "src/components/settings/broker-integration/AccountWorkspace.jsx",
  "src/components/settings/broker-integration/LiveSessionPanel.jsx",
  "src/components/settings/broker-wizard/BrokerWizardOverlay.jsx",
  "src/components/settings/broker-wizard/WizardStepper.jsx",
  "src/components/settings/broker-wizard/steps/AccountSelectModal.jsx",
  "src/components/settings/broker-wizard/steps/AuthorizationIntroStep.jsx",
  "src/components/settings/broker-wizard/steps/AuthorizationPendingStep.jsx",
  "src/components/settings/broker-wizard/steps/ChooseMethodStep.jsx",
  "src/components/settings/broker-wizard/steps/SearchBrokerStep.jsx",
  "src/components/settings/broker-wizard/steps/VerificationStep.jsx",
  "src/lib/brokerAccountIdentity.js",
  "src/lib/brokerIntegrationModel.js",
  "src/lib/brokerWizardModel.js",
]);

// Every one of these is a legacy habit the plan retires in Task 8. The message
// names the behaviour, so a RED run says which habit is still on disk.
const FORBIDDEN_PAGE_SOURCE = Object.freeze([
  [
    /\bfetch\s*\(/,
    "the page must call the broker API module, not fetch",
  ],
  [
    /connected=\{true\}/,
    "the page must pass a real uiStatus instead of connected={true}",
  ],
  [
    /from\s+["'][^"']*AddBrokerModal/,
    "the page must not import AddBrokerModal in the inline flow",
  ],
  [
    /from\s+["'][^"']*BrokerDetailsModal/,
    "the page must not import BrokerDetailsModal in the inline flow",
  ],
  [
    /API_URL/,
    "the page must not own a base URL; brokerApi owns it",
  ],
  // The modal writes this flag back into a record after a confirmed disconnect;
  // reading it to decide what is connected is the legacy habit, so only the
  // comparison is forbidden.
  [
    /mt5Connected\s*[!=]==|if\s*\([^)]*\.mt5Connected/,
    "the page must not derive status from a stored connection flag",
  ],
]);

const REQUIRED_PAGE_SOURCE = Object.freeze([
  [
    /from\s+["'][^"']*\.\.\/\.\.\/services\/brokerApi["']/,
    "the page must import its transport from brokerApi",
  ],
  [
    /from\s+["'][^"']*\.\.\/\.\.\/context\/JournalContext["']/,
    "the page must read the global account selection from JournalContext",
  ],
  [
    /migrateTradingAccounts\(/,
    "the page must migrate stored accounts through migrateTradingAccounts",
  ],
  [
    /makeAccountIdentity\(/,
    "the page must derive the initial broker from makeAccountIdentity",
  ],
  [
    /createRequestGuard\(\)/,
    "the page must guard requests with createRequestGuard",
  ],
]);

// Task 9: the connection workflows. These are checked by one gate test, not by
// every scenario, so a missing workflow shows up as the behaviour that is
// absent — a control that does nothing — while the Task 8 scenarios keep
// proving the orchestration that is already on disk.
const REQUIRED_WORKFLOW_SOURCE = Object.freeze([
  [
    /from\s+["']\.\/MT5ConnectionModal["']/,
    "the page must open the existing MT5 modal instead of a new credential form",
  ],
  [
    /mergeBrokerAccount\(/,
    "the page must merge a connected account with mergeBrokerAccount",
  ],
  [
    /const connectUrl = ctraderConnectUrl\(\);/,
    "the page must ask the shared transport for the OAuth URL instead of assembling one",
  ],
  [
    /if \(!connectUrl\) \{/,
    "an unconfigured backend must stop the navigation instead of sending the browser to loopback",
  ],
  [
    /window\.location\.href\s*=\s*connectUrl;/,
    "the page must start cTrader OAuth by navigating to the URL ctraderConnectUrl() returned",
  ],
  [
    /new CustomEvent\(\s*"mt5AccountUpdated"/,
    "the page must announce an MT5 account change with mt5AccountUpdated",
  ],
  [
    /new CustomEvent\(\s*"ctraderAccountUpdated"/,
    "the page must announce a cTrader account change with ctraderAccountUpdated",
  ],
]);

// ============================================================
// GATES
// ============================================================
//
// Every scenario runs these before anything is bundled, so a legacy page fails
// as an assertion instead of as a missing-export build crash.

function assertPageFileExists() {
  assert.equal(
    existsSync(`${repoRoot}/${PAGE_FILE}`),
    true,
    `the broker integration page must exist on disk at ${PAGE_FILE}`,
  );
}

function readPage() {
  assertPageFileExists();

  return readFileSync(`${repoRoot}/${PAGE_FILE}`, "utf8");
}

function pageSourceProblems(source) {
  const problems = [];

  for (const [pattern, message] of FORBIDDEN_PAGE_SOURCE) {
    if (pattern.test(source)) {
      problems.push(`${message} (${pattern.source})`);
    }
  }

  problems.push(...missingContracts(REQUIRED_PAGE_SOURCE, source));

  return problems;
}

function missingContracts(contracts, source) {
  return contracts
    .filter(([pattern]) => !pattern.test(source))
    .map(([pattern, message]) => `${message} (${pattern.source})`);
}

function assertPageSourceContract() {
  assert.deepEqual(
    pageSourceProblems(readPage()),
    [],
    "the page must use the Phase 3 orchestration contracts",
  );
}

function assertSessionRequestGuardedTwice() {
  const source = readPage();

  // Two guards, per the plan: one for the status read and one for the
  // multi-request session cycle. One shared guard would let a status refresh
  // cancel an in-flight validation cycle.
  const guards = (source.match(/createRequestGuard\(\)/g) ?? []).length;

  assert.equal(
    guards,
    2,
    `the page must keep a status guard and a session guard, got ${guards} createRequestGuard() calls`,
  );
}

// ============================================================
// FIXTURES - PRODUCER KEYS ONLY
// ============================================================
//
// Shapes copied from server/brokers/registry.js and the two adapter blocks, and
// from the MT5 bridge serializers for a position and a pending order, the same
// fixtures the accepted Task 7 suite uses.

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
      accessToken: SECRET,
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
    execution: {
      provider: "mt5-local-bridge",
      transport: "http",
      requiresLocalService: true,
      browserCompatible: false,
    },
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

  const items =
    accountSource === "none" ? [] : accountSource === "live" ? liveItems : cachedItems;
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
        ? "authenticated and ready cTrader service session"
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

// A broker whose adapter threw while it was being probed. Keys copied from
// failedSnapshot() in server/brokers/registry.js:24-64: the registry never
// rejects, so this is the only shape a failed probe can take, and it is the
// only way either adapter can honestly report "error".
function failedBlock(brokerKey) {
  return {
    id: brokerKey,
    displayName: brokerKey,
    connection: {
      state: "error",
      connected: false,
      serviceReachable: false,
      observedAt: OBSERVED_AT,
      sourceTimestamp: null,
      reason: "Broker adapter failed without an error message.",
    },
    session: {
      scope: "unknown",
      accountScoped: false,
      identity: null,
      limitations: [
        "This broker's adapter threw while being probed, so no statement about its connection state is available.",
      ],
    },
    account: null,
    accounts: {
      broker: brokerKey,
      enumerable: false,
      source: "none",
      isLive: false,
      items: [],
      activeAccountId: null,
      activeAccount: null,
      note: "The account list could not be read because the adapter failed.",
    },
    execution: null,
    capabilities: {},
    lifecycle: {},
    errors: [
      {
        code: "adapter_failed",
        message: "Broker adapter failed without an error message.",
      },
    ],
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

// Both brokers connected, each with its own live identity.
function healthyAggregate(overrides = {}) {
  return statusOf({
    mt5: overrides.mt5 ?? (overrides.mt5 === null ? undefined : mt5Block()),
    ctrader: overrides.ctrader ?? ctraderBlock(),
  });
}

function mt5Position({ ticket = 4400001, login = MT5_LOGIN, profit = 20 } = {}) {
  return {
    login,
    mt5Login: login,
    server: MT5_SERVER,
    mt5Server: MT5_SERVER,
    ticket,
    positionId: ticket,
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
    raw: { accessToken: SECRET },
  };
}

function mt5PendingOrder({ ticket = 5500002 } = {}) {
  return {
    ticket,
    symbol: "GBPUSD",
    type: "BUY_LIMIT",
    volume: 0.2,
    price: 1.27,
    sl: 1.26,
    tp: 1.29,
    comment: "edgeflo",
    magic: 234567,
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

// GET /api/mt5/positions echoes the login and server it actually queried.
function mt5PositionsResponse({
  login = MT5_LOGIN,
  server = MT5_SERVER,
  positions = [mt5Position({ login })],
  success = true,
} = {}) {
  if (!success) {
    return {
      success: false,
      connected: false,
      count: 0,
      positions: [],
      message: "Unable to fetch MT5 positions.",
    };
  }

  return {
    success: true,
    connected: true,
    login,
    mt5Login: login,
    server,
    mt5Server: server,
    count: positions.length,
    positions,
  };
}

function mt5OrdersResponse({ orders = [], success = true } = {}) {
  if (!success) {
    return { success: false, count: 0, orders: null, message: "MT5 orders unavailable." };
  }

  return {
    success: true,
    count: orders.length,
    orders,
    pendingOrders: orders,
  };
}

function ctraderServiceResponse({
  tradingAccountId = CT_TRADING_ACCOUNT_ID,
  account = ctraderAccountBlock(),
  positions = [ctraderPosition()],
} = {}) {
  return {
    success: true,
    connected: true,
    hasAccessToken: true,
    accessToken: SECRET,
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId,
      account: { ...account, accessToken: SECRET },
      symbol: "EURUSD",
      positionsCount: Array.isArray(positions) ? positions.length : 0,
      openPositions: positions,
    },
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

function storedManualAccount(overrides = {}) {
  return {
    id: "manual-1",
    accountName: "Manual account",
    broker: "Manual",
    currency: "USD",
    balance: 999.99,
    ...overrides,
  };
}

function storedTradingAccounts(accounts) {
  return JSON.stringify(accounts);
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

// A superset of the icons the page and the three components may import. An icon
// outside this list fails the build with "No matching export", which is the
// signal to widen the stub deliberately rather than silently.
const LUCIDE_NAMES = [
  "AlertCircle",
  "AlertTriangle",
  "ArrowLeft",
  "ArrowRight",
  "Check",
  "CheckCircle2",
  "ChevronRight",
  "CircleAlert",
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
  "Search",
  "Server",
  "ShieldCheck",
  "TriangleAlert",
  "UserPlus",
  "UserRound",
  "X",
];

// The page may only call transport through brokerApi, so the fake exposes every
// export of the real module. A call the scenario did not configure throws with
// the operation name, which is a clearer failure than a silent undefined.
const API_NAMES = [
  "getBrokerStatus",
  "getMt5Positions",
  "getMt5Orders",
  "disconnectMt5",
  "getCtraderStatus",
  "selectCtraderAccount",
  "addCtraderAccount",
  "startCtraderService",
  "disconnectCtrader",
  "ctraderConnectUrl",
];

// The OAuth URL is a string the page assigns to location.href in one step, so
// the fake has to hand it back synchronously like the real export does. Awaits
// belong to the request functions, not to a URL builder.
const SYNC_API_NAMES = Object.freeze(["ctraderConnectUrl"]);

// The real transport owns this sentence and exports it as a value, so the stub
// has to carry it too or the page bundle cannot link. Pinned as a literal
// because the scenario below asserts this exact text reaches the user.
const BACKEND_URL_NOT_CONFIGURED_MESSAGE =
  "The broker backend URL is not configured in this build, so EdgeFinder cannot reach the trading service. Set VITE_API_URL when building for a deployed site.";

function brokerApiStub() {
  return `${REACT_IMPORT}
export const BACKEND_URL_NOT_CONFIGURED_MESSAGE = ${JSON.stringify(
    BACKEND_URL_NOT_CONFIGURED_MESSAGE,
  )};
${API_NAMES.map(
  (name) => `export const ${name} = (...args) => {
  const fake = globalThis.__pageBrokerApi;

  if (!fake || typeof fake.${name} !== "function") {
    throw new Error("the page called ${name}, which this scenario did not configure");
  }

  return fake.${name}(...args);
};`,
).join("\n")}`;
}

// A frozen journal context the page reads instead of the real provider. The
// setter is recorded, so "the page wrote the global selection" is evidence.
function journalStub() {
  return `export const useJournal = () => {
  const fake = globalThis.__pageJournal;

  if (!fake) {
    throw new Error("the page read the journal selection without a fake context");
  }

  return fake;
};`;
}

const STUBS = Object.freeze({
  lucide: iconStub(LUCIDE_NAMES),
  brokerApi: brokerApiStub(),
  journal: journalStub(),
});

const SUBSTITUTIONS = Object.freeze([
  [/^lucide-react$/, "lucide"],
  [/services\/brokerApi(\.js)?$/, "brokerApi"],
  [/context\/JournalContext(\.jsx)?$/, "journal"],
]);

function stubPlugin(substitutions) {
  return {
    name: "edgeflo-page-stubs",
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
// IN-MEMORY MUTANTS
// ============================================================
//
// Each one is a plausible wrong page, applied only to the text esbuild reads.
// mutationPlugin asserts the anchor matched exactly once, so a stale anchor
// fails loudly instead of reporting a phantom detection. Every guard and reset
// line in the page carries a trailing comment precisely so that one of them can
// be removed without disturbing its siblings.

const MUTATIONS = Object.freeze({
  // The cTrader session cycle commits whatever it awaited, even after a switch.
  staleSessionCommitted: {
    file: PAGE_FILE,
    from: "      if (!sessionGuard.isCurrent(ctraderToken)) return; // commit service round",
    to: "      // commit service round",
  },
  // Switching selection leaves the previous account's data on screen.
  staleDataNotCleared: {
    file: PAGE_FILE,
    from: "    setSession(createEmptySession()); // clear on switch",
    to: "    // clear on switch",
  },
  // Opening the page rewrites the global account selection.
  mountSelectsGlobally: {
    file: PAGE_FILE,
    from: "      startSession(initialSelection.brokerKey, initialSelection.accountId);",
    to: "      startSession(initialSelection.brokerKey, initialSelection.accountId);\n      setSelectedAccountId(initialSelection.accountId);",
  },
  // A late status response overwrites a newer one.
  staleStatusCommitted: {
    file: PAGE_FILE,
    from: "      if (!statusGuard.isCurrent(token)) return; // commit status",
    to: "      // commit status",
  },
  // Task 9. The disconnect request leaves as soon as the button is pressed.
  confirmlessDisconnect: {
    file: PAGE_FILE,
    from: "      setPendingDisconnect(true); // confirm first",
    to: "      void runCtraderDisconnect(); // confirm first",
  },
  // Task 9. Authorize also fires a workflow request of its own. The anchor is at
  // four spaces because the wizard and the card share one hand-off function, and
  // that function sits at component level rather than inside a branch.
  authorizeAlsoRequests: {
    file: PAGE_FILE,
    from: "    window.location.href = connectUrl; // authorize",
    to:
      "    window.location.href = connectUrl; // authorize\n    void startCtraderService();",
  },
  // The backend URL guard is disabled, so a build with no configured backend
  // follows a null straight into location.href. One line, because the page is
  // stored with CRLF and a multi-line anchor never matches it.
  connectGuardRemoved: {
    file: PAGE_FILE,
    from: "    if (!connectUrl) {",
    to: "    if (false) {",
  },
  // Task 9. The status commit replaces the answer with a claim of its own, which
  // is what an OAuth return must never do. The literals are inline because the
  // mutant is text the page bundle reads, and the page has no test constants.
  oauthReturnClaimsConnected: {
    file: PAGE_FILE,
    from: "      setStatusPayload(payload); // commit payload",
    to: `      setStatusPayload({ // commit payload
        success: true,
        brokers: {
          mt5: {
            connection: { state: "connected", serviceReachable: true },
            identity: { broker: "mt5", externalId: "1001" },
          },
          ctrader: {
            connection: { state: "connected", serviceReachable: true },
            identity: { broker: "ctrader", externalId: "395823" },
          },
        },
      });`,
  },
  // Task 6. The save workflow runs the activation commit it used to share with
  // the switch: the saved record is presented as the active account and a
  // session is read for it. That is the bug the split closes, so the mutant
  // grafts the two fields the save response stopped sending.
  saveActivatesAccount: {
    file: PAGE_FILE,
    from: "    applySavedCtraderAccount(result.data);",
    to: "    applyCtraderAccount({\n      ...result.data,\n      activeAccount: result.data?.account,\n      activeAccountId: result.data?.account?.accountId,\n    }, null, result.data?.account?.accountId);",
  },
  // Task 6. The confirmation check on a switch answer is removed, so any HTTP
  // success becomes an activation - which is exactly the save-shaped answer the
  // backend stopped sending.
  switchUnconfirmedSelectsAnyway: {
    file: PAGE_FILE,
    from: "    if (!switchWasConfirmed(payload, requestedExternalId)) {",
    to: "    if (false) {",
  },
  // Task 8. The switch clears the return instruction as soon as it is attempted,
  // before the answer says whether the account moved. One line grafted onto the
  // head of the handler, because the page is stored with CRLF and a multi-line
  // anchor never matches it.
  noticeClearedBeforeConfirmation: {
    file: PAGE_FILE,
    from: "  function applyCtraderAccount(payload, accountId, requestedExternalId) {",
    to: "  function applyCtraderAccount(payload, accountId, requestedExternalId) { setNotice(null);",
  },
});

function mutationPlugin(mutation) {
  return {
    name: "edgeflo-page-mutation",
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

        const matches = before.split(mutation.from).length - 1;

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

const ENTRY =
  'export { default as BrokerIntegrationPage } from "./components/settings/BrokerIntegrationPage.jsx";';

async function buildPageBundle({ mutation = null, substitutions = SUBSTITUTIONS } = {}) {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "brokerIntegrationPageRuntimeEntry.js",
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
      `a page bundle may only require shared React modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(guardedRequire, loaded, loaded.exports);

  return loaded.exports;
}

// ============================================================
// FAKE TRANSPORT AND STORAGE
// ============================================================

function createDeferred() {
  let resolve = null;
  let reject = null;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

// One fake per scenario: it records every call, and each export is a queue of
// behaviours. An entry may be a value (resolved immediately), a deferred
// promise, a function of the call arguments, or an Error to reject with.
function createFakeApi(handlers = {}) {
  const calls = [];

  const missing = (name) => {
    throw new Error(
      `the page called ${name}, which this scenario did not configure (calls: ${calls
        .map((call) => call.name)
        .join(", ") || "none"})`,
    );
  };

  const make = (name) => (...args) => {
    calls.push({ name, args });

    const handler = handlers[name];

    if (handler === undefined) {
      return missing(name);
    }

    const queue = Array.isArray(handler) ? handler : [handler];
    const index = Math.min(
      calls.filter((call) => call.name === name).length - 1,
      queue.length - 1,
    );
    const entry = queue[index];

    if (entry instanceof Error) {
      return Promise.reject(entry);
    }

    if (typeof entry === "function") {
      if (SYNC_API_NAMES.includes(name)) {
        return entry(...args);
      }

      return Promise.resolve().then(() => entry(...args));
    }

    if (entry && typeof entry.then === "function") {
      return entry;
    }

    if (SYNC_API_NAMES.includes(name)) {
      return entry;
    }

    return Promise.resolve(entry);
  };

  return {
    calls,
    api: Object.fromEntries(API_NAMES.map((name) => [name, make(name)])),
  };
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

// jsdom will not perform a cross-document navigation and its Location.href is a
// non-configurable own accessor, so the only way to see what the page assigned
// is to hand the bundle a window whose location records writes and forwards
// reads. The URL the page navigates to is then an exact string, not an
// "a navigation happened" guess.
function createRecordingLocation(win, navigations) {
  const real = win.location;

  return new Proxy(real, {
    get(target, property) {
      if (property === "assign" || property === "replace") {
        return (value) => {
          navigations.push({ to: String(value), how: String(property) });
        };
      }

      const value = Reflect.get(target, property, target);

      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (property === "href") {
        navigations.push({ to: String(value), how: "href" });

        return true;
      }

      return Reflect.set(target, property, value);
    },
  });
}

function createWindowProxy(win, location, navigations) {
  return new Proxy(win, {
    get(target, property) {
      if (property === "location") {
        return location;
      }

      const value = Reflect.get(target, property, target);

      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (property === "location") {
        navigations.push({ to: String(value), how: "window" });

        return true;
      }

      return Reflect.set(target, property, value);
    },
  });
}

async function withPage(options, scenario) {
  const {
    api = {},
    journal = {},
    storage = {},
    mutation = null,
    substitutions = SUBSTITUTIONS,
    url = "http://localhost/settings",
    expectTripwire = null,
    navigation = false,
    fetchHandler = null,
    manualTimers = false,
  } = options ?? {};

  // The gates run before anything is bundled, so a legacy page fails as an
  // assertion rather than as a missing-export crash in the modal graph.
  assertPageSourceContract();

  const { api: fakeApi, calls } = createFakeApi(api);
  const fakeStorage = createFakeStorage(storage);

  const globalSelection = [];
  const navigations = [];
  const requests = [];
  const timers = [];
  const events = {};
  const journalFake = {
    selectedAccountId: journal.selectedAccountId ?? null,
    setSelectedAccountId: (accountId) => {
      globalSelection.push(accountId);

      if (journal.onSelect) {
        journal.onSelect(accountId);
      }
    },
  };

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  const win = dom.window;

  const touched = [];
  const restoreSteps = [];
  const logged = { log: [], error: [], warn: [] };

  let root = null;
  let scenarioFailure = null;
  let teardownFailure = null;

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

          throw new Error(`the page reached ${label}.${name} instead of brokerApi`);
        },
      });
    }
  }

  const ctx = {
    React: null,
    Page: null,
    inputs: null,
    container: null,
    window: win,
    calls,
    touched,
    globalSelection,
    navigations,
    requests,
    timers,
    events,
    storageWrites: fakeStorage.writes,
    stored(key) {
      return fakeStorage.data.has(key) ? fakeStorage.data.get(key) : null;
    },
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
    cardButton(brokerKey) {
      const button = ctx.find(`[data-broker-card="${brokerKey}"] > button`);

      assert.ok(button, `a ${brokerKey} card must render as a button`);

      return button;
    },
    metric(key) {
      const node = ctx.find(`[data-metric="${key}"]`);

      assert.ok(node, `the session panel must render the ${key} metric`);

      return node.textContent;
    },
    names() {
      return ctx.calls.map((call) => call.name);
    },
    argsFor(name) {
      return ctx.calls.filter((call) => call.name === name).map((call) => call.args);
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    // One macrotask boundary drains every microtask chain the page started, so a
    // mount, a click or a gate release lands inside a single act scope instead of
    // resolving between two scopes and warning about an unwrapped update. The
    // page arms no timer of its own, so this waits for nothing but the queue.
    drain() {
      return new Promise((resolve) => {
        NATIVE_SET_TIMEOUT(resolve, 0);
      });
    },
    async settle() {
      await ctx.act(async () => {
        await ctx.drain();
        await ctx.drain();
      });
    },
    // Resolving outside act leaves the React update unwrapped, so every gate is
    // opened from inside act and the queue is then drained.
    async release(deferred, value) {
      await ctx.act(async () => {
        deferred.resolve(value);

        await ctx.drain();
        await ctx.drain();
      });
    },
    async reject(deferred, error) {
      await ctx.act(async () => {
        deferred.reject(error);

        await ctx.drain();
        await ctx.drain();
      });
    },
    async click(node) {
      await ctx.act(async () => {
        node.click();

        await ctx.drain();
        await ctx.drain();
      });
    },
    async clickCard(brokerKey) {
      await ctx.click(ctx.cardButton(brokerKey));
    },
    async clickRow(rowKey) {
      await ctx.click(ctx.find(`button[data-row-key="${rowKey}"]`));
    },
    async clickRefresh() {
      await ctx.click(ctx.find('[data-action="refresh"]'));
    },
    async clickAction(action) {
      const node = ctx.find(`[data-action="${action}"]`);

      assert.ok(node, `the page must render a ${action} control`);

      await ctx.click(node);
    },
    async setValue(selector, value) {
      const input = ctx.find(selector);

      assert.ok(input, `an open form must render ${selector}`);

      await ctx.act(async () => {
        // React replaces `value` on a controlled field with its own accessor and
        // records what it hands out, so assigning through it leaves React
        // convinced nothing changed and onChange never fires. Writing through the
        // prototype accessor is what a real keystroke does to the DOM node.
        const descriptor = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(input),
          "value",
        );

        assert.ok(
          descriptor && typeof descriptor.set === "function",
          `${selector} must be a field with a value accessor`,
        );

        descriptor.set.call(input, value);

        input.dispatchEvent(new win.Event("input", { bubbles: true }));
      });
    },
    // A submit button is what a user presses. jsdom only performs the
    // navigation a form submission implies when the handler leaves it alone,
    // and both forms here call preventDefault first.
    async submitForm(selector = "form") {
      const form = ctx.find(selector);

      assert.ok(form, `the page must render a ${selector}`);

      const submit = form.querySelector('button[type="submit"]');

      assert.ok(submit, `${selector} must render a submit button`);

      await ctx.click(submit);
    },
    // A fake-timer scenario decides when an armed callback runs, so a 700ms
    // modal close is a step the scenario takes instead of a wall-clock wait.
    async flushTimers() {
      await ctx.act(async () => {
        const pending = timers.splice(0, timers.length);

        for (const timer of pending) {
          timer.callback();
        }

        await ctx.drain();
        await ctx.drain();
      });
    },
    detailsFor(name) {
      return events[name] ?? [];
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

    // The page must never reach a real IndexedDB; storage is the approved seam.
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
      value: fakeApi,
    });

    define(globalThis, "__pageJournal", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: journalFake,
    });

    if (manualTimers) {
      define(globalThis, "setTimeout", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (callback, ms) => {
          timers.push({ callback, ms: ms ?? 0 });

          return timers.length;
        },
      });
    }

    if (fetchHandler !== null) {
      const fetchFake = async (input, init = {}) => {
        const body = init.body === undefined ? undefined : String(init.body);

        requests.push({
          url: String(input),
          method: init.method ?? "GET",
          body,
        });

        const answer = await fetchHandler(String(input), body);

        return {
          ok: answer.ok ?? true,
          status: answer.status ?? 200,
          json: async () => answer.body,
        };
      };

      define(globalThis, "fetch", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: fetchFake,
      });

      define(win, "fetch", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: fetchFake,
      });
    }

    // The update events the page may announce after it changes an account
    // record; the contexts that own the journal data listen for these.
    for (const name of ["mt5AccountUpdated", "ctraderAccountUpdated"]) {
      events[name] = [];

      win.addEventListener(name, (event) => {
        events[name].push(event.detail);
      });
    }

    if (navigation) {
      const recording = createWindowProxy(
        win,
        createRecordingLocation(win, navigations),
        navigations,
      );

      for (const name of ["window", "self"]) {
        define(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: recording,
        });
      }
    }

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

    const built = await buildPageBundle({ mutation, substitutions });

    ctx.inputs = built.inputs;
    ctx.Page = evaluateBundle(built.code, shared).BrokerIntegrationPage;

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
      "the page must never render a token that travelled in a payload",
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

  if (expectTripwire === null) {
    assert.deepEqual(
      touched,
      [],
      "the page may reach the network only through the broker API module",
    );
  } else {
    // The one control scenario that probes the harness itself: the tripwires
    // have to record exactly the accesses the scenario made, which is what every
    // other scenario's empty list is measured against.
    assert.deepEqual(
      touched,
      expectTripwire,
      "the harness tripwires must record the control's own accesses and nothing else",
    );
  }

  assert.deepEqual(logged.error, [], "rendering must not log a React error");
}

// A failed assertion must not print a live DOM node: Node's inspect walks the
// React fibre back-references hanging off an element and exhausts the heap, so
// an absence check compares a count instead of a node.
function assertAbsent(ctx, selector, message) {
  assert.equal(ctx.findAll(selector).length, 0, message);
}

// A metric node's rendered text, or the whole-panel absence that "no broker is
// selected" produces.
function assertMetric(ctx, key, expected, note = "") {
  assert.equal(
    ctx.metric(key),
    expected,
    `${key} metric${note ? ` (${note})` : ""}`,
  );
}

function assertNoMetric(ctx, message) {
  assertAbsent(ctx, "[data-metric]", message);
}

// ============================================================
// 1. GATES
// ============================================================

test("the page exists and drops every legacy status-fetch habit", () => {
  assertPageFileExists();

  assert.deepEqual(
    pageSourceProblems(readPage()),
    [],
    "the page must orchestrate through brokerApi, the model and the inline components",
  );
});

test("the page reads and migrates stored accounts through the identity helpers", () => {
  assertPageFileExists();

  const source = readPage();

  for (const [pattern, message] of REQUIRED_PAGE_SOURCE) {
    assert.ok(pattern.test(source), `${message}; pattern ${pattern.source} not found`);
  }
});

test("the page keeps a separate guard for status reads and session reads", () => {
  assertPageFileExists();

  assertSessionRequestGuardedTwice();
});

// ============================================================
// 2. HARNESS INTEGRITY
// ============================================================

async function scenarioBundleGraph(ctx) {
  assert.deepEqual(
    ctx.inputs.filter((input) => input.includes("node_modules")),
    [],
    "the page bundle must not resolve an installed package into the graph",
  );

  assert.deepEqual(
    ctx.inputs.filter((input) => input.startsWith("src/")).sort(),
    APPROVED_INPUTS,
    "the page may bundle only the page, the workspace components, the wizard, the registry and the three pure modules",
  );

  // The substituted seams must really be substitutions. The MT5 modal is not on
  // this list: Task 9 opens the real one, because a new credential form is
  // exactly what the plan forbids.
  for (const forbidden of [
    "src/services/brokerApi.js",
    "src/context/JournalContext.jsx",
    "src/context/TradeContext.jsx",
    "src/context/MarketContext.jsx",
    "src/brokers/AddBrokerModal.jsx",
    "src/brokers/BrokerDetailsModal.jsx",
  ]) {
    assert.equal(
      ctx.inputs.includes(forbidden),
      false,
      `the page bundle must not contain ${forbidden}`,
    );
  }
}

test("the page bundle holds only the approved graph", async () => {
  await withPage({ api: { getBrokerStatus: healthyAggregate() } }, scenarioBundleGraph);
});

test("the graph check has teeth: unstubbing the icon package fails the allowlist", async () => {
  let failure = null;

  try {
    await withPage(
      {
        api: { getBrokerStatus: healthyAggregate() },
        substitutions: SUBSTITUTIONS.filter(([filter]) => filter.source !== "^lucide-react$"),
      },
      scenarioBundleGraph,
    );
  } catch (error) {
    failure = error;
  }

  assert.ok(failure, "an unstubbed icon import must not pass the bundle allowlist");

  assert.match(
    failure.message,
    /must not resolve an installed package into the graph/,
    `the control must be rejected by the graph assertion itself, got: ${failure.message.slice(0, 400)}`,
  );
});

test("the transport tripwire really records and rejects a direct fetch", async () => {
  // The teeth of every "no transport touched" assertion above. A page that
  // called fetch itself would be caught by this same mechanism, so this
  // scenario calls fetch from the test and requires the tripwire to name it.
  await withPage(
    {
      api: { getBrokerStatus: healthyAggregate() },
      expectTripwire: ["globalThis.fetch", "window.fetch"],
    },
    async (ctx) => {
      let caught = null;

      try {
        globalThis.fetch("http://127.0.0.1:4000/api/brokers/status");
      } catch (error) {
        caught = error;
      }

      assert.ok(
        caught instanceof Error && /instead of brokerApi/.test(caught.message),
        "the tripwire must throw, not silently swallow a direct transport call",
      );

      let caughtWindow = null;

      try {
        ctx.window.fetch("http://127.0.0.1:4000/api/brokers/status");
      } catch (error) {
        caughtWindow = error;
      }

      assert.ok(
        caughtWindow instanceof Error,
        "the jsdom window must be guarded as well as globalThis",
      );
    },
  );
});

// ============================================================
// 3. INITIAL STATUS AND BOTH CARDS
// ============================================================

function pendingStatus() {
  const gate = createDeferred();

  return { gate, handlers: { getBrokerStatus: gate.promise } };
}

async function scenarioLoadingThenStatus(ctx) {
  assertConnectionState(ctx, "loading", "Loading", "while the first read is pending");

  assertAbsent(
    ctx,
    "[data-broker-card]",
    "a status that is still being read is not a connection, so no card may be offered yet",
  );

  assert.equal(
    ctx.names().filter((name) => name === "getBrokerStatus").length,
    1,
    "the page must read the aggregate once on mount, not one request per broker",
  );
}

test("the service line reads Loading while the first status read is pending", async () => {
  const { gate, handlers } = pendingStatus();

  await withPage({ api: handlers }, async (ctx) => {
    await scenarioLoadingThenStatus(ctx);

    await ctx.release(gate, healthyAggregate());

    assertConnectionState(ctx, "connected", "Connected", "once the aggregate answers");

    assertAbsent(
      ctx,
      "[data-broker-card]",
      "the aggregate alone is not a validated session, so the card stays withheld",
    );
  });
});

async function scenarioDisconnectedServiceStaysHonest(ctx) {
  assertConnectionState(
    ctx,
    "disconnected",
    "Disconnected",
    "a service the aggregate says is down",
  );

  assert.equal(
    ctx.findAll("[data-broker-empty] [data-action]").length,
    1,
    "a disconnected service must lead the user to the one thing that can change it",
  );

  assert.equal(
    ctx.text().includes("Connect your first broker"),
    false,
    "the legacy empty state must not be the copy this page uses",
  );

  assert.equal(
    ctx.text().includes("USD 5,000"),
    false,
    "a stored balance must not be shown while the service is down",
  );
}

test("a disconnected service is stated, not hidden behind a card", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: statusOf({ mt5: mt5Block(), ctrader: ctraderBlock({ connected: false }) }),
      },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    scenarioDisconnectedServiceStaysHonest,
  );
});

async function scenarioConnecting(ctx) {
  assertConnectionState(ctx, "connecting", "Connecting");

  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "a socket still authenticating is not a connected broker",
  );
}

test("a connected but unauthenticated cTrader socket renders Connecting", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: statusOf({
          mt5: mt5Block(),
          ctrader: ctraderBlock({ connected: true, authenticated: false, ready: false }),
        }),
      },
    },
    scenarioConnecting,
  );
});

// The cTrader adapter derives its state only from the socket booleans
// (server/brokers/ctraderAdapter.js:24-34), so a service that answers with a
// dead socket honestly reports "disconnected", never "unreachable" - and never
// the other broker's word for a probe that got no answer at all.

async function scenarioUnreachable(ctx) {
  assertConnectionState(ctx, "disconnected", "Disconnected");

  assert.equal(
    ctx.findAll("[data-verified-identity]").length,
    0,
    "a socket that is down may not claim a verified account",
  );
}

test("a down socket reads Disconnected, not Unreachable", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: statusOf({
          ctrader: ctraderBlock({
            connected: false,
            authenticated: false,
            ready: false,
            accountSource: "none",
            requestedAccountId: null,
          }),
        }),
      },
    },
    scenarioUnreachable,
  );
});

test("an aggregate with no cTrader block reads Unreachable, not endless Loading", async () => {
  await withPage(
    { api: { getBrokerStatus: statusOf({ mt5: mt5Block() }) } },
    (ctx) => {
      assertConnectionState(ctx, "unreachable", "Unreachable");

      assertAbsent(
        ctx,
        "[data-broker-card]",
        "a service that never answered gets an honest word, not a card",
      );
    },
  );
});

async function scenarioErrorState(ctx) {
  assertConnectionState(ctx, "error", "Error");

  assert.equal(
    ctx.findAll("[data-verified-identity]").length,
    0,
    "an errored status must not show a verified account id",
  );
}

test("an adapter that failed while probing renders Error", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: statusOf({
          mt5: failedBlock("mt5"),
          ctrader: failedBlock("ctrader"),
        }),
      },
    },
    scenarioErrorState,
  );
});

test("a connected service that cannot name its account renders Error", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: statusOf({
          ctrader: ctraderBlock({ serviceAccountId: null, requestedAccountId: null }),
        }),
      },
    },
    (ctx) => {
      assertConnectionState(ctx, "error", "Error");

      assertAbsent(
        ctx,
        "[data-connected-broker]",
        "a session that cannot be attributed to an account is not a connected broker",
      );
    },
  );
});

async function scenarioStatusRequestFailed(ctx) {
  assertConnectionState(ctx, "error", "Error", "after the status request rejected");

  const alerts = ctx.findAll('[role="alert"]');

  assert.equal(alerts.length >= 1, true, "a failed status read must be announced");
  assertAbsent(ctx, "[data-metric]", "no live metric may render when status failed");
  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "a failed read may not name a connected broker",
  );
  assert.equal(
    ctx.text().includes("10,000"),
    false,
    "a stored or invented balance must not appear when the read failed",
  );
}

test("a failed status request errors the service line and announces it", async () => {
  await withPage(
    {
      api: { getBrokerStatus: new Error("Broker status failed with HTTP 500.") },
    },
    scenarioStatusRequestFailed,
  );
});

test("Refresh re-reads the aggregate and updates the service line", async () => {
  const first = createDeferred();
  const second = createDeferred();

  await withPage(
    {
      api: {
        getBrokerStatus: [first.promise, second.promise],
      },
    },
    async (ctx) => {
      await ctx.release(
        first,
        statusOf({ mt5: mt5Block(), ctrader: ctraderBlock({ connected: false }) }),
      );

      assertConnectionState(ctx, "disconnected", "Disconnected", "before the refresh");

      await ctx.clickRefresh();

      assert.equal(
        ctx.names().filter((name) => name === "getBrokerStatus").length,
        2,
        "the Refresh action must read the aggregate again",
      );

      assertConnectionState(
        ctx,
        "loading",
        "Loading",
        "a refresh must not present the previous answer as current",
      );

      await ctx.release(second, healthyAggregate());

      assertConnectionState(ctx, "connected", "Connected", "after the refresh lands");
    },
  );
});

async function scenarioLateStatusDiscarded(ctx, { stale, fresh }) {
  const refresh = ctx.find('[data-action="refresh"]');

  assert.ok(refresh, "the page must render a Refresh action");

  await ctx.click(refresh);

  assert.equal(
    ctx.names().filter((name) => name === "getBrokerStatus").length,
    2,
    "the second read must start before either answer lands",
  );

  // The newer read answers first.
  await ctx.release(fresh, healthyAggregate());

  assertConnectionState(ctx, "connected", "Connected", "from the newer read");

  // And only now does the older read arrive.
  await ctx.release(stale, olderDisconnectedStatus);

  assertConnectionState(
    ctx,
    "connected",
    "Connected",
    "an older read must not replace a newer answer",
  );

  assertAbsent(
    ctx,
    "[data-broker-card]",
    "and neither answer may open a card the page only earns from a validated session",
  );
}

// The stale half: the same service, read a moment earlier, saying it was down.
const olderDisconnectedStatus = statusOf({
  mt5: mt5Block(),
  ctrader: ctraderBlock({ connected: false }),
});

test("a late status response cannot overwrite a newer one", async () => {
  const stale = createDeferred();
  const fresh = createDeferred();

  await withPage(
    {
      api: {
        getBrokerStatus: [stale.promise, fresh.promise],
      },
    },
    (ctx) => scenarioLateStatusDiscarded(ctx, { stale, fresh }),
  );
});

// ============================================================
// 3b. APPROVED COPY BUDGET
// ============================================================
//
// These scenarios exist because the approved UI removed explanatory panels that
// carried no behaviour. Each one names what must still be on screen alongside
// what must be gone, so deleting a section can never be mistaken for deleting a
// control.

test("the page header carries the approved heading and short subtitle", async () => {
  await withPage({ api: { getBrokerStatus: healthyAggregate() } }, async (ctx) => {
    assert.equal(
      ctx.text().includes("Broker Integrations"),
      true,
      "the page still names itself",
    );

    assert.equal(
      ctx.text().includes("Connect and manage your trading accounts."),
      true,
      "the subtitle must be the approved one",
    );

    assert.equal(
      ctx.text().includes("Connect and manage your trading broker accounts."),
      false,
      "the superseded subtitle must be gone",
    );
  });
});

test("the page renders no security banner and no supported-brokers preamble", async () => {
  await withPage({ api: { getBrokerStatus: healthyAggregate() } }, async (ctx) => {
    for (const forbidden of [
      "Secure Broker Connection",
      "Broker integrations use secure connection methods",
      "Supported Brokers",
      "Both brokers stay listed whatever their connection state",
    ]) {
      assert.equal(
        ctx.text().includes(forbidden),
        false,
        `"${forbidden}" explained behaviour instead of offering it`,
      );
    }

    assert.equal(
      ctx.findAll("[data-broker-card]").length,
      0,
      "a page that offers one broker has no card grid to keep",
    );

    assert.equal(
      ctx.findAll('[data-action="refresh"]').length,
      1,
      "the refresh control survives the copy cleanup",
    );

    assert.equal(
      ctx.findAll('[data-action="connect-existing"]').length,
      1,
      "the wizard CTA survives the copy cleanup",
    );

    assertNoMt5Offered(
      ctx,
      "the removed preamble must not have been the only thing keeping MT5 off this page",
    );
  });
});

// ============================================================
// 4. SELECTION
// ============================================================

const CT_ROW = `ctrader:${CT_TRADING_ACCOUNT_ID}:ctrader-${CT_TRADING_ACCOUNT_ID}`;

// A storage state whose records already carry the fields the migrator writes, so
// opening the page has nothing to persist.
function migratedStorage(accounts) {
  return storedTradingAccounts(
    accounts.map((account) => {
      if (!account || typeof account !== "object") {
        return account;
      }

      const identity = makeAccountIdentity(account);

      return {
        ...account,
        brokerKey: identity.brokerKey,
        identityStatus: identity.identityStatus,
      };
    }),
  );
}

// The MT5 view of the aggregate: one live terminal, plus a cTrader service that
// is present but never selected by these scenarios.
function liveMt5Status({ login = MT5_LOGIN, balance = 10000.5, account = {} } = {}) {
  return statusOf({
    mt5: mt5Block({
      externalId: login,
      account: mt5AccountBlock({ login, balance, ...account }),
    }),
    ctrader: ctraderBlock({
      connected: false,
      authenticated: false,
      ready: false,
      accountSource: "none",
      requestedAccountId: null,
    }),
  });
}

function liveCtraderStatus() {
  return statusOf({
    mt5: mt5Block({
      state: "disconnected",
      externalId: null,
      server: null,
      account: null,
    }),
    ctrader: ctraderBlock(),
  });
}

function mt5PositionsFor(accountId) {
  const login = accountId === `mt5-${MT5_LOGIN_B}` ? MT5_LOGIN_B : MT5_LOGIN;

  return mt5PositionsResponse({
    login,
    positions: [
      mt5Position({
        login,
        ticket: login === MT5_LOGIN ? 4400001 : 4499999,
      }),
    ],
  });
}

const mt5LiveApi = {
  getMt5Positions: (accountId) => mt5PositionsFor(accountId),
  getMt5Orders: () => mt5OrdersResponse({ orders: [mt5PendingOrder()] }),
};

async function scenarioManualGlobalAccount(ctx) {
  assertAbsent(
    ctx,
    "[data-broker-card]",
    "a manual account names no broker this page offers, so no card may open",
  );

  assert.equal(
    ctx.findAll('[data-prompt="broker"]').length,
    0,
    "the page offers one broker and never asks which one",
  );

  assert.equal(
    ctx.findAll("[data-broker-empty] [data-action]").length,
    1,
    "so the page stays an entry point whatever the journal held",
  );

  assertNoMetric(ctx, "a manual account may not receive a live session panel");

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "with no broker account selected only the aggregate is read",
  );

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "opening the page must not rewrite the global selection",
  );
}

test("a manual global account selection opens no broker workspace", async () => {
  await withPage(
    {
      api: { getBrokerStatus: healthyAggregate() },
      journal: { selectedAccountId: "manual-1" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedManualAccount(), storedMt5Account()]),
      },
    },
    scenarioManualGlobalAccount,
  );
});

// The journal selection is the only way this page opens a workspace without the
// user touching it, so this scenario carries three jobs: the session it reads,
// the card it earns, and the fact that reading a selection never writes one.
async function scenarioCtraderGlobalAccount(ctx) {
  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "getBrokerStatus", "getCtraderStatus"],
    "a cTrader session reads the aggregate and the cTrader service, never the MT5 routes",
  );

  assertMetric(ctx, "balance", "USD 5,000", "the live service account's balance");

  assert.equal(
    ctx.cardButton("ctrader").getAttribute("aria-pressed"),
    "true",
    "the cTrader card must show the selected state",
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "true",
    "the journal's account row must show the selected state",
  );

  assertConnectedSummary(ctx, { brokerName: "cTrader" });

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "reading a selection is not the same as writing one",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and opening a page over a stored account stores nothing",
  );
}

test("a cTrader global account never opens the MT5 session", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount(), storedMt5Account()]),
      },
    },
    scenarioCtraderGlobalAccount,
  );
});

// The card is the only broker control on this page, so clicking it cannot swap
// brokers - what it does is drop back to "which account?", taking the session and
// the connected summary with it.
async function scenarioCardClickClearsTheAccount(ctx) {
  assertMetric(ctx, "balance", "USD 5,000", "before the click");

  const before = ctx.names().length;

  await ctx.clickCard("ctrader");

  assert.equal(
    ctx.cardButton("ctrader").getAttribute("aria-pressed"),
    "true",
    "the clicked card stays the selected broker",
  );

  assert.ok(
    ctx.find('[data-prompt="account"]'),
    "clicking the card must ask for an account rather than keep the old one",
  );

  assertNoMetric(ctx, "an account the user just unselected may not keep its panel");

  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "and no summary may keep naming a broker whose session was dropped",
  );

  assert.equal(
    ctx.text().includes("USD 5,000"),
    false,
    "the previous account's numbers must not survive the click",
  );

  assert.equal(
    ctx.names().length,
    before,
    "unselecting an account is a local change and asks the backend for nothing",
  );
}

test("clicking the broker card clears the account and reads nothing", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]),
      },
    },
    scenarioCardClickClearsTheAccount,
  );
});

async function scenarioRowClickSelectsGloballyOnce(ctx) {
  assert.deepEqual(
    ctx.globalSelection,
    [],
    "opening the page with no journal selection writes nothing",
  );

  assert.ok(
    ctx.find('[data-prompt="account"]'),
    "a broker with no account asks for one",
  );

  await ctx.clickRow(CT_ROW);

  assert.deepEqual(
    ctx.globalSelection,
    ["ctrader-395823"],
    "an explicit row click must select that account",
  );

  const after = ctx.names().length;

  await ctx.clickRow(CT_ROW);

  assert.deepEqual(
    ctx.globalSelection,
    ["ctrader-395823"],
    "re-selecting the same row must not repeat the write",
  );

  assert.equal(
    ctx.names().length,
    after,
    "nor restart the service switch or the session read",
  );
}

test("an explicit row click updates the global selection exactly once", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        selectCtraderAccount: ctraderSelectAnswer(),
      },
      url: WORKSPACE_URL,
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord(), storedManualAccount()]),
      },
    },
    scenarioRowClickSelectsGloballyOnce,
  );
});

// The property this scenario used to prove by clicking the same account number
// under both cards — one external id never becomes one row — is a model property,
// not a page one, and it is already covered where it is decided:
// brokerIntegrationModel.test.js's "the same external id under both brokers stays
// two rows" and "the same external id under another broker is never merged".
// With the MT5 card off this page there is no second click to make, and a test
// that mounted MT5 state the user cannot reach would prove nothing about the page.

// ============================================================
// 5. SESSION CYCLE GUARDS
// ============================================================
//
// What a session cycle must never do, tested through the one broker this page
// opens a workspace for. The MT5 round-trip scenarios that used to live here are
// retired with the MT5 surface: `getMt5Positions`, `getMt5Orders` and the
// terminal modal are still wired (the source gate says so) but no click on this
// page reaches them, so a page test would have to drive state no user can create.
// The MT5 validators keep their coverage in brokerIntegrationModel.test.js and the
// modal keeps its own component suite.

// A zero the broker reported is a number, not an absence. This is the shape a
// blown account has, and "Unavailable" would let the user keep trading on a
// balance they cannot see.
async function scenarioRealZeroes(ctx) {
  assertMetric(ctx, "balance", "USD 0", "a real zero stays zero");
  assertMetric(ctx, "equity", "USD 0");
  assertMetric(ctx, "marginUsed", "USD 0");
  assertMetric(ctx, "freeMargin", "USD 0");
  assertMetric(ctx, "leverage", "0x");

  assert.equal(
    ctx.find("[data-positions]").getAttribute("data-positions"),
    "empty",
    "a confirmed empty book is not Unavailable",
  );

  assert.equal(
    ctx.text().includes("No open positions"),
    true,
    "an empty book must say so",
  );

  assert.equal(
    ctx.find("[data-pending-orders]").getAttribute("data-pending-orders"),
    "unavailable",
    "an unconfirmed list stays unavailable even beside real zeroes",
  );
}

test("a genuine zero balance stays zero and an empty book says so", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse({
          account: ctraderAccountBlock({
            balance: 0,
            equity: 0,
            margin: 0,
            freeMargin: 0,
            leverage: 0,
          }),
          positions: [],
        }),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    scenarioRealZeroes,
  );
});

async function scenarioSessionRequestFailed(ctx) {
  assert.equal(
    ctx.find("[data-session-error]").textContent,
    "cTrader service status failed with HTTP 500.",
    "the sanitized transport message is the page's only error copy",
  );

  assert.equal(
    ctx.find("[data-session-error]").getAttribute("role"),
    "alert",
    "a failed session read must be announced to assistive technology",
  );

  assertMetric(ctx, "balance", UNAVAILABLE, "a failed read has no metrics");

  assert.equal(
    ctx.find("[data-positions]").getAttribute("data-positions"),
    "unavailable",
    "a failed read has no positions",
  );

  assert.equal(
    ctx.text().includes("1,111.11"),
    false,
    "a failed read must not fall back to the stored balance",
  );

  assertConnectionState(
    ctx,
    "connected",
    "Connected",
    "a session failure is not a status failure",
  );

  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "and a failed read cannot name a connected broker",
  );
}

test("a failed cTrader session read reports the transport error and clears the session", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: new Error("cTrader service status failed with HTTP 500."),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    scenarioSessionRequestFailed,
  );
});


// A cycle the user has moved on from must not land afterwards, whichever of its
// two halves arrives late. Refreshing starts a second cycle over the same account
// and invalidates the first, so the first answer is provably the discarded one:
// it carries a balance no other response in this scenario contains.
async function scenarioLateCtraderRoundCannotLand(ctx, { gate }) {
  assertNoMetric(ctx, "a workspace with no account chosen has read nothing");

  await ctx.clickRow(CT_ROW);

  await ctx.clickRefresh();

  assertMetric(ctx, "balance", "USD 5,000", "the second round's own answer");

  // The first cycle was still awaiting the service when the second one started.
  await ctx.release(
    gate,
    ctraderServiceResponse({
      account: ctraderAccountBlock({ balance: 1234.56 }),
      positions: [ctraderPosition({ positionId: 8899 })],
    }),
  );

  assert.equal(
    ctx.text().includes("1,234.56"),
    false,
    "a discarded round must not put its balance on screen",
  );

  assert.equal(
    ctx.metric("balance"),
    "USD 5,000",
    "the round that was replaced must survive as replaced",
  );

  assert.equal(
    ctx.text().includes("8899"),
    false,
    "a discarded round must not put its positions on screen",
  );

  assert.equal(
    ctx.text().includes("7001"),
    true,
    "and the round that did land keeps its own position",
  );
}

function lateRoundHarness() {
  const gate = createDeferred();

  return {
    gate,
    options: {
      api: {
        getBrokerStatus: () => liveCtraderStatus(),
        getCtraderStatus: [gate.promise, ctraderServiceResponse()],
        selectCtraderAccount: ctraderSelectAnswer(),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
  };
}

test("a late cTrader round cannot overwrite the session of the round now current", () =>
  assertMutationDetected({
    name: "staleSessionCommitted",
    build: lateRoundHarness,
    scenario: scenarioLateCtraderRoundCannotLand,
    reject: /a discarded round must not put its balance on screen/,
  }));

// ============================================================
// 6. cTRADER SESSION CYCLE
// ============================================================

async function scenarioValidatedCtraderSession(ctx) {
  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "getBrokerStatus", "getCtraderStatus"],
    "a cTrader session reads the aggregate once and then the service status",
  );

  assert.equal(
    ctx.findAll("[data-validation-error]").length,
    0,
    "an attributed cTrader round must not show a validation error",
  );

  assertMetric(ctx, "balance", "USD 5,000", "the live service account's balance");
  assertMetric(ctx, "equity", "USD 5,010.50");
  assertMetric(ctx, "marginUsed", "USD 100");
  assertMetric(ctx, "freeMargin", "USD 4,910.50");
  assertMetric(ctx, "currency", "USD");
  assertMetric(ctx, "leverage", "100x");

  assert.equal(
    ctx.find("[data-positions]").getAttribute("data-positions"),
    "table",
    "the service's own open positions render as a table",
  );

  assert.equal(
    ctx.text().includes("7001"),
    true,
    "the confirmed position id must be readable",
  );

  assert.equal(
    ctx.find("[data-pending-orders]").getAttribute("data-pending-orders"),
    "unavailable",
    "cTrader pending orders are never presented as an empty list",
  );

  assert.equal(
    ctx.find("[data-pending-orders]").textContent.includes("Unavailable"),
    true,
    "an unconfirmed pending-order list must read as unavailable",
  );

  assert.equal(
    ctx.text().includes("Pending-order listing is unavailable for cTrader."),
    false,
    "the panel must not print the backend limitation sentence",
  );

  assert.equal(
    ctx.findAll("[data-pending-reason]").length,
    0,
    "the approved panel renders no unavailability reason",
  );

  assert.equal(
    ctx.text().includes("1,111.11"),
    false,
    "the stored cTrader balance must not appear next to live numbers",
  );
}

test("a validated cTrader round renders service data and keeps pending orders unavailable", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    scenarioValidatedCtraderSession,
  );
});

async function scenarioCachedCtraderAccount(ctx) {
  assert.equal(
    ctx.find("[data-validation-error]").textContent,
    "The active cTrader account came from the local cache rather than the live account list, so its data cannot be presented.",
    "cached OAuth must be refused as a live identity",
  );

  assertMetric(ctx, "balance", UNAVAILABLE, "a cached account has no live balance");

  assert.equal(
    ctx.find("[data-positions]").getAttribute("data-positions"),
    "unavailable",
    "a cached account has no live positions",
  );

  assert.equal(
    ctx.text().includes("1,111.11"),
    false,
    "the stored cTrader balance must not be presented as live",
  );
}

test("a locally cached cTrader account is never presented as authenticated live data", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: statusOf({
          mt5: mt5Block({ state: "disconnected", externalId: null, server: null, account: null }),
          ctrader: ctraderBlock({ accountSource: "cache" }),
        }),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    scenarioCachedCtraderAccount,
  );
});

async function scenarioCtraderServiceMismatch(ctx) {
  assert.equal(
    ctx.find("[data-validation-error]").textContent,
    "The cTrader service is authenticated against a different account than the live session identity, so its data cannot be attributed.",
    "a service on another account must drop the whole round",
  );

  assertMetric(ctx, "balance", UNAVAILABLE, "a dropped round has no metrics");

  assertAbsent(ctx, "[data-positions-table]", "a dropped round must not render positions");

  assert.equal(
    ctx.find("[data-pending-orders]").getAttribute("data-pending-orders"),
    "unavailable",
    "a dropped round must not invent a pending-order list",
  );
}

test("a cTrader service authenticated against another account drops the round", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse({ tradingAccountId: "999999" }),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    scenarioCtraderServiceMismatch,
  );
});

// The mirror of the probe above, on the way in: while the only cTrader read is
// still outstanding the page has earned no claim about the session, so it shows
// none. The workspace itself is not a claim — the account is already selected,
// so the header and its controls stay, and only the summary waits.
async function scenarioPendingRoundClaimsNothing(ctx, { gate }) {
  assertMetric(ctx, "balance", UNAVAILABLE, "nothing has been confirmed yet");

  assert.ok(
    ctx.cardButton("ctrader"),
    "the selected account keeps its workspace header while the read is outstanding",
  );

  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "a round that has not landed cannot earn a connected summary",
  );

  assertConnectionState(
    ctx,
    "connected",
    "Connected",
    "the aggregate's own word, which is about the service and not the session",
  );

  assertOneEntryPoint(ctx, "the page still offers the way to connect another account");

  await ctx.release(gate, ctraderServiceResponse());

  assertMetric(ctx, "balance", "USD 5,000", "the round the user was waiting for");

  assertConnectedSummary(ctx, { brokerName: "cTrader" });
}

test("a cTrader round claims nothing until it lands", async () => {
  const gate = createDeferred();

  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: gate.promise,
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    (ctx) => scenarioPendingRoundClaimsNothing(ctx, { gate }),
  );
});

// ============================================================
// 7. STORAGE
// ============================================================

async function scenarioOpeningWritesNothing(ctx) {
  assert.deepEqual(
    ctx.storageWrites,
    [],
    "opening the page must not rewrite stored accounts or any other key",
  );

  assert.equal(
    ctx.stored(ACCOUNTS_KEY),
    migratedStorage([storedMt5Account(), storedCtraderAccount(), storedManualAccount()]),
    "the stored array must stay byte-for-byte what the page read",
  );
}

test("opening the page over already-migrated accounts writes nothing", async () => {
  const accounts = [storedMt5Account(), storedCtraderAccount(), storedManualAccount()];

  await withPage(
    {
      api: { getBrokerStatus: healthyAggregate() },
      storage: { [ACCOUNTS_KEY]: migratedStorage(accounts) },
    },
    scenarioOpeningWritesNothing,
  );
});

async function scenarioMigrationWritesOnce(ctx) {
  const writes = ctx.storageWrites.filter((write) => write.key === ACCOUNTS_KEY);

  assert.equal(
    writes.length,
    1,
    "a migration the page performs must be persisted exactly once",
  );

  assert.deepEqual(
    ctx.storageWrites,
    writes,
    "the account array is the only key the page may write",
  );

  assert.equal(writes[0].type, "set", "the migration is a set, never a remove");

  const persisted = JSON.parse(writes[0].value);

  assert.deepEqual(
    persisted,
    [
      {
        id: "mt5-1001",
        accountName: "Typed as stored",
        brokerAccountId: MT5_LOGIN,
        mt5Server: MT5_SERVER,
        note: "keep me",
        balance: 4321.11,
        brokerKey: "mt5",
        identityStatus: "inferred_id_prefix",
      },
      "junk-entry",
      {
        id: "manual-1",
        accountName: "Manual",
        broker: "Manual",
        brokerKey: null,
        // A record that names a broker this app cannot trade is "unsupported",
        // not "absent": the identity module never rewrites a stated broker.
        identityStatus: "unsupported",
      },
    ],
    "migration adds the derived identity and preserves every stored field verbatim",
  );

  assert.equal(
    migrateTradingAccounts(persisted).changed,
    false,
    "the array the page wrote must already be migrated"
  );

  assert.equal(
    ctx.text().includes(SECRET),
    false,
    "a stored token must not reach the DOM through the migration path",
  );
}

test("a legacy stored array is migrated once and keeps every user field", async () => {
  await withPage(
    {
      api: { getBrokerStatus: healthyAggregate() },
      storage: {
        [ACCOUNTS_KEY]: storedTradingAccounts([
          {
            id: "mt5-1001",
            accountName: "Typed as stored",
            brokerAccountId: MT5_LOGIN,
            mt5Server: MT5_SERVER,
            note: "keep me",
            balance: 4321.11,
          },
          "junk-entry",
          {
            id: "manual-1",
            accountName: "Manual",
            broker: "Manual",
          },
        ]),
      },
    },
    scenarioMigrationWritesOnce,
  );
});

// ============================================================
// 8. STRUCTURE AND EXECUTION SAFETY
// ============================================================

async function scenarioNoExecutionControl(ctx) {
  const actions = [
    ...new Set(ctx.findAll("[data-action]").map((node) => node.getAttribute("data-action"))),
  ].sort();

  // connect-existing is on this list because the wizard's control only puts a
  // dialog on the screen: it sends no request, starts no service and stores
  // nothing, which is what the wizard suite checks separately. An action that
  // opened a credential prompt or an order ticket would have to be refused here.
  assert.deepEqual(
    actions,
    ["connect", "connect-existing", "disconnect", "refresh", "start-service"],
    "at rest the page offers only refresh, the four connection controls and the wizard",
  );

  const forms = ctx.findAll("form");

  assert.equal(forms.length, 1, "the cTrader workspace renders exactly one form");

  assert.equal(
    forms[0].hasAttribute("data-ctrader-setup"),
    true,
    "the only form on this page is the cTrader account setup form",
  );

  // The rule is about controls, not prose: a confirmation region has to say that
  // disconnecting does not delete accounts, so scanning the whole text would
  // flag honest copy. What must not exist is a clickable order or deletion
  // action, and every action the page does offer is on the list above.
  const labels = ctx
    .findAll("button, a, [role=button]")
    .map((node) => node.textContent.replace(/\s+/g, " ").trim());

  for (const label of labels) {
    assert.equal(
      /\b(close|delete|place|submit|execute)\b/i.test(label),
      false,
      `no control may be labelled ${label}`,
    );
  }

  assert.equal(
    ctx.html().includes(SECRET),
    false,
    "no token from any payload may reach the DOM",
  );
}

test("the page offers no order-execution, deletion or credential control", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedMt5Account(), storedCtraderAccount()]),
      },
    },
    scenarioNoExecutionControl,
  );
});

// ============================================================
// 9. CONNECTION WORKFLOWS (Task 9)
// ============================================================
//
// Task 8 made the page honest about what it reads. Task 9 gives it the controls
// that change things, so each scenario drives the real workspace buttons and then
// answers four questions: which operation ran with which exact arguments, what
// landed in localStorage, what the page refused to do before a user confirmed or
// before a response arrived, and which fields a merge preserved.
//
// Every scenario here is a cTrader one. That is not a preference: the controls
// live on `AccountWorkspace`, which only lists rows for the broker this page opens
// a workspace for, so an MT5 workflow cannot be reached by any press.
//
// A credential never travels back. These scenarios assert a token or password
// appears nowhere it should not - not in the stored record, not in the rendered
// DOM, not in an update event - because each of those is a different way a
// plausible implementation could leak one.

// The one source gate this section needs. The scenarios below do not check it,
// so their failures stay behavioural and the Task 8 scenarios keep proving the
// orchestration already on disk.
test("the page carries the five connection workflow contracts", () => {
  assert.deepEqual(
    missingContracts(REQUIRED_WORKFLOW_SOURCE, readPage()),
    [],
    "the page must run the existing MT5 modal, merge through the model, navigate for OAuth " +
      "and announce both account update events",
  );
});

// A URL no implementation can produce by hard-coding the connect path: this
// scenario supplied the string, so passing means the page called
// ctraderConnectUrl() and used what it returned.
const OAUTH_PROBE_URL = "http://127.0.0.1:4000/api/ctrader/connect?probe=8f2c";

// The copy Task 9 promises. Pinning it here is what makes "authorization
// returned" and "connected" two different sentences in the tests, which is the
// whole point of the OAuth return handling.
const CT_RETURN_CONNECTED_COPY =
  "cTrader authorization returned. Select an account and start the service to establish a live connection.";
const CT_RETURN_ERROR_COPY =
  "cTrader authorization did not complete. No account was connected and nothing about your data changed.";
const CT_DISCONNECT_WARNING =
  "Disconnecting clears the saved cTrader authorization on this device. It does not delete your EdgeFlo accounts or your trade history.";

// The cTrader workflow answers, each built from the keys the producer actually
// sends (server/routes/ctrader.js: normalizeAccount and the four route bodies).
// Every one of them carries the token sentinel, because the point is that the
// page must not copy it anywhere.
function ctraderSelectAnswer({
  accountId = CT_TRADING_ACCOUNT_ID,
  accountName = "Demo 395823",
} = {}) {
  return {
    success: true,
    message: "Account switched successfully",
    activeAccount: {
      id: String(accountId),
      accountId: String(accountId),
      name: accountName,
      createdAt: "2026-11-04T00:00:00.000Z",
      accessToken: SECRET,
    },
    activeAccountId: String(accountId),
    service: { running: true, connected: true, authenticated: true, ready: true },
  };
}

// What POST /api/ctrader/account answers now (server/routes/ctrader.js, the
// save tail): the record it stored, the whole list, the active account the
// backend is still on, and `activated: false`. There is no `service` object in
// that body - saving a record starts nothing - and `activeAccountId` is the
// PREVIOUS selection, not the saved one.
function ctraderSavedAnswer({
  accountId = CT_TRADING_ACCOUNT_ID,
  accountName = "Main demo",
  activeAccountId = null,
  accounts = null,
} = {}) {
  const saved = {
    id: String(accountId),
    accountId: String(accountId),
    name: accountName,
    createdAt: "2026-11-04T00:00:00.000Z",
    accessToken: SECRET,
  };

  return {
    success: true,
    message: "Trading account saved successfully",
    activated: false,
    account: saved,
    accounts: accounts ?? [
      { ...saved, accessToken: undefined },
    ],
    activeAccountId:
      activeAccountId === null ? null : String(activeAccountId),
  };
}

// "cTrader service is ready" is what this server route says, and it is exactly
// the sentence the UI must not repeat: the route starts the process, it does not
// prove an authenticated session.
function ctraderStartedAnswer() {
  return {
    success: true,
    message: "cTrader service is ready",
    activeAccount: null,
    service: { running: true, connected: false, authenticated: false, ready: false },
  };
}

function ctraderDisconnectedAnswer() {
  return { success: true, message: "cTrader disconnected successfully" };
}

// A local record that has never been handed a token, so "no token was persisted"
// can only be satisfied by the page refusing to copy one.
function storedCtraderRecord() {
  return storedCtraderAccount({ accessToken: undefined });
}

function storedOwnedMt5Account() {
  return storedMt5Account({
    myTag: "keep-me",
    customNotes: "written by the user",
    startingBalance: 5000,
  });
}

// Both brokers present and both offline: the state a page must keep showing even
// while it explains that an authorization tab came back.
function offlineStatus() {
  return statusOf({
    mt5: mt5Block({ state: "disconnected", externalId: null, server: null, account: null }),
    ctrader: ctraderBlock({
      connected: false,
      authenticated: false,
      ready: false,
      accountSource: "none",
      requestedAccountId: null,
    }),
  });
}

function parseStored(ctx, key = ACCOUNTS_KEY) {
  const raw = ctx.stored(key);

  return raw === null ? null : JSON.parse(raw);
}

function storedById(list, id) {
  return list.find((account) => account.id === id) ?? null;
}

function accountNames(list) {
  return list.map((account) => account.id).sort();
}

const TRADE_KEYS = Object.freeze({
  "trades_mt5_1001": JSON.stringify([{ id: "t-1", pnl: 12.5 }]),
  "trades_ctrader_395823": JSON.stringify([{ id: "t-2", pnl: -3.25 }]),
  "trades_manual_1": JSON.stringify([{ id: "t-3", pnl: 0 }]),
});

function tradeStorage(extra = {}) {
  return { ...TRADE_KEYS, ...extra };
}

function assertKept(ctx, key, message) {
  assert.equal(ctx.stored(key), TRADE_KEYS[key], message);

  assert.equal(
    ctx.storageWrites.some((write) => write.key === key),
    false,
    `${message} (the key was written)`,
  );
}

// The MT5 connect and disconnect scenarios that ran through the real modal are
// retired with the MT5 entry point. Nothing a user can press on this page reaches
// them any more: `AccountWorkspace` only lists rows for the one broker this page
// opens a workspace for, and the modal opens for an MT5 row. Leaving them in would
// mean mounting MT5 state the page cannot produce, which tests the harness rather
// than the product.
//
// What is lost, and where it still lives: the modal itself is untouched and is
// still mounted by TradingAccountsPage.jsx, so the connect contract belongs to
// that surface. No test in this repository exercises POST /api/mt5/connect any
// more after this retirement - reported, not papered over. The merge rules the
// page applied to the answer stay covered by the model suite, and the returned-tab
// copy stays covered by the ?mt5 parameter test below.


// The cTrader authorize, select, setup and start workflows follow. The MT5
// disconnect scenarios that used to sit here are retired with the rest of the
// MT5 surface for the same reason as the connect ones: the only control that
// could reach them was an MT5 row, and this page no longer lists one. The
// cTrader disconnect they parallel is covered below, confirmation region included.

// ----------------------------------------------------------
// cTrader authorize, select, setup and start
// ----------------------------------------------------------

async function scenarioCtraderAuthorizeNavigates(ctx) {
  await ctx.clickAction("connect");

  assert.deepEqual(
    ctx.navigations,
    [{ to: OAUTH_PROBE_URL, how: "href" }],
    "Authorize sends the browser to exactly the URL ctraderConnectUrl() returned",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "ctraderConnectUrl"],
    "starting OAuth is a navigation, not a request the page makes itself",
  );

  assert.equal(ctx.storageWrites.length, 0, "and it changes nothing on this device");
}

test("cTrader Authorize navigates to ctraderConnectUrl() and calls nothing", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: offlineStatus(),
        ctraderConnectUrl: () => OAUTH_PROBE_URL,
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
      navigation: true,
    },
    scenarioCtraderAuthorizeNavigates,
  );
});

// The deployed build this page ships in had no backend URL configured, and the
// transport used to answer with the development server's address. Returning null
// is now how it says "unconfigured", and the page has to turn that into a
// message instead of a redirect.
async function scenarioCtraderAuthorizeBlockedByMissingBackend(ctx) {
  await ctx.clickAction("connect");

  assert.deepEqual(
    ctx.navigations,
    [],
    "an unconfigured backend must not send the browser anywhere, least of all to a loopback address",
  );

  assert.match(
    ctx.text(),
    /not configured in this build/,
    "the user is told the connection is not configured rather than watching a silent no-op",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "ctraderConnectUrl"],
    "refusing to navigate is not a reason to claim a connection with a request",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and a blocked connect changes nothing on this device",
  );
}

function missingBackendHarness() {
  return {
    options: {
      api: {
        getBrokerStatus: offlineStatus(),
        ctraderConnectUrl: () => null,
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
      navigation: true,
    },
  };
}

test("cTrader Authorize reports an unconfigured backend instead of navigating", async () => {
  await withPage(missingBackendHarness().options, scenarioCtraderAuthorizeBlockedByMissingBackend);
});

test("MUT connectGuardRemoved: a null connect URL may not reach location.href", () =>
  assertMutationDetected({
    name: "connectGuardRemoved",
    build: missingBackendHarness,
    scenario: scenarioCtraderAuthorizeBlockedByMissingBackend,
    reject: /an unconfigured backend must not send the browser anywhere/,
  }));

async function scenarioCtraderSelectSaved(ctx) {
  await ctx.clickRow(CT_ROW);

  assert.deepEqual(
    ctx.argsFor("selectCtraderAccount"),
    [[CT_TRADING_ACCOUNT_ID]],
    "a cTrader row click asks the service for that external account",
  );

  assert.equal(
    ctx.names()[1],
    "selectCtraderAccount",
    "the session is only read after the service accepted the switch",
  );

  assert.ok(
    ctx.names().indexOf("getCtraderStatus") > ctx.names().indexOf("selectCtraderAccount"),
    "so the service read that follows belongs to the account the user chose",
  );

  const stored = parseStored(ctx);
  const after = storedById(stored, "ctrader-395823");

  assert.ok(after, "the local record is still the one with the user's own id");
  assert.equal(after.accountName, "Demo 395823", "and takes the name the service reported");
  assert.equal(after.brokerAccountId, CT_TRADING_ACCOUNT_ID, "with its identity unchanged");
  assert.equal(after.balance, 1111.11, "while the locally stored numbers stay put");
  assert.equal(after.accessToken, undefined, "the access token in the response is never stored");
  assert.equal(
    JSON.stringify(stored).includes(SECRET),
    false,
    "no token from the selection response reaches storage",
  );

  assert.deepEqual(
    ctx.globalSelection,
    ["ctrader-395823"],
    "the selected row becomes the globally selected account",
  );

  const [detail] = ctx.detailsFor("ctraderAccountUpdated");

  assert.equal(detail?.id, "ctrader-395823", "the change is announced with the merged record");
  assert.equal(
    JSON.stringify(detail ?? {}).includes(SECRET),
    false,
    "and the announcement carries no token",
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "true",
    "the row now reads as selected",
  );
}

test("selecting a stored cTrader account switches the service and merges the record", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        selectCtraderAccount: ctraderSelectAnswer(),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    scenarioCtraderSelectSaved,
  );
});

async function scenarioCtraderSelectFailed(ctx) {
  const before = parseStored(ctx);

  await ctx.clickRow(CT_ROW);

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount"],
    "a refused switch reads nothing else",
  );

  assert.equal(ctx.storageWrites.length, 0, "a refused switch stores nothing");
  assert.deepEqual(parseStored(ctx), before, "so the record keeps its own name");
  assert.deepEqual(ctx.globalSelection, [], "and the global selection is not moved");
  assert.deepEqual(ctx.detailsFor("ctraderAccountUpdated"), [], "and nothing is announced");

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "false",
    "the row must not look selected when the switch failed",
  );

  assert.equal(
    ctx.text().includes("cTrader account selection failed"),
    true,
    "the transport failure is what the user reads",
  );
}

test("a refused cTrader account switch changes nothing", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: offlineStatus(),
        selectCtraderAccount: new Error("cTrader account selection failed with HTTP 500."),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    scenarioCtraderSelectFailed,
  );
});

test("recording a cTrader account posts the trimmed body and merges only after success", async () => {
  const gate = createDeferred();

  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        addCtraderAccount: gate.promise,
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedManualAccount()]) },
    },
    async (ctx) => {
      await scenarioCtraderSetupWith(ctx, gate);
    },
  );
});

// The gate has to be visible to both the deferral and the release, so the
// scenario takes it as an argument instead of building its own.
async function scenarioCtraderSetupWith(ctx, gate) {
  const before = parseStored(ctx);

  await ctx.setValue('[data-ctrader-setup] input[name="accountId"]', `  ${CT_TRADING_ACCOUNT_ID}  `);
  await ctx.setValue('[data-ctrader-setup] input[name="accountName"]', "  Main demo  ");

  await ctx.submitForm("[data-ctrader-setup]");

  assert.deepEqual(
    ctx.argsFor("addCtraderAccount"),
    [[{ accountId: CT_TRADING_ACCOUNT_ID, accountName: "Main demo" }]],
    "the setup body is the trimmed id and name the user typed",
  );

  assert.equal(ctx.storageWrites.length, 0, "nothing is stored before the server answers");
  assert.deepEqual(parseStored(ctx), before, "so the array is still the one the user had");

  await ctx.release(gate, ctraderSavedAnswer());

  const stored = parseStored(ctx);

  assert.deepEqual(
    accountNames(stored).sort(),
    ["ctrader-395823", "manual-1"],
    "the saved account joins the list without disturbing the manual one",
  );

  const after = storedById(stored, "ctrader-395823");

  assert.equal(after.brokerAccountId, CT_TRADING_ACCOUNT_ID);
  assert.equal(after.accountName, "Main demo", "under the name the user chose");
  assert.equal(after.accessToken, undefined, "and with no token from the response");
  assert.equal(JSON.stringify(stored).includes(SECRET), false, "not even in a sibling record");

  assert.deepEqual(
    storedById(stored, "manual-1"),
    storedById(before, "manual-1"),
    "the manual record is byte for byte what it was",
  );

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "saving an account is not selecting one, so the global selection is never written",
  );

  assert.equal(
    ctx.names().includes("getCtraderStatus"),
    false,
    "and a save starts no session read for the account it just stored",
  );

  const [detail] = ctx.detailsFor("ctraderAccountUpdated");

  assert.equal(detail?.id, "ctrader-395823");
}

// ----------------------------------------------------------
// Saving an account is not activating one (Phase 2.1-e, Task 6)
// ----------------------------------------------------------
//
// POST /api/ctrader/account stores a record and answers with the account the
// backend is still on; POST /api/ctrader/accounts/select is the only request
// that moves that selection. The page has to keep the two apart on the screen:
// a save may select nothing, may start no session, and may not describe the
// record it stored as the account in use. It reports the backend's own
// `activeAccountId` and never infers one from the saved id, the list it came
// with, or an `activated` flag.
//
// What these scenarios cannot prove: the routes. The transport is stubbed, so
// every answer below is synthetic and says nothing about what a live cTrader
// authorization does.

const CT_OTHER_ACCOUNT_ID = "77001122";
const CT_OTHER_ROW = `ctrader:${CT_OTHER_ACCOUNT_ID}:ctrader-${CT_OTHER_ACCOUNT_ID}`;

const CT_SAVED_COPY_NONE =
  "Account saved. No cTrader account is selected on the backend.";
const CT_SAVED_COPY_THIS =
  "Account saved. It is the account the backend already had selected.";
const CT_SAVED_COPY_OTHER =
  "Account saved. The backend still has another account selected.";
const CT_SELECTION_UNCONFIRMED_COPY =
  "The cTrader account switch was not confirmed, so nothing was selected.";

// The seven codes the select route answers with, in the page's own words. The
// transport never puts upstream text on screen, so a known code has to be
// translated here or the user reads a bare HTTP status.
const CT_SELECTION_ERROR_COPY = Object.freeze({
  explicit_selection_required:
    "No cTrader account is selected. Select one from the list to start a session on it.",
  requested_account_not_available:
    "That cTrader account is not available to this authorization.",
  no_accounts_available:
    "This cTrader authorization has no accounts to select.",
  ambiguous_account_ids:
    "Two saved cTrader accounts share an id, so neither one could be selected.",
  session_not_started:
    "The account was selected, but its live session could not be started.",
  session_identity_unverifiable:
    "The session that came back could not be confirmed as the account that was selected.",
  session_identity_mismatch:
    "The session that came back belongs to a different account than the one that was selected.",
});

function storedSecondCtraderAccount() {
  return storedCtraderAccount({
    id: "ctrader-77001122",
    accountName: "cTrader 77001122",
    brokerAccountId: CT_OTHER_ACCOUNT_ID,
    balance: 2222.22,
    accessToken: undefined,
  });
}

// Shaped the way the transport throws: a page-authored sentence plus the
// diagnostic code the route sent.
function codedSelectionError(status, code) {
  const error = new Error(
    `cTrader account selection failed with HTTP ${String(status)}.`,
  );

  error.code = code;

  return error;
}

// A message the page must put on the screen. Reading `.textContent` off a
// `find()` that returned null would throw, and a thrown test cannot say which
// contract the page broke, so the element is named before its text is.
function assertRenderedText(ctx, selector, expected, message) {
  const node = ctx.find(selector);

  assert.ok(node, `${message} (no ${selector} was rendered)`);

  assert.equal(
    node.textContent.replace(/\s+/g, " ").trim(),
    expected,
    message,
  );
}

function assertSelectionUnmoved(ctx, message) {
  assert.deepEqual(ctx.globalSelection, [], `${message} (the global selection was written)`);

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "true",
    `${message} (the account that was in use stopped looking selected)`,
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_OTHER_ROW}"]`).getAttribute("aria-pressed"),
    "false",
    `${message} (the account that was refused looks selected)`,
  );
}

function saveHarness() {
  const gate = createDeferred();

  return {
    gate,
    options: {
      api: {
        getBrokerStatus: offlineStatus(),
        // Configured so a page that wrongly started a session gets as far as the
        // selection it wrongly made; the scenario below then proves the honest
        // page never reaches this at all.
        getCtraderStatus: ctraderServiceResponse(),
        addCtraderAccount: gate.promise,
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedManualAccount()]) },
    },
  };
}

async function scenarioSaveStartsNothing(ctx, harness) {
  await ctx.setValue(
    '[data-ctrader-setup] input[name="accountId"]',
    CT_TRADING_ACCOUNT_ID,
  );
  await ctx.setValue('[data-ctrader-setup] input[name="accountName"]', "Main demo");
  await ctx.submitForm("[data-ctrader-setup]");

  await ctx.release(harness.gate, ctraderSavedAnswer());

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "a save never writes the global account selection",
  );

  assert.equal(
    ctx.names().includes("getCtraderStatus"),
    false,
    "a save starts no session read, so nothing can be attributed to the account it stored",
  );

  const row = ctx.find(`button[data-row-key="${CT_ROW}"]`);

  assert.ok(row, "the saved account is listed for the user to select");
  assert.equal(
    row.getAttribute("aria-pressed"),
    "false",
    "and it is listed as not the account in use",
  );

  assertRenderedText(
    ctx,
    "[data-save-notice]",
    CT_SAVED_COPY_NONE,
    "the confirmation reports the backend's own active account, which here is none",
  );

  assertConnectionState(
    ctx,
    "disconnected",
    "Disconnected",
    "after a save that activated nothing",
  );

  assert.equal(
    JSON.stringify(parseStored(ctx)).includes(SECRET),
    false,
    "and the token the save response carried never reaches storage",
  );
}

test("saving a cTrader account with nothing active selects nothing and starts no session", async () => {
  const harness = saveHarness();

  await withPage(harness.options, (ctx) => scenarioSaveStartsNothing(ctx, harness));
});

test("MUT saveActivatesAccount: a save may not become an activation", () =>
  assertMutationDetected({
    name: "saveActivatesAccount",
    build: saveHarness,
    scenario: scenarioSaveStartsNothing,
    reject: /a save never writes the global account selection/,
  }));

// The save that arrives while a different account is in use is the one that can
// do the most damage: the previous page both selected and read a session for the
// record it had just stored, which moved the journal off a connected account.
function saveWhileActiveHarness() {
  const gate = createDeferred();

  return {
    gate,
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        addCtraderAccount: gate.promise,
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: tradeStorage({
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
          storedManualAccount(),
        ]),
      }),
    },
  };
}

async function scenarioSavePreservesTheActiveAccount(ctx, harness) {
  const before = parseStored(ctx);
  const balanceBefore = ctx.metric("balance");

  await ctx.setValue(
    '[data-ctrader-setup] input[name="accountId"]',
    CT_OTHER_ACCOUNT_ID,
  );
  await ctx.setValue('[data-ctrader-setup] input[name="accountName"]', "Second demo");
  await ctx.submitForm("[data-ctrader-setup]");

  await ctx.release(harness.gate, ctraderSavedAnswer({
    accountId: CT_OTHER_ACCOUNT_ID,
    accountName: "Second demo",
    activeAccountId: CT_TRADING_ACCOUNT_ID,
  }));

  assertSelectionUnmoved(ctx, "saving a second account keeps the account that was in use");

  assert.equal(
    ctx.argsFor("getCtraderStatus").length,
    1,
    "the save reads no session, so the live numbers on screen are still the status endpoint's",
  );

  assert.equal(
    ctx.metric("balance"),
    balanceBefore,
    "and a save response with no service object in it changes nothing about them",
  );

  assertRenderedText(
    ctx,
    "[data-save-notice]",
    CT_SAVED_COPY_OTHER,
    "the confirmation repeats the backend's active account rather than the saved one",
  );

  const stored = parseStored(ctx);

  assert.deepEqual(
    accountNames(stored).sort(),
    ["ctrader-395823", "ctrader-77001122", "manual-1"],
    "and the stored list is still exactly the accounts it held",
  );

  assert.equal(
    storedById(stored, "ctrader-77001122").accountName,
    "Second demo",
    "the save still saved: the record took the name it was given",
  );

  assert.equal(
    storedById(stored, "ctrader-77001122").accessToken,
    undefined,
    "and took nothing else with it",
  );

  assert.deepEqual(
    storedById(stored, "ctrader-395823"),
    storedById(before, "ctrader-395823"),
    "and the record that was already there is byte for byte what it was",
  );

  assertKept(ctx, "trades_ctrader_395823", "the journal data of the active account is untouched");
  assertKept(ctx, "trades_manual_1", "and so is every other account's");
}

test("saving a second cTrader account leaves the active account selected and its data alone", async () => {
  const harness = saveWhileActiveHarness();

  await withPage(harness.options, (ctx) => scenarioSavePreservesTheActiveAccount(ctx, harness));
});

// `activated` is a field the save route sends and the page has no use for: the
// selection truth is `activeAccountId`, and a flag that agreed with the saved id
// must not be able to move anything.
function saveFlaggedHarness() {
  const gate = createDeferred();

  return {
    gate,
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        addCtraderAccount: gate.promise,
      },
      url: WORKSPACE_URL,
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
        ]),
      },
    },
  };
}

async function scenarioSaveIgnoresActivatedFlag(ctx, harness) {
  await ctx.setValue(
    '[data-ctrader-setup] input[name="accountId"]',
    CT_OTHER_ACCOUNT_ID,
  );
  await ctx.setValue('[data-ctrader-setup] input[name="accountName"]', "Second demo");
  await ctx.submitForm("[data-ctrader-setup]");

  await ctx.release(
    harness.gate,
    {
      ...ctraderSavedAnswer({
        accountId: CT_OTHER_ACCOUNT_ID,
        accountName: "Second demo",
        activeAccountId: null,
      }),
      activated: true,
    },
  );

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "an activated flag in a save response selects nothing",
  );

  assert.equal(
    ctx.names().includes("getCtraderStatus"),
    false,
    "and starts no session",
  );

  assertRenderedText(
    ctx,
    "[data-save-notice]",
    CT_SAVED_COPY_NONE,
    "while the confirmation still reports the backend's active account, which is none",
  );
}

test("a cTrader save response is never treated as an activation, flag or no flag", async () => {
  const harness = saveFlaggedHarness();

  await withPage(harness.options, (ctx) => scenarioSaveIgnoresActivatedFlag(ctx, harness));
});

// Re-saving the account that is already selected is the one case where the
// backend's active account and the saved record are the same thing. The page may
// only know that from `activeAccountId`.
function saveActiveItselfHarness() {
  const gate = createDeferred();

  return {
    gate,
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        addCtraderAccount: gate.promise,
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
  };
}

async function scenarioSaveOfTheActiveAccountSaysSo(ctx, harness) {
  await ctx.setValue(
    '[data-ctrader-setup] input[name="accountId"]',
    CT_TRADING_ACCOUNT_ID,
  );
  await ctx.setValue('[data-ctrader-setup] input[name="accountName"]', "Renamed demo");
  await ctx.submitForm("[data-ctrader-setup]");

  await ctx.release(harness.gate, ctraderSavedAnswer({
    accountId: CT_TRADING_ACCOUNT_ID,
    accountName: "Renamed demo",
    activeAccountId: CT_TRADING_ACCOUNT_ID,
  }));

  assertRenderedText(
    ctx,
    "[data-save-notice]",
    CT_SAVED_COPY_THIS,
    "the confirmation says this is the account the backend already had selected",
  );

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "and saying so is still not the same as selecting it",
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "false",
    "while the row the backend named does not read as the account in use",
  );

  assert.equal(
    ctx.argsFor("getCtraderStatus").length,
    0,
    "and a save that names the backend's account still reads no session for it",
  );
}

test("saving the account the backend already has selected reports that and selects nothing new", async () => {
  const harness = saveActiveItselfHarness();

  await withPage(harness.options, (ctx) => scenarioSaveOfTheActiveAccountSaysSo(ctx, harness));
});

async function scenarioSelectOtherAccountActivatesIt(ctx) {
  await ctx.clickRow(CT_OTHER_ROW);

  assert.deepEqual(
    ctx.argsFor("selectCtraderAccount"),
    [[CT_OTHER_ACCOUNT_ID]],
    "the row click asks the backend for the account the user pressed",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount", "getBrokerStatus", "getCtraderStatus"],
    "the session is read only after the switch was accepted, and only through the status endpoint",
  );

  assert.deepEqual(
    ctx.globalSelection,
    ["ctrader-77001122"],
    "an accepted switch is what moves the selection",
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_OTHER_ROW}"]`).getAttribute("aria-pressed"),
    "true",
    "and the row the user chose is the one that reads as selected",
  );

  assert.equal(
    ctx.findAll("[data-save-notice]").length,
    0,
    "the earlier save confirmation makes way for the action that replaced it",
  );

  const stored = parseStored(ctx);

  assert.equal(
    storedById(stored, "ctrader-77001122").accountName,
    "Second demo",
    "the switched-to record takes the name the switch reported",
  );

  assert.equal(
    JSON.stringify(stored).includes(SECRET),
    false,
    "without taking a token with it",
  );
}

test("explicitly selecting the other cTrader account is what activates it", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        addCtraderAccount: ctraderSavedAnswer({ accountId: CT_OTHER_ACCOUNT_ID }),
        selectCtraderAccount: ctraderSelectAnswer({ accountId: CT_OTHER_ACCOUNT_ID, accountName: "Second demo" }),
      },
      url: WORKSPACE_URL,
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
        ]),
      },
    },
    scenarioSelectOtherAccountActivatesIt,
  );
});

// An HTTP success is not by itself an activation. The route answers a switch
// with the account it switched to and the id it is now on; a response that does
// not agree with the account the user asked for cannot be told apart from a
// request that only persisted something, so the page selects nothing.
function unconfirmedSwitchHarness(answer) {
  return {
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        selectCtraderAccount: answer,
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
        ]),
      },
    },
  };
}

// The switch that was persisted but never confirmed: a success, an account, and
// no `activeAccountId` to tie them together.
function unconfirmedSwitchBuild() {
  return unconfirmedSwitchHarness({
    ...ctraderSelectAnswer({ accountId: CT_OTHER_ACCOUNT_ID }),
    activeAccountId: undefined,
  });
}

async function scenarioSwitchWithoutConfirmation(ctx) {
  const before = parseStored(ctx);

  await ctx.clickRow(CT_OTHER_ROW);

  assertRenderedText(
    ctx,
    "[data-action-error]",
    CT_SELECTION_UNCONFIRMED_COPY,
    "a switch the response does not confirm is reported as a switch that did not happen",
  );

  assertSelectionUnmoved(ctx, "an unconfirmed switch selects nothing");

  assert.equal(ctx.storageWrites.length, 0, "and stores nothing");
  assert.deepEqual(parseStored(ctx), before, "leaving the account list as it was");
  assert.deepEqual(
    ctx.detailsFor("ctraderAccountUpdated"),
    [],
    "and announcing nothing to the contexts that own the data",
  );
}

test("a cTrader switch answered without an active account id activates nothing", async () => {
  await withPage(
    unconfirmedSwitchBuild().options,
    scenarioSwitchWithoutConfirmation,
  );
});

test("MUT switchUnconfirmedSelectsAnyway: a persisted-only switch may not activate", () =>
  assertMutationDetected({
    name: "switchUnconfirmedSelectsAnyway",
    build: unconfirmedSwitchBuild,
    scenario: scenarioSwitchWithoutConfirmation,
    reject: /is reported as a switch that did not happen/,
  }));

test("a cTrader switch answered with a different active account activates nothing", async () => {
  const answer = {
    ...ctraderSelectAnswer({ accountId: CT_OTHER_ACCOUNT_ID }),
    // The account the user pressed, reported as switched to, while the backend
    // says it is still on the one that was already in use.
    activeAccountId: CT_TRADING_ACCOUNT_ID,
  };

  await withPage(
    unconfirmedSwitchHarness(answer).options,
    scenarioSwitchWithoutConfirmation,
  );
});

// ----------------------------------------------------------
// The seven selection codes
// ----------------------------------------------------------

function selectionFailureHarness(error) {
  return {
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        selectCtraderAccount: error,
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
        ]),
      },
    },
  };
}

function scenarioSelectionRefused(code, copy) {
  return async function scenarioSelectionRefusedWithCode(ctx) {
    await ctx.clickRow(CT_OTHER_ROW);

    const alert = ctx.find("[data-action-error]");

    assert.ok(alert, `a ${code} refusal must be reported to the user`);

    assert.equal(
      alert.textContent.replace(/\s+/g, " ").trim(),
      copy,
      `the ${code} refusal must read as its own reason, not as a status code`,
    );

    const codeNode = ctx.find("[data-action-code]");

    assert.ok(
      codeNode,
      `while the ${code} refusal must keep the diagnostic code on the element for the state the page logs`,
    );

    assert.equal(
      codeNode.getAttribute("data-action-code"),
      code,
      `and keep the exact code, not a rewritten one`,
    );

    assertSelectionUnmoved(ctx, `a ${code} refusal changes the selection`);

    assert.equal(
      ctx.argsFor("getCtraderStatus").length,
      1,
      `and a ${code} refusal reads no session, so nothing can be shown as live`,
    );

    assert.equal(ctx.findAll("[data-save-notice]").length, 0, "and no success confirmation is left on screen");
    assert.equal(ctx.html().includes(SECRET), false, "and no credential from any response is on the screen");
  };
}

const SELECTION_REFUSALS = Object.freeze([
  [400, "explicit_selection_required"],
  [404, "requested_account_not_available"],
  [404, "no_accounts_available"],
  [404, "ambiguous_account_ids"],
  [500, "session_not_started"],
  [409, "session_identity_unverifiable"],
  [409, "session_identity_mismatch"],
]);

for (const [status, code] of SELECTION_REFUSALS) {
  test(`a cTrader switch refused with ${code} fails closed`, async () => {
    await withPage(
      selectionFailureHarness(codedSelectionError(status, code)).options,
      scenarioSelectionRefused(code, CT_SELECTION_ERROR_COPY[code]),
    );
  });
}

// A code the page has never heard of must not be turned into a sentence the page
// cannot stand behind, and must not be rendered as though it were known.
async function scenarioUnknownCode(ctx) {
  await ctx.clickRow(CT_OTHER_ROW);

  assertRenderedText(
    ctx,
    "[data-action-error]",
    "cTrader account selection failed with HTTP 418.",
    "an unrecognised code leaves the transport's own sentence on screen",
  );

  assert.equal(
    ctx.find("[data-action-code]"),
    null,
    "and the page does not advertise a code it did not translate",
  );

  assertSelectionUnmoved(ctx, "an unrecognised refusal changes the selection");
}

test("a cTrader switch refused with an unknown code reports the transport, not a guess", async () => {
  await withPage(
    selectionFailureHarness(codedSelectionError(418, "teapot")).options,
    scenarioUnknownCode,
  );
});

async function scenarioCtraderStartService(ctx) {
  await ctx.clickAction("start-service");

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "startCtraderService", "getBrokerStatus"],
    "starting the service is a POST and then a fresh aggregate read",
  );

  assert.deepEqual(
    ctx.argsFor("startCtraderService"),
    [[]],
    "the start contract is a POST without a body"
  );

  assert.equal(ctx.storageWrites.length, 0, "starting a process stores nothing");

  assert.equal(
    ctx.text().includes("cTrader service is ready"),
    false,
    "the server's own message is not a claim this page may repeat",
  );

  assertConnectionState(
    ctx,
    "disconnected",
    "Disconnected",
    "after a start with no session",
  );
}

test("starting the cTrader service re-reads status instead of claiming readiness", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: offlineStatus(),
        startCtraderService: ctraderStartedAnswer(),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    scenarioCtraderStartService,
  );
});

// ----------------------------------------------------------
// cTrader disconnect, behind a confirmation
// ----------------------------------------------------------

async function scenarioCtraderDisconnectConfirmation(ctx) {
  const before = parseStored(ctx);

  await ctx.clickCard("ctrader");
  await ctx.clickAction("disconnect");

  assert.equal(
    ctx.findAll("[data-disconnect-confirmation]").length,
    1,
    "cTrader disconnect asks first, because clearing an authorization is not reversible",
  );

  assert.equal(
    ctx.find("[data-disconnect-warning]").textContent.replace(/\s+/g, " ").trim(),
    CT_DISCONNECT_WARNING,
    "the confirmation says what it does and what it does not touch",
  );

  assert.equal(
    ctx.names().includes("disconnectCtrader"),
    false,
    "no request may leave before the user confirms",
  );

  assert.equal(ctx.storageWrites.length, 0, "and nothing is stored either");

  await ctx.clickAction("cancel-disconnect");

  assert.equal(
    ctx.findAll("[data-disconnect-confirmation]").length,
    0,
    "cancel closes the confirmation",
  );

  assert.equal(
    ctx.names().includes("disconnectCtrader"),
    false,
    "and a cancelled disconnect never happens",
  );

  await ctx.clickAction("disconnect");
  await ctx.clickAction("confirm-disconnect");

  assert.deepEqual(
    ctx.argsFor("disconnectCtrader"),
    [[]],
    "only the confirmed click sends the POST without a body",
  );

  assert.equal(
    ctx.findAll("[data-disconnect-confirmation]").length,
    0,
    "the confirmation closes once the request is sent",
  );

  const stored = parseStored(ctx);

  assert.equal(stored.length, before.length, "disconnecting deletes no account");

  const after = storedById(stored, "ctrader-395823");

  assert.equal(after.connectionStatus, "disconnected", "the cTrader record says so");
  assert.equal(after.accessToken, undefined, "and the response token is never copied in");
  assert.equal(
    JSON.stringify(stored).includes(SECRET),
    false,
    "no token reaches storage through this workflow",
  );

  assert.deepEqual(
    storedById(stored, "mt5-1001"),
    storedById(before, "mt5-1001"),
    "an MT5 record is none of this workflow's business",
  );

  assert.deepEqual(
    storedById(stored, "manual-1"),
    storedById(before, "manual-1"),
    "and neither is a manual account",
  );

  assert.equal(
    ctx.storageWrites.some((write) => write.type === "remove"),
    false,
    "no storage key is removed",
  );

  assertKept(ctx, "trades_ctrader_395823", "the trade history stays where it is");
  assertKept(ctx, "trades_mt5_1001", "for every account");

  assert.equal(
    ctx.detailsFor("ctraderAccountUpdated").length,
    1,
    "the change is announced once",
  );

  assertNoMetric(ctx, "and the live session is cleared");
}

test("cTrader disconnect only runs after confirmation and deletes nothing", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        disconnectCtrader: ctraderDisconnectedAnswer(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: tradeStorage({
        [ACCOUNTS_KEY]: migratedStorage([
          storedOwnedMt5Account(),
          storedCtraderRecord(),
          storedManualAccount(),
        ]),
      }),
    },
    scenarioCtraderDisconnectConfirmation,
  );
});

async function scenarioCtraderDisconnectFailed(ctx) {
  const before = parseStored(ctx);

  await ctx.clickCard("ctrader");
  await ctx.clickAction("disconnect");
  await ctx.clickAction("confirm-disconnect");

  assert.deepEqual(
    ctx.argsFor("disconnectCtrader"),
    [[]],
    "the confirmed request was sent",
  );

  assert.equal(ctx.storageWrites.length, 0, "a failed disconnect stores nothing");
  assert.deepEqual(parseStored(ctx), before, "so no record is marked disconnected");
  assert.deepEqual(ctx.detailsFor("ctraderAccountUpdated"), [], "and nothing is announced");
  assert.equal(
    ctx.findAll("[data-disconnect-confirmation]").length,
    0,
    "the confirmation closes even when the request fails",
  );
  assert.equal(
    ctx.text().includes("cTrader disconnect failed"),
    true,
    "and the transport failure is reported",
  );
}

test("a failed cTrader disconnect leaves every local record as it was", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        disconnectCtrader: new Error("cTrader disconnect failed with HTTP 500."),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord(), storedOwnedMt5Account()]),
      },
    },
    scenarioCtraderDisconnectFailed,
  );
});

// ----------------------------------------------------------
// One workflow at a time
// ----------------------------------------------------------

async function scenarioBusyDisablesActions(ctx, gate) {
  await ctx.clickRow(CT_ROW);

  assert.deepEqual(
    ctx.argsFor("selectCtraderAccount"),
    [[CT_TRADING_ACCOUNT_ID]],
    "the switch request is in flight",
  );

  for (const action of ["connect", "disconnect", "start-service"]) {
    assert.equal(
      ctx.find(`[data-action="${action}"]`).disabled,
      true,
      `a workflow in flight must disable ${action}`,
    );
  }

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).disabled,
    true,
    "and it must disable account selection too, or the user can point the session elsewhere",
  );

  for (const name of ["accountId", "accountName"]) {
    assert.equal(
      ctx.find(`[data-ctrader-setup] input[name="${name}"]`).disabled,
      true,
      `and the ${name} field`,
    );
  }

  await ctx.release(gate, ctraderSelectAnswer());

  assert.equal(
    ctx.find('[data-action="connect"]').disabled,
    false,
    "the controls come back once the workflow is answered",
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).disabled,
    false,
    "including the rows",
  );
}

test("a busy workflow disables every conflicting account action until it is answered", async () => {
  const gate = createDeferred();

  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        selectCtraderAccount: gate.promise,
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    (ctx) => scenarioBusyDisablesActions(ctx, gate),
  );
});

// ----------------------------------------------------------
// The tab comes back from an authorization
// ----------------------------------------------------------

async function scenarioReturnNotice(ctx, copy) {
  assert.equal(
    ctx.find("[data-oauth-notice]").textContent.replace(/\s+/g, " ").trim(),
    copy,
    "the return copy says what returned",
  );

  // The whole point of the return handling: the status line keeps saying whatever
  // the aggregate says. A tab coming back from an authorization is not a connection.
  assertConnectionState(
    ctx,
    "disconnected",
    "Disconnected",
    "after the authorization tab returned",
  );

  assert.ok(
    ctx.find('[data-prompt="account"]'),
    "a return is not a selection, so the page still asks for an account",
  );

  assert.equal(
    ctx.window.location.search,
    "",
    "the parameters are read once and then removed from the address",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "the return itself makes exactly the normal status read and no session request",
  );

  assert.equal(ctx.globalSelection.length, 0, "and it never moves the global selection");
}

test("?ctrader=connected selects cTrader and says authorization returned, not Connected", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      url: "http://localhost/settings?ctrader=connected",
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    (ctx) => scenarioReturnNotice(ctx, CT_RETURN_CONNECTED_COPY),
  );
});

test("?ctrader=error gives generic copy and drops the message parameter", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      url: `http://localhost/settings?ctrader=error&message=${SECRET}`,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    (ctx) => {
      assert.equal(
        ctx.html().includes(SECRET),
        false,
        "the message parameter is never rendered",
      );

      return scenarioReturnNotice(ctx, CT_RETURN_ERROR_COPY);
    },
  );
});

// The return instruction asks for a step the user has not taken yet. Once they
// take it - an explicit selection the service confirmed - the page is reporting a
// live session, and a banner that still says "select an account" describes work
// already done. This drives the whole path through the real UI: the row button,
// the switch request, the merge and the session read, with no state shortcut.
async function scenarioOauthNoticeClearsAfterSelection(ctx) {
  const notice = ctx.find("[data-oauth-notice]");

  assert.ok(notice, "the return instruction is on screen before the choice");
  assert.equal(
    notice.getAttribute("data-oauth-notice"),
    "ctrader",
    "it is attributed to the broker whose tab returned",
  );
  assert.equal(
    notice.textContent.replace(/\s+/g, " ").trim(),
    CT_RETURN_CONNECTED_COPY,
    "and it is the instruction to select an account and start the service",
  );

  assert.ok(
    ctx.find('[data-prompt="account"]'),
    "with nothing selected the page still asks for an account",
  );

  // The status line is the aggregate's own word and this page only re-reads it
  // on a status refresh, so the fact the selection changes is the session: with
  // nothing read yet there is no validated session to name.
  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "an authorization return and a live account list are not a session this page has read",
  );

  await ctx.clickRow(CT_ROW);

  assert.deepEqual(
    ctx.argsFor("selectCtraderAccount"),
    [[CT_TRADING_ACCOUNT_ID]],
    "the choice is the real service switch, not a local shortcut",
  );
  assert.deepEqual(
    ctx.globalSelection,
    ["ctrader-395823"],
    "the account the service confirmed is now the selected one",
  );
  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "true",
    "and its row reads as selected",
  );

  assertConnectionState(
    ctx,
    "connected",
    "Connected",
    "the aggregate's own word for the service the selection switched",
  );
  assertConnectedSummary(ctx, { brokerName: "cTrader" });
  assert.equal(
    ctx.names().includes("startCtraderService"),
    false,
    "selecting reads the session; starting the service stays its own explicit request",
  );

  assertAbsent(
    ctx,
    "[data-oauth-notice]",
    "the instruction disappears once the account it asked for is selected",
  );
}

test("the OAuth return instruction clears when an account is explicitly selected", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        selectCtraderAccount: ctraderSelectAnswer(),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    scenarioOauthNoticeClearsAfterSelection,
  );
});

// ----------------------------------------------------------
// The instruction survives every path that did not select an account
// ----------------------------------------------------------
//
// Clearing the notice is a claim about one specific event: the service confirmed
// the switch and the page committed the account. So every neighbouring path that
// looks like that event but is not one - a success whose answer does not name the
// account, a switch the transport refused, a save that only stored - has to leave
// the instruction on screen, because the step it asks for is still the step the
// user has not taken. Each scenario drives the same real controls as the test
// above and changes only what the backend answered.

async function scenarioOauthNoticeSurvivesUnconfirmedSwitch(ctx) {
  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "the instruction is on screen before the choice",
  );

  await ctx.clickRow(CT_OTHER_ROW);

  assertRenderedText(
    ctx,
    "[data-action-error]",
    CT_SELECTION_UNCONFIRMED_COPY,
    "a switch the response does not confirm is reported as a switch that did not happen",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount"],
    "and it commits nothing, so no session is read for the account it did not name",
  );
  assert.deepEqual(ctx.globalSelection, [], "moves no selection");
  assert.equal(ctx.storageWrites.length, 0, "stores nothing");
  assert.deepEqual(ctx.detailsFor("ctraderAccountUpdated"), [], "announces nothing");
  assert.equal(
    ctx.find(`button[data-row-key="${CT_OTHER_ROW}"]`).getAttribute("aria-pressed"),
    "false",
    "and the account the user pressed does not look selected",
  );

  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "so the instruction the switch did not satisfy is still there to be satisfied",
  );
}

test("an unconfirmed cTrader switch leaves the OAuth return instruction on screen", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        // A success that reports an account and no `activeAccountId` to tie it
        // to: the page cannot tell it apart from a request that only persisted.
        selectCtraderAccount: {
          ...ctraderSelectAnswer({ accountId: CT_OTHER_ACCOUNT_ID }),
          activeAccountId: undefined,
        },
      },
      url: WORKSPACE_URL,
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
        ]),
      },
    },
    scenarioOauthNoticeSurvivesUnconfirmedSwitch,
  );
});

async function scenarioOauthNoticeSurvivesRefusedSwitch(ctx) {
  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "the instruction is on screen before the choice",
  );

  await ctx.clickRow(CT_ROW);

  assert.equal(
    ctx.text().includes("cTrader account selection failed"),
    true,
    "the transport's own failure is what the user reads",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount"],
    "a refused switch is not followed by a session read",
  );
  assert.deepEqual(ctx.globalSelection, [], "and moves no selection");
  assert.equal(ctx.storageWrites.length, 0, "stores nothing");
  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed"),
    "false",
    "the row the user pressed does not look selected",
  );
  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "and a service that reports an account is not a session the page may name",
  );

  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "so the instruction outlives the switch that failed",
  );
}

test("a refused cTrader account switch leaves the OAuth return instruction on screen", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        selectCtraderAccount: new Error("cTrader account selection failed with HTTP 500."),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
    scenarioOauthNoticeSurvivesRefusedSwitch,
  );
});

// A save is the path that most nearly looks like a selection: it names an
// account, stores it and reports the backend's own active id. It activates
// nothing, so it ends nothing either - the instruction and the save
// confirmation belong on the screen together.
async function scenarioSaveKeepsTheReturnInstruction(ctx, harness) {
  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "the instruction is on screen before the save",
  );

  await scenarioSaveStartsNothing(ctx, harness);

  assert.equal(
    ctx.names().includes("selectCtraderAccount"),
    false,
    "the save never asked the service to switch",
  );
  assert.equal(
    ctx.names().includes("startCtraderService"),
    false,
    "nor asked it to start the service",
  );

  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "and it leaves the instruction beside the confirmation of what it did do",
  );
}

test("saving a cTrader account without activating it keeps the OAuth return instruction", async () => {
  const harness = saveHarness();

  await withPage(harness.options, (ctx) =>
    scenarioSaveKeepsTheReturnInstruction(ctx, harness),
  );
});

// A parameter naming a broker this page does not offer describes a round trip this
// screen has no way to describe, so it is dropped rather than answered. The page
// may not announce a terminal it never talked to, may not open a workspace for it,
// and may not change what the aggregate it did read says.
test("a return parameter for a broker this page does not offer is not heard", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      url: `http://localhost/settings?mt5=connected&message=${SECRET}`,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedOwnedMt5Account()]) },
    },
    async (ctx) => {
      assertAbsent(
        ctx,
        "[data-oauth-notice]",
        "an mt5 return parameter may not announce anything",
      );

      assert.equal(
        ctx.text().includes("The MT5 terminal reported a login"),
        false,
        "the sentence this page used to say for that parameter must not be said",
      );

      assert.equal(ctx.html().includes(SECRET), false, "and its message parameter is not echoed");

      assertAbsent(
        ctx,
        "[data-broker-card]",
        "nor may a parameter for another broker open a workspace",
      );

      assertOneEntryPoint(ctx, "so the page is still asking for an account to connect");

      assertConnectionState(
        ctx,
        "disconnected",
        "Disconnected",
        "and the one status line this page has keeps the aggregate's own answer",
      );

      assert.deepEqual(
        ctx.names(),
        ["getBrokerStatus"],
        "hearing nothing means requesting nothing beyond the normal read",
      );

      assert.equal(ctx.globalSelection.length, 0, "and it moves no selection");

      assert.equal(
        ctx.window.location.search,
        "",
        "the parameter still leaves the address, unread but not left behind",
      );
    },
  );
});

// ============================================================
// 10. MUTATION PROBES
// ============================================================
//
// Each probe re-runs its own scenario unmutated first, so a detection can only
// come from the removed line, and then names the assertion that rejects the
// mutant. Probes edit the text esbuild reads, never a repository file.

async function assertMutationDetected({ name, build, scenario, reject }) {
  const clean = build();

  await withPage(clean.options, (ctx) => scenario(ctx, clean));

  const mutated = build();

  let failure = null;

  try {
    await withPage(
      { ...mutated.options, mutation: MUTATIONS[name] },
      (ctx) => scenario(ctx, mutated),
    );
  } catch (error) {
    failure = error;
  }

  assert.ok(failure, `the ${name} mutant must be caught by its scenario`);

  assert.match(
    failure.message,
    reject,
    `the ${name} mutant must be caught by the named assertion, got: ${failure.message.slice(0, 400)}`,
  );
}

function globalSelectionHarness() {
  return {
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount(), storedMt5Account()]),
      },
    },
  };
}

test("MUT mountSelectsGlobally: opening the page may not rewrite the global selection", () =>
  assertMutationDetected({
    name: "mountSelectsGlobally",
    build: globalSelectionHarness,
    scenario: scenarioCtraderGlobalAccount,
    reject: /reading a selection is not the same as writing one/,
  }));

function cardClickClearsHarness() {
  return {
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]),
      },
    },
  };
}

// The property is the same one the retired MT5 round-trip scenarios proved:
// un-selecting clears the session at once. The press that does it on this page is
// the broker card, and without the reset the connected summary keeps naming a
// session the user just dropped.
test("MUT staleDataNotCleared: a switch must clear the previous session at once", () =>
  assertMutationDetected({
    name: "staleDataNotCleared",
    build: cardClickClearsHarness,
    scenario: scenarioCardClickClearsTheAccount,
    reject: /no summary may keep naming a broker whose session was dropped/,
  }));

function lateStatusHarness() {
  const stale = createDeferred();
  const fresh = createDeferred();

  return {
    stale,
    fresh,
    options: {
      api: { getBrokerStatus: [stale.promise, fresh.promise] },
    },
  };
}

test("MUT staleStatusCommitted: an older status read may not replace a newer one", () =>
  assertMutationDetected({
    name: "staleStatusCommitted",
    build: lateStatusHarness,
    scenario: scenarioLateStatusDiscarded,
    reject: /an older read must not replace a newer answer/,
  }));

function confirmDisconnectHarness() {
  return {
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        disconnectCtrader: ctraderDisconnectedAnswer(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: tradeStorage({
        [ACCOUNTS_KEY]: migratedStorage([
          storedOwnedMt5Account(),
          storedCtraderRecord(),
          storedManualAccount(),
        ]),
      }),
    },
  };
}

test("MUT confirmlessDisconnect: a disconnect may not run before the user confirms", () =>
  assertMutationDetected({
    name: "confirmlessDisconnect",
    build: confirmDisconnectHarness,
    scenario: scenarioCtraderDisconnectConfirmation,
    reject: /cTrader disconnect asks first/,
  }));

function authorizeHarness() {
  return {
    options: {
      api: {
        getBrokerStatus: offlineStatus(),
        ctraderConnectUrl: () => OAUTH_PROBE_URL,
        startCtraderService: ctraderStartedAnswer(),
      },
      url: WORKSPACE_URL,
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
      navigation: true,
    },
  };
}

test("MUT authorizeAlsoRequests: Authorize may not smuggle a request alongside the navigation", () =>
  assertMutationDetected({
    name: "authorizeAlsoRequests",
    build: authorizeHarness,
    scenario: scenarioCtraderAuthorizeNavigates,
    reject: /starting OAuth is a navigation, not a request the page makes itself/,
  }));

function returnNoticeHarness() {
  return {
    options: {
      api: { getBrokerStatus: offlineStatus() },
      url: "http://localhost/settings?ctrader=connected",
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]) },
    },
  };
}

test("MUT oauthReturnClaimsConnected: a return may not overwrite what the aggregate says", () =>
  assertMutationDetected({
    name: "oauthReturnClaimsConnected",
    build: returnNoticeHarness,
    scenario: (ctx) => scenarioReturnNotice(ctx, CT_RETURN_CONNECTED_COPY),
    reject: /after the authorization tab returned/,
  }));

// The same fixture as the unconfirmed-switch scenario, held in a function so the
// probe runs the page over nothing but the line it moved. The answer reports an
// account and no `activeAccountId`, and `getCtraderStatus` is left unconfigured on
// purpose: a mutant that believed the switch had happened would ask for a session
// and be stopped by the fake rather than reaching the notice.
function unconfirmedNoticeHarness() {
  return {
    options: {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        selectCtraderAccount: {
          ...ctraderSelectAnswer({ accountId: CT_OTHER_ACCOUNT_ID }),
          activeAccountId: undefined,
        },
      },
      url: WORKSPACE_URL,
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([
          storedCtraderRecord(),
          storedSecondCtraderAccount(),
        ]),
      },
    },
  };
}

// The clear lives inside `commitAccountChange`, past the confirmation guard and
// past the write, so a switch the service did not confirm cannot reach it. Moving
// it to the head of the switch handler answers the instruction from a request that
// changed nothing - and under that mutant every other assertion in the scenario
// still holds, so the failure can only be the notice leaving the screen.
test("MUT noticeClearedBeforeConfirmation: a switch may not end the instruction before it is confirmed", () =>
  assertMutationDetected({
    name: "noticeClearedBeforeConfirmation",
    build: unconfirmedNoticeHarness,
    scenario: scenarioOauthNoticeSurvivesUnconfirmedSwitch,
    reject: /so the instruction the switch did not satisfy is still there to be satisfied/,
  }));

// ============================================================
// 11. CTRADER CONNECTION WIZARD
// ============================================================
//
// The wizard is a second road to workflows this page already owns, so these
// scenarios exist to prove three things about it:
//
//   1. it opens only when the user asks, and opening it stores nothing and asks
//      the backend for nothing the page was not already going to ask;
//   2. the only record it writes is the resume envelope, and everything that
//      envelope is able to say is where the user was standing - never that an
//      authorization succeeded, and never a token;
//   3. its final confirmation is the page's own validated session, reached
//      through the same select-then-read-back path the account rows use, so the
//      wizard cannot claim a connection the session panel would refuse to show.
//
// WHAT THIS CANNOT PROVE: the round trip. jsdom records the navigation instead
// of performing it, so every resumed scenario is handed the envelope a real
// return would have left behind, and the URL the return would have carried is
// supplied by the scenario's own api fake. That is the honest seam: the wizard's
// resume is tested against the record, not against a fabricated service session.

const WIZARD_URL = "http://localhost/settings";
const WIZARD_RETURN_URL = "http://localhost/settings?ctrader=connected";

// Written by the page's own serializer, so these scenarios test the resume path
// rather than a shape this file invented. ageMs is how long ago the hand-off
// happened, which is what the TTL is measured against.
function wizardEnvelope({
  brokerName = "Spotware",
  screen = "pending",
  accountId = null,
  ageMs = 0,
} = {}) {
  return serializeWizardEnvelope({
    screen,
    brokerName,
    accountId,
    savedAt: Date.now() - ageMs,
  });
}

function wizardStorage({
  envelope = null,
  accounts = [storedCtraderRecord()],
} = {}) {
  const storage = { [ACCOUNTS_KEY]: migratedStorage(accounts) };

  if (envelope !== null) {
    storage[WIZARD_STORAGE_KEY] = envelope;
  }

  return storage;
}

// The two api sets the wizard scenarios need, named for what they are: the
// service that answers, and the service that refuses.
function wizardConnectedApi({ answer = ctraderSelectAnswer() } = {}) {
  return {
    getBrokerStatus: liveCtraderStatus(),
    getCtraderStatus: ctraderServiceResponse(),
    selectCtraderAccount: answer,
  };
}

function wizardAuthorizeApi({ connectUrl = OAUTH_PROBE_URL } = {}) {
  return {
    getBrokerStatus: offlineStatus(),
    ctraderConnectUrl: () => connectUrl,
  };
}

async function openWizard(ctx) {
  await ctx.clickAction("connect-existing");
}

async function clickWizard(ctx, attribute) {
  const node = ctx.find(`[${attribute}]`);

  assert.ok(node, `an open wizard must render a [${attribute}] control`);

  await ctx.click(node);

  return node;
}

async function typeWizardQuery(ctx, value) {
  await ctx.setValue("[data-wizard-query]", value);
}

// The dialog's own words. Scoped to the dialog on purpose: the wizard and the
// page around it are allowed to say different things about the same session, so a
// claim is only evidence when the test knows which of the two made it.
function dialogText(ctx) {
  const dialog = ctx.find("[data-wizard-overlay]");

  assert.ok(dialog, "the wizard dialog must be open to read its copy");

  return dialog.textContent.replace(/\s+/g, " ").trim();
}

function stepperStates(ctx) {
  return ctx
    .findAll("[data-stepper-item]")
    .map((item) => item.getAttribute("data-stepper-state"));
}

async function walkToMethod(ctx, query = "Spotware") {
  await openWizard(ctx);
  await typeWizardQuery(ctx, query);
  await clickWizard(ctx, "data-wizard-continue");
}

async function walkToIntro(ctx, query = "Spotware") {
  await walkToMethod(ctx, query);
  await clickWizard(ctx, "data-wizard-continue");
}

// The screens after a hand-off can only be entered by a resumed wizard, because
// nothing in this model may move from the introduction on its own.
async function walkToChoices(ctx) {
  await clickWizard(ctx, "data-wizard-continue");
}

async function scenarioWizardOpensOnlyFromTheControl(ctx) {
  assertAbsent(
    ctx,
    "[data-wizard-overlay]",
    "the wizard is not on screen until the user asks for it",
  );

  await openWizard(ctx);

  const dialog = ctx.find("[data-wizard-overlay]");

  assert.ok(dialog, "the connect-existing control opens the wizard");
  assert.equal(
    dialog.getAttribute("role"),
    "dialog",
    "and it opens as a dialog, not as a section of the page the user must scroll to",
  );
  assert.equal(
    dialog.getAttribute("aria-label"),
    "cTrader connection wizard",
    "named for what it does",
  );

  assert.deepEqual(
    stepperStates(ctx),
    ["current", "upcoming", "upcoming", "upcoming"],
    "the rail opens on step one",
  );

  // The wizard is a road, not a new engine: walking it must not become a reason
  // to read a broker the page was not already reading.
  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "opening the wizard asks the backend for nothing beyond the page's own status read",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and opening it stores nothing, because nothing has happened yet",
  );

  assert.ok(
    ctx.find("[data-broker-empty]"),
    "the page the wizard covers is still the same page",
  );
}

test("the wizard opens only from its own control and asks for nothing", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage(),
      url: WIZARD_URL,
    },
    scenarioWizardOpensOnlyFromTheControl,
  );
});

async function scenarioWizardSearchIsTheUsersOwnListNotAWhitelist(ctx) {
  await openWizard(ctx);

  await typeWizardQuery(ctx, "  ");

  assert.ok(
    ctx.find("[data-search-hint]"),
    "an empty query explains what the list is made of instead of showing a fake directory",
  );

  assert.equal(
    ctx.findAll("[data-saved-match]").length,
    0,
    "and it lists nothing, because there is no broker catalogue to list from",
  );

  await typeWizardQuery(ctx, "northstar broker");

  assert.ok(
    ctx.find("[data-search-no-match]"),
    "a name this device never recorded is reported as no match",
  );

  assert.equal(
    ctx.find("[data-wizard-continue]").disabled,
    false,
    "but a name that matches nothing is still a name the user may carry forward - the saved list is evidence, not an allowlist",
  );

  await typeWizardQuery(ctx, "cTrader");

  const [match] = ctx.findAll("[data-saved-match]");

  assert.ok(match, "a name this device did record is offered back");
  assert.equal(
    match.textContent.replace(/\s+/g, " ").includes(CT_TRADING_ACCOUNT_ID),
    true,
    "the offer names the account the record actually holds",
  );

  await ctx.click(match);

  assert.equal(
    ctx.find("[data-wizard-query]").value,
    "cTrader 395823",
    "picking it puts the saved name in the field rather than inventing one",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "searching the user's own records is local: no broker was asked for anything",
  );

  assert.equal(ctx.storageWrites.length, 0, "and nothing was stored along the way");
}

test("the wizard searches the accounts this device recorded, without treating them as a whitelist", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage(),
      url: WIZARD_URL,
    },
    scenarioWizardSearchIsTheUsersOwnListNotAWhitelist,
  );
});

async function scenarioWizardSuggestionCarriesTheNameForward(ctx) {
  await openWizard(ctx);

  await typeWizardQuery(ctx, "ic");

  const suggestions = ctx.findAll("[data-broker-suggestion]");

  assert.equal(suggestions.length, 1, "a cTrader name typed toward must be selectable");
  assert.equal(
    suggestions[0].getAttribute("data-broker-suggestion"),
    "IC Markets",
    "and selectable by its broker name",
  );
  assert.equal(
    ctx.findAll("[data-saved-match]").length,
    0,
    "a suggestion is not a saved account, so no account may be offered with it",
  );

  await ctx.click(suggestions[0]);

  assert.equal(
    ctx.find("[data-wizard-query]").value,
    "IC Markets",
    "picking the suggestion puts the name in the field, the same as typing it",
  );
  assert.equal(
    ctx.find("[data-wizard-continue]").disabled,
    false,
    "and naming the broker is what unblocks the step",
  );

  await clickWizard(ctx, "data-wizard-continue");

  assert.match(
    dialogText(ctx),
    /Connection method for IC Markets/,
    "the method step carries the chosen name",
  );
  assert.equal(
    ctx.findAll("[data-method-card]")[0].getAttribute("data-method-card"),
    "ctrader",
    "with the one cTrader method the wizard already offered, unchanged",
  );

  await clickWizard(ctx, "data-wizard-continue");

  assert.match(
    dialogText(ctx),
    /IC Markets/,
    "and the introduction names the same broker before the hand-off",
  );

  assert.ok(
    !dialogText(ctx).includes("IC Trading"),
    "and the retired spelling is nowhere in the step the user is looking at",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "choosing a suggested name asks the backend for nothing beyond the page's own read",
  );
  assert.equal(
    ctx.storageWrites.length,
    0,
    "and stores nothing, because no account was picked and no connection happened",
  );
}

test("a suggested IC Markets name continues through the existing cTrader flow", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage(),
      url: WIZARD_URL,
    },
    scenarioWizardSuggestionCarriesTheNameForward,
  );
});

async function scenarioWizardWalksAndRemembers(ctx) {
  await walkToMethod(ctx, "Spotware");

  assert.match(
    dialogText(ctx),
    /Connection method for Spotware/,
    "the method step carries the name the user typed",
  );

  const cards = ctx.findAll("[data-method-card]");

  assert.equal(cards.length, 1, "one method, because one method exists");
  assert.equal(
    cards[0].getAttribute("data-method-card"),
    "ctrader",
    "and it is the cTrader authorization",
  );

  const withoutSpacing = dialogText(ctx);

  assert.equal(
    /Meta\s*Trader|MT\s*5/i.test(withoutSpacing),
    false,
    "the wizard is cTrader only; an MT5 option anywhere in it is the bug this asserts against",
  );

  await clickWizard(ctx, "data-search-again");

  assert.ok(
    ctx.find("[data-wizard-query]"),
    "choosing to search again returns to the search step",
  );
  assert.equal(
    ctx.find("[data-wizard-query]").value,
    "Spotware",
    "and the name typed is not lost on the way back",
  );
  assert.deepEqual(
    stepperStates(ctx),
    ["current", "upcoming", "upcoming", "upcoming"],
    "the rail moves back with the user",
  );

  await clickWizard(ctx, "data-wizard-continue");
  await clickWizard(ctx, "data-wizard-continue");

  assert.ok(
    ctx.find("[data-intro-points]"),
    "the introduction explains the round trip before it starts",
  );
  assert.match(
    dialogText(ctx),
    /does not connect an account on its own/,
    "and says out loud that approving access is not yet a connection",
  );

  assert.deepEqual(
    stepperStates(ctx),
    ["completed", "completed", "current", "upcoming"],
    "the introduction is still step three of four",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "walking the wizard to the edge of the authorization asks the backend for nothing but the page's own status read",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and stores nothing, because the hand-off has not been started",
  );
}

test("the wizard walks search to method to introduction without losing the name", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage(),
      url: WIZARD_URL,
    },
    scenarioWizardWalksAndRemembers,
  );
});

async function scenarioWizardBlocksAStepWithNothingToContinueFrom(ctx) {
  await openWizard(ctx);

  assert.equal(
    ctx.find("[data-wizard-continue]").disabled,
    true,
    "a search step with no broker named cannot be advanced",
  );

  assert.match(
    ctx.find("[data-block-reason]").textContent,
    /Enter the broker name/,
    "and the reason is shown rather than the button merely being dead",
  );

  await clickWizard(ctx, "data-wizard-continue");

  assert.ok(
    ctx.find("[data-wizard-query]"),
    "pressing the disabled control changes no step",
  );

  await typeWizardQuery(ctx, "Spotware");

  assert.equal(
    ctx.find("[data-wizard-continue]").disabled,
    false,
    "naming a broker is what unblocks the step",
  );

  assertAbsent(
    ctx,
    "[data-block-reason]",
    "and the reason goes away with the block",
  );

  assert.equal(ctx.storageWrites.length, 0, "a blocked step stores nothing");
}

test("the wizard refuses to advance a step it has nothing to advance from", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage(),
      url: WIZARD_URL,
    },
    scenarioWizardBlocksAStepWithNothingToContinueFrom,
  );
});

async function scenarioWizardAuthorizeWritesOneEnvelopeAndLeaves(ctx) {
  await walkToIntro(ctx, "Spotware");

  const beforeClick = Date.now();

  await clickWizard(ctx, "data-wizard-continue");

  assert.deepEqual(
    ctx.navigations,
    [{ to: OAUTH_PROBE_URL, how: "href" }],
    "the wizard hands the browser to exactly the URL ctraderConnectUrl() returned, the same single hand-off the card uses",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "ctraderConnectUrl"],
    "starting OAuth is a navigation; the wizard adds no request of its own",
  );

  assert.equal(
    ctx.storageWrites.length,
    1,
    "leaving for the authorization writes one record and nothing else",
  );

  const [write] = ctx.storageWrites;

  assert.equal(write.type, "set", "which is a write, not a deletion");
  assert.equal(
    write.key,
    WIZARD_STORAGE_KEY,
    "under the wizard's own key, so it cannot disturb the account list",
  );

  const envelope = JSON.parse(write.value);

  assert.deepEqual(
    Object.keys(envelope).sort(),
    ["accountId", "brokerName", "savedAt", "screen", "v"],
    "the record holds the five fields the model allows and nothing else",
  );
  assert.equal(envelope.v, ENVELOPE_VERSION, "at the version the reader expects");
  assert.equal(
    envelope.screen,
    "pending",
    "it records that a round trip was started, which is the only thing the page knows",
  );
  assert.equal(envelope.brokerName, "Spotware", "and the name the user typed");
  assert.equal(
    envelope.accountId,
    null,
    "no account may be recorded as chosen before the service has answered one",
  );
  assert.equal(
    Number.isFinite(envelope.savedAt) &&
      envelope.savedAt >= beforeClick &&
      envelope.savedAt <= beforeClick + 60_000,
    true,
    "stamped when the hand-off started, so the TTL measures the trip",
  );

  assert.equal(
    write.value.includes(SECRET),
    false,
    "and it carries no token, because a resume record describes a step",
  );

  assert.equal(
    deserializeWizardEnvelope(write.value, { now: Date.now() }).ok,
    true,
    "what the page wrote is exactly what the page can read back",
  );
}

test("the wizard writes one resume envelope as it hands the browser to cTrader", async () => {
  await withPage(
    {
      api: wizardAuthorizeApi(),
      storage: wizardStorage(),
      url: WIZARD_URL,
      navigation: true,
    },
    scenarioWizardAuthorizeWritesOneEnvelopeAndLeaves,
  );
});

async function scenarioWizardBlockedAuthorizeWritesNoEnvelope(ctx) {
  await walkToIntro(ctx, "Spotware");

  await clickWizard(ctx, "data-wizard-continue");

  assert.deepEqual(
    ctx.navigations,
    [],
    "with no backend configured the browser goes nowhere",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and a hand-off that never started must not leave a resume record behind - that record would claim a trip was in progress",
  );

  assert.equal(
    ctx.stored(WIZARD_STORAGE_KEY),
    null,
    "so there is nothing to resume from",
  );

  assert.match(
    ctx.find("[data-wizard-error]").textContent,
    /not configured in this build/,
    "the user reads the transport's own sentence inside the dialog that tried",
  );
}

test("a wizard authorize blocked by an unconfigured backend leaves no resume record", async () => {
  await withPage(
    {
      api: wizardAuthorizeApi({ connectUrl: null }),
      storage: wizardStorage(),
      url: WIZARD_URL,
      navigation: true,
    },
    scenarioWizardBlockedAuthorizeWritesNoEnvelope,
  );
});

async function scenarioWizardResumesFromItsOwnRecord(ctx, { expectNotice }) {
  const dialog = ctx.find("[data-wizard-overlay]");

  assert.ok(
    dialog,
    "a page that finds a fresh resume record reopens the wizard where the user stood",
  );

  assert.match(
    dialogText(ctx),
    /is not a connection yet/,
    "and the first thing the resumed wizard says is what the return is not",
  );

  assert.deepEqual(
    stepperStates(ctx),
    ["completed", "completed", "current", "upcoming"],
    "resumed at step three, the step the record says was in progress",
  );

  assert.equal(
    ctx.stored(WIZARD_STORAGE_KEY),
    null,
    "the record is read once: a reload must not keep reopening a round trip that already finished",
  );

  assert.deepEqual(
    ctx.storageWrites,
    [{ type: "remove", key: WIZARD_STORAGE_KEY }],
    "and consuming it is the only write the resume performs",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "resuming asks the backend for nothing beyond the page's own status read",
  );

  assert.equal(
    ctx.globalSelection.length,
    0,
    "and it moves the journal selection for nobody",
  );

  if (expectNotice) {
    assert.ok(
      ctx.find("[data-oauth-notice]"),
      "the page still says what came back, in its own words",
    );

    assertConnectionState(
      ctx,
      "disconnected",
      "Disconnected",
      "with the wizard resumed after the return",
    );
  }
}

test("a fresh resume envelope reopens the wizard at the pending step beside the return notice", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_RETURN_URL,
    },
    (ctx) => scenarioWizardResumesFromItsOwnRecord(ctx, { expectNotice: true }),
  );
});

test("the resume record stands on its own: a plain reload with a fresh record reopens the wizard", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_URL,
    },
    (ctx) => scenarioWizardResumesFromItsOwnRecord(ctx, { expectNotice: false }),
  );
});

async function scenarioWizardIgnoresAnUnusableRecord(ctx, raw) {
  assertAbsent(
    ctx,
    "[data-wizard-overlay]",
    "an unusable resume record does not put a dialog in the user's way",
  );

  assert.equal(
    ctx.stored(WIZARD_STORAGE_KEY),
    raw,
    "the page neither repairs nor deletes what it could not read",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and reading a record it rejected is not a reason to write anything",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "the page behaves exactly as it did before the wizard existed",
  );
}

test("an expired resume envelope is ignored, not resumed", async () => {
  const raw = wizardEnvelope({ ageMs: RESUME_TTL_MS + 60_000 });

  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage({ envelope: raw }),
      url: WIZARD_RETURN_URL,
    },
    (ctx) => scenarioWizardIgnoresAnUnusableRecord(ctx, raw),
  );
});

test("a resume record that is not the envelope format is ignored", async () => {
  const raw = "{ this is not an envelope";

  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage({ envelope: raw }),
      url: WIZARD_RETURN_URL,
    },
    (ctx) => scenarioWizardIgnoresAnUnusableRecord(ctx, raw),
  );
});

test("a resume record with fields bolted onto it resumes only the five it knows", async () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: Date.now(),
    accessToken: SECRET,
    note: "an account id the service never confirmed",
  });

  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage({ envelope: raw }),
      url: WIZARD_RETURN_URL,
    },
    async (ctx) => {
      assert.match(
        dialogText(ctx),
        /Arriving here after the Spotware authorization page/,
        "the five fields it recognises still describe the step",
      );

      assert.equal(
        ctx.html().includes(SECRET),
        false,
        "and the token bolted onto the record never reaches the screen",
      );

      assert.equal(
        ctx.html().includes("never confirmed"),
        false,
        "nor does prose the record invented for itself",
      );
    },
  );
});

async function scenarioWizardChoiceIsNotAResult(ctx) {
  await walkToChoices(ctx);

  const source = ctx.find("[data-account-source]");

  assert.ok(source, "the account step says where its list came from");
  assert.equal(
    source.getAttribute("data-account-source"),
    "live",
    "and says it live, because the aggregate reported it live",
  );

  assert.deepEqual(
    stepperStates(ctx),
    ["completed", "completed", "current", "upcoming"],
    "choosing an account is step three; the last step is not lit by arriving here",
  );

  assertAbsent(
    ctx,
    "[data-wizard-connected]",
    "the wizard may not confirm an account it has not read back from the service",
  );

  assert.ok(
    ctx.find('[data-verification="checking"]'),
    "it says the honest thing instead: nothing has been verified yet",
  );

  assert.equal(
    ctx.find("[data-connect-account]").disabled,
    true,
    "and Connect stays shut until the user picks one of the accounts listed",
  );

  await clickWizard(ctx, "data-account-choice");

  assert.equal(
    ctx.find("[data-account-choice]").getAttribute("aria-pressed"),
    "true",
    "the choice is registered",
  );

  assert.equal(
    ctx.find("[data-connect-account]").disabled,
    false,
    "which is what lets the workflow start",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "up to the click, choosing an account has asked the service for nothing",
  );
}

test("the wizard's account step offers a choice, not a result", async () => {
  await withPage(
    {
      api: wizardConnectedApi(),
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_RETURN_URL,
    },
    scenarioWizardChoiceIsNotAResult,
  );
});

// Cancelling the choice is not selecting an account. The dialog's own close
// control ends the round trip with no switch and no service start, so the step
// the return instruction asked for has still not happened and the instruction
// has to stay where the user can still act on it.
async function scenarioWizardCancelKeepsTheReturnInstruction(ctx) {
  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "the instruction is on screen while the wizard is open",
  );

  await walkToChoices(ctx);

  assert.ok(
    ctx.findAll("[data-account-choice]").length > 0,
    "the wizard is at the list of accounts, so a choice is still ahead",
  );

  await clickWizard(ctx, "data-wizard-close");

  assertAbsent(ctx, "[data-wizard-overlay]", "the close control closed the dialog");

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "and the cancelled choice asked the service for nothing - no switch, no start",
  );
  assert.equal(ctx.globalSelection.length, 0, "moved no selection");
  assert.equal(
    ctx.storageWrites.some((write) => write.key === ACCOUNTS_KEY),
    false,
    "and wrote no account",
  );

  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "so there is no validated session for the page to report",
  );

  assertRenderedText(
    ctx,
    "[data-oauth-notice]",
    CT_RETURN_CONNECTED_COPY,
    "and the instruction the cancelled flow did not satisfy is still on screen",
  );
}

test("cancelling the wizard's account choice keeps the OAuth return instruction", async () => {
  await withPage(
    {
      api: wizardConnectedApi(),
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_RETURN_URL,
    },
    scenarioWizardCancelKeepsTheReturnInstruction,
  );
});

async function scenarioWizardConnectsThroughThePageOwnWorkflow(ctx) {
  await walkToChoices(ctx);
  await clickWizard(ctx, "data-account-choice");
  await clickWizard(ctx, "data-connect-account");

  assert.deepEqual(
    ctx.argsFor("selectCtraderAccount"),
    [[CT_TRADING_ACCOUNT_ID]],
    "the wizard asks the service to switch to the account the user chose, by its external id",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount", "getBrokerStatus", "getCtraderStatus"],
    "and then reads the session back, in the order the account rows already use",
  );

  assert.deepEqual(
    stepperStates(ctx),
    ["completed", "completed", "completed", "current"],
    "the last step lights only now, on a session the validator accepted",
  );

  const confirmation = ctx.find("[data-wizard-connected]");

  assert.ok(confirmation, "the confirmation is the validated session, shown in words");
  assert.match(
    confirmation.textContent.replace(/\s+/g, " "),
    new RegExp(`Account ${CT_TRADING_ACCOUNT_ID}`),
    "and it names the account that was chosen, which is the only id the session carries",
  );

  assert.ok(
    ctx.find("[data-verified-stamp]"),
    "with the stamp of the validation that made it claimable",
  );

  assertAbsent(
    ctx,
    "[data-account-choice]",
    "the choice list is gone once the account is settled, so the screen offers no action that stopped meaning anything",
  );

  assert.equal(
    ctx.find("[data-wizard-done]") !== null,
    true,
    "and the primary control has become Done",
  );

  assert.deepEqual(
    ctx.globalSelection,
    ["ctrader-395823"],
    "the connection moves the journal selection exactly as the row click did",
  );

  const [detail] = ctx.detailsFor("ctraderAccountUpdated");

  assert.equal(
    detail?.id,
    "ctrader-395823",
    "and announces the merged record to the contexts that own the data",
  );

  assert.equal(
    ctx.find(`button[data-row-key="${CT_ROW}"]`) === null ||
      ctx.find(`button[data-row-key="${CT_ROW}"]`).getAttribute("aria-pressed") === "true",
    true,
    "the page behind the dialog agrees about which account is in use",
  );

  assert.deepEqual(
    ctx.storageWrites.map((write) => [write.type, write.key]),
    [
      ["remove", WIZARD_STORAGE_KEY],
      ["set", CTRADER_BROKER_LABEL_KEY],
      ["set", ACCOUNTS_KEY],
    ],
    "it consumed its resume record, recorded the name the user chose for the account it " +
      "just switched to, stored that account, and touched nothing else",
  );

  assert.equal(
    ctx.html().includes(SECRET),
    false,
    "and no token from the switch or the session read is on the screen",
  );

  assert.equal(
    (ctx.stored(ACCOUNTS_KEY) ?? "").includes(SECRET),
    false,
    "or in what was stored",
  );
}

test("the wizard connects an account through the page's own select-and-read workflow", async () => {
  await withPage(
    {
      api: wizardConnectedApi(),
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_RETURN_URL,
    },
    scenarioWizardConnectsThroughThePageOwnWorkflow,
  );
});

async function scenarioWizardRefusedSwitchConnectsNothing(ctx) {
  await walkToChoices(ctx);
  await clickWizard(ctx, "data-account-choice");

  const accountsBefore = ctx.stored(ACCOUNTS_KEY);

  await clickWizard(ctx, "data-connect-account");

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount"],
    "a switch the service refused is not followed by a session read",
  );

  assertAbsent(
    ctx,
    "[data-wizard-connected]",
    "and it certainly does not produce a confirmation",
  );

  assert.ok(
    ctx.find('[data-verification="error"]'),
    "the step reports the refusal as a step that did not complete",
  );

  assert.match(
    ctx.find("[data-wizard-error]").textContent,
    /cTrader account selection failed/,
    "quoting the transport's own words rather than paraphrasing them into success",
  );

  assert.ok(
    ctx.find("[data-wizard-retry]"),
    "and offers the same step again",
  );

  assert.deepEqual(
    ctx.globalSelection,
    [],
    "a refused switch moves nobody's selection",
  );

  assert.deepEqual(
    ctx.detailsFor("ctraderAccountUpdated"),
    [],
    "announces nothing",
  );

  assert.equal(
    ctx.stored(ACCOUNTS_KEY),
    accountsBefore,
    "and leaves the account list exactly as it found it",
  );

  assert.deepEqual(
    ctx.storageWrites.map((write) => [write.type, write.key]),
    [["remove", WIZARD_STORAGE_KEY]],
    "the resume record is the only thing it had already consumed",
  );
}

test("a cTrader switch refused by the service leaves the wizard with nothing connected", async () => {
  await withPage(
    {
      api: wizardConnectedApi({
        answer: new Error("cTrader account selection failed with HTTP 500."),
      }),
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_RETURN_URL,
    },
    scenarioWizardRefusedSwitchConnectsNothing,
  );
});

async function scenarioWizardUnverifiedSessionIsNeverConnected(ctx) {
  await walkToChoices(ctx);
  await clickWizard(ctx, "data-account-choice");
  await clickWizard(ctx, "data-connect-account");

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus", "selectCtraderAccount", "getBrokerStatus", "getCtraderStatus"],
    "the read did run; what failed was attributing it",
  );

  assertAbsent(
    ctx,
    "[data-wizard-connected]",
    "and a session the validator refused never becomes the wizard's confirmation",
  );

  assert.deepEqual(
    stepperStates(ctx),
    ["completed", "completed", "current", "upcoming"],
    "nor does it light the final step",
  );

  assert.ok(
    ctx.find('[data-verification="unavailable"]'),
    "the screen says the account could not be verified",
  );

  assert.match(
    dialogText(ctx),
    /will not call it connected/,
    "and says it in those words",
  );

  assert.ok(
    ctx.findAll("[data-account-choice]").length > 0,
    "the list stays, because picking another account is still the way forward",
  );

  assert.equal(
    ctx.html().includes(SECRET),
    false,
    "and the token the mismatched answer carried is nowhere on the screen",
  );
}

test("a session the validator refuses is reported as unverified, never as connected", async () => {
  await withPage(
    {
      api: {
        ...wizardConnectedApi(),
        getCtraderStatus: ctraderServiceResponse({ tradingAccountId: "999999" }),
      },
      storage: wizardStorage({ envelope: wizardEnvelope() }),
      url: WIZARD_RETURN_URL,
    },
    scenarioWizardUnverifiedSessionIsNeverConnected,
  );
});

async function scenarioWizardClosesWithoutLeavingProgressBehind(ctx) {
  await openWizard(ctx);
  await typeWizardQuery(ctx, "Spotware");

  await clickWizard(ctx, "data-wizard-close");

  assertAbsent(
    ctx,
    "[data-wizard-overlay]",
    "the close control closes the dialog",
  );

  assert.equal(
    ctx.stored(WIZARD_STORAGE_KEY),
    null,
    "and closing a wizard that never left for cTrader leaves nothing to resume",
  );

  await openWizard(ctx);

  assert.equal(
    ctx.find("[data-wizard-query]").value,
    "",
    "so reopening it starts clean rather than resurrecting a name nobody finished with",
  );

  await ctx.act(async () => {
    ctx.window.document.dispatchEvent(
      new ctx.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    await ctx.drain();
  });

  assertAbsent(
    ctx,
    "[data-wizard-overlay]",
    "Escape closes it too, and means the same thing",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "opening, typing and closing the wizard asked the backend for nothing",
  );

  assert.equal(
    ctx.storageWrites.length,
    0,
    "and wrote nothing to this device",
  );

  assertOneEntryPoint(
    ctx,
    "the page underneath is still the working page it was before the wizard existed",
  );
}

test("closing the wizard discards its progress and leaves the page intact", async () => {
  await withPage(
    {
      api: { getBrokerStatus: offlineStatus() },
      storage: wizardStorage(),
      url: WIZARD_URL,
    },
    scenarioWizardClosesWithoutLeavingProgressBehind,
  );
});

// ----------------------------------------------------------
// The wiring, stated as source gates
// ----------------------------------------------------------
//
// The scenarios above prove the behaviour. These prove the two things a
// behaviour test cannot: that the page has no second copy of the wizard's rules,
// and that it has no second way to hand the browser to cTrader. Precedent for
// asserting an authored guard rather than a run one is
// src/lib/brokerAccountIdentityWiring.test.js; what is not claimed here is that
// any of these lines executed, which is exactly what the scenarios are for.

test("the page wires the wizard through the shared model instead of owning its own rules", () => {
  const source = readPage();

  assert.match(
    source,
    /from\s+["']\.\/broker-wizard\/BrokerWizardOverlay/,
    "the dialog must be the component this suite already renders, not a page-local copy",
  );

  const bindings = /import\s*\{([^}]*)\}\s*from\s*["']\.\.\/\.\.\/lib\/brokerWizardModel["']/.exec(
    source,
  );

  assert.ok(
    bindings,
    "every wizard rule must arrive as a named import of the pure model, so the page cannot recompute a step, a block or a verification locally",
  );

  const imported = bindings[1]
    .split(",")
    .map((entry) => entry.trim().split(/\s+as\s+/)[0])
    .filter(Boolean);

  for (const name of [
    "STORAGE_KEY",
    "accountChoices",
    "advanceBlock",
    "authorizeEnvelope",
    "createInitialState",
    "currentStep",
    "deserialize",
    "reduce",
    "searchSavedAccounts",
    "serialize",
    "verificationState",
  ]) {
    assert.ok(
      imported.includes(name),
      `the page must import ${name} from brokerWizardModel; got ${imported.join(", ") || "nothing"}`,
    );
  }

  assert.equal(
    source.includes(`"${WIZARD_STORAGE_KEY}"`),
    false,
    "the resume record must be named by the model, so the writer and the reader cannot drift apart",
  );
});

test("the page hands the browser to cTrader in exactly one place", () => {
  const source = readPage();

  assert.equal(
    (source.match(/window\.location\.href\s*=/g) ?? []).length,
    1,
    "one hand-off, shared by the card and the wizard: a second assignment is a second OAuth path nobody guarded",
  );

  assert.match(
    source,
    /startCtraderAuthorization\(/,
    "the card's Connect and the wizard's Continue must reach the browser through one function",
  );

  assert.match(
    source,
    /data-action="connect-existing"/,
    "and the control that opens the wizard must be the page's own, with a hook the tests can press",
  );
});

// ============================================================
// THE cTRADER-ONLY PAGE
// ============================================================
//
// One broker is offered here. Until a session the validator accepted exists the
// page is a road to one: no card, no metric, no account row and no word about
// MT5. The status line stays on screen through all of it, because a page that
// hid its state would leave "nothing connected" indistinguishable from "still
// reading" - and the connected summary is a separate claim, made only when the
// page holds a session it attributed to the account the user selected.

const EMPTY_CTA = '[data-broker-empty] [data-action="connect-existing"]';

const BROKER_NAME_SOURCE_COPY = "Name you chose in the connection wizard.";

function assertConnectionState(ctx, status, label, note = "") {
  const suffix = note ? ` (${note})` : "";
  const node = ctx.find("[data-connection-state]");

  assert.ok(node, `the page must always state its connection status${suffix}`);
  assert.equal(
    node.getAttribute("data-connection-state"),
    status,
    `connection status${suffix}`,
  );
  assert.equal(node.textContent, label, `connection status word${suffix}`);
}

// MT5 is hidden, not deleted: nothing on this page may name it, offer a card for
// it or list one of its accounts.
function assertNoMt5Offered(ctx, message) {
  assert.equal(/MT5|MetaTrader/i.test(ctx.text()), false, message);
  assertAbsent(ctx, '[data-broker-card="mt5"]', message);
  assertAbsent(ctx, '[data-row-key^="mt5:"]', message);
}

function assertOneEntryPoint(ctx, message) {
  const controls = ctx.findAll('[data-action="connect-existing"]');

  assert.equal(controls.length, 1, message);
  assert.equal(controls[0].disabled, false, `${message}, and it must be pressable`);
  assert.equal(
    controls[0].textContent.includes("Connect existing account"),
    true,
    `${message}, labelled with the flow it opens`,
  );

  return controls[0];
}

function assertConnectedSummary(ctx, { brokerName, account = CT_TRADING_ACCOUNT_ID }) {
  const summary = ctx.find("[data-connected-broker]");

  assert.ok(summary, "a validated session must be reported as a connected broker");
  assert.equal(
    ctx.find("[data-connected-broker-name]").textContent,
    brokerName,
    "the broker line names the broker",
  );
  assert.equal(
    ctx.find("[data-connected-platform]").textContent,
    "cTrader",
    "the platform is the transport, never the name the user typed",
  );
  assert.equal(
    ctx.find("[data-connected-status]").textContent,
    "Connected",
    "and the status word is the one the validator earned",
  );
  assert.equal(
    ctx.find("[data-connected-account]").textContent,
    account,
    "the account is the live identity the backend authenticated",
  );
}

async function scenarioNothingConnectedEntryPoint(ctx) {
  assertConnectionState(ctx, "disconnected", "Disconnected", "both brokers are down");

  assertAbsent(ctx, "[data-broker-card]", "no broker card belongs on the initial screen");
  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "nothing is connected, so no connected broker may be named",
  );
  assertAbsent(
    ctx,
    '[data-prompt="broker"]',
    "there is no card to select, so the page may not ask the user to select one",
  );
  assertAbsent(ctx, "[data-row-key]", "no account row is offered before a connection");
  assertNoMetric(ctx, "no session means no metric");
  assertNoMt5Offered(ctx, "MT5 is not offered on this page");

  const entry = assertOneEntryPoint(
    ctx,
    "exactly one entry point, in the empty state rather than the header",
  );

  assert.ok(ctx.find(EMPTY_CTA), "and it sits in the panel that explains there is nothing here");

  await ctx.click(entry);

  assert.ok(
    ctx.find("[data-wizard-overlay]"),
    "the entry point opens the existing broker-selection flow",
  );
  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "opening that flow reads nothing beyond the page's own status read",
  );
  assert.deepEqual(ctx.storageWrites, [], "and stores nothing, because nothing happened yet");
}

test("with nothing connected the page offers one entry point and no broker card", async () => {
  await withPage(
    { api: { getBrokerStatus: offlineStatus() } },
    scenarioNothingConnectedEntryPoint,
  );
});

async function scenarioMt5IsNotOfferedHere(ctx) {
  assertNoMt5Offered(
    ctx,
    "a live terminal and a journal selection of its account still offer no MT5 here",
  );

  assert.deepEqual(
    ctx.names(),
    ["getBrokerStatus"],
    "hiding MT5 means not reading its positions or orders either",
  );
  assert.deepEqual(ctx.globalSelection, [], "and not rewriting the journal selection");
  assert.deepEqual(ctx.storageWrites, [], "the stored MT5 record is left exactly as it was");

  assertAbsent(ctx, "[data-broker-card]", "no card of either broker on the initial screen");
  assertAbsent(ctx, "[data-connected-broker]", "an MT5 terminal is not a connection this page claims");
  assertAbsent(ctx, "[data-row-key]", "no account row");
  assertNoMetric(ctx, "no metric");
  assert.ok(ctx.find(EMPTY_CTA), "the entry point is offered instead");
  assertConnectionState(ctx, "disconnected", "Disconnected", "the cTrader service is down");
}

test("MT5 is not offered here even when the terminal is live and selected", async () => {
  await withPage(
    {
      api: { getBrokerStatus: liveMt5Status(), ...mt5LiveApi },
      journal: { selectedAccountId: "mt5-1001" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedMt5Account()]) },
    },
    scenarioMt5IsNotOfferedHere,
  );
});

test("the MT5 modal, workflows and transport stay in the page while it offers none of them", () => {
  const source = readPage();

  for (const [pattern, message] of [
    [/from\s+["']\.\/MT5ConnectionModal["']/, "the existing MT5 modal"],
    [/getMt5Positions\(/, "the MT5 positions read"],
    [/getMt5Orders\(/, "the MT5 orders read"],
    [/disconnectMt5\(/, "the MT5 disconnect"],
    [/validateMt5Session\(/, "the MT5 session validator"],
    [/new CustomEvent\(\s*"mt5AccountUpdated"/, "the MT5 announcement"],
  ]) {
    assert.ok(pattern.test(source), `hiding MT5 must not delete ${message}`);
  }

  assert.equal(
    /BROKER_KEYS\.find\(\(key\) => params\.has\(key\)\)/.test(source),
    false,
    "a returning MT5 tab may not select a broker this page no longer offers",
  );
});

async function scenarioConnectedBrokerSummary(ctx) {
  assertConnectionState(ctx, "connected", "Connected", "the service authenticated a live account");

  assertConnectedSummary(ctx, { brokerName: "cTrader" });

  assertAbsent(
    ctx,
    "[data-broker-name-source]",
    "with no recorded choice there is nothing to attribute a name to",
  );
  assertAbsent(ctx, "[data-broker-empty]", "a connected page is not an empty one");
  assertOneEntryPoint(ctx, "the entry point moves to the header once there is a connection");

  assert.equal(
    ctx.findAll("[data-broker-card]").length,
    1,
    "exactly one card, for the broker that is connected",
  );
  assert.ok(ctx.find('[data-broker-card="ctrader"]'), "and it is the cTrader card");
  assertNoMt5Offered(ctx, "a connected cTrader page still offers no MT5");

  assertMetric(ctx, "balance", "USD 5,000", "the numbers beside the summary are the live ones");
  assert.deepEqual(ctx.storageWrites, [], "reading a connection stores nothing");
}

test("a validated cTrader session names the connected broker, platform and account", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: { [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]) },
    },
    scenarioConnectedBrokerSummary,
  );
});

async function scenarioRecordedBrokerName(ctx) {
  assertConnectedSummary(ctx, { brokerName: "IC Trading" });

  assert.equal(
    ctx.find("[data-broker-name-source]").textContent,
    BROKER_NAME_SOURCE_COPY,
    "the name is attributed to the user's choice, not passed off as a backend fact",
  );
  assert.equal(
    ctx.find("[data-connected-platform]").textContent,
    "cTrader",
    "the platform stays the platform whatever the broker was called",
  );
  assert.deepEqual(ctx.storageWrites, [], "reading the recorded name writes nothing back");
  assertNoMt5Offered(ctx, "and no MT5 appears beside it");
}

test("the broker name chosen in the wizard is the one the connected page shows", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]),
        [CTRADER_BROKER_LABEL_KEY]: "IC Trading",
      },
    },
    scenarioRecordedBrokerName,
  );
});

async function scenarioRefusedSessionIsNotConnected(ctx) {
  assertAbsent(
    ctx,
    "[data-connected-broker]",
    "a round the validator refused is not a connected broker",
  );
  assert.equal(
    ctx.text().includes("IC Trading"),
    false,
    "the recorded name may not be shown without a session to show it beside",
  );

  // The workspace stays open - the user still has to be able to switch accounts,
  // start the service or disconnect - but it says what the aggregate said, not
  // what the refused round would have liked to say.
  assertConnectionState(ctx, "connected", "Connected", "the aggregate's own word");

  assert.ok(ctx.cardButton("ctrader"), "the workspace keeps its header");

  assertOneEntryPoint(
    ctx,
    "the header still offers the way to connect another account",
  );

  assertMetric(ctx, "balance", UNAVAILABLE, "the refused round has no numbers");
  assert.equal(
    ctx.find("[data-validation-error]").textContent,
    "The cTrader service is authenticated against a different account than the live session identity, so its data cannot be attributed.",
    "the page says why, in the validator's own words",
  );
  assertNoMt5Offered(ctx, "and still offers no MT5");
}

test("a session the validator refuses is never shown as a connected broker", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse({ tradingAccountId: "999999" }),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderAccount()]),
        [CTRADER_BROKER_LABEL_KEY]: "IC Trading",
      },
    },
    scenarioRefusedSessionIsNotConnected,
  );
});

async function scenarioWizardRecordsTheChosenName(ctx) {
  await walkToChoices(ctx);
  await clickWizard(ctx, "data-account-choice");
  await clickWizard(ctx, "data-connect-account");

  assert.ok(ctx.find("[data-wizard-connected]"), "the switch produced a validated session");

  const labelWrites = ctx.storageWrites.filter(
    (write) => write.key === CTRADER_BROKER_LABEL_KEY,
  );

  assert.deepEqual(
    labelWrites,
    [{ type: "set", key: CTRADER_BROKER_LABEL_KEY, value: "IC Trading" }],
    "the name the user walked in with is recorded once, as a plain string and nothing else",
  );
  assert.equal(ctx.stored(CTRADER_BROKER_LABEL_KEY), "IC Trading", "and it is readable back");

  await clickWizard(ctx, "data-wizard-close");

  assertConnectedSummary(ctx, { brokerName: "IC Trading" });
  assert.equal(
    ctx.find("[data-broker-name-source]").textContent,
    BROKER_NAME_SOURCE_COPY,
    "the page behind the dialog attributes the name the same way",
  );
}

test("a successful wizard switch records the broker name the user chose", async () => {
  await withPage(
    {
      api: wizardConnectedApi(),
      storage: wizardStorage({
        envelope: wizardEnvelope({ brokerName: "IC Trading" }),
      }),
      url: WIZARD_RETURN_URL,
    },
    scenarioWizardRecordsTheChosenName,
  );
});

async function scenarioRefusedSwitchRecordsNoName(ctx) {
  await walkToChoices(ctx);
  await clickWizard(ctx, "data-account-choice");
  await clickWizard(ctx, "data-connect-account");

  assertAbsent(ctx, "[data-wizard-connected]", "the service refused the switch");
  assertAbsent(ctx, "[data-connected-broker]", "so nothing is connected");
  assert.equal(
    ctx.storageWrites.some((write) => write.key === CTRADER_BROKER_LABEL_KEY),
    false,
    "a switch that did not succeed records no broker name",
  );
  assert.equal(ctx.stored(CTRADER_BROKER_LABEL_KEY), null, "and stores none");
}

test("a wizard switch the service refused records no broker name", async () => {
  await withPage(
    {
      api: wizardConnectedApi({
        answer: new Error("cTrader account selection failed with HTTP 500."),
      }),
      storage: wizardStorage({
        envelope: wizardEnvelope({ brokerName: "IC Trading" }),
      }),
      url: WIZARD_RETURN_URL,
    },
    scenarioRefusedSwitchRecordsNoName,
  );
});

async function scenarioDisconnectClearsTheName(ctx) {
  assertConnectedSummary(ctx, { brokerName: "IC Trading" });

  await ctx.clickAction("disconnect");
  await ctx.clickAction("confirm-disconnect");

  assert.deepEqual(
    ctx.storageWrites.filter((write) => write.key === CTRADER_BROKER_LABEL_KEY),
    [{ type: "remove", key: CTRADER_BROKER_LABEL_KEY }],
    "a disconnect ends the connection the name was chosen for",
  );
  assert.equal(ctx.stored(CTRADER_BROKER_LABEL_KEY), null, "so the record is gone");
  assertAbsent(ctx, "[data-connected-broker]", "and the page no longer claims a connected broker");
  assertOneEntryPoint(ctx, "it offers the way to connect again");
  assertMetric(ctx, "balance", UNAVAILABLE, "the ended session has no live balance");
  assert.equal(
    ctx.text().includes("USD 5,000"),
    false,
    "and none of the numbers it was showing survive the disconnect",
  );
}

test("disconnecting cTrader clears the recorded broker name", async () => {
  await withPage(
    {
      api: {
        getBrokerStatus: liveCtraderStatus(),
        getCtraderStatus: ctraderServiceResponse(),
        disconnectCtrader: ctraderDisconnectedAnswer(),
      },
      journal: { selectedAccountId: "ctrader-395823" },
      storage: {
        [ACCOUNTS_KEY]: migratedStorage([storedCtraderRecord()]),
        [CTRADER_BROKER_LABEL_KEY]: "IC Trading",
      },
    },
    scenarioDisconnectClearsTheName,
  );
});

