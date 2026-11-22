/* ============================================================
   DISCOVERY TO PERSISTENCE

   Two functions, one path. `mergeDiscoveredAccounts` takes a SUCCESSFUL
   projection from the discovery module plus the accounts that are already
   saved and returns the complete next account list. `persistDiscoveredAccounts`
   reads that list out of the combined store, runs the projection and the
   merge over it and hands one whole next state back to the store, which is
   given to it rather than reached for.

   NOTHING IS GUESSED AND NOTHING IS SKIPPED. The merge writes a new record
   only for an account the projection proved is not saved yet, and it takes
   every already-saved record from the caller's own list rather than from the
   projection's copy of it — because that copy is the four-key persistence
   shape, while the record on disk may carry metadata the user wrote. A
   candidate therefore can never rename, re-time or re-number a saved account.

   A REFUSAL NEVER HANDS BACK A LIST, AND NEVER WRITES. Every branch that is
   not certain returns `accounts: []`, and the store is not reached on any of
   them. `store.save` is called exactly once, with the complete next state,
   and a store that throws is reported as a failure rather than as a success
   that forgot to write.

   THE RESULT CARRIES NO SELECTION. No active account, no default flag, no
   activation — not in the accounts, not in the envelope, not in the message.
   This path can only ever add accounts to the file; the one explicit route
   that starts a session for one of them is untouched here. The result also
   never echoes the stored state, so the tokens the state was read with cannot
   be echoed into a response by a caller that prints the result.

   THE IDENTITY RULE AND THE CEILING COME FROM THEIR OWNERS. Ids are judged by
   `normalizeAccountKey`, the same coercion every other cTrader account
   question uses; the projection is the only thing allowed to decide what is
   new. A new record is exactly `id`, `accountId`, `name` and `createdAt` — the
   four keys the combined store has always written — so no broker field and no
   credential can ride into the file account readers open.

   NO CLOCK, NO RANDOMNESS, NO PATH, NO FILE. The local id and the creation
   timestamp come from `createLocalId` and `now`, both injected, and refused
   for if a new account would need one and neither was given. Neither is asked
   for when discovery names nothing new.

   CHECKS ARE ORDERED, AND THE ORDER IS THE CONTRACT. The projection result is
   judged before anything it contains (a caller that passes a refusal, an
   incomplete run or a hand-made object is not a discovery at all), the caller's
   own saved list before the candidates (a broken saved list cannot be repaired
   by discovering more), the candidate rows before the lists that describe them,
   the two cross-checked against each other, and the injected sources last —
   because only a response that adds an account needs them.
   ============================================================ */

import { normalizeAccountKey } from "./ctraderAccountSelection.js";
import { projectCtraderDiscovery } from "./ctraderAccountDiscovery.js";

const DEFAULT_ACCOUNT_NAME = "Trading Account";

const PROJECTION_LIST_KEYS = [
  "discoveredAccountIds",
  "matchedAccountIds",
  "newAccountIds",
  "preservedAccountIds",
  "rejected",
];

function result({
  ok,
  code,
  message,
  accounts,
  addedAccountIds,
  preservedAccountIds,
}) {
  return {
    ok,
    code,
    message,
    accounts,
    addedAccountIds,
    preservedAccountIds,
  };
}

function refusal(code, message) {
  return result({
    ok: false,
    code,
    message,
    accounts: [],
    addedAccountIds: [],
    preservedAccountIds: [],
  });
}

function unusableRecord(row) {
  return row === null || typeof row !== "object" || Array.isArray(row);
}

function isResult(value) {
  return (
    value !== null && typeof value === "object" && !Array.isArray(value)
  );
}

function sameIds(one, other) {
  const first = new Set(one);
  const second = new Set(other);

  return (
    first.size === one.length &&
    second.size === other.length &&
    first.size === second.size &&
    Array.from(first).every((id) => second.has(id))
  );
}

/* Only the two tokens a caller may repeat: which step refused and the file
   system's own code. The error's message is deliberately never read — it
   names the auth file, and a result is something a route hands to a browser. */
function failureReason(error, fallbackStep) {
  const step =
    isResult(error) && typeof error.step === "string"
      ? error.step
      : fallbackStep;

  const code =
    isResult(error) && typeof error.code === "string" ? error.code : "unknown";

  return { step, code };
}

