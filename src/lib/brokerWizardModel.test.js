// ============================================================
// CTRADER CONNECTION WIZARD - PURE MODEL
// ============================================================
//
// WHAT IS REAL HERE
//
// Nothing is stubbed except the inputs. Every aggregate this model is fed is
// built with the same block shapes the backend produces and that
// src/lib/brokerIntegrationComponents.runtime.test.js already pins, and every
// stored account is shaped by the real identity helper. The validation gate is
// exercised through the real validateCtraderSession() from
// src/lib/brokerIntegrationModel.js, so the wizard cannot declare a connection
// by agreeing with a fixture this file invented.
//
// WHAT THIS PROVES
//
// The wizard's navigation guards, its resume envelope, its account provenance
// choices and, above all, the rule that the "connected" outcome is derived from
// a validated live session and is unreachable any other way.
//
// WHAT THIS CANNOT PROVE
//
// No component is rendered here and no request is made. Whether the live cTrader
// service actually answers is not testable offline and is not claimed.

import test from "node:test";
import assert from "node:assert/strict";

import {
  BROKER_SUGGESTIONS,
  ENVELOPE_VERSION,
  RESUME_TTL_MS,
  SCREENS,
  STEPS,
  STORAGE_KEY,
  STEP_OF_SCREEN,
  VERIFICATION,
  accountChoices,
  advanceBlock,
  authorizeEnvelope,
  brokerSuggestions,
  canMarkConnected,
  createInitialState,
  currentStep,
  deserialize,
  reduce,
  searchSavedAccounts,
  serialize,
  verificationState,
} from "./brokerWizardModel.js";

import { validateCtraderSession } from "./brokerIntegrationModel.js";

// A value that must never leave the model toward the screen or storage.
const SECRET = "FAKE_SECRET_TOKEN";

const CT_ACCOUNT_ID = "5784123";
const CT_TRADER_LOGIN = "556677";
const OTHER_CT_ACCOUNT_ID = "5784131";
const NOW = 1_800_000_000_000;

// ============================================================
// BACKEND-SHAPED FIXTURES
// ============================================================

