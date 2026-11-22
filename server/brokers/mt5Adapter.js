import { makeBrokerIdentity } from "./identity.js";

const DEFAULT_TIMEOUT_MS = 5000;

const ACCOUNT_FIELD_ALIASES = {
  login: ["login"],
  server: ["server"],
  name: ["name", "company", "broker"],
  currency: ["currency", "currency_margin", "currencyMargin"],
  balance: ["balance"],
  equity: ["equity"],
  margin: ["margin", "margin_used", "marginUsed"],
  freeMargin: ["free_margin", "margin_free", "freeMargin", "marginFree"],
  leverage: ["leverage"],
  floatingPnL: ["profit", "unrealized_pnl", "unrealizedPnL", "floatingPnL"],
};

function pick(source, keys) {
  if (!source || typeof source !== "object") return null;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }

  return null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  return text === "" ? null : text;
}

function normalizeAccount(source) {
  const account = {};

  for (const [field, keys] of Object.entries(ACCOUNT_FIELD_ALIASES)) {
    const raw = pick(source, keys);

    account[field] =
      field === "balance" ||
      field === "equity" ||
      field === "margin" ||
      field === "freeMargin" ||
      field === "leverage" ||
      field === "floatingPnL"
        ? toFiniteNumber(raw)
        : toText(raw);
  }

  return account;
}

/**
 * @typedef {object} BrokerSnapshot
 *
 * Contract every broker adapter satisfies. `probe()` and `listAccounts()`
 * must never throw and must never report a value they did not observe.
 */

export function createMt5Adapter({
  bridgeUrl = process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001",
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  async function requestJson(pathname) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${bridgeUrl}${pathname}`, {
        method: "GET",
        signal: controller.signal,
      });

      const text = await response.text();

      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          body,
          message:
            toText(body?.message) ||
            toText(body?.error) ||
            `MT5 bridge responded with HTTP ${response.status}.`,
        };
      }

      if (body === null) {
        return {
          ok: false,
          status: response.status,
          body: null,
          message: "MT5 bridge responded with a non-JSON body.",
        };
      }

      return { ok: true, status: response.status, body, message: null };
    } catch (error) {
      const aborted = controller.signal.aborted === true;

      return {
        ok: false,
        status: null,
        body: null,
        message: aborted
          ? `MT5 bridge did not answer within ${timeoutMs}ms.`
          : toText(error?.message) || "MT5 bridge request failed.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function probe() {
    const observedAt = new Date().toISOString();

    const [healthResult, statusResult] = await Promise.all([
      requestJson("/health"),
      requestJson("/mt5/status"),
    ]);

    const serviceReachable = healthResult.ok || statusResult.ok;

    const statusBody = statusResult.body;
    const connected =
      statusResult.ok === true && statusBody?.connected === true;

    const rawAccount =
      statusBody?.account ?? (connected ? null : undefined);

    const account = normalizeAccount(rawAccount);

    const limitations = [
      "MT5 execution runs inside the local MetaTrader terminal through the Python bridge. There is no browser-compatible MT5 execution provider in this application, and none is implemented here.",
      "The MT5 session is global: the bridge owns one terminal connection at a time. GET /api/mt5/account reads req.query.accountId and logs it but never forwards it, so account data always describes whichever terminal the bridge is currently logged into.",
      "The bridge exposes no endpoint that enumerates MT5 logins, so this adapter cannot list accounts. The bridge's POST /mt5/connect takes a user-supplied login and server instead.",
      "Every field in `account` is read directly from the bridge. Nulls mean the bridge omitted the field, not that the value is zero.",
    ];

    const connection = {
      state: serviceReachable
        ? connected
          ? "connected"
          : "disconnected"
        : "unreachable",
      connected,
      serviceReachable,
      observedAt,
      sourceTimestamp: toText(statusBody?.timestamp),
      reason: statusResult.ok
        ? null
        : statusResult.message,
    };

    if (!serviceReachable) {
      limitations.unshift(
        "The MT5 bridge was not reachable when this status was requested. `connected: false` here means 'unknown/unreachable', not 'the terminal logged out'."
      );
    }

    return {
      id: "mt5",
      displayName: "MetaTrader 5",
      connection,
      session: {
        scope: "global_terminal_session",
        accountScoped: false,
        identity: {
          login: account.login,
          server: account.server,
        },
        magic: toFiniteNumber(statusBody?.magic),
        limitations,
      },
      account: connected ? account : null,
      identity: makeBrokerIdentity({
        broker: "mt5",
        externalId: connected ? account.login : null,
        server: connected ? account.server : null,
        source: connected
          ? "bridge GET /mt5/status account.login"
          : null,
        note: connected
          ? null
          : "The MT5 terminal is not logged in, so no MT5 account is identified.",
      }),
      accounts: await listAccounts(),
      execution: {
        provider: "mt5-local-bridge",
        transport: "http",
        requiresLocalService: true,
        browserCompatible: false,
      },
      capabilities: {
        status: true,
        accountInfo: true,
        positions: true,
        orderListing: true,
        candles: true,
        livePrice: true,
        tradeHistory: true,
        marketOrders: true,
        pendingOrderSubmission: true,
        closePosition: true,
        modifyPosition: true,
        accountEnumeration: false,
      },
      lifecycle: {
        connect: { available: true, endpoint: "POST /api/mt5/connect" },
        disconnect: {
          available: true,
          endpoint: "POST /api/mt5/disconnect",
        },
        reconnect: {
          automatic: false,
          note: "Reconnection is performed by the Python bridge, not by this adapter.",
        },
      },
      errors: buildErrors(healthResult, statusResult),
    };
  }

  async function listAccounts() {
    return {
      broker: "mt5",
      enumerable: false,
      source: "none",
      isLive: false,
      items: [],
      activeAccountId: null,
      reason:
        "The MT5 bridge exposes no account enumeration endpoint. MT5 logins are supplied by the user to POST /api/mt5/connect and are not discoverable from the bridge.",
    };
  }

  function buildErrors(healthResult, statusResult) {
    const errors = [];

    if (!healthResult.ok) {
      errors.push({
        code: "mt5_health_failed",
        message: healthResult.message,
        status: healthResult.status,
      });
    }

    if (!statusResult.ok) {
      errors.push({
        code: "mt5_status_failed",
        message: statusResult.message,
        status: statusResult.status,
      });
    }

    return errors;
  }

  return { id: "mt5", displayName: "MetaTrader 5", probe, listAccounts };
}
