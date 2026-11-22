import test from "node:test";
import assert from "node:assert/strict";

import * as identity from "../brokers/identity.js";
import * as domain from "./ctraderAccountSelection.js";

function savedAccount(
  accountId,
  externalAccountId,
  environment = "demo",
  overrides = {}
) {
  return {
    accountId,
    externalAccountId: String(externalAccountId),
    brokerId: "ic-markets",
    platformId: "ctrader",
    environment,
    label: null,
    ...overrides,
  };
}

test("the trading account contract keeps broker platform environment and both ids explicit", () => {
  assert.equal(identity.IC_MARKETS_BROKER_ID, "ic-markets");
  assert.equal(identity.CTRADER_PLATFORM_ID, "ctrader");
  assert.deepEqual(identity.TRADING_ENVIRONMENTS, ["demo", "live"]);

  const result = identity.makeTradingAccount({
    accountId: " local-account-1 ",
    externalAccountId: 900001,
    brokerId: "ic-markets",
    platformId: "ctrader",
    environment: "demo",
    label: "  Main account  ",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.account, {
    accountId: "local-account-1",
    externalAccountId: "900001",
    brokerId: "ic-markets",
    platformId: "ctrader",
    environment: "demo",
    label: "Main account",
  });
});

test("a trading account requires stable local and external ids", () => {
  const missingLocal = identity.makeTradingAccount({
    ...savedAccount("local-1", "900001"),
    accountId: " ",
  });
  const missingExternal = identity.makeTradingAccount({
    ...savedAccount("local-1", "900001"),
    externalAccountId: null,
  });

  assert.equal(missingLocal.ok, false);
  assert.equal(missingLocal.code, "account_id_required");
  assert.equal(missingExternal.ok, false);
  assert.equal(missingExternal.code, "external_account_id_required");
});

test("an account cannot claim another broker or platform", () => {
  const broker = identity.makeTradingAccount({
    ...savedAccount("local-1", "900001"),
    brokerId: "another-broker",
  });
  const platform = identity.makeTradingAccount({
    ...savedAccount("local-1", "900001"),
    platformId: "another-platform",
  });

  assert.equal(broker.ok, false);
  assert.equal(broker.code, "unsupported_broker");
  assert.equal(broker.account, null);
  assert.equal(platform.ok, false);
  assert.equal(platform.code, "unsupported_platform");
  assert.equal(platform.account, null);
});

test("unknown environments stay unknown instead of becoming demo or live", () => {
  for (const value of [undefined, null, "", "production", "real", 42]) {
    assert.equal(identity.normalizeTradingEnvironment(value), "unknown");
  }

  assert.equal(identity.normalizeTradingEnvironment(" Demo "), "demo");
  assert.equal(identity.normalizeTradingEnvironment("LIVE"), "live");

  const result = identity.makeTradingAccount(
    savedAccount("local-unknown", "900002", "production")
  );

  assert.equal(result.ok, true);
  assert.equal(result.account.environment, "unknown");
});

test("external account scope includes platform and environment and stringifies the id", () => {
  const input = {
    platformId: "ctrader",
    environment: "demo",
    externalAccountId: 900003,
  };

  assert.equal(domain.tradingAccountScopeKey(input), "ctrader:demo:900003");
  assert.equal(
    domain.tradingAccountScopeKey({ ...input, environment: "live" }),
    "ctrader:live:900003"
  );
  assert.equal(
    domain.tradingAccountScopeKey({ ...input, platformId: "another-platform" }),
    "another-platform:demo:900003"
  );
  assert.equal(
    domain.tradingAccountScopeKey({ ...input, environment: "unconfirmed" }),
    "ctrader:unknown:900003"
  );
  assert.equal(
    domain.tradingAccountScopeKey({ ...input, externalAccountId: null }),
    null
  );
});

test("saving a discovered account into an empty list selects nothing", () => {
  const plan = domain.planTradingAccountAddition({
    accounts: [],
    activeAccountId: null,
    account: savedAccount("local-1", "900010"),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.activeAccountId, null);
  assert.deepEqual(plan.accounts.map((account) => account.accountId), ["local-1"]);
});

test("adding an account never switches the existing explicit selection", () => {
  const accounts = [savedAccount("local-1", "900010")];
  const plan = domain.planTradingAccountAddition({
    accounts,
    activeAccountId: "local-1",
    account: savedAccount("local-2", "900011"),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.activeAccountId, "local-1");
  assert.deepEqual(plan.accounts.map((account) => account.accountId), [
    "local-1",
    "local-2",
  ]);
  assert.equal(accounts.length, 1);
});

test("addition refuses a dangling active id instead of saving invalid state", () => {
  const accounts = [savedAccount("local-1", "900010")];
  const plan = domain.planTradingAccountAddition({
    accounts,
    activeAccountId: "deleted-account",
    account: savedAccount("local-2", "900011"),
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "invalid_active_account");
  assert.equal(plan.accounts, accounts);
  assert.equal(plan.activeAccountId, "deleted-account");
  assert.equal(accounts.length, 1);
});

test("a duplicate stable local account id is refused without mutation", () => {
  const accounts = [savedAccount("local-1", "900010")];
  const plan = domain.planTradingAccountAddition({
    accounts,
    activeAccountId: "local-1",
    account: savedAccount("local-1", "900099"),
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "account_id_conflict");
  assert.equal(plan.accounts, accounts);
  assert.equal(plan.activeAccountId, "local-1");
  assert.equal(accounts[0].externalAccountId, "900010");
});

test("an external id cannot collide inside the same platform and environment", () => {
  const accounts = [savedAccount("local-1", "900020", "demo")];
  const plan = domain.planTradingAccountAddition({
    accounts,
    activeAccountId: null,
    account: savedAccount("local-2", "900020", "demo"),
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "external_account_conflict");
  assert.equal(plan.accounts, accounts);
  assert.equal(plan.activeAccountId, null);
});

test("the same external id may exist in different environment scopes", () => {
  const plan = domain.planTradingAccountAddition({
    accounts: [savedAccount("local-demo", "900020", "demo")],
    activeAccountId: null,
    account: savedAccount("local-live", "900020", "live"),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.activeAccountId, null);
  assert.deepEqual(plan.accounts.map((account) => account.environment), [
    "demo",
    "live",
  ]);
});

test("explicit selection chooses exactly the requested saved account", () => {
  const accounts = [
    savedAccount("local-1", "900030"),
    savedAccount("local-2", "900031"),
  ];
  const plan = domain.planExplicitAccountSelection({
    accounts,
    activeAccountId: "local-1",
    accountId: "local-2",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.accountId, "local-2");
  assert.equal(plan.activeAccountId, "local-2");
  assert.equal(plan.accounts, accounts);
});

test("a sole saved account still requires an explicit selection", () => {
  const accounts = [savedAccount("local-1", "900030")];
  const plan = domain.planExplicitAccountSelection({
    accounts,
    activeAccountId: null,
    accountId: null,
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "explicit_selection_required");
  assert.equal(plan.accountId, null);
  assert.equal(plan.activeAccountId, null);
  assert.equal(plan.accounts, accounts);
});

test("invalid selection is refused with the original state returned unchanged", () => {
  const accounts = [
    savedAccount("local-1", "900030"),
    savedAccount("local-2", "900031"),
  ];
  const original = JSON.stringify(accounts);
  const plan = domain.planExplicitAccountSelection({
    accounts,
    activeAccountId: "local-1",
    accountId: "missing-account",
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "requested_account_not_available");
  assert.equal(plan.accountId, null);
  assert.equal(plan.activeAccountId, "local-1");
  assert.equal(plan.accounts, accounts);
  assert.equal(JSON.stringify(accounts), original);
});

test("selection from an empty account list cannot invent an active account", () => {
  const accounts = [];
  const plan = domain.planExplicitAccountSelection({
    accounts,
    activeAccountId: null,
    accountId: "local-1",
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.accountId, null);
  assert.equal(plan.activeAccountId, null);
  assert.equal(plan.accounts, accounts);
});

test("startup restoration never selects the first or only account", () => {
  const one = [savedAccount("local-1", "900040")];
  const several = [one[0], savedAccount("local-2", "900041")];

  assert.equal(domain.restoreActiveAccountId({ accounts: [], activeAccountId: null }), null);
  assert.equal(domain.restoreActiveAccountId({ accounts: one, activeAccountId: null }), null);
  assert.equal(domain.restoreActiveAccountId({ accounts: several, activeAccountId: null }), null);
});

test("startup restoration keeps only an explicitly stored existing selection", () => {
  const accounts = [
    savedAccount("local-1", "900040"),
    savedAccount("local-2", "900041"),
  ];

  assert.equal(
    domain.restoreActiveAccountId({ accounts, activeAccountId: "local-2" }),
    "local-2"
  );
});

test("startup restoration clears a dangling selection without choosing a fallback", () => {
  const accounts = [savedAccount("local-1", "900040")];

  assert.equal(
    domain.restoreActiveAccountId({ accounts, activeAccountId: "deleted-account" }),
    null
  );
});

test("removing the active account clears selection even when one account remains", () => {
  const plan = domain.planAccountRemoval({
    accounts: [
      savedAccount("local-1", "900050"),
      savedAccount("local-2", "900051"),
    ],
    activeAccountId: "local-1",
    accountId: "local-1",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.activeAccountId, null);
  assert.deepEqual(plan.accounts.map((account) => account.accountId), ["local-2"]);
});

test("removing a non-active account preserves the explicit selection", () => {
  const plan = domain.planAccountRemoval({
    accounts: [
      savedAccount("local-1", "900050"),
      savedAccount("local-2", "900051"),
    ],
    activeAccountId: "local-1",
    accountId: "local-2",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.activeAccountId, "local-1");
  assert.equal(plan.mustStopService, false);
});

test("removal cannot preserve an active id that names no saved account", () => {
  const plan = domain.planAccountRemoval({
    accounts: [
      savedAccount("local-1", "900050"),
      savedAccount("local-2", "900051"),
    ],
    activeAccountId: "deleted-account",
    accountId: "local-2",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.activeAccountId, null);
});

test("unknown environment changes only after explicit valid confirmation", () => {
  const accounts = [savedAccount("local-unknown", "900060", "unknown")];
  const plan = domain.confirmTradingAccountEnvironment({
    accounts,
    activeAccountId: null,
    accountId: "local-unknown",
    environment: "live",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.accounts[0].environment, "live");
  assert.equal(plan.activeAccountId, null);
  assert.equal(accounts[0].environment, "unknown");
});

test("invalid environment confirmation is refused without guessing or selecting", () => {
  const accounts = [savedAccount("local-unknown", "900060", "unknown")];
  const plan = domain.confirmTradingAccountEnvironment({
    accounts,
    activeAccountId: null,
    accountId: "local-unknown",
    environment: "production",
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.code, "invalid_environment");
  assert.equal(plan.accounts, accounts);
  assert.equal(plan.activeAccountId, null);
  assert.equal(accounts[0].environment, "unknown");
});