function ctraderBlock({
  connected = true,
  authenticated = true,
  ready = true,
  serviceAccountId = CT_ACCOUNT_ID,
  requestedAccountId = CT_ACCOUNT_ID,
  accountSource = "live",
} = {}) {
  const live = connected && authenticated && ready;
  const authenticatedAccountId = live ? serviceAccountId : null;
  const state = live ? "connected" : connected ? "authenticating" : "disconnected";

  const liveItems = [
    {
      accountId: CT_ACCOUNT_ID,
      traderLogin: CT_TRADER_LOGIN,
      isLive: true,
      lastLoginTime: "1762300000000",
      name: "Demo 5784123",
      nameSource: "local_cache",
      accessToken: SECRET,
    },
    {
      accountId: OTHER_CT_ACCOUNT_ID,
      traderLogin: "556678",
      isLive: true,
      lastLoginTime: "1762300000000",
      name: "Demo 5784131",
      nameSource: "local_cache",
      accessToken: SECRET,
    },
  ];

  const cachedItems = [
    {
      accountId: CT_ACCOUNT_ID,
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
      observedAt: "2026-11-05T10:00:00.000Z",
      sourceTimestamp: null,
      reason: null,
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
      limitations: [],
    },
    account: authenticatedAccountId
      ? {
          accountId: authenticatedAccountId,
          balance: 5000,
          equity: 5010.5,
          margin: 100,
          freeMargin: 4910.5,
          currency: "USD",
          leverage: 100,
          brokerName: "Spotware Demo",
          source: "authenticated cTrader service",
        }
      : null,
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
      source: "authenticated and ready cTrader service session",
      accessToken: SECRET,
      note: null,
    },
    accounts: {
      broker: "ctrader",
      activeAccountId: requestedAccountId || activeFromService || null,
      activeAccountSource: null,
      serviceReportedAccountId: activeFromService,
      requestedActiveAccountId: requestedAccountId,
      mismatch: false,
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

function statusOf(ctrader) {
  return { brokers: { ctrader }, generatedAt: "2026-11-05T10:00:00.000Z" };
}

function serviceResponse({ tradingAccountId = CT_ACCOUNT_ID } = {}) {
  return {
    service: {
      tradingAccountId,
      balance: 5000,
      equity: 5010.5,
      margin: 100,
      freeMargin: 4910.5,
      currency: "USD",
      leverage: 100,
      openPositions: [],
    },
  };
}

function storedCtraderAccount(overrides = {}) {
  return {
    id: `ctrader-${CT_ACCOUNT_ID}`,
    accountName: "Spotware demo",
    broker: "cTrader",
    brokerAccountId: CT_ACCOUNT_ID,
    ...overrides,
  };
}

// The real validator, called the way the page calls it. An explicit
// serviceResponse: null must stay null, so presence is tested rather than using
// a default-substituting operator.
function liveSession(overrides = {}) {
  const { aggregate, ...rest } = overrides;

  const service =
    "serviceResponse" in overrides
      ? overrides.serviceResponse
      : serviceResponse();

  return validateCtraderSession({
    accounts: rest.accounts ?? [storedCtraderAccount()],
    selectedAccountId: rest.selectedAccountId ?? `ctrader-${CT_ACCOUNT_ID}`,
    aggregate: aggregate ?? statusOf(ctraderBlock()),
    serviceResponse: service,
    synchronizedAt: "2026-11-05T10:00:05.000Z",
  });
}

// ============================================================
// THE STEP TABLE
// ============================================================

test("the wizard has exactly four visible steps in reference order", () => {
  assert.deepEqual(
    STEPS.map((step) => step.label),
    ["Search Broker", "Choose Method", "Connect Account", "All Set"],
  );

  assert.equal(STEPS.length, 4);
});

test("the five navigable screens map onto the four steps with step four derived", () => {
  assert.deepEqual(SCREENS.slice(), ["search", "method", "intro", "pending", "accounts"]);

  assert.equal(STEP_OF_SCREEN.search, 1);
  assert.equal(STEP_OF_SCREEN.method, 2);
  assert.equal(STEP_OF_SCREEN.intro, 3);
  assert.equal(STEP_OF_SCREEN.pending, 3);
  assert.equal(STEP_OF_SCREEN.accounts, 3);
});

test("no screen belongs to step four because a validated session earns it", () => {
  for (const screen of SCREENS) {
    assert.notEqual(
      STEP_OF_SCREEN[screen],
      4,
      `"${screen}" must not claim the final step on its own`,
    );
  }
});

test("currentStep stays on three while an account is merely selected", () => {
  assert.equal(
    currentStep({
      screen: "accounts",
      verification: VERIFICATION.verifying,
    }),
    3,
  );
});

test("currentStep reaches four only when verification reports connected", () => {
  assert.equal(
    currentStep({
      screen: "accounts",
      verification: VERIFICATION.connected,
    }),
    4,
  );
});

test("currentStep does not reach four from an earlier screen whatever verification says", () => {
  assert.equal(
    currentStep({ screen: "intro", verification: VERIFICATION.connected }),
    3,
  );

  assert.equal(
    currentStep({ screen: "search", verification: VERIFICATION.connected }),
    1,
  );
});

// ============================================================
// NAVIGATION AND ITS GUARDS
// ============================================================

test("the wizard opens on the search screen with nothing invented", () => {
  const state = createInitialState();

  assert.equal(state.screen, "search");
  assert.equal(state.query, "");
  assert.equal(state.brokerName, null);
  assert.equal(state.accountId, null);
});

test("continue from search is blocked until a broker name is typed", () => {
  const state = createInitialState();

  assert.match(String(advanceBlock(state)), /broker name/i);

  const next = reduce(state, { type: "CONTINUE" });

  assert.equal(next.screen, "search", "a blocked continue must not advance");
});

test("a whitespace-only broker name does not unlock continue", () => {
  const state = reduce(createInitialState(), { type: "QUERY", query: "   " });

  assert.equal(state.brokerName, null, "a blank name must be stored as absent");
  assert.notEqual(advanceBlock(state), null);
});

test("typing a broker name trims it and unlocks continue", () => {
  const state = reduce(createInitialState(), { type: "QUERY", query: "  Spotware  " });

  assert.equal(state.brokerName, "Spotware");
  assert.equal(advanceBlock(state), null);

  const next = reduce(state, { type: "CONTINUE" });

  assert.equal(next.screen, "method");
});

test("picking a saved match supplies the broker name from stored data", () => {
  const state = reduce(createInitialState(), {
    type: "PICK_SAVED",
    accountId: `ctrader-${CT_ACCOUNT_ID}`,
    brokerName: "Spotware demo",
  });

  assert.equal(state.brokerName, "Spotware demo");
  assert.equal(state.accountId, `ctrader-${CT_ACCOUNT_ID}`);
  assert.equal(advanceBlock(state), null);
});

test("a picked match with no name cannot unlock continue", () => {
  const state = reduce(createInitialState(), {
    type: "PICK_SAVED",
    accountId: `ctrader-${CT_ACCOUNT_ID}`,
    brokerName: "   ",
  });

  assert.equal(state.brokerName, null);
  assert.notEqual(advanceBlock(state), null);
});

test("continue from method advances to the authorization introduction", () => {
  const state = { ...createInitialState(), screen: "method", brokerName: "Spotware" };

  assert.equal(advanceBlock(state), null);
  assert.equal(reduce(state, { type: "CONTINUE" }).screen, "intro");
});

test("the introduction cannot advance by itself, only an authorization can", () => {
  const state = { ...createInitialState(), screen: "intro", brokerName: "Spotware" };

  assert.equal(
    currentStep({ screen: "intro", verification: VERIFICATION.verifying }),
    3,
  );

  const next = reduce(state, { type: "CONTINUE" });

  assert.equal(
    next.screen,
    "intro",
    "a pending authorization is a round trip, not a step this model may complete",
  );
});

test("pending resumes to the account list on continue", () => {
  const state = { ...createInitialState(), screen: "pending", brokerName: "Spotware" };

  assert.equal(advanceBlock(state), null);
  assert.equal(reduce(state, { type: "CONTINUE" }).screen, "accounts");
});

test("continue from the account list is blocked until an account is chosen", () => {
  const state = { ...createInitialState(), screen: "accounts", brokerName: "Spotware" };

  assert.match(String(advanceBlock(state)), /account/i);

  assert.equal(reduce(state, { type: "CONTINUE" }).screen, "accounts");
});

test("choosing an account unlocks the account list and keeps the step", () => {
  const state = reduce(
    { ...createInitialState(), screen: "accounts", brokerName: "Spotware" },
    { type: "SELECT_ACCOUNT", accountId: `ctrader-${CT_ACCOUNT_ID}` },
  );

  assert.equal(state.accountId, `ctrader-${CT_ACCOUNT_ID}`);
  assert.equal(advanceBlock(state), null);
});

test("continue from the account list holds the screen, because step four is earned", () => {
  let state = reduce(
    { ...createInitialState(), screen: "accounts", brokerName: "Spotware" },
    { type: "SELECT_ACCOUNT", accountId: `ctrader-${CT_ACCOUNT_ID}` },
  );

  state = reduce(state, { type: "CONTINUE" });

  assert.equal(
    state.screen,
    "accounts",
    "no screen may claim the final step; only a validated session does",
  );
});

test("a blank account id cannot be selected", () => {
  const state = reduce(
    { ...createInitialState(), screen: "accounts", accountId: "previous" },
    { type: "SELECT_ACCOUNT", accountId: "  " },
  );

  assert.equal(
    state.accountId,
    "previous",
    "an unusable selection must not overwrite the current one",
  );
});

test("back walks the user one screen at a time without losing the name", () => {
  let state = { ...createInitialState(), screen: "accounts", brokerName: "Spotware" };

  state = reduce(state, { type: "BACK" });
  assert.equal(state.screen, "intro");

  state = reduce(state, { type: "BACK" });
  assert.equal(state.screen, "method");

  state = reduce(state, { type: "BACK" });
  assert.equal(state.screen, "search");

  assert.equal(state.brokerName, "Spotware", "back must not discard progress");
});

test("back from pending returns to the introduction", () => {
  const state = { ...createInitialState(), screen: "pending", brokerName: "Spotware" };

  assert.equal(reduce(state, { type: "BACK" }).screen, "intro");
});

test("back from the first screen stays on the first screen", () => {
  const state = createInitialState();

  assert.equal(reduce(state, { type: "BACK" }).screen, "search");
});

test("back from the account list clears a selection that no longer applies", () => {
  const state = reduce(
    { ...createInitialState(), screen: "accounts", brokerName: "Spotware" },
    { type: "SELECT_ACCOUNT", accountId: `ctrader-${CT_ACCOUNT_ID}` },
  );

  const backed = reduce(state, { type: "BACK" });

  assert.equal(backed.screen, "intro");
  assert.equal(
    backed.accountId,
    null,
    "returning before authorization must not keep an account chosen for a later step",
  );
});

test("an unknown action leaves the state untouched", () => {
  const state = { ...createInitialState(), brokerName: "Spotware" };

  assert.deepEqual(reduce(state, { type: "TELEPORT" }), state);
});

test("reduce never mutates the state it is given", () => {
  const state = createInitialState();
  const before = JSON.stringify(state);

  reduce(state, { type: "QUERY", query: "Spotware" });
  reduce(state, { type: "CONTINUE" });

  assert.equal(JSON.stringify(state), before);
});

// ============================================================
// THE RESUME ENVELOPE
// ============================================================

test("the storage key follows this app's edgeflo prefix convention", () => {
  assert.equal(STORAGE_KEY, "edgeflo_broker_wizard");
});

test("authorize records where to resume, not a completed connection", () => {
  const state = { ...createInitialState(), screen: "intro", brokerName: "Spotware" };

  const envelope = authorizeEnvelope(state, { now: NOW });

  assert.equal(envelope.screen, "pending");
  assert.equal(envelope.brokerName, "Spotware");
  assert.equal(envelope.accountId, null);
  assert.equal(envelope.savedAt, NOW);
  assert.equal(envelope.v, ENVELOPE_VERSION);
});

test("the envelope carries only its five fields", () => {
  const envelope = authorizeEnvelope(
    { ...createInitialState(), screen: "intro", brokerName: "Spotware" },
    { now: NOW },
  );

  assert.deepEqual(Object.keys(envelope).sort(), ["accountId", "brokerName", "savedAt", "screen", "v"]);
});

test("serialize and deserialize round-trip a resume target", () => {
  const envelope = authorizeEnvelope(
    { ...createInitialState(), screen: "intro", brokerName: "Spotware" },
    { now: NOW },
  );

  const restored = deserialize(serialize(envelope), { now: NOW + 1000 });

  assert.equal(restored.ok, true);
  assert.equal(restored.state.screen, "pending");
  assert.equal(restored.state.brokerName, "Spotware");
});

test("resume applies the stored fields into live state", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
  });

  const restored = deserialize(raw, { now: NOW + 1000 });

  const state = reduce(createInitialState(), { type: "RESUME", envelope: restored.state });

  assert.equal(state.screen, "pending");
  assert.equal(state.brokerName, "Spotware");
});

