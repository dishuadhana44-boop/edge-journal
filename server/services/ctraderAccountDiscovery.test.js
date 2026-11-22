import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { projectLegacyState } from "./ctraderMigrationProjection.js";
import { createCtraderStore } from "./ctraderStore.js";

/* ============================================================
   B2-1 — THE DISCOVERY PROJECTION, OFFLINE

   Nothing here opens a socket, reads a file or asks the broker
   anything. The fixtures are synthetic ids in a clearly fake shape,
   and every assertion is about what the projection is allowed to hand
   back to a caller — never about what a live cTrader account looks
   like.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_FILE = path.join(HERE, "ctraderAccountDiscovery.js");

const MODULE_EXISTS = fs.existsSync(MODULE_FILE);
const MISSING =
  "server/services/ctraderAccountDiscovery.js does not exist, so there is nothing to project";

const localIdFor = (accountId) => `local-${accountId}`;

async function project(input) {
  assert.ok(MODULE_EXISTS, MISSING);

  const namespace = await import(pathToFileURL(MODULE_FILE).href);

  assert.equal(
    typeof namespace.projectCtraderDiscovery,
    "function",
    "the module does not export projectCtraderDiscovery"
  );

  return namespace.projectCtraderDiscovery(input);
}

const row = (accountId, extra = {}) => ({ accountId, ...extra });

const stored = (accountId, overrides = {}) => ({
  id: `account-${accountId}`,
  accountId: String(accountId),
  name: `Stored ${accountId}`,
  createdAt: "2026-11-19T00:00:00.000Z",
  ...overrides,
});

/* Every code the projection may answer with when it refuses, so a rule
   about refusals can be measured against all of them instead of the
   one that was convenient to write. */
const REFUSAL_CODES = [
  "discovery_response_not_a_list",
  "stored_accounts_not_a_list",
  "stored_account_unusable",
  "no_accounts_discovered",
  "ambiguous_stored_accounts",
  "ambiguous_discovered_accounts",
  "discovery_incomplete",
  "local_id_source_missing",
];

/* ============================================================
   WHAT IS NOT A LIST
   ============================================================ */

test("a broker response that is not a list is refused with a stable code", async () => {
  for (const value of [undefined, null, "1001", 1001, {}]) {
    const out = await project({ discoveredAccounts: value, storedAccounts: [] });

    assert.equal(out.ok, false, `${JSON.stringify(value)} was accepted as a response`);
    assert.equal(out.code, "discovery_response_not_a_list");
    assert.deepEqual(out.accounts, []);
  }
});

test("stored accounts that are not a list are refused", async () => {
  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: "1001",
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "stored_accounts_not_a_list");
  assert.deepEqual(out.accounts, []);
});

test("an empty broker response is refused rather than reported as complete", async () => {
  const out = await project({
    discoveredAccounts: [],
    storedAccounts: [stored(1001)],
  });

  assert.equal(out.ok, false, "an empty discovery was reported as success");
  assert.equal(out.code, "no_accounts_discovered");
  assert.deepEqual(out.accounts, []);
  assert.deepEqual(out.discoveredAccountIds, []);
});

/* ============================================================
   VALID RESPONSES
   ============================================================ */

test("one valid discovered account becomes exactly one candidate", async () => {
  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.equal(out.code, "discovery_projected");
  assert.deepEqual(out.accounts, [
    { id: "local-1001", accountId: "1001", name: null, createdAt: null },
  ]);
  assert.deepEqual(out.newAccountIds, ["1001"]);
  assert.deepEqual(out.matchedAccountIds, []);
});

test("several valid discovered accounts keep the order the response had", async () => {
  const out = await project({
    discoveredAccounts: [row(3003), row(1001), row(2002)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.deepEqual(
    out.accounts.map((account) => account.accountId),
    ["3003", "1001", "2002"]
  );
});

test("a numeric id, a padded string and a bigint settle on the same text", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), row(" 2002 "), row(3003n)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.deepEqual(
    out.accounts.map((account) => account.accountId),
    ["1001", "2002", "3003"]
  );
});

test("a protobuf int64 object is projected to the decimal text it prints", async () => {
  const long = {
    low: 1001,
    high: 0,
    unsigned: true,
    toString() {
      return "1001";
    },
  };

  const out = await project({
    discoveredAccounts: [row(long)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.equal(out.accounts[0].accountId, "1001");
});

/* ============================================================
   INVALID ROWS ARE REPORTED, NOT SILENTLY DROPPED
   ============================================================ */

test("a row whose account id is blank is rejected and the result is incomplete", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), row("   "), row(2002)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(
    out.ok,
    false,
    "a response with a blank id was reported as a complete discovery"
  );
  assert.equal(out.code, "discovery_incomplete");
  assert.deepEqual(out.accounts, []);
  assert.deepEqual(out.rejected, [{ index: 1, code: "account_id_unusable" }]);
});

test("a row whose account id is an unusable object is rejected", async () => {
  const out = await project({
    discoveredAccounts: [row({})],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "discovery_incomplete");
  assert.deepEqual(out.rejected, [{ index: 0, code: "account_id_unusable" }]);
});

test("a row that is not an object is rejected as a row, not as an id", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), null, "1002"],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, false);
  assert.deepEqual(out.rejected, [
    { index: 1, code: "row_not_an_object" },
    { index: 2, code: "row_not_an_object" },
  ]);
});

