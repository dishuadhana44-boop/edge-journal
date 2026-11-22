import test from "node:test";
import assert from "node:assert/strict";

// ============================================================
// PHASE 3 BROKER INTEGRATION MODEL CONTRACT
// ============================================================
//
// This suite pins the pure view model that the Broker Integration workspace
// renders from. Every fixture is copied from the keys the production backend
// actually serialises, because a model wired to an invented key would pass
// here and show "Unavailable" forever in the browser:
//
//   server/brokers/registry.js:188-194   -> { success, contractVersion,
//                                             observedAt, identityConflicts,
//                                             brokers: { mt5, ctrader } }
//   server/brokers/mt5Adapter.js:160-206 -> connection.state, account block
//                                             keys, identity.externalId
//   server/brokers/ctraderAdapter.js:145-209, 248-299
//                                        -> accounts.activeAccount
//                                           .activeAccountSource, transport,
//                                           identity.externalId
//   server/services/ctraderService.js:3217-3274
//                                        -> service.tradingAccountId,
//                                           service.account, service.openPositions
//   mt5-bridge/app.py:3240-3268, 4673-4686 via server/routes/mt5.js:370-386,
//   1642-1658                            -> positions[] / orders[] envelopes
//
// WHAT THIS CANNOT PROVE: that the backend returns these shapes today, that a
// component renders them, or that a live broker session behaves as modelled.
// Those need the component suites plus a real terminal.

const MT5_LOGIN = "1001";
const MT5_SERVER = "documents-4";
const CT_TRADING_ACCOUNT_ID = "395823";
const CT_TRADER_LOGIN = "556677";
const OBSERVED_AT = "2026-11-05T10:00:00.000Z";
const SYNCED_AT = "2026-11-05T10:00:05.000Z";

const EXPORT_NAMES = [
  "UI_STATUS",
  "createEmptySession",
  "mapBrokerUiStatus",
  "buildAccountRows",
  "mergeBrokerAccount",
  "createRequestGuard",
  "validateMt5Session",
  "validateCtraderSession",
  "formatMetric",
];

async function loadModel() {
  try {
    return await import("./brokerIntegrationModel.js");
  } catch (error) {
    assert.fail(
      `brokerIntegrationModel must export the Phase 3 view contract: ${error.message}`
    );
  }
}

// ============================================================
// AGGREGATE (GET /api/brokers/status) FIXTURES
// ============================================================

function mt5Connection({
  state = "connected",
  connected = state === "connected",
  serviceReachable = state !== "unreachable",
  reason = null,
} = {}) {
  return {
    state,
    connected,
    serviceReachable,
    observedAt: OBSERVED_AT,
    sourceTimestamp: OBSERVED_AT,
    reason,
  };
}

function mt5AccountBlock({
  login = MT5_LOGIN,
  server = MT5_SERVER,
  currency = "USD",
  balance = 10000.5,
  equity = 10050.25,
  margin = 200,
  freeMargin = 9850.25,
  leverage = 100,
  floatingPnL = 49.75,
} = {}) {
  return {
    login,
    server,
    name: "Demo broker",
    currency,
    balance,
    equity,
    margin,
    freeMargin,
    leverage,
    floatingPnL,
  };
}

function mt5IdentityBlock({ login = MT5_LOGIN, server = MT5_SERVER } = {}) {
  const connected = Boolean(login);

  return {
    broker: "mt5",
    externalId: login,
    server,
    traderLogin: null,
    requestedAccountId: null,
    matchesRequestedAccount: false,
    key: connected ? `mt5:${login}` : null,
    source: connected ? "bridge GET /mt5/status account.login" : null,
    note: connected
      ? null
      : "The MT5 terminal is not logged in, so no MT5 account is identified.",
  };
}

