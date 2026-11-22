import {
  makeAccountIdentity,
  normalizeBrokerKey,
  findAccountIndex,
  resolveActiveAccountData,
} from "./brokerAccountIdentity.js";

// ============================================================
// PHASE 3 BROKER INTEGRATION VIEW MODEL
// ============================================================
//
// Everything here is pure: no fetch, no DOM, no React. It turns the aggregate
// the backend already returns (server/brokers/registry.js:188-194) plus the
// per-account collection responses into the exact values the Broker Integration
// workspace is allowed to display.
//
// The rule this module exists to enforce: a number or a list is shown only when
// a live session proved it belongs to the selected account. Anything else is
// null, which the components render as "Unavailable" — never zero and never a
// stored substitute.

export const UI_STATUS = Object.freeze({
  loading: "loading",
  connected: "connected",
  connecting: "connecting",
  disconnected: "disconnected",
  unreachable: "unreachable",
  error: "error",
});

// The one word every unvalidated value renders as.
export const UNAVAILABLE = "Unavailable";

// One word per status, shared by every surface that states a connection. A
// screen that chose its own would eventually call the same state two things.
export const UI_STATUS_LABEL = Object.freeze({
  [UI_STATUS.loading]: "Loading",
  [UI_STATUS.connected]: "Connected",
  [UI_STATUS.connecting]: "Connecting",
  [UI_STATUS.disconnected]: "Disconnected",
  [UI_STATUS.unreachable]: "Unreachable",
  [UI_STATUS.error]: "Error",
});

// The broker name the user walked into the connection wizard with. It is a
// record of a choice, not something the backend reported, so it lives apart
// from the account list and is only ever shown beside a validated session.
export const CTRADER_BROKER_LABEL_KEY = "edgeflo_ctrader_broker_label";

const UNVALIDATED_REASON = "Live data has not been validated.";

const CTRADER_ORDER_LISTING_REASON =
  "Pending-order listing is unavailable for cTrader.";

// ============================================================
// SMALL READS
// ============================================================

function text(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const string = String(value).trim();

  return string === "" ? null : string;
}

function lowerText(value) {
  return text(value)?.toLowerCase() ?? null;
}

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed === "") {
      return null;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function arrayOrNull(value) {
  return Array.isArray(value) ? value : null;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// Two servers describe the same host only case-insensitively, and a session
// that never reported one cannot contradict a stored record either.
function serversAgree(storedServer, liveServer) {
  if (!storedServer || !liveServer) {
    return true;
  }

  return storedServer === liveServer;
}

// ============================================================
// METRIC FORMATTING
// ============================================================

export function formatMetric(value, { currency = null, suffix = null } = {}) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return UNAVAILABLE;
  }

  const decimals = Number.isInteger(number) ? 0 : 2;

  const grouped = Math.abs(number).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const body = number < 0 ? `-${grouped}` : grouped;

  const withCurrency = currency ? `${currency} ${body}` : body;

  return suffix ? `${withCurrency}${suffix}` : withCurrency;
}

// ============================================================
// STATUS MAPPING
// ============================================================

export function brokerSnapshot(snapshot, brokerKey) {
  if (!isRecord(snapshot)) {
    return null;
  }

  const key = normalizeBrokerKey(brokerKey);

  if (!key) {
    return null;
  }

  return isRecord(snapshot.brokers?.[key]) ? snapshot.brokers[key] : null;
}

export function mapBrokerUiStatus({
  snapshot,
  brokerKey,
  loading = false,
  error = null,
} = {}) {
  if (error) {
    return UI_STATUS.error;
  }

  if (isRecord(snapshot) && snapshot.success === false) {
    return UI_STATUS.error;
  }

  const broker = brokerSnapshot(snapshot, brokerKey);

  if (!broker) {
    return loading ? UI_STATUS.loading : UI_STATUS.unreachable;
  }

  const connection = isRecord(broker.connection) ? broker.connection : {};

  // An adapter that failed outright is reported as an error even when it also
  // marks itself unreachable; only a plain unreachable probe is "unreachable".
  if (connection.state === "error") {
    return UI_STATUS.error;
  }

  if (connection.serviceReachable === false) {
    return UI_STATUS.unreachable;
  }

  switch (connection.state) {
    case "connected":
      // A session that refuses to name its account cannot be called connected.
      return text(broker.identity?.externalId)
        ? UI_STATUS.connected
        : UI_STATUS.error;
    case "authenticating":
      return UI_STATUS.connecting;
    case "disconnected":
      return UI_STATUS.disconnected;
    default:
      return UI_STATUS.unreachable;
  }
}

// ============================================================
// ACCOUNT ROWS
// ============================================================

