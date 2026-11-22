import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createCtraderStore } from "./ctraderStore.js";

/* ============================================================
   THE MIGRATION PROJECTION

   Task 2.1-d splits one combined artifact into two files, and before
   anything can be written to them there has to be one agreed answer to
   "what goes where". That answer is this function, and this suite is
   the contract. It is a *projection*, not a migration: it takes the
   legacy combined state in, returns the two domain states out, and it
   never opens a file, never decides when to run and never keeps a
   record of having run. The task that moves the data owns all of that.

   WHY IT IS PURE. A migration has to be able to answer "what would you
   have written?" before it writes anything, and the only honest way to
   answer that is a function whose whole output is a function of its
   input. So the module imports nothing at all — not the filesystem,
   not the runtime paths, not the selection rule — reads no
   environment, starts no clock, draws no random number, mutates
   nothing it was handed and logs nothing. Each of those is a test
   below, and each is also a static rule, because a comment saying
   "pure" is not evidence.

   WHAT THE PROJECTION DELIBERATELY DOES NOT DO.

   1. It invents nothing. The legacy loader generates a local id, a
      default name and a creation timestamp for a record that lacks
      them, and imports a bare top-level accountId as a record. That
      behaviour stays in the loader, unchanged. This projection refuses
      to invent what it was not given, so a record with no id comes
      back with no id. Feeding it the loader's own output is the
      intended pipeline, and one test below proves that pipeline
      carries a legacy single-account file through intact.
   2. It rewrites nothing. Identifiers are copied as stored, so a
      numeric accountId stays numeric and a padded one keeps its
      spaces. The loader performs both of those coercions on read, and
      the split has no reason to perform them a second time — two
      places that normalize are two places that can disagree.
   3. It selects nothing. activeAccountId is preserved exactly,
      including null, an empty string and an id that names no saved
      account. A projection that quietly repaired a selection would
      make the two new files disagree with the old one and nobody would
      notice which run did it.
   4. It reads no legacy key. The pre-multi-account top-level accountId
      is not consulted, for the selection or for a record, and a record
      keeps nothing beyond the four known metadata fields — the same
      fields the loader has always written, and the reason a token that
      a caller had misplaced inside a record cannot ride into the
      accounts file.
   5. It does not tolerate a state that is not a state. A non-object
      input is refused with a TypeError naming only the kind, because
      "there is nothing to migrate" and "migrate the empty pair" are
      different claims. The value is never quoted: a legacy state holds
      a token, and a refusal message can end up in a log or an HTTP
      body.

   Every fixture here is synthetic and lives in memory. Nothing in this
   file creates, opens or removes a file, and the two production data
   files are never candidates for any operation.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(HERE, "..");
const MODULE_FILE = path.join(HERE, "ctraderMigrationProjection.js");

const SELF_SOURCE = fs
  .readFileSync(
    path.join(HERE, "ctraderMigrationProjection.test.js"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

// Read lazily: the module under test has not been written yet, and an
// absent file must fail an assertion rather than crash the suite.
const MODULE_SOURCE = fs.existsSync(MODULE_FILE)
  ? fs.readFileSync(MODULE_FILE, "utf8").replace(/\r\n/g, "\n")
  : null;

const ACCESS_TOKEN = "synthetic-access-token-fixture-3101";
const REFRESH_TOKEN = "synthetic-refresh-token-fixture-3102";
const ACCOUNT_NAME = "synthetic-account-name-fixture-3103";
const ACCOUNT_ID = "70000001";
const LOCAL_ID = "account-stored-70000001";
const CREATED_AT = "2026-03-04T05:06:07.000Z";
const EXPIRES_IN = 86400;

const CREDENTIAL_KEYS = [
  "connected",
  "accessToken",
  "refreshToken",
  "expiresIn",
];

const ACCOUNT_KEYS = ["accounts", "activeAccountId"];

const METADATA_KEYS = ["accountId", "createdAt", "id", "name"];

const MISSING =
  "server/services/ctraderMigrationProjection.js has not been written yet";

function account(overrides = {}) {
  return {
    id: LOCAL_ID,
    accountId: ACCOUNT_ID,
    name: ACCOUNT_NAME,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

// The combined state, in the shape the legacy loader returns it.
function combined(overrides = {}) {
  return {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account()],
    activeAccountId: ACCOUNT_ID,
    ...overrides,
  };
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

// An independent copy, so a later mutation cannot be mistaken for one
// the projection already made.
function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const member of Object.values(value)) {
      deepFreeze(member);
    }

    Object.freeze(value);
  }

  return value;
}

// Fixture values are only ever searched for, never interpolated: an
// assertion that prints its operands would put a credential in the
// test output.
function mentionsText(value, needle) {
  return JSON.stringify(value).includes(needle);
}

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

const SECRET_BEARING_NAMES = new Set([
  ".env",
  ["ctrader", "auth", "json"].join("-"),
  ["ctrader", "accounts", "json"].join("-"),
]);

function closureOf(entry, seen = new Set()) {
  if (seen.has(entry)) {
    return seen;
  }

  if (SECRET_BEARING_NAMES.has(path.basename(entry))) {
    throw new Error(
      `${path.relative(SERVER_DIR, entry)} is a credential file; the closure walk refuses to open it`
    );
  }

  seen.add(entry);

  const source = fs.readFileSync(entry, "utf8");

  for (const [, specifier] of source.matchAll(
    /\bfrom\s*["'](\.[^"']+)["']/g
  )) {
    const from = path.dirname(entry);
    const target = [
      path.resolve(from, specifier),
      path.resolve(from, `${specifier}.js`),
      path.resolve(from, specifier, "index.js"),
    ].find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    );

    if (target === undefined) {
      throw new Error(
        `${path.relative(SERVER_DIR, entry)} imports ${specifier}, which cannot be resolved`
      );
    }

    closureOf(target, seen);
  }

  return seen;
}

function moduleSource() {
  assert.ok(MODULE_SOURCE !== null, MISSING);

  return MODULE_SOURCE;
}

async function module_() {
  assert.ok(MODULE_SOURCE !== null, MISSING);

  const namespace = await import(pathToFileURL(MODULE_FILE).href);

  assert.equal(
    typeof namespace.projectLegacyState,
    "function",
    "ctraderMigrationProjection.js exports no projectLegacyState to call"
  );

  return namespace;
}

async function projected(state) {
  const namespace = await module_();

  return namespace.projectLegacyState(state);
}

// The projection is synchronous, so a refusal is a synchronous throw.
// Capturing it here instead of letting it escape keeps the assertion
// about the refusal — and not about the harness — in the failure text.
async function refusalFor(value) {
  const namespace = await module_();

  let failure = null;

  try {
    namespace.projectLegacyState(value);
  } catch (error) {
    failure = error;
  }

  assert.ok(
    failure !== null,
    `a state that is ${typeof value} was projected instead of refused`
  );

  return failure;
}

// A function body, found by matching braces from its declaration, so a
// rule can look at one function instead of the whole module.
function functionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);

  if (start === -1) {
    return null;
  }

  const opening = text.indexOf("{", start);

  if (opening === -1) {
    return null;
  }

  let depth = 0;

  for (let index = opening; index < text.length; index += 1) {
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

function failuresFor(rules, text) {
  return rules
    .filter((rule) => !rule.passes(text))
    .map((rule) => rule.label);
}

function assertClean(rules, text, subject) {
  assert.deepEqual(
    failuresFor(rules, text),
    [],
    `${subject} breaks: ${failuresFor(rules, text).join(" | ")}`
  );
}

/* ============================================================
   THE TWO PROJECTIONS
   ============================================================ */

