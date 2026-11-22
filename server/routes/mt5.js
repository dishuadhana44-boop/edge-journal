import express from "express";
import axios from "axios";

const router = express.Router();

const MT5_BRIDGE_URL =
  process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001";

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5174";

// ==========================================================
// CONNECT
// GET /api/mt5/connect
// ==========================================================

router.get("/connect", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/status`,
      { timeout: 5000 }
    );

    const connected = Boolean(response.data?.connected);

    return res.redirect(
      `${FRONTEND_URL}/settings?mt5=${
        connected ? "connected" : "disconnected"
      }`
    );
  } catch (error) {
    console.error(
      "âŒ MT5 connect check failed:",
      error.response?.data || error.message
    );

    return res.redirect(
      `${FRONTEND_URL}/settings?mt5=error`
    );
  }
});

// ==========================================================
// CONNECT SPECIFIC MT5 ACCOUNT
// POST /api/mt5/connect
// ==========================================================

router.post("/connect", async (req, res) => {
  try {
    const {
      accountId,
      login,
      password,
      server,
    } = req.body;

    console.log(
      "🔵 MT5 ACCOUNT CONNECT REQUEST:",
      {
        accountId,
        login,
        server,
        hasPassword: Boolean(password),
      }
    );

    // ------------------------------------------------------
    // VALIDATION
    // ------------------------------------------------------

    if (
      accountId === undefined ||
      accountId === null ||
      String(accountId).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        connected: false,
        message: "EdgeFlo account ID is required.",
      });
    }

    const normalizedLogin = Number(login);

    if (
      !Number.isInteger(normalizedLogin) ||
      normalizedLogin <= 0
    ) {
      return res.status(400).json({
        success: false,
        connected: false,
        message: "Valid MT5 login is required.",
      });
    }

    if (
      !server ||
      String(server).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        connected: false,
        message: "MT5 server is required.",
      });
    }

    // ------------------------------------------------------
    // SEND ACCOUNT SWITCH REQUEST TO MT5 BRIDGE
    // ------------------------------------------------------

    const response = await axios.post(
      `${MT5_BRIDGE_URL}/mt5/connect`,
      {
        accountId: String(accountId),

        login: normalizedLogin,

        server: String(server).trim(),

        ...(password
          ? {
              password,
            }
          : {}),
      },
      {
        timeout: 15000,
      }
    );

    console.log(
      "🟢 MT5 BRIDGE CONNECT RESPONSE:",
      response.data
    );

    return res
      .status(response.status)
      .json(response.data);
  } catch (error) {
    console.error(
      "❌ MT5 account connect error:",
      error.response?.data ||
        error.message
    );

    return res.status(
      error.response?.status || 503
    ).json(
      error.response?.data || {
        success: false,
        connected: false,
        message:
          "Unable to connect to the MT5 account.",
        error: error.message,
      }
    );
  }
});

// ==========================================================
// STATUS
// GET /api/mt5/status
// ==========================================================

router.get("/status", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/status`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 status error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      connected: false,
      message: "Unable to connect to MT5 bridge.",
      error: error.message,
    });
  }
});

// ==========================================================
// ACCOUNT
// GET /api/mt5/account
// ==========================================================

router.get("/account", async (req, res) => {
  try {
    const accountId =
  req.query.accountId
    ? String(req.query.accountId)
    : null;

console.log(
  "🟣 MT5 ACCOUNT REQUEST:",
  {
    accountId,
  }
);

    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/account`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 account error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      message: "Unable to fetch MT5 account.",
      error: error.message,
    });
  }
});

// ==========================================================
// LIVE PRICE
// GET /api/mt5/price?symbol=EURUSD
// ==========================================================

router.get("/price", async (req, res) => {
  try {
    const symbol = String(
      req.query.symbol || "EURUSD"
    )
      .trim()
      .toUpperCase();

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required.",
      });
    }

    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/price`,
      {
        params: { symbol },
        timeout: 5000,
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 price error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      connected: false,
      symbol: req.query.symbol || "EURUSD",
      message: "Unable to fetch MT5 market price.",
      error: error.message,
    });
  }
});

// ==========================================================
// MT5 CANDLES
// GET /api/mt5/candles?symbol=EURUSD&timeframe=H1&count=100
// ==========================================================

router.get(
  "/candles",
  async (req, res) => {
    try {
      const symbol = String(
        req.query.symbol || "EURUSD"
      )
        .toUpperCase()
        .trim();

      const timeframe = String(
        req.query.timeframe || "H1"
      )
        .toUpperCase()
        .trim();

      const count = Math.min(
        Math.max(
          parseInt(
            req.query.count || "100",
            10
          ) || 100,
          10
        ),
        1000
      );

      const response = await axios.get(
        `${MT5_BRIDGE_URL}/mt5/candles`,
        {
          params: {
            symbol,
            timeframe,
            count,
          },
          timeout: 10000,
        }
      );

      return res.status(
        response.status
      ).json(
        response.data
      );

    } catch (error) {
      console.error(
        "❌ MT5 CANDLES ROUTE ERROR:",
        error?.response?.data ||
          error.message
      );

      return res.status(
        error?.response?.status || 500
      ).json({
        success: false,
        message:
          error?.response?.data?.message ||
          "Failed to fetch MT5 candles.",
        error:
          error?.response?.data?.error ||
          error.message,
      });
    }
  }
);