// The external account number alone is not a key: two brokers, or two local
// records, can carry the same number.
function rowKeyFor(brokerKey, identity) {
  return [
    brokerKey,
    identity.externalId ?? "unlinked",
    identity.accountId ?? "no-local-id",
  ].join(":");
}

function liveIdentityOf(broker) {
  const externalId = text(broker?.identity?.externalId);

  if (!externalId) {
    return null;
  }

  return {
    externalId,
    server: lowerText(broker?.identity?.server),
  };
}

export function buildAccountRows({
  storedAccounts,
  brokerKey,
  snapshot,
} = {}) {
  const key = normalizeBrokerKey(brokerKey);

  if (!key || !Array.isArray(storedAccounts)) {
    return [];
  }

  const live = liveIdentityOf(brokerSnapshot(snapshot, key));

  const rows = [];

  for (const account of storedAccounts) {
    if (!isRecord(account)) {
      continue;
    }

    const identity = makeAccountIdentity(account);

    if (identity.brokerKey !== key) {
      continue;
    }

    const isLiveSession = Boolean(
      live &&
        identity.externalId &&
        identity.externalId === live.externalId &&
        serversAgree(identity.server, live.server)
    );

    rows.push({
      rowKey: rowKeyFor(key, identity),
      account,
      identity,
      isLiveSession,
    });
  }

  return rows;
}

// ============================================================
// NON-DESTRUCTIVE ACCOUNT MERGE
// ============================================================

function sameRecord(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => right[key] === left[key]);
}

export function mergeBrokerAccount(accounts, candidate) {
  const list = Array.isArray(accounts) ? accounts : [];

  if (!isRecord(candidate)) {
    return { accounts: list, account: null, changed: false };
  }

  const incoming = { ...candidate };

  const identity = makeAccountIdentity(incoming);

  // A candidate that claims no broker account must not overwrite a record that
  // does, and must not be appended on every poll as a fresh duplicate.
  if (!identity.brokerKey || !identity.externalId) {
    return { accounts: list, account: null, changed: false };
  }

  const index = findAccountIndex(list, identity);

  if (index === -1) {
    return { accounts: [...list, incoming], account: incoming, changed: true };
  }

  const existing = list[index];

  // The local id belongs to the user's record, not to the session reporting it.
  const merged = {
    ...existing,
    ...incoming,
    id: text(existing.id) ?? identity.accountId,
  };

  if (sameRecord(existing, merged)) {
    return { accounts: list, account: existing, changed: false };
  }

  const next = list.slice();

  next[index] = merged;

  return { accounts: next, account: merged, changed: true };
}

// ============================================================
// REQUEST GENERATIONS
// ============================================================

export function createRequestGuard() {
  let current = null;

  return {
    begin(selection) {
      current = Object.freeze({
        brokerKey: selection?.brokerKey ?? null,
        accountId: selection?.accountId == null ? null : String(selection.accountId),
      });

      return current;
    },
    isCurrent(token) {
      return token !== null && token === current;
    },
    invalidate() {
      current = null;
    },
  };
}

// ============================================================
// SESSION SHAPE
// ============================================================

export function createEmptySession() {
  return {
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
    pendingOrdersReason: UNVALIDATED_REASON,
    lastSuccessfulSync: null,
    validationError: null,
  };
}

function rejectedSession(reason) {
  return {
    ...createEmptySession(),
    pendingOrdersReason: reason,
    validationError: reason,
  };
}

function readMetrics(block, { currencyKey = "currency" } = {}) {
  if (!isRecord(block)) {
    return {
      balance: null,
      equity: null,
      marginUsed: null,
      freeMargin: null,
      currency: null,
      leverage: null,
    };
  }

  return {
    balance: toFiniteNumber(block.balance),
    equity: toFiniteNumber(block.equity),
    marginUsed: toFiniteNumber(block.margin),
    freeMargin: toFiniteNumber(block.freeMargin),
    currency: text(block[currencyKey]),
    leverage: toFiniteNumber(block.leverage),
  };
}

// ============================================================
// MT5 SESSION VALIDATION
// ============================================================