test("the module exports one function and nothing else", async () => {
  assert.ok(MODULE_SOURCE !== null, MISSING);

  const namespace = await import(pathToFileURL(MODULE_FILE).href);

  assert.deepEqual(Object.keys(namespace), ["projectLegacyState"]);
});

test("the projection returns exactly an auth state and an accounts state", async () => {
  const out = await projected(combined());

  assert.deepEqual(Object.keys(out), ["auth", "accounts"]);
});

test("the auth projection holds exactly the four credential keys", async () => {
  const { auth } = await projected(combined());

  assert.deepEqual(Object.keys(auth), CREDENTIAL_KEYS);
});

test("the accounts projection holds exactly the two account keys", async () => {
  const { accounts } = await projected(combined());

  assert.deepEqual(Object.keys(accounts), ACCOUNT_KEYS);
});

test("the auth projection forwards every credential value unchanged", async () => {
  const { auth } = await projected(combined());

  assert.equal(auth.accessToken, ACCESS_TOKEN);
  assert.equal(auth.refreshToken, REFRESH_TOKEN);
  assert.equal(auth.expiresIn, EXPIRES_IN);
  assert.equal(auth.connected, true);
});

test("a complete record keeps its id, accountId, name and createdAt unchanged", async () => {
  const { accounts } = await projected(combined());

  assert.deepEqual(accounts.accounts, [
    {
      id: LOCAL_ID,
      accountId: ACCOUNT_ID,
      name: ACCOUNT_NAME,
      createdAt: CREATED_AT,
    },
  ]);
});

