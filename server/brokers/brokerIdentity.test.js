// ============================================================
// BROKER IDENTITY (Phase 2, backend)
// ============================================================
//
// Covers server/brokers/identity.js and the `identity` block each adapter
// publishes in its status snapshot.
//
// Fixtures are copied from the producers, not invented:
//   - MT5 bridge body   -> mt5-bridge/app.py:2143-2158
//     ({ success, connected, account: { login, server, ... }, magic, timestamp })
//   - cTrader account   -> buildAccountFromAuthorizedAccount(),
//     server/services/ctraderService.js:278-303
//     ({ accountId, isLive, traderLogin, lastLoginTime })
//   - cTrader status    -> getCTraderServiceStatus(),
//     server/services/ctraderService.js:3165-3222 (tradingAccountId, account)
//
// LIMIT: this proves the identity a probe returns and that the registry
// rejects a mislabelled one. It does not prove the endpoint was ever served,
// which needs the running stack.

import test from "node:test";
import assert from "node:assert/strict";

import { createMt5Adapter } from "./mt5Adapter.js";
import { createCtraderAdapter } from "./ctraderAdapter.js";
import { buildStatusResponse } from "./registry.js";
import { makeBrokerIdentity, BROKER_IDS } from "./identity.js";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  };
}

function bridgeRoute(map) {
  return async (url) => {
    const path = new URL(url).pathname;
    const result = map[path];

    if (result === undefined) {
      throw new Error(`unexpected bridge path ${path}`);
    }

    if (result instanceof Error) {
      throw result;
    }

    return result;
  };
}

function mt5Fixture(map) {
  return createMt5Adapter({
    bridgeUrl: "http://127.0.0.1:5001",
    fetchImpl: bridgeRoute(map),
    timeoutMs: 1000,
  });
}

const BRIDGE_CONNECTED = {
  success: true,
  connected: true,
  magic: 2026001,
  timestamp: "2026-11-04T09:00:00.000Z",
  account: {
    login: 12345678,
    server: "MetaQuotes-Demo",
    balance: 10000,
    equity: 10055.5,
    currency: "USD",
  },
};

function ctraderFixture({ service, live, auth } = {}) {
  return createCtraderAdapter({
    getServiceStatus: () => service,
    getLiveAccounts: () => live,
    getAuthSummary: () => auth,
  });
}

// ============================================================
// makeBrokerIdentity
// ============================================================

test("identity is the broker plus that broker's own account id", () => {
  const identity = makeBrokerIdentity({
    broker: "mt5",
    externalId: 12345678,
    server: "MetaQuotes-Demo",
    source: "bridge GET /mt5/status account.login",
  });

  assert.equal(identity.broker, "mt5");
  assert.equal(identity.externalId, "12345678");
  assert.equal(identity.server, "MetaQuotes-Demo");
  assert.equal(identity.source, "bridge GET /mt5/status account.login");
  assert.equal(identity.key, "mt5:12345678");
});

test("identity refuses a broker this server has no adapter for", () => {
  assert.deepEqual(BROKER_IDS, ["mt5", "ctrader"]);

  const identity = makeBrokerIdentity({
    broker: "oanda",
    externalId: "42",
    source: "nowhere",
  });

  assert.equal(identity.broker, null);
  assert.equal(identity.externalId, null);
  assert.equal(identity.key, null);
  assert.match(identity.note, /no adapter/i);
});

test("identity without an account id stays unidentified instead of guessing", () => {
  const identity = makeBrokerIdentity({ broker: "ctrader", externalId: null });

  assert.equal(identity.broker, "ctrader");
  assert.equal(identity.externalId, null);
  assert.equal(identity.key, null);
  assert.match(identity.note, /no external/i);
});

// ============================================================
// MT5 IDENTITY
// ============================================================

test("mt5 identity comes from the bridge's own account, never from a request parameter", async () => {
  const snapshot = await mt5Fixture({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse(BRIDGE_CONNECTED),
  }).probe();

  assert.equal(snapshot.identity.broker, "mt5");
  assert.equal(snapshot.identity.externalId, "12345678");
  assert.equal(snapshot.identity.server, "MetaQuotes-Demo");
  assert.equal(snapshot.identity.key, "mt5:12345678");
});