// ==========================================================
// OPEN POSITIONS
// GET /api/mt5/positions
// ==========================================================

router.get("/positions", async (req, res) => {
  try {
    const accountId = req.query.accountId
      ? String(req.query.accountId)
      : null;

    console.log(
      "🟣 MT5 POSITIONS REQUEST:",
      { accountId }
    );

    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/positions`,
      {
        params: accountId
          ? { accountId }
          : {},
        timeout: 5000,
      }
    );

    return res
      .status(response.status)
      .json(response.data);
  } catch (error) {
    console.error(
      "❌ MT5 positions error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      positions: [],
      message:
        "Unable to fetch MT5 positions.",
      error: error.message,
    });
  }
});

// ==========================================================
// HISTORY
// GET /api/mt5/history
//
// Forwards one verified page of broker trade history for an explicitly
// identified MT5 account. The contract is the Phase 1 reconciliation contract
// in mt5-bridge/app.py (parse_history_query, run_history_scan); nothing here
// relaxes it.
//
// Deliberate properties:
//   * The EdgeFlo accountId is NEVER treated as an MT5 login. The caller must
//     send mt5_login and mt5_server; a request without them is refused before
//     the bridge is reached.
//   * A failure is always a failure: history and positions are null, never an
//     empty array, so no caller can mistake a refused page for "no trades".
//   * Upstream text is never forwarded. Only an upstream HTTP status, and an
//     upstream code that matches the contract code shape, are adopted; the
//     message always comes from FAILURE_MESSAGE_BY_CODE below.
//   * Continuation is carried, NOT enforced. The bridge validates a
//     bridge_boot_id / connection_generation token only inside the request that
//     carries it (app.py:6431-6439) and keeps answering pages while the token
//     matches the current boot and generation, so a skipped middle page cannot
//     be detected here. source_scan_complete therefore stays false for every
//     page and this route never claims a multi-page scan is complete.
//   * Two checks are stricter than the bridge and refuse more than it would:
//     identifiers and generations longer than MAX_DECIMAL_DIGITS digits, and a
//     connection_generation echo that does not match the sent string exactly.
// ==========================================================

const HISTORY_REQUEST_TIMEOUT_MS = 10000;

const DIGITS_ONLY = /^[0-9]+$/;
const BRIDGE_BOOT_ID_PATTERN = /^[0-9a-f]{32}$/;
const CONTRACT_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const HISTORY_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3,6}))?$/;
const MAX_DECIMAL_DIGITS = 15;
const MAX_SAFE_INTEGER_VALUE = 9007199254740991;

const TRADE_DEAL_TYPES = new Set([0, 1]);
const FINANCIAL_DEAL_TYPES = new Set([2, 3, 4, 5]);

// validate_history_deal reads entry with history_small_int(maximum=3).
const HISTORY_DEAL_ENTRY_MAXIMUM = 3;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const HISTORY_FAILURE_FALLBACK = {
  status: 502,
  code: "MT5_HISTORY_UNAVAILABLE",
};

const GENERIC_FAILURE_MESSAGE = "MT5 history is unavailable.";

const FAILURE_MESSAGE_BY_CODE = {
  INVALID_HISTORY_QUERY:
    "The requested MT5 history range or account identity is not valid.",
  MT5_IDENTITY_MISMATCH:
    "The connected MT5 account is not the account this history request was made for.",
  MT5_CONNECTION_CHANGED:
    "The MT5 connection changed while this history page was being read.",
  MT5_NOT_CONNECTED:
    "MT5 is not connected, so trade history cannot be read.",
  MT5_IDENTITY_UNAVAILABLE:
    "MT5 has no confirmed connected identity, so trade history cannot be read.",
  MT5_HISTORY_READ_FAILED:
    "MT5 could not read the requested trade history.",
  MT5_POSITIONS_READ_FAILED:
    "MT5 could not read the open positions that accompany the history page.",
  MALFORMED_HISTORY:
    "MT5 returned a history page that could not be verified.",
  MALFORMED_POSITIONS:
    "MT5 returned open positions that could not be verified.",
  MT5_HISTORY_TIMEOUT:
    "MT5 did not answer the history request in time.",
  MT5_HISTORY_UNAVAILABLE: "MT5 did not return a history page.",
  UNPROVEN_BRIDGE_SUCCESS: "MT5 history could not be verified.",
};

const PROPERTY_THREW = Symbol("property threw");

export class HistoryRequestError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail || ""}`);
    this.name = "HistoryRequestError";
    this.code = code;
    this.status = 400;
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeProperty(object, key) {
  try {
    if (object === null || object === undefined) {
      return undefined;
    }

    return object[key];
  } catch {
    return PROPERTY_THREW;
  }
}

function isHttpStatus(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
  );
}

function isBridgeRefusalStatus(value) {
  return isHttpStatus(value) && value !== 200;
}

function historyFailureStatus(value) {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 400 &&
    value <= 599
  ) {
    return value;
  }

  return HISTORY_FAILURE_FALLBACK.status;
}

function adoptUpstreamCode(value) {
  if (typeof value === "string" && CONTRACT_CODE_PATTERN.test(value)) {
    return value;
  }

  return null;
}

export function historyRefusal(code) {
  const safeCode = adoptUpstreamCode(code) ?? HISTORY_FAILURE_FALLBACK.code;

  return {
    success: false,
    page_query_complete: false,
    source_scan_complete: false,
    history: null,
    positions: null,
    code: safeCode,
    message: FAILURE_MESSAGE_BY_CODE[safeCode] ?? GENERIC_FAILURE_MESSAGE,
  };
}