test("a resume envelope older than the window is refused as expired", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
  });

  const restored = deserialize(raw, { now: NOW + RESUME_TTL_MS + 1 });

  assert.equal(restored.ok, false);
  assert.equal(restored.reason, "expired");
});

test("an envelope at exactly the window is still honoured", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
  });

  assert.equal(deserialize(raw, { now: NOW + RESUME_TTL_MS }).ok, true);
});

test("the resume window is thirty minutes", () => {
  assert.equal(RESUME_TTL_MS, 30 * 60 * 1000);
});

test("an envelope naming an unknown screen is refused", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "connected",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
  });

  const restored = deserialize(raw, { now: NOW });

  assert.equal(restored.ok, false);
  assert.equal(restored.reason, "invalid");
});

test("an envelope without a broker name is refused rather than resumed blank", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "   ",
    accountId: null,
    savedAt: NOW,
  });

  assert.equal(deserialize(raw, { now: NOW }).reason, "invalid");
});

test("an envelope from another version is refused", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION + 1,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
  });

  const restored = deserialize(raw, { now: NOW });

  assert.equal(restored.ok, false);
  assert.equal(restored.reason, "version");
});

test("malformed, empty and non-object storage values are refused quietly", () => {
  for (const raw of ["", null, undefined, "{oops", "[]", "42", '"pending"']) {
    const restored = deserialize(raw, { now: NOW });

    assert.equal(restored.ok, false, `${String(raw)} must not resume`);
    assert.equal(restored.state, null);
  }
});

