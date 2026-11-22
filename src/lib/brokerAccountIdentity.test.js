// ============================================================
// BROKER-AWARE ACCOUNT IDENTITY (Phase 2)
// ============================================================
//
// Covers src/lib/brokerAccountIdentity.js: the one identity model every
// account read and write goes through.
//
// Fixtures are copied field-for-field from the producers, not invented:
//   - trading account objects  -> normalizeTradingAccount() output shape,
//     src/components/settings/TradingAccountsPage.jsx:104-247
//   - MT5 live identity        -> bridge GET /mt5/status `account`,
//     mt5-bridge/app.py:2143-2158 (login, server, ...)
//   - cTrader live identity    -> buildAccountFromAuthorizedAccount(),
//     server/services/ctraderService.js:278-303 (accountId, traderLogin,
//     isLive, lastLoginTime)
//   - per-account storage keys -> getAccountStorageKey(),
//     src/context/TradeContext.jsx:56-65
//
// WHAT THIS CANNOT PROVE, stated up front: it exercises the pure identity
// decisions. It does not mount React, so nothing here proves that
// TradeContext.jsx or the settings pages call these functions at the right
// moment; brokerAccountIdentityWiring.test.js asserts that wiring as text,
// and running it still needs a browser.

import test from "node:test";
import assert from "node:assert/strict";

import {
  BROKER_KEYS,
  normalizeBrokerKey,
  canonicalBrokerLabel,
  makeAccountIdentity,
  migrateTradingAccounts,
  accountsMatch,
  findAccountIndex,
  resolveActiveAccountData,
  accountStorageKey,
  legacyAccountStorageKey,
  loadAccountScopedData,
} from "./brokerAccountIdentity.js";

// ============================================================
// Fixtures
// ============================================================

function tradingAccount(overrides = {}) {
  return {
    id: "mt5-12345678",
    accountName: "MT5 Account 12345678",
    currency: "USD",
    startingBalance: 10000,
    balance: 10000,
    equity: 10055.5,
    accountType: "Live",
    leverage: 100,
    isDefault: false,
    isBrokerAccount: true,
    broker: "MT5",
    brokerAccountId: "12345678",
    connectionStatus: "connected",
    lastSynced: "2026-11-03T10:00:00.000Z",
    mt5Login: "12345678",
    mt5Server: "MetaQuotes-Demo",
    mt5Connected: true,
    mt5TerminalId: null,
    strategyId: null,
    strategyName: null,
    marginUsed: 120,
    freeMargin: 9935.5,
    floatingPnL: 55.5,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function ctraderAccount(overrides = {}) {
  return tradingAccount({
    id: "ctrader-77001122",
    accountName: "Main demo",
    broker: "cTrader",
    brokerAccountId: "77001122",
    mt5Login: null,
    mt5Server: null,
    mt5Connected: false,
    ...overrides,
  });
}

const MT5_LIVE = {
  broker: "mt5",
  externalId: "12345678",
  server: "MetaQuotes-Demo",
};

const CTRADER_LIVE = {
  broker: "ctrader",
  externalId: "77001122",
  server: null,
};

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));

  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    snapshot: () => Object.fromEntries(data),
  };
}

// ============================================================
// 1. THE DISCRIMINATOR
// ============================================================

test("normalizeBrokerKey canonicalises every label this codebase already writes", () => {
  assert.deepEqual(BROKER_KEYS, ["mt5", "ctrader"]);

  assert.equal(normalizeBrokerKey("MT5"), "mt5");
  assert.equal(normalizeBrokerKey("mt5"), "mt5");
  assert.equal(normalizeBrokerKey(" mt5 "), "mt5");
  assert.equal(normalizeBrokerKey("cTrader"), "ctrader");
  assert.equal(normalizeBrokerKey("CTRADER"), "ctrader");
  assert.equal(normalizeBrokerKey("MetaTrader 5"), "mt5");
});

test("normalizeBrokerKey refuses to guess an unknown broker", () => {
  assert.equal(normalizeBrokerKey("OANDA"), null);
  assert.equal(normalizeBrokerKey(""), null);
  assert.equal(normalizeBrokerKey(null), null);
  assert.equal(normalizeBrokerKey(undefined), null);
  assert.equal(normalizeBrokerKey(42), null);
});

