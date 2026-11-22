/* ============================================================
   THE MIGRATION PROJECTION

   One artifact has held the whole cTrader session: the token, its
   refresh partner, the expiry, the accounts that token was handed and
   which of them was active. Task 2.1-d splits that into two files, and
   this module is the one agreed answer to "what goes where".

   It is a projection, not a migration. It reads no disk, opens no
   socket, reads no configuration, starts no clock, draws no random
   number, writes nothing down and remembers nothing between calls — it
   imports nothing at all, which is what makes that claim checkable
   rather than a comment. A migration can therefore ask what it *would*
   write, and get the same bytes back every time, before it writes
   anything.

   THE ONE PIPELINE IT IS MEANT FOR is the combined loader's output:
   `createCtraderStore().load()` normalizes a stored state — it imports
   a legacy top-level accountId as a record, generates the local id and
   defaults a record lacks, trims and stringifies identifiers, and
   applies the selection rule — and this function then splits that
   already-normalized state. Every legacy behaviour stays where it is,
   which is why the projection itself adds and changes nothing:

     - it invents no identifier, name or timestamp; a record that comes
       in without them goes out without them, and a caller can see that
       it did;
     - it rewrites no identifier; a value is copied as stored, so a
       number stays a number and padding stays padding. A second place
       that normalizes is a second place that can disagree with the
       loader;
     - it selects nothing. The stored selection is preserved exactly,
       including null, an empty string, and an id naming no saved
       account. Repairing a selection here would put a choice in the
       new files that the old file never recorded;
     - it reads nothing beyond the six keys the combined format knows,
       and a record keeps nothing beyond the four metadata fields the
       loader has always written. That allow-list is also the leak
       guard: a credential a caller had misplaced inside a record stops
       being a credential the moment it is copied, so it cannot ride
       into the file that account readers open;
     - the pre-multi-account top-level accountId is not consulted at
       all. Treating it as a record, or as a selection, belongs to the
       loader, which already does it. A projection that did it again
       would migrate one legacy file twice.

   A value that was never stored comes back as `null`, and `connected`
   comes back as a real boolean — the only coercion here, and the one
   the loader itself performs. Anything else that was stored, including
   an empty token or an expiry of zero, is copied exactly.

   A state that is not a state is refused with a TypeError that names
   only the kind. "There is nothing to migrate" and "migrate the empty
   pair" are different claims, and a caller has to be able to tell them
   apart. The value itself is never quoted: a legacy state holds a
   credential, and a refusal message can end up in a log or a response
   body.
   ============================================================ */

// The four fields the combined format has always written for a saved
// account. Nothing else is copied out of a record, and that is the
// whole reason a misplaced credential cannot reach an account reader.
const ACCOUNT_METADATA_KEYS = ["id", "accountId", "name", "createdAt"];

// A key that was never stored is reported as `null` rather than left
// out, so a caller always gets the full shape of the domain it asked
// for. A key that was stored is returned untouched.
function storedValue(state, key) {
  return state[key] === undefined ? null : state[key];
}

// A record has to be an object carrying an account identifier that is
// not blank: nothing else can be addressed by a later caller. The blank
// test compares, which is why the identifier it judges is still copied
// exactly afterwards.
function usableAccount(row) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    return false;
  }

  const accountId = row.accountId;

  if (accountId === undefined || accountId === null) {
    return false;
  }

  return typeof accountId !== "string" || accountId.trim() !== "";
}

// A copy, key by key, with no value transformed and no key added.
function projectAccount(row) {
  const record = {};

  for (const key of ACCOUNT_METADATA_KEYS) {
    if (row[key] !== undefined) {
      record[key] = row[key];
    }
  }

  return record;
}

export function projectLegacyState(legacyState) {
  const kind = Array.isArray(legacyState)
    ? "array"
    : legacyState === null
      ? "null"
      : typeof legacyState;

  if (kind !== "object") {
    throw new TypeError(
      `a cTrader migration projection needs a stored state object, got ${kind}`
    );
  }

  const stored = Array.isArray(legacyState.accounts)
    ? legacyState.accounts
    : [];

  return {
    auth: {
      connected: Boolean(legacyState.connected),
      accessToken: storedValue(legacyState, "accessToken"),
      refreshToken: storedValue(legacyState, "refreshToken"),
      expiresIn: storedValue(legacyState, "expiresIn"),
    },
    accounts: {
      accounts: stored.filter(usableAccount).map(projectAccount),
      activeAccountId: storedValue(legacyState, "activeAccountId"),
    },
  };
}
