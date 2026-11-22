export const BROKER_IDS = ["mt5", "ctrader"];
export const IC_MARKETS_BROKER_ID = "ic-markets";
export const CTRADER_PLATFORM_ID = "ctrader";
export const TRADING_ENVIRONMENTS = ["demo", "live"];
export const UNKNOWN_ENVIRONMENT = "unknown";

const BROKER_ALIASES = {
  mt5: "mt5",
  metaquotes: "mt5",
  metatrader: "mt5",
  metatrader5: "mt5",
  ctrader: "ctrader",
};

function toText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const string = String(value).trim();

  return string === "" ? null : string;
}

function normalizeIdentifier(value) {
  const text = toText(value);

  if (text === null || /^\[object /i.test(text)) {
    return null;
  }

  return text;
}

function normalizeBrokerId(value) {
  const string = toText(value)?.toLowerCase().replace(/[\s_-]+/g, "");

  if (!string) {
    return null;
  }

  return BROKER_ALIASES[string] ?? null;
}

/**
 * The one account-identity shape this server publishes: a broker discriminator
 * plus THAT broker's external account id. The pair is the identity — the number
 * alone is not, because MT5 logins and cTrader account ids are independent
 * numbering spaces and can legitimately hold the same digits.
 *
 * Nothing here guesses. An unrecognised broker, or a broker session that did not
 * report its account, yields `key: null` and a note saying which.
 */
export function makeBrokerIdentity({
  broker,
  externalId,
  server,
  traderLogin,
  requestedAccountId,
  source,
  note,
} = {}) {
  const brokerId = normalizeBrokerId(broker);
  const resolvedExternalId = toText(externalId);
  const resolvedRequested = toText(requestedAccountId);

  if (!brokerId) {
    return {
      broker: null,
      externalId: null,
      server: null,
      traderLogin: null,
      requestedAccountId: resolvedRequested,
      matchesRequestedAccount: false,
      key: null,
      source: toText(source),
      note:
        toText(note) ||
        `Broker "${String(broker ?? "")}" has no adapter on this server, so no account identity can be attributed to it.`,
    };
  }

  const identity = {
    broker: brokerId,
    externalId: resolvedExternalId,
    server: toText(server),
    traderLogin: toText(traderLogin),
    requestedAccountId: resolvedRequested,
    matchesRequestedAccount: Boolean(
      resolvedExternalId &&
        resolvedRequested &&
        resolvedExternalId === resolvedRequested
    ),
    key: resolvedExternalId ? `${brokerId}:${resolvedExternalId}` : null,
    source: toText(source),
    note: null,
  };

  if (!resolvedExternalId) {
    identity.note =
      toText(note) ||
      "This broker session reported no external account id, so no account is identified.";
  }

  return identity;
}

export function normalizeTradingEnvironment(value) {
  const environment = toText(value)?.toLowerCase();

  return TRADING_ENVIRONMENTS.includes(environment)
    ? environment
    : UNKNOWN_ENVIRONMENT;
}

function tradingAccountRefusal(code, message) {
  return {
    ok: false,
    account: null,
    code,
    message,
  };
}

export function makeTradingAccount({
  accountId,
  externalAccountId,
  brokerId,
  platformId,
  environment,
  label,
} = {}) {
  const localId = normalizeIdentifier(accountId);

  if (localId === null) {
    return tradingAccountRefusal(
      "account_id_required",
      "A trading account needs a stable local account id, so none was created."
    );
  }

  const externalId = normalizeIdentifier(externalAccountId);

  if (externalId === null) {
    return tradingAccountRefusal(
      "external_account_id_required",
      "A trading account needs the platform's external account id, so none was created."
    );
  }

  const resolvedBrokerId = normalizeIdentifier(brokerId);

  if (resolvedBrokerId !== IC_MARKETS_BROKER_ID) {
    return tradingAccountRefusal(
      "unsupported_broker",
      `Broker "${String(brokerId ?? "")}" is not ${IC_MARKETS_BROKER_ID}, so no trading account was created.`
    );
  }

  const resolvedPlatformId = normalizeIdentifier(platformId);

  if (resolvedPlatformId !== CTRADER_PLATFORM_ID) {
    return tradingAccountRefusal(
      "unsupported_platform",
      `Platform "${String(platformId ?? "")}" is not ${CTRADER_PLATFORM_ID}, so no trading account was created.`
    );
  }

  return {
    ok: true,
    account: {
      accountId: localId,
      externalAccountId: externalId,
      brokerId: IC_MARKETS_BROKER_ID,
      platformId: CTRADER_PLATFORM_ID,
      environment: normalizeTradingEnvironment(environment),
      label: toText(label),
    },
  };
}
