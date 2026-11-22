import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AUTH_FILE } from "../runtimePaths.js";

import { createCtraderStore } from "./ctraderStore.js";

/* ============================================================
   THE SELECTION POLICY

   `createCtraderStore()` answers two different questions with one
   function: what did the file hold, and which account should the
   process treat as active. Those questions used to get the same
   answer, because the loader repaired it on the way out — a sole
   saved account was selected though nobody selected it, a legacy
   top-level id was honored as a selection beside a full account list,
   and an id naming no saved account was quietly dropped. Task 4A
   showed those repairs make the loaded state unusable as the input to
   a copy: a migration that wrote what `load()` returned would put a
   selection into the new accounts file that the old file never
   recorded.

   This suite holds the two answers that are left.

     - `"strict-explicit"` is what every runtime caller gets without
       asking. The stored `activeAccountId` is the only thing that can
       make an account active, it has to name a record that is really
       saved, and anything else — absent, null, blank, unusable,
       dangling — loads unselected. Phase 2.1-e Task 4 replaced the
       inference that used to be the default here; the tests below
       that say so are the feature.
     - `"preserve-explicit"` is what the copy-only migration asks for.
       It reports the value the file stored, or nothing when the file
       stored no value, and it repairs nothing on the caller's behalf.

   The policy changes exactly one output — `activeAccountId`. It does
   not add an operation, it does not widen the returned state, it does
   not change how a record is normalized, and it does not touch the
   bytes on disk.

   WHAT `preserve-explicit` PROMISES, AND WHERE THAT STOPS.

     - a stored selection is copied verbatim. A number stays a number
       and padding stays padding, because a second place that
       normalizes is a second place that can disagree with the loader;
     - a selection naming no saved account is reported as that same id,
       not as `null` and not as another account. It is a stored fact,
       and deciding what it means belongs to the caller holding both
       files;
     - an absent selection stays absent. One saved account is not a
       selection, the first record is not a selection, and the legacy
       top-level id is not a selection either. The import of a legacy
       record itself still happens, because that is normalization;
     - a value that was never stored, or one that is blank, is `null`.
       That is a presence test, not a rewrite: the value that survives
       it is copied untouched;
     - a preserved selection is not announced as a refusal. The
       warning line exists because a loader tried to decide something
       and could not; this policy decides nothing, so it has nothing
       to report. The migration reading this mode is the caller with
       the context to say what a dangling id means, and that reporting
       belongs there.

   WHAT IS NOT TESTED HERE. No projection, no second file and no
   route: the copy path is pinned by the migration suites, and the
   startup path by this suite's default-policy tests plus the route
   characterization. Every store here is pointed at its own temporary
   directory and every value inside it is invented for the test, so
   the repository's production store is never a candidate for I/O.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

const SELF_SOURCE = fs
  .readFileSync(
    path.join(HERE, "ctraderStoreSelectionPolicy.test.js"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

const STORE_SOURCE = fs
  .readFileSync(path.join(HERE, "ctraderStore.js"), "utf8")
  .replace(/\r\n/g, "\n");

const STRICT = "strict-explicit";
const PRESERVE = "preserve-explicit";

const ACCESS_TOKEN = "synthetic-access-token-fixture-4001";
const REFRESH_TOKEN = "synthetic-refresh-token-fixture-4002";
const EXPIRES_IN = 86400;
const ACCOUNT_ID = "70000001";

const STORE_KEYS = [
  "connected",
  "accessToken",
  "refreshToken",
  "expiresIn",
  "accounts",
  "activeAccountId",
];

/* Every path this suite built a store for, checked at the end: that is
   what makes "no store in this suite could have reached the production
   file" a fact rather than an intention. */
const BUILT = [];
const CREATED = [];

function tempFilePath(name = "case-store.json") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-policy-"));

  CREATED.push(dir);

  return path.join(dir, name);
}

function completeAccount(externalId, overrides = {}) {
  return {
    id: `account-stored-${externalId}`,
    accountId: externalId,
    name: `IC Markets ${externalId}`,
    createdAt: "2026-03-04T05:06:07.000Z",
    ...overrides,
  };
}

// The six keys exactly as a saved session holds them.
function storedState(overrides = {}) {
  return {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [completeAccount(ACCOUNT_ID)],
    activeAccountId: ACCOUNT_ID,
    ...overrides,
  };
}

// A state deleted down to the keys a format really lacks. A fixture
// that writes `key: undefined` would still be a fixture that stored
// the key, so the absence is verified rather than assumed.
function without(contents, ...keys) {
  const copy = { ...contents };

  for (const key of keys) {
    delete copy[key];
  }

  return copy;
}

/* A store written to disk, so the loader is the only thing that reads
   it back: a state handed to a function is not a state stored. */