function localRefusal(code, status) {
  return {
    ok: false,
    status: historyFailureStatus(status),
    body: historyRefusal(code),
  };
}

function bridgeRefusal(rawStatus, rawCode, defaultCode) {
  const result = {
    status: historyFailureStatus(rawStatus),
    body: historyRefusal(
      adoptUpstreamCode(rawCode) ?? defaultCode ?? HISTORY_FAILURE_FALLBACK.code
    ),
  };

  if (isBridgeRefusalStatus(rawStatus)) {
    result.body.bridge_status = rawStatus;
  }

  return result;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function canonicalHistoryUtc(value) {
  if (typeof value !== "string") {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamps must be UTC ISO-8601 strings ending in Z"
    );
  }

  const text = value.trim();

  if (!text.endsWith("Z")) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp is not a UTC timestamp ending in Z"
    );
  }

  const parts = HISTORY_TIMESTAMP_PATTERN.exec(text.slice(0, -1));

  if (parts === null) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp is not an ISO-8601 timestamp"
    );
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[5 + 1]);
  const fraction = parts[7];

  if (year < 1) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp year cannot be represented by the bridge"
    );
  }

  if (month < 1 || month > 12) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp month is out of range"
    );
  }

  const lastDay =
    month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];

  if (day < 1 || day > lastDay) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp day is out of range"
    );
  }

  if (hour > 23 || minute > 59 || second > 59) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp time of day is out of range"
    );
  }

  let milliseconds = null;

  if (fraction !== undefined) {
    if (fraction.length < 3) {
      throw new HistoryRequestError(
        "INVALID_HISTORY_QUERY",
        "timestamp fraction is not milliseconds"
      );
    }

    if (fraction.length > 3 && /[^0]/.test(fraction.slice(3))) {
      throw new HistoryRequestError(
        "INVALID_HISTORY_QUERY",
        "timestamp is more precise than one millisecond"
      );
    }

    milliseconds = fraction.slice(0, 3);
  }

  const epochMs = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    milliseconds === null ? 0 : Number(milliseconds)
  );

  if (!Number.isFinite(epochMs)) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "timestamp cannot be placed on the UTC timeline"
    );
  }

  return (
    `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6]}` +
    `${milliseconds === null ? "" : `.${milliseconds}`}Z`
  );
}

function canonicalHistoryUtcSafe(value) {
  try {
    return canonicalHistoryUtc(value);
  } catch {
    return null;
  }
}

function canonicalDecimalDigits(value, { allowZero, trim }) {
  if (typeof value !== "string") {
    return null;
  }

  const text = trim ? value.trim() : value;

  if (text === "" || !DIGITS_ONLY.test(text)) {
    return null;
  }

  const stripped = text.replace(/^0+/, "");

  if (stripped === "") {
    return allowZero ? "0" : null;
  }

  if (stripped.length > MAX_DECIMAL_DIGITS) {
    return null;
  }

  return stripped;
}

function singleQueryValue(query, key) {
  const value = safeProperty(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      `${key} must be sent once`
    );
  }

  return value;
}

export function buildHistoryBridgeParams(query) {
  if (!isPlainObject(query)) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "a query object is required"
    );
  }

  const rawLogin = singleQueryValue(query, "mt5_login");

  if (typeof rawLogin !== "string") {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "mt5_login is required"
    );
  }

  const login = canonicalDecimalDigits(rawLogin, {
    allowZero: false,
    trim: true,
  });

  if (login === null) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "mt5_login must be a positive MT5 login number"
    );
  }

  const rawServer = singleQueryValue(query, "mt5_server");

  if (typeof rawServer !== "string") {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "mt5_server is required"
    );
  }

  const server = rawServer.trim().toLowerCase();

  if (server === "") {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "mt5_server is required"
    );
  }

  for (const character of server) {
    if (character.codePointAt(0) < 32) {
      throw new HistoryRequestError(
        "INVALID_HISTORY_QUERY",
        "mt5_server is not a valid server name"
      );
    }
  }

  const fromUtc = canonicalHistoryUtc(singleQueryValue(query, "from_utc"));
  const toUtc = canonicalHistoryUtc(singleQueryValue(query, "to_utc"));

  if (Date.parse(toUtc) <= Date.parse(fromUtc)) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "to_utc must be after from_utc"
    );
  }

  const params = {
    expected_mt5_login: login,
    expected_mt5_server: server,
    from_utc: fromUtc,
    to_utc: toUtc,
  };

  const rawScanFrom = singleQueryValue(query, "scan_from_utc");
  const rawScanTo = singleQueryValue(query, "scan_to_utc");

  if (rawScanFrom !== undefined) {
    params.scan_from_utc = canonicalHistoryUtc(rawScanFrom);
  }

  if (rawScanTo !== undefined) {
    params.scan_to_utc = canonicalHistoryUtc(rawScanTo);
  }

  if (
    params.scan_from_utc !== undefined &&
    params.scan_to_utc !== undefined &&
    Date.parse(params.scan_to_utc) < Date.parse(params.scan_from_utc)
  ) {
    throw new HistoryRequestError(
      "INVALID_HISTORY_QUERY",
      "scan_to_utc must not be before scan_from_utc"
    );
  }

  const rawBootId = singleQueryValue(query, "bridge_boot_id");
  const rawGeneration = singleQueryValue(query, "connection_generation");

  if (rawBootId !== undefined || rawGeneration !== undefined) {
    if (rawBootId === undefined || rawGeneration === undefined) {
      throw new HistoryRequestError(
        "INVALID_HISTORY_QUERY",
        "bridge_boot_id and connection_generation must be sent together"
      );
    }

    if (
      typeof rawBootId !== "string" ||
      !BRIDGE_BOOT_ID_PATTERN.test(rawBootId)
    ) {
      throw new HistoryRequestError(
        "INVALID_HISTORY_QUERY",
        "bridge_boot_id is not a bridge boot identifier"
      );
    }

    if (canonicalDecimalDigits(rawGeneration, { allowZero: true }) === null) {
      throw new HistoryRequestError(
        "INVALID_HISTORY_QUERY",
        "connection_generation must be a non-negative integer"
      );
    }

    params.bridge_boot_id = rawBootId;
    params.connection_generation = rawGeneration;
  }

  return params;
}