test("rejections name every bad row and no good one", async () => {
  const out = await project({
    discoveredAccounts: [row(""), row(1001), row(), row(Number.NaN), row(2002)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.deepEqual(
    out.rejected.map((entry) => entry.index),
    [0, 2, 3]
  );
});

/* ============================================================
   DUPLICATES
   ============================================================ */

test("duplicate account ids in the broker response are refused as ambiguous", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), row(2002), row(1001)],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(
    out.ok,
    false,
    "a response naming one account twice was projected as two candidates"
  );
  assert.equal(out.code, "ambiguous_discovered_accounts");
  assert.deepEqual(out.accounts, []);
});

test("ids that only differ by padding are still the same account", async () => {
  const out = await project({
    discoveredAccounts: [row("1001"), row(" 1001 ")],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "ambiguous_discovered_accounts");
});

test("ambiguity outranks incompleteness so the harder fault is the one reported", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), row(1001), row("")],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.code, "ambiguous_discovered_accounts");
  assert.deepEqual(out.rejected, [{ index: 2, code: "account_id_unusable" }]);
});

test("a stored list that already names one account twice is refused", async () => {
  const out = await project({
    discoveredAccounts: [row(3003)],
    storedAccounts: [stored(1001), stored(1001)],
    createLocalId: localIdFor,
  });

  assert.equal(
    out.ok,
    false,
    "a duplicated stored list was projected as though selection could still be decided"
  );
  assert.equal(out.code, "ambiguous_stored_accounts");
  assert.deepEqual(out.accounts, []);
});

/* ============================================================
   MEETING WHAT IS ALREADY SAVED
   ============================================================ */

test("a discovered id already stored reuses the stored record and adds no duplicate", async () => {
  const existing = stored(1001);

  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [existing],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.equal(out.accounts.length, 1, "the match produced a second record");
  assert.deepEqual(out.matchedAccountIds, ["1001"]);
  assert.deepEqual(out.newAccountIds, []);
});

test("stored metadata survives a match untouched", async () => {
  const existing = stored(1001, { name: "Live ISA", createdAt: "2026-01-01T00:00:00.000Z" });

  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [existing],
    createLocalId: localIdFor,
  });

  assert.deepEqual(out.accounts[0], existing);
});

test("a match is recognised through the identity rule, not the raw field", async () => {
  const out = await project({
    discoveredAccounts: [row(" 1001 ")],
    storedAccounts: [stored(1001)],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.deepEqual(out.matchedAccountIds, ["1001"]);
  assert.equal(out.accounts.length, 1);
});

test("a mixed response carries the stored record for the match and a fresh one for the rest", async () => {
  const existing = stored(1001);

  const out = await project({
    discoveredAccounts: [row(1001), row(2002)],
    storedAccounts: [existing],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.deepEqual(out.accounts[0], existing);
  assert.deepEqual(out.accounts[1], {
    id: "local-2002",
    accountId: "2002",
    name: null,
    createdAt: null,
  });
});

test("a new account is refused when no local id source was supplied", async () => {
  const out = await project({
    discoveredAccounts: [row(2002)],
    storedAccounts: [],
  });

  assert.equal(
    out.ok,
    false,
    "the projection invented an internal id of its own"
  );
  assert.equal(out.code, "local_id_source_missing");
  assert.deepEqual(out.accounts, []);
});

test("a response of only matches needs no local id source at all", async () => {
  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [stored(1001)],
  });

  assert.equal(out.ok, true);
  assert.deepEqual(out.newAccountIds, []);
});

/* ============================================================
   THE FOUR-KEY CEILING
   ============================================================ */

test("every candidate carries exactly the four permitted persistence keys", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), row(2002)],
    storedAccounts: [stored(1001)],
    createLocalId: localIdFor,
  });

  for (const account of out.accounts) {
    assert.deepEqual(Object.keys(account).sort(), [
      "accountId",
      "createdAt",
      "id",
      "name",
    ]);
  }
});