function storeFile(contents) {
  const filePath = tempFilePath();
  const serialized =
    typeof contents === "string"
      ? contents
      : JSON.stringify(contents, null, 2);

  fs.writeFileSync(filePath, serialized, "utf8");

  return filePath;
}

/* Build a store and load it, with the logging the loader has always
   done turned into a value. `policy` is passed through as a key only
   when it is given, so a test can distinguish an omitted option from
   an explicit one. */
function loaded(filePath, policy) {
  const options = { filePath };

  if (policy !== undefined) {
    options.selectionPolicy = policy;
  }

  const store = createCtraderStore(options);

  BUILT.push(store.filePath);

  const { result, lines } = quiet(() => store.load());

  return { result, lines, store };
}

const realConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function toLine(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function quiet(fn) {
  const lines = [];
  const capture = (...args) => {
    lines.push(args.map(toLine).join(" "));
  };

  Object.assign(console, {
    log: capture,
    info: capture,
    warn: capture,
    error: capture,
  });

  try {
    return { result: fn(), lines };
  } finally {
    Object.assign(console, realConsole);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasLine(lines, marker) {
  return lines.some((line) => line.includes(marker));
}

/* A store built for a rejected policy must not have opened anything,
   so a refused construction is recorded through an injected file
   system that counts every operation the engine knows. */
const FS_OPERATIONS = [
  "existsSync",
  "readFileSync",
  "openSync",
  "writeSync",
  "fsyncSync",
  "closeSync",
  "renameSync",
  "unlinkSync",
];

function countingFileSystem() {
  const calls = [];

  const fileSystem = {};

  for (const name of FS_OPERATIONS) {
    fileSystem[name] = (...args) => {
      calls.push(name);

      return fs[name](...args);
    };
  }

  fileSystem.mkdirSync = () => {
    throw new Error("a store is not allowed to create a directory");
  };

  return { fileSystem, calls: () => calls.slice() };
}

function captureThrow(fn) {
  let failure = null;

  const { lines } = quiet(() => {
    try {
      fn();
    } catch (error) {
      failure = error;
    }
  });

  return { failure, lines };
}

// Only the module specifiers a file imports are pulled out, so a prose
// mention of another module cannot be mistaken for a dependency. The
// scan is anchored at the start of a line, which is where a real
// statement lives, and it refuses a silent shortfall.
function importSpecifiers(source) {
  const matches = [
    ...source.matchAll(/^import\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm),
  ].map((match) => match[1]);

  const statements = source.match(/^import\b/gm) || [];

  assert.equal(
    matches.length,
    statements.length,
    "an import was not read as a dependency; the guard needs a wider pattern"
  );

  return matches;
}

/* ============================================================
   THE TEXT THE SHARED GUARDS REWRITE

   `runtimePaths.test.js` holds the store's source contract, and its
   mutants are built by replacing exact strings in this module. A
   change here that reflows one of those strings does not break a rule
   — it breaks the *proof*, silently, in a suite this task is not
   allowed to run. So the lines the contract depends on are pinned
   where the run is allowed, and one mutant below is the exact
   temptation they exist to refuse.
   ============================================================ */

const CONTRACT_LINES = [
  // The injection point, verbatim. The policy is read beside this
  // statement, never inside it, because the shared guard matches it
  // whole and rewrites it to prove the default path cannot drift.
  "const { filePath = AUTH_FILE, fileSystem = fs } = options;",
  'const savedData = fileSystem.readFileSync(filePath, "utf8");',
  "fileSystem.renameSync(tempPath, filePath)",
  "fileSystem.unlinkSync(filePath)",
  'fileSystem.openSync(tempPath, "wx")',
  'run("write", "save", () => writeAll(handle, serialized));',
  'run("flush", "save", () => fileSystem.fsyncSync(handle));',
  "const cleanupError = removeQuietly(tempPath);",
  ".tmp-${process.pid}-${Math.random()",
];

/* ============================================================
   THE TWO BRANCHES, READ AS TEXT

   The behaviour tests prove what each policy returns. What they cannot
   prove is the shape of the reason: the copy branch must not reach for
   the selection rule or for the legacy key at all, and the strict
   branch must not choose an account out of the list it is only
   supposed to check against. Otherwise a later edit can reintroduce a
   fallback that no current fixture happens to expose. A rule that
   finds no such branch fails, so the guard cannot be satisfied by
   deleting the thing it watches.
   ============================================================ */

function functionBody(text, name) {
  const signature = `function ${name}(`;
  const start = text.indexOf(signature);

  if (start === -1) {
    return null;
  }

  const opened = text.indexOf("{", start);

  if (opened === -1) {
    return null;
  }

  let depth = 0;

  for (let index = opened; index < text.length; index += 1) {
    if (text[index] === "{") {
      depth += 1;
    } else if (text[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

const BASE_IMPORTS = [
  "../runtimePaths.js",
  "./ctraderAccountSelection.js",
  "fs",
  "node:process",
];

const POLICY_RULES = [
  {
    label: "policy: the copy branch exists to be read",
    passes: (text) => functionBody(text, "explicitSelection") !== null,
  },
  {
    label: "policy: the copy branch asks the selection rule nothing",
    passes: (text) => {
      const body = functionBody(text, "explicitSelection");

      return body !== null && !/selectAccountById\(/.test(body);
    },
  },
  {
    label: "policy: the copy branch never reads the legacy top-level id",
    passes: (text) => {
      const body = functionBody(text, "explicitSelection");

      return body !== null && !/parsed\.accountId\b/.test(body);
    },
  },
  {
    label: "policy: the strict branch asks the shared rule what it may honor",
    passes: (text) => {
      const body = functionBody(text, "strictSelection");

      return body !== null && /selectAccountById\(/.test(body);
    },
  },
  {
    label: "policy: the strict branch never reads the legacy top-level id",
    passes: (text) => {
      const body = functionBody(text, "strictSelection");

      return body !== null && !/parsed\.accountId\b/.test(body);
    },
  },
  {
    label: "policy: the strict branch chooses nothing out of the account list",
    passes: (text) => {
      const body = functionBody(text, "strictSelection");

      return (
        body !== null &&
        !/accounts\s*\[\s*0\s*\]/.test(body) &&
        !/\.length\s*===\s*1/.test(body)
      );
    },
  },
  {
    label: "policy: the strict branch is taken in exactly one place",
    passes: (text) => (text.match(/strictSelection\(/g) || []).length === 2,
  },
  {
    label: "policy: the copy branch is taken in exactly one place",
    passes: (text) =>
      (text.match(/explicitSelection\(/g) || []).length === 2,
  },
  {
    label: "policy: the retired inference mode is not an accepted name",
    passes: (text) =>
      /(?:===|!==|return|case)\s*["']legacy["']/.test(text) === false,
  },
  {
    label: "policy: a refused option is raised, not logged and carried on",
    passes: (text) => /throw new TypeError\(/.test(text),
  },
  {
    label: "policy: the option adds no dependency to the module",
    passes: (text) => importSpecifiers(text).sort().join("|") === BASE_IMPORTS.join("|"),
  },
  {
    label: "policy: no prose line is mistaken for an import by the shared guard",
    passes: (text) =>
      [...text.matchAll(/\bfrom\s*["']([^"']+)["']/g)]
        .map(([, specifier]) => specifier)
        .sort()
        .join("|") === BASE_IMPORTS.join("|"),
  },
  {
    label: "policy: the store still performs no asynchronous work",
    passes: (text) =>
      [
        /\basync\b/,
        /\bawait\b/,
        /\.then\(/,
        /queueMicrotask/,
        /setTimeout/,
        /setImmediate/,
        /createWriteStream/,
        /fs\/promises/,
      ].every((forbidden) => forbidden.test(text) === false),
  },
  {
    label: "policy: every line a shared guard rewrites is still there verbatim",
    passes: (text) => CONTRACT_LINES.every((line) => text.includes(line)),
  },
  {
    label: "policy: the selection rule is still imported, so the repairs did not move",
    passes: (text) =>
      /function selectAccountById\(/.test(
        fs.readFileSync(path.join(HERE, "ctraderAccountSelection.js"), "utf8")
      ) && /"\.\/ctraderAccountSelection\.js"/.test(text),
  },
];

function failuresFor(rules, text) {
  return rules
    .filter((rule) => rule.passes(text) === false)
    .map((rule) => rule.label);
}

/* Each mutant is a specific edit this feature invites. A rule that has
   never been watched rejecting its own defect is a rule that may be
   passing everything, so every entry names the one rule that must
   refuse it. */
function mutants() {
  const copy = functionBody(STORE_SOURCE, "explicitSelection");
  const strict = functionBody(STORE_SOURCE, "strictSelection");

  const rewrite = (body, replacement) =>
    body === null ? STORE_SOURCE : STORE_SOURCE.replace(body, replacement);

  return [
    {
      label: "M1 the copy branch rescues itself with the legacy id",
      rule: "policy: the copy branch never reads the legacy top-level id",
      base: STORE_SOURCE,
      source: rewrite(copy, copy === null ? "" : copy.replace("return stored;", "return parsed.accountId;")),
    },
    {
      label: "M2 the copy branch delegates to the selection rule",
      rule: "policy: the copy branch asks the selection rule nothing",
      base: STORE_SOURCE,
      source: rewrite(copy, copy === null ? "" : copy.replace("return stored;", "return selectAccountById({ accountIds: [], requestedAccountId: stored }).accountId;")),
    },
    {
      label: "M3 the strict branch falls back to the legacy top-level id",
      rule: "policy: the strict branch never reads the legacy top-level id",
      base: STORE_SOURCE,
      source: rewrite(
        strict,
        strict === null
          ? ""
          : strict.replace(
              "normalizeAccountKey(parsed.activeAccountId)",
              "normalizeAccountKey(parsed.activeAccountId || parsed.accountId)"
            )
      ),
    },
    {
      label: "M4 the strict branch selects the first saved record",
      rule: "policy: the strict branch chooses nothing out of the account list",
      base: STORE_SOURCE,
      source: rewrite(
        strict,
        strict === null
          ? ""
          : strict.replace(
              "requestedAccountId: requested,",
              "requestedAccountId: requested ?? accounts[0]?.accountId,"
            )
      ),
    },
    {
      label: "M5 the sole-account inference comes back through the list length",
      rule: "policy: the strict branch chooses nothing out of the account list",
      base: STORE_SOURCE,
      source: rewrite(
        strict,
        strict === null
          ? ""
          : strict.replace(
              "requestedAccountId: requested,",
              "requestedAccountId:\n    requested ?? (accounts.length === 1 ? accounts[0].accountId : null),"
            )
      ),
    },
    {
      label: "M6 the retired inference mode is accepted again by name",
      rule: "policy: the retired inference mode is not an accepted name",
      base: STORE_SOURCE,
      source: STORE_SOURCE.replace(
        'if (value === "strict-explicit" || value === "preserve-explicit") {',
        'if (value === "strict-explicit" || value === "preserve-explicit" || value === "legacy") {'
      ),
    },
    {
      label: "M7 the policy joins the pinned injection statement",
      rule: "policy: every line a shared guard rewrites is still there verbatim",
      base: STORE_SOURCE,
      source: STORE_SOURCE.replace(
        "const { filePath = AUTH_FILE, fileSystem = fs } = options;",
        'const { filePath = AUTH_FILE, fileSystem = fs, selectionPolicy = "strict-explicit" } = options;'
      ),
    },
    {
      label: "M8 a comment spells a dependency the shared guard will read",
      rule: "policy: no prose line is mistaken for an import by the shared guard",
      base: STORE_SOURCE,
      source: STORE_SOURCE.replace(
        "function explicitSelection(parsed) {",
        '// The default arrives here from "node:util" when the key is absent.\nfunction explicitSelection(parsed) {'
      ),
    },
    {
      label: "M9 an unknown policy is logged and the default carried on",
      rule: "policy: a refused option is raised, not logged and carried on",
      base: STORE_SOURCE,
      source: STORE_SOURCE.replace("throw new TypeError(", "console.warn("),
    },
    {
      label: "M10 the store is allowed to await",
      rule: "policy: the store still performs no asynchronous work",
      base: STORE_SOURCE,
      source:
        copy === null
          ? `${STORE_SOURCE}\nexport const planned = async function idle() {};\n`
          : STORE_SOURCE.replace(copy, `async ${copy}`),
    },
    {
      label: "M11 the copy branch is called from two places",
      rule: "policy: the copy branch is taken in exactly one place",
      base: STORE_SOURCE,
      source:
        copy === null
          ? `${STORE_SOURCE}\nexport const also = explicitSelection;\n`
          : STORE_SOURCE.replace(copy, `${copy}\n\nfunction unusedTwice(parsed) {\n  return explicitSelection(parsed);\n}`),
    },
    {
      label: "M12 the strict branch is called from two places",
      rule: "policy: the strict branch is taken in exactly one place",
      base: STORE_SOURCE,
      source:
        strict === null
          ? `${STORE_SOURCE}\nexport const also = strictSelection;\n`
          : STORE_SOURCE.replace(
              strict,
              `${strict}\n\nfunction unusedTwiceStrict(parsed, accounts) {\n  return strictSelection(parsed, accounts);\n}`
            ),
    },
  ];
}

after(() => {
  for (const dir of CREATED) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ============================================================
   THE OPTION EXISTS, AND THE DEFAULT IS STRICT
   ============================================================ */

// Task 4 moved the default. These three are the same fixture — one
// saved account, a stored selection of null — read by a caller that
// names nothing, names the strict mode, and names nothing twice. All
// three must agree, because a caller that forgot the option must not
// get the inference that was removed.

test("a store built with no policy does not select the only saved account", () => {
  const filePath = storeFile(storedState({ activeAccountId: null }));
  const { result } = loaded(filePath);

  assert.equal(
    result.activeAccountId,
    null,
    `a sole saved account was selected on a caller that asked for nothing: ${String(result.activeAccountId)}`
  );
  assert.deepEqual(
    result.accounts.map((account) => account.accountId),
    [ACCOUNT_ID],
    "the record the loader refused to select was not even kept"
  );
});

test("a store built with the strict policy named behaves like the default", () => {
  const filePath = storeFile(storedState({ activeAccountId: null }));
  const { result } = loaded(filePath, STRICT);

  assert.equal(result.activeAccountId, null);
});

test("an omitted policy and an undefined policy are the same store", () => {
  const filePath = storeFile(storedState({ activeAccountId: null }));

  const omitted = loaded(filePath);
  const explicitUndefined = loaded(filePath, undefined);

  assert.deepEqual(omitted.result, explicitUndefined.result);
  assert.equal(omitted.result.activeAccountId, null);
});

test("the policy is an option, not a fifth operation on the store", () => {
  const { failure } = captureThrow(() =>
    createCtraderStore({
      filePath: tempFilePath(),
      selectionPolicy: PRESERVE,
    })
  );

  assert.equal(failure, null, "the new policy name was refused outright");

  const store = createCtraderStore({
    filePath: tempFilePath(),
    selectionPolicy: PRESERVE,
  });

  BUILT.push(store.filePath);

  assert.deepEqual(Object.keys(store).sort(), [
    "clear",
    "filePath",
    "load",
    "save",
  ]);
});

// The feature: an option nobody recognises must not become an option
// somebody assumed.

test("a policy that is not one of the two names is refused at construction", () => {
  const { failure } = captureThrow(() =>
    createCtraderStore({
      filePath: tempFilePath(),
      selectionPolicy: "preserve",
    })
  );

  assert.ok(
    failure !== null,
    `a misspelled policy was accepted, so a migration would silently get "${STRICT}"`
  );
  assert.equal(failure instanceof TypeError, true);

  const message = String(failure.message);

  for (const name of [STRICT, PRESERVE]) {
    assert.equal(
      message.includes(name),
      true,
      `the refusal does not name the policy it wanted, so the caller cannot fix the call: ${message}`
    );
  }

  assert.equal(
    message.includes("preserve, not a cTrader selection policy"),
    true,
    `the refusal does not report what it was handed: ${message}`
  );
});

test("the retired inference mode is not a policy a caller can ask for", () => {
  const { failure } = captureThrow(() =>
    createCtraderStore({
      filePath: tempFilePath(),
      selectionPolicy: "legacy",
    })
  );

  // Task 4 removed the mode that inferred a selection from a sole
  // saved account and from the top-level id. Leaving its name
  // acceptable would keep the inference one call site away, and a
  // call site that still asks for it would be a bug worth naming.
  assert.ok(
    failure !== null,
    'the retired "legacy" policy was accepted, so the inference it carried is still reachable'
  );
  assert.equal(failure instanceof TypeError, true);
  assert.equal(
    String(failure.message).includes("legacy"),
    true,
    `the refusal did not say which name it was holding: ${String(failure.message)}`
  );
});

test("a null policy is refused, not quietly taken as no preference", () => {
  const { failure } = captureThrow(() =>
    createCtraderStore({
      filePath: tempFilePath(),
      selectionPolicy: null,
    })
  );

  assert.ok(
    failure !== null,
    "a null policy fell through to the default, which is the silent selection this option exists to refuse"
  );
  assert.equal(failure instanceof TypeError, true);
});

test("a policy that is not text is refused as the kind it is", () => {
  for (const value of [7, true, {}, [], () => {}]) {
    const { failure } = captureThrow(() =>
      createCtraderStore({
        filePath: tempFilePath(),
        selectionPolicy: value,
      })
    );

    assert.ok(failure !== null, `a ${typeof value} policy was accepted`);
    assert.equal(failure instanceof TypeError, true);
  }
});

test("a refused option reaches the caller without a path or a token", () => {
  const filePath = storeFile(storedState());

  const { failure } = captureThrow(() =>
    createCtraderStore({ filePath, selectionPolicy: "whatever" })
  );

  assert.ok(failure !== null);

  const message = String(failure.message);

  assert.equal(
    /[A-Za-z]:[\\/]|[\\/]/.test(message),
    false,
    `a refused option quoted a filesystem path: ${message}`
  );
  assert.equal(message.includes(ACCESS_TOKEN), false);
});

test("constructing either policy reads and writes nothing", () => {
  const { fileSystem, calls } = countingFileSystem();

  for (const policy of [PRESERVE, STRICT, undefined, "nonsense"]) {
    const { failure } = captureThrow(() =>
      quiet(() =>
        createCtraderStore({
          filePath: path.join(CREATED[0] || tempFilePath(), "case-store.json"),
          fileSystem,
          selectionPolicy: policy,
        })
      )
    );

    if (policy === "nonsense") {
      assert.ok(failure !== null, "a nonsense policy was built instead of refused");
    } else {
      assert.equal(failure, null, `building the ${String(policy)} policy threw`);
    }
  }

  assert.deepEqual(calls(), []);
});

/* ============================================================
   WHAT preserve-explicit PROMISES
   ============================================================ */

test("an explicitly stored selection is preserved exactly", () => {
  const filePath = storeFile(storedState());
  const { result } = loaded(filePath, PRESERVE);

  assert.equal(result.activeAccountId, ACCOUNT_ID);
});

test("one saved account and no stored selection loads unselected", () => {
  const filePath = storeFile(storedState({ activeAccountId: null }));
  const preserved = loaded(filePath, PRESERVE);

  assert.equal(
    preserved.result.activeAccountId,
    null,
    `a single saved account was selected on the caller's behalf: ${String(preserved.result.activeAccountId)}`
  );
  assert.deepEqual(
    preserved.result.accounts.map((account) => account.accountId),
    [ACCOUNT_ID]
  );
});

test("an absent selection key loads unselected, not accounts[0]", () => {
  const contents = without(
    storedState({
      accounts: [
        completeAccount("70000002"),
        completeAccount("70000003"),
        completeAccount("70000004"),
      ],
    }),
    "activeAccountId"
  );

  const filePath = storeFile(contents);

  assert.equal(
    Object.hasOwn(JSON.parse(read(filePath)), "activeAccountId"),
    false,
    "the fixture wrote the key anyway, so an absent selection was never tested"
  );

  const { result } = loaded(filePath, PRESERVE);

  assert.equal(
    result.activeAccountId,
    null,
    "the first record in the list was made the active account"
  );
});

test("an explicit null selection is not overridden by the sole account", () => {
  const filePath = storeFile(storedState({ activeAccountId: null }));

  const runtime = loaded(filePath);
  const preserved = loaded(filePath, PRESERVE);

  // Both loaders now give the same answer here, which is the point:
  // a stored null means nothing is active, and neither the process
  // that trades nor the copy that reads for a migration may read it
  // as a request to pick one.
  assert.equal(runtime.result.activeAccountId, null);
  assert.equal(preserved.result.activeAccountId, null);
});

test("a dangling selection is preserved, not replaced with null", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount(ACCOUNT_ID), completeAccount("70000009")],
      activeAccountId: "99999999",
    })
  );

  const preserved = loaded(filePath, PRESERVE);
  const runtime = loaded(filePath);

  assert.equal(
    preserved.result.activeAccountId,
    "99999999",
    "a selection naming no saved account was dropped, the repair this policy exists to stop"
  );
  assert.equal(
    runtime.result.activeAccountId,
    null,
    "the runtime loader kept a selection that names nothing it could trade"
  );
});

test("a dangling selection is preserved, not replaced with another account", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount("70000002"), completeAccount("70000003")],
      activeAccountId: "not-a-saved-account",
    })
  );

  const { result } = loaded(filePath, PRESERVE);

  assert.equal(result.activeAccountId, "not-a-saved-account");
  assert.equal(
    ["70000002", "70000003"].includes(String(result.activeAccountId)),
    false,
    "another saved account was substituted for the stored one"
  );
});

test("the legacy top-level id never becomes the selection", () => {
  const preMultiAccountFile = without(
    storedState(),
    "accounts",
    "activeAccountId"
  );

  preMultiAccountFile.accountId = ACCOUNT_ID;

  const filePath = storeFile(preMultiAccountFile);

  assert.equal(
    Object.hasOwn(JSON.parse(read(filePath)), "activeAccountId"),
    false,
    "the fixture stored an active selection, so the legacy key was never the only candidate"
  );

  const preserved = loaded(filePath, PRESERVE);
  const runtime = loaded(filePath);

  assert.equal(
    preserved.result.activeAccountId,
    null,
    "the pre-multi-account key was honored as an active selection"
  );
  assert.equal(
    runtime.result.activeAccountId,
    null,
    "the runtime loader still read the historical id as a choice of account"
  );

  // The record the key describes is still imported — reading history
  // is not selecting it.
  assert.deepEqual(
    runtime.result.accounts.map((account) => account.accountId),
    [ACCOUNT_ID]
  );
});

test("a legacy top-level id beside a full list is not a selection either", () => {
  const filePath = storeFile(
    without(
      storedState({
        accounts: [completeAccount("70000002"), completeAccount("70000003")],
        accountId: ACCOUNT_ID,
      }),
      "activeAccountId"
    )
  );

  const { result } = loaded(filePath, PRESERVE);

  assert.equal(result.activeAccountId, null);
});

test("a selection that is not text is copied as stored", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount(ACCOUNT_ID)],
      activeAccountId: 70000001,
    })
  );

  const preserved = loaded(filePath, PRESERVE);
  const runtime = loaded(filePath);

  assert.equal(preserved.result.activeAccountId, 70000001);
  assert.equal(
    typeof preserved.result.activeAccountId,
    "number",
    "a numeric selection was stringified, which is the normalization the policy refuses"
  );
  assert.equal(
    typeof runtime.result.activeAccountId,
    "string",
    "the runtime loader is allowed to normalize, because it has to compare"
  );
  assert.equal(runtime.result.activeAccountId, ACCOUNT_ID);
});

test("a padded selection keeps its padding where a record does not", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount(" 70000001 ")],
      activeAccountId: " 70000001 ",
    })
  );

  const { result } = loaded(filePath, PRESERVE);

  assert.equal(result.activeAccountId, " 70000001 ");
  assert.equal(result.accounts[0].accountId, "70000001");
});