function mt5Broker({ connection, account, identity } = {}) {
  const resolvedAccount = account === undefined ? mt5AccountBlock() : account;

  return {
    id: "mt5",
    displayName: "MetaTrader 5",
    connection: connection ?? mt5Connection(),
    session: {
      scope: "global_terminal_session",
      accountScoped: false,
      identity: {
        login: resolvedAccount?.login ?? null,
        server: resolvedAccount?.server ?? null,
      },
      magic: 234567,
      limitations: [],
    },
    account: resolvedAccount,
    identity: identity ?? mt5IdentityBlock(),
    accounts: {
      broker: "mt5",
      enumerable: false,
      source: "none",
      isLive: false,
      items: [],
      activeAccountId: null,
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

function ctraderBroker({
  running = true,
  connected = true,
  authenticated = true,
  ready = true,
  serviceAccountId = CT_TRADING_ACCOUNT_ID,
  requestedAccountId = CT_TRADING_ACCOUNT_ID,
  accountSource = "live",
  accountBlock,
} = {}) {
  const live = connected && authenticated && ready;

  // ctraderAdapter.js:232-235: an identity is only claimed when the service is
  // connected, authenticated AND ready.
  const authenticatedAccountId = live ? serviceAccountId : null;

  const state = live
    ? "connected"
    : connected
      ? "authenticating"
      : "disconnected";

  const liveItems = [
    {
      accountId: CT_TRADING_ACCOUNT_ID,
      traderLogin: CT_TRADER_LOGIN,
      isLive: true,
      lastLoginTime: "1762300000000",
      name: "Demo 395823",
      nameSource: "local_cache",
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
    },
  ];

  const items = accountSource === "live" ? liveItems : accountSource === "cache" ? cachedItems : [];

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
      running,
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
      note: "Token values are intentionally omitted.",
    },
    session: {
      scope: "process_singleton_socket",
      accountScoped: true,
      identity: { accountId: authenticatedAccountId },
      limitations: [],
    },
    account:
      accountBlock === undefined
        ? authenticatedAccountId
          ? {
              accountId: authenticatedAccountId,
              balance: 5000,
              equity: 5010.5,
              margin: 100,
              freeMargin: 4910.5,
              currency: "USD",
              leverage: "100",
              brokerName: "Demo broker",
              depositCurrency: null,
              source: "authenticated cTrader service",
            }
          : null
        : accountBlock,
    identity: {
      broker: "ctrader",
      externalId: authenticatedAccountId,
      server: null,
      traderLogin: authenticatedAccountId ? CT_TRADER_LOGIN : null,
      requestedAccountId: requestedAccountId,
      matchesRequestedAccount: Boolean(
        authenticatedAccountId &&
          requestedAccountId &&
          authenticatedAccountId === requestedAccountId
      ),
      key: authenticatedAccountId
        ? `ctrader:${authenticatedAccountId}`
        : null,
      source: authenticatedAccountId
        ? "authenticated and ready cTrader service session (GET_ACCOUNTS_RES tradingAccountId)"
        : "no authenticated and ready cTrader service session; the locally cached selection is not a live identity",
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
          requestedAccountId !== activeFromService
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
      activeAccount: active
        ? { ...active, activeAccountSource: accountSource }
        : null,
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
    lifecycle: { state: running ? "running" : "stopped", detail: null },
    errors: [],
  };
}

function statusPayload({ mt5, ctrader, success = true } = {}) {
  const brokers = {};

  if (mt5 !== undefined) {
    brokers.mt5 = mt5;
  }

  if (ctrader !== undefined) {
    brokers.ctrader = ctrader;
  }

  if (success === false) {
    return {
      success: false,
      message: "Unable to read broker status.",
      error: "boom",
    };
  }

  return {
    success: true,
    contractVersion: 1,
    observedAt: OBSERVED_AT,
    identityConflicts: [],
    brokers,
  };
}

// ============================================================
// MT5 COLLECTION FIXTURES
// ============================================================

function mt5Position({
  ticket = 4_400_001,
  login = MT5_LOGIN,
  server = MT5_SERVER,
  symbol = "EURUSD",
  type = "buy",
  volume = 0.1,
  profit = 20,
} = {}) {
  return {
    login,
    mt5Login: login,
    server,
    mt5Server: server,
    ticket,
    positionId: ticket,
    brokerPositionId: ticket,
    symbol,
    type,
    volume,
    price_open: 1.1,
    price_current: 1.1002,
    sl: null,
    tp: null,
    profit,
    swap: 0,
    commission: -0.5,
    time: 1762300000,
    time_msc: 1762300000000,
    broker_time_msc: 1762300000000,
    raw: {},
  };
}

function mt5PositionsResponse({
  success = true,
  login = MT5_LOGIN,
  server = MT5_SERVER,
  positions,
  includeArray = true,
} = {}) {
  const list = positions === undefined ? [mt5Position()] : positions;

  if (!success) {
    const body = {
      success: false,
      connected: false,
      count: 0,
      positions: [],
      message: "MT5 bridge unavailable.",
      error: "connect ECONNREFUSED 127.0.0.1:5001",
    };

    if (!includeArray) {
      delete body.positions;
    }

    return body;
  }

  const body = {
    success: true,
    connected: true,
    login,
    mt5Login: login,
    server,
    mt5Server: server,
    count: list.length,
    positions: list,
    broker_time_msc: 1762300000000,
    broker_time_source: "mt5",
  };

  if (!includeArray) {
    delete body.positions;
  }

  return body;
}

function mt5OrdersResponse({
  success = true,
  orders,
  includeArray = true,
} = {}) {
  const list = orders === undefined ? [] : orders;

  if (!success) {
    const body = {
      success: false,
      count: 0,
      orders: [],
      message: "MT5 bridge unavailable.",
      error: "connect ECONNREFUSED 127.0.0.1:5001",
    };

    if (!includeArray) {
      delete body.orders;
      delete body.count;
    }

    return body;
  }

  const body = {
    success: true,
    count: list.length,
    orders: list,
    pendingOrders: list,
  };

  if (!includeArray) {
    delete body.orders;
    delete body.pendingOrders;
  }

  return body;
}

function ctraderServiceResponse({
  tradingAccountId = CT_TRADING_ACCOUNT_ID,
  account,
  openPositions,
  includePositions = true,
} = {}) {
  const positions = openPositions === undefined ? [ctraderPosition()] : openPositions;

  const service = {
    running: true,
    connected: true,
    authenticated: true,
    ready: true,
    tradingAccountId,
    account: account === undefined ? ctraderServiceAccount() : account,
    symbol: "EURUSD",
    symbolId: "1",
    digits: 5,
    availableSymbols: 300,
    subscribedSymbols: ["EURUSD"],
    positionsCount: Array.isArray(positions) ? positions.length : 0,
    volumeSettings: { min: 0.01, max: 210, step: 0.01, lotSize: 1000000 },
  };

  if (includePositions) {
    service.openPositions = positions;
  }

  return {
    success: true,
    connected: true,
    hasAccessToken: true,
    hasRefreshToken: true,
    accounts: [],
    activeAccountId: CT_TRADING_ACCOUNT_ID,
    activeAccount: null,
    service,
  };
}

function ctraderServiceAccount({
  accountId = CT_TRADING_ACCOUNT_ID,
  balance = 5000,
  equity = 5010.5,
  margin = 100,
  freeMargin = 4910.5,
  currency = "USD",
  leverage = 100,
  brokerName = "Demo broker",
} = {}) {
  return {
    accountId,
    balance,
    equity,
    margin,
    freeMargin,
    currency,
    leverage,
    brokerName,
    selectedAccountId: accountId,
  };
}

function ctraderPosition({ positionId = 7001, symbol = "EURUSD", side = "buy" } = {}) {
  return {
    positionId,
    symbolId: "1",
    symbol,
    side,
    volume: 1000000,
    lots: 1,
    entryPrice: 1.1,
    stopLoss: null,
    takeProfit: null,
    commission: -0.5,
    swap: 0,
    usedMargin: 100,
    openTimestamp: 1762300000000,
    raw: {},
  };
}

// ============================================================
// STORED ACCOUNT FIXTURES
// ============================================================

function storedMt5Account({
  id = "mt5-1001",
  server = MT5_SERVER,
  externalId = MT5_LOGIN,
  ...rest
} = {}) {
  return {
    id,
    accountName: `MT5 Account ${externalId}`,
    broker: "MT5",
    brokerAccountId: externalId,
    mt5Server: server,
    currency: "USD",
    balance: 4321.11,
    startingBalance: 5000,
    ...rest,
  };
}

function storedCtraderAccount({
  id = "ctrader-395823",
  externalId = CT_TRADING_ACCOUNT_ID,
  ...rest
} = {}) {
  return {
    id,
    accountName: `cTrader ${externalId}`,
    broker: "cTrader",
    brokerAccountId: externalId,
    currency: "USD",
    balance: 1111.11,
    startingBalance: 2000,
    ...rest,
  };
}

function mt5SessionInput(overrides = {}) {
  return {
    accounts: [storedMt5Account()],
    selectedAccountId: "mt5-1001",
    aggregate: statusPayload({ mt5: mt5Broker() }),
    positionsResponse: mt5PositionsResponse(),
    ordersResponse: mt5OrdersResponse({ orders: [] }),
    postOrdersAggregate: statusPayload({ mt5: mt5Broker() }),
    synchronizedAt: SYNCED_AT,
    ...overrides,
  };
}

function ctraderSessionInput(overrides = {}) {
  return {
    accounts: [storedCtraderAccount()],
    selectedAccountId: "ctrader-395823",
    aggregate: statusPayload({ ctrader: ctraderBroker() }),
    serviceResponse: ctraderServiceResponse(),
    synchronizedAt: SYNCED_AT,
    ...overrides,
  };
}

// ============================================================
// EXPORTS
// ============================================================

test("every named model export exists", async () => {
  const model = await loadModel();

  for (const name of EXPORT_NAMES) {
    assert.ok(
      model[name] !== undefined && (typeof model[name] === "function" || typeof model[name] === "object"),
      `${name} must be exported`
    );
  }
});

test("UI_STATUS carries exactly the six contract values", async () => {
  const { UI_STATUS } = await loadModel();

  assert.deepEqual(UI_STATUS, {
    loading: "loading",
    connected: "connected",
    connecting: "connecting",
    disconnected: "disconnected",
    unreachable: "unreachable",
    error: "error",
  });
});

test("every status value has exactly one word, and the map covers no others", async () => {
  const { UI_STATUS, UI_STATUS_LABEL } = await loadModel();

  assert.deepEqual(
    Object.keys(UI_STATUS_LABEL).sort(),
    Object.keys(UI_STATUS).sort(),
    "a status the mapper can return with no word would render as nothing",
  );

  assert.deepEqual(UI_STATUS_LABEL, {
    loading: "Loading",
    connected: "Connected",
    connecting: "Connecting",
    disconnected: "Disconnected",
    unreachable: "Unreachable",
    error: "Error",
  });

  assert.equal(Object.isFrozen(UI_STATUS_LABEL), true, "the vocabulary is not a screen's to edit");
});

test("the recorded cTrader broker name has one key, named by the model", async () => {
  const { CTRADER_BROKER_LABEL_KEY } = await loadModel();

  assert.equal(typeof CTRADER_BROKER_LABEL_KEY, "string");
  assert.equal(
    CTRADER_BROKER_LABEL_KEY,
    "edgeflo_ctrader_broker_label",
    "the writer and the reader must reach the same record",
  );
  assert.equal(
    CTRADER_BROKER_LABEL_KEY === "tradingAccounts",
    false,
    "a chosen name is not an account record and may not share its key",
  );
});

// ============================================================
// mapBrokerUiStatus
// ============================================================

test("no status payload while the first request runs is loading", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  assert.equal(
    mapBrokerUiStatus({ snapshot: null, brokerKey: "mt5", loading: true }),
    UI_STATUS.loading
  );
});

test("a connected MT5 snapshot with an identity is connected", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ mt5: mt5Broker() }),
      brokerKey: "mt5",
    }),
    UI_STATUS.connected
  );
});