test("canonicalBrokerLabel maps back to the legacy display spelling", () => {
  assert.equal(canonicalBrokerLabel("mt5"), "MT5");
  assert.equal(canonicalBrokerLabel("ctrader"), "cTrader");
  assert.equal(canonicalBrokerLabel(null), null);
  assert.equal(canonicalBrokerLabel("oanda"), null);
});

// ============================================================
// 2. ACCOUNT IDENTITY
// ============================================================

test("identity uses the explicit broker and the broker's own external id", () => {
  const identity = makeAccountIdentity(tradingAccount());

  assert.equal(identity.brokerKey, "mt5");
  assert.equal(identity.externalId, "12345678");
  assert.equal(identity.server, "metaquotes-demo");
  assert.equal(identity.identityStatus, "explicit");
  assert.equal(identity.storageSegment, "mt5");

  const ctrader = makeAccountIdentity(ctraderAccount());

  assert.equal(ctrader.brokerKey, "ctrader");
  assert.equal(ctrader.externalId, "77001122");
  assert.equal(ctrader.identityStatus, "explicit");
});

test("identity falls back to the id prefix only when no broker is recorded", () => {
  const legacy = tradingAccount({ broker: null, brokerAccountId: null });

  const identity = makeAccountIdentity(legacy);

  assert.equal(identity.brokerKey, "mt5");
  assert.equal(identity.identityStatus, "inferred_id_prefix");
  assert.equal(identity.externalId, "12345678");
});

test("identity stays absent instead of inventing a broker", () => {
  const manual = tradingAccount({
    id: "manual-1730000000000",
    accountName: "My Trading Account",
    broker: null,
    brokerAccountId: null,
    isBrokerAccount: false,
    mt5Login: null,
    mt5Server: null,
    accountType: "Manual",
  });

  const identity = makeAccountIdentity(manual);

  assert.equal(identity.brokerKey, null);
  assert.equal(identity.externalId, null);
  assert.equal(identity.identityStatus, "absent");
  assert.equal(identity.storageSegment, "unlinked");
});

test("an unrecognised broker label is recorded as unsupported, never reassigned", () => {
  const identity = makeAccountIdentity(
    tradingAccount({ broker: "OANDA", id: "oanda-999", mt5Login: null })
  );

  assert.equal(identity.brokerKey, null);
  assert.equal(identity.identityStatus, "unsupported");
  assert.equal(identity.rawBroker, "OANDA");
});

// A recorded broker is a claim about the account. Reassigning it because the
// local id happens to start with `mt5-` would hand an unsupported broker's
// record an MT5 identity, and from there MT5 balances, positions and storage
// keys. The prefix is only ever a guess for records that recorded nothing.
test("an explicit unsupported broker cannot be reassigned through an MT5 ID prefix", () => {
  const identity = makeAccountIdentity(
    tradingAccount({
      id: "mt5-12345678",
      broker: "OANDA",
      brokerAccountId: "12345678",
    })
  );

  assert.equal(identity.brokerKey, null);
  assert.equal(identity.identityStatus, "unsupported");
  assert.equal(identity.rawBroker, "OANDA");
});

// ============================================================
// 3. LEGACY MIGRATION PRESERVES USER DATA
// ============================================================

test("migration adds the discriminator without rewriting the legacy label", () => {
  const stored = tradingAccount({ broker: "mt5" });

  const result = migrateTradingAccounts([stored]);

  assert.equal(result.changed, true);
  assert.equal(result.accounts[0].broker, "mt5");
  assert.equal(result.accounts[0].brokerKey, "mt5");
  assert.equal(result.accounts[0].identityStatus, "explicit");
});

