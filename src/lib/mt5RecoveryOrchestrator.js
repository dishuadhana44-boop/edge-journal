import { runHistoryRecoveryScan } from "./mt5HistoryRecoveryScan.js";
import {
  adaptRecoveryJournalRecords,
  RECOVERY_ADAPTER_STATUS,
} from "./mt5RecoveryJournalAdapter.js";
import { RECOVERY_WINDOW_POLICY } from "./mt5RecoveryWindows.js";
import { canonicalLogin } from "../utils/trading/recoveryClock.js";

// ============================================================
// Stage D — one reopen's recovery preview
//
// The scan proves what the bridge reported, the adapter proves which
// closed positions that evidence supports and which ones this account's
// journal already holds. Neither knows when it is allowed to run, or that
// the account it was asked about is the account that is connected now.
// That is this module's whole job, and it is the last place a reopen can
// be stopped before anything reaches the journal.
//
// What it will not do:
//   - read history for an account nobody confirmed. The persisted account
//     and the live identity have to name the same login and server before
//     a single request goes out, because a scan of the wrong account
//     produces proposals that look exactly like the right one's.
//   - invent evidence. The scan's outcome is handed to the adapter
//     untouched; a caller who rebuilds pages, candidates or the recovery
//     list has rebuilt the conclusions too, and the adapter's pairing
//     gates exist precisely to refuse that.
//   - write. It returns proposals and the evidence behind them. Journal,
//     storage and checkpoints stay with the call sites, which are not here.
//   - claim coverage. coverageComplete and retentionVerified are reported
//     false because nothing in this pipeline can prove either; the scan's
//     own refusal of a page that asserts completeness is passed through as
//     a block, not talked around.
//
// Input:
//   apiUrl         string   Express base URL
//   fetchImpl      function injected transport; nothing is fetched without it
//   account        object   the persisted trading account (id, mt5Login, mt5Server)
//   liveIdentity   object   { mt5Login, mt5Server } confirmed for the session
//   windows        [{ fromUtc, toUtc }]  ranges to read, in order
//   existingJournal array   the journal this account holds, for deduping
//
// Output (frozen):
//   { status: "preview", records, skipped, rejected, remaining, ... }
//   { status: "blocked", refusals, records: [], skipped: [], rejected: [] ... }
// ============================================================

// Whole-second Z instants only. server/routes/mt5.js canonicalHistoryUtc and
// mt5HistoryRecoveryScan.js:53-54 both permit a fraction, but the bridge
// truncates a range bound to the second and then refuses a page holding a
// deal in the dropped part (mt5-bridge/app.py:6337-6338 with :6235), so a
// fractional window is a doomed request rather than a finer one.
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const DAY_MS = 86_400_000;

export const RECOVERY_ORCHESTRATOR_STATUS = Object.freeze({
  PREVIEW: "preview",
  BLOCKED: "blocked",
});

export const RECOVERY_ORCHESTRATOR_REASONS = Object.freeze({
  API_URL_REQUIRED: "API_URL_REQUIRED",
  FETCH_TRANSPORT_REQUIRED: "FETCH_TRANSPORT_REQUIRED",
  ACCOUNT_IDENTITY_REQUIRED: "ACCOUNT_IDENTITY_REQUIRED",
  LIVE_IDENTITY_REQUIRED: "LIVE_IDENTITY_REQUIRED",
  ACCOUNT_IDENTITY_MISMATCH: "ACCOUNT_IDENTITY_MISMATCH",
  RECOVERY_WINDOWS_REQUIRED: "RECOVERY_WINDOWS_REQUIRED",
  SCAN_NOT_SCANNED: "SCAN_NOT_SCANNED",
});

const R = RECOVERY_ORCHESTRATOR_REASONS;
const EMPTY_REMAINING = Object.freeze({
  unresolvedCount: 0,
  unassignedCount: 0,
  refusedCount: 0,
});

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

// The one login rule in the pipeline is the recovery clock's: trim, drop
// every leading zero, refuse what is left empty or longer than fifteen
// digits. mt5HistoryRecoveryScan.js asks the route with that login and the
// adapter names the record id with it, so the login confirmed here is the
// login the journal ends up naming. This module only needs a yes or no, so
// the tagged result is read down to the canonical text or null.
function loginText(value) {
  const canonical = canonicalLogin(value);

  return typeof canonical.login === "string" ? canonical.login : null;
}

// server/routes/mt5.js:765 trims and lowercases the server it forwards, so
// the only form that can come back on a page is that one. The literal is
// kept for the adapter's exact comparison; the key is what the app persisted
// against, which is why "MetaQuotes-Demo" and "metaquotes-demo" confirm.
function canonicalServer(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (trimmed === "") return null;

  for (const character of trimmed) {
    if (character.codePointAt(0) < 32) return null;
  }

  return trimmed;
}