test("a connected MT5 snapshot with no identity is an error, not connected", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const mt5 = mt5Broker({
    connection: mt5Connection({ state: "connected" }),
    identity: mt5IdentityBlock({ login: null, server: null }),
  });

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ mt5 }),
      brokerKey: "mt5",
    }),
    UI_STATUS.error
  );
});

test("a connected cTrader snapshot with no identity is an error", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  // The aggregate says connected while its identity block refuses to name an
  // account: one of the two is lying, so the card must not claim connected.
  const ctrader = ctraderBroker({ accountSource: "none" });

  ctrader.connection.state = "connected";
  ctrader.connection.connected = true;
  ctrader.identity = {
    ...ctrader.identity,
    externalId: null,
    key: null,
  };

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ ctrader }),
      brokerKey: "ctrader",
    }),
    UI_STATUS.error
  );
});

test("a cTrader socket that is connected but not ready is connecting", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({
        ctrader: ctraderBroker({ authenticated: false, ready: false }),
      }),
      brokerKey: "ctrader",
    }),
    UI_STATUS.connecting
  );
});

test("a cTrader socket that is down despite cached OAuth is disconnected", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const snapshot = statusPayload({
    ctrader: ctraderBroker({
      connected: false,
      authenticated: false,
      ready: false,
      accountSource: "cache",
    }),
  });

  assert.equal(snapshot.brokers.ctrader.authorization.hasAccessToken, true);
  assert.equal(
    mapBrokerUiStatus({ snapshot, brokerKey: "ctrader" }),
    UI_STATUS.disconnected
  );
});

test("an unreachable bridge is unreachable rather than disconnected", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const mt5 = mt5Broker({
    connection: mt5Connection({
      state: "unreachable",
      connected: false,
      serviceReachable: false,
      reason: "connect ECONNREFUSED 127.0.0.1:5001",
    }),
    account: null,
    identity: mt5IdentityBlock({ login: null, server: null }),
  });

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ mt5 }),
      brokerKey: "mt5",
    }),
    UI_STATUS.unreachable
  );
});

test("an adapter failure snapshot is an error", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const mt5 = mt5Broker({
    connection: {
      state: "error",
      connected: false,
      serviceReachable: false,
      observedAt: OBSERVED_AT,
      sourceTimestamp: null,
      reason: "MT5 status probe threw.",
    },
    account: null,
    identity: mt5IdentityBlock({ login: null, server: null }),
  });

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ mt5 }),
      brokerKey: "mt5",
    }),
    UI_STATUS.error
  );
});

