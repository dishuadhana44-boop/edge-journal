import { makeBrokerIdentity } from "./identity.js";

function toText(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  return text === "" ? null : text;
}

function safeInvoke(fn, fallback) {
  try {
    const value = fn();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function deriveState({ service }) {
  if (service.connected && service.authenticated && service.ready) {
    return "connected";
  }

  if (service.connected) {
    return "authenticating";
  }

  return "disconnected";
}

const STATUS_UNREAD_REASON =
  "The cTrader service status could not be read when this snapshot was requested, so the socket flags are unknown rather than observed to be down.";

const STATUS_FIELD_LIMITATION =
  "connection.serviceReachable for cTrader reports only whether the in-process service module returned a usable status object when asked. This adapter performs no network probe, so true is not evidence that the cTrader endpoint answered, and false means the service state could not be read at all.";

const STATUS_UNREAD_LIMITATION =
  "The cTrader service status could not be read when this snapshot was built, so `state: \"disconnected\"` and the socket booleans below are fallbacks for a failed read; the connection state is unknown, not observed to be down.";

export function createCtraderAdapter({
  getServiceStatus,
  getLiveAccounts,
  getAuthSummary,
} = {}) {
  function readService() {
    const rawStatus = safeInvoke(() => getServiceStatus(), null);
    const statusObserved =
      rawStatus !== null &&
      typeof rawStatus === "object" &&
      !Array.isArray(rawStatus);

    const status = statusObserved ? rawStatus : {};

    return {
      statusObserved,
      running: status?.running === true,
      connected: status?.connected === true,
      authenticated: status?.authenticated === true,
      ready: status?.ready === true,
      serviceAccountId: toText(status?.tradingAccountId),
      symbol: toText(status?.symbol),
      positionsCount: Number.isFinite(status?.positionsCount)
        ? status.positionsCount
        : null,
      account: status?.account && typeof status.account === "object"
        ? {
            accountId: toText(status.account.accountId),
            balance:
              Number.isFinite(status.account.balance)
                ? status.account.balance
                : null,
            equity:
              Number.isFinite(status.account.equity)
                ? status.account.equity
                : null,
            margin:
              Number.isFinite(status.account.margin)
                ? status.account.margin
                : null,
            freeMargin:
              Number.isFinite(status.account.freeMargin)
                ? status.account.freeMargin
                : null,
            currency: toText(status.account.currency),
            leverage: toText(status.account.leverage),
            brokerName: toText(status.account.brokerName),
            depositCurrency: toText(status.account.depositCurrency),
          }
        : null,
    };
  }

  function readAuthorization() {
    const auth = safeInvoke(() => getAuthSummary(), {});

    return {
      connected: auth?.connected === true,
      hasAccessToken: auth?.hasAccessToken === true,
      hasRefreshToken: auth?.hasRefreshToken === true,
      activeAccountId: toText(auth?.activeAccountId),
      cachedAccounts: asArray(auth?.accounts).map((account) => ({
        accountId: toText(account?.accountId),
        name: toText(account?.name),
        createdAt: toText(account?.createdAt),
      })),
    };
  }

  function readLiveAccounts() {
    return asArray(safeInvoke(() => getLiveAccounts(), [])).map((account) => ({
      accountId: toText(account?.accountId),
      traderLogin: toText(account?.traderLogin),
      isLive: account?.isLive === true,
      lastLoginTime: toText(account?.lastLoginTime),
    }));
  }

  function liveLoginForAccount(accountId) {
    if (!accountId) {
      return null;
    }

    const match = readLiveAccounts().find(
      (account) => account.accountId === accountId
    );

    return match ? match.traderLogin : null;
  }

  function buildAccountsBlock(service, authorization) {
    const live = readLiveAccounts().filter(
      (account) => account.accountId !== null
    );

    const cache = authorization.cachedAccounts.filter(
      (account) => account.accountId !== null
    );

    const nameByAccountId = new Map(
      cache
        .filter((account) => account.name !== null)
        .map((account) => [account.accountId, account.name])
    );

    const requestedActiveId = authorization.activeAccountId;
    const activeFromService = service.serviceAccountId;

    const resolveActive = (pool) => {
      const wanted = requestedActiveId || activeFromService;

      if (!wanted) return null;

      return pool.find((account) => account.accountId === wanted) || null;
    };

    const common = {
      broker: "ctrader",
      activeAccountId: requestedActiveId || activeFromService || null,
      activeAccountSource: null,
      serviceReportedAccountId: activeFromService,
      requestedActiveAccountId: requestedActiveId,
      mismatch: Boolean(
        requestedActiveId &&
          activeFromService &&
          requestedActiveId !== activeFromService
      ),
    };

    if (live.length > 0) {
      const items = live.map((account) => ({
        ...account,
        name: nameByAccountId.get(account.accountId) || null,
        nameSource: nameByAccountId.has(account.accountId)
          ? "local_cache"
          : null,
      }));

      const active = resolveActive(items);

      return {
        ...common,
        enumerable: true,
        source: "live",
        isLive: true,
        observedVia: "authenticated cTrader service (GET_ACCOUNTS_RES)",
        items,
        activeAccount: active
          ? { ...active, activeAccountSource: "live" }
          : null,
        note:
          requestedActiveId === null
            ? "No account was explicitly selected. The active id below is whatever the running service authenticated against."
            : null,
      };
    }

    if (cache.length > 0) {
      const items = cache.map((account) => ({
        ...account,
        traderLogin: null,
        isLive: null,
        lastLoginTime: null,
      }));

      const active = resolveActive(items);

      return {
        ...common,
        enumerable: true,
        source: "cache",
        isLive: false,
        observedVia: "server/ctrader-auth.json",
        items,
        activeAccount: active
          ? { ...active, activeAccountSource: "cache" }
          : null,
        note:
          "The cTrader service is not connected, so the live account list from the broker could not be read. These entries are the locally cached ones and may be stale, incomplete or no longer authorized.",
      };
    }

    return {
      ...common,
      enumerable: true,
      source: "none",
      isLive: false,
      observedVia: null,
      items: [],
      activeAccount: null,
      note:
        "No cTrader account information is available: the service returned no live accounts and no accounts are cached locally.",
    };
  }

  async function probe() {
    const observedAt = new Date().toISOString();

    const service = readService();
    const authorization = readAuthorization();
    const accounts = buildAccountsBlock(service, authorization);

    const state = deriveState({ service });
    const authenticatedAccountId =
      service.connected && service.authenticated && service.ready
        ? service.serviceAccountId
        : null;

    const limitations = [
      STATUS_FIELD_LIMITATION,
      "The service dials a hardcoded demo endpoint (the WS_URL constant in server/services/ctraderService.js), so live-account connections are not currently possible.",
      "One outbound cTrader WebSocket per Node process: the service keeps its socket, symbols and positions in module globals, so selecting a different account stops and rebuilds the whole connection.",
      "There is no heartbeat and no automatic reconnect; the socket close handler only resets state, so a dropped connection stays down until something starts the service again.",
      "The stored refresh token and expiry are never used, so an expired access token cannot recover without repeating OAuth.",
      "Access tokens and refresh tokens are never returned by this endpoint, only whether they exist.",
      "Market orders resolve the requested symbol against the account's own symbol directory and answer 409 when it is unknown or lacks full configuration. A send now waits for the broker's own execution event, correlated by the clientOrderId this process generated, and reports success only for that matched frame; when no frame names the order within 10s the answer is 504 with status unconfirmed, never success. That the broker echoes our client order id back on the execution event is an UNVERIFIED protocol assumption: no cTrader session has ever been observed from this code, so a real fill may be reported as unconfirmed until it is proven live.",
      "Full trading configuration exists only for symbols the service has activated: startup activates EURUSD, no HTTP route selects a trading symbol, and placing an order never activates one, so every other symbol is refused with 409 instead of being traded on a substitute.",
      "POST /api/ctrader/position/close is gated on the live position record: it answers 409 unless the broker-supplied position carries a symbolId, and it still reports success at send time rather than from the broker execution response.",
      "POST /api/ctrader/position/amend (stop loss / take profit) is unchanged by the market-order work: it still reports success at send time rather than from the broker execution response, so a rejected amend is indistinguishable from an applied one.",
      "Pending orders arrive inside the reconcile response but are never read, so order listing is unavailable.",
    ];

    if (!service.statusObserved) {
      limitations.unshift(STATUS_UNREAD_LIMITATION);
    }

    return {
      id: "ctrader",
      displayName: "cTrader",
      connection: {
        state,
        connected: state === "connected",
        serviceReachable: service.statusObserved,
        observedAt,
        sourceTimestamp: null,
        reason: !service.statusObserved
          ? STATUS_UNREAD_REASON
          : state === "connected"
            ? null
            : `Socket connected=${service.connected}, authenticated=${service.authenticated}, ready=${service.ready}; OAuth stored connected=${authorization.connected}, hasAccessToken=${authorization.hasAccessToken}.`,
      },
      transport: {
        running: service.running,
        connected: service.connected,
        authenticated: service.authenticated,
        ready: service.ready,
        activeSymbol: service.symbol,
        positionsCount: service.positionsCount,
      },
      authorization: {
        connected: authorization.connected,
        hasAccessToken: authorization.hasAccessToken,
        hasRefreshToken: authorization.hasRefreshToken,
        note: "Token values are intentionally omitted.",
      },
      session: {
        scope: "process_singleton_socket",
        accountScoped: true,
        identity: {
          accountId: authenticatedAccountId,
        },
        limitations,
      },
      account: service.account
        ? { ...service.account, source: "authenticated cTrader service" }
        : null,
      identity: makeBrokerIdentity({
        broker: "ctrader",
        externalId: authenticatedAccountId,
        traderLogin: liveLoginForAccount(authenticatedAccountId),
        requestedAccountId: authorization.activeAccountId,
        source: authenticatedAccountId
          ? "authenticated and ready cTrader service session (GET_ACCOUNTS_RES tradingAccountId)"
          : "no authenticated and ready cTrader service session; the locally cached selection is not a live identity",
        note: authenticatedAccountId
          ? null
          : "The cTrader service is not authenticated and ready, so no live account identity is claimed.",
      }),
      accounts,
      execution: {
        provider: "ctrader-openapi-websocket",
        transport: "websocket",
        requiresLocalService: true,
        browserCompatible: false,
      },
      capabilities: {
        status: true,
        accountInfo: true,
        positions: true,
        orderListing: false,
        candles: false,
        livePrice: true,
        tradeHistory: false,
        marketOrders: false,
        pendingOrderSubmission: false,
        closePosition: false,
        modifyPosition: true,
        accountEnumeration: accounts.source === "live",
      },
      lifecycle: {
        connect: { available: true, endpoint: "GET /api/ctrader/connect" },
        disconnect: {
          available: true,
          endpoint: "POST /api/ctrader/disconnect",
        },
        selectAccount: {
          available: true,
          endpoint: "POST /api/ctrader/accounts/select",
        },
        startService: {
          available: true,
          endpoint: "POST /api/ctrader/start-service",
        },
        reconnect: { automatic: false },
      },
      errors: [],
    };
  }

  async function listAccounts() {
    return buildAccountsBlock(readService(), readAuthorization());
  }

  return { id: "ctrader", displayName: "cTrader", probe, listAccounts };
}