function validWindow(value) {
  if (!isPlainObject(value)) return false;

  const fromUtc = typeof value.fromUtc === "string" ? value.fromUtc.trim() : "";
  const toUtc = typeof value.toUtc === "string" ? value.toUtc.trim() : "";

  if (!UTC_INSTANT.test(fromUtc) || !UTC_INSTANT.test(toUtc)) return false;

  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);

  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return false;

  // The ceiling is the recovery policy's tile, not the bridge's page limit:
  // the bridge would answer a 365-day page, but nothing has proven how many
  // deals fit in one, so a wider read is refused here rather than attempted.
  return to - from <= RECOVERY_WINDOW_POLICY.TILE_DAYS * DAY_MS;
}

function readAccount(value) {
  if (!isPlainObject(value)) return null;

  const id =
    typeof value.id === "number"
      ? Number.isFinite(value.id)
        ? String(value.id)
        : null
      : typeof value.id === "string" && value.id.trim() !== ""
        ? value.id.trim()
        : null;

  if (id === null) return null;

  const login = loginText(value.mt5Login);
  const server = canonicalServer(value.mt5Server);

  if (login === null || server === null) return null;

  return { accountId: id, login, server, key: server.toLowerCase() };
}

function identityBlocked(refusals, identity = null, outcome = null) {
  return Object.freeze({
    status: RECOVERY_ORCHESTRATOR_STATUS.BLOCKED,
    refusals: Object.freeze([...refusals]),
    records: Object.freeze([]),
    skipped: Object.freeze([]),
    rejected: Object.freeze([]),
    remaining: EMPTY_REMAINING,
    coverageComplete: false,
    retentionVerified: false,
    journalWritten: false,
    watermarkAdvanced: false,
    identity,
    outcome,
  });
}

export async function planMT5RecoveryPreview(input = {}) {
  const { apiUrl, fetchImpl, account, liveIdentity, windows, existingJournal } =
    input;

  const base = typeof apiUrl === "string" ? apiUrl.trim().replace(/\/+$/, "") : "";

  if (base === "") return identityBlocked([R.API_URL_REQUIRED]);

  // The scan throws without a transport; a reopen must not fail because of it.
  if (typeof fetchImpl !== "function") {
    return identityBlocked([R.FETCH_TRANSPORT_REQUIRED]);
  }

  const confirmed = readAccount(account);

  if (confirmed === null) return identityBlocked([R.ACCOUNT_IDENTITY_REQUIRED]);

  const live = isPlainObject(liveIdentity)
    ? {
        login: loginText(liveIdentity.mt5Login),
        server: canonicalServer(liveIdentity.mt5Server),
      }
    : null;

  if (live === null || live.login === null || live.server === null) {
    return identityBlocked([R.LIVE_IDENTITY_REQUIRED]);
  }

  if (
    live.login !== confirmed.login ||
    live.server.toLowerCase() !== confirmed.key
  ) {
    return identityBlocked([R.ACCOUNT_IDENTITY_MISMATCH]);
  }

  if (!Array.isArray(windows) || windows.length === 0 || !windows.every(validWindow)) {
    return identityBlocked([R.RECOVERY_WINDOWS_REQUIRED]);
  }

  const identity = { mt5Login: confirmed.login, mt5Server: confirmed.server };

  const outcome = await runHistoryRecoveryScan({
    apiUrl: base,
    fetchImpl,
    identity,
    windows,
  });

  if (outcome.status !== "scanned") {
    return identityBlocked([R.SCAN_NOT_SCANNED], identity, outcome);
  }

  // The persisted account goes to the adapter as it was stored: this module
  // confirmed who it is, it did not rewrite it.
  const proposal = adaptRecoveryJournalRecords({
    outcome,
    account,
    existingJournal,
  });

  if (proposal.status !== RECOVERY_ADAPTER_STATUS.PROPOSED) {
    return identityBlocked([...proposal.refusals], identity, outcome);
  }

  return Object.freeze({
    status: RECOVERY_ORCHESTRATOR_STATUS.PREVIEW,
    refusals: Object.freeze([]),
    records: proposal.records,
    skipped: proposal.skipped,
    rejected: proposal.rejected,
    remaining: proposal.remaining,
    // Nothing here can prove the broker kept everything or that it did, so
    // nothing here is allowed to say otherwise.
    coverageComplete: false,
    retentionVerified: false,
    journalWritten: false,
    watermarkAdvanced: false,
    identity: Object.freeze(identity),
    outcome,
  });
}