test("a selection that was never a value is reported as none", () => {
  for (const value of ["", "   ", null]) {
    const filePath = storeFile(storedState({ activeAccountId: value }));
    const { result } = loaded(filePath, PRESERVE);

    assert.equal(
      result.activeAccountId,
      null,
      `a stored selection of ${JSON.stringify(value)} was preserved as a selection`
    );
  }
});

test("an empty account list stays an empty list under either policy", () => {
  for (const policy of [PRESERVE, STRICT, undefined]) {
    const filePath = storeFile(
      storedState({ accounts: [], activeAccountId: null })
    );
    const { result } = loaded(filePath, policy);

    assert.deepEqual(result.accounts, []);
    assert.equal(result.activeAccountId, null);
  }
});

test("an empty account list beside a dangling id preserves the id", () => {
  const filePath = storeFile(
    storedState({ accounts: [], activeAccountId: ACCOUNT_ID })
  );

  const preserved = loaded(filePath, PRESERVE);
  const runtime = loaded(filePath);

  assert.deepEqual(preserved.result.accounts, []);
  assert.equal(preserved.result.activeAccountId, ACCOUNT_ID);
  assert.equal(
    runtime.result.activeAccountId,
    null,
    "the loader kept a selection for an account that is not saved"
  );
  assert.deepEqual(
    runtime.result.accounts,
    [],
    "refusing the selection emptied the records with it"
  );
});