test("the candidate keys are the keys the migration projection emits", async () => {
  /* Both allow-lists are shown working on the same over-filled record, so
     a fifth key tolerated by one and refused by the other is the drift
     this measures. */
  const overflowing = {
    id: "account-1001",
    accountId: "1001",
    name: "Live ISA",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLive: true,
    traderLogin: 7788,
  };

  const { accounts } = projectLegacyState({
    connected: true,
    accessToken: "a",
    refreshToken: "b",
    expiresIn: 1,
    accounts: [overflowing],
    activeAccountId: null,
  });

  assert.deepEqual(Object.keys(accounts.accounts[0]).sort(), [
    "accountId",
    "createdAt",
    "id",
    "name",
  ]);

  const candidate = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [overflowing],
    createLocalId: localIdFor,
  });

  assert.deepEqual(
    Object.keys(candidate.accounts[0]).sort(),
    Object.keys(accounts.accounts[0]).sort(),
    "the discovery allow-list and the migration allow-list no longer agree"
  );
});

test("candidates survive the persistence contract itself", async () => {
  const out = await project({
    discoveredAccounts: [row(1001), row(2002)],
    storedAccounts: [stored(1001)],
    createLocalId: localIdFor,
  });

  const store = createCtraderStore({
    filePath: "synthetic/ctrader-auth.json",
    logger: { log() {}, error() {} },
    fileSystem: {
      existsSync: () => true,
      readFileSync: () =>
        JSON.stringify({
          connected: true,
          accessToken: "synthetic",
          refreshToken: "synthetic",
          expiresIn: 3600,
          accounts: out.accounts,
          activeAccountId: null,
        }),
    },
  });

  const loaded = store.load();

  assert.equal(loaded.accounts.length, 2);

  for (const account of loaded.accounts) {
    assert.deepEqual(Object.keys(account).sort(), [
      "accountId",
      "createdAt",
      "id",
      "name",
    ]);
  }
});

test("a credential misplaced on a stored record cannot ride into a candidate", async () => {
  const secret = "synthetic-access-token-material";

  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [stored(1001, { accessToken: secret, refreshToken: secret })],
    createLocalId: localIdFor,
  });

  const text = JSON.stringify(out);

  assert.equal(
    text.includes(secret),
    false,
    "the projection copied a credential out of a stored record"
  );
  assert.equal(Object.hasOwn(out.accounts[0], "accessToken"), false);
});

test("broker metadata beyond the id is not carried into a candidate", async () => {
  const out = await project({
    discoveredAccounts: [
      row(1001, {
        isLive: true,
        traderLogin: 7788,
        brokerTitleShort: "Synthetic Broker",
        lastClosingDealTimestamp: 1_700_000_000,
      }),
    ],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.deepEqual(out.accounts, [
    { id: "local-1001", accountId: "1001", name: null, createdAt: null },
  ]);
});

test("a refusal message names the id and quotes no other broker field", async () => {
  const marker = "synthetic-broker-title";

  const out = await project({
    discoveredAccounts: [row(1001), row(1001, { brokerTitleShort: marker })],
    storedAccounts: [],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, false);
  assert.equal(out.message.includes(marker), false);
  assert.equal(out.message.includes("1001"), true);
});

/* ============================================================
   PRESERVATION, IMMUTABILITY, SILENCE
   ============================================================ */

test("a stored account the broker did not grant is reported preserved, not removed", async () => {
  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [stored(1001), stored(9999)],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, true);
  assert.deepEqual(out.preservedAccountIds, ["9999"]);
  assert.equal(
    out.accounts.some((account) => account.accountId === "9999"),
    false,
    "discovery silently deleted an account it never saw"
  );
});

test("inputs are never mutated", async () => {
  const discoveredAccounts = [row(1001, { name: "Broker Side" })];
  const storedAccounts = [stored(2002)];

  const discoveredBefore = structuredClone(discoveredAccounts);
  const storedBefore = structuredClone(storedAccounts);

  const out = await project({
    discoveredAccounts,
    storedAccounts,
    createLocalId: localIdFor,
  });

  assert.deepEqual(discoveredAccounts, discoveredBefore);
  assert.deepEqual(storedAccounts, storedBefore);

  assert.notEqual(out.accounts[0], storedAccounts[0]);

  out.accounts[0].accountId = "tampered";

  assert.equal(
    storedAccounts[0].accountId,
    "2002",
    "a candidate shares its object with the stored record"
  );
});

test("the projection is deterministic", async () => {
  const input = {
    discoveredAccounts: [row(2002), row(1001)],
    storedAccounts: [stored(1001)],
    createLocalId: localIdFor,
  };

  const first = await project(input);
  const second = await project(input);

  assert.deepEqual(first, second);
});

test("the result reports no selection and no activation", async () => {
  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [stored(1001, { isDefault: true })],
    createLocalId: localIdFor,
  });

  assert.deepEqual(Object.keys(out).sort(), [
    "accounts",
    "code",
    "discoveredAccountIds",
    "matchedAccountIds",
    "message",
    "newAccountIds",
    "ok",
    "preservedAccountIds",
    "rejected",
  ]);

  assert.equal(Object.hasOwn(out, "activeAccountId"), false);
  assert.equal(Object.hasOwn(out, "activated"), false);
  assert.equal(Object.hasOwn(out, "selectedAccountId"), false);

  for (const account of out.accounts) {
    assert.equal(Object.hasOwn(account, "isDefault"), false);
    assert.equal(Object.hasOwn(account, "active"), false);
  }
});