function classificationOf(history) {
  const counts = {
    trade_deal_count: 0,
    financial_deal_count: 0,
    unknown_type_count: 0,
  };

  for (const row of history) {
    if (
      !isPlainObject(row) ||
      !Object.hasOwn(row, "type") ||
      !Object.hasOwn(row, "entry")
    ) {
      return null;
    }

    const dealType = row.type;

    if (typeof dealType !== "number" || !Number.isInteger(dealType)) {
      return null;
    }

    const entry = row.entry;

    if (
      typeof entry !== "number" ||
      !Number.isInteger(entry) ||
      entry < 0 ||
      entry > HISTORY_DEAL_ENTRY_MAXIMUM
    ) {
      return null;
    }

    if (TRADE_DEAL_TYPES.has(dealType)) {
      counts.trade_deal_count += 1;
    } else if (FINANCIAL_DEAL_TYPES.has(dealType)) {
      counts.financial_deal_count += 1;
    } else {
      return null;
    }
  }

  return counts;
}

function isCount(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function verifyHistoryPage(body, params) {
  if (!isPlainObject(body)) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  if (
    body.success !== true ||
    body.page_query_complete !== true ||
    body.source_scan_complete !== false
  ) {
    return localRefusal("UNPROVEN_BRIDGE_SUCCESS", 502);
  }

  if (!Array.isArray(body.history) || !Array.isArray(body.positions)) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  const coverage = body.coverage;

  if (
    !isCount(body.count) ||
    body.count !== body.history.length ||
    !isPlainObject(coverage) ||
    !isCount(coverage.serialized_deal_count) ||
    !isCount(coverage.returned_deal_count) ||
    coverage.serialized_deal_count !== body.history.length ||
    coverage.returned_deal_count < coverage.serialized_deal_count
  ) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  const identity = body.identity;

  if (
    !isPlainObject(identity) ||
    typeof identity.mt5Login !== "string" ||
    typeof identity.mt5Server !== "string" ||
    identity.mt5Login !== params.expected_mt5_login ||
    identity.mt5Server !== params.expected_mt5_server
  ) {
    return localRefusal("MT5_IDENTITY_MISMATCH", 409);
  }

  const utcRange = body.utc_range;
  const scanRange = body.scan_range;

  const rangesMatch =
    isPlainObject(utcRange) &&
    isPlainObject(scanRange) &&
    canonicalHistoryUtcSafe(utcRange.from_utc) === params.from_utc &&
    canonicalHistoryUtcSafe(utcRange.to_utc) === params.to_utc &&
    canonicalHistoryUtcSafe(scanRange.from_utc) ===
      (params.scan_from_utc ?? params.from_utc) &&
    canonicalHistoryUtcSafe(scanRange.to_utc) ===
      (params.scan_to_utc ?? params.to_utc);

  if (!rangesMatch) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  const bootId = body.bridge_boot_id;

  if (
    typeof bootId !== "string" ||
    !BRIDGE_BOOT_ID_PATTERN.test(bootId) ||
    (params.bridge_boot_id !== undefined && bootId !== params.bridge_boot_id)
  ) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  const generation = body.connection_generation;

  if (
    typeof generation !== "number" ||
    !Number.isInteger(generation) ||
    generation < 0 ||
    generation > MAX_SAFE_INTEGER_VALUE ||
    (params.connection_generation !== undefined &&
      String(generation) !== params.connection_generation)
  ) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  const classification = classificationOf(body.history);

  if (classification === null) {
    return localRefusal("MALFORMED_HISTORY", 502);
  }

  return {
    ok: true,
    verdict: {
      body,
      classification,
    },
  };
}

export function classifyHistoryPage(body, params) {
  try {
    return verifyHistoryPage(body, params);
  } catch {
    return localRefusal("MALFORMED_HISTORY", 502);
  }
}

function historySuccessBody(verdict, params) {
  const body = verdict.body;

  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity: {
      mt5Login: body.identity.mt5Login,
      mt5Server: body.identity.mt5Server,
    },
    requested_range: {
      from_utc: params.from_utc,
      to_utc: params.to_utc,
    },
    utc_range: {
      from_utc: body.utc_range.from_utc,
      to_utc: body.utc_range.to_utc,
    },
    scan_range: {
      from_utc: body.scan_range.from_utc,
      to_utc: body.scan_range.to_utc,
    },
    coverage: {
      boundaries: body.coverage.boundaries,
      returned_deal_count: body.coverage.returned_deal_count,
      serialized_deal_count: body.coverage.serialized_deal_count,
    },
    bridge_boot_id: body.bridge_boot_id,
    connection_generation: body.connection_generation,
    retention_verified: false,
    count: body.count,
    history: body.history,
    positions: body.positions,
    classification: verdict.classification,
  };
}