test("the account collection is not rearranged to make a selection true", () => {
  const filePath = storeFile(
    storedState({
      accounts: [
        completeAccount("70000003"),
        completeAccount("70000001"),
        completeAccount("70000002"),
      ],
      activeAccountId: "70000001",
    })
  );

  const before = read(filePath);
  const { result } = loaded(filePath, PRESERVE);

  assert.equal(read(filePath), before, "loading rewrote the stored file");
  assert.deepEqual(
    result.accounts.map((account) => account.accountId),
    ["70000003", "70000001", "70000002"],
    "the records came back in a different order than they are stored"
  );
  assert.equal(result.activeAccountId, "70000001");

  const runtime = loaded(filePath);

  assert.equal(
    read(filePath),
    before,
    "the runtime loader rewrote the stored file to decide"
  );
  assert.deepEqual(
    runtime.result.accounts.map((account) => account.accountId),
    ["70000003", "70000001", "70000002"],
    "the runtime loader rearranged the records"
  );
  assert.equal(
    runtime.result.activeAccountId,
    "70000001",
    "a selection naming a saved record was not restored in spite of the order"
  );
});

test("a preserved selection is not announced as a refusal", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount(ACCOUNT_ID)],
      activeAccountId: "99999999",
    })
  );

  const preserved = loaded(filePath, PRESERVE);
  const runtime = loaded(filePath);

  assert.equal(
    hasLine(preserved.lines, "🚫"),
    false,
    "the copy policy reported a stored fact it was asked to preserve"
  );
  assert.equal(
    hasLine(runtime.lines, "🚫"),
    true,
    "the runtime loader stopped reporting the selection it refused"
  );
});

