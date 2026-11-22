import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  selectAccountById,
  verifyAuthenticatedAccount,
} from "./ctraderAccountSelection.js";

/* ============================================================
   PHASE 4A TASK 5 — fail-closed account selection
   PHASE 2.1-E TASK 1 — the shared rule is explicit-only

   Choosing an account by list position is choosing an account at
   random: nothing in this codebase has ever observed how cTrader
   orders the authorized accounts, and the access token can name
   several of them. A requested account that is missing, blank,
   duplicated or mismatched must be refused, never replaced — and
   an authenticated session must only be adopted when it names the
   exact account that was requested.

   Refusing a missing request is the same rule as refusing a bad one.
   A caller that named no account asked for none, and "there happened
   to be exactly one" is not an answer to a question nobody asked — a
   sole saved account is the easiest accidental selection in the
   product, because it is the only shape a freshly connected single
   account ever presents.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

function readSource(relative) {
  return fs
    .readFileSync(path.join(HERE, relative), "utf8").replace(/\r\n/g, "\n");
}

const SERVICE_SOURCE = readSource("./ctraderService.js");
const ROUTE_SOURCE = readSource("../routes/ctrader.js");
const SELECTION_SOURCE = readSource("./ctraderAccountSelection.js");
const STORE_SOURCE = readSource("./ctraderStore.js");

function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);

  if (start === -1) {
    throw new Error(`${label}: start marker is missing`);
  }

  const end = source.indexOf(endMarker, start + startMarker.length);

  if (end === -1) {
    throw new Error(`${label}: end marker is missing`);
  }

  return source.slice(start, end);
}

function routeBlock(source, routePath, method) {
  const marker = source.indexOf(`"${routePath}"`);

  if (marker === -1) {
    throw new Error(`route ${routePath} is not registered`);
  }

  const start = source.lastIndexOf(`${method}(`, marker);
  const end = source.indexOf("router.", start + 1);

  return source.slice(start, end === -1 ? source.length : end);
}

/* Long-like values are how protobufjs hands back int64 fields. */

function int64(text) {
  return {
    __Long: true,
    toString: () => text,
  };
}

/* ============================================================
   THE SHARED RULE: selectAccountById
   ============================================================ */

test("an empty account list fails closed", () => {
  const result = selectAccountById({ accountIds: [], requestedAccountId: null });

  assert.equal(result.ok, false);
  assert.equal(result.accountId, null);
  assert.equal(result.code, "no_accounts_available");
});

test("a missing or non-array account list fails closed", () => {
  for (const accountIds of [undefined, null, "77001122", 77001122, {}]) {
    const result = selectAccountById({ accountIds });

    assert.equal(result.ok, false, `${JSON.stringify(accountIds)} is not a list`);
    assert.equal(result.accountId, null);
    assert.equal(result.code, "no_accounts_available");
  }
});

test("a sole account is not selected when none was requested", () => {
  const result = selectAccountById({
    accountIds: ["77001122"],
    requestedAccountId: null,
  });

  assert.equal(
    result.ok,
    false,
    "being the only saved account is not the same as having been chosen"
  );
  assert.equal(result.accountId, null);
  assert.equal(result.code, "explicit_selection_required");
});