export function validateMt5Session({
  accounts,
  selectedAccountId,
  aggregate,
  positionsResponse,
  ordersResponse,
  postOrdersAggregate,
  synchronizedAt = null,
} = {}) {
  const broker = brokerSnapshot(aggregate, "mt5");

  if (!broker || broker.connection?.state !== "connected") {
    return rejectedSession(
      "The MT5 live session is not connected, so no account data can be presented."
    );
  }

  const liveExternalId = text(broker.identity?.externalId);
  const liveServer = lowerText(broker.identity?.server);

  if (!liveExternalId) {
    return rejectedSession(
      "The MT5 session is connected but reports no login, so no account data can be attributed."
    );
  }

  const verdict = resolveActiveAccountData({
    accounts,
    selectedAccountId,
    liveIdentity: {
      broker: "mt5",
      externalId: liveExternalId,
      server: liveServer,
    },
  });

  if (!verdict.ok) {
    return rejectedSession(verdict.reason);
  }

  // Pending orders are read after the positions call, so the terminal may have
  // logged into another account in between. Nothing from this round survives a
  // changed session, because the pieces could belong to different accounts.
  const postOrdersBroker = brokerSnapshot(postOrdersAggregate, "mt5");
  const postOrdersExternalId = text(postOrdersBroker?.identity?.externalId);
  const postOrdersServer = lowerText(postOrdersBroker?.identity?.server);

  if (
    !postOrdersBroker ||
    postOrdersExternalId !== liveExternalId ||
    !serversAgree(liveServer, postOrdersServer)
  ) {
    return rejectedSession(
      "The MT5 session changed while pending orders were being read, so this response cannot be attributed."
    );
  }

  // Positions arrive with the login and server the bridge actually queried.
  if (positionsResponse?.success === true) {
    const reportedLogin = text(
      positionsResponse.mt5Login ?? positionsResponse.login
    );
    const reportedServer = lowerText(
      positionsResponse.mt5Server ?? positionsResponse.server
    );

    if (!reportedLogin) {
      return rejectedSession(
        "The MT5 positions response reported no session identity, so its positions cannot be attributed."
      );
    }

    if (
      reportedLogin !== liveExternalId ||
      !serversAgree(liveServer, reportedServer)
    ) {
      return rejectedSession(
        "The MT5 positions response describes a different login or server, so its positions cannot be attributed."
      );
    }
  }

  const session = createEmptySession();

  session.metrics = readMetrics(broker.account);

  session.positions =
    positionsResponse?.success === true
      ? arrayOrNull(positionsResponse.positions)
      : null;

  const validatedOrders =
    ordersResponse?.success === true &&
    arrayOrNull(ordersResponse.orders) !== null;

  if (validatedOrders) {
    session.pendingOrders = arrayOrNull(ordersResponse.orders);
    session.pendingOrdersReason = null;
  } else if (ordersResponse?.success === true) {
    session.pendingOrdersReason =
      "The MT5 pending-orders response carried no list.";
  } else {
    session.pendingOrdersReason =
      "The MT5 bridge could not list pending orders.";
  }

  session.lastSuccessfulSync = text(synchronizedAt);

  return session;
}

// ============================================================
// cTRADER SESSION VALIDATION
// ============================================================

export function validateCtraderSession({
  accounts,
  selectedAccountId,
  aggregate,
  serviceResponse,
  synchronizedAt = null,
} = {}) {
  const broker = brokerSnapshot(aggregate, "ctrader");

  if (!broker || broker.connection?.state !== "connected") {
    return rejectedSession(
      "The cTrader live session is not connected, so no account data can be presented."
    );
  }

  const liveExternalId = text(broker.identity?.externalId);

  if (!liveExternalId) {
    return rejectedSession(
      "The cTrader session reports no authenticated account id, so no account data can be attributed."
    );
  }

  // Cached OAuth and a cached account selection are reconnect context, not
  // evidence that this account is live right now.
  if (broker.accounts?.activeAccount?.activeAccountSource !== "live") {
    return rejectedSession(
      "The active cTrader account came from the local cache rather than the live account list, so its data cannot be presented."
    );
  }

  if (broker.accounts?.mismatch === true) {
    return rejectedSession(
      "The cTrader account this app selected is not the account the service authenticated."
    );
  }

  const service = isRecord(serviceResponse?.service)
    ? serviceResponse.service
    : null;

  if (!service) {
    return rejectedSession(
      "The cTrader service status is unavailable, so no live account data can be read."
    );
  }

  const serviceAccountId = text(service.tradingAccountId);

  if (!serviceAccountId) {
    return rejectedSession(
      "The cTrader service reported no trading account id, so its data cannot be attributed."
    );
  }

  if (serviceAccountId !== liveExternalId) {
    return rejectedSession(
      "The cTrader service is authenticated against a different account than the live session identity, so its data cannot be attributed."
    );
  }

  const verdict = resolveActiveAccountData({
    accounts,
    selectedAccountId,
    liveIdentity: {
      broker: "ctrader",
      externalId: liveExternalId,
      server: null,
    },
  });

  if (!verdict.ok) {
    return rejectedSession(verdict.reason);
  }

  const session = createEmptySession();

  // Metrics and positions come from the live service only. A cached account
  // block in the aggregate is never a substitute for a missing live value.
  session.metrics = readMetrics(service.account);
  session.positions = arrayOrNull(service.openPositions);
  session.pendingOrders = null;
  session.pendingOrdersReason = CTRADER_ORDER_LISTING_REASON;
  session.lastSuccessfulSync = text(synchronizedAt);

  return session;
}