function axiosHistoryTransport({ url, params, timeout }) {
  return axios.get(url, {
    params,
    timeout,
    validateStatus: () => true,
  });
}

function isTimeoutError(error) {
  const code = safeProperty(error, "code");

  return code === "ECONNABORTED" || code === "ETIMEDOUT";
}

function responseRefusal(response, params) {
  const rawStatus = safeProperty(response, "status");
  const rawData = safeProperty(response, "data");
  const data = rawData === PROPERTY_THREW ? null : rawData;

  if (!isPlainObject(response) || !isHttpStatus(rawStatus)) {
    return bridgeRefusal(
      rawStatus === PROPERTY_THREW ? undefined : rawStatus,
      safeProperty(data, "code"),
      "UNPROVEN_BRIDGE_SUCCESS"
    );
  }

  if (rawStatus !== 200) {
    return bridgeRefusal(
      rawStatus,
      safeProperty(data, "code"),
      HISTORY_FAILURE_FALLBACK.code
    );
  }

  const result = classifyHistoryPage(data, params);

  if (result.ok !== true) {
    return { status: result.status, body: result.body };
  }

  return {
    status: 200,
    body: historySuccessBody(result.verdict, params),
  };
}

async function mt5HistoryHandler({ query, transport = axiosHistoryTransport }) {
  let params;

  try {
    params = buildHistoryBridgeParams(query);
  } catch (error) {
    if (error instanceof HistoryRequestError) {
      return localRefusal(error.code, error.status);
    }

    return localRefusal("INVALID_HISTORY_QUERY", 400);
  }

  const url = `${MT5_BRIDGE_URL}/mt5/history`;

  let response;

  try {
    response = await transport({
      url,
      params,
      timeout: HISTORY_REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      return localRefusal("MT5_HISTORY_TIMEOUT", 504);
    }

    let upstreamStatus;
    let upstreamCode;

    try {
      upstreamStatus = error?.response?.status;
      upstreamCode = error?.response?.data?.code;
    } catch {
      upstreamStatus = undefined;
      upstreamCode = undefined;
    }

    if (upstreamStatus === PROPERTY_THREW) {
      upstreamStatus = undefined;
    }

    if (upstreamCode === PROPERTY_THREW) {
      upstreamCode = undefined;
    }

    return bridgeRefusal(
      upstreamStatus,
      upstreamCode,
      HISTORY_FAILURE_FALLBACK.code
    );
  }

  return responseRefusal(response, params);
}

function historyTransportFor(req) {
  const locals = safeProperty(safeProperty(req, "app"), "locals");
  const injected = safeProperty(locals, "mt5HistoryTransport");

  return typeof injected === "function" ? injected : axiosHistoryTransport;
}

const mt5HistoryRouteHandler = async (req, res) => {
  let result;

  try {
    result = await mt5HistoryHandler({
      query: req?.query,
      transport: historyTransportFor(req),
    });
  } catch (error) {
    console.error(
      "MT5 history route failure:",
      safeProperty(error, "code") ?? typeof error
    );

    result = localRefusal(HISTORY_FAILURE_FALLBACK.code, 502);
  }

  if (safeProperty(res, "headersSent") === true) {
    return;
  }

  try {
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("MT5 history response write failed:", typeof error);
  }
};

export {
  mt5HistoryHandler,
  mt5HistoryRouteHandler,
};

router.get("/history", mt5HistoryRouteHandler);

// ==========================================================
// PLACE MARKET ORDER
// POST /api/mt5/order
// ==========================================================

router.post("/order", async (req, res) => {
  try {
    console.log(
      "ðŸš€ MT5 ORDER REQUEST:",
      req.body
    );

    const {
      symbol,
      side,
      lots,
      stopLoss,
      takeProfit,
      comment,
      magic,
      deviation,
    } = req.body;

    // ------------------------------------------------------
    // VALIDATION
    // ------------------------------------------------------

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required.",
      });
    }

    if (!side) {
      return res.status(400).json({
        success: false,
        message: "Order side is required.",
      });
    }

    if (
      lots === undefined ||
      lots === null ||
      !Number.isFinite(Number(lots)) ||
      Number(lots) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid lot size is required.",
      });
    }

    const normalizedSymbol = String(symbol)
      .trim()
      .toUpperCase();

    const normalizedSide = String(side)
      .trim()
      .toUpperCase();

    const normalizedLots = Number(lots);

    let normalizedStopLoss = null;

    if (
      stopLoss !== undefined &&
      stopLoss !== null &&
      stopLoss !== ""
    ) {
      normalizedStopLoss = Number(stopLoss);

      if (
        !Number.isFinite(normalizedStopLoss) ||
        normalizedStopLoss <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Stop Loss price.",
        });
      }
    }

    let normalizedTakeProfit = null;

    if (
      takeProfit !== undefined &&
      takeProfit !== null &&
      takeProfit !== ""
    ) {
      normalizedTakeProfit = Number(takeProfit);

      if (
        !Number.isFinite(normalizedTakeProfit) ||
        normalizedTakeProfit <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Take Profit price.",
        });
      }
    }

    // ------------------------------------------------------
    // SEND TO MT5 BRIDGE
    // ------------------------------------------------------

    const response = await axios.post(
      `${MT5_BRIDGE_URL}/mt5/order`,
      {
        symbol: normalizedSymbol,
        side: normalizedSide,
        lots: normalizedLots,
        stopLoss: normalizedStopLoss,
        takeProfit: normalizedTakeProfit,
        comment:
          comment || "EdgeFlo MT5",
        magic:
          magic !== undefined
            ? Number(magic)
            : 2026001,
        deviation:
          deviation !== undefined
            ? Number(deviation)
            : 50,
      },
      {
        timeout: 15000,
      }
    );

    console.log(
      "ðŸ“© MT5 BRIDGE ORDER RESPONSE:",
      response.data
    );

    return res
      .status(response.status)
      .json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 order error:",
      error.response?.data ||
        error.message
    );

    return res.status(
      error.response?.status || 503
    ).json(
      error.response?.data || {
        success: false,
        message:
          "Unable to place MT5 order.",
        error: error.message,
      }
    );
  }
});