test("the requested account is selected among several", () => {
  const result = selectAccountById({
    accountIds: ["77001122", "88990011", "12345678"],
    requestedAccountId: "88990011",
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, "88990011");
  assert.equal(result.code, "requested_account");
});

test("a requested account that is not available is refused, not replaced", () => {
  const result = selectAccountById({
    accountIds: ["77001122", "88990011"],
    requestedAccountId: "99999999",
  });

  assert.equal(
    result.ok,
    false,
    "the other authorized accounts are not substitutes for the requested one"
  );
  assert.equal(result.accountId, null);
  assert.equal(result.code, "requested_account_not_available");
});

test("numeric and string account ids name the same account", () => {
  const fromNumber = selectAccountById({
    accountIds: [445566],
    requestedAccountId: "445566",
  });

  const fromString = selectAccountById({
    accountIds: ["445566"],
    requestedAccountId: 445566,
  });

  assert.equal(fromNumber.ok, true);
  assert.equal(fromNumber.accountId, "445566");
  assert.equal(fromString.ok, true);
  assert.equal(fromString.accountId, "445566");
});

test("int64-like account ids are compared by their decimal text", () => {
  const result = selectAccountById({
    accountIds: [int64("77001122"), int64("88990011")],
    requestedAccountId: "88990011",
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, "88990011");
});

test("surrounding whitespace is not part of an account id", () => {
  const result = selectAccountById({
    accountIds: ["  77001122  "],
    requestedAccountId: "77001122 ",
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, "77001122");
});

test("blank entries are dropped before an account is chosen", () => {
  const result = selectAccountById({
    accountIds: [null, "", "  ", undefined, "", "77001122"],
    requestedAccountId: "77001122",
  });

  assert.equal(
    result.ok,
    true,
    "blank entries repeated twice must not read as one account named twice"
  );
  assert.equal(result.accountId, "77001122");
});

test("a list of only unusable entries has no accounts", () => {
  const result = selectAccountById({
    accountIds: [null, "", "   ", undefined],
    requestedAccountId: "77001122",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "no_accounts_available");
});

test("an unrequested selection is refused whatever the list holds", () => {
  for (const accountIds of [
    ["77001122"],
    ["77001122", "88990011"],
    ["77001122", "88990011", "12345678"],
  ]) {
    const result = selectAccountById({
      accountIds,
      requestedAccountId: null,
    });

    assert.equal(
      result.ok,
      false,
      `no account may be picked for a caller that named none (${accountIds.length} available)`
    );
    assert.equal(result.accountId, null);
    assert.equal(result.code, "explicit_selection_required");
  }
});

test("duplicate account entries are refused even when one is requested", () => {
  const requested = selectAccountById({
    accountIds: ["77001122", "77001122", "88990011"],
    requestedAccountId: "88990011",
  });

  assert.equal(
    requested.ok,
    false,
    "a stored list that names an account twice is corrupt, not merely untidy"
  );
  assert.equal(requested.code, "ambiguous_account_ids");

  const unrequested = selectAccountById({
    accountIds: ["77001122", "77001122"],
    requestedAccountId: null,
  });

  assert.equal(unrequested.ok, false);
  assert.equal(unrequested.code, "ambiguous_account_ids");
});

test("an account id that cannot be named is refused", () => {
  for (const unusable of [{}, { accountId: null }, [], true]) {
    const result = selectAccountById({
      accountIds: [unusable],
      requestedAccountId: null,
    });

    assert.equal(result.ok, false, `${JSON.stringify(unusable)} is not an id`);
    assert.equal(result.code, "no_accounts_available");
  }
});

test("an unusable requested id is refused, not read as no request", () => {
  for (const unusable of [null, undefined, "", "   ", {}, true]) {
    const result = selectAccountById({
      accountIds: ["77001122"],
      requestedAccountId: unusable,
    });

    assert.equal(
      result.ok,
      false,
      `${JSON.stringify(unusable)} names no account, so nothing may be selected`
    );
    assert.equal(result.accountId, null);
    assert.equal(result.code, "explicit_selection_required");
  }
});

test("a refusal never carries an account id", () => {
  const refusals = [
    { accountIds: [], requestedAccountId: null },
    { accountIds: ["1"], requestedAccountId: null },
    { accountIds: ["1"], requestedAccountId: "" },
    { accountIds: ["1", "2"], requestedAccountId: null },
    { accountIds: ["1", "2"], requestedAccountId: "9" },
    { accountIds: ["1", "1"], requestedAccountId: "1" },
  ];

  for (const input of refusals) {
    const result = selectAccountById(input);

    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(
      result.accountId,
      null,
      `a refusal must not hand back ${JSON.stringify(input)}'s substitute`
    );
  }
});

test("a success never carries an account other than the requested one", () => {
  const cases = [
    { accountIds: ["77001122", "88990011"], requestedAccountId: "88990011" },
    { accountIds: [445566], requestedAccountId: "445566" },
    { accountIds: [" 77001122 "], requestedAccountId: " 77001122 " },
  ];

  for (const input of cases) {
    const result = selectAccountById(input);

    assert.equal(result.ok, true, JSON.stringify(input));
    assert.equal(
      result.accountId,
      String(input.requestedAccountId).trim(),
      "the selected id must be exactly the account that was asked for"
    );
  }
});

test("every refusal says plainly that no account was selected", () => {
  const cases = [
    { accountIds: [], requestedAccountId: null },
    { accountIds: ["77001122"], requestedAccountId: null },
    { accountIds: ["1", "2"], requestedAccountId: null },
    { accountIds: ["1", "2"], requestedAccountId: "9" },
    { accountIds: ["1", "1"], requestedAccountId: "1" },
    { accountIds: "77001122", requestedAccountId: null },
  ];

  for (const input of cases) {
    const result = selectAccountById(input);

    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(typeof result.message, "string");
    assert.notEqual(result.message.trim(), "", JSON.stringify(input));
    assert.match(
      result.message,
      /no account was selected/,
      `the refusal for ${JSON.stringify(input)} must state that nothing was chosen: ${result.message}`
    );
  }

  for (const input of [
    { accountIds: ["77001122"], requestedAccountId: "77001122" },
    { accountIds: ["77001122", "88990011"], requestedAccountId: "88990011" },
  ]) {
    const result = selectAccountById(input);

    assert.equal(result.ok, true, JSON.stringify(input));
    assert.doesNotMatch(
      result.message,
      /no account was selected/,
      `a selection must not read as a refusal: ${result.message}`
    );
  }
});

/* ============================================================
   THE SHARED RULE: verifyAuthenticatedAccount
   ============================================================ */

test("the authenticated account is adopted only when it is the one requested", () => {
  const result = verifyAuthenticatedAccount({
    requestedAccountId: "77001122",
    respondedAccountId: "77001122",
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, "77001122");
});

test("a mismatched authenticated account is refused", () => {
  const result = verifyAuthenticatedAccount({
    requestedAccountId: "77001122",
    respondedAccountId: "88990011",
  });

  assert.equal(
    result.ok,
    false,
    "an account other than the requested one may never become the trading session"
  );
  assert.equal(result.accountId, null);
  assert.equal(result.code, "account_auth_mismatch");
  assert.match(
    result.message,
    /no account was selected/,
    "a mismatched identity must be stated as a refusal, not as a session"
  );
});

test("an authentication response without an account id is refused", () => {
  for (const missing of [null, undefined, "", "   "]) {
    const result = verifyAuthenticatedAccount({
      requestedAccountId: "77001122",
      respondedAccountId: missing,
    });

    assert.equal(result.ok, false, JSON.stringify(missing));
    assert.equal(result.accountId, null);
    assert.equal(result.code, "account_auth_response_unnamed");
  }
});

test("authentication cannot be verified against an unknown request", () => {
  for (const missing of [null, undefined, "", "   "]) {
    const result = verifyAuthenticatedAccount({
      requestedAccountId: missing,
      respondedAccountId: "77001122",
    });

    assert.equal(
      result.ok,
      false,
      "no account was requested, so no response can be attributed to a selection"
    );
    assert.equal(result.accountId, null);
    assert.equal(result.code, "account_auth_unrequested");
  }
});

test("int64 authentication responses are verified against the requested text", () => {
  const match = verifyAuthenticatedAccount({
    requestedAccountId: "77001122",
    respondedAccountId: int64("77001122"),
  });

  const mismatch = verifyAuthenticatedAccount({
    requestedAccountId: "77001122",
    respondedAccountId: int64("88990011"),
  });

  assert.equal(match.ok, true);
  assert.equal(match.accountId, "77001122");
  assert.equal(mismatch.ok, false);
});

/* ============================================================
   HOW THE RULES ARE WIRED IN
   ============================================================ */

const accountAuthSection = () =>
  sliceBetween(
    SERVICE_SOURCE,
    "PAYLOAD.GET_ACCOUNTS_RES",
    "PAYLOAD.ACCOUNT_AUTH_REQ",
    "GET_ACCOUNTS_RES"
  );

const authenticatedSection = () =>
  sliceBetween(
    SERVICE_SOURCE,
    "PAYLOAD.ACCOUNT_AUTH_RES",
    "PAYLOAD.TRADER_REQ",
    "ACCOUNT_AUTH_RES"
  );

/* Task 2.1-b moved the loader out of the route into the injectable
   store, and task 2.1-d put the stored-account decision behind a
   policy, so this is where the stored-account rules live now. The
   previous markers pointed at the inline code that no longer makes
   the decision, then at the inference branch that Phase 2.1-e Task 4
   removed; this site reads the strict branch, which is what the
   process runs with. */

const storedAuthSection = () =>
  sliceBetween(
    STORE_SOURCE,
    "function strictSelection",
    "// READ A STORE FILE INTO STATE",
    "ctraderStore.strictSelection"
  );

const deleteAccountBlock = () =>
  routeBlock(ROUTE_SOURCE, "/accounts/:accountId", "delete");

const SITES = [
  {
    label: "the broker account list",
    section: accountAuthSection,
    rules: [
      {
        label: "resolves the authorized accounts through the shared rule",
        passes: (text) =>
          /selectAccountById\(\{[\s\S]{0,600}requestedAccountId:\s*preferredAccountId/.test(
            text
          ),
      },
      {
        label: "never takes the first authorized account",
        passes: (text) => !/accounts\[0\]/.test(text),
      },
      {
        label: "aborts startup when the account is refused",
        passes: (text) =>
          /if \(!selection\.ok\) \{[\s\S]{0,160}throw new Error\(\s*selection\.message/.test(
            text
          ),
      },
      {
        label: "requests the account it selected",
        passes: (text) =>
          /selectedTradingAccountId =\s*selection\.accountId/.test(text),
      },
    ],
  },
  {
    label: "the authentication response",
    section: authenticatedSection,
    rules: [
      {
        label: "verifies the authenticated account against the requested one",
        passes: (text) =>
          /verifyAuthenticatedAccount\(\{[\s\S]{0,600}requestedAccountId:\s*selectedTradingAccountId[\s\S]{0,600}respondedAccountId:\s*response\.ctidTraderAccountId/.test(
            text
          ),
      },
      {
        label: "refuses a mismatched identity before authenticating",
        passes: (text) => {
          const refusal = text.indexOf("if (!verification.ok) {");
          const authenticates = text.search(/authenticated =\s*true/);

          return refusal !== -1 && authenticates !== -1 && refusal < authenticates;
        },
      },
      {
        label: "adopts only the verified account id",
        passes: (text) =>
          /selectedTradingAccountId =\s*verification\.accountId/.test(text),
      },
      {
        label: "does not adopt the response id unexamined",
        passes: (text) =>
          !/selectedTradingAccountId =\s*response\.ctidTraderAccountId/.test(text),
      },
    ],
  },
  {
    label: "the stored active account",
    section: storedAuthSection,
    rules: [
      {
        label: "resolves the stored account through the shared rule",
        passes: (text) =>
          /selectAccountById\(\{[\s\S]{0,600}requestedAccountId:\s*requested\b/.test(
            text
          ),
      },
      {
        label: "reads only the stored active account key",
        passes: (text) =>
          /normalizeAccountKey\(parsed\.activeAccountId\)/.test(text),
      },
      {
        label: "never reads the legacy top-level id as a selection",
        passes: (text) => !/parsed\.accountId\b/.test(text),
      },
      {
        label: "normalizes the stored request before selecting",
        passes: (text) => /normalizeAccountKey\(/.test(text),
      },
      {
        label: "selects nothing when the file stored nothing",
        passes: (text) =>
          /if \(requested === null\) \{[\s\S]{0,40}return null;/.test(text),
      },
      {
        label: "never infers a selection from the size of the list",
        passes: (text) => !/\.length\s*===\s*1/.test(text),
      },
      {
        label: "never promotes the first stored account",
        passes: (text) => !/accounts\[0\]/.test(text),
      },
      {
        label: "leaves cTrader unselected rather than guessing",
        passes: (text) =>
          /storedSelection\.ok\s*\?\s*storedSelection\.accountId\s*:\s*null/.test(
            text
          ),
      },
    ],
  },
  {
    label: "the deleted active account",
    section: deleteAccountBlock,
    rules: [
      {
        label: "plans the removal through the shared rule",
        passes: (text) => /planAccountRemoval\(\{/.test(text),
      },
      {
        label: "hands the plan the stored accounts and the active account",
        passes: (text) =>
          /accounts:\s*ctraderAuth\.accounts[\s\S]{0,120}activeAccountId:\s*ctraderAuth\.activeAccountId[\s\S]{0,120}accountId\b/.test(
            text
          ),
      },
      {
        label: "adopts only the active account the plan returned",
        passes: (text) =>
          /activeAccountId:\s*plan\.activeAccountId/.test(text),
      },
      {
        label: "carries the accounts the plan returned",
        passes: (text) => /accounts:\s*plan\.accounts/.test(text),
      },
      {
        label: "persists the candidate before the route adopts it",
        passes: (text) => {
          const persisted = text.indexOf("saveAuth(next)");
          const adopted = text.indexOf("ctraderAuth = next");

          return (
            persisted !== -1 &&
            adopted !== -1 &&
            persisted < adopted
          );
        },
      },
      {
        label: "stops the service only when the plan says the account was active",
        passes: (text) =>
          /if \(plan\.mustStopService\) \{[\s\S]{0,160}stopCTraderService\(\)/.test(
            text
          ),
      },
      {
        label: "refuses an unknown account before anything changes",
        passes: (text) => {
          const refusal = text.indexOf("if (!plan.ok) {");
          const teardown = text.indexOf("stopCTraderService(");
          const saved = text.indexOf("saveAuth(");

          return (
            refusal !== -1 &&
            teardown !== -1 &&
            saved !== -1 &&
            refusal < teardown &&
            refusal < saved
          );
        },
      },
      {
        label: "selects no successor for the removed account",
        passes: (text) => !/selectAccountById\(/.test(text),
      },
      {
        label: "never promotes the first stored account",
        passes: (text) => !/accounts\[0\]/.test(text),
      },
      {
        label: "keeps the shared authorization for the accounts that remain",
        passes: (text) => !/clearSavedAuth\(/.test(text),
      },
      {
        label: "never starts trading without an explicit selection",
        passes: (text) => !/startService\(\)/.test(text),
      },
    ],
  },
];

for (const site of SITES) {
  test(`wiring: ${site.label} follows every rule`, () => {
    const text = site.section();

    const violated = site.rules.filter((rule) => !rule.passes(text));

    assert.deepEqual(
      violated.map((rule) => rule.label),
      [],
      `${site.label} must obey all of its rules`
    );
  });
}

test("wiring: no production file falls back to a first account", () => {
  for (const [name, source] of [
    ["ctraderService.js", SERVICE_SOURCE],
    ["routes/ctrader.js", ROUTE_SOURCE],
    ["services/ctraderStore.js", STORE_SOURCE],
  ]) {
    assert.equal(
      /accounts\[0\]/.test(source),
      false,
      `${name} must select accounts by id, never by position`
    );
  }
});

test("wiring: the shared rule holds no sole-account branch to fall back to", () => {
  const rule = sliceBetween(
    SELECTION_SOURCE,
    "export function selectAccountById(",
    "export function verifyAuthenticatedAccount(",
    "selectAccountById"
  );

  for (const forbidden of [
    "sole_account",
    "ambiguous_account_selection",
    "unique[0]",
    "keys[0]",
    "length > 1",
    "length === 1",
  ]) {
    assert.equal(
      rule.includes(forbidden),
      false,
      `selectAccountById must select only what was requested, but still mentions ${forbidden}`
    );
  }

  assert.match(
    rule,
    /explicit_selection_required/,
    "the branch that used to choose a sole account must be replaced by a refusal that names what was missing"
  );
});

test("wiring: the selection rule is pure and performs no I/O", () => {
  for (const forbidden of [
    /^import .*node:/m,
    /^import (fs|path|http|https|ws|net|dns)/m,
    /\bfetch\s*\(/,
    /new WebSocket\b/,
    /protobuf/,
    /\bprocess\.env\b/,
  ]) {
    assert.equal(
      forbidden.test(SELECTION_SOURCE),
      false,
      `the account selection rule must stay offline-testable, but matched ${forbidden}`
    );
  }
});

/* ============================================================
   MUTANTS: every rule is load-bearing
   ============================================================ */

const MUTANTS = [
  {
    site: "the broker account list",
    label: "the first authorized account is used again",
    mutate: (text) =>
      text.replace(
        "const selection =",
        "const fallbackAccount =\n                      accounts[0];\n\n                    const selection ="
      ),
  },
  {
    site: "the broker account list",
    label: "a refused selection is not escalated",
    mutate: (text) =>
      text.replace(
        "if (!selection.ok) {",
        "if (selection.ok === undefined) {"
      ),
  },
  {
    site: "the broker account list",
    label: "the request is dropped so any account will do",
    mutate: (text) =>
      text.replace(
        "requestedAccountId:\n                          preferredAccountId,",
        "requestedAccountId:\n                          null,"
      ),
  },
  {
    site: "the authentication response",
    label: "the session is marked authenticated before verifying",
    mutate: (text) =>
      text.replace(
        "const verification =",
        "authenticated = true;\n\n                    const verification ="
      ),
  },
  {
    site: "the authentication response",
    label: "the response is compared with itself",
    mutate: (text) =>
      text.replace(
        "respondedAccountId:\n                          response.ctidTraderAccountId,",
        "respondedAccountId:\n                          selectedTradingAccountId,"
      ),
  },
  {
    site: "the authentication response",
    label: "the requested id is adopted regardless of the response",
    mutate: (text) =>
      text.replace(
        "selectedTradingAccountId =\n                      verification.accountId;",
        ""
      ),
  },
  {
    site: "the stored active account",
    label: "a corrupt store promotes the first account",
    mutate: (text) =>
      text.replace(
        /storedSelection\.accountId\s*:\s*null/,
        "storedSelection.accountId: accounts[0]?.accountId"
      ),
  },
  {
    site: "the stored active account",
    label: "the stored account is resolved by position",
    mutate: (text) =>
      text.replace(
        "const storedSelection = selectAccountById({",
        "const storedSelection = { ok: true, accountId: accounts[0]?.accountId } || selectAccountById({"
      ),
  },
  {
    site: "the stored active account",
    label: "the stored request is dropped so any account will do",
    mutate: (text) =>
      text.replace(
        "requestedAccountId: requested,",
        "requestedAccountId: null,"
      ),
  },
  {
    site: "the stored active account",
    label: "the sole-account inference comes back through the list length",
    mutate: (text) =>
      text.replace(
        "requestedAccountId: requested,",
        "requestedAccountId:\n          requested ?? (accounts.length === 1 ? accounts[0].accountId : null),"
      ),
  },
  {
    site: "the stored active account",
    label: "the legacy top-level id is read again",
    mutate: (text) =>
      text.replace(
        "normalizeAccountKey(parsed.activeAccountId)",
        "normalizeAccountKey(parsed.activeAccountId || parsed.accountId)"
      ),
  },
  {
    site: "the stored active account",
    label: "the stored request is used without being named first",
    mutate: (text) =>
      text.replace(
        "normalizeAccountKey(parsed.activeAccountId)",
        "parsed.activeAccountId"
      ),
  },
  {
    site: "the stored active account",
    label: "an unusable stored request is still handed to the rule",
    mutate: (text) =>
      text.replace(
        "if (requested === null) {\n    return null;\n  }",
        ""
      ),
  },
  {
    site: "the deleted active account",
    label: "the successor is started automatically",
    mutate: (text) =>
      text.replace(
        "saveAuth(next);",
        "saveAuth(next);\n\n      if (ctraderAuth.activeAccountId) {\n        await startService();\n      }"
      ),
  },
  {
    site: "the deleted active account",
    label: "the successor is taken from the remaining list",
    mutate: (text) =>
      text.replace(
        "activeAccountId:\n          plan.activeAccountId,",
        "activeAccountId:\n          plan.activeAccountId ?? ctraderAuth.accounts[0]?.accountId,"
      ),
  },
  {
    site: "the deleted active account",
    label: "the sole remaining account is selected again",
    mutate: (text) =>
      text.replace(
        "saveAuth(next);",
        "saveAuth(next);\n\n      const successor = selectAccountById({\n        accountIds: plan.accounts.map(\n          (account) => account.accountId\n        ),\n\n        requestedAccountId: null,\n      });"
      ),
  },
  {
    site: "the deleted active account",
    label: "the service is stopped for every removal",
    mutate: (text) =>
      text.replace("if (plan.mustStopService) {", "if (plan.ok) {"),
  },
  {
    site: "the deleted active account",
    label: "the shared authorization is cleared with the account",
    mutate: (text) =>
      text.replace(
        "saveAuth(next);",
        "clearSavedAuth();\n\n      saveAuth(next);"
      ),
  },
  {
    site: "the deleted active account",
    label: "the refusal is keyed on the wrong plan field",
    mutate: (text) =>
      text.replace("if (!plan.ok) {", "if (!plan.accounts) {"),
  },
  {
    site: "the deleted active account",
    label: "the memory adopts what was never persisted",
    mutate: (text) =>
      text.replace(
        "saveAuth(next);\n\n      ctraderAuth = next;",
        "ctraderAuth = next;\n\n      saveAuth(next);"
      ),
  },
  {
    site: "the deleted active account",
    label: "the active account is left pointing at the removed id",
    mutate: (text) =>
      text.replace(
        "activeAccountId:\n          plan.activeAccountId,",
        "activeAccountId:\n          ctraderAuth.activeAccountId,"
      ),
  },
  {
    site: "the deleted active account",
    label: "the plan is told nothing is active",
    mutate: (text) =>
      text.replace(
        "activeAccountId:\n          ctraderAuth.activeAccountId,",
        "activeAccountId: null,"
      ),
  },
  {
    site: "the deleted active account",
    label: "the removal is planned by hand",
    mutate: (text) =>
      text.replace(
        "const plan = planAccountRemoval({\n        accounts: ctraderAuth.accounts,\n\n        activeAccountId:\n          ctraderAuth.activeAccountId,\n\n        accountId,\n      });",
        `const plan = {
        ok: true,
        accounts: ctraderAuth.accounts.filter(
          (account) => account.accountId !== accountId
        ),
        activeAccountId: ctraderAuth.activeAccountId,
        mustStopService: true,
        removedAccount: null,
      };`
      ),
  },
];

for (const mutant of MUTANTS) {
  test(`mutation: ${mutant.site} — "${mutant.label}" is rejected`, () => {
    const site = SITES.find((entry) => entry.label === mutant.site);
    const text = site.section();
    const mutated = mutant.mutate(text);

    assert.notEqual(
      mutated,
      text,
      `the "${mutant.label}" anchor no longer matches ${site.label}`
    );

    const violated = site.rules.filter((rule) => !rule.passes(mutated));

    assert.equal(
      violated.length > 0,
      true,
      `no rule noticed "${mutant.label}"`
    );
  });
}
