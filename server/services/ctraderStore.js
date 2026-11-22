import fs from "fs";

// Declared rather than assumed: the temporary file name uses the
// process id, and this module reads no other global.
import process from "node:process";

import { normalizeAccountKey, selectAccountById } from "./ctraderAccountSelection.js";

import { AUTH_FILE } from "../runtimePaths.js";

/* ============================================================
   THE cTRADER PERSISTENCE STORE

   Everything the backend keeps about a cTrader session lives in one
   JSON file: the access token, the refresh token, the expiry, the
   accounts that token was handed, and which of them is active. The
   route that used to own this file also owned an HTTP server, an
   OAuth callback and a trading socket, so the only way to look at
   the storage rules was to import all of them.

   This module is that seam. It holds the file path, reads it into a
   state object, writes a state object back and deletes the file. It
   starts no socket, binds no port, reads no environment and imports
   no route, which is what lets a test hand it a temporary directory
   and nothing else.

   A WRITE IS EITHER THE WHOLE STATE OR THE FILE IT REPLACED. The
   saved session used to be written straight over the destination,
   which truncates first and fills in afterwards: an interrupted
   write left a half-written file, and the loader reads that as
   "nothing was saved", silently logging the user out of a broker
   they were connected to. A write now goes through a temporary file
   in the destination's own directory and is moved over the
   destination in one rename, so any interruption leaves the previous
   file byte-for-byte as it was.

   WHAT THAT DOES AND DOES NOT GUARANTEE. The temporary file is
   flushed and its handle closed before the replacement, so the new
   bytes are on the device when the rename is asked for. The rename
   becomes the platform's file move; on Windows that is
   `MoveFileExW` with replacement allowed, and because the temporary
   file sits beside the destination the move stays inside one volume,
   which is what keeps it a rename rather than a copy. A reader that
   already holds the destination open, or a destination the operating
   system has locked, makes the rename fail, and that failure is
   reported instead of worked around. No directory entry is flushed,
   because Windows offers no way to do that; a power loss in the
   instant after a successful rename can therefore still leave the
   old file in place. That is the whole of the promise.

   FAILURES ARE RAISED, NOT LOGGED. `save` and `clear` throw a
   wrapped Error carrying the `operation`, the `step` that refused
   and the filesystem `code`, so a caller cannot mistake a write that
   never happened for one that did. The message deliberately quotes
   none of the original error text: a filesystem message repeats the
   full path, and this file's path is not something a route handler
   or a log line should be putting on the wire. `load` keeps the
   tolerance it has always had — a corrupt file must not stop the
   backend from booting — which is why a read failure is still
   reported as `null` rather than raised.

   MISSING PARENT DIRECTORY: REPORTED, NEVER CREATED. If the
   directory beside the destination is gone, `save` fails with
   `ENOENT` and says so. Creating it would invent a store location
   nobody chose; the same decision predates this file and is kept.

   WHAT ELSE IS DELIBERATELY UNCHANGED. Secrets still sit beside
   account metadata in one artifact, unknown fields are dropped on
   load, and a legacy top-level accountId is still imported as a
   saved record — reading history is not the same as selecting it.
   `routes/ctraderStoreCharacterization.test.js` pins each of those;
   every one of them has its own task later in this phase.

   WHICH ACCOUNT IS ACTIVE IS NOW A CHOICE, NOT A GUESS. The default
   policy is `"strict-explicit"`, and every current caller gets it
   without asking anything: the stored `activeAccountId` is the only
   thing that can make an account active, it has to name a record that
   really is saved, and anything else — no key, a null, a blank, a
   value that is not an id, an id that names nothing — loads
   unselected. The two inferences this replaced, a sole saved account
   and the legacy top-level id, were removed by Phase 2.1-e Task 4
   together with the policy name that carried them, so a call site
   that still asks for that mode fails when the store is built instead
   of quietly trading the wrong account.

   The option named `"preserve-explicit"` is what the copy-only
   migration asks for: it reports the value the file stored as the
   active account, or nothing when the file stored no value, and it
   repairs nothing on the caller's behalf — a dangling id is copied as
   the id it is, because a copy has to be able to write what the old
   file said. Record normalization, the credential fields and the
   bytes on disk are identical under either name; only that one value
   differs. An option that is neither name is refused when the store
   is built, because a caller that misspelled the policy would
   otherwise be handed the very behaviour it came here to avoid.

   The one behavioural difference from the old inline code that
   predates this task is deliberate and is the reason for the seam:
   `load()` returns the state it read, or `null` when the file held
   nothing readable. Before, the same paths left the caller's
   variable untouched.
   ============================================================ */

