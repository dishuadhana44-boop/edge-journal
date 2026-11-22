/* ============================================================
   THE DISCOVERY PROJECTION

   The broker answers an authorization with a list of accounts. Nothing
   in this server may turn that list into saved records by guessing, so
   this module answers one question only: given what the broker named
   and what is already saved, which candidates may a caller persist, and
   what must it be told went wrong first?

   IT IS A PROJECTION, NOT A MIGRATION AND NOT A DECISION. It reads no
   file, opens no socket, asks the broker nothing, starts no clock, draws
   no random number and remembers nothing between calls — so the same
   inputs always give back the same object, and a caller can ask what a
   discovery *would* write before it writes anything.

   IT SELECTS NOTHING. The result carries no active account, no default
   flag and no activation, and the module never reads, copies or
   derives a selection. Choosing an account stays with the one explicit
   route that may do it.

   IDENTICAL IDENTITY RULE, ONE SOURCE. Every id is judged by
   `normalizeAccountKey`, the same coercion that decides every other
   cTrader account question. A second rule here would be a second place
   that can disagree with the first.

   THE FOUR-KEY CEILING IS THE LEAK GUARD. A candidate keeps nothing but
   `id`, `accountId`, `name` and `createdAt` — the keys the combined
   store has always written. Broker fields (live/demo, login, broker
   title) and any credential a caller had misplaced on a stored record
   stop being part of the record the moment it is copied, so they cannot
   ride into the file account readers open. The names are repeated here
   because the module that owns them exports exactly one function and
   cannot be widened; the test suite measures that the two lists still
   agree instead of trusting this comment.

   A REFUSAL NEVER HANDS BACK A LIST. When anything is ambiguous,
   unusable or incomplete, `accounts` is empty. A caller cannot save a
   partial discovery by forgetting to check `ok`, which is the whole
   reason an empty broker response and a broker response full of junk
   are refusals rather than successes with nothing in them.

   CHECKS ARE ORDERED, AND THE ORDER IS THE CONTRACT: the caller's own
   state is judged before the broker's response (a broken stored list
   cannot be repaired by discovering more), ambiguity is judged before
   incompleteness (a duplicated id makes the whole set unproducible),
   and a missing identifier source is judged last, because only a
   response that adds an account needs one.

   NOTHING IS INVENTED. A new candidate has no local id, so the caller
   must supply `createLocalId`; `name` and `createdAt` are left null and
   the existing store fills them the way it always has. That keeps this
   module free of a clock and a random source, and keeps the choice of
   an identifier with the path that persists it.
   ============================================================ */

import { normalizeAccountKey } from "./ctraderAccountSelection.js";

const ACCOUNT_METADATA_KEYS = ["id", "accountId", "name", "createdAt"];

function result({
  ok,
  code,
  message,
  accounts,
  discoveredAccountIds,
  matchedAccountIds,
  newAccountIds,
  preservedAccountIds,
  rejected,
}) {
  return {
    ok,
    code,
    message,
    accounts,
    discoveredAccountIds,
    matchedAccountIds,
    newAccountIds,
    preservedAccountIds,
    rejected,
  };
}

function refusal(code, message, observations) {
  return result({
    ok: false,
    code,
    message,
    accounts: [],
    ...observations,
  });
}

function emptyObservations() {
  return {
    discoveredAccountIds: [],
    matchedAccountIds: [],
    newAccountIds: [],
    preservedAccountIds: [],
    rejected: [],
  };
}

function unusableRow(row) {
  return row === null || typeof row !== "object" || Array.isArray(row);
}

// A copy, key by key, with nothing but the four persistence fields.
function projectRecord(row, accountId) {
  const record = {};

  for (const key of ACCOUNT_METADATA_KEYS) {
    record[key] = row[key] === undefined ? null : row[key];
  }

  record.accountId = accountId;

  return record;
}