test("migration keeps every field it does not understand", () => {
  const odd = tradingAccount({
    myOwnNote: "keep me",
    nested: { deeply: [1, 2, 3] },
    strategyId: "strategy-42",
  });

  const result = migrateTradingAccounts([odd]);
  const migrated = result.accounts[0];

  assert.equal(migrated.myOwnNote, "keep me");
  assert.deepEqual(migrated.nested, { deeply: [1, 2, 3] });
  assert.equal(migrated.strategyId, "strategy-42");
  assert.equal(migrated.mt5Server, "MetaQuotes-Demo");
});

test("migration is idempotent", () => {
  const once = migrateTradingAccounts([tradingAccount(), ctraderAccount()]);
  const twice = migrateTradingAccounts(once.accounts);

  assert.equal(twice.changed, false);
  assert.deepEqual(twice.accounts, once.accounts);
});

test("migration never renumbers or replaces an account id", () => {
  const accounts = [
    tradingAccount(),
    tradingAccount({ id: "account-1690000000000", broker: null, mt5Login: null }),
    ctraderAccount(),
  ];

  const result = migrateTradingAccounts(accounts);

  assert.deepEqual(
    result.accounts.map((account) => account.id),
    accounts.map((account) => account.id)
  );
});

test("migration returns a list unchanged when storage holds anything but an array", () => {
  for (const value of [null, undefined, "{}", "not json", 7]) {
    const result = migrateTradingAccounts(value);

    assert.deepEqual(result.accounts, []);
    assert.equal(result.changed, false);
  }
});

test("migration reports what it changed, per account", () => {
  const result = migrateTradingAccounts([
    tradingAccount({ broker: null }),
    ctraderAccount(),
  ]);

  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].id, "mt5-12345678");
  assert.equal(result.changes[0].brokerKey, "mt5");
  assert.equal(result.changes[0].identityStatus, "inferred_id_prefix");
});

// ============================================================
// 4. CROSS-BROKER ISOLATION
// ============================================================

test("the same external id under two brokers is two different accounts", () => {
  const sharedId = "77001122";

  const asMt5 = tradingAccount({
    id: "mt5-77001122",
    broker: "MT5",
    brokerAccountId: sharedId,
    mt5Login: sharedId,
  });

  const asCtrader = ctraderAccount({ brokerAccountId: sharedId });

  assert.equal(accountsMatch(asMt5, asCtrader), false);
  assert.equal(accountsMatch(asCtrader, asMt5), false);
});

test("matching broker and external id is a match", () => {
  assert.equal(
    accountsMatch(ctraderAccount(), ctraderAccount({ id: "other-uuid" })),
    true
  );
});

test("an account with no broker never matches anything", () => {
  const unlinked = tradingAccount({
    id: "manual-1",
    broker: null,
    brokerAccountId: null,
    mt5Login: null,
  });

  assert.equal(accountsMatch(unlinked, ctraderAccount()), false);
  assert.equal(accountsMatch(ctraderAccount(), unlinked), false);
});

test("dedupe index requires the broker, so a cTrader sync cannot overwrite an MT5 account", () => {
  const accounts = [
    tradingAccount({ brokerAccountId: "77001122", mt5Login: "77001122" }),
    ctraderAccount(),
  ];

  const index = findAccountIndex(
    accounts,
    makeAccountIdentity(ctraderAccount())
  );

  assert.equal(index, 1);
  assert.equal(makeAccountIdentity(accounts[index]).brokerKey, "ctrader");
  assert.equal(accounts[index].id, "ctrader-77001122");
});

test("dedupe index is -1 when only the external id matches", () => {
  const accounts = [
    tradingAccount({ brokerAccountId: "77001122", mt5Login: "77001122" }),
  ];

  assert.equal(
    findAccountIndex(accounts, makeAccountIdentity(ctraderAccount())),
    -1
  );
});

// ============================================================
// 5. ACTIVE ACCOUNT / LIVE DATA VALIDATION
// ============================================================

test("MT5 live data is refused for a cTrader account", () => {
  const verdict = resolveActiveAccountData({
    accounts: [ctraderAccount()],
    selectedAccountId: "ctrader-77001122",
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "broker_mismatch");
  assert.equal(verdict.identity.brokerKey, "ctrader");
});

test("cTrader live data is refused for an MT5 account", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "mt5-12345678",
    liveIdentity: CTRADER_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "broker_mismatch");
});