test("an unsuccessful aggregate is an error for both brokers", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const snapshot = statusPayload({ success: false });

  for (const brokerKey of ["mt5", "ctrader"]) {
    assert.equal(
      mapBrokerUiStatus({ snapshot, brokerKey, loading: true }),
      UI_STATUS.error,
      `${brokerKey} must not claim loading after the status request failed`
    );
  }
});

test("a broker the payload never described is unreachable, not disconnected", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const snapshot = statusPayload({ mt5: mt5Broker() });

  assert.equal(snapshot.brokers.ctrader, undefined);
  assert.equal(
    mapBrokerUiStatus({ snapshot, brokerKey: "ctrader" }),
    UI_STATUS.unreachable
  );
});

test("an unrecognised connection state is unreachable", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const mt5 = mt5Broker({
    connection: mt5Connection({ state: "half-open", connected: false }),
  });

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ mt5 }),
      brokerKey: "mt5",
    }),
    UI_STATUS.unreachable
  );
});

test("a background refresh keeps the last observed state instead of claiming loading", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  assert.equal(
    mapBrokerUiStatus({
      snapshot: statusPayload({ mt5: mt5Broker() }),
      brokerKey: "mt5",
      loading: true,
    }),
    UI_STATUS.connected
  );
});

test("an MT5 status is never reused for the cTrader card", async () => {
  const { mapBrokerUiStatus, UI_STATUS } = await loadModel();

  const snapshot = statusPayload({ mt5: mt5Broker() });

  assert.equal(
    mapBrokerUiStatus({ snapshot, brokerKey: "mt5" }),
    UI_STATUS.connected
  );
  assert.equal(
    mapBrokerUiStatus({ snapshot, brokerKey: "ctrader" }),
    UI_STATUS.unreachable
  );
});

// ============================================================
// buildAccountRows
// ============================================================

test("rows only carry accounts of the requested broker", async () => {
  const { buildAccountRows } = await loadModel();

  const storedAccounts = [
    storedMt5Account(),
    storedCtraderAccount(),
    { id: "manual-1", accountName: "Manual", broker: "Manual" },
  ];

  const mt5Rows = buildAccountRows({
    storedAccounts,
    brokerKey: "mt5",
    snapshot: statusPayload({ mt5: mt5Broker(), ctrader: ctraderBroker() }),
  });

  const ctraderRows = buildAccountRows({
    storedAccounts,
    brokerKey: "ctrader",
    snapshot: statusPayload({ mt5: mt5Broker(), ctrader: ctraderBroker() }),
  });

  assert.deepEqual(
    mt5Rows.map((row) => row.account.id),
    ["mt5-1001"]
  );
  assert.deepEqual(
    ctraderRows.map((row) => row.account.id),
    ["ctrader-395823"]
  );
});

test("the same external id under both brokers stays two rows", async () => {
  const { buildAccountRows } = await loadModel();

  const shared = [
    storedMt5Account(),
    storedCtraderAccount({ id: "ctrader-1001", externalId: MT5_LOGIN }),
  ];

  const snapshot = statusPayload({
    mt5: mt5Broker(),
    ctrader: ctraderBroker({
      serviceAccountId: MT5_LOGIN,
      requestedAccountId: MT5_LOGIN,
    }),
  });

  const mt5Keys = buildAccountRows({
    storedAccounts: shared,
    brokerKey: "mt5",
    snapshot,
  }).map((row) => row.rowKey);

  const ctraderKeys = buildAccountRows({
    storedAccounts: shared,
    brokerKey: "ctrader",
    snapshot,
  }).map((row) => row.rowKey);

  assert.deepEqual(mt5Keys, ["mt5:1001:mt5-1001"]);
  assert.deepEqual(ctraderKeys, ["ctrader:1001:ctrader-1001"]);
});

test("a row key never uses the external number alone", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [
      storedMt5Account({ id: "mt5-1001" }),
      storedMt5Account({ id: "mt5-old-1001" }),
    ],
    brokerKey: "mt5",
    snapshot: null,
  });

  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.rowKey)).size, 2);
  assert.equal(rows.every((row) => row.rowKey.startsWith("mt5:1001:")), true);
});

test("an account with no external id is still listed and never live", async () => {
  const { buildAccountRows } = await loadModel();

  // A record that names MT5 but carries no external number anywhere: it belongs
  // to the MT5 card, yet nothing can tie it to the live login.
  const rows = buildAccountRows({
    storedAccounts: [{ id: "legacy-1", accountName: "Half recorded", broker: "MT5" }],
    brokerKey: "mt5",
    snapshot: statusPayload({ mt5: mt5Broker() }),
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].identity.externalId, null);
  assert.equal(rows[0].isLiveSession, false);
});

test("MT5 rows ignore a cTrader account even when both brokers are in the payload", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [storedCtraderAccount()],
    brokerKey: "mt5",
    snapshot: statusPayload({ ctrader: ctraderBroker() }),
  });

  assert.deepEqual(rows, []);
});

test("the live session row is marked from the MT5 aggregate identity", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [
      storedMt5Account(),
      storedMt5Account({ id: "mt5-2002", externalId: "2002" }),
    ],
    brokerKey: "mt5",
    snapshot: statusPayload({ mt5: mt5Broker() }),
  });

  assert.deepEqual(
    rows.map((row) => [row.account.id, row.isLiveSession]),
    [
      ["mt5-1001", true],
      ["mt5-2002", false],
    ]
  );
});

test("a cTrader identity does not mark an MT5 row as the live session", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [storedMt5Account({ externalId: CT_TRADING_ACCOUNT_ID, id: "mt5-395823" })],
    brokerKey: "mt5",
    snapshot: statusPayload({ ctrader: ctraderBroker() }),
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isLiveSession, false);
});

test("the live cTrader row matches the authenticated service account", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [
      storedCtraderAccount(),
      storedCtraderAccount({ id: "ctrader-999", externalId: "999" }),
    ],
    brokerKey: "ctrader",
    snapshot: statusPayload({ ctrader: ctraderBroker() }),
  });

  assert.deepEqual(
    rows.map((row) => [row.account.id, row.isLiveSession]),
    [
      ["ctrader-395823", true],
      ["ctrader-999", false],
    ]
  );
});