export function mergeDiscoveredAccounts({
  storedAccounts,
  projection,
  createLocalId,
  now,
} = {}) {
  if (!isResult(projection)) {
    return refusal(
      "projection_not_a_result",
      "cTrader account discovery was not given a result to merge, so no account was added."
    );
  }

  if (projection.ok !== true) {
    const reason =
      typeof projection.code === "string" ? projection.code : "no code";

    return refusal(
      "projection_refused",
      `cTrader account discovery refused to project a candidate (${reason}), so no account was added.`
    );
  }

  if (projection.code !== "discovery_projected") {
    return refusal(
      "projection_not_projected",
      `cTrader account discovery answered ${String(projection.code)}, which is not a projected candidate list, so no account was added.`
    );
  }

  if (!Array.isArray(projection.accounts)) {
    return refusal(
      "projection_accounts_not_a_list",
      "The cTrader account discovery result carries no list of candidates, so no account was added."
    );
  }

  for (const key of PROJECTION_LIST_KEYS) {
    if (!Array.isArray(projection[key])) {
      return refusal(
        "projection_lists_missing",
        `The cTrader account discovery result has no ${key} list, so the merge could not check it against the candidates and no account was added.`
      );
    }
  }

  if (projection.rejected.length > 0) {
    return refusal(
      "projection_incomplete",
      `The cTrader account discovery named ${projection.rejected.length} row(s) it could not account for, so the response was not treated as complete and no account was added.`
    );
  }

  if (!Array.isArray(storedAccounts)) {
    return refusal(
      "stored_accounts_not_a_list",
      "The saved cTrader accounts were not a list, so discovery could not be merged into them and no account was added."
    );
  }

  const storedKeys = [];

  for (const row of storedAccounts) {
    const key = unusableRecord(row)
      ? null
      : normalizeAccountKey(row.accountId);

    if (key === null) {
      return refusal(
        "stored_account_unusable",
        "A saved cTrader account carries no usable account id, so discovery was not merged into it and no account was added."
      );
    }

    storedKeys.push(key);
  }

  if (new Set(storedKeys).size !== storedKeys.length) {
    return refusal(
      "ambiguous_stored_accounts",
      "The saved cTrader accounts name the same account more than once, so discovery was not merged into them and no account was added."
    );
  }

  const storedSet = new Set(storedKeys);
  const candidateKeys = [];

  for (const candidate of projection.accounts) {
    if (unusableRecord(candidate)) {
      return refusal(
        "candidate_not_an_object",
        "The cTrader account discovery handed back a candidate that is not a record, so no account was added."
      );
    }

    const key = normalizeAccountKey(candidate.accountId);

    if (key === null) {
      return refusal(
        "candidate_account_id_unusable",
        "The cTrader account discovery handed back a candidate with no usable account id, so no account was added."
      );
    }

    candidateKeys.push(key);
  }

  if (new Set(candidateKeys).size !== candidateKeys.length) {
    return refusal(
      "ambiguous_candidate_accounts",
      "The cTrader account discovery names the same account twice in its candidates, so no account was added."
    );
  }

  const candidateSet = new Set(candidateKeys);
  const expectedNewIds = candidateKeys.filter((key) => !storedSet.has(key));
  const expectedMatchedIds = candidateKeys.filter((key) => storedSet.has(key));
  const expectedPreservedIds = storedKeys.filter((key) => !candidateSet.has(key));

  /* The records and the lists that describe them are one answer. A result
     where they disagree cannot be told apart from one assembled out of two
     discoveries, and the merge has no way to choose a half to believe. */
  if (
    !sameIds(projection.discoveredAccountIds, candidateKeys) ||
    !sameIds(projection.newAccountIds, expectedNewIds) ||
    !sameIds(projection.matchedAccountIds, expectedMatchedIds) ||
    !sameIds(projection.preservedAccountIds, expectedPreservedIds)
  ) {
    return refusal(
      "projection_inconsistent",
      "The cTrader account discovery result describes candidates that its own records do not match, so no account was added."
    );
  }

  if (expectedNewIds.length > 0 && typeof createLocalId !== "function") {
    return refusal(
      "local_id_source_missing",
      "cTrader account discovery found accounts that are not saved yet, and no source for their local ids was given, so no account was added."
    );
  }

  if (expectedNewIds.length > 0 && typeof now !== "function") {
    return refusal(
      "clock_source_missing",
      "cTrader account discovery found accounts that are not saved yet, and no source for their creation timestamps was given, so no account was added."
    );
  }

  const accounts = storedAccounts.map((row) => ({ ...row }));

  for (const key of expectedNewIds) {
    accounts.push({
      id: createLocalId(key),
      accountId: key,
      name: DEFAULT_ACCOUNT_NAME,
      createdAt: now(),
    });
  }

  return result({
    ok: true,
    code: "accounts_merged",
    message: `cTrader account discovery added ${expectedNewIds.length} new account(s) and kept ${accounts.length - expectedNewIds.length} saved account(s); the account selection was not changed.`,
    accounts,
    addedAccountIds: expectedNewIds,
    preservedAccountIds: expectedPreservedIds,
  });
}

export function persistDiscoveredAccounts({
  store,
  discoveredAccounts,
  createLocalId,
  now,
} = {}) {
  if (
    !isResult(store) ||
    typeof store.load !== "function" ||
    typeof store.save !== "function"
  ) {
    return refusal(
      "store_not_usable",
      "No usable cTrader account store was given, so discovery could not be saved."
    );
  }

  let state;

  try {
    state = store.load();
  } catch (error) {
    const { step, code } = failureReason(error, "read");

    return refusal(
      "store_read_failed",
      `The saved cTrader state could not be read (${step}: ${code}), so discovery was not saved.`
    );
  }

  /* A file that is not there yet is a different answer from a file that
     cannot be understood: the first may be created by the ordinary auth
     path, the second must never be overwritten by discovery. */
  if (state === null || state === undefined) {
    return refusal(
      "no_stored_state",
      "There is no saved cTrader state to add discovered accounts to, so nothing was written."
    );
  }

  if (!isResult(state)) {
    return refusal(
      "stored_state_unusable",
      "The saved cTrader state is not a record, so discovery refused to write over it."
    );
  }

  const projection = projectCtraderDiscovery({
    discoveredAccounts,
    storedAccounts: state.accounts,
    createLocalId,
  });

  const merged = mergeDiscoveredAccounts({
    storedAccounts: state.accounts,
    projection,
    createLocalId,
    now,
  });

  if (!merged.ok) {
    return merged;
  }

  const nextState = { ...state, accounts: merged.accounts };

  try {
    store.save(nextState);
  } catch (error) {
    const { step, code } = failureReason(error, "write");

    return refusal(
      "store_write_failed",
      `The saved cTrader state could not be written (${step}: ${code}), so the discovered accounts were not saved.`
    );
  }

  return result({
    ok: true,
    code: "accounts_persisted",
    message: `cTrader account discovery saved ${merged.addedAccountIds.length} new account(s); the account selection was not changed.`,
    accounts: merged.accounts,
    addedAccountIds: merged.addedAccountIds,
    preservedAccountIds: merged.preservedAccountIds,
  });
}