// ==========================================================
// PLACE PENDING ORDER
// POST /api/mt5/pending-order
// ==========================================================

router.post(
  "/pending-order",
  async (req, res) => {
    try {
      console.log(
        "ðŸ“Œ MT5 PENDING ORDER REQUEST:",
        req.body
      );

      const {
        symbol,
        side,
        type,
        orderType,
        lots,
        entry,
        stopLoss,
        takeProfit,
        comment,
        magic,
        expiration,
      } = req.body;

      // ----------------------------------------------------
      // VALIDATION
      // ----------------------------------------------------

      if (!symbol) {
        return res.status(400).json({
          success: false,
          message: "Symbol is required.",
        });
      }

      if (!side) {
        return res.status(400).json({
          success: false,
          message: "Pending order side is required.",
        });
      }

      const normalizedSide = String(side)
        .trim()
        .toUpperCase();

      if (
        normalizedSide !== "BUY" &&
        normalizedSide !== "SELL"
      ) {
        return res.status(400).json({
          success: false,
          message: "Side must be BUY or SELL.",
        });
      }

      const rawType = type || orderType;

      if (!rawType) {
        return res.status(400).json({
          success: false,
          message: "Pending order type is required.",
        });
      }

      if (
        lots === undefined ||
        lots === null ||
        !Number.isFinite(Number(lots)) ||
        Number(lots) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid lot size is required.",
        });
      }

      if (
        entry === undefined ||
        entry === null ||
        entry === "" ||
        !Number.isFinite(Number(entry)) ||
        Number(entry) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid entry price is required.",
        });
      }

      const normalizedSymbol = String(
        symbol
      )
        .trim()
        .toUpperCase();

      const normalizedType = String(rawType)
        .trim()
        .toUpperCase();

      const normalizedLots = Number(lots);
      const normalizedEntry = Number(entry);

      // ----------------------------------------------------
      // ALLOWED PENDING TYPES
      // ----------------------------------------------------

      const allowedTypes = [
        "BUY_LIMIT",
        "SELL_LIMIT",
        "BUY_STOP",
        "SELL_STOP",
        "BUY_STOP_LIMIT",
        "SELL_STOP_LIMIT",
      ];

      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            `Unsupported pending order type: ${normalizedType}`,
        });
      }

      // ----------------------------------------------------
      // STOP LOSS
      // ----------------------------------------------------

      let normalizedStopLoss = null;

      if (
        stopLoss !== undefined &&
        stopLoss !== null &&
        stopLoss !== ""
      ) {
        normalizedStopLoss = Number(
          stopLoss
        );

        if (
          !Number.isFinite(
            normalizedStopLoss
          ) ||
          normalizedStopLoss <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Stop Loss price.",
          });
        }
      }

      // ----------------------------------------------------
      // TAKE PROFIT
      // ----------------------------------------------------

      let normalizedTakeProfit = null;

      if (
        takeProfit !== undefined &&
        takeProfit !== null &&
        takeProfit !== ""
      ) {
        normalizedTakeProfit = Number(
          takeProfit
        );

        if (
          !Number.isFinite(
            normalizedTakeProfit
          ) ||
          normalizedTakeProfit <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Take Profit price.",
          });
        }
      }

      // ----------------------------------------------------
      // EXPIRATION
      // ----------------------------------------------------

      let normalizedExpiration = 0;

      if (
        expiration !== undefined &&
        expiration !== null &&
        expiration !== ""
      ) {
        normalizedExpiration =
          Number(expiration);

        if (
          !Number.isFinite(
            normalizedExpiration
          ) ||
          normalizedExpiration < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid expiration value.",
          });
        }
      }

      // ----------------------------------------------------
      // SEND TO MT5 PYTHON BRIDGE
      // ----------------------------------------------------

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/pending-order`,
        {
          symbol: normalizedSymbol,
          side: normalizedSide,
          orderType: normalizedType,
          type: normalizedType,
          lots: normalizedLots,
          entry: normalizedEntry,
          stopLoss: normalizedStopLoss,
          takeProfit: normalizedTakeProfit,
          comment:
            comment ||
            "EdgeFlo Pending Order",
          magic:
            magic !== undefined
              ? Number(magic)
              : 2026001,
          expiration:
            normalizedExpiration,
        },
        {
          timeout: 15000,
        }
      );

      console.log(
        "ðŸ“© MT5 BRIDGE PENDING ORDER RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 pending order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to place MT5 pending order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// GET PENDING ORDERS
// GET /api/mt5/orders
// ==========================================================

router.get("/orders", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/orders`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 pending orders error:",
      error.response?.data ||
        error.message
    );

    return res.status(503).json({
      success: false,
      orders: [],
      count: 0,
      message:
        "Unable to fetch MT5 pending orders.",
      error: error.message,
    });
  }
});