test("the projection carries a legacy single-account file the loader already imported", async () => {
  /* The intended pipeline: the combined store reads and normalizes, and
     the projection only splits. The injected file system means the
     loader never touches a disk, so no production artifact is a
     candidate for anything in this test — the legacy top-level
     accountId is imported into a record by the loader, exactly as it
     has always been, and the projection has to carry that record
     through without adding or removing anything. */
  const legacyFile = {
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accountId: ACCOUNT_ID,
  };

  const fileSystem = {
    existsSync: () => true,
    readFileSync: () => JSON.stringify(legacyFile),
  };

  const store = createCtraderStore({
    filePath: path.join(SERVER_DIR, "synthetic-legacy-state.json"),
    fileSystem,
  });

  const { result: loaded } = quiet(() => store.load());

  assert.notEqual(loaded, null, "the combined loader refused the legacy state");

  assert.equal(loaded.accounts.length, 1);
  // CHANGED ON PURPOSE BY TASK 2.1-e. The combined loader is now
  // explicit-only, so the legacy top-level accountId is imported as a
  // record and then left unselected. The projection copies whatever
  // selection it was handed, so the empty selection has to ride all the
  // way through to the accounts file — which is exactly what the real
  // copy migration reads it as, since it loads with the preserve mode.
  assert.equal(
    loaded.activeAccountId,
    null,
    "the loader still honored a legacy top-level id as a selection"
  );

  const out = await projected(loaded);

  assert.deepEqual(Object.keys(out.auth), CREDENTIAL_KEYS);
  assert.equal(out.auth.accessToken, ACCESS_TOKEN);

  assert.equal(out.accounts.accounts.length, 1);
  assert.equal(out.accounts.accounts[0].accountId, ACCOUNT_ID);
  assert.equal(
    out.accounts.accounts[0].name,
    "Imported Trading Account",
    "the name the loader imported was not carried through"
  );
  assert.equal(typeof out.accounts.accounts[0].id, "string");
  assert.equal(typeof out.accounts.accounts[0].createdAt, "string");
  assert.equal(out.accounts.activeAccountId, null);
  assert.equal(
    mentionsText(out.accounts, ACCESS_TOKEN),
    false,
    "the imported record carried a credential into the accounts projection"
  );
});

/* ============================================================
   NOTHING IS INVENTED, NOTHING IS REWRITTEN
   ============================================================ */

