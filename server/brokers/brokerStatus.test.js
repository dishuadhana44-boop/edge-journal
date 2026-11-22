import test from "node:test";
import assert from "node:assert/strict";

import { createMt5Adapter } from "./mt5Adapter.js";
import { createCtraderAdapter } from "./ctraderAdapter.js";
import {
  buildStatusResponse,
  BROKER_STATUS_CONTRACT_VERSION,
} from "./registry.js";
import { createBrokersRouter } from "../routes/brokers.js";

/* ============================================================
   FAKES — nothing here opens a socket or starts a process
   ============================================================ */

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function assertFreshIsoTimestamp(value, label) {
  const millis = Date.parse(value);

  assert.ok(!Number.isNaN(millis), `${label} must be a parseable timestamp`);
  assert.ok(
    Math.abs(Date.now() - millis) < 5000,
    `${label} must be the server clock, not a fixed or fabricated time`
  );
}

function bridgeRoute(map) {
  return async (url) => {
    const path = new URL(url).pathname;

    if (!(path in map)) {
      throw new Error(`unexpected bridge path ${path}`);
    }

    const result = map[path];

    if (result instanceof Error) throw result;

    return result;
  };
}

const MT5_CONNECTED_BODY = {
  success: true,
  connected: true,
  magic: 2026001,
  timestamp: "2026-11-03T10:00:00.000Z",
  account: {
    login: 12345678,
    server: "MetaQuotes-Demo",
    company: "ACME Ltd",
    currency: "USD",
    balance: 10000,
    equity: 10055.5,
    margin: 120,
    margin_free: 9935.5,
    leverage: "1:100",
    profit: 55.5,
  },
};

function mt5AdapterFor(map, timeoutMs) {
  return createMt5Adapter({
    bridgeUrl: "http://127.0.0.1:5001",
    fetchImpl: bridgeRoute(map),
    timeoutMs,
  });
}

/* ============================================================
   MT5 TRUTH
   ============================================================ */

