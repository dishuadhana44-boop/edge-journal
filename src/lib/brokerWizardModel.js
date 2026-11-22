import { makeAccountIdentity } from "./brokerAccountIdentity.js";
import { brokerSnapshot } from "./brokerIntegrationModel.js";

// ============================================================
// CTRADER CONNECTION WIZARD MODEL
// ============================================================
//
// Everything here is pure: no fetch, no DOM, no React, no storage call. The
// wizard's screens are presentational and the page owns the round trip, so this
// module is where the two can be reasoned about separately.
//
// The rule this module exists to enforce: the wizard may describe a step the
// user is on, and it may refuse to move on without the evidence a step needs. It
// may never decide that a connection happened. Step four is not a screen in
// SCREENS for exactly that reason - it is derived from a session that
// validateCtraderSession() already accepted, so no navigation, and no stored
// envelope, can reach it.

export const STORAGE_KEY = "edgeflo_broker_wizard";

export const ENVELOPE_VERSION = 1;

// A return from authorization is worth resuming for a while, not forever. Past
// this window the wizard starts clean rather than presenting a half-finished
// round trip as though it had just happened.
export const RESUME_TTL_MS = 30 * 60 * 1000;

// The screens the user can actually be on. "connected" is deliberately absent.
export const SCREENS = Object.freeze([
  "search",
  "method",
  "intro",
  "pending",
  "accounts",
]);

export const STEP_OF_SCREEN = Object.freeze({
  search: 1,
  method: 2,
  intro: 3,
  pending: 3,
  accounts: 3,
});

export const STEPS = Object.freeze([
  Object.freeze({ id: "search", label: "Search Broker" }),
  Object.freeze({ id: "method", label: "Choose Method" }),
  Object.freeze({ id: "connect", label: "Connect Account" }),
  Object.freeze({ id: "allset", label: "All Set" }),
]);

export const VERIFICATION = Object.freeze({
  verifying: "verifying",
  connected: "connected",
  unavailable: "unavailable",
  error: "error",
});

// Names the search field may be filled with. A suggestion is offered only after
// the user has typed toward it, it holds nothing but the name, and it says
// nothing about whether that broker can be connected - so it is an aid to
// typing, not the catalogue this app does not have.
export const BROKER_SUGGESTIONS = Object.freeze([
  Object.freeze({ brokerName: "IC Markets" }),
]);

const NEXT_SCREEN = Object.freeze({
  search: "method",
  method: "intro",
  // The introduction has nowhere to go on its own: the authorization is a round
  // trip through another site, and only a resumed return moves the wizard on.
  intro: "intro",
  pending: "accounts",
  accounts: "accounts",
});

const PREVIOUS_SCREEN = Object.freeze({
  search: "search",
  method: "search",
  intro: "method",
  pending: "intro",
  accounts: "intro",
});

const ENVELOPE_FIELDS = Object.freeze([
  "v",
  "screen",
  "brokerName",
  "accountId",
  "savedAt",
]);

const ACCOUNT_SOURCES = Object.freeze(["live", "cache", "none"]);

const DEFAULT_MATCH_LIMIT = 8;

// ============================================================
// SMALL READS
// ============================================================