test("a record missing metadata keeps missing it: nothing is invented", async () => {
  const { accounts } = await projected(
    combined({ accounts: [{ accountId: ACCOUNT_ID }] })
  );

  assert.deepEqual(accounts.accounts, [{ accountId: ACCOUNT_ID }]);
});

test("a state with no account array projects an empty list, not a placeholder", async () => {
  const out = await projected({
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
  });

  assert.deepEqual(out.accounts, { accounts: [], activeAccountId: null });
});

test("a state with no credentials projects empty auth fields, not a guess", async () => {
  const out = await projected({ accounts: [account()] });

  assert.deepEqual(out.auth, {
    connected: false,
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
  });
});

test("an account identifier is copied exactly, even when it is not text", async () => {
  const { accounts } = await projected(
    combined({ accounts: [account({ accountId: 70000001 })] })
  );

  assert.equal(
    accounts.accounts[0].accountId,
    70000001,
    "a numeric identifier was rewritten"
  );
  assert.equal(typeof accounts.accounts[0].accountId, "number");
});

test("a padded identifier is not trimmed", async () => {
  const { accounts } = await projected(
    combined({ accounts: [account({ accountId: " 70000001 " })] })
  );

  assert.deepEqual(
    accounts.accounts.map((record) => record.accountId),
    [" 70000001 "],
    "the projection normalized an identifier it was told to copy"
  );
});

test("a padded name and timestamp are copied byte for byte", async () => {
  const padded = account({
    name: `  ${ACCOUNT_NAME}  `,
    createdAt: " 2026-03-04T05:06:07.000Z ",
  });

  const { accounts } = await projected(combined({ accounts: [padded] }));

  assert.deepEqual(accounts.accounts, [
    {
      id: LOCAL_ID,
      accountId: ACCOUNT_ID,
      name: `  ${ACCOUNT_NAME}  `,
      createdAt: " 2026-03-04T05:06:07.000Z ",
    },
  ]);
});

test("a selection is preserved exactly, including a dangling one", async () => {
  const out = await projected(
    combined({ accounts: [account()], activeAccountId: "99999999" })
  );

  assert.equal(out.accounts.activeAccountId, "99999999");
});

test("an empty-string and a numeric selection are preserved, not repaired", async () => {
  const empty = await projected(combined({ activeAccountId: "" }));
  const numeric = await projected(
    combined({ activeAccountId: 70000001, accounts: [] })
  );

  assert.equal(empty.accounts.activeAccountId, "");
  assert.equal(numeric.accounts.activeAccountId, 70000001);
});

test("an explicit null selection stays null and an absent one becomes null", async () => {
  const explicit = await projected(combined({ activeAccountId: null }));
  const absent = await projected({
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account()],
  });

  assert.equal(explicit.accounts.activeAccountId, null);
  assert.equal(
    absent.accounts.activeAccountId,
    null,
    "a selection that was never stored came back as something else"
  );
  assert.equal(
    Object.hasOwn(absent.accounts, "activeAccountId"),
    true,
    "an absent selection has to be reported as null, not left out"
  );
});

test("the projection never selects a sole account", async () => {
  /* The combined loader does select one: with a single saved record and
     no stored id it reports that record as active. A migration that
     inherited that would write a selection the old file never held, so
     the split keeps the silence. */
  const out = await projected({
    connected: false,
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
    accounts: [account()],
  });

  assert.deepEqual(out.accounts, {
    accounts: [account()],
    activeAccountId: null,
  });
});

test("the legacy top-level accountId is not read as a selection", async () => {
  const out = await projected({
    connected: true,
    accessToken: ACCESS_TOKEN,
    refreshToken: REFRESH_TOKEN,
    expiresIn: EXPIRES_IN,
    accounts: [account({ accountId: "88888888" })],
    accountId: ACCOUNT_ID,
  });

  assert.equal(out.accounts.activeAccountId, null);
  assert.deepEqual(
    out.accounts.accounts.map((record) => record.accountId),
    ["88888888"],
    "the legacy top-level accountId was imported as a record"
  );
});