test("a savedAt that is not a real instant is refused", () => {
  for (const savedAt of ["yesterday", null, Number.NaN, Infinity, -1]) {
    const raw = JSON.stringify({
      v: ENVELOPE_VERSION,
      screen: "pending",
      brokerName: "Spotware",
      accountId: null,
      savedAt,
    });

    assert.equal(
      deserialize(raw, { now: NOW }).reason,
      "invalid",
      `${String(savedAt)} is not an instant`,
    );
  }
});

test("an envelope naming an unknown account id is dropped, not carried", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "accounts",
    brokerName: "Spotware",
    accountId: { nested: true },
    savedAt: NOW,
  });

  const restored = deserialize(raw, { now: NOW });

  assert.equal(restored.ok, true);
  assert.equal(restored.state.accountId, null);
});

test("the envelope never carries a token-shaped field", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
    accessToken: SECRET,
    refreshToken: SECRET,
  });

  const restored = deserialize(raw, { now: NOW });
  const text = JSON.stringify(restored.state);

  assert.ok(!text.includes(SECRET), "a resumed state must not hold a token");

  for (const key of ["accessToken", "refreshToken"]) {
    assert.ok(!(key in restored.state), `${key} must not survive resume`);
  }
});

test("serialize of a resumed envelope round-trips without the extra fields", () => {
  const raw = JSON.stringify({
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: "Spotware",
    accountId: null,
    savedAt: NOW,
    accessToken: SECRET,
  });

  const restored = deserialize(raw, { now: NOW });
  const rewritten = serialize(restored.state);

  assert.ok(!rewritten.includes(SECRET));
});