test("an mt5 session that is not logged in publishes no account id", async () => {
  const snapshot = await mt5Fixture({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse(
      { success: false, connected: false, message: "MT5 is not connected." },
      { ok: false, status: 503 }
    ),
  }).probe();

  assert.equal(snapshot.identity.broker, "mt5");
  assert.equal(snapshot.identity.externalId, null);
  assert.equal(snapshot.identity.key, null);
});

test("mt5 keeps its server so two logins on different servers stay distinct", async () => {
  const snapshot = await mt5Fixture({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse({
      ...BRIDGE_CONNECTED,
      account: { login: 12345678, server: "InstaEquities-Live" },
    }),
  }).probe();

  assert.equal(snapshot.identity.server, "InstaEquities-Live");
  assert.equal(snapshot.session.identity.server, "InstaEquities-Live");
});

// ============================================================
// CTRADER IDENTITY
// ============================================================

test("ctrader identity is the account the authenticated socket is on", async () => {
  const snapshot = await ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId: "77001122",
    },
    live: [
      {
        accountId: "77001122",
        traderLogin: 445566,
        isLive: true,
        lastLoginTime: "2026-11-04T08:00:00.000Z",
      },
    ],
    auth: {
      connected: true,
      hasAccessToken: true,
      hasRefreshToken: false,
      activeAccountId: "77001122",
      accounts: [],
    },
  }).probe();

  assert.equal(snapshot.identity.broker, "ctrader");
  assert.equal(snapshot.identity.externalId, "77001122");
  assert.equal(snapshot.identity.traderLogin, "445566");
  assert.equal(snapshot.identity.server, null);
  assert.match(snapshot.identity.source, /authenticated/);
});

test("a cached selection does not become the live identity", async () => {
  const snapshot = await ctraderFixture({
    service: { running: false, connected: false },
    live: [],
    auth: {
      connected: true,
      hasAccessToken: true,
      hasRefreshToken: true,
      activeAccountId: "77001122",
      accounts: [
        { accountId: "77001122", name: "Main demo", createdAt: "2026-09-01" },
      ],
    },
  }).probe();

  assert.equal(snapshot.connection.state, "disconnected");
  assert.equal(snapshot.identity.externalId, null);
  assert.equal(snapshot.identity.requestedAccountId, "77001122");
  assert.equal(snapshot.identity.matchesRequestedAccount, false);
  assert.match(snapshot.identity.source, /cache|not connected/i);
});

test("a selected cTrader account is unidentified before authentication", async () => {
  const snapshot = await ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: false,
      ready: false,
      tradingAccountId: "77001122",
    },
    live: [],
    auth: { activeAccountId: "77001122", accounts: [] },
  }).probe();

  assert.equal(snapshot.connection.state, "authenticating");
  assert.equal(snapshot.identity.externalId, null);
  assert.equal(snapshot.identity.key, null);
  assert.equal(snapshot.identity.requestedAccountId, "77001122");
  assert.match(snapshot.identity.note, /authenticated|ready/i);
});

test("an authenticated cTrader account is unidentified until ready", async () => {
  const snapshot = await ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: false,
      tradingAccountId: "77001122",
    },
    live: [],
    auth: { activeAccountId: "77001122", accounts: [] },
  }).probe();

  assert.equal(snapshot.connection.state, "authenticating");
  assert.equal(snapshot.identity.externalId, null);
  assert.equal(snapshot.identity.key, null);
});

test("a service account that differs from the selection is reported, not reconciled", async () => {
  const snapshot = await ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId: "99999999",
    },
    live: [{ accountId: "99999999", traderLogin: 1, isLive: true }],
    auth: {
      connected: true,
      hasAccessToken: true,
      hasRefreshToken: false,
      activeAccountId: "77001122",
      accounts: [],
    },
  }).probe();

  assert.equal(snapshot.identity.externalId, "99999999");
  assert.equal(snapshot.identity.requestedAccountId, "77001122");
  assert.equal(snapshot.identity.matchesRequestedAccount, false);
  assert.equal(snapshot.accounts.mismatch, true);
});

// ============================================================
// NO CROSS-BROKER IDENTITY
// ============================================================