/* ============================================================
   WHAT IS DROPPED
   ============================================================ */

test("a record's fields beyond the four metadata keys are dropped", async () => {
  const { accounts } = await projected(
    combined({
      accounts: [
        account({
          environment: "synthetic-live",
          serverUrl: "synthetic-server-url-fixture-3104",
          balance: 1000,
        }),
      ],
    })
  );

  assert.deepEqual(Object.keys(accounts.accounts[0]).sort(), METADATA_KEYS);
});

test("a credential misplaced inside a record never reaches the accounts projection", async () => {
  const { accounts } = await projected(
    combined({
      accounts: [
        account({
          accessToken: ACCESS_TOKEN,
          refreshToken: REFRESH_TOKEN,
        }),
      ],
    })
  );

  assert.equal(
    mentionsText(accounts, ACCESS_TOKEN),
    false,
    "a token inside a stored record reached the accounts projection"
  );
  assert.equal(mentionsText(accounts, REFRESH_TOKEN), false);
});

test("no account key or record reaches the auth projection", async () => {
  const out = await projected(combined());

  assert.equal(mentionsText(out.auth, ACCOUNT_ID), false);
  assert.equal(mentionsText(out.auth, ACCOUNT_NAME), false);
  assert.equal(mentionsText(out.auth, LOCAL_ID), false);
  assert.deepEqual(
    Object.keys(out.auth).filter((key) => !CREDENTIAL_KEYS.includes(key)),
    []
  );
});

test("no credential value reaches the accounts projection", async () => {
  const out = await projected(combined());

  assert.equal(mentionsText(out.accounts, ACCESS_TOKEN), false);
  assert.equal(mentionsText(out.accounts, REFRESH_TOKEN), false);
  assert.equal(mentionsText(out.accounts, String(EXPIRES_IN)), false);
});

test("keys the combined format does not know appear nowhere in the output", async () => {
  const out = await projected(
    combined({
      observedVia: "synthetic-observation-label",
      migrationVersion: 3,
      scope: "read",
    })
  );

  assert.deepEqual(Object.keys(out), ["auth", "accounts"]);
  assert.deepEqual(Object.keys(out.auth), CREDENTIAL_KEYS);
  assert.deepEqual(Object.keys(out.accounts), ACCOUNT_KEYS);
});

test("records keep their stored order", async () => {
  const out = await projected(
    combined({
      accounts: [
        account({ accountId: "30000003" }),
        account({ accountId: "10000001" }),
        account({ accountId: "20000002" }),
      ],
      activeAccountId: "10000001",
    })
  );

  assert.deepEqual(
    out.accounts.accounts.map((record) => record.accountId),
    ["30000003", "10000001", "20000002"]
  );
  assert.equal(out.accounts.activeAccountId, "10000001");
});

test("a record with no usable account id is dropped", async () => {
  const out = await projected(
    combined({
      accounts: [
        account({ accountId: ACCOUNT_ID }),
        account({ accountId: "" }),
        account({ accountId: "   " }),
        account({ accountId: null }),
        account({ accountId: undefined }),
        { id: "synthetic-record-without-identifier", name: ACCOUNT_NAME },
      ],
    })
  );

  assert.deepEqual(
    out.accounts.accounts.map((record) => record.accountId),
    [ACCOUNT_ID],
    "a record with no account id survived, or a usable one was dropped"
  );
});

test("a row that is not an object is dropped", async () => {
  const rows = [null, undefined, "70000001", 70000001, true, ["70000001"]];

  for (const row of rows) {
    const out = await projected(combined({ accounts: [account(), row] }));

    assert.equal(
      out.accounts.accounts.length,
      1,
      `a row of kind ${Array.isArray(row) ? "array" : typeof row} was kept`
    );
  }
});