// ============================================================
// NORMALIZE SAVED ACCOUNT
// ============================================================

function normalizeAccount(account) {
  return {
    id:
      account.id ||
      `account-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    accountId: String(account.accountId).trim(),

    name: account.name || "Trading Account",

    createdAt:
      account.createdAt || new Date().toISOString(),
  };
}

// ============================================================
// WHICH ACCOUNT IS ACTIVE
// ============================================================

/* How a saved file decides which account is active is a choice the
   caller makes, not a preference this module guesses. A value outside
   the two names below is a mistake in a call site, and saying so at
   construction is the only moment left before a migration would start
   trusting a mode it never got. */
function declaredSelectionPolicy(options) {
  const value = options.selectionPolicy;

  if (value === undefined) {
    return "strict-explicit";
  }

  if (value === "strict-explicit" || value === "preserve-explicit") {
    return value;
  }

  const shown = typeof value === "string" ? value : typeof value;

  /* The refused value comes back in the message because a misspelled
     policy is the exact mistake this guards, and naming only the two
     correct ones would not tell the caller what it was holding. No
     filesystem path and no token material belongs in a message this
     module's callers can put on an HTTP body. */
  throw new TypeError(
    `${shown}, not a cTrader selection policy. Use "strict-explicit" or "preserve-explicit".`
  );
}

/* THE STORED FACT, READ AS IT WAS LEFT. Only the stored key is
   consulted, and only when it is a value: an absent key and a blank
   string both mean the file selected nothing, so neither is turned
   into a selection. Everything else is returned exactly as stored,
   including an id that matches no saved record. This branch asks
   nothing of the account list, which is the whole point. */
function explicitSelection(parsed) {
  const stored = parsed.activeAccountId;

  if (stored === undefined || stored === null) {
    return null;
  }

  if (typeof stored === "string" && stored.trim() === "") {
    return null;
  }

  return stored;
}

/* WHAT THE PROCESS TREATS AS ACTIVE, AND NOTHING ELSE. The stored
   `activeAccountId` is the whole of the evidence. A file that stored
   no value, a blank, or a value that cannot be an account id selects
   nothing and this says so quietly, because "nobody chose yet" is not
   a mistake to report. A value that names no saved record IS a
   mistake — the file claims an active account the process cannot
   trade — so that refusal is announced and answered with no
   selection rather than with the nearest account.

   Nothing here picks an account. The list is only what the stored id
   is checked against, and the shared rule owns that check, so the
   loader that reads this file, the route that trades with it and the
   UI that shows it all answer the question the same way. This is the
   behaviour every runtime caller has had since Phase 2.1-e Task 4
   removed the inference that used to be the default here. */
function strictSelection(parsed, accounts) {
  const accountIds = accounts.map((account) => account.accountId);
  const requested = normalizeAccountKey(parsed.activeAccountId);

  if (requested === null) {
    return null;
  }

  const storedSelection = selectAccountById({
    accountIds,
    requestedAccountId: requested,
  });

  if (!storedSelection.ok) {
    console.warn(
      `🚫 cTrader stored account: ${storedSelection.message}`
    );
  }

  return storedSelection.ok
    ? storedSelection.accountId
    : null;
}

// ============================================================
// READ A STORE FILE INTO STATE
// ============================================================

export function createCtraderStore(options = {}) {
  const { filePath = AUTH_FILE, fileSystem = fs } = options;

  /* Read beside the injection point, never inside it: the shared path
     guard rewrites that statement whole to prove the default cannot
     drift, so the policy has its own statement. */
  const selectionPolicy = declaredSelectionPolicy(options);
  const logger = options.logger ?? console;

  /* A failure to persist is reported as this: which operation was
     asked for, which step of it refused, and the filesystem code.
     The original message is dropped on purpose, because a filesystem
     message repeats the path the operation was asked to use, and this
     module's callers put error messages into HTTP bodies. */
  function persistenceError(operation, step, cause) {
    const error = new Error(
      `cTrader auth could not be ${
        operation === "clear" ? "removed" : "written"
      } (${step})`
    );

    error.operation = operation;
    error.step = step;
    error.code = cause.code || cause.name || null;

    return error;
  }

  function run(step, operation, perform) {
    try {
      return perform();
    } catch (error) {
      throw persistenceError(operation, step, error);
    }
  }

  /* A name of its own every time, so two saves cannot be handed the
     same temporary file. The name is derived from the destination
     rather than spelled out, which also keeps the temporary file in
     the destination's directory — the same volume, so replacing the
     destination is a move and not a copy. */
  function temporaryPath() {
    return `${filePath}.tmp-${process.pid}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function writeAll(handle, serialized) {
    const bytes = new TextEncoder().encode(serialized);

    let written = 0;

    // A single write call is not promised the whole buffer; a partial
    // write that was treated as complete would put half a state file
    // in front of the rename.
    while (written < bytes.length) {
      written += fileSystem.writeSync(
        handle,
        bytes,
        written,
        bytes.length - written
      );
    }
  }

  function removeQuietly(tempPath) {
    if (!fileSystem.existsSync(tempPath)) {
      return null;
    }

    try {
      fileSystem.unlinkSync(tempPath);

      return null;
    } catch (error) {
      return error;
    }
  }

  function load() {
    try {
      if (!fileSystem.existsSync(filePath)) {
        logger.log("ℹ️ No saved cTrader authentication found.");
        return null;
      }

      const savedData = fileSystem.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(savedData);

      let accounts = [];

      // Multi-account format
      if (Array.isArray(parsed.accounts)) {
        accounts = parsed.accounts
          .filter(
            (account) =>
              account &&
              account.accountId !== undefined &&
              account.accountId !== null &&
              String(account.accountId).trim() !== ""
          )
          .map(normalizeAccount);
      }

      // Backward compatibility with old single-account format
      if (
        accounts.length === 0 &&
        parsed.accountId !== undefined &&
        parsed.accountId !== null &&
        String(parsed.accountId).trim() !== ""
      ) {
        accounts.push(
          normalizeAccount({
            accountId: parsed.accountId,
            name: "Imported Trading Account",
            createdAt: new Date().toISOString(),
          })
        );

        logger.log(
          "🔄 Migrated old single account to multi-account system."
        );
      }

      const activeAccountId =
        selectionPolicy === "preserve-explicit"
          ? explicitSelection(parsed)
          : strictSelection(parsed, accounts);

      const state = {
        connected: Boolean(parsed.connected),
        accessToken: parsed.accessToken || null,
        refreshToken: parsed.refreshToken || null,
        expiresIn: parsed.expiresIn || null,
        accounts,
        activeAccountId,
      };

      logger.log("");
      logger.log("====================================");
      logger.log("✅ SAVED cTRADER AUTH LOADED");
      logger.log("====================================");

      logger.log({
        connected: state.connected,
        hasAccessToken: Boolean(state.accessToken),
        hasRefreshToken: Boolean(state.refreshToken),
        savedAccounts: state.accounts.length,
        activeAccountId: state.activeAccountId,
      });

      logger.log("====================================");

      return state;
    } catch (error) {
      logger.error(
        "❌ Failed to load saved cTrader auth:",
        error.message
      );

      return null;
    }
  }

  // ============================================================
  // WRITE STATE BACK
  // ============================================================

  function save(state) {
    /* The complete state is serialized before anything is opened: a
       value that cannot be represented would otherwise be discovered
       after the temporary file existed, or half-written into it. */
    const serialized = run(
      "serialize",
      "save",
      () => JSON.stringify(state, null, 2)
    );

    const tempPath = temporaryPath();

    try {
      const handle = run(
        "open",
        "save",
        () => fileSystem.openSync(tempPath, "wx")
      );

      let closeError = null;

      try {
        run("write", "save", () => writeAll(handle, serialized));
        run("flush", "save", () => fileSystem.fsyncSync(handle));
      } finally {
        try {
          fileSystem.closeSync(handle);
        } catch (error) {
          closeError = error;
        }
      }

      /* The handle is gone either way. Only a close that failed while
         nothing else had is the failure worth reporting: when the
         write or the flush failed, that error is already propagating
         out of the block above and this line is never reached. */
      if (closeError !== null) {
        throw persistenceError("save", "close", closeError);
      }

      /* The destination is replaced in one move. Until this line it
         has not been opened, written or shortened. */
      run("rename", "save", () =>
        fileSystem.renameSync(tempPath, filePath)
      );
    } catch (error) {
      const cleanupError = removeQuietly(tempPath);

      if (cleanupError !== null) {
        logger.error(
          `⚠️ A temporary cTrader auth file was left behind (${
            cleanupError.code || cleanupError.name
          }); it holds no complete state.`
        );
      }

      throw error;
    }

    logger.log("💾 cTrader auth saved locally.");
  }

  // ============================================================
  // DELETE THE PERSISTED STATE
  // ============================================================

  function clear() {
    // A store that is already gone is the outcome the caller wanted,
    // which is what the route has always logged either way.
    if (fileSystem.existsSync(filePath)) {
      run("unlink", "clear", () => fileSystem.unlinkSync(filePath));
    }

    logger.log("🗑️ Saved cTrader auth removed.");
  }

  return { filePath, load, save, clear };
}
