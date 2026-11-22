// ============================================================
// BROKER-AWARE ACCOUNT IDENTITY (Phase 2)
// ============================================================
//
// One identity model for every EdgeFlo trading account. An account is
// identified by a PAIR — its broker discriminator plus that broker's own
// external account id — and never by either half alone. Two accounts on
// different brokers may legitimately carry the same external number, so any
// lookup keyed on the number alone can bind MT5 data to a cTrader account.
//
// Nothing here fabricates a broker. `identityStatus` says how much of the
// identity the stored data actually carried, so "unknown" survives the
// round-trip instead of quietly becoming MT5.

export const BROKER_KEYS = ["mt5", "ctrader"];

const BROKER_ALIASES = {
  mt5: "mt5",
  "mt5": "mt5",
  metaquotes: "mt5",
  metatrader: "mt5",
  metatrader5: "mt5",
  "metatrader 5": "mt5",
  ctrader: "ctrader",
  "c trader": "ctrader",
};

const BROKER_LABELS = {
  mt5: "MT5",
  ctrader: "cTrader",
};

const ID_PREFIXES = {
  "mt5-": "mt5",
  "ctrader-": "ctrader",
};

const UNLINKED_SEGMENT = "unlinked";

// ============================================================
// DISCRIMINATOR
// ============================================================

export function normalizeBrokerKey(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().toLowerCase().replace(/[_\s]+/g, " ");

  if (text === "") {
    return null;
  }

  const withoutSpaces = text.replace(/ /g, "");

  if (BROKER_ALIASES[text]) {
    return BROKER_ALIASES[text];
  }

  if (BROKER_ALIASES[withoutSpaces]) {
    return BROKER_ALIASES[withoutSpaces];
  }

  return null;
}

export function canonicalBrokerLabel(brokerKey) {
  const key = normalizeBrokerKey(brokerKey);

  return key ? BROKER_LABELS[key] : null;
}

// ============================================================
// FIELD READS
// ============================================================

function text(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const string = String(value).trim();

  return string === "" ? null : string;
}

function idSuffix(value, prefix) {
  const string = text(value);

  if (!string || !string.toLowerCase().startsWith(prefix)) {
    return null;
  }

  return string.slice(prefix.length).trim() || null;
}

function externalIdFor(account, brokerKey) {
  const direct =
    text(account.brokerAccountId) ??
    text(account.ctidTraderAccountId) ??
    text(account.traderAccountId);

  if (direct) {
    return direct;
  }

  if (brokerKey === "mt5") {
    return text(account.mt5Login) ?? text(account.login);
  }

  if (brokerKey === "ctrader") {
    return text(account.traderLogin) ?? null;
  }

  return null;
}

// ============================================================
// ACCOUNT IDENTITY
// ============================================================

export function makeAccountIdentity(account) {
  if (!account || typeof account !== "object") {
    return {
      accountId: null,
      brokerKey: null,
      rawBroker: null,
      externalId: null,
      server: null,
      storageSegment: UNLINKED_SEGMENT,
      identityStatus: "absent",
    };
  }

  const rawBroker = text(account.broker);
  const explicitKey = normalizeBrokerKey(account.broker);

  let brokerKey = explicitKey;
  let identityStatus = "explicit";

  if (!brokerKey && !rawBroker) {
    const prefixKey = inferBrokerKeyFromId(account.id);

    if (prefixKey) {
      brokerKey = prefixKey;
      identityStatus = "inferred_id_prefix";
    }
  }

  if (!brokerKey && identityStatus !== "inferred_id_prefix") {
    brokerKey = null;
    identityStatus = rawBroker ? "unsupported" : "absent";
  }

  const externalId =
    externalIdFor(account, brokerKey) ??
    (brokerKey ? idSuffix(account.id, `${brokerKey}-`) : null);

  const server =
    (text(account.mt5Server) ?? text(account.server))?.toLowerCase() ?? null;

  return {
    accountId: text(account.id),
    brokerKey,
    rawBroker,
    externalId,
    server,
    storageSegment: brokerKey ?? UNLINKED_SEGMENT,
    identityStatus,
  };
}