function text(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const string = String(value).trim();

  return string === "" ? null : string;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ============================================================
// STATE
// ============================================================

export function createInitialState(overrides = {}) {
  return {
    screen: "search",
    query: "",
    brokerName: null,
    accountId: null,
    ...overrides,
  };
}

// What still has to be true before the current screen may move on. A returned
// sentence is shown to the user as the reason Continue is disabled, so it names
// the missing thing rather than the rule.
export function advanceBlock(state) {
  if (!isRecord(state)) {
    return "The wizard has nothing to continue from yet.";
  }

  switch (state.screen) {
    case "search":
      return text(state.brokerName)
        ? null
        : "Enter the broker name you want to connect.";
    case "method":
      return text(state.brokerName)
        ? null
        : "A broker name is needed before a connection method can be chosen.";
    case "pending":
      return null;
    case "accounts":
      return text(state.accountId)
        ? null
        : "Choose the cTrader account to connect.";
    default:
      return null;
  }
}

export function reduce(state, action) {
  if (!isRecord(state) || !isRecord(action)) {
    return state;
  }

  switch (action.type) {
    case "QUERY":
      return {
        ...state,
        query: typeof action.query === "string" ? action.query : "",
        brokerName: text(action.query),
      };

    case "PICK_SAVED": {
      const brokerName = text(action.brokerName);

      return {
        ...state,
        accountId: text(action.accountId),
        brokerName,
        query: brokerName ?? state.query,
      };
    }

    case "SELECT_ACCOUNT": {
      const accountId = text(action.accountId);

      if (!accountId) {
        return state;
      }

      return { ...state, accountId };
    }

    case "CONTINUE": {
      if (advanceBlock(state) !== null) {
        return state;
      }

      const next = NEXT_SCREEN[state.screen];

      if (!next || next === state.screen) {
        return state;
      }

      return { ...state, screen: next };
    }

    case "BACK": {
      const previous = PREVIOUS_SCREEN[state.screen] ?? "search";

      // Stepping back before the authorization means the account chosen after it
      // no longer belongs to any screen the user can see.
      if (state.screen === "accounts") {
        return { ...state, screen: previous, accountId: null };
      }

      return { ...state, screen: previous };
    }

    case "RESUME": {
      const envelope = action.envelope;

      if (!isRecord(envelope)) {
        return state;
      }

      return {
        ...state,
        screen: SCREENS.includes(envelope.screen) ? envelope.screen : state.screen,
        brokerName: text(envelope.brokerName) ?? state.brokerName,
        accountId: text(envelope.accountId),
      };
    }

    default:
      return state;
  }
}

// ============================================================
// THE RESUME ENVELOPE
// ============================================================

// Written immediately before the browser leaves for authorization. It records
// where to come back to; it is not, and must never be read as, a claim that the
// authorization succeeded.
export function authorizeEnvelope(state, { now } = {}) {
  return {
    v: ENVELOPE_VERSION,
    screen: "pending",
    brokerName: text(state?.brokerName),
    accountId: null,
    savedAt: finiteNumber(now),
  };
}

export function serialize(value) {
  const source = isRecord(value) ? value : {};
  const envelope = {};

  for (const field of ENVELOPE_FIELDS) {
    envelope[field] = source[field] ?? null;
  }

  envelope.v = ENVELOPE_VERSION;

  return JSON.stringify(envelope);
}

export function deserialize(raw, { now, ttlMs = RESUME_TTL_MS } = {}) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "invalid", state: null };
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid", state: null };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: "invalid", state: null };
  }

  if (parsed.v !== ENVELOPE_VERSION) {
    return { ok: false, reason: "version", state: null };
  }

  if (!SCREENS.includes(parsed.screen)) {
    return { ok: false, reason: "invalid", state: null };
  }

  const brokerName = text(parsed.brokerName);

  if (!brokerName) {
    return { ok: false, reason: "invalid", state: null };
  }

  const savedAt = finiteNumber(parsed.savedAt);

  if (savedAt === null || savedAt < 0) {
    return { ok: false, reason: "invalid", state: null };
  }

  const window = finiteNumber(ttlMs) ?? RESUME_TTL_MS;

  if (finiteNumber(now) === null || now - savedAt > window) {
    return { ok: false, reason: "expired", state: null };
  }

  return {
    ok: true,
    reason: null,
    // Only the five fields survive. Anything a stale or hand-edited entry added -
    // a token, a note, a credential - is dropped here rather than carried in.
    state: {
      v: ENVELOPE_VERSION,
      screen: parsed.screen,
      brokerName,
      accountId: text(parsed.accountId),
      savedAt,
    },
  };
}

// ============================================================
// SEARCH OVER THE USER'S OWN SAVED ACCOUNTS
// ============================================================

