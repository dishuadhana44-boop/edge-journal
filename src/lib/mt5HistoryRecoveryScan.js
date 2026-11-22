import { reconstructClosedPositions } from "./mt5HistoryReconstruction.js";

// ============================================================
// Stage D — offline MT5 recovery scan
//
// The smallest orchestration step that can turn a reopen into
// evidence: ask the existing Express history route for the ranges the
// app was offline for, keep every refusal as rejected evidence, and
// hand the whole page set to the approved pure reconstruction module
// (src/lib/mt5HistoryReconstruction.js).
//
// This module deliberately does not journal, write storage, or
// compute P&L. It reports what the evidence proves and whether the
// scan is worth repeating.
//
// Input:
//   apiUrl    string           Express base URL (no trailing slash)
//   fetchImpl (url, init)      injected transport, same pattern as
//                              app.locals.mt5HistoryTransport server-side
//   identity  { mt5Login, mt5Server }  caller-sent account identity, the
//              only identity the route accepts
//   windows   [{ fromUtc, toUtc }]     UTC ranges to scan, fetched one
//              at a time in the order given
//
// Output (frozen):
//   { status: "invalid", code, retry: false, refusals: [], result: null,
//     identity: null, pages: [] }
//   { status: "scanned", retry, refusals, result, identity, pages } where
//   result is the module output verbatim: { closed, unresolved,
//   financialDeals, scan } and scan.coverageComplete stays false — this scan
//   proves nothing about full history coverage.
//
//   pages are the records this scan actually handed the reconstruction
//   module, in fetch order, accepted and rejected alike, and identity is the
//   canonical identity it asked the route for. Without them the conclusions
//   and the evidence that produced them are two independent objects, and a
//   caller could pair one scan's result with another's pages — or with none.
// ============================================================

export const RECOVERY_SCAN_CODES = Object.freeze({
  INVALID_API_URL: "INVALID_API_URL",
  INVALID_MT5_IDENTITY: "INVALID_MT5_IDENTITY",
  INVALID_RECOVERY_WINDOW: "INVALID_RECOVERY_WINDOW",
  FETCH_FAILED: "RECOVERY_FETCH_FAILED",
  UNPARSEABLE_RESPONSE: "RECOVERY_UNPARSEABLE_RESPONSE",
  UNSUCCESSFUL_RESPONSE: "RECOVERY_UNSUCCESSFUL_RESPONSE",
});

const HISTORY_PATH = "/api/mt5/history";

// Mirrors server/routes/mt5.js canonicalHistoryUtc: the route only
// accepts UTC instants ending in Z.
const UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

const MAX_LOGIN_DIGITS = 15;

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

function canonicalLogin(value) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  if (text === "" || !/^\d+$/.test(text)) return null;

  const stripped = text.replace(/^0+/, "");

  if (stripped === "" || stripped.length > MAX_LOGIN_DIGITS) return null;

  return stripped;
}

function canonicalInstant(value) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  if (!UTC_INSTANT.test(text)) return null;

  const parsed = Date.parse(text);

  return Number.isFinite(parsed) ? text : null;
}

function invalidScan(code) {
  return Object.freeze({
    status: "invalid",
    code,
    retry: false,
    refusals: Object.freeze([]),
    result: null,
    identity: null,
    pages: Object.freeze([]),
  });
}

function rejected(code) {
  return { accepted: false, page: null, code };
}

function refusalCode(body) {
  if (body === null) return RECOVERY_SCAN_CODES.UNPARSEABLE_RESPONSE;

  if (typeof body.code === "string" && body.code !== "") return body.code;

  return RECOVERY_SCAN_CODES.UNSUCCESSFUL_RESPONSE;
}

async function fetchPage({ base, login, server, range, fetchImpl }) {
  const query = new URLSearchParams({
    mt5_login: login,
    mt5_server: server,
    from_utc: range.fromUtc,
    to_utc: range.toUtc,
  });

  let response;

  try {
    response = await fetchImpl(`${base}${HISTORY_PATH}?${query}`, {
      cache: "no-store",
    });
  } catch {
    return rejected(RECOVERY_SCAN_CODES.FETCH_FAILED);
  }

  let body;

  try {
    const raw = await response?.json();

    body = isPlainObject(raw) ? raw : null;
  } catch {
    body = null;
  }

  // Attestation of the page itself belongs to the route
  // (verifyHistoryPage); a page that did not survive it never arrives
  // with success === true.
  if (response?.ok === true && body !== null && body.success === true) {
    return { accepted: true, page: body };
  }

  return rejected(refusalCode(body));
}

export async function runHistoryRecoveryScan({
  apiUrl,
  fetchImpl,
  identity,
  windows,
}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("runHistoryRecoveryScan requires a fetch implementation");
  }

  const base =
    typeof apiUrl === "string" ? apiUrl.trim().replace(/\/+$/, "") : "";

  if (base === "") {
    return invalidScan(RECOVERY_SCAN_CODES.INVALID_API_URL);
  }

  const login = canonicalLogin(isPlainObject(identity) ? identity.mt5Login : null);
  const server =
    isPlainObject(identity) && typeof identity.mt5Server === "string"
      ? identity.mt5Server.trim()
      : "";

  if (login === null || server === "") {
    return invalidScan(RECOVERY_SCAN_CODES.INVALID_MT5_IDENTITY);
  }

  if (!Array.isArray(windows) || windows.length === 0) {
    return invalidScan(RECOVERY_SCAN_CODES.INVALID_RECOVERY_WINDOW);
  }

  const ranges = [];

  for (const window of windows) {
    if (!isPlainObject(window)) {
      return invalidScan(RECOVERY_SCAN_CODES.INVALID_RECOVERY_WINDOW);
    }

    const fromUtc = canonicalInstant(window.fromUtc);
    const toUtc = canonicalInstant(window.toUtc);

    if (fromUtc === null || toUtc === null || Date.parse(toUtc) <= Date.parse(fromUtc)) {
      return invalidScan(RECOVERY_SCAN_CODES.INVALID_RECOVERY_WINDOW);
    }

    ranges.push({ fromUtc, toUtc });
  }

  const records = [];
  const refusals = [];

  // One window at a time: the bridge serialises history reads behind a
  // per-call lock, so a fan-out would only manufacture refusals.
  for (const range of ranges) {
    const record = await fetchPage({ base, login, server, range, fetchImpl });

    if (record.accepted === false) {
      refusals.push(Object.freeze({ ...range, code: record.code }));
    }

    records.push(record);
  }

  const result = reconstructClosedPositions(records);
  const { scan } = result;

  // Scan-level retry. Incomplete snapshot evidence can never be repaired
  // by reading the records — a record may honestly say retryable: false
  // while the window beside it is missing — so the scan-level flag and
  // the count of pages that produced no evidence decide this, not the
  // per-record flags.
  const retry =
    scan.snapshotEvidenceIncomplete === true || scan.rejectedPages > 0;

  return Object.freeze({
    status: "scanned",
    retry,
    refusals: Object.freeze(refusals),
    result,
    // The request this evidence answers to. The route compares the caller
    // with the bridge (server/routes/mt5.js:940-945), so a page that names
    // anyone else cannot have come from this scan.
    identity: Object.freeze({ mt5Login: login, mt5Server: server }),
    // Shallow, frozen copies: the bodies stay the route's own objects, but
    // no caller can rewrite which pages were accepted by reaching in here.
    pages: Object.freeze(records.map((record) => Object.freeze({ ...record }))),
  });
}