/* ============================================================
   WHAT THE POLICY DOES NOT CHANGE
   ============================================================ */

test("record normalization is identical under both policies", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount("70000001"), completeAccount("70000002")],
      activeAccountId: "70000001",
    })
  );

  const runtime = loaded(filePath);
  const preserved = loaded(filePath, PRESERVE);

  assert.deepEqual(preserved.result.accounts, runtime.result.accounts);
  assert.deepEqual(
    Object.keys(preserved.result),
    STORE_KEYS,
    "the shape of a loaded state changed with the policy"
  );
});

test("a bare record still gains its generated local id and defaults", () => {
  const filePath = storeFile(
    storedState({ accounts: [{ accountId: ACCOUNT_ID }], activeAccountId: null })
  );

  const { result } = loaded(filePath, PRESERVE);
  const [record] = result.accounts;

  assert.deepEqual(Object.keys(record).sort(), [
    "accountId",
    "createdAt",
    "id",
    "name",
  ]);
  assert.equal(typeof record.id, "string");
  assert.match(record.id, /^account-/);
  assert.equal(record.name, "Trading Account");
  assert.equal(Number.isNaN(Date.parse(record.createdAt)), false);
  assert.equal(record.accountId, ACCOUNT_ID);
});

test("a legacy single-account file still imports its record", () => {
  const filePath = storeFile({
    ...without(storedState(), "accounts", "activeAccountId"),
    accountId: ACCOUNT_ID,
  });

  const runtime = loaded(filePath);
  const preserved = loaded(filePath, PRESERVE);

  assert.equal(preserved.result.accounts.length, 1);
  assert.equal(
    preserved.result.accounts[0].name,
    "Imported Trading Account"
  );
  assert.deepEqual(
    preserved.result.accounts.map((account) => account.accountId),
    runtime.result.accounts.map((account) => account.accountId)
  );
  assert.equal(
    runtime.result.activeAccountId,
    null,
    "the imported record was also treated as the active account"
  );
});

