import fs from "fs";

import { AUTH_FILE, ACCOUNTS_FILE } from "../runtimePaths.js";

import { createCtraderStore } from "./ctraderStore.js";

/* ============================================================
   THE TWO SCOPED STORES

   One artifact used to hold everything: the token, its refresh
   partner, the expiry, the accounts that token was handed and which
   of them was active. Task 2.1-d splits that into two files, and this
   module is the pair of entrances the route will use once the split is
   migrated. Each one is a thin projection in front of the same engine:

     - `createCtraderAuthStore` may read and write nothing but
       `connected`, `accessToken`, `refreshToken` and `expiresIn`;
     - `createCtraderAccountsStore` may read and write nothing but
       `accounts` and `activeAccountId`.

   The projection is on the way out as well as on the way in, and that
   is the whole safety of the split: a caller who hands the credential
   store a complete session, account records and all, gets a file that
   holds the four credential keys and nothing else, because the keys
   that do not belong to the domain are never copied into the object
   that gets serialized. The same holds in the other direction. No
   store can persist what it was not given a shape for, so a bug in a
   caller cannot leak a token into a file that account readers open.

   ATOMICITY IS DELEGATED, NOT REPEATED. Every write and every removal
   goes through `createCtraderStore`, the module Task 2.1-c hardened:
   serialize first, then a uniquely named temporary file beside the
   destination opened `wx`, then the bytes written in full, flushed and
   closed, then one rename over the destination. A refused rename
   therefore still leaves the previous file byte-for-byte, the
   temporary file is removed, and the failure is raised as an Error
   carrying the `operation`, the `step` and the filesystem `code` while
   quoting no path, because a filesystem message repeats the path it
   was asked to use and these stores' callers put error text into HTTP
   bodies. Nothing here creates a directory, and constructing a store
   performs no I/O at all.

   READS STAY TOLERANT, AND STAY DUMB. A missing file, an unreadable
   file and a file that holds no object are all reported as `null`, the
   way the combined store has always reported them, so a corrupt file
   cannot stop the backend from booting. Past that, the accounts store
   deliberately knows nothing about selection: it hands back the
   account list as stored (minus records with no account id, which are
   not usable by anyone) and the selection exactly as stored, including
   a dangling one. It invents no local id and no creation timestamp,
   because Task 2.1-c proved that inventing them makes a torn file look
   legitimate. Deciding what a selection means stays with the pure
   selection rule the combined store already uses; moving that decision
   into a store is a different task, and a store that quietly repaired
   a selection would make the two files disagree with no one noticing.

   WHAT IS NOT MIGRATED HERE. `createCtraderStore` still reads and
   writes the combined artifact and still applies the legacy
   single-account import; since Phase 2.1-e Task 4 it selects only
   what the file stored as `activeAccountId`, so nothing it returns
   invents an account. `routes/ctrader.js` still uses it unchanged.
   These two stores are built and tested beside that, so the migration
   task can switch the route over without discovering the storage
   rules by accident.
   ============================================================ */

// A store reads an object or nothing. A scalar or a list is not a
// state, and guessing from one would invent keys nobody wrote.
function readObject(fileSystem, filePath, project) {
  try {
    if (!fileSystem.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fileSystem.readFileSync(filePath, "utf8"));

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return project(parsed);
  } catch (error) {
    // The message is dropped: an absolute path is what a filesystem
    // error carries, and it must not reach a log the operator shares.
    console.error("❌ Failed to read a scoped cTrader store:", error.name);

    return null;
  }
}

// A record with no account id cannot be addressed, so it cannot be
// used by a reader. Everything else is kept exactly as stored.
function isUsableAccount(account) {
  return (
    account !== null &&
    typeof account === "object" &&
    account.accountId !== undefined &&
    account.accountId !== null &&
    String(account.accountId).trim() !== ""
  );
}

// ============================================================
// CREDENTIALS ONLY
// ============================================================

export function createCtraderAuthStore(options = {}) {
  const { filePath = AUTH_FILE, fileSystem = fs } = options;

  const engine = createCtraderStore({ filePath, fileSystem });

  function project(state) {
    return {
      connected: Boolean(state.connected),
      accessToken: state.accessToken || null,
      refreshToken: state.refreshToken || null,
      expiresIn: state.expiresIn || null,
    };
  }

  function load() {
    return readObject(fileSystem, filePath, project);
  }

  function save(state = {}) {
    engine.save(project(state));
  }

  return { filePath, load, save, clear: engine.clear };
}

// ============================================================
// ACCOUNT METADATA ONLY
// ============================================================

export function createCtraderAccountsStore(options = {}) {
  const { filePath = ACCOUNTS_FILE, fileSystem = fs } = options;

  const engine = createCtraderStore({ filePath, fileSystem, logger: options.logger });

  function project(state) {
    return {
      accounts: Array.isArray(state.accounts) ? state.accounts : [],
      activeAccountId: state.activeAccountId ?? null,
    };
  }

  function load() {
    return readObject(fileSystem, filePath, (state) => {
      const stored = project(state);

      return {
        accounts: stored.accounts.filter(isUsableAccount),
        activeAccountId: stored.activeAccountId,
      };
    });
  }

  function save(state = {}) {
    engine.save(project(state));
  }

  return { filePath, load, save, clear: engine.clear };
}