export function inferBrokerKeyFromId(accountId) {
  const string = text(accountId);

  if (!string) {
    return null;
  }

  const lower = string.toLowerCase();

  for (const [prefix, brokerKey] of Object.entries(ID_PREFIXES)) {
    if (lower.startsWith(prefix)) {
      return brokerKey;
    }
  }

  return null;
}

// ============================================================
// LEGACY MIGRATION
// ============================================================

// `changed` answers "does stored data need writing back".
// `changes` is narrower on purpose: it lists only the accounts whose broker
// discriminator had to be INFERRED, which is the part a user should be told
// about. Accounts that already stated their broker gain a derived field and
// are not reported as changed identities.

export function migrateTradingAccounts(accounts) {
  if (!Array.isArray(accounts)) {
    return { accounts: [], changed: false, changes: [] };
  }

  const changes = [];

  const migrated = accounts.map((account) => {
    if (!account || typeof account !== "object") {
      return account;
    }

    const identity = makeAccountIdentity(account);

    const next = {
      ...account,
      brokerKey: identity.brokerKey,
      identityStatus: identity.identityStatus,
    };

    if (identity.externalId && !text(next.brokerAccountId)) {
      next.brokerAccountId = identity.externalId;
    }

    const differs =
      account.brokerKey !== next.brokerKey ||
      account.identityStatus !== next.identityStatus ||
      account.brokerAccountId !== next.brokerAccountId;

    if (differs && identity.identityStatus === "inferred_id_prefix") {
      changes.push({
        id: identity.accountId,
        brokerKey: identity.brokerKey,
        identityStatus: identity.identityStatus,
      });
    }

    return differs ? next : account;
  });

  const changed = migrated.some(
    (account, index) => account !== accounts[index]
  );

  return { accounts: migrated, changed, changes };
}

// ============================================================
// CROSS-BROKER MATCHING
// ============================================================

export function accountsMatch(left, right) {
  const a = isIdentity(left) ? left : makeAccountIdentity(left);
  const b = isIdentity(right) ? right : makeAccountIdentity(right);

  if (!a.brokerKey || !b.brokerKey) {
    return false;
  }

  if (a.brokerKey !== b.brokerKey) {
    return false;
  }

  if (!a.externalId || !b.externalId) {
    return false;
  }

  return a.externalId === b.externalId;
}

export function findAccountIndex(accounts, identity) {
  if (!Array.isArray(accounts)) {
    return -1;
  }

  const wanted = isIdentity(identity) ? identity : makeAccountIdentity(identity);

  return accounts.findIndex((account) => accountsMatch(account, wanted));
}

function isIdentity(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "identityStatus") &&
      Object.prototype.hasOwnProperty.call(value, "storageSegment")
  );
}

// ============================================================
// ACTIVE ACCOUNT / LIVE DATA VALIDATION
// ============================================================

const REASONS = {
  no_selection:
    "No trading account is selected, so no live broker data can be attributed to one.",
  unknown_account:
    "The selected account id is not present in the stored trading accounts.",
  broker_mismatch:
    "The live session belongs to a different broker than the selected account.",
  external_id_mismatch:
    "The live session is on the same broker but a different account number.",
  server_mismatch:
    "The live session is on the same broker and login but a different server.",
  identity_absent:
    "The selected account carries no broker discriminator, so live broker data cannot be attributed to it.",
  identity_incomplete:
    "The selected account has no external account id, so live broker data cannot be attributed to it.",
  identity_unsupported:
    "The selected account names a broker this application has no adapter for.",
  live_identity_unavailable:
    "The selected account belongs to a broker, but no live session reported its identity, so its stored numbers cannot be presented as current broker data.",
  live_identity_invalid:
    "The live session did not report a broker this application recognises.",
  live_identity_incomplete:
    "The live session did not report its external account id, so its data cannot be accepted.",
  ok: "The selected account and the live session are the same broker account.",
};