// ==========================================================
// GET SINGLE PENDING ORDER
// GET /api/mt5/order/:ticket
// ==========================================================

router.get(
  "/order/:ticket",
  async (req, res) => {
    try {
      const ticket = Number(
        req.params.ticket
      );

      if (
        !Number.isInteger(ticket) ||
        ticket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order ticket.",
        });
      }

      const response = await axios.get(
        `${MT5_BRIDGE_URL}/mt5/order/${ticket}`,
        { timeout: 5000 }
      );

      return res.json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 single order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to fetch MT5 order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// CLOSE POSITION
// POST /api/mt5/close-position
// ==========================================================

router.post(
  "/close-position",
  async (req, res) => {
    try {
      const {
        ticket,
        volume,
      } = req.body;

      if (
        ticket === undefined ||
        ticket === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Position ticket is required.",
        });
      }

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/close-position`,
        {
          ticket,
          volume,
        },
        {
          timeout: 15000,
        }
      );

      return res.json(
        response.data
      );
    } catch (error) {
      console.error(
        "âŒ MT5 close position error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to close MT5 position.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// MODIFY OPEN POSITION SL/TP
// POST /api/mt5/modify-position
// ==========================================================

router.post(
  "/modify-position",
  async (req, res) => {
    try {
      const {
        ticket,
        positionId,
        brokerPositionId,
        id,
        stopLoss,
        takeProfit,
        sl,
        tp,
      } = req.body;

      // ----------------------------------------------------
      // POSITION TICKET
      // ----------------------------------------------------

      const rawTicket =
        ticket ??
        positionId ??
        brokerPositionId ??
        id;

      if (
        rawTicket === undefined ||
        rawTicket === null ||
        rawTicket === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Position ticket is required.",
        });
      }

      const normalizedTicket =
        Number(rawTicket);

      if (
        !Number.isInteger(
          normalizedTicket
        ) ||
        normalizedTicket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid position ticket.",
        });
      }

      // ----------------------------------------------------
      // SL
      // ----------------------------------------------------

      let normalizedStopLoss;

      const rawStopLoss =
        stopLoss !== undefined
          ? stopLoss
          : sl;

      if (
        rawStopLoss === undefined ||
        rawStopLoss === null ||
        rawStopLoss === ""
      ) {
        normalizedStopLoss = undefined;
      } else {
        normalizedStopLoss =
          Number(rawStopLoss);

        if (
          !Number.isFinite(
            normalizedStopLoss
          ) ||
          normalizedStopLoss < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Stop Loss price.",
          });
        }
      }

      // ----------------------------------------------------
      // TP
      // ----------------------------------------------------

      let normalizedTakeProfit;

      const rawTakeProfit =
        takeProfit !== undefined
          ? takeProfit
          : tp;

      if (
        rawTakeProfit === undefined ||
        rawTakeProfit === null ||
        rawTakeProfit === ""
      ) {
        normalizedTakeProfit = undefined;
      } else {
        normalizedTakeProfit =
          Number(rawTakeProfit);

        if (
          !Number.isFinite(
            normalizedTakeProfit
          ) ||
          normalizedTakeProfit < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Take Profit price.",
          });
        }
      }

      // ----------------------------------------------------
      // REQUEST LOG
      // ----------------------------------------------------

      console.log(
        "✏️ MT5 MODIFY OPEN POSITION:",
        {
          ticket:
            normalizedTicket,
          stopLoss:
            normalizedStopLoss,
          takeProfit:
            normalizedTakeProfit,
        }
      );

      // ----------------------------------------------------
      // SEND TO MT5 BRIDGE
      // ----------------------------------------------------

      const payload = {
        ticket:
          normalizedTicket,
      };

      if (
        normalizedStopLoss !== undefined
      ) {
        payload.stopLoss =
          normalizedStopLoss;
      }

      if (
        normalizedTakeProfit !== undefined
      ) {
        payload.takeProfit =
          normalizedTakeProfit;
      }

      const response =
        await axios.post(
          `${MT5_BRIDGE_URL}/mt5/modify-position`,
          payload,
          {
            timeout: 15000,
          }
        );

      console.log(
        "📩 MT5 MODIFY POSITION RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);

    } catch (error) {
      console.error(
        "❌ MT5 modify open position error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to modify MT5 open position.",
          error:
            error.message,
        }
      );
    }
  }
);

// ==========================================================
// CANCEL PENDING ORDER
// POST /api/mt5/cancel-order
// ==========================================================

router.post(
  "/cancel-order",
  async (req, res) => {
    try {
      const { ticket } = req.body;

      if (
        ticket === undefined ||
        ticket === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pending order ticket is required.",
        });
      }

      const normalizedTicket =
        Number(ticket);

      if (
        !Number.isInteger(
          normalizedTicket
        ) ||
        normalizedTicket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pending order ticket.",
        });
      }

      console.log(
        "ðŸ—‘ï¸ MT5 CANCEL PENDING ORDER:",
        normalizedTicket
      );

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/cancel-order`,
        {
          ticket:
            normalizedTicket,
        },
        {
          timeout: 15000,
        }
      );

      console.log(
        "ðŸ“© MT5 CANCEL RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 cancel pending order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to cancel MT5 pending order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// MODIFY PENDING ORDER
// POST /api/mt5/modify-order
// ==========================================================

router.post(
  "/modify-order",
  async (req, res) => {
    try {
      const {
        ticket,
        price,
        stopLoss,
        takeProfit,
      } = req.body;

      // ----------------------------------------------------
      // TICKET
      // ----------------------------------------------------

      if (
        ticket === undefined ||
        ticket === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pending order ticket is required.",
        });
      }

      const normalizedTicket =
        Number(ticket);

      if (
        !Number.isInteger(
          normalizedTicket
        ) ||
        normalizedTicket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pending order ticket.",
        });
      }

      // ----------------------------------------------------
      // ENTRY PRICE
      // ----------------------------------------------------

      if (
        price === undefined ||
        price === null ||
        price === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pending order entry price is required.",
        });
      }

      const normalizedPrice =
        Number(price);

      if (
        !Number.isFinite(
          normalizedPrice
        ) ||
        normalizedPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pending order entry price.",
        });
      }

      // ----------------------------------------------------
      // STOP LOSS
      // ----------------------------------------------------

      let normalizedStopLoss = null;

      if (
        stopLoss !== undefined &&
        stopLoss !== null &&
        stopLoss !== ""
      ) {
        normalizedStopLoss =
          Number(stopLoss);

        if (
          !Number.isFinite(
            normalizedStopLoss
          ) ||
          normalizedStopLoss <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Stop Loss price.",
          });
        }
      }

      // ----------------------------------------------------
      // TAKE PROFIT
      // ----------------------------------------------------

      let normalizedTakeProfit = null;

      if (
        takeProfit !== undefined &&
        takeProfit !== null &&
        takeProfit !== ""
      ) {
        normalizedTakeProfit =
          Number(takeProfit);

        if (
          !Number.isFinite(
            normalizedTakeProfit
          ) ||
          normalizedTakeProfit <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Take Profit price.",
          });
        }
      }

      console.log(
        "âœï¸ MT5 MODIFY PENDING ORDER:",
        {
          ticket:
            normalizedTicket,
          price:
            normalizedPrice,
          stopLoss:
            normalizedStopLoss,
          takeProfit:
            normalizedTakeProfit,
        }
      );

      // ----------------------------------------------------
      // SEND TO MT5 BRIDGE
      // ----------------------------------------------------

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/modify-order`,
        {
          ticket:
            normalizedTicket,
          price:
            normalizedPrice,
          stopLoss:
            normalizedStopLoss,
          takeProfit:
            normalizedTakeProfit,
        },
        {
          timeout: 15000,
        }
      );

      console.log(
        "ðŸ“© MT5 MODIFY RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 modify pending order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to modify MT5 pending order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// DISCONNECT
// POST /api/mt5/disconnect
// ==========================================================

router.post(
  "/disconnect",
  async (req, res) => {
    try {
      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/disconnect`,
        {},
        {
          timeout: 5000,
        }
      );

      return res.json(
        response.data
      );
    } catch (error) {
      console.error(
        "âŒ MT5 disconnect error:",
        error.response?.data ||
          error.message
      );

      return res.status(503).json({
        success: false,
        message:
          "Unable to disconnect MT5 bridge.",
        error: error.message,
      });
    }
  }
);