// There is no broker directory in this app and no endpoint that supplies one, so
// the only honest thing to search is what this device already recorded: the
// user's own saved cTrader accounts. An empty query lists nothing rather than a
// curated guess.
export function searchSavedAccounts({ accounts, query, limit } = {}) {
  const needle = text(query)?.toLowerCase() ?? null;

  if (!needle || !Array.isArray(accounts)) {
    return [];
  }

  const cap = finiteNumber(limit) && limit > 0 ? limit : DEFAULT_MATCH_LIMIT;

  const matches = [];

  for (const account of accounts) {
    if (!isRecord(account)) {
      continue;
    }

    const identity = makeAccountIdentity(account);

    if (identity.brokerKey !== "ctrader" || !identity.externalId || !identity.accountId) {
      continue;
    }

    const brokerName = text(account.accountName) ?? text(account.name);

    const haystack = [brokerName, identity.externalId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(needle)) {
      continue;
    }

    matches.push({
      accountId: identity.accountId,
      externalId: identity.externalId,
      brokerName: brokerName ?? null,
    });

    if (matches.length >= cap) {
      break;
    }
  }

  return matches;
}

// Suggested names ride the same rule as the saved list: a blank query yields
// nothing. Fresh objects are returned rather than the frozen entries so a
// screen cannot reach the shared list through what it was handed.
export function brokerSuggestions({ query } = {}) {
  const needle = text(query)?.toLowerCase() ?? null;

  if (needle === null) {
    return [];
  }

  const suggestions = [];

  for (const suggestion of BROKER_SUGGESTIONS) {
    if (!suggestion.brokerName.toLowerCase().includes(needle)) {
      continue;
    }

    suggestions.push({ brokerName: suggestion.brokerName });
  }

  return suggestions;
}

// ============================================================
// ACCOUNT CHOICES AFTER AN AUTHORIZATION RETURNED
// ============================================================

// The account list comes from the aggregate the page already reads. Provenance is
// carried so a cached collection can never be rendered as a live one, and each
// choice is rebuilt field by field so nothing the backend happened to include -
// a token, a path, an internal note - can ride along into the screen or storage.
export function accountChoices({ snapshot } = {}) {
  const block = brokerSnapshot(snapshot, "ctrader");
  const collection = isRecord(block?.accounts) ? block.accounts : null;
  const items = Array.isArray(collection?.items) ? collection.items : null;

  if (!items) {
    return { source: "none", isLive: false, choices: [] };
  }

  const source = ACCOUNT_SOURCES.includes(collection.source)
    ? collection.source
    : "none";

  const isLive = source === "live";

  const choices = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const accountId = text(item.accountId);

    if (!accountId) {
      continue;
    }

    choices.push({
      accountId,
      label: accountId,
      name: text(item.name),
      traderLogin: text(item.traderLogin),
      live: isLive,
    });
  }

  return { source, isLive, choices };
}

// ============================================================
// VERIFICATION
// ============================================================

export function verificationState({
  session,
  loading = false,
  statusError = null,
  actionError = null,
} = {}) {
  if (text(actionError)) {
    return VERIFICATION.error;
  }

  if (loading) {
    return VERIFICATION.verifying;
  }

  // A status read that failed is not a connection that failed: nothing was
  // answered, so the honest word is unavailable.
  if (text(statusError)) {
    return VERIFICATION.unavailable;
  }

  if (!isRecord(session)) {
    return VERIFICATION.verifying;
  }

  if (session.validationError) {
    return VERIFICATION.unavailable;
  }

  return canMarkConnected(session)
    ? VERIFICATION.connected
    : VERIFICATION.unavailable;
}

// The gate. A session the validator accepted is the only thing that may be
// called connected, and it must also carry the sync stamp the page records only
// after every identity check has passed - which is what separates a validated
// round from a session object that was merely created.
export function canMarkConnected(session) {
  if (!isRecord(session)) {
    return false;
  }

  if (session.validationError !== null) {
    return false;
  }

  return Boolean(text(session.lastSuccessfulSync));
}

export function currentStep({ screen, verification } = {}) {
  const step = STEP_OF_SCREEN[screen] ?? 1;

  if (screen === "accounts" && verification === VERIFICATION.connected) {
    return 4;
  }

  return step;
}