// ============================================================
// SEARCH OVER THE USER'S OWN SAVED ACCOUNTS
// ============================================================

test("an empty query lists nothing instead of inventing a marketplace", () => {
  const matches = searchSavedAccounts({
    accounts: [storedCtraderAccount()],
    query: "",
  });

  assert.deepEqual(matches, []);
});

test("search matches a saved cTrader account by broker name", () => {
  const matches = searchSavedAccounts({
    accounts: [storedCtraderAccount()],
    query: "spot",
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].accountId, `ctrader-${CT_ACCOUNT_ID}`);
  assert.equal(matches[0].brokerName, "Spotware demo");
});

test("search matches on the external account id too", () => {
  const matches = searchSavedAccounts({
    accounts: [storedCtraderAccount()],
    query: "578412",
  });

  assert.equal(matches.length, 1);
});

test("search is case-insensitive", () => {
  const lower = searchSavedAccounts({
    accounts: [storedCtraderAccount()],
    query: "spotware",
  });

  const upper = searchSavedAccounts({
    accounts: [storedCtraderAccount()],
    query: "SPOTWARE",
  });

  assert.deepEqual(upper, lower);
  assert.equal(lower.length, 1);
});

test("search never returns an MT5 record", () => {
  const matches = searchSavedAccounts({
    accounts: [
      { id: "mt5-1001", accountName: "Spotware MT5", broker: "MT5", brokerAccountId: "1001" },
      storedCtraderAccount(),
    ],
    query: "spotware",
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].accountId, `ctrader-${CT_ACCOUNT_ID}`);
});

