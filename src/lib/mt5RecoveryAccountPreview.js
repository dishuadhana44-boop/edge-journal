import {
  planRecoveryPreviewFromClock,
  RECOVERY_PREVIEW_STATUS,
} from "./mt5RecoveryPreview.js";
import { canonicalLogin } from "../utils/trading/recoveryClock.js";

// ============================================================
// Stage D — which persisted account a live connection may recover for
//
// The coordinator (src/lib/mt5RecoveryPreview.js) turns a trusted broker
// clock into a preview, but it is handed `account` and `clockSample` by a
// caller, and a caller with the wrong record produces a preview that looks
// exactly like the right account's. This module is the step that has no
// caller's word to rely on: it finds the persisted account the confirmed
// live identity actually names, reads the clock through the contract that
// remembers it, and only then calls the coordinator.
//
// What it will not do:
//   - take the account from the caller. There is no `account` argument and no
//     `selectedAccountId` argument either; the record comes out of the
//     catalog the app persists, keyed on the login and server the broker
//     reported. Whatever else a caller passes under those names is not read.
//   - guess at an account. A catalog row that cannot name both an MT5 login
//     and a server is not a candidate — the live sync path tolerates a missing
//     server (src/context/TradeContext.jsx:2646-2655) because a wrong guess
//     there only shows the wrong balance, while here it would journal the
//     wrong trades. Two rows that both name the connected identity are a
//     refusal, not a first match.
//   - take a clock on faith. The sample comes from `getRecoveryClockSample()`
//     — the same contract TradeContext exposes for it (TradeContext.jsx:2108)
//     — read once at call time, so a preview cannot be planned against a value
//     a caller kept from an earlier session.
//   - soften a gate or write anything. Everything after resolution is the
//     coordinator's verdict passed through: its status, refusals, records,
//     skipped, rejected, remaining and evidence binding arrive as they left it,
//     and `journalWritten` / `watermarkAdvanced` stay false because this module
//     reads no journal and no storage at all.
//
// Input:
//   accounts              the persisted trading-account catalog, as stored
//   liveIdentity          { mt5Login, mt5Server } confirmed for this session
//   getRecoveryClockSample function returning the remembered sample or null
//   now                   client instant in ms the sample's age is measured at
//   apiUrl, fetchImpl     forwarded to the scan untouched
//   existingJournal       the snapshot that account already holds, for deduping
//
// Output (frozen): the coordinator's verdict plus this layer's binding —
//   { status: "preview" | "blocked", accountId, refusals, records, skipped,
//     rejected, remaining, coverageComplete: false, retentionVerified: false,
//     journalWritten: false, watermarkAdvanced: false, clock, windowPlan,
//     anchorUtc, anchorMs, windows, identity, outcome }
// A refusal from this layer carries its own reason and no account id:
//   RECOVERY_ACCOUNT_CATALOG_INVALID, RECOVERY_LIVE_IDENTITY_INVALID,
//   RECOVERY_ACCOUNT_NOT_PERSISTED, RECOVERY_ACCOUNT_MATCH_AMBIGUOUS,
//   RECOVERY_CLOCK_PROVIDER_INVALID.
// ============================================================

export const RECOVERY_ACCOUNT_PREVIEW_STATUS = Object.freeze({
  PREVIEW: RECOVERY_PREVIEW_STATUS.PREVIEW,
  BLOCKED: RECOVERY_PREVIEW_STATUS.BLOCKED,
});

export const RECOVERY_ACCOUNT_PREVIEW_REASONS = Object.freeze({
  ACCOUNT_CATALOG_INVALID: "RECOVERY_ACCOUNT_CATALOG_INVALID",
  LIVE_IDENTITY_INVALID: "RECOVERY_LIVE_IDENTITY_INVALID",
  ACCOUNT_NOT_PERSISTED: "RECOVERY_ACCOUNT_NOT_PERSISTED",
  ACCOUNT_MATCH_AMBIGUOUS: "RECOVERY_ACCOUNT_MATCH_AMBIGUOUS",
  CLOCK_PROVIDER_INVALID: "RECOVERY_CLOCK_PROVIDER_INVALID",
});