test("an accounts value that is not a list projects as an empty list", async () => {
  const values = [
    undefined,
    null,
    "70000001",
    70000001,
    true,
    {},
    { 0: account(), length: 1 },
  ];

  for (const value of values) {
    const out = await projected(combined({ accounts: value }));

    assert.deepEqual(
      out.accounts.accounts,
      [],
      `accounts of kind ${
        Array.isArray(value) ? "array" : typeof value
      } produced records`
    );
  }
});

test("an empty account list projects an empty list, not a removed key", async () => {
  const out = await projected(combined({ accounts: [], activeAccountId: null }));

  assert.deepEqual(out.accounts, { accounts: [], activeAccountId: null });
});

test("a credential value of its own kind is preserved, not replaced", async () => {
  const out = await projected(
    combined({ accessToken: "", refreshToken: null, expiresIn: 0 })
  );

  assert.equal(out.auth.accessToken, "");
  assert.equal(out.auth.refreshToken, null);
  assert.equal(out.auth.expiresIn, 0);
});

test("only connected is normalized, to a real boolean", async () => {
  const truthy = await projected(combined({ connected: "yes" }));
  const falsy = await projected(combined({ connected: 0 }));

  assert.equal(truthy.auth.connected, true);
  assert.equal(falsy.auth.connected, false);
  assert.deepEqual(Object.keys(truthy.auth), CREDENTIAL_KEYS);
});

/* ============================================================
   REFUSALS
   ============================================================ */

test("a state that is not an object is refused, not projected as empty", async () => {
  const values = [null, undefined, [], 0, 42, true, "", ACCESS_TOKEN];

  for (const value of values) {
    const failure = await refusalFor(value);

    assert.ok(
      failure instanceof TypeError,
      `a state of kind ${typeof value} was refused with ${failure.name}`
    );
  }
});

test("a function is refused as the state it is", async () => {
  const failure = await refusalFor(() => combined());

  assert.ok(failure instanceof TypeError);
});

test("an array of states is refused rather than merged", async () => {
  const failure = await refusalFor([combined(), combined()]);

  assert.ok(failure instanceof TypeError);
  assert.equal(
    mentionsText(failure.message, ACCESS_TOKEN),
    false,
    "the refusal quoted the states it refused"
  );
});

test("a refusal names the kind it refused and never the value", async () => {
  const failure = await refusalFor(ACCESS_TOKEN);

  assert.equal(
    failure.message.includes(ACCESS_TOKEN),
    false,
    "a refusal message repeated the credential it was handed"
  );
  assert.equal(failure.message.includes(REFRESH_TOKEN), false);
  assert.ok(
    failure.message.includes("string"),
    `the refusal did not say what kind it got: ${failure.message}`
  );
});

test("an empty object is a state, and projects the empty pair", async () => {
  const out = await projected({});

  assert.deepEqual(out, {
    auth: {
      connected: false,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
    },
    accounts: { accounts: [], activeAccountId: null },
  });
});

/* ============================================================
   PURITY
   ============================================================ */