test("a cached cTrader selection marks no row as the live session", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [storedCtraderAccount()],
    brokerKey: "ctrader",
    snapshot: statusPayload({
      ctrader: ctraderBroker({
        connected: false,
        authenticated: false,
        ready: false,
        accountSource: "cache",
      }),
    }),
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isLiveSession, false);
});

test("unsupported broker records are listed under neither broker", async () => {
  const { buildAccountRows } = await loadModel();

  const storedAccounts = [
    { id: "deriv-1", accountName: "Deriv", broker: "Deriv", brokerAccountId: "9" },
  ];

  const snapshot = statusPayload({ mt5: mt5Broker(), ctrader: ctraderBroker() });

  for (const brokerKey of ["mt5", "ctrader"]) {
    assert.deepEqual(
      buildAccountRows({ storedAccounts, brokerKey, snapshot }),
      [],
      `${brokerKey} must not claim a broker it has no adapter for`
    );
  }
});

test("malformed stored entries are left untouched and produce no row", async () => {
  const { buildAccountRows } = await loadModel();

  const storedAccounts = [
    null,
    "a string",
    42,
    {},
    storedMt5Account(),
  ];

  const snapshot = statusPayload({ mt5: mt5Broker() });

  const rows = buildAccountRows({
    storedAccounts,
    brokerKey: "mt5",
    snapshot,
  });

  assert.deepEqual(rows.map((row) => row.account.id), ["mt5-1001"]);
  assert.equal(storedAccounts.length, 5);
  assert.deepEqual(storedAccounts[0], null);
  assert.deepEqual(storedAccounts[3], {});
  assert.equal(storedAccounts[4].id, "mt5-1001");
});