test("search never returns a manual or unidentified record", () => {
  const matches = searchSavedAccounts({
    accounts: [
      { id: "manual-1", accountName: "Spotware manual", broker: null },
      { accountName: "Spotware no id" },
      storedCtraderAccount(),
    ],
    query: "spotware",
  });

  assert.equal(matches.length, 1);
});

test("search returns nothing when no saved account matches", () => {
  const matches = searchSavedAccounts({
    accounts: [storedCtraderAccount()],
    query: "pepperstone",
  });

  assert.deepEqual(matches, []);
});

test("search tolerates a malformed stored list", () => {
  for (const accounts of [undefined, null, "tradingAccounts", {}, [null, 7, "x"]]) {
    assert.deepEqual(
      searchSavedAccounts({ accounts, query: "spotware" }),
      [],
      `${JSON.stringify(accounts)} must yield no matches`,
    );
  }
});

test("search caps its result list", () => {
  const accounts = Array.from({ length: 20 }, (_, index) =>
    storedCtraderAccount({
      id: `ctrader-${1000 + index}`,
      accountName: `Spotware ${index}`,
      brokerAccountId: String(1000 + index),
    }),
  );

  const matches = searchSavedAccounts({ accounts, query: "spotware", limit: 5 });

  assert.equal(matches.length, 5);
});

test("a search match exposes no credential field", () => {
  const matches = searchSavedAccounts({
    accounts: [storedCtraderAccount({ accessToken: SECRET })],
    query: "spotware",
  });

  assert.ok(!JSON.stringify(matches).includes(SECRET));
  assert.deepEqual(
    Object.keys(matches[0]).sort(),
    ["accountId", "brokerName", "externalId"],
  );
});

// ============================================================
// SUGGESTED BROKER NAMES
// ============================================================
//
// A suggestion is a name offered back so the search field can be filled without
// typing it. It is not a directory: nothing is suggested until the user has
// started typing that name, and a suggestion carries no account, no status and
// no claim that connecting is possible.

test("an empty query suggests no name, because there is no catalogue to suggest from", () => {
  for (const query of ["", "   ", null, undefined, 7, {}]) {
    assert.deepEqual(
      brokerSuggestions({ query }),
      [],
      `${JSON.stringify(query)} must suggest nothing`,
    );
  }
});

test("IC Markets is offered as a cTrader name once the user types toward it", () => {
  assert.deepEqual(brokerSuggestions({ query: "ic" }), [
    { brokerName: "IC Markets" },
  ]);
});

test("the old IC Trading label is gone from the list a screen can offer", () => {
  // The name the user sees in the selection field is this list, so a second
  // entry would mean two brokers offered where one was renamed, and the
  // retired spelling coming back would be the defect this pins out.
  assert.deepEqual(
    BROKER_SUGGESTIONS.map((entry) => entry.brokerName),
    ["IC Markets"]
  );

  for (const query of ["ic tr", "TRADING", "Trading"]) {
    assert.deepEqual(
      brokerSuggestions({ query }),
      [],
      `"${query}" must no longer offer a name`,
    );
  }
});

