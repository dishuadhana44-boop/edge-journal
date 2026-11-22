// ============================================================
// BROKER TRANSPORT CONTRACTS (Phase 3)
// ============================================================
//
// Every broker HTTP call the UI makes, in one place: the path, the method and
// the body are the ones server/routes/brokers.js, server/routes/mt5.js and
// server/routes/ctrader.js already answer, so a page cannot invent a route or
// send a partial body.
//
// A failure is reported as the operation plus the numeric HTTP status. The rest
// of the upstream body is never read into the error, because the Express routes
// put their own diagnostics there and those strings reach the browser through
// the logs a user posts. The one thing that may travel is a value picked from a
// fixed list - see DIAGNOSTIC_CODES - and it travels as a property, never as
// text in the message.

// The base URL is decided here and nowhere else.
//
// Reading `import.meta.env?.VITE_API_URL` and defaulting straight to loopback
// was the bug this replaced: a deployed build with no VITE_API_URL sent the
// browser to the development server's address. Loopback is now chosen only when
// Vite says the build is a development build, so an unconfigured production
// bundle resolves to no URL at all and every call below says so instead of
// reaching for a machine the user is not sitting at.
//
// The optional chains inside resolveApiBaseUrl are load-bearing: this module is
// also loaded by a plain `node --test` file, where import.meta.env does not
// exist and a CommonJS bundle, where esbuild empties it.
export const DEV_API_BASE_URL = "http://localhost:4000";

export const BACKEND_URL_NOT_CONFIGURED_MESSAGE =
  "The broker backend URL is not configured in this build, so EdgeFinder cannot reach the trading service. Set VITE_API_URL when building for a deployed site.";

export function resolveApiBaseUrl(env) {
  const configured =
    typeof env?.VITE_API_URL === "string" ? env.VITE_API_URL.trim() : "";

  if (configured) {
    return configured;
  }

  return env?.DEV === true ? DEV_API_BASE_URL : "";
}

const API_URL = resolveApiBaseUrl(import.meta.env);

// The refusals POST /api/ctrader/accounts/select answers with, from
// server/services/ctraderAccountSelection.js and that route. A caller cannot
// branch on prose it is not allowed to read, so this list is the only thing an
// upstream failure body may contribute to the error: one string, chosen from
// here, and never any other key or value from that body.
const DIAGNOSTIC_CODES = [
  "explicit_selection_required",
  "requested_account_not_available",
  "no_accounts_available",
  "ambiguous_account_ids",
  "session_not_started",
  "session_identity_unverifiable",
  "session_identity_mismatch",
];

function diagnosticCode(data) {
  return typeof data?.code === "string" && DIAGNOSTIC_CODES.includes(data.code)
    ? data.code
    : null;
}

async function request(path, { operation, ...options }) {
  if (!API_URL) {
    throw new Error(BACKEND_URL_NOT_CONFIGURED_MESSAGE);
  }

  const response = await fetch(`${API_URL}${path}`, options);

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(`${operation} returned an unreadable response.`);
  }

  if (!response.ok || data?.success === false) {
    const failure = new Error(
      `${operation} failed${response.ok ? "." : ` with HTTP ${response.status}.`}`
    );

    const code = diagnosticCode(data);

    if (code !== null) {
      failure.code = code;
    }

    throw failure;
  }

  return data;
}

const jsonPost = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getBrokerStatus = () =>
  request("/api/brokers/status", {
    operation: "Broker status",
    method: "GET",
    cache: "no-store",
  });

export const getMt5Positions = (accountId) =>
  request(
    `/api/mt5/positions?accountId=${encodeURIComponent(String(accountId))}`,
    {
      operation: "MT5 positions",
      method: "GET",
      cache: "no-store",
    }
  );

export const getMt5Orders = () =>
  request("/api/mt5/orders", {
    operation: "MT5 pending orders",
    method: "GET",
    cache: "no-store",
  });

export const disconnectMt5 = () =>
  request("/api/mt5/disconnect", {
    operation: "MT5 disconnect",
    ...jsonPost(),
  });

export const getCtraderStatus = () =>
  request("/api/ctrader/status", {
    operation: "cTrader status",
    method: "GET",
    cache: "no-store",
  });

export const selectCtraderAccount = (accountId) =>
  request("/api/ctrader/accounts/select", {
    operation: "cTrader account selection",
    ...jsonPost({ accountId: String(accountId) }),
  });

export const addCtraderAccount = ({ accountId, accountName }) =>
  request("/api/ctrader/account", {
    operation: "cTrader account setup",
    ...jsonPost({
      accountId: String(accountId),
      ...(accountName?.trim() ? { accountName: accountName.trim() } : {}),
    }),
  });

export const startCtraderService = () =>
  request("/api/ctrader/start-service", {
    operation: "cTrader service start",
    ...jsonPost(),
  });

export const disconnectCtrader = () =>
  request("/api/ctrader/disconnect", {
    operation: "cTrader disconnect",
    ...jsonPost(),
  });

// null, not a string, when the build has no backend: the caller is about to put
// this into window.location.href, and any value returned here is followed by
// the browser.
export const ctraderConnectUrl = () =>
  API_URL ? `${API_URL}/api/ctrader/connect` : null;