test("rows are available before any status payload arrives", async () => {
  const { buildAccountRows } = await loadModel();

  const rows = buildAccountRows({
    storedAccounts: [storedMt5Account()],
    brokerKey: "mt5",
    snapshot: null,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isLiveSession, false);
  assert.equal(typeof rows[0].rowKey, "string");
});

// ============================================================
// mergeBrokerAccount
// ============================================================

test("a matching MT5 session updates the stored record without replacing it", async () => {
  const { mergeBrokerAccount } = await loadModel();

  const original = {
    id: "local-custom-id",
    broker: "MT5",
    brokerAccountId: "1001",
    unknownNested: { keep: true },
  };

  const result = mergeBrokerAccount(
    [
      original,
      { id: "ctrader-1001", broker: "cTrader", brokerAccountId: "1001" },
    ],
    { id: "mt5-1001", broker: "MT5", brokerAccountId: "1001", balance: 0 }
  );

  assert.equal(result.account.id, "local-custom-id");
  assert.deepEqual(result.account.unknownNested, { keep: true });
  assert.equal(result.account.balance, 0);
  assert.equal(result.accounts[1].id, "ctrader-1001");
  assert.equal(result.changed, true);
});

test("a merge that adds nothing reports no change", async () => {
  const { mergeBrokerAccount } = await loadModel();

  const original = storedMt5Account({ balance: 4321.11 });

  const result = mergeBrokerAccount([original], {
    ...original,
    balance: 4321.11,
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.account, original);
  assert.equal(result.accounts.length, 1);
});

test("an unmatched account is appended once", async () => {
  const { mergeBrokerAccount } = await loadModel();

  const existing = storedMt5Account();

  const result = mergeBrokerAccount([existing], {
    id: "mt5-2002",
    accountName: "MT5 Account 2002",
    broker: "MT5",
    brokerAccountId: "2002",
    balance: 777,
  });

  assert.equal(result.accounts.length, 2);
  assert.equal(result.accounts[0].id, "mt5-1001");
  assert.equal(result.account.id, "mt5-2002");
  assert.equal(result.changed, true);
});

test("the same external id under another broker is never merged", async () => {
  const { mergeBrokerAccount } = await loadModel();

  const mt5 = storedMt5Account();

  const result = mergeBrokerAccount([mt5], {
    id: "ctrader-1001",
    accountName: "cTrader 1001",
    broker: "cTrader",
    brokerAccountId: MT5_LOGIN,
    balance: 999999,
  });

  assert.equal(result.accounts.length, 2);
  assert.deepEqual(result.accounts[0], mt5);
  assert.equal(result.account.id, "ctrader-1001");
});

test("a candidate that claims no broker identity is neither merged nor appended", async () => {
  const { mergeBrokerAccount } = await loadModel();

  const stored = [storedMt5Account()];

  const result = mergeBrokerAccount(stored, {
    id: "mystery",
    accountName: "Mystery",
    balance: 500,
  });

  assert.equal(result.account, null);
  assert.equal(result.changed, false);
  assert.deepEqual(result.accounts, stored);
});

test("a merge never mutates the caller's array or records", async () => {
  const { mergeBrokerAccount } = await loadModel();

  const original = storedMt5Account({ balance: 4321.11 });
  const stored = [original];

  const result = mergeBrokerAccount(stored, {
    id: "mt5-1001",
    broker: "MT5",
    brokerAccountId: MT5_LOGIN,
    balance: 0,
    equity: 0,
  });

  assert.equal(stored.length, 1);
  assert.equal(stored[0], original);
  assert.equal(original.balance, 4321.11);
  assert.equal(result.accounts[0].balance, 0);
  assert.notEqual(result.accounts[0], original);
});

// ============================================================
// createRequestGuard
// ============================================================

test("a newer request invalidates the older token", async () => {
  const { createRequestGuard } = await loadModel();

  const guard = createRequestGuard();

  const first = guard.begin({ brokerKey: "mt5", accountId: "A" });
  const second = guard.begin({ brokerKey: "mt5", accountId: "B" });

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);

  guard.invalidate();

  assert.equal(guard.isCurrent(second), false);
});

test("repeated requests for the same account invalidate the earlier one", async () => {
  const { createRequestGuard } = await loadModel();

  const guard = createRequestGuard();

  const first = guard.begin({ brokerKey: "mt5", accountId: "A" });
  const second = guard.begin({ brokerKey: "mt5", accountId: "A" });

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test("each broker gets its own guard", async () => {
  const { createRequestGuard } = await loadModel();

  const mt5Guard = createRequestGuard();
  const ctraderGuard = createRequestGuard();

  const mt5Token = mt5Guard.begin({ brokerKey: "mt5", accountId: "A" });
  const ctraderToken = ctraderGuard.begin({ brokerKey: "ctrader", accountId: "B" });

  assert.equal(mt5Guard.isCurrent(mt5Token), true);
  assert.equal(ctraderGuard.isCurrent(ctraderToken), true);
});

test("the guard coerces a numeric account id to text", async () => {
  const { createRequestGuard } = await loadModel();

  const guard = createRequestGuard();

  const token = guard.begin({ brokerKey: "mt5", accountId: 1001 });

  assert.equal(token.accountId, "1001");
  assert.equal(guard.isCurrent(token), true);
  assert.equal(guard.isCurrent({ brokerKey: "mt5", accountId: "1001" }), false);
});

test("a guard token is frozen so a caller cannot rewrite its identity", async () => {
  const { createRequestGuard } = await loadModel();

  const guard = createRequestGuard();
  const token = guard.begin({ brokerKey: "mt5", accountId: "A" });

  assert.throws(() => {
    token.accountId = "B";
  }, TypeError);
});

// ============================================================
// createEmptySession and formatMetric
// ============================================================

test("an empty session carries null metrics, collections and sync time", async () => {
  const { createEmptySession } = await loadModel();

  assert.deepEqual(createEmptySession(), {
    metrics: {
      balance: null,
      equity: null,
      marginUsed: null,
      freeMargin: null,
      currency: null,
      leverage: null,
    },
    positions: null,
    pendingOrders: null,
    pendingOrdersReason: "Live data has not been validated.",
    lastSuccessfulSync: null,
    validationError: null,
  });
});

test("each empty session is a fresh object", async () => {
  const { createEmptySession } = await loadModel();

  const first = createEmptySession();
  first.metrics.balance = 999;
  first.positions = [];

  const second = createEmptySession();

  assert.equal(second.metrics.balance, null);
  assert.equal(second.positions, null);
});

test("a genuine zero metric stays zero", async () => {
  const { formatMetric } = await loadModel();

  assert.equal(formatMetric(0), "0");
  assert.match(formatMetric(0, { currency: "USD" }), /(^|\s)0$/);
  assert.equal(formatMetric(0, { suffix: ":1" }), "0:1");
});

test("missing or unusable metrics read Unavailable, never zero", async () => {
  const { formatMetric } = await loadModel();

  for (const value of [null, undefined, "", "   ", NaN, Infinity, -Infinity, true, {}, [], "abc"]) {
    assert.equal(
      formatMetric(value),
      "Unavailable",
      `${String(value)} must not be presented as a number`
    );
  }
});

test("currency and suffix decorate a real number", async () => {
  const { formatMetric } = await loadModel();

  assert.equal(formatMetric(-1234.5, { currency: "USD" }), "USD -1,234.50");
  assert.equal(formatMetric(100, { suffix: ":1" }), "100:1");
  assert.equal(formatMetric(1234567.891), "1,234,567.89");
});

test("a numeric string from the backend formats as its number", async () => {
  const { formatMetric } = await loadModel();

  assert.equal(formatMetric("100", { suffix: ":1" }), "100:1");
  assert.equal(formatMetric("4910.50", { currency: "USD" }), "USD 4,910.50");
});

// ============================================================
// validateMt5Session
// ============================================================

test("a validated MT5 session reads metrics, positions and orders", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(mt5SessionInput());

  assert.equal(session.validationError, null);
  assert.deepEqual(session.metrics, {
    balance: 10000.5,
    equity: 10050.25,
    marginUsed: 200,
    freeMargin: 9850.25,
    currency: "USD",
    leverage: 100,
  });
  assert.equal(session.positions.length, 1);
  assert.equal(session.positions[0].ticket, 4_400_001);
  assert.deepEqual(session.pendingOrders, []);
  assert.equal(session.pendingOrdersReason, null);
  assert.equal(session.lastSuccessfulSync, SYNCED_AT);
});

test("genuine zero MT5 metrics survive validation", async () => {
  const { validateMt5Session } = await loadModel();

  const aggregate = statusPayload({
    mt5: mt5Broker({
      account: mt5AccountBlock({ balance: 0, equity: 0, margin: 0, freeMargin: 0 }),
    }),
  });

  const session = validateMt5Session(
    mt5SessionInput({
      aggregate,
      postOrdersAggregate: aggregate,
    })
  );

  assert.equal(session.validationError, null);
  assert.equal(session.metrics.balance, 0);
  assert.equal(session.metrics.equity, 0);
  assert.equal(session.metrics.marginUsed, 0);
  assert.equal(session.metrics.freeMargin, 0);
});

test("a wrong live server invalidates the whole MT5 session", async () => {
  const { validateMt5Session } = await loadModel();

  const aggregate = statusPayload({
    mt5: mt5Broker({
      account: mt5AccountBlock({ server: "servers-1" }),
      identity: mt5IdentityBlock({ server: "servers-1" }),
    }),
  });

  const session = validateMt5Session(
    mt5SessionInput({ aggregate, postOrdersAggregate: aggregate })
  );

  assert.equal(session.validationError !== null, true);
  assert.match(session.validationError, /server/i);
  assert.equal(session.lastSuccessfulSync, null);
  assert.equal(session.positions, null);
  assert.equal(session.pendingOrders, null);
  assert.equal(session.metrics.balance, null);
});

test("a wrong live login invalidates the whole MT5 session", async () => {
  const { validateMt5Session } = await loadModel();

  const aggregate = statusPayload({
    mt5: mt5Broker({
      account: mt5AccountBlock({ login: "2002" }),
      identity: mt5IdentityBlock({ login: "2002" }),
    }),
  });

  const session = validateMt5Session(
    mt5SessionInput({ aggregate, postOrdersAggregate: aggregate })
  );

  assert.match(session.validationError, /different account/i);
  assert.equal(session.lastSuccessfulSync, null);
  assert.deepEqual(Object.values(session.metrics), [null, null, null, null, null, null]);
});

test("an MT5 session with no live identity has no data to present", async () => {
  const { validateMt5Session } = await loadModel();

  const aggregate = statusPayload({
    mt5: mt5Broker({
      connection: mt5Connection({ state: "disconnected", connected: false }),
      account: null,
      identity: mt5IdentityBlock({ login: null, server: null }),
    }),
  });

  const session = validateMt5Session(
    mt5SessionInput({
      aggregate,
      postOrdersAggregate: aggregate,
      positionsResponse: mt5PositionsResponse({ success: false }),
      ordersResponse: mt5OrdersResponse({ success: false }),
    })
  );

  assert.match(session.validationError, /not connected/i);
  assert.equal(session.lastSuccessfulSync, null);
  assert.equal(session.positions, null);
});

test("positions reported for another login are rejected", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      positionsResponse: mt5PositionsResponse({ login: "2002" }),
    })
  );

  assert.match(session.validationError, /login|account/i);
  assert.equal(session.positions, null);
  assert.equal(session.lastSuccessfulSync, null);
});

