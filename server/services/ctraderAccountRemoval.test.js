import test from "node:test";
import assert from "node:assert/strict";

import { planAccountRemoval } from "./ctraderAccountSelection.js";

/* ============================================================
   REMOVING AN ACCOUNT ACTIVATES NO SUCCESSOR

   Removing the active cTrader account stops the one service that
   was authenticated as it. The accounts left in the store were
   never authenticated by that session, so none of them is a safe
   automatic choice: promoting the sole remaining account would
   leave activeAccountId naming an account nobody selected, and the
   order endpoints read that value. Removal therefore ends with no
   active account at all, and starting any successor is an explicit
   act the owner performs afterwards.

   The plan is also the only place that decides whether the running
   service must be torn down, so an inactive removal cannot disturb
   a live session.
   ============================================================ */

function record(accountId, name = "Trading Account") {
  return {
    id: `account-${accountId}`,
    accountId,
    name,
    createdAt: "2026-11-10T00:00:00.000Z",
  };
}

function int64(text) {
  return {
    __Long: true,
    toString: () => text,
  };
}

test("removing the active account with one remaining selects no successor", () => {
  const plan = planAccountRemoval({
    accounts: [record("77001122"), record("88990011")],
    activeAccountId: "77001122",
    accountId: "77001122",
  });

  assert.equal(
    plan.ok,
    true,
    "a stored account is removable"
  );
  assert.equal(
    plan.activeAccountId,
    null,
    "the sole remaining account must not become active"
  );
  assert.equal(
    plan.code,
    "active_account_removed",
    "removing the active account is reported as such"
  );
  assert.equal(
    plan.mustStopService,
    true,
    "the service authenticated as the removed account has to be stopped"
  );
  assert.deepEqual(
    plan.accounts.map((account) => account.accountId),
    ["88990011"],
    "only the requested account is removed"
  );
});

test("removing the active account with several remaining selects no successor", () => {
  const plan = planAccountRemoval({
    accounts: [record("77001122"), record("88990011"), record("12345678")],
    activeAccountId: "77001122",
    accountId: "77001122",
  });

  assert.equal(plan.ok, true, "a stored account is removable");
  assert.equal(
    plan.activeAccountId,
    null,
    "an ambiguous remaining list must not be resolved by position"
  );

  for (const account of plan.accounts) {
    assert.notEqual(
      plan.activeAccountId,
      account.accountId,
      "no remaining account may be reported as active"
    );
  }

  assert.equal(
    plan.mustStopService,
    true,
    "the service authenticated as the removed account has to be stopped"
  );
});

test("removing the last account leaves nothing active", () => {
  const plan = planAccountRemoval({
    accounts: [record("77001122")],
    activeAccountId: "77001122",
    accountId: "77001122",
  });

  assert.equal(plan.ok, true, "a stored account is removable");
  assert.deepEqual(plan.accounts, [], "the account list ends empty");
  assert.equal(
    plan.activeAccountId,
    null,
    "an empty list cannot name an active account"
  );
  assert.equal(
    plan.mustStopService,
    true,
    "the service authenticated as the removed account has to be stopped"
  );
});

test("removing an inactive account preserves the active account and the running service", () => {
  const plan = planAccountRemoval({
    accounts: [record("77001122"), record("88990011")],
    activeAccountId: "77001122",
    accountId: "88990011",
  });

  assert.equal(plan.ok, true, "a stored account is removable");
  assert.equal(
    plan.code,
    "inactive_account_removed",
    "removing an inactive account is reported as such"
  );
  assert.equal(
    plan.activeAccountId,
    "77001122",
    "the untouched session keeps its active account"
  );
  assert.equal(
    plan.mustStopService,
    false,
    "removing an account that is not in use must not tear the session down"
  );
  assert.deepEqual(
    plan.accounts.map((account) => account.accountId),
    ["77001122"],
    "only the requested account is removed"
  );
});

test("removing an inactive account with nothing active leaves nothing active", () => {
  const plan = planAccountRemoval({
    accounts: [record("77001122"), record("88990011")],
    activeAccountId: null,
    accountId: "88990011",
  });

  assert.equal(plan.ok, true, "a stored account is removable");
  assert.equal(
    plan.activeAccountId,
    null,
    "removal cannot invent an active account"
  );
  assert.equal(
    plan.mustStopService,
    false,
    "nothing was authenticated as the removed account"
  );
});

test("the plan keeps the remaining accounts in their stored order and identity", () => {
  const stored = [record("11111111"), record("22222222"), record("33333333")];
  const plan = planAccountRemoval({
    accounts: stored,
    activeAccountId: "22222222",
    accountId: "22222222",
  });

  assert.deepEqual(
    plan.accounts.map((account) => account.id),
    ["account-11111111", "account-33333333"],
    "the remaining records keep their own ids and order"
  );
  assert.equal(
    plan.accounts[0],
    stored[0],
    "the plan reports the stored records rather than copies of them"
  );
  assert.equal(
    plan.removedAccount,
    stored[1],
    "the removed record is handed back for logging"
  );
  assert.deepEqual(
    stored.map((account) => account.accountId),
    ["11111111", "22222222", "33333333"],
    "planning must not mutate the caller's account list"
  );
});