test("a suggestion matches case-insensitively and on any part of the name", () => {
  for (const query of ["IC", "ic ma", "MARKETS", " IC "]) {
    assert.equal(
      brokerSuggestions({ query }).length,
      1,
      `"${query}" must still offer the name`,
    );
  }
});

test("a query that matches no suggested name suggests nothing", () => {
  assert.deepEqual(brokerSuggestions({ query: "pepperstone" }), []);
});

test("a suggestion is a name and nothing else", () => {
  const suggestions = brokerSuggestions({ query: "ic" });

  for (const suggestion of suggestions) {
    assert.deepEqual(Object.keys(suggestion), ["brokerName"]);
    assert.equal(typeof suggestion.brokerName, "string");
  }

  assert.equal(JSON.stringify(suggestions).includes(SECRET), false);
});

test("a suggestion never arrives with an account attached", () => {
  const suggestions = brokerSuggestions({ query: "ic" });

  assert.equal(
    suggestions.some((suggestion) => "accountId" in suggestion),
    false,
    "an account id in a suggestion would be a record this device never gave",
  );

  assert.equal(
    suggestions.some((suggestion) => "externalId" in suggestion),
    false,
  );
});

test("the suggested name list is frozen so no screen can widen it", () => {
  assert.ok(Object.isFrozen(BROKER_SUGGESTIONS));

  for (const entry of BROKER_SUGGESTIONS) {
    assert.ok(Object.isFrozen(entry));
  }

  const first = brokerSuggestions({ query: "ic" });

  // Writing through what a caller was handed must not reach the shared list.
  // Handing out the frozen entries themselves makes this throw; handing out a
  // copy makes the next call answer with the name it started with.
  first[0].brokerName = "Renamed By A Screen";

  assert.deepEqual(
    brokerSuggestions({ query: "ic" }),
    [{ brokerName: "IC Markets" }],
    "a caller must not be able to rename the suggested list for everyone after it",
  );
});

// ============================================================
// ACCOUNT CHOICES AFTER AN AUTHORIZATION RETURNED
// ============================================================

function choicesFor(block) {
  return accountChoices({ snapshot: statusOf(block) });
}

test("live accounts become choices labelled with their provenance", () => {
  const result = choicesFor(ctraderBlock());

  assert.equal(result.source, "live");
  assert.equal(result.isLive, true);
  assert.equal(result.choices.length, 2);

  const first = result.choices[0];

  assert.equal(first.accountId, CT_ACCOUNT_ID);
  assert.equal(first.label, "5784123");
  assert.equal(first.live, true);
});

test("a live account name is carried when the backend supplied one", () => {
  const result = choicesFor(ctraderBlock());

  assert.equal(result.choices[0].name, "Demo 5784123");
});

test("cached accounts stay labelled cached and are never presented as live", () => {
  const result = choicesFor(ctraderBlock({ accountSource: "cache" }));

  assert.equal(result.source, "cache");
  assert.equal(result.isLive, false);
  assert.equal(result.choices.length, 1);
  assert.equal(result.choices[0].live, false);
});

test("an empty account collection yields no choices rather than a placeholder", () => {
  const result = choicesFor(ctraderBlock({ accountSource: "none" }));

  assert.equal(result.source, "none");
  assert.deepEqual(result.choices, []);
});

test("a missing broker block yields no choices without throwing", () => {
  for (const snapshot of [null, undefined, {}, { brokers: {} }, { brokers: null }]) {
    const result = accountChoices({ snapshot });

    assert.equal(result.source, "none");
    assert.deepEqual(result.choices, []);
  }
});

test("account choices never carry a token", () => {
  const result = choicesFor(ctraderBlock());
  const text = JSON.stringify(result);

  assert.ok(!text.includes(SECRET), "no credential may reach the account list");

  for (const choice of result.choices) {
    assert.deepEqual(
      Object.keys(choice).sort(),
      ["accountId", "label", "live", "name", "traderLogin"],
    );
  }
});