export function resolveActiveAccountData({
  accounts,
  selectedAccountId,
  liveIdentity,
} = {}) {
  const list = Array.isArray(accounts) ? accounts : [];

  const selection = text(selectedAccountId);

  const stored = selection
    ? list.find((account) => text(account?.id) === selection) ?? null
    : null;

  const reject = (status, account) => ({
    ok: false,
    status,
    reason: REASONS[status],
    account: account ?? null,
    identity: account ? makeAccountIdentity(account) : null,
  });

  if (!selection) {
    return reject("no_selection");
  }

  if (!stored) {
    return reject("unknown_account");
  }

  const identity = makeAccountIdentity(stored);

  // A manual account never claims a broker identity, so it stays selectable
  // with no live session. A broker account does claim one, so without a live
  // identity its stored numbers must not be presented as current broker data.
  if (!liveIdentity && identity.identityStatus === "absent") {
    return {
      ok: true,
      status: "ok",
      reason: REASONS.ok,
      account: stored,
      identity,
    };
  }

  if (!liveIdentity && !identity.brokerKey) {
    return reject(
      identity.identityStatus === "unsupported"
        ? "identity_unsupported"
        : "identity_incomplete",
      stored
    );
  }

  if (!liveIdentity) {
    return reject("live_identity_unavailable", stored);
  }

  const liveKey = normalizeBrokerKey(liveIdentity.broker);

  if (!liveKey) {
    return reject("live_identity_invalid", stored);
  }

  if (!identity.brokerKey) {
    return reject(
      identity.identityStatus === "unsupported"
        ? "identity_unsupported"
        : "identity_absent",
      stored
    );
  }

  if (identity.brokerKey !== liveKey) {
    return reject("broker_mismatch", stored);
  }

  const liveExternalId = text(liveIdentity.externalId);

  if (!liveExternalId) {
    return reject("live_identity_incomplete", stored);
  }

  if (!identity.externalId) {
    return reject("identity_incomplete", stored);
  }

  if (identity.externalId !== liveExternalId) {
    return reject("external_id_mismatch", stored);
  }

  const liveServer = text(liveIdentity.server)?.toLowerCase() ?? null;

  if (
    identity.server &&
    liveServer &&
    identity.server !== liveServer
  ) {
    return reject("server_mismatch", stored);
  }

  return {
    ok: true,
    status: "ok",
    reason: REASONS.ok,
    account: stored,
    identity,
  };
}

// ============================================================
// BROKER-SCOPED PER-ACCOUNT STORAGE
// ============================================================

export function accountStorageKey(baseKey, identity) {
  const accountId = identity?.accountId ?? identity?.id;

  if (!accountId) {
    return null;
  }

  const segment = normalizeBrokerKey(identity?.brokerKey) ?? UNLINKED_SEGMENT;

  return `${baseKey}_${segment}_${accountId}`;
}

export function legacyAccountStorageKey(baseKey, accountId) {
  if (!accountId) {
    return null;
  }

  return `${baseKey}_${accountId}`;
}

export function loadAccountScopedData(
  storage,
  baseKey,
  { brokerKey, accountId, id, fallback = null } = {}
) {
  const resolvedId = accountId ?? id ?? null;
  const scopedKey = accountStorageKey(baseKey, { brokerKey, accountId: resolvedId });
  const legacyKey = legacyAccountStorageKey(baseKey, resolvedId);

  const absent = { status: "absent", value: fallback, key: null };

  if (!storage || typeof storage.getItem !== "function") {
    return absent;
  }

  if (scopedKey) {
    const scoped = readRaw(storage, scopedKey);

    if (scoped !== null) {
      return parse(scoped, scopedKey, "broker_scoped", fallback);
    }
  }

  if (legacyKey) {
    const legacy = readRaw(storage, legacyKey);

    if (legacy !== null) {
      return parse(legacy, legacyKey, "legacy", fallback);
    }
  }

  return absent;
}

function readRaw(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw, key, status, fallback) {
  try {
    return { status, value: JSON.parse(raw), key };
  } catch {
    return { status: "corrupt", value: fallback, key };
  }
}