test("mt5: connected terminal reports connected with bridge values", async () => {
  const adapter = mt5AdapterFor({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse(MT5_CONNECTED_BODY),
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.connection.state, "connected");
  assert.equal(snapshot.connection.connected, true);
  assert.equal(snapshot.connection.serviceReachable, true);
  assert.equal(snapshot.connection.sourceTimestamp, MT5_CONNECTED_BODY.timestamp);
  assertFreshIsoTimestamp(snapshot.connection.observedAt, "mt5 observedAt");
  assert.equal(snapshot.errors.length, 0);

  assert.equal(snapshot.account.login, "12345678");
  assert.equal(snapshot.account.server, "MetaQuotes-Demo");
  assert.equal(snapshot.account.name, "ACME Ltd");
  assert.equal(snapshot.account.balance, 10000);
  assert.equal(snapshot.account.equity, 10055.5);
  assert.equal(snapshot.account.freeMargin, 9935.5);
  assert.equal(snapshot.account.floatingPnL, 55.5);

  assert.equal(snapshot.session.scope, "global_terminal_session");
  assert.equal(snapshot.session.accountScoped, false);
  assert.equal(snapshot.execution.browserCompatible, false);
});

test("mt5: bridge up but terminal logged out is disconnected, not unreachable", async () => {
  const adapter = mt5AdapterFor({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse(
      { success: false, connected: false, message: "MT5 is not connected." },
      { ok: false, status: 503 }
    ),
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.connection.state, "disconnected");
  assert.equal(snapshot.connection.connected, false);
  assert.equal(snapshot.connection.serviceReachable, true);
  assert.equal(snapshot.connection.reason, "MT5 is not connected.");
  assert.equal(
    snapshot.connection.sourceTimestamp,
    null,
    "no bridge timestamp means no timestamp, not a fabricated one"
  );
  assertFreshIsoTimestamp(snapshot.connection.observedAt, "mt5 observedAt");
  assert.equal(snapshot.account, null);

  const codes = snapshot.errors.map((error) => error.code);

  assert.ok(!codes.includes("mt5_health_failed"));
  assert.ok(codes.includes("mt5_status_failed"));
});

test("mt5: unreachable bridge is labelled unknown, not logged out", async () => {
  const adapter = mt5AdapterFor({
    "/health": new Error("connect ECONNREFUSED 127.0.0.1:5001"),
    "/mt5/status": new Error("connect ECONNREFUSED 127.0.0.1:5001"),
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.connection.state, "unreachable");
  assert.equal(snapshot.connection.connected, false);
  assert.equal(snapshot.connection.serviceReachable, false);
  assert.match(snapshot.connection.reason, /ECONNREFUSED/);

  assert.ok(
    snapshot.session.limitations.some((text) =>
      text.includes("'unknown/unreachable'")
    ),
    "unreachable must not be presented as a logged-out terminal"
  );
});

test("mt5: a non-JSON bridge body is reported as a failure", async () => {
  const adapter = mt5AdapterFor({
    "/health": jsonResponse("<html>not json</html>"),
    "/mt5/status": jsonResponse({ success: true, connected: false }),
  });

  const snapshot = await adapter.probe();

  const healthError = snapshot.errors.find(
    (error) => error.code === "mt5_health_failed"
  );

  assert.equal(healthError.message, "MT5 bridge responded with a non-JSON body.");
  assert.equal(snapshot.connection.state, "disconnected");
});

test("mt5: bridge timeout is reported instead of hanging the status call", async () => {
  const adapter = createMt5Adapter({
    bridgeUrl: "http://127.0.0.1:5001",
    timeoutMs: 20,
    fetchImpl: (url, options) =>
      new Promise((resolve, reject) => {
        const abort = () => reject(new Error("The operation was aborted"));

        options.signal.addEventListener("abort", abort, { once: true });
      }),
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.connection.state, "unreachable");
  assert.match(snapshot.connection.reason, /did not answer within 20ms/);
});

test("mt5: no account enumeration and no invented accounts", async () => {
  const adapter = mt5AdapterFor({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse(MT5_CONNECTED_BODY),
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.accounts.enumerable, false);
  assert.equal(snapshot.accounts.source, "none");
  assert.equal(snapshot.accounts.isLive, false);
  assert.deepEqual(snapshot.accounts.items, []);
  assert.equal(snapshot.accounts.activeAccountId, null);
  assert.ok(snapshot.accounts.reason.includes("no account enumeration endpoint"));

  const accounts = await adapter.listAccounts();

  assert.deepEqual(accounts, snapshot.accounts);
});

/* ============================================================
   CTRADER TRUTH
   ============================================================ */

function ctraderFixture({ live, cached, service = {} } = {}) {
  return createCtraderAdapter({
    getServiceStatus: () => service,
    getLiveAccounts: () => live,
    getAuthSummary: () => cached,
  });
}

const CTRADER_AUTH = {
  connected: true,
  hasAccessToken: true,
  hasRefreshToken: true,
  activeAccountId: "77001122",
  accounts: [
    {
      accountId: "77001122",
      name: "Main demo",
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ],
};

test("ctrader: live service accounts win over the cached list", async () => {
  const adapter = ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId: "77001122",
      positionsCount: 0,
      account: {
        accountId: "77001122",
        balance: 5000,
        equity: 5010,
        currency: "USD",
      },
    },
    live: [
      {
        accountId: "77001122",
        traderLogin: 445566,
        isLive: true,
        lastLoginTime: "2026-11-03T09:00:00.000Z",
      },
    ],
    cached: CTRADER_AUTH,
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.connection.state, "connected");
  assertFreshIsoTimestamp(snapshot.connection.observedAt, "ctrader observedAt");
  assert.equal(
    snapshot.connection.sourceTimestamp,
    null,
    "the cTrader service exposes no observation time, so none may be invented"
  );
  assert.equal(snapshot.accounts.source, "live");
  assert.equal(snapshot.accounts.isLive, true);
  assert.equal(snapshot.accounts.items.length, 1);
  assert.equal(snapshot.accounts.items[0].accountId, "77001122");
  assert.equal(snapshot.accounts.items[0].name, "Main demo");
  assert.equal(snapshot.accounts.items[0].nameSource, "local_cache");
  assert.equal(snapshot.accounts.activeAccount.activeAccountSource, "live");
  assert.equal(snapshot.capabilities.accountEnumeration, true);
  assert.equal(snapshot.execution.browserCompatible, false);
});

test("ctrader: a stale cached list is labelled cache, never live", async () => {
  const adapter = ctraderFixture({
    service: { running: false, connected: false },
    live: [],
    cached: CTRADER_AUTH,
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.accounts.source, "cache");
  assert.equal(snapshot.accounts.isLive, false);
  assert.equal(snapshot.accounts.observedVia, "server/ctrader-auth.json");
  assert.match(snapshot.accounts.note, /may be stale/);
  assert.equal(snapshot.capabilities.accountEnumeration, false);
  assert.equal(snapshot.connection.state, "disconnected");
});

test("ctrader: nothing cached and nothing live reports no accounts", async () => {
  const adapter = ctraderFixture({
    service: { running: false, connected: false },
    live: [],
    cached: { connected: false, hasAccessToken: false, accounts: [] },
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.accounts.source, "none");
  assert.deepEqual(snapshot.accounts.items, []);
  assert.equal(snapshot.connection.state, "disconnected");
});

test("ctrader: a requested account that differs from the service is a mismatch", async () => {
  const adapter = ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId: "99999999",
    },
    live: [{ accountId: "99999999", traderLogin: 1, isLive: true }],
    cached: CTRADER_AUTH,
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.accounts.mismatch, true);
  assert.equal(snapshot.accounts.requestedActiveAccountId, "77001122");
  assert.equal(snapshot.accounts.serviceReportedAccountId, "99999999");
  assert.equal(snapshot.accounts.activeAccountId, "77001122");
});

test("ctrader: throwing dependency sources degrade instead of crashing", async () => {
  const adapter = createCtraderAdapter({
    getServiceStatus: () => {
      throw new Error("service exploded");
    },
    getLiveAccounts: () => {
      throw new Error("accounts exploded");
    },
    getAuthSummary: () => {
      throw new Error("auth exploded");
    },
  });

  const snapshot = await adapter.probe();

  assert.equal(snapshot.connection.state, "disconnected");
  assert.equal(snapshot.accounts.source, "none");
  assert.deepEqual(snapshot.accounts.items, []);
});

test("ctrader: no token or secret value ever leaves the snapshot", async () => {
  const adapter = createCtraderAdapter({
    getServiceStatus: () => ({
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId: "77001122",
    }),
    getLiveAccounts: () => [{ accountId: "77001122", traderLogin: 445566, isLive: true }],
    getAuthSummary: () => ({
      ...CTRADER_AUTH,
      accessToken: "SECRET-ACCESS-TOKEN",
      refreshToken: "SECRET-REFRESH-TOKEN",
      clientSecret: "SECRET-CLIENT",
    }),
  });

  const payload = await buildStatusResponse([adapter]);
  const serialized = JSON.stringify(payload);

  assert.ok(serialized.includes("SECRET-ACCESS-TOKEN") === false);
  assert.ok(serialized.includes("SECRET-REFRESH-TOKEN") === false);
  assert.ok(serialized.includes("SECRET-CLIENT") === false);

  assert.equal(payload.brokers.ctrader.authorization.hasAccessToken, true);
  assert.equal(payload.brokers.ctrader.authorization.hasRefreshToken, true);
  assert.match(
    payload.brokers.ctrader.authorization.note,
    /Token values are intentionally omitted/
  );
});

/* ============================================================
   AGGREGATION + ROUTER
   ============================================================ */

test("status: a failing adapter cannot hide a healthy broker", async () => {
  const healthy = {
    id: "mt5",
    probe: async () => ({ id: "mt5", connection: { state: "connected" } }),
    listAccounts: async () => ({ items: [] }),
  };

  const broken = {
    id: "ctrader",
    probe: async () => {
      throw new Error("adapter blew up");
    },
    listAccounts: async () => {
      throw new Error("adapter blew up");
    },
  };

  const payload = await buildStatusResponse([healthy, broken]);

  assert.equal(payload.success, true);
  assert.equal(payload.contractVersion, BROKER_STATUS_CONTRACT_VERSION);
  assertFreshIsoTimestamp(payload.observedAt, "payload.observedAt");

  assert.equal(payload.brokers.mt5.connection.state, "connected");
  assert.equal(payload.brokers.ctrader.connection.state, "error");
  assert.equal(payload.brokers.ctrader.accounts.source, "none");
  assert.equal(payload.brokers.ctrader.errors[0].code, "adapter_failed");
  assert.match(payload.brokers.ctrader.errors[0].message, /adapter blew up/);
});

test("router: registers status and per-broker accounts without listening", () => {
  const router = createBrokersRouter({
    adapters: [
      { id: "mt5", probe: async () => ({}), listAccounts: async () => ({}) },
      { id: "ctrader", probe: async () => ({}), listAccounts: async () => ({}) },
    ],
  });

  const paths = router.stack
    .map((layer) => layer.route && layer.route.path)
    .filter(Boolean);

  assert.deepEqual(paths, ["/status", "/:brokerId/accounts"]);
});

test("router: unknown broker has no adapter entry point", async () => {
  const router = createBrokersRouter({ adapters: [] });

  const handler = router.stack.find(
    (layer) => layer.route && layer.route.path === "/:brokerId/accounts"
  ).route.stack[0].handle;

  let response;

  await handler(
    { params: { brokerId: "binance" } },
    {
      status(code) {
        response = { code, body: null };
        return this;
      },
      json(body) {
        response.body = body;
      },
    },
    () => {}
  );

  assert.equal(response.code, 404);
  assert.deepEqual(response.body, { success: false, message: "Unknown broker." });
});