test("a record with no usable account id is still dropped", () => {
  const filePath = storeFile(
    storedState({
      accounts: [completeAccount(ACCOUNT_ID), completeAccount("   ")],
      activeAccountId: null,
    })
  );

  const { result } = loaded(filePath, PRESERVE);

  assert.deepEqual(
    result.accounts.map((account) => account.accountId),
    [ACCOUNT_ID]
  );
});

test("unparseable content is still reported as nothing readable", () => {
  const filePath = storeFile("{ not json");

  for (const policy of [PRESERVE, STRICT, undefined]) {
    const { result } = loaded(filePath, policy);

    assert.equal(result, null);
    assert.equal(read(filePath), "{ not json");
  }
});

test("the credential half of the state is untouched by the policy", () => {
  const filePath = storeFile(storedState({ activeAccountId: null }));

  const runtime = loaded(filePath);
  const preserved = loaded(filePath, PRESERVE);

  for (const key of [
    "connected",
    "accessToken",
    "refreshToken",
    "expiresIn",
  ]) {
    assert.equal(preserved.result[key], runtime.result[key]);
  }

  assert.equal(preserved.result.accessToken, ACCESS_TOKEN);
});

test("save is unaffected: it writes the whole state it is handed", () => {
  const filePath = tempFilePath();

  const store = createCtraderStore({
    filePath,
    selectionPolicy: PRESERVE,
  });

  BUILT.push(store.filePath);

  const contents = storedState({ activeAccountId: "99999999" });

  quiet(() => store.save(contents));

  assert.deepEqual(JSON.parse(read(filePath)), contents);
});