test("an unusable stored record is refused rather than skipped", async () => {
  const out = await project({
    discoveredAccounts: [row(1001)],
    storedAccounts: [{ name: "no id at all" }],
    createLocalId: localIdFor,
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "stored_account_unusable");
  assert.deepEqual(out.accounts, []);
});

test("every refusal returns an empty candidate list", async () => {
  const cases = {
    discovery_response_not_a_list: { discoveredAccounts: "1001", storedAccounts: [] },
    stored_accounts_not_a_list: { discoveredAccounts: [row(1)], storedAccounts: {} },
    stored_account_unusable: {
      discoveredAccounts: [row(1)],
      storedAccounts: [{ name: "no id" }],
      createLocalId: localIdFor,
    },
    no_accounts_discovered: { discoveredAccounts: [], storedAccounts: [] },
    ambiguous_stored_accounts: {
      discoveredAccounts: [row(2)],
      storedAccounts: [stored(1), stored(1)],
      createLocalId: localIdFor,
    },
    ambiguous_discovered_accounts: {
      discoveredAccounts: [row(1), row(1)],
      storedAccounts: [],
      createLocalId: localIdFor,
    },
    discovery_incomplete: {
      discoveredAccounts: [row(1), row("")],
      storedAccounts: [],
      createLocalId: localIdFor,
    },
    local_id_source_missing: { discoveredAccounts: [row(1)], storedAccounts: [] },
  };

  for (const code of REFUSAL_CODES) {
    const out = await project(cases[code]);

    assert.equal(out.ok, false, `${code} was reported as success`);
    assert.equal(out.code, code);
    assert.deepEqual(
      out.accounts,
      [],
      `${code} still handed back a list a caller could save`
    );
    assert.equal(typeof out.message, "string");
    assert.ok(out.message.length > 0, `${code} refused without saying why`);
  }
});

test("the accepted result carries one code and the refusals carry distinct ones", async () => {
  const seen = new Set();

  for (const code of [...REFUSAL_CODES, "discovery_projected"]) {
    assert.equal(
      seen.has(code),
      false,
      `${code} appears twice in the refusal list`
    );
    seen.add(code);
  }
});

/* ============================================================
   WHAT THE MODULE MUST NOT DO
   ============================================================ */

test("the projection performs no I/O and reads no clock", () => {
  assert.ok(MODULE_EXISTS, MISSING);

  const text = fs.readFileSync(MODULE_FILE, "utf8").replace(/\r\n/g, "\n");

  /* Built from fragments so this test never matches its own file. */
  const forbidden = [
    ["node:" + "fs", "the module reads the filesystem"],
    ["node:" + "http", "the module makes HTTP requests"],
    ["node:" + "net", "the module opens a socket"],
    ["Web" + "Socket", "the module opens a WebSocket"],
    ["Date." + "now", "the module reads the clock"],
    ["new " + "Date", "the module reads the clock"],
    ["Math." + "random", "the module draws a random number"],
    ["process." + "env", "the module reads the environment"],
    ["ctidTraderAccountId", "the module quotes a raw broker payload key"],
  ];

  for (const [needle, complaint] of forbidden) {
    assert.equal(
      text.includes(needle),
      false,
      `${complaint}: found "${needle}"`
    );
  }

  assert.equal(
    /console\./.test(text),
    false,
    "the projection logs, so a caller cannot tell a refusal from a silent pass"
  );
});
