/* ============================================================
   CTRADER ACCOUNT SELECTION

   One rule, shared by the broker-facing service and the stored
   auth state: a cTrader account is chosen by its id, never by its
   position in a list. Nothing observed from this codebase says how
   the broker orders its authorized accounts, so position-based
   selection is a coin flip between accounts that may belong to
   different people.

   THE RULE IS EXPLICIT-ONLY. A caller that names no account gets no
   account, even when exactly one is available. A sole saved account
   used to be selected here without anyone asking, which made every
   path that forgot to pass an id — a reconnect, a restart, a store
   read with the selection cleared — quietly activate an account and,
   through it, start trading. Refusing a missing request is the same
   decision as refusing a bad one: this rule selects the account that
   was asked for, or none.

   Every refusal returns accountId: null and a message that states
   plainly that no account was selected, so no caller can trade,
   authenticate or advertise a session it did not ask for.

   This module is deliberately pure: it performs no I/O, opens no
   socket and reads no environment, which is what lets the whole
   rule be tested offline.
   ============================================================ */

import {
  makeTradingAccount,
  normalizeTradingEnvironment,
  UNKNOWN_ENVIRONMENT,
} from "../brokers/identity.js";

function accountKey(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const text = value.trim();

    return text === "" || unnamed(text) ? null : text;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "object") {
    // int64 fields arrive as Long-like objects that print as decimals.
    let text;

    try {
      text = String(value).trim();
    } catch {
      return null;
    }

    return text === "" || unnamed(text) ? null : text;
  }

  return null;
}