test("a broker's data is refused when the selected account has no broker", () => {
  const verdict = resolveActiveAccountData({
    accounts: [
      tradingAccount({
        id: "manual-1",
        broker: null,
        brokerAccountId: null,
        mt5Login: null,
      }),
    ],
    selectedAccountId: "manual-1",
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "identity_absent");
});

test("same broker but a different login is refused", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "mt5-12345678",
    liveIdentity: { broker: "mt5", externalId: "87654321", server: "MetaQuotes-Demo" },
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "external_id_mismatch");
});

test("same broker and login but a different server is refused", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "mt5-12345678",
    liveIdentity: { broker: "mt5", externalId: "12345678", server: "ICMarkets-Live" },
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "server_mismatch");
});

test("an unknown selected account id is refused rather than trusted", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "ctrader-424242",
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "unknown_account");
  assert.equal(verdict.account, null);
});

test("a manual account with no live identity is still selectable", () => {
  const manual = tradingAccount({
    id: "manual-1",
    broker: null,
    brokerAccountId: null,
    mt5Login: null,
  });

  const verdict = resolveActiveAccountData({
    accounts: [manual],
    selectedAccountId: "manual-1",
    liveIdentity: null,
  });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.status, "ok");
});

// "No live identity" is not the same situation for the two kinds of record. A
// manual account never claims one, so it keeps its own data. A broker account
// does claim one, so accepting it without a live session would render stored
// numbers as current broker data.
test("a broker account with no live identity fails closed", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "mt5-12345678",
    liveIdentity: null,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "live_identity_unavailable");
});

test("an unsupported broker with no live identity remains unsupported", () => {
  const account = tradingAccount({ id: "mt5-12345678", broker: "OANDA" });

  const verdict = resolveActiveAccountData({
    accounts: [account],
    selectedAccountId: account.id,
    liveIdentity: null,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "identity_unsupported");
});

test("a fully matching MT5 account is accepted", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "mt5-12345678",
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.account.id, "mt5-12345678");
});

test("a fully matching cTrader account is accepted", () => {
  const verdict = resolveActiveAccountData({
    accounts: [ctraderAccount()],
    selectedAccountId: "ctrader-77001122",
    liveIdentity: CTRADER_LIVE,
  });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.status, "ok");
});

test("an account that stores a login but is not an MT5 account is not matched by login", () => {
  const verdict = resolveActiveAccountData({
    accounts: [ctraderAccount({ mt5Login: "12345678" })],
    selectedAccountId: "ctrader-77001122",
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "broker_mismatch");
});

test("no selection is reported as no_selection", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: null,
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "no_selection");
});