test("a non-array account collection is reported as none", () => {
  const block = ctraderBlock();

  block.accounts.items = { 0: { accountId: CT_ACCOUNT_ID } };

  const result = choicesFor(block);

  assert.equal(result.source, "none");
  assert.deepEqual(result.choices, []);
});

test("an account item without an id is dropped", () => {
  const block = ctraderBlock();

  block.accounts.items = [{ accountId: null }, { accountId: "" }, { accountId: CT_ACCOUNT_ID }];
  block.accounts.source = "live";
  block.accounts.isLive = true;

  const result = choicesFor(block);

  assert.equal(result.choices.length, 1);
});

// ============================================================
// VERIFICATION AND THE CONNECTED GATE
// ============================================================

test("verification reports verifying while a read is in flight", () => {
  assert.equal(
    verificationState({ session: liveSession(), loading: true }),
    VERIFICATION.verifying,
  );
});

test("an action failure outranks everything else", () => {
  assert.equal(
    verificationState({
      session: liveSession(),
      loading: false,
      actionError: "The cTrader service refused to start.",
    }),
    VERIFICATION.error,
  );
});

test("a failed status read is unavailable, not an error the user caused", () => {
  assert.equal(
    verificationState({ session: null, loading: false, statusError: "Backend unreachable." }),
    VERIFICATION.unavailable,
  );
});

test("no session yet is still verifying rather than unavailable", () => {
  assert.equal(
    verificationState({ session: null, loading: false }),
    VERIFICATION.verifying,
  );
});

test("a validated live session is the only route to connected", () => {
  const session = liveSession();

  assert.equal(session.validationError, null, "the fixture must be a genuinely valid session");

  assert.equal(
    verificationState({ session, loading: false }),
    VERIFICATION.connected,
  );

  assert.equal(canMarkConnected(session), true);
});

test("a rejected session can never be marked connected", () => {
  const cases = [
    // The service is not connected at all.
    liveSession({ aggregate: statusOf(ctraderBlock({ connected: false })) }),
    // Connected but still authenticating.
    liveSession({ aggregate: statusOf(ctraderBlock({ authenticated: false })) }),
    // The active account came from the local cache.
    liveSession({ aggregate: statusOf(ctraderBlock({ accountSource: "cache" })) }),
    // The service reports a different account than the one selected.
    liveSession({ serviceResponse: serviceResponse({ tradingAccountId: "999999" }) }),
    // No service status at all.
    liveSession({ serviceResponse: null }),
  ];

  for (const [index, session] of cases.entries()) {
    assert.notEqual(
      session.validationError,
      null,
      `case ${index} must be a rejected session`,
    );

    assert.equal(
      verificationState({ session, loading: false }),
      VERIFICATION.unavailable,
      `case ${index} must not read as connected`,
    );

    assert.equal(canMarkConnected(session), false, `case ${index} must not be markable`);
  }
});

test("an empty session with no validation error is still not connected", () => {
  // createEmptySession() carries no error, so the gate must also require the
  // live evidence the validator attaches when it accepts a session.
  const blank = {
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
    pendingOrdersReason: null,
    lastSuccessfulSync: null,
    validationError: null,
  };

  assert.equal(
    canMarkConnected(blank),
    false,
    "a session that never synchronized cannot prove a connection",
  );
});

test("a session that synchronized is accepted on the live evidence", () => {
  const session = liveSession();

  assert.notEqual(session.lastSuccessfulSync, null);
  assert.equal(canMarkConnected(session), true);
});

test("canMarkConnected refuses absent and malformed sessions", () => {
  for (const session of [null, undefined, {}, "connected", 1, []]) {
    assert.equal(canMarkConnected(session), false);
  }
});

test("the verification enum is frozen and complete", () => {
  assert.deepEqual(
    Object.keys(VERIFICATION).sort(),
    ["connected", "error", "unavailable", "verifying"],
  );

  assert.equal(Object.isFrozen(VERIFICATION), true);
});