test("an account id is matched by value, not by its javascript type", () => {
  const numeric = planAccountRemoval({
    accounts: [record(77001122), record("88990011")],
    activeAccountId: 77001122,
    accountId: "77001122",
  });

  assert.equal(
    numeric.ok,
    true,
    "a numeric stored id matches the text id from the request"
  );
  assert.equal(
    numeric.activeAccountId,
    null,
    "the account was active, so nothing is left active"
  );
  assert.equal(
    numeric.mustStopService,
    true,
    "the active account was removed"
  );

  const longLike = planAccountRemoval({
    accounts: [record(int64("77001122")), record("88990011")],
    activeAccountId: int64("77001122"),
    accountId: "77001122",
  });

  assert.equal(
    longLike.ok,
    true,
    "a Long-like stored id matches the text id from the request"
  );
  assert.equal(
    longLike.mustStopService,
    true,
    "the active account was removed"
  );
});

test("an unknown account is refused with nothing changed", () => {
  const stored = [record("77001122"), record("88990011")];
  const plan = planAccountRemoval({
    accounts: stored,
    activeAccountId: "77001122",
    accountId: "55556666",
  });

  assert.equal(plan.ok, false, "an unstored account cannot be removed");
  assert.equal(
    plan.code,
    "account_not_found",
    "the refusal says the account was not stored"
  );
  assert.equal(
    plan.accountId,
    null,
    "a refusal names no account"
  );
  assert.equal(
    plan.activeAccountId,
    null,
    "a refusal leaves no active account behind"
  );
  assert.equal(
    plan.accounts,
    null,
    "a refusal hands back no replacement list"
  );
  assert.equal(
    plan.removedAccount,
    null,
    "a refusal removed nothing"
  );
  assert.equal(
    plan.mustStopService,
    false,
    "a refusal must not stop a running session"
  );
  assert.equal(
    /no account was removed/i.test(plan.message),
    true,
    "the refusal states plainly that nothing was removed"
  );
  assert.deepEqual(
    stored.map((account) => account.accountId),
    ["77001122", "88990011"],
    "a refused removal leaves the list untouched"
  );
});

test("an unusable account id is refused without throwing", () => {
  for (const accountId of [
    undefined,
    null,
    "",
    "   ",
    {},
    [],
    NaN,
    int64("[object Object]"),
  ]) {
    const plan = planAccountRemoval({
      accounts: [record("77001122")],
      activeAccountId: "77001122",
      accountId,
    });

    assert.equal(
      plan.ok,
      false,
      `${JSON.stringify(accountId) === undefined ? String(accountId) : JSON.stringify(accountId)} is not an account id`
    );
    assert.equal(plan.code, "account_not_found", "nothing matched");
    assert.equal(plan.accounts, null, "no replacement list");
    assert.equal(plan.mustStopService, false, "no teardown");
  }
});

test("an unusable account list is refused without throwing", () => {
  for (const accounts of [undefined, null, "77001122", 77001122, {}]) {
    const plan = planAccountRemoval({
      accounts,
      activeAccountId: "77001122",
      accountId: "77001122",
    });

    assert.equal(
      plan.ok,
      false,
      `${JSON.stringify(accounts)} is not an account list`
    );
    assert.equal(plan.code, "account_not_found", "nothing matched");
    assert.equal(plan.accounts, null, "no replacement list");
    assert.equal(plan.mustStopService, false, "no teardown");
  }
});

test("a malformed record is not treated as a match", () => {
  const plan = planAccountRemoval({
    accounts: [record("77001122"), { name: "no id" }, null],
    activeAccountId: "77001122",
    accountId: "88990011",
  });

  assert.equal(
    plan.ok,
    false,
    "a record without an account id was never addressable"
  );
  assert.equal(plan.code, "account_not_found", "nothing matched");
  assert.equal(plan.accounts, null, "no replacement list");
});

test("the active id alone decides the teardown", () => {
  const cases = [
    {
      label: "active account removed",
      activeAccountId: "77001122",
      accountId: "77001122",
      mustStopService: true,
    },
    {
      label: "inactive account removed",
      activeAccountId: "77001122",
      accountId: "88990011",
      mustStopService: false,
    },
    {
      label: "nothing active",
      activeAccountId: null,
      accountId: "77001122",
      mustStopService: false,
    },
  ];

  for (const entry of cases) {
    const plan = planAccountRemoval({
      accounts: [record("77001122"), record("88990011")],
      activeAccountId: entry.activeAccountId,
      accountId: entry.accountId,
    });

    assert.equal(
      plan.mustStopService,
      entry.mustStopService,
      `${entry.label} must decide the teardown this way`
    );
  }
});