test("a missing live MT5 login is refused instead of failing open", () => {
  const verdict = resolveActiveAccountData({
    accounts: [tradingAccount()],
    selectedAccountId: "mt5-12345678",
    liveIdentity: { broker: "mt5", externalId: null, server: null },
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "live_identity_incomplete");
});

test("account-less cTrader positions are refused instead of failing open", () => {
  const verdict = resolveActiveAccountData({
    accounts: [ctraderAccount()],
    selectedAccountId: "ctrader-77001122",
    liveIdentity: { broker: "ctrader", externalId: null },
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "live_identity_incomplete");
});

test("a broker-labelled account without its external id is not identifiable", () => {
  const verdict = resolveActiveAccountData({
    accounts: [
      tradingAccount({
        id: "broker-record-without-external-id",
        brokerAccountId: null,
        mt5Login: null,
      }),
    ],
    selectedAccountId: "broker-record-without-external-id",
    liveIdentity: MT5_LIVE,
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, "identity_incomplete");
});

// ============================================================
// 6. BROKER-SCOPED PER-ACCOUNT STORAGE
// ============================================================

test("storage keys are broker-scoped", () => {
  const mt5Key = accountStorageKey("edgeflo_open_trades", {
    brokerKey: "mt5",
    accountId: "77001122",
  });

  const ctraderKey = accountStorageKey("edgeflo_open_trades", {
    brokerKey: "ctrader",
    accountId: "77001122",
  });

  assert.equal(mt5Key, "edgeflo_open_trades_mt5_77001122");
  assert.equal(ctraderKey, "edgeflo_open_trades_ctrader_77001122");
  assert.notEqual(mt5Key, ctraderKey);
});

test("an unlinked account gets its own segment, not another broker's", () => {
  assert.equal(
    accountStorageKey("edgeflo_account", {
      brokerKey: null,
      accountId: "manual-1",
    }),
    "edgeflo_account_unlinked_manual-1"
  );
});

test("a missing account id yields no key instead of a shared bucket", () => {
  assert.equal(accountStorageKey("edgeflo_account", { accountId: null }), null);
  assert.equal(legacyAccountStorageKey("edgeflo_account", null), null);
});

test("legacy data is still readable, and is never silently duplicated", () => {
  const storage = memoryStorage({
    edgeflo_open_trades_mt5_12345678: JSON.stringify([
      { id: "new", broker: "MT5" },
    ]),
    edgeflo_open_trades_87654321: JSON.stringify([
      { id: "legacy", broker: "MT5" },
    ]),
  });

  const fresh = loadAccountScopedData(storage, "edgeflo_open_trades", {
    brokerKey: "mt5",
    accountId: "12345678",
    fallback: [],
  });

  assert.equal(fresh.status, "broker_scoped");
  assert.equal(fresh.value[0].id, "new");

  const legacy = loadAccountScopedData(storage, "edgeflo_open_trades", {
    brokerKey: "mt5",
    accountId: "87654321",
    fallback: [],
  });

  assert.equal(legacy.status, "legacy");
  assert.equal(legacy.value[0].id, "legacy");
  assert.equal(legacy.key, "edgeflo_open_trades_87654321");
});

test("broker-scoped data wins when both shapes exist", () => {
  const storage = memoryStorage({
    edgeflo_account_mt5_1: JSON.stringify({ balance: 200 }),
    edgeflo_account_1: JSON.stringify({ balance: 100 }),
  });

  const loaded = loadAccountScopedData(storage, "edgeflo_account", {
    brokerKey: "mt5",
    accountId: "1",
    fallback: null,
  });

  assert.equal(loaded.status, "broker_scoped");
  assert.equal(loaded.value.balance, 200);
});

test("reading an absent account returns the fallback without touching storage", () => {
  const storage = memoryStorage();

  const loaded = loadAccountScopedData(storage, "edgeflo_closed_trades", {
    brokerKey: "ctrader",
    accountId: "404",
    fallback: [],
  });

  assert.equal(loaded.status, "absent");
  assert.deepEqual(loaded.value, []);
  assert.deepEqual(storage.snapshot(), {});
});

test("a corrupt stored value degrades to the fallback instead of throwing", () => {
  const storage = memoryStorage({
    edgeflo_pending_orders_mt5_1: "{ not json",
  });

  const loaded = loadAccountScopedData(storage, "edgeflo_pending_orders", {
    brokerKey: "mt5",
    accountId: "1",
    fallback: [],
  });

  assert.equal(loaded.status, "corrupt");
  assert.deepEqual(loaded.value, []);
});

test("writing uses the broker-scoped key only", () => {
  const storage = memoryStorage({
    edgeflo_open_trades_1: JSON.stringify([{ id: "legacy" }]),
  });

  const key = accountStorageKey("edgeflo_open_trades", {
    brokerKey: "ctrader",
    accountId: "1",
  });

  storage.setItem(key, JSON.stringify([{ id: "fresh" }]));

  assert.deepEqual(
    Object.keys(storage.snapshot()).sort(),
    ["edgeflo_open_trades_1", "edgeflo_open_trades_ctrader_1"]
  );
  assert.equal(storage.getItem("edgeflo_open_trades_1").includes("legacy"), true);
});

test("identity of an account with no id has no storage key", () => {
  const identity = makeAccountIdentity({ broker: "MT5", id: null });

  assert.equal(identity.accountId, null);
  assert.equal(
    accountStorageKey("edgeflo_account", identity),
    null
  );
});