test("the projection is deterministic: the same state projects to the same bytes", async () => {
  const state = combined({
    accounts: [account(), account({ accountId: "70000002" })],
  });

  const first = await projected(state);
  const second = await projected(state);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("the projection does not mutate the state it is handed", async () => {
  const state = combined({
    accounts: [account(), account({ accountId: "70000002" })],
  });

  const before = snapshot(state);

  await projected(state);

  assert.deepEqual(state, before, "the projection wrote through to its input");
});

test("the projection does not hand back any object it was given", async () => {
  const state = combined();

  const out = await projected(state);

  assert.notEqual(out.accounts.accounts, state.accounts);
  assert.notEqual(out.accounts.accounts[0], state.accounts[0]);
  assert.notEqual(out.auth, state);
});

test("a frozen legacy state projects without an error", async () => {
  const state = deepFreeze(combined({ accounts: [deepFreeze(account())] }));

  const out = await projected(state);

  assert.equal(out.accounts.accounts.length, 1);
  assert.equal(out.auth.accessToken, ACCESS_TOKEN);
});

test("the projection logs nothing while it works", async () => {
  const namespace = await module_();

  const state = combined({
    accounts: [account(), account({ accountId: "" }), "not-a-row"],
  });

  const { result, lines } = quiet(() => namespace.projectLegacyState(state));

  assert.deepEqual(lines, []);
  assert.equal(result.accounts.accounts.length, 1);
});

test("the module imports nothing, so it cannot reach a disk or a network", () => {
  assert.deepEqual(
    importSpecifiers(moduleSource()),
    [],
    "a pure projection that imports something is not a pure projection"
  );
});

test("the closure of the projection is the projection alone", () => {
  moduleSource();

  const names = [...closureOf(MODULE_FILE)]
    .map((file) => path.relative(SERVER_DIR, file).split(path.sep).join("/"))
    .sort();

  assert.deepEqual(names, ["services/ctraderMigrationProjection.js"]);
});

test("this suite imports nothing but the projection's collaborators and Node", () => {
  assert.deepEqual(importSpecifiers(SELF_SOURCE).sort(), [
    "./ctraderStore.js",
    "node:assert/strict",
    "node:fs",
    "node:path",
    "node:test",
    "node:url",
  ]);
});

test("this suite writes no file and creates no directory", () => {
  for (const name of [
    "writeFileSync",
    "appendFileSync",
    "mkdirSync",
    "mkdtempSync",
    "rmSync",
    "unlinkSync",
    "renameSync",
    "createWriteStream",
  ]) {
    assert.equal(
      SELF_SOURCE.includes(`.${name}(`),
      false,
      `the projection suite calls .${name}(), and a suite about a pure function should not need to`
    );
  }
});

/* ============================================================
   STATIC RULES AND MUTANTS
   ============================================================ */

const PROJECT_RULES = [
  {
    label: "projection: the module imports nothing at all",
    passes: (text) => importSpecifiers(text).length === 0,
  },
  {
    label: "projection: no filesystem, environment, network or timer reach",
    passes: (text) =>
      !/\bfs\b|node:fs|readFile|writeFile|existsSync|renameSync|unlinkSync|mkdir|process\.|dotenv|fetch\(|WebSocket|\bhttp|setTimeout|setInterval|queueMicrotask|\bawait\b|\basync\b/.test(
        text
      ),
  },
  {
    label:
      "projection: nothing is invented — no clock, no randomness, no generated identity",
    passes: (text) =>
      !/Date\.now|new Date|Date\(|Math\.random|crypto|uuid|nanoid|performance\.now/.test(
        text
      ),
  },
  {
    label: "projection: the module performs no logging",
    passes: (text) => !/console\./.test(text),
  },
  {
    label: "projection: exactly one function is exported",
    passes: (text) =>
      /export function projectLegacyState\(/.test(text) &&
      (text.match(/^export /gm) || []).length === 1,
  },
  {
    label:
      "projection: the record copy transforms nothing — no trim, no coercion, no case change",
    passes: (text) => {
      const body = functionBody(text, "projectAccount");

      return (
        body !== null &&
        !/trim|String\(|Number\(|parseInt|toLowerCase|toUpperCase|JSON\./.test(
          body
        )
      );
    },
  },
  {
    label:
      "projection: the account row allow-list holds the four metadata keys and nothing else",
    passes: (text) => {
      const declaration =
        /const ACCOUNT_METADATA_KEYS = \[([^\]]*)\]/.exec(text);

      if (declaration === null) {
        return false;
      }

      const keys = declaration[1]
        .split(",")
        .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
        .filter((entry) => entry !== "");

      return (
        keys.length === 4 &&
        METADATA_KEYS.every((key) => keys.includes(key))
      );
    },
  },
  {
    label: "projection: no account is ever selected or deselected here",
    passes: (text) =>
      !/length === 1|length ===|soleAccount|selectAccountById|ctraderAccountSelection|defaultAccount/.test(
        text
      ),
  },
  {
    label: "projection: a refusal interpolates only the kind it refused",
    passes: (text) =>
      (text.match(/\$\{/g) || []).length === 1 &&
      /\$\{kind\}/.test(text) &&
      /new TypeError\(/.test(text),
  },
];

test("services/ctraderMigrationProjection.js follows every rule", () => {
  assertClean(
    PROJECT_RULES,
    moduleSource(),
    "services/ctraderMigrationProjection.js"
  );
});

/* Built lazily: the mutants read the module's own text, and reading it
   before the module exists has to be reported as the missing
   deliverable inside a test, not as an error that stops the file from
   loading. */
function mutants() {
  const base = moduleSource();

  return [
  {
    label: "M1 the projection generates the local id a record lacks",
    base,
    source: base.replace(
      "  return record;",
      "  if (record.id === undefined) {\n    record.id = `account-${Date.now()}-${Math.random()\n      .toString(36)\n      .slice(2, 8)}`;\n  }\n\n  return record;"
    ),
    rule:
      "projection: nothing is invented — no clock, no randomness, no generated identity",
  },
  {
    label: "M2 the projection trims the metadata it copies",
    base,
    source: base.replace(
      "record[key] = row[key];",
      'record[key] = typeof row[key] === "string" ? row[key].trim() : row[key];'
    ),
    rule:
      "projection: the record copy transforms nothing — no trim, no coercion, no case change",
  },
  {
    label: "M3 the projection selects a sole account the way the loader does",
    base,
    source: base.replace(
      'activeAccountId: storedValue(legacyState, "activeAccountId"),',
      'activeAccountId:\n          storedValue(legacyState, "activeAccountId") ??\n          (stored.length === 1 ? stored[0].accountId : null),'
    ),
    rule: "projection: no account is ever selected or deselected here",
  },
  {
    label: "M4 the row allow-list lets a credential through",
    base,
    source: base.replace(
      'const ACCOUNT_METADATA_KEYS = ["id", "accountId", "name", "createdAt"];',
      'const ACCOUNT_METADATA_KEYS = [\n  "id",\n  "accountId",\n  "name",\n  "createdAt",\n  "accessToken",\n];'
    ),
    rule:
      "projection: the account row allow-list holds the four metadata keys and nothing else",
  },
  {
    label: "M5 the refusal quotes the state it refused",
    base,
    source: base.replace("got ${kind}", "got ${legacyState}"),
    rule: "projection: a refusal interpolates only the kind it refused",
  },
  {
    label: "M6 the projection checks the store file before it projects",
    base,
    source: base.replace(
      'const ACCOUNT_METADATA_KEYS = ["id", "accountId", "name", "createdAt"];',
      'import fs from "fs";\n\nconst ACCOUNT_METADATA_KEYS = ["id", "accountId", "name", "createdAt"];'
    ),
    rule: "projection: the module imports nothing at all",
  },
  ];
}

test("the projection rules reject the defects they were written for", () => {
  for (const mutant of mutants()) {
    assert.notEqual(
      mutant.source,
      mutant.base,
      `${mutant.label}: the anchor text is stale, nothing was mutated`
    );

    const rule = PROJECT_RULES.find(
      (entry) => entry.label === mutant.rule
    );

    assert.ok(
      rule !== undefined,
      `${mutant.label} names "${mutant.rule}", which is not in the rule list`
    );

    assert.ok(
      failuresFor([rule], mutant.source).includes(mutant.rule),
      `${mutant.label} was not rejected by "${mutant.rule}"`
    );
  }
});

test("every projection mutant is rejected by at least one rule", () => {
  for (const mutant of mutants()) {
    assert.ok(
      failuresFor(PROJECT_RULES, mutant.source).length > 0,
      `${mutant.label} passed every rule`
    );
  }
});