test("both brokers publish distinct identities side by side", async () => {
  const mt5 = mt5Fixture({
    "/health": jsonResponse({ status: "ok" }),
    "/mt5/status": jsonResponse(BRIDGE_CONNECTED),
  });

  const ctrader = ctraderFixture({
    service: {
      running: true,
      connected: true,
      authenticated: true,
      ready: true,
      tradingAccountId: "12345678",
    },
    live: [{ accountId: "12345678", traderLogin: 2, isLive: true }],
    auth: {
      connected: true,
      hasAccessToken: true,
      hasRefreshToken: false,
      activeAccountId: "12345678",
      accounts: [],
    },
  });

  const payload = await buildStatusResponse([mt5, ctrader]);

  assert.equal(payload.brokers.mt5.identity.key, "mt5:12345678");
  assert.equal(payload.brokers.ctrader.identity.key, "ctrader:12345678");
  assert.notEqual(payload.brokers.mt5.identity.key, payload.brokers.ctrader.identity.key);

  assert.deepEqual(payload.identityConflicts, []);
});

test("the registry flags a snapshot whose identity names another broker", async () => {
  const lying = {
    id: "ctrader",
    probe: async () => ({
      id: "ctrader",
      identity: { broker: "mt5", externalId: "12345678", key: "mt5:12345678" },
      connection: { state: "connected" },
    }),
    listAccounts: async () => ({ items: [] }),
  };

  const healthy = {
    id: "mt5",
    probe: async () => ({
      id: "mt5",
      identity: { broker: "mt5", externalId: "12345678", key: "mt5:12345678" },
      connection: { state: "connected" },
    }),
    listAccounts: async () => ({ items: [] }),
  };

  const payload = await buildStatusResponse([healthy, lying]);

  assert.equal(payload.brokers.ctrader.identity.broker, "mt5");
  assert.equal(payload.identityConflicts.length, 1);
  assert.equal(payload.identityConflicts[0].adapterId, "ctrader");
  assert.equal(payload.identityConflicts[0].claimedBroker, "mt5");

  const codes = payload.brokers.ctrader.errors.map((error) => error.code);

  assert.ok(codes.includes("identity_mismatch"));
});

test("a snapshot with no identity block is reported as missing, not invented", async () => {
  const bare = {
    id: "mt5",
    probe: async () => ({ id: "mt5", connection: { state: "connected" } }),
    listAccounts: async () => ({ items: [] }),
  };

  const payload = await buildStatusResponse([bare]);

  assert.equal(payload.brokers.mt5.identity.broker, "mt5");
  assert.equal(payload.brokers.mt5.identity.externalId, null);
  assert.match(payload.brokers.mt5.identity.note, /did not report/i);
  assert.deepEqual(payload.identityConflicts, []);
});

test("an identity with a key but no external id is incomplete and unidentified", async () => {
  const incomplete = {
    id: "mt5",
    probe: async () => ({
      id: "mt5",
      identity: { broker: "mt5", externalId: null, key: "mt5:12345678" },
      connection: { state: "connected" },
    }),
    listAccounts: async () => ({ items: [] }),
  };

  const payload = await buildStatusResponse([incomplete]);

  assert.equal(payload.brokers.mt5.identity.externalId, null);
  assert.equal(payload.brokers.mt5.identity.key, null);
  assert.equal(payload.identityConflicts.length, 1);
  assert.ok(
    payload.brokers.mt5.errors.some((error) => error.code === "identity_incomplete")
  );
});

test("an incoherent identity key is flagged and never published as valid", async () => {
  const incoherent = {
    id: "mt5",
    probe: async () => ({
      id: "mt5",
      identity: { broker: "mt5", externalId: "12345678", key: "ctrader:12345678" },
      connection: { state: "connected" },
    }),
    listAccounts: async () => ({ items: [] }),
  };

  const payload = await buildStatusResponse([incoherent]);

  assert.equal(payload.brokers.mt5.identity.externalId, "12345678");
  assert.equal(payload.brokers.mt5.identity.key, null);
  assert.equal(payload.identityConflicts.length, 1);
  assert.ok(
    payload.brokers.mt5.errors.some((error) => error.code === "identity_key_mismatch")
  );
});

test("an adapter exception publishes an error state without an account key", async () => {
  const failed = {
    id: "ctrader",
    probe: async () => {
      throw new Error("injected probe failure");
    },
    listAccounts: async () => ({ items: [] }),
  };

  const payload = await buildStatusResponse([failed]);

  assert.equal(payload.brokers.ctrader.connection.state, "error");
  assert.equal(payload.brokers.ctrader.identity.key, null);
});