// ==========================================================
// SYMBOL SPEC / VOLUME GRID
// GET /api/mt5/symbol-info?symbol=EURUSD
// ==========================================================

router.get(
  "/symbol-info",
  async (req, res) => {
    try {
      const symbol = req.query.symbol;

      if (
        typeof symbol !== "string" ||
        symbol.trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          error: "MISSING_SYMBOL",
          message:
            "A single symbol query parameter is required.",
        });
      }

      const response = await axios.get(
        `${MT5_BRIDGE_URL}/mt5/symbol-info`,
        {
          params: { symbol },
          timeout: 5000,
        }
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "MT5 symbol-info error:",
        error.response?.data || error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to fetch MT5 symbol info.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// BROKER RISK CALCULATION (read-only)
// GET /api/mt5/calc-profit
// ==========================================================

router.get(
  "/calc-profit",
  async (req, res) => {
    try {
      const params = {};

      for (const key of [
        "action",
        "symbol",
        "volume",
        "price_open",
        "price_close",
      ]) {
        if (typeof req.query[key] !== "string") {
          return res.status(400).json({
            success: false,
            error: "INVALID_QUERY",
            message:
              `${key} must be provided exactly once as a string.`,
          });
        }

        params[key] = req.query[key];
      }

      const response = await axios.get(
        `${MT5_BRIDGE_URL}/mt5/calc-profit`,
        {
          params,
          timeout: 10000,
        }
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "MT5 calc-profit error:",
        error.response?.data || error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to calculate MT5 profit.",
          error: error.message,
        }
      );
    }
  }
);


export default router;