export function projectCtraderDiscovery({
  discoveredAccounts,
  storedAccounts,
  createLocalId,
} = {}) {
  if (!Array.isArray(discoveredAccounts)) {
    return refusal(
      "discovery_response_not_a_list",
      "The cTrader account discovery returned no list of accounts, so no candidate was produced.",
      emptyObservations()
    );
  }

  if (!Array.isArray(storedAccounts)) {
    return refusal(
      "stored_accounts_not_a_list",
      "The saved cTrader accounts were not a list, so discovery could not be compared with them and no candidate was produced.",
      emptyObservations()
    );
  }

  const storedKeys = [];

  for (const row of storedAccounts) {
    const key = unusableRow(row) ? null : normalizeAccountKey(row.accountId);

    if (key === null) {
      return refusal(
        "stored_account_unusable",
        "A saved cTrader account carries no usable account id, so discovery refused to project against it and no candidate was produced.",
        emptyObservations()
      );
    }

    storedKeys.push(key);
  }

  if (new Set(storedKeys).size !== storedKeys.length) {
    return refusal(
      "ambiguous_stored_accounts",
      "The saved cTrader accounts name the same account more than once, so discovery projected no candidate.",
      { ...emptyObservations(), preservedAccountIds: storedKeys }
    );
  }

  if (discoveredAccounts.length === 0) {
    return refusal(
      "no_accounts_discovered",
      "cTrader account discovery returned no accounts, so no candidate was produced.",
      { ...emptyObservations(), preservedAccountIds: storedKeys }
    );
  }

  const rejected = [];
  const validKeys = [];

  discoveredAccounts.forEach((row, index) => {
    if (unusableRow(row)) {
      rejected.push({ index, code: "row_not_an_object" });
      return;
    }

    const key = normalizeAccountKey(row.accountId);

    if (key === null) {
      rejected.push({ index, code: "account_id_unusable" });
      return;
    }

    validKeys.push(key);
  });

  const discoveredKeys = validKeys;
  const uniqueKeys = Array.from(new Set(discoveredKeys));

  const matchedAccountIds = uniqueKeys.filter((key) => storedKeys.includes(key));
  const newAccountIds = uniqueKeys.filter((key) => !storedKeys.includes(key));
  const preservedAccountIds = storedKeys.filter(
    (key) => !uniqueKeys.includes(key)
  );

  const observations = {
    discoveredAccountIds: uniqueKeys,
    matchedAccountIds,
    newAccountIds,
    preservedAccountIds,
    rejected,
  };

  if (new Set(discoveredKeys).size !== discoveredKeys.length) {
    const duplicated = uniqueKeys.filter(
      (key) => discoveredKeys.indexOf(key) !== discoveredKeys.lastIndexOf(key)
    );

    return refusal(
      "ambiguous_discovered_accounts",
      `The cTrader account discovery named the same account more than once, so discovery projected no candidate: ${duplicated.join(", ")}.`,
      observations
    );
  }

  if (rejected.length > 0) {
    return refusal(
      "discovery_incomplete",
      `cTrader account discovery returned ${rejected.length} row(s) it could not name an account for, so discovery projected no candidate and the response was not treated as complete.`,
      observations
    );
  }

  if (newAccountIds.length > 0 && typeof createLocalId !== "function") {
    return refusal(
      "local_id_source_missing",
      "cTrader account discovery found accounts that are not saved yet, and no source for their local ids was given, so discovery projected no candidate.",
      observations
    );
  }

  const storedByKey = new Map();

  storedAccounts.forEach((row, index) => {
    storedByKey.set(storedKeys[index], row);
  });

  const accounts = validKeys.map((key) =>
    storedByKey.has(key)
      ? projectRecord(storedByKey.get(key), key)
      : { id: createLocalId(key), accountId: key, name: null, createdAt: null }
  );

  return result({
    ok: true,
    code: "discovery_projected",
    message: `cTrader account discovery projected ${accounts.length} candidate account(s); no account was selected and nothing was activated.`,
    accounts,
    ...observations,
  });
}