test("a positions response without session identity is not attributed", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      positionsResponse: {
        success: true,
        connected: true,
        count: 1,
        positions: [mt5Position()],
      },
    })
  );

  assert.match(session.validationError, /identity/i);
  assert.equal(session.positions, null);
});

test("a failed MT5 orders response leaves pending orders unavailable", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({ ordersResponse: mt5OrdersResponse({ success: false }) })
  );

  assert.equal(session.validationError, null);
  assert.equal(session.pendingOrders, null);
  assert.notEqual(session.pendingOrdersReason, null);
  assert.equal(session.metrics.balance, 10000.5);
  assert.equal(session.lastSuccessfulSync, SYNCED_AT);
});

test("a failed MT5 positions response leaves positions unavailable", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      positionsResponse: mt5PositionsResponse({ success: false, positions: [] }),
    })
  );

  assert.equal(session.validationError, null);
  assert.equal(session.positions, null);
  assert.equal(session.lastSuccessfulSync, SYNCED_AT);
});

test("genuine empty MT5 collections stay empty arrays", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      positionsResponse: mt5PositionsResponse({ positions: [] }),
      ordersResponse: mt5OrdersResponse({ orders: [] }),
    })
  );

  assert.deepEqual(session.positions, []);
  assert.deepEqual(session.pendingOrders, []);
});

test("a missing MT5 collection stays null rather than an empty array", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      positionsResponse: mt5PositionsResponse({ includeArray: false }),
      ordersResponse: mt5OrdersResponse({ includeArray: false }),
    })
  );

  assert.equal(session.positions, null);
  assert.equal(session.pendingOrders, null);
  assert.notEqual(session.pendingOrdersReason, null);
});

test("a non-array MT5 collection is treated as unavailable", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      positionsResponse: {
        success: true,
        connected: true,
        login: MT5_LOGIN,
        mt5Login: MT5_LOGIN,
        server: MT5_SERVER,
        mt5Server: MT5_SERVER,
        positions: { oops: true },
      },
    })
  );

  assert.equal(session.validationError, null);
  assert.equal(session.positions, null);
});

test("a stale post-orders aggregate invalidates the MT5 session", async () => {
  const { validateMt5Session } = await loadModel();

  const stale = statusPayload({
    mt5: mt5Broker({
      account: mt5AccountBlock({ login: "2002" }),
      identity: mt5IdentityBlock({ login: "2002" }),
    }),
  });

  const session = validateMt5Session(
    mt5SessionInput({
      ordersResponse: mt5OrdersResponse({
        orders: [{ ticket: 9, symbol: "EURUSD", type: "buy" }],
      }),
      postOrdersAggregate: stale,
    })
  );

  assert.match(session.validationError, /changed|identity|session/i);
  assert.equal(session.pendingOrders, null);
  assert.equal(session.positions, null);
  assert.equal(session.metrics.balance, null);
  assert.equal(session.lastSuccessfulSync, null);
});

test("a missing post-orders aggregate invalidates the MT5 session", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(mt5SessionInput({ postOrdersAggregate: null }));

  assert.equal(session.validationError !== null, true);
  assert.equal(session.lastSuccessfulSync, null);
});

test("an MT5 payload with no account block leaves metrics null rather than stored numbers", async () => {
  const { validateMt5Session } = await loadModel();

  const aggregate = statusPayload({
    mt5: mt5Broker({ account: null }),
  });

  const session = validateMt5Session(
    mt5SessionInput({ aggregate, postOrdersAggregate: aggregate })
  );

  assert.equal(session.validationError, null);
  assert.deepEqual(Object.values(session.metrics), [null, null, null, null, null, null]);
  assert.equal(session.lastSuccessfulSync, SYNCED_AT);
});

test("an MT5 session is refused when the selected local account is not the live one", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(
    mt5SessionInput({
      accounts: [storedMt5Account(), storedMt5Account({ id: "mt5-2002", externalId: "2002" })],
      selectedAccountId: "mt5-2002",
    })
  );

  assert.match(session.validationError, /different account/i);
  assert.equal(session.metrics.balance, null);
  assert.equal(session.positions, null);
});

test("an MT5 session is refused when no account is selected", async () => {
  const { validateMt5Session } = await loadModel();

  const session = validateMt5Session(mt5SessionInput({ selectedAccountId: null }));

  assert.equal(session.validationError !== null, true);
  assert.equal(session.lastSuccessfulSync, null);
});

// ============================================================
// validateCtraderSession
// ============================================================

test("a validated cTrader session reads service metrics and positions", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(ctraderSessionInput());

  assert.equal(session.validationError, null);
  assert.deepEqual(session.metrics, {
    balance: 5000,
    equity: 5010.5,
    marginUsed: 100,
    freeMargin: 4910.5,
    currency: "USD",
    leverage: 100,
  });
  assert.equal(session.positions.length, 1);
  assert.equal(session.positions[0].positionId, 7001);
  assert.equal(session.lastSuccessfulSync, SYNCED_AT);
});

test("cTrader pending orders are never invented", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(ctraderSessionInput());

  assert.equal(session.pendingOrders, null);
  assert.equal(
    session.pendingOrdersReason,
    "Pending-order listing is unavailable for cTrader."
  );
});