function unnamed(text) {
  return /^\[object /i.test(text);
}

/* The same coercion this rule applies to every id it is handed,
   exported for the one caller that has to decide whether a stored
   value asked for an account at all. It is this function, not a
   second rule that could drift from it. */
export const normalizeAccountKey = accountKey;

function refusal(code, message) {
  return {
    ok: false,
    accountId: null,
    code,
    message,
  };
}

function stateRefusal(code, message, accounts, activeAccountId) {
  return {
    ok: false,
    accountId: null,
    code,
    message,
    accounts,
    activeAccountId,
  };
}

export function selectAccountById({ accountIds, requestedAccountId } = {}) {
  const keys = Array.isArray(accountIds)
    ? accountIds.map(accountKey).filter((key) => key !== null)
    : [];

  if (keys.length === 0) {
    return refusal(
      "no_accounts_available",
      "No usable cTrader account id was available, so no account was selected."
    );
  }

  const unique = Array.from(new Set(keys));

  if (unique.length !== keys.length) {
    return refusal(
      "ambiguous_account_ids",
      `The cTrader account list names the same account id more than once, so no account was selected.`
    );
  }

  const requested = accountKey(requestedAccountId);

  if (requested === null) {
    return refusal(
      "explicit_selection_required",
      "No usable cTrader account id was requested, so no account was selected."
    );
  }

  if (!unique.includes(requested)) {
    return refusal(
      "requested_account_not_available",
      `The requested cTrader account ${requested} is not one of the available accounts, so no account was selected.`
    );
  }

  return {
    ok: true,
    accountId: requested,
    code: "requested_account",
    message: `The requested cTrader account ${requested} was selected.`,
  };
}

export function verifyAuthenticatedAccount({
  requestedAccountId,
  respondedAccountId,
} = {}) {
  const requested = accountKey(requestedAccountId);
  const responded = accountKey(respondedAccountId);

  if (requested === null) {
    return refusal(
      "account_auth_unrequested",
      "No cTrader account was requested, so the authentication response cannot be attributed and no account was selected."
    );
  }

  if (responded === null) {
    return refusal(
      "account_auth_response_unnamed",
      `The cTrader authentication response named no account id, so no account was selected.`
    );
  }

  if (requested !== responded) {
    return refusal(
      "account_auth_mismatch",
      `The cTrader service authenticated account ${responded} instead of the requested account ${requested}, so no account was selected.`
    );
  }

  return {
    ok: true,
    accountId: requested,
    code: "authenticated_account_confirmed",
    message: `The cTrader service authenticated the requested account ${requested}.`,
  };
}

/* Whether a session that is already up may be handed to this request.

   A ready socket proves that something is connected. It does not prove
   whose money it is connected to, and an unreadable session identity is
   not a second answer of "close enough": both are refusals. This is the
   same comparison the service and the route make, so the two can never
   drift into agreeing with different accounts. */
export function verifySessionAccountIdentity({
  requestedAccountId,
  sessionId,
} = {}) {
  const requested = accountKey(requestedAccountId);

  if (requested === null) {
    return refusal(
      "session_identity_unrequested",
      "No usable cTrader account id was requested, so no running session was reused."
    );
  }

  const current = accountKey(sessionId);

  if (current === null) {
    return refusal(
      "session_identity_unverifiable",
      `The running cTrader session names no account id, so it cannot be proven to serve the requested account ${requested} and was not reused.`
    );
  }

  if (current !== requested) {
    return refusal(
      "session_identity_mismatch",
      `The running cTrader session belongs to account ${current}, not the requested account ${requested}, so it was not reused.`
    );
  }

  return {
    ok: true,
    accountId: requested,
    code: "session_identity_match",
    message: `The running cTrader session belongs to the requested account ${requested}.`,
  };
}

function removalRefusal(code, message) {
  return {
    ...refusal(code, message),
    accounts: null,
    activeAccountId: null,
    mustStopService: false,
    removedAccount: null,
  };
}

export function planAccountRemoval({
  accounts,
  activeAccountId,
  accountId,
} = {}) {
  const records = Array.isArray(accounts) ? accounts : [];
  const requested = accountKey(accountId);

  const matchIndex =
    requested === null
      ? -1
      : records.findIndex(
          (account) => accountKey(account?.accountId) === requested
        );

  if (matchIndex === -1) {
    return requested === null
      ? removalRefusal(
          "account_not_found",
          "No usable cTrader account id was given, so no account was removed."
        )
      : removalRefusal(
          "account_not_found",
          `The cTrader account ${requested} is not one of the saved accounts, so no account was removed.`
        );
  }

  const active = accountKey(activeAccountId);
  const wasActive = active !== null && active === requested;
  const activeIsSaved =
    active !== null &&
    records.some((account) => accountKey(account?.accountId) === active);
  const nextActive = wasActive || !activeIsSaved ? null : active;

  /* The accounts left behind were never authenticated by the session that
     was just torn down, so none of them is a successor: the caller ends with
     no active account until someone selects one. */
  return {
    ok: true,
    accountId: requested,
    code: wasActive ? "active_account_removed" : "inactive_account_removed",
    message: wasActive
      ? `The active cTrader account ${requested} was removed, so no account is active and the cTrader service must be stopped.`
      : active === null
        ? `The cTrader account ${requested} was removed; no account was active and none was selected.`
        : nextActive === null
          ? `The cTrader account ${requested} was removed; its stored active id named no saved account, so no account is active and none was selected.`
          : `The cTrader account ${requested} was removed; the active account ${nextActive} is unchanged.`,
    removedAccount: records[matchIndex],
    accounts: records.filter((account, index) => index !== matchIndex),
    activeAccountId: nextActive,
    mustStopService: wasActive,
  };
}

export function tradingAccountScopeKey(account) {
  const platformId = accountKey(account?.platformId);
  const externalAccountId = accountKey(account?.externalAccountId);

  if (platformId === null || externalAccountId === null) {
    return null;
  }

  const environment = normalizeTradingEnvironment(account?.environment);

  return `${platformId}:${environment}:${externalAccountId}`;
}

export function planTradingAccountAddition({
  accounts,
  activeAccountId,
  account,
} = {}) {
  const created = makeTradingAccount(account);

  if (!created.ok) {
    return stateRefusal(
      created.code,
      created.message,
      accounts,
      activeAccountId
    );
  }

  const next = created.account;
  const records = Array.isArray(accounts) ? accounts : [];
  const active = accountKey(activeAccountId);

  if (
    active !== null &&
    !records.some((entry) => accountKey(entry?.accountId) === active)
  ) {
    return stateRefusal(
      "invalid_active_account",
      "The stored active account id names no saved account, so the trading account was not added.",
      accounts,
      activeAccountId
    );
  }

  if (
    records.some((entry) => accountKey(entry?.accountId) === next.accountId)
  ) {
    return stateRefusal(
      "account_id_conflict",
      `Trading account ${next.accountId} is already saved, so no account was added.`,
      accounts,
      activeAccountId
    );
  }

  const nextScope = tradingAccountScopeKey(next);

  if (
    records.some((entry) => {
      const existingScope = tradingAccountScopeKey(entry);

      return existingScope !== null && existingScope === nextScope;
    })
  ) {
    return stateRefusal(
      "external_account_conflict",
      `External account ${next.externalAccountId} is already saved for ${next.platformId} in the ${next.environment} environment, so no account was added.`,
      accounts,
      activeAccountId
    );
  }

  return {
    ok: true,
    accountId: next.accountId,
    code: "trading_account_added",
    message: `Trading account ${next.accountId} was added; no account was selected.`,
    accounts: [...records, next],
    activeAccountId: active,
  };
}

export function planExplicitAccountSelection({
  accounts,
  activeAccountId,
  accountId,
} = {}) {
  const records = Array.isArray(accounts) ? accounts : [];
  const requested = accountKey(accountId);

  if (requested === null) {
    return stateRefusal(
      "explicit_selection_required",
      "Selecting a trading account requires an explicit account id, so no account was selected.",
      accounts,
      activeAccountId
    );
  }

  const selection = selectAccountById({
    accountIds: records.map((entry) => entry?.accountId),
    requestedAccountId: requested,
  });

  if (!selection.ok) {
    return stateRefusal(
      selection.code,
      selection.message,
      accounts,
      activeAccountId
    );
  }

  return {
    ok: true,
    accountId: selection.accountId,
    code: "explicit_account_selected",
    message: `Trading account ${selection.accountId} was explicitly selected.`,
    accounts,
    activeAccountId: selection.accountId,
  };
}

export function restoreActiveAccountId({
  accounts,
  activeAccountId,
} = {}) {
  const records = Array.isArray(accounts) ? accounts : [];
  const active = accountKey(activeAccountId);

  if (active === null) {
    return null;
  }

  return records.some((entry) => accountKey(entry?.accountId) === active)
    ? active
    : null;
}

export function confirmTradingAccountEnvironment({
  accounts,
  activeAccountId,
  accountId,
  environment,
} = {}) {
  const records = Array.isArray(accounts) ? accounts : [];
  const requested = accountKey(accountId);
  const confirmedEnvironment = normalizeTradingEnvironment(environment);

  if (confirmedEnvironment === UNKNOWN_ENVIRONMENT) {
    return stateRefusal(
      "invalid_environment",
      `Environment "${String(environment ?? "")}" is neither demo nor live, so no trading account environment was confirmed.`,
      accounts,
      activeAccountId
    );
  }

  if (
    requested === null ||
    !records.some((entry) => accountKey(entry?.accountId) === requested)
  ) {
    return stateRefusal(
      "requested_account_not_available",
      "The requested trading account is not saved, so no environment was confirmed.",
      accounts,
      activeAccountId
    );
  }

  return {
    ok: true,
    accountId: requested,
    code: "environment_confirmed",
    message: `Trading account ${requested} was explicitly confirmed as ${confirmedEnvironment}.`,
    accounts: records.map((entry) =>
      accountKey(entry?.accountId) === requested
        ? { ...entry, environment: confirmedEnvironment }
        : entry
    ),
    activeAccountId: restoreActiveAccountId({ accounts, activeAccountId }),
  };
}