test("no token material reaches the console under either policy", () => {
  const filePath = storeFile(storedState());

  for (const policy of [PRESERVE, STRICT]) {
    const { lines } = loaded(filePath, policy);

    for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN]) {
      assert.equal(
        hasLine(lines, secret),
        false,
        `a synthetic token reached the output under the ${policy} policy`
      );
    }
  }
});

/* ============================================================
   THE STATIC CONTRACT
   ============================================================ */

test("services/ctraderStore.js follows every policy rule", () => {
  const failures = failuresFor(POLICY_RULES, STORE_SOURCE);

  assert.deepEqual(
    failures,
    [],
    `services/ctraderStore.js breaks: ${failures.join(" | ")}`
  );
});

test("the policy mutants are rejected by the rules written for them", () => {
  for (const mutant of mutants()) {
    assert.notEqual(
      mutant.source,
      mutant.base,
      `${mutant.label}: the anchor text is stale, nothing was mutated`
    );

    const failures = failuresFor(POLICY_RULES, mutant.source);

    assert.equal(
      failures.includes(mutant.rule),
      true,
      `${mutant.label} was accepted by every rule, including ${mutant.rule}`
    );
  }
});

test("this suite imports nothing but the store, the runtime paths and Node", () => {
  assert.deepEqual(importSpecifiers(SELF_SOURCE).sort(), [
    "../runtimePaths.js",
    "./ctraderStore.js",
    "node:assert/strict",
    "node:fs",
    "node:os",
    "node:path",
    "node:test",
    "node:url",
  ]);
});

test("every store this suite built pointed at a scratch directory", () => {
  assert.equal(
    BUILT.length > 0,
    true,
    "no store was built, so the list proves nothing"
  );

  for (const filePath of BUILT) {
    assert.equal(
      path.resolve(filePath) === path.resolve(AUTH_FILE),
      false,
      "a store was built on the production path"
    );
    assert.equal(
      path.resolve(path.dirname(filePath)) === path.resolve(HERE),
      false,
      "a store was built beside the repository sources"
    );
    assert.equal(
      path.resolve(filePath).startsWith(path.resolve(os.tmpdir())),
      true,
      "a store was built outside the scratch tree"
    );
  }
});