test("a cached active account is not live provenance", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      aggregate: statusPayload({ ctrader: ctraderBroker({ accountSource: "cache" }) }),
    })
  );

  assert.match(session.validationError, /cache/i);
  assert.equal(session.lastSuccessfulSync, null);
  assert.equal(session.positions, null);
  assert.deepEqual(Object.values(session.metrics), [null, null, null, null, null, null]);
});

test("a down socket with cached OAuth has no live cTrader session", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      aggregate: statusPayload({
        ctrader: ctraderBroker({
          connected: false,
          authenticated: false,
          ready: false,
          accountSource: "cache",
        }),
      }),
    })
  );

  assert.match(session.validationError, /not connected/i);
  assert.equal(session.lastSuccessfulSync, null);
});

test("a cTrader service without a trading account id is refused", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({ tradingAccountId: null }),
    })
  );

  assert.match(session.validationError, /trading account id|identity/i);
  assert.equal(session.lastSuccessfulSync, null);
});

test("a service account that disagrees with the aggregate identity is refused", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({
        tradingAccountId: "999999",
        account: ctraderServiceAccount({ accountId: "999999" }),
      }),
    })
  );

  assert.match(session.validationError, /does not match|different account/i);
  assert.equal(session.lastSuccessfulSync, null);
  assert.equal(session.positions, null);
});

test("a missing service payload is refused", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({ serviceResponse: null })
  );

  assert.equal(session.validationError !== null, true);
  assert.equal(session.lastSuccessfulSync, null);
});

test("a requested account the service does not hold is refused", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      aggregate: statusPayload({
        ctrader: ctraderBroker({ requestedAccountId: "111111" }),
      }),
    })
  );

  assert.equal(session.validationError !== null, true);
  assert.equal(session.lastSuccessfulSync, null);
});

test("a cTrader session is refused for the wrong selected account", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      accounts: [
        storedCtraderAccount(),
        storedCtraderAccount({ id: "ctrader-999", externalId: "999" }),
      ],
      selectedAccountId: "ctrader-999",
    })
  );

  assert.match(session.validationError, /different account/i);
  assert.equal(session.metrics.balance, null);
});

test("null cTrader service metrics stay null and never fall back to stored numbers", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({
        account: ctraderServiceAccount({
          balance: null,
          equity: null,
          margin: null,
          freeMargin: null,
          currency: null,
          leverage: null,
        }),
      }),
    })
  );

  assert.equal(session.validationError, null);
  assert.deepEqual(Object.values(session.metrics), [null, null, null, null, null, null]);
  assert.equal(session.positions.length, 1);
  assert.equal(session.lastSuccessfulSync, SYNCED_AT);
});

test("an omitted cTrader account block leaves every metric null", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({ account: null }),
    })
  );

  assert.equal(session.validationError, null);
  assert.deepEqual(Object.values(session.metrics), [null, null, null, null, null, null]);
});

test("a genuine zero cTrader equity is kept as zero", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({
        account: ctraderServiceAccount({ equity: 0, margin: 0 }),
      }),
    })
  );

  assert.equal(session.metrics.equity, 0);
  assert.equal(session.metrics.marginUsed, 0);
});

test("an empty cTrader position list is a genuine zero positions", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({ openPositions: [] }),
    })
  );

  assert.deepEqual(session.positions, []);
  assert.equal(session.validationError, null);
});

test("a missing cTrader position list stays null", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({ includePositions: false }),
    })
  );

  assert.equal(session.positions, null);
});

test("every cTrader outcome leaves pending orders null with a reason", async () => {
  const { validateCtraderSession } = await loadModel();

  const outcomes = [
    ctraderSessionInput(),
    ctraderSessionInput({
      aggregate: statusPayload({ ctrader: ctraderBroker({ accountSource: "cache" }) }),
    }),
    ctraderSessionInput({
      aggregate: statusPayload({
        ctrader: ctraderBroker({ connected: false, authenticated: false, ready: false }),
      }),
    }),
    ctraderSessionInput({ serviceResponse: null }),
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({ tradingAccountId: null }),
    }),
    ctraderSessionInput({
      serviceResponse: ctraderServiceResponse({ tradingAccountId: "999999" }),
    }),
    ctraderSessionInput({ selectedAccountId: null }),
  ];

  for (const [index, input] of outcomes.entries()) {
    const session = validateCtraderSession(input);

    assert.equal(session.pendingOrders, null, `outcome ${index}`);
    assert.equal(
      typeof session.pendingOrdersReason,
      "string",
      `outcome ${index} must say why orders are unavailable`
    );
    assert.notEqual(session.pendingOrdersReason, "", `outcome ${index}`);
  }
});

test("a rejected cTrader session carries no MT5-shaped data either", async () => {
  const { validateCtraderSession } = await loadModel();

  const session = validateCtraderSession(
    ctraderSessionInput({
      aggregate: statusPayload({
        mt5: mt5Broker(),
        ctrader: ctraderBroker({ authenticated: false, ready: false }),
      }),
    })
  );

  assert.equal(session.validationError !== null, true);
  assert.equal(session.metrics.balance, null);
  assert.equal(session.positions, null);
});

// ============================================================
// purity
// ============================================================

test("the model never reaches a transport or the DOM", async () => {
  const model = await loadModel();

  const realFetch = globalThis.fetch;
  let touched = [];

  globalThis.fetch = (...args) => {
    touched.push("fetch");
    throw new Error("the model must not make requests");
  };

  try {
    model.mapBrokerUiStatus({ snapshot: null, brokerKey: "mt5", loading: true });
    model.buildAccountRows({
      storedAccounts: [storedMt5Account()],
      brokerKey: "mt5",
      snapshot: statusPayload({ mt5: mt5Broker() }),
    });
    model.mergeBrokerAccount([storedMt5Account()], storedMt5Account());
    model.createRequestGuard().begin({ brokerKey: "mt5", accountId: "A" });
    model.validateMt5Session(mt5SessionInput());
    model.validateCtraderSession(ctraderSessionInput());
    model.formatMetric(1, { currency: "USD" });
    model.createEmptySession();
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.deepEqual(touched, []);
});