const R = RECOVERY_ACCOUNT_PREVIEW_REASONS;

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

// The login the rest of the recovery pipeline names an account with is the
// recovery clock's canonical form - digits only, every leading zero dropped,
// refused when what is left is empty or longer than the ceiling - and it is
// the same login the adapter writes into a record id and a watermark key.
// This module only needs a yes or no, so the tagged result is read down to
// the canonical text or null.
function loginText(value) {
  const canonical = canonicalLogin(value);

  return typeof canonical.login === "string" ? canonical.login : null;
}

// Lookup is case- and padding-insensitive because that is how the app already
// resolves a broker connection to an EdgeFlo account
// (TradeContext.jsx:2629-2636, and the orchestrator's own server confirmation,
// which folds the case at mt5RecoveryOrchestrator.js:206 against the key
// readAccount builds at :156). The stored spelling is what goes forward:
// this returns a key, never a replacement for the record's own `mt5Server`.
function serverKey(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (trimmed === "") return null;

  for (const character of trimmed) {
    if (character.codePointAt(0) < 32) return null;
  }

  return trimmed.toLowerCase();
}

function rowIdentity(row) {
  if (!isPlainObject(row)) return null;

  const login = loginText(row.mt5Login ?? row.login ?? null);
  const server = serverKey(row.mt5Server ?? row.server ?? null);

  if (login === null || server === null) return null;

  return { login, server };
}

function blocked(refusals, accountId = null) {
  return Object.freeze({
    status: RECOVERY_ACCOUNT_PREVIEW_STATUS.BLOCKED,
    refusals: Object.freeze([...refusals]),
    records: Object.freeze([]),
    skipped: Object.freeze([]),
    rejected: Object.freeze([]),
    remaining: EMPTY_REMAINING,
    coverageComplete: false,
    retentionVerified: false,
    journalWritten: false,
    watermarkAdvanced: false,
    accountId,
    identity: null,
    outcome: null,
    clock: null,
    windowPlan: null,
    anchorUtc: null,
    anchorMs: null,
    windows: Object.freeze([]),
  });
}

export async function planRecoveryPreviewForAccount(input = {}) {
  const request = isPlainObject(input) ? input : {};

  // The catalog is an argument, never a storage read: whoever holds the
  // persisted accounts hands them over, and this module decides which one the
  // broker's own identity names.
  if (!Array.isArray(request.accounts)) {
    return blocked([R.ACCOUNT_CATALOG_INVALID]);
  }

  const live = isPlainObject(request.liveIdentity)
    ? {
        login: loginText(request.liveIdentity.mt5Login),
        server: serverKey(request.liveIdentity.mt5Server),
      }
    : { login: null, server: null };

  if (live.login === null || live.server === null) {
    return blocked([R.LIVE_IDENTITY_INVALID]);
  }

  const matches = [];

  for (const row of request.accounts) {
    const identity = rowIdentity(row);

    if (identity === null) continue;

    if (identity.login === live.login && identity.server === live.server) {
      matches.push(row);
    }
  }

  if (matches.length === 0) {
    return blocked([R.ACCOUNT_NOT_PERSISTED]);
  }

  if (matches.length > 1) {
    return blocked([R.ACCOUNT_MATCH_AMBIGUOUS]);
  }

  const account = matches[0];
  const accountId = account.id ?? null;

  if (typeof request.getRecoveryClockSample !== "function") {
    return blocked([R.CLOCK_PROVIDER_INVALID], accountId);
  }

  let clockSample;

  try {
    clockSample = request.getRecoveryClockSample();
  } catch {
    // A torn-down provider is not a fresh clock. Refuse rather than plan
    // without one, and never let a reopen fail on the way.
    return blocked([R.CLOCK_PROVIDER_INVALID], accountId);
  }

  const verdict = await planRecoveryPreviewFromClock({
    apiUrl: request.apiUrl,
    fetchImpl: request.fetchImpl,
    account,
    clockSample,
    now: request.now,
    existingJournal: request.existingJournal,
  });

  // The verdict stays exactly as the coordinator froze it; the only thing
  // added here is which persisted record it was planned for.
  return Object.freeze({ ...verdict, accountId });
}
