import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SERVER_DIR,
  AUTH_FILE,
  PROTO_DIR,
} from "./runtimePaths.js";

/* The accounts path is read through the module namespace, not as a named
   import: a named import of an export that does not exist yet stops the
   whole file from loading, which would hide every other result behind a
   link error. Read this way, a missing constant is one failing assertion
   that says what is missing. */

import * as RUNTIME_MODULE from "./runtimePaths.js";

/* ============================================================
   PHASE 4A TASK 6 — cwd-independent AUTH_FILE / PROTO_DIR

   Both paths used to be derived from process.cwd(), so the store
   and the protobuf directory moved with whatever directory the
   backend happened to be launched from. They are now derived from
   this module's own location. These tests prove two things:

     1. the resolved paths are exactly the ones the server/ layout
        already uses, so nothing is migrated or re-created, and
     2. the resolution does not change when the process is started
        from a different working directory (offline subprocess).

   Out of scope and pinned as unchanged: the manual live-socket
   scripts, the `observedVia: "server/ctrader-auth.json"` label, and
   dotenv resolution (recorded as a deferred finding instead).
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

function readSource(relative) {
  return fs
    .readFileSync(path.join(HERE, relative), "utf8")
    .replace(/\r\n/g, "\n");
}

const CREDENTIAL_NAMES = new Set([
  ".env",
  path.basename(AUTH_FILE),
  path.basename(RUNTIME_MODULE.ACCOUNTS_FILE),
]);

function isCredentialName(name) {
  return (
    CREDENTIAL_NAMES.has(name) ||
    name.startsWith(`${path.basename(AUTH_FILE)}.tmp-`) ||
    name.startsWith(`${path.basename(RUNTIME_MODULE.ACCOUNTS_FILE)}.tmp-`)
  );
}

/* Production sources, read as text and nothing else: no test file, and a
   credential file is recorded as refused instead of opened, because this
   guard has no reason to look inside one. The refusal list is returned so
   a test can prove the walk met a credential and kept away from it. */
function productionSources(dir = SERVER_DIR, root = dir, found = { sources: {}, refused: [] }) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path
      .relative(root, full)
      .split(path.sep)
      .join("/");

    if (isCredentialName(entry.name)) {
      found.refused.push(relative);
      continue;
    }

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") {
        productionSources(full, root, found);
      }

      continue;
    }

    if (!/\.[cm]?js$/.test(entry.name) || entry.name.endsWith(".test.js")) {
      continue;
    }

    found.sources[relative] = fs
      .readFileSync(full, "utf8")
      .replace(/\r\n/g, "\n");
  }

  return found;
}

// The module that declares the constant is not a consumer of it.
function consumersOfAccounts(sources) {
  return Object.entries(sources)
    .filter(
      ([name, text]) => name !== "runtimePaths.js" && /ACCOUNTS_FILE/.test(text)
    )
    .map(([name]) => name)
    .sort();
}

/* Each scoped store narrows what it persists through one `project`
   function, so those bodies — and only those bodies — are where the
   split either holds or leaks. They are found by matching braces from
   the declaration, which keeps a doc comment that names both domains
   out of the check. A missing or ambiguous projection is reported as
   null, because a rule that silently matched nothing would pass. */
function projectionBodies(text) {
  const signature = "function project(state) {";
  const bodies = [];

  let from = 0;

  for (;;) {
    const start = text.indexOf(signature, from);

    if (start === -1) {
      return bodies;
    }

    let depth = 0;
    let end = start + signature.length - 1;

    for (; end < text.length; end += 1) {
      if (text[end] === "{") {
        depth += 1;
      } else if (text[end] === "}") {
        depth -= 1;

        if (depth === 0) {
          break;
        }
      }
    }

    bodies.push(text.slice(start, end + 1));
    from = end + 1;
  }
}

function singleProjection(text, keyPattern) {
  const bodies = projectionBodies(text).filter((body) =>
    keyPattern.test(body)
  );

  return bodies.length === 1 ? bodies[0] : null;
}

/* Scratch directories this file creates, removed when the run ends. Only
   invented contents ever live here; the walk that proves the credential
   refusal is pointed at a copy of a directory shape, not at the server. */
const SCRATCH = [];

after(() => {
  for (const dir of SCRATCH) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const RUNTIME_SOURCE = readSource("./runtimePaths.js");
const ROUTE_SOURCE = readSource("./routes/ctrader.js");
const SERVICE_SOURCE = readSource("./services/ctraderService.js");
const ADAPTER_SOURCE = readSource("./brokers/ctraderAdapter.js");
const STORE_SOURCE = readSource("./services/ctraderStore.js");
const DOMAIN_SOURCE = readSource("./services/ctraderDomainStores.js");
const SCRIPT_SOURCES = {
  "ctrader-ws-test.js": readSource("./ctrader-ws-test.js"),
  "ctrader-ws-test-backup.js": readSource(
    "./ctrader-ws-test-backup.js"
  ),
  "ctrader-ws-test-before-account-auth.js": readSource(
    "./ctrader-ws-test-before-account-auth.js"
  ),
};

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
   BEHAVIOUR — the values themselves
   ============================================================ */

test("every exported runtime path is absolute", () => {
  for (const [name, value] of [
    ["SERVER_DIR", SERVER_DIR],
    ["AUTH_FILE", AUTH_FILE],
    ["PROTO_DIR", PROTO_DIR],
  ]) {
    assert.equal(
      path.isAbsolute(value),
      true,
      `${name} must be absolute, got ${value}`
    );
  }
});

test("SERVER_DIR is the directory holding this suite", () => {
  assert.equal(
    path.resolve(SERVER_DIR),
    path.resolve(HERE),
    "runtime paths must anchor to the server/ directory itself"
  );

  assert.equal(path.basename(SERVER_DIR), "server");
});

test("AUTH_FILE resolves to the same server/ctrader-auth.json as before the fix", () => {
  assert.equal(
    AUTH_FILE,
    path.join(path.resolve(HERE), "ctrader-auth.json"),
    "the store must stay exactly where the current launcher already puts it"
  );

  assert.equal(path.basename(AUTH_FILE), "ctrader-auth.json");
  assert.equal(path.dirname(AUTH_FILE), path.resolve(SERVER_DIR));
});

test("PROTO_DIR resolves to the server/openapi-proto-messages folder", () => {
  assert.equal(
    PROTO_DIR,
    path.join(path.resolve(HERE), "openapi-proto-messages")
  );

  assert.equal(
    path.basename(PROTO_DIR),
    "openapi-proto-messages"
  );

  assert.equal(path.dirname(PROTO_DIR), path.resolve(SERVER_DIR));
});

/* ============================================================
   THE ACCOUNTS METADATA PATH — Task 2.1-d Task 1

   A second path constant is added before any code reads it. That
   order is deliberate: this task is only the naming, the git
   exclusion and the guards, so that every later task that moves a
   field into the accounts file starts from a path that is already
   anchored, already ignored and already treated as sensitive.
   ============================================================ */

test("ACCOUNTS_FILE resolves beside the server directory under its own name", () => {
  assert.equal(
    RUNTIME_MODULE.ACCOUNTS_FILE,
    path.join(path.resolve(HERE), "ctrader-accounts.json"),
    "the accounts metadata store must be the file the audit names, in the directory the launcher already uses"
  );

  assert.equal(
    path.basename(RUNTIME_MODULE.ACCOUNTS_FILE),
    "ctrader-accounts.json"
  );

  assert.equal(
    path.dirname(RUNTIME_MODULE.ACCOUNTS_FILE),
    path.resolve(SERVER_DIR)
  );

  assert.equal(
    path.isAbsolute(RUNTIME_MODULE.ACCOUNTS_FILE),
    true,
    "an unanchored accounts path would move with the working directory"
  );
});

test("the accounts path is a different file from the credential path", () => {
  assert.equal(
    typeof RUNTIME_MODULE.ACCOUNTS_FILE,
    "string",
    "ACCOUNTS_FILE is not exported, so there is nothing to compare with the credential path"
  );

  /* The whole point of the split is that an account reader cannot
     reach the tokens. That starts by the two paths not resolving to
     the same artifact. */
  assert.notEqual(
    RUNTIME_MODULE.ACCOUNTS_FILE,
    AUTH_FILE,
    "a metadata store that resolves to the credential file would hand every account reader the access token"
  );

  assert.notEqual(
    path.basename(RUNTIME_MODULE.ACCOUNTS_FILE),
    path.basename(AUTH_FILE)
  );
});

test("only migration and domain stores consume ACCOUNTS_FILE while runtime stays combined", () => {
  // Copy-only migration must not switch runtime readers to the destination.
  for (const [name, text] of [
    ["services/ctraderStore.js", STORE_SOURCE],
    ["routes/ctrader.js", ROUTE_SOURCE],
    ["services/ctraderService.js", SERVICE_SOURCE],
    ["brokers/ctraderAdapter.js", ADAPTER_SOURCE],
  ]) {
    assert.ok(
      !/ACCOUNTS_FILE/.test(text),
      `${name} already references ACCOUNTS_FILE; the split was not scheduled to start`
    );
  }

  const walk = productionSources();

  assert.deepEqual(consumersOfAccounts(walk.sources), [
    "services/ctraderAccountMigration.js",
    "services/ctraderDomainStores.js",
  ]);

  // The scan never reads a credential: every entry it kept away from is
  // a name on the refusal list, and none of them reached the sources.
  for (const refused of walk.refused) {
    assert.equal(
      isCredentialName(path.basename(refused)),
      true,
      `${refused} was refused for a reason the guard does not list`
    );

    assert.equal(
      Object.hasOwn(walk.sources, refused),
      false,
      `${refused} is on the refusal list and in the sources, so it was opened anyway`
    );
  }

  // And the scan is shown to bite: a route that began reading the
  // accounts file has to be the file the guard names.
  assert.deepEqual(
    consumersOfAccounts({
      "services/ctraderDomainStores.js": DOMAIN_SOURCE,
      "routes/ctrader.js": `${ROUTE_SOURCE}\nimport { ACCOUNTS_FILE } from "../runtimePaths.js";\n`,
    }),
    ["routes/ctrader.js", "services/ctraderDomainStores.js"],
    "a route that started consuming the accounts path went unreported"
  );
});

test("the source walk refuses a credential file beside the files it reads", (t) => {
  const dir = path.join(os.tmpdir(), "virtual-runtime-scan");
  const refusedNames = [
    ".env",
    "ctrader-auth.json",
    "ctrader-accounts.json",
    "ctrader-auth.json.tmp-123-abcdef",
    "ctrader-accounts.json.tmp-456-ghijkl",
    "ctrader-auth.json.tmp-123-abcdef.js",
    "ctrader-accounts.json.tmp-456-ghijkl.js",
  ];
  const sources = {
    "source.js": 'import { ACCOUNTS_FILE } from "../runtimePaths.js";\n',
    "ctrader-auth.json.backup.js": "export const unrelated = true;\n",
    "ctrader-accounts.json.bak.js": "export const unrelated = true;\n",
    "ctrader-authentication.json.tmp-123-abcdef.js": "export const unrelated = true;\n",
  };

  // Virtual entries exercise refusal without creating credential-shaped files.
  t.mock.method(fs, "readdirSync", (directory) => {
    assert.equal(directory, dir);
    return [...refusedNames, ...Object.keys(sources)].map((name) => ({
      name,
      isDirectory: () => false,
    }));
  });
  t.mock.method(fs, "readFileSync", (filePath) => {
    assert.equal(path.dirname(filePath), dir);
    const name = path.basename(filePath);
    assert.ok(Object.hasOwn(sources, name), "the source walk attempted a credential read");
    return sources[name];
  });

  const walk = productionSources(dir);

  assert.deepEqual(walk.sources, sources);
  assert.deepEqual(
    walk.refused.slice().sort(),
    refusedNames.slice().sort(),
    "the walk must record every permanent and temporary credential name it refuses"
  );
});

test("both cTrader store files are excluded from the repository", () => {
  const ignored = readSource("../.gitignore")
    .split(/\n/)
    .map((line) => line.trim());

  for (const entry of [
    "server/ctrader-auth.json",
    "server/ctrader-accounts.json",
    "server/ctrader-auth.json.tmp-*",
    "server/ctrader-accounts.json.tmp-*",
  ]) {
    assert.ok(
      ignored.includes(entry),
      `.gitignore must list ${entry} on its own line, so no account data or token is ever committed`
    );
  }
});

test("the anchored paths still point at real files on disk", () => {
  assert.equal(
    fs.existsSync(PROTO_DIR),
    true,
    "the proto directory must be reachable without relying on cwd"
  );

  const protoFiles = fs
    .readdirSync(PROTO_DIR)
    .filter((file) => file.endsWith(".proto"));

  assert.deepEqual(
    protoFiles.slice().sort(),
    [
      "OpenApiCommonMessages.proto",
      "OpenApiCommonModelMessages.proto",
      "OpenApiMessages.proto",
      "OpenApiModelMessages.proto",
    ],
    "the four shipped proto files must be the ones the anchored directory holds"
  );
});

test("the anchored proto path is the one the service loader uses", () => {
  assert.match(
    SERVICE_SOURCE,
    /fs\.existsSync\(\s*PROTO_DIR\s*\)/,
    "the loader must consult the anchored PROTO_DIR, not a local copy"
  );
});

/* ============================================================
   BEHAVIOUR — cwd independence, proven offline in a child process
   ============================================================ */

const CHILD_SOURCE = [
  `import { SERVER_DIR, AUTH_FILE, PROTO_DIR, ACCOUNTS_FILE } from ${JSON.stringify(
    pathToFileURL(path.join(HERE, "runtimePaths.js")).href
  )};`,
  "console.log(JSON.stringify({",
  "  cwd: process.cwd(),",
  "  SERVER_DIR,",
  "  AUTH_FILE,",
  "  PROTO_DIR,",
  "  ACCOUNTS_FILE,",
  "}));",
].join("\n");

const CHILD_KEYS = [
  "cwd",
  "SERVER_DIR",
  "AUTH_FILE",
  "PROTO_DIR",
  "ACCOUNTS_FILE",
];

function resolveFromChildDirectory(cwd) {
  const run = spawnSync(
    process.execPath,
    ["--input-type=module", "-"],
    {
      cwd,
      input: CHILD_SOURCE,
      encoding: "utf8",
    }
  );

  assert.equal(
    run.status,
    0,
    `child failed in ${cwd}: ${run.stderr?.trim() || run.stdout}`
  );

  return JSON.parse(run.stdout.trim());
}

test("the child really runs from a different working directory", () => {
  const temp = resolveFromChildDirectory(os.tmpdir());

  assert.equal(
    path.resolve(temp.cwd),
    path.resolve(os.tmpdir()),
    "the subprocess must actually have been started from os.tmpdir()"
  );

  assert.notEqual(
    path.resolve(temp.cwd),
    path.resolve(SERVER_DIR),
    "a different cwd is what makes this a cwd-independence test"
  );
});

test("resolved paths are identical when cwd is the system temp dir", () => {
  const temp = resolveFromChildDirectory(os.tmpdir());

  assert.equal(temp.SERVER_DIR, SERVER_DIR);
  assert.equal(temp.AUTH_FILE, AUTH_FILE);
  assert.equal(temp.PROTO_DIR, PROTO_DIR);
  assert.equal(
    temp.ACCOUNTS_FILE,
    RUNTIME_MODULE.ACCOUNTS_FILE,
    "the accounts path must not move with the working directory either"
  );
});

test("resolved paths are identical when cwd is the repository root", () => {
  const repoRoot = path.dirname(path.resolve(SERVER_DIR));

  const fromRoot = resolveFromChildDirectory(repoRoot);

  assert.equal(path.resolve(fromRoot.cwd), path.resolve(repoRoot));
  assert.equal(fromRoot.AUTH_FILE, AUTH_FILE);
  assert.equal(fromRoot.PROTO_DIR, PROTO_DIR);
  assert.equal(fromRoot.ACCOUNTS_FILE, RUNTIME_MODULE.ACCOUNTS_FILE);
});

test("the offline probe touches nothing but the pure module", () => {
  for (const forbidden of [
    "WebSocket",
    "fetch(",
    "listen(",
    "dotenv",
    "ctraderService",
    "ctraderApi",
    "readFileSync",
    "writeFileSync",
  ]) {
    assert.ok(
      !CHILD_SOURCE.includes(forbidden),
      `the child source must not mention ${forbidden}`
    );
  }
});

test("the child prints only the five resolved values", () => {
  const raw = spawnSync(
    process.execPath,
    ["--input-type=module", "-"],
    {
      cwd: os.tmpdir(),
      input: CHILD_SOURCE,
      encoding: "utf8",
    }
  );

  assert.equal(
    raw.stdout.split(/\r?\n/).filter(Boolean).length,
    1,
    "the child must emit exactly one line of output"
  );

  assert.deepEqual(
    Object.keys(JSON.parse(raw.stdout.trim())).sort(),
    CHILD_KEYS.slice().sort(),
    "the child must print no secret material and no extra keys"
  );

  assert.equal(raw.stderr.trim(), "");
});

/* ============================================================
   SOURCE CONTRACTS
   ============================================================ */

const RUNTIME_RULES = [
  {
    label: "runtime: the module anchors on its own URL",
    passes: (text) =>
      /import\.meta\.url/.test(text) &&
      /fileURLToPath\(/.test(text) &&
      /path\.dirname\(\s*fileURLToPath\(\s*import\.meta\.url\s*\)\s*\)/.test(
        text
      ),
  },
  {
    label: "runtime: no process.cwd() anywhere",
    passes: (text) => !/process\.cwd\(/.test(text),
  },
  {
    label: "runtime: AUTH_FILE joins SERVER_DIR and the unchanged store name",
    passes: (text) =>
      /AUTH_FILE\s*=\s*path\.join\(\s*SERVER_DIR,\s*"ctrader-auth\.json"\s*\)/.test(
        text
      ),
  },
  {
    label: "runtime: PROTO_DIR joins SERVER_DIR and the unchanged folder name",
    passes: (text) =>
      /PROTO_DIR\s*=\s*path\.join\(\s*SERVER_DIR,\s*"openapi-proto-messages"\s*\)/.test(
        text
      ),
  },
  {
    label: "runtime: ACCOUNTS_FILE joins SERVER_DIR and the accounts store name",
    passes: (text) =>
      /ACCOUNTS_FILE\s*=\s*path\.join\(\s*SERVER_DIR,\s*"ctrader-accounts\.json"\s*\)/.test(
        text
      ),
  },
  {
    label: "runtime: the two cTrader store names are not the same file",
    passes: (text) => {
      const auth = /AUTH_FILE\s*=\s*path\.join\(\s*SERVER_DIR,\s*"([^"]+)"\s*\)/.exec(
        text
      );
      const accounts =
        /ACCOUNTS_FILE\s*=\s*path\.join\(\s*SERVER_DIR,\s*"([^"]+)"\s*\)/.exec(
          text
        );

      return (
        auth !== null &&
        accounts !== null &&
        auth[1] !== accounts[1]
      );
    },
  },
  {
    label: "runtime: no parent-directory escape",
    passes: (text) => !/"\.\."|\.\.\//.test(text),
  },
  {
    label: "runtime: the module performs no I/O and reads no environment",
    passes: (text) =>
      !/\bfs\b|node:fs|dotenv|process\.env|WebSocket|fetch\(|protobuf|net\b|http/.test(
        text
      ),
  },
  {
    label: "runtime: all four values are exported",
    passes: (text) =>
      /export const SERVER_DIR/.test(text) &&
      /export const AUTH_FILE/.test(text) &&
      /export const PROTO_DIR/.test(text) &&
      /export const ACCOUNTS_FILE/.test(text),
  },
];

const ROUTE_RULES = [
  {
    label: "route: no process.cwd() anywhere",
    passes: (text) => !/process\.cwd\(/.test(text),
  },
  {
    label: "route: AUTH_FILE is imported from the shared runtime module",
    passes: (text) =>
      /import\s*\{\s*AUTH_FILE\s*\}\s*from\s*"\.\.\/runtimePaths\.js"/.test(
        text
      ),
  },
  {
    label: "route: the store path is no longer derived in the route file",
    passes: (text) =>
      !/const AUTH_FILE\s*=/.test(text) && !/path\.join\(/.test(text),
  },
  {
    label: "route: the now-unused path import is gone",
    passes: (text) => !/import path from/.test(text),
  },
  {
    label: "route: the store is reached through a path injected from AUTH_FILE",
    passes: (text) =>
      /createCtraderStore\(\s*\{[^}]*filePath:\s*AUTH_FILE[^}]*\}/.test(text),
  },
  {
    label: "route: the store file is never opened from the route file",
    passes: (text) => !/\bfs\b/.test(text),
  },
];

const STORE_RULES = [
  {
    label: "store: no process.cwd() anywhere",
    passes: (text) => !/process\.cwd\(/.test(text),
  },
  {
    label: "store: AUTH_FILE is imported from the shared runtime module",
    passes: (text) =>
      /import\s*\{\s*AUTH_FILE\s*\}\s*from\s*"\.\.\/runtimePaths\.js"/.test(
        text
      ),
  },
  {
    label: "store: the default path is the shared constant, not a re-derivation",
    passes: (text) =>
      /filePath\s*=\s*AUTH_FILE/.test(text) &&
      !/const AUTH_FILE\s*=/.test(text) &&
      !/path\.join\(/.test(text),
  },
  {
    label: "store: every read, write and delete goes through the injected path",
    passes: (text) =>
      /fileSystem\.existsSync\(\s*filePath\s*\)/.test(text) &&
      /fileSystem\.readFileSync\(\s*filePath/.test(text) &&
      /fileSystem\.renameSync\(\s*tempPath\s*,\s*filePath\s*\)/.test(text) &&
      /fileSystem\.unlinkSync\(\s*filePath\s*\)/.test(text) &&
      !/fileSystem\.\w+\(\s*AUTH_FILE/.test(text) &&
      !/fs\.\w+\(/.test(text),
  },
  {
    label: "store: the file system itself is injectable, with the real one as the default",
    passes: (text) =>
      /const \{ filePath = AUTH_FILE, fileSystem = fs \} = options;/.test(
        text
      ),
  },
  {
    label: "store: neither cTrader file name is spelled out beside the injected path",
    passes: (text) =>
      !/["'`]ctrader-auth\.json/.test(text) &&
      !/["'`]ctrader-accounts\.json/.test(text),
  },
  {
    label: "store: the complete state is serialized before the destination is touched",
    passes: (text) => {
      const serialized = text.indexOf("JSON.stringify(state");
      const opened = text.indexOf("fileSystem.openSync");

      return serialized !== -1 && opened !== -1 && serialized < opened;
    },
  },
  {
    label: "store: the temporary file is named beside the destination and created exclusively",
    passes: (text) =>
      /\.tmp-\$\{process\.pid\}-\$\{Math\.random\(\)/.test(text) &&
      /fileSystem\.openSync\(\s*tempPath\s*,\s*"wx"\s*\)/.test(text),
  },
  {
    label: "store: the destination is replaced by a rename, never truncated in place",
    passes: (text) =>
      /fileSystem\.renameSync\(\s*tempPath\s*,\s*filePath\s*\)/.test(text) &&
      !/writeFileSync\(/.test(text),
  },
  {
    label: "store: the bytes are flushed and the handle closed before the replacement",
    passes: (text) => {
      const flushed = text.indexOf("fileSystem.fsyncSync");
      const closed = text.indexOf("fileSystem.closeSync");
      const renamed = text.indexOf("fileSystem.renameSync");

      return (
        flushed !== -1 &&
        closed !== -1 &&
        renamed !== -1 &&
        flushed < closed &&
        closed < renamed
      );
    },
  },
  {
    label: "store: a failed write takes its temporary file with it",
    passes: (text) =>
      /const cleanupError = removeQuietly\(tempPath\);/.test(text) &&
      /if \(cleanupError !== null\) \{/.test(text),
  },
  {
    label: "store: a refused persistence reaches the caller, not only the log",
    passes: (text) =>
      /throw persistenceError\(/.test(text) &&
      !/Failed to save cTrader auth/.test(text) &&
      !/Failed to remove saved auth/.test(text),
  },
  {
    label: "store: the persistence error quotes no filesystem message",
    passes: (text) => {
      const start = text.indexOf("function persistenceError(");
      const end = text.indexOf("\n  }", start);

      if (start === -1 || end === -1) {
        return false;
      }

      const body = text.slice(start, end);

      // A filesystem message repeats the path the operation was asked
      // to use, and callers of this module put error messages into
      // HTTP bodies.
      return !/\.message/.test(body) && /cause\.code/.test(body);
    },
  },
  {
    label: "store: the seam imports nothing but the file system, the process module, the selection rule and the runtime paths",
    passes: (text) =>
      [
        ...text.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ]
        .map(([, specifier]) => specifier)
        .sort()
        .join("|") ===
      [
        "../runtimePaths.js",
        "./ctraderAccountSelection.js",
        "fs",
        "node:process",
      ]
        .sort()
        .join("|"),
  },
];

/* Task 2.1-d Task 2 — the two scoped stores.

   These rules are the static half of the split. The behaviour tests in
   services/ctraderDomainStores.test.js put bytes through the stores;
   what these pin is that the module cannot quietly start re-deriving a
   path, re-implementing the atomic write, or widening one projection
   until it carries the other domain's fields. A projection rule that
   cannot find exactly one matching body fails rather than passing, so a
   restructured module cannot make the guard silently vacuous. */
const SPLIT_RULES = [
  {
    label: "split: no process.cwd() anywhere",
    passes: (text) => !/process\.cwd\(/.test(text),
  },
  {
    label: "split: no path is derived in the scoped stores",
    passes: (text) => !/path\.join\(/.test(text) && !/import path from/.test(text),
  },
  {
    label: "split: neither cTrader file name is spelled out",
    passes: (text) =>
      !/["'`]ctrader-auth\.json/.test(text) &&
      !/["'`]ctrader-accounts\.json/.test(text),
  },
  {
    label: "split: both paths come from the shared runtime module",
    passes: (text) =>
      /import\s*\{[^}]*\bAUTH_FILE\b[^}]*\bACCOUNTS_FILE\b[^}]*\}\s*from\s*"\.\.\/runtimePaths\.js"/.test(
        text
      ) &&
      !/const AUTH_FILE\s*=/.test(text) &&
      !/const ACCOUNTS_FILE\s*=/.test(text),
  },
  {
    label: "split: the credential store defaults to the credential path",
    passes: (text) =>
      /export function createCtraderAuthStore\(options = \{\}\) \{\s*const \{ filePath = AUTH_FILE, fileSystem = fs \} = options;/.test(
        text
      ),
  },
  {
    label: "split: the accounts store defaults to the accounts path",
    passes: (text) =>
      /export function createCtraderAccountsStore\(options = \{\}\) \{\s*const \{ filePath = ACCOUNTS_FILE, fileSystem = fs \} = options;/.test(
        text
      ),
  },
  {
    label: "split: persistence is delegated to the hardened store, never re-implemented",
    passes: (text) =>
      /createCtraderStore\(\s*\{\s*filePath,\s*fileSystem\s*\}\s*\)/.test(text) &&
      /engine\.save\(/.test(text) &&
      /clear:\s*engine\.clear/.test(text) &&
      !/openSync|renameSync|fsyncSync|writeFileSync|temporaryPath/.test(text),
  },
  {
    label: "split: the credential projection names no account field",
    passes: (text) => {
      const body = singleProjection(text, /accessToken:/);

      return (
        body !== null && !/accounts/.test(body) && !/activeAccountId/.test(body)
      );
    },
  },
  {
    label: "split: the account projection names no credential field",
    passes: (text) => {
      const body = singleProjection(text, /activeAccountId:/);

      return (
        body !== null &&
        !/accessToken/.test(body) &&
        !/refreshToken/.test(body) &&
        !/expiresIn/.test(body) &&
        !/connected/.test(body)
      );
    },
  },
  {
    label: "split: the module imports nothing but the file system, the runtime paths and the store",
    passes: (text) =>
      [
        ...text.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ]
        .map(([, specifier]) => specifier)
        .sort()
        .join("|") ===
      ["../runtimePaths.js", "./ctraderStore.js", "fs"].sort().join("|"),
  },
];

const SERVICE_RULES = [
  {
    label: "service: no process.cwd() anywhere",
    passes: (text) => !/process\.cwd\(/.test(text),
  },
  {
    label: "service: PROTO_DIR is imported from the shared runtime module",
    passes: (text) =>
      /import\s*\{\s*PROTO_DIR\s*\}\s*from\s*"\.\.\/runtimePaths\.js"/.test(
        text
      ),
  },
  {
    label: "service: PROTO_DIR is not re-derived locally",
    passes: (text) => !/PROTO_DIR\s*=/.test(text),
  },
  {
    label: "service: the proto loader still reads the anchored directory",
    passes: (text) =>
      /fs\.existsSync\(\s*PROTO_DIR\s*\)/.test(text) &&
      /readdirSync\(\s*PROTO_DIR\s*\)/.test(text),
  },
];

const ADAPTER_RULES = [
  {
    label: "adapter: the WS_URL limitation names the constant, not a line number",
    passes: (text) =>
      /the WS_URL constant in server\/services\/ctraderService\.js/.test(
        text
      ) && !/ctraderService\.js:\d+/.test(text),
  },
  {
    label: "adapter: the limitation keeps its meaning",
    passes: (text) =>
      /hardcoded demo endpoint/.test(text) &&
      /live-account connections are not currently possible/.test(text),
  },
  {
    label: "adapter: the observedVia label is unchanged",
    passes: (text) =>
      /observedVia:\s*"server\/ctrader-auth\.json"/.test(text),
  },
];

const SCRIPT_RULES = [
  {
    label: "scripts: the manual live-socket scripts stay untouched by the fix",
    passes: (text) => !/runtimePaths\.js/.test(text),
  },
  {
    label: "scripts: the manual live-socket scripts keep their own proto resolution",
    passes: (text) =>
      /PROTO_DIR/.test(text) || /openapi-proto-messages/.test(text),
  },
];

test("runtimePaths.js follows every rule", () => {
  assertClean(RUNTIME_RULES, RUNTIME_SOURCE, "runtimePaths.js");
});

test("routes/ctrader.js follows every rule", () => {
  assertClean(ROUTE_RULES, ROUTE_SOURCE, "routes/ctrader.js");
});

test("services/ctraderService.js follows every rule", () => {
  assertClean(SERVICE_RULES, SERVICE_SOURCE, "services/ctraderService.js");
});

test("brokers/ctraderAdapter.js follows every rule", () => {
  assertClean(ADAPTER_RULES, ADAPTER_SOURCE, "brokers/ctraderAdapter.js");
});

test("services/ctraderStore.js follows every rule", () => {
  assertClean(STORE_RULES, STORE_SOURCE, "services/ctraderStore.js");
});

test("services/ctraderDomainStores.js follows every rule", () => {
  assertClean(SPLIT_RULES, DOMAIN_SOURCE, "services/ctraderDomainStores.js");
});

test("no production file derives a runtime path from the working directory", () => {
  for (const [name, text] of [
    ["runtimePaths.js", RUNTIME_SOURCE],
    ["routes/ctrader.js", ROUTE_SOURCE],
    ["services/ctraderService.js", SERVICE_SOURCE],
    ["services/ctraderStore.js", STORE_SOURCE],
    ["services/ctraderDomainStores.js", DOMAIN_SOURCE],
  ]) {
    assert.ok(
      !/process\.cwd\(/.test(text),
      `${name} still calls process.cwd()`
    );
  }
});

test("the manual live-socket scripts were not pulled into the fix", () => {
  for (const [name, text] of Object.entries(SCRIPT_SOURCES)) {
    assertClean(SCRIPT_RULES, text, name);
  }
});

/* ============================================================
   BEFORE-FIX FIXTURE + MUTANTS
   ============================================================ */

const PRE_FIX_RUNTIME = [
  'import path from "path";',
  "",
  "export const SERVER_DIR = process.cwd();",
  'export const AUTH_FILE = path.join(process.cwd(), "ctrader-auth.json");',
  'export const PROTO_DIR = path.join(',
  '  process.cwd(),',
  '  "openapi-proto-messages"',
  ");",
].join("\n");

test("the pre-fix implementation is rejected by the runtime rules", () => {
  const failures = failuresFor(RUNTIME_RULES, PRE_FIX_RUNTIME);

  assert.ok(
    failures.length >= 3,
    `the old cwd-based module must break several rules, got: ${failures.join(" | ")}`
  );

  assert.ok(
    failures.some((label) => label.startsWith("runtime: no process.cwd")),
    `expected the process.cwd() rule to reject it, got: ${failures.join(" | ")}`
  );
});

const PRE_FIX_ROUTE = [
  'import path from "path";',
  'const AUTH_FILE = path.join(process.cwd(), "ctrader-auth.json");',
  'fs.existsSync(AUTH_FILE)',
  'fs.readFileSync(AUTH_FILE, "utf8")',
  'fs.writeFileSync(AUTH_FILE, JSON.stringify(ctraderAuth, null, 2), "utf8")',
].join("\n");

test("the pre-fix route file is rejected by the route rules", () => {
  const failures = failuresFor(ROUTE_RULES, PRE_FIX_ROUTE);

  assert.ok(
    failures.length >= 3,
    `the old route derivation must break several rules, got: ${failures.join(" | ")}`
  );
});

/* Task 2.1-b moved the storage calls out of the route, so the route
   rules must reject the file as it stood immediately before the
   extraction — otherwise the retargeted rules would be vacuous. */

const PRE_EXTRACTION_ROUTE = [
  'import { AUTH_FILE } from "../runtimePaths.js";',
  'import fs from "fs";',
  "",
  "function loadSavedAuth() {",
  "  if (!fs.existsSync(AUTH_FILE)) {",
  '    const savedData = fs.readFileSync(AUTH_FILE, "utf8");',
  "    const parsed = JSON.parse(savedData);",
  "    const state = {",
  "      connected: Boolean(parsed.connected),",
  "      accounts,",
  "      activeAccountId: storedSelection.accountId,",
  "    };",
  "  }",
  "}",
  "",
  "function saveAuth() {",
  "  fs.writeFileSync(AUTH_FILE, JSON.stringify(ctraderAuth, null, 2), \"utf8\");",
  "}",
  "",
  "function clearSavedAuth() {",
  "  if (fs.existsSync(AUTH_FILE)) {",
  "    fs.unlinkSync(AUTH_FILE);",
  "  }",
  "}",
].join("\n");

test("the pre-extraction route file is rejected by the route rules", () => {
  const failures = failuresFor(ROUTE_RULES, PRE_EXTRACTION_ROUTE);

  assert.ok(
    failures.length >= 2,
    `the route that owned the file directly must break several rules, got: ${failures.join(" | ")}`
  );

  assert.ok(
    failures.includes(
      "route: the store is reached through a path injected from AUTH_FILE"
    ),
    `expected the injection rule to reject it, got: ${failures.join(" | ")}`
  );
});

/* Task 2.1-c replaced the truncating write and the logged-and-ignored
   failure, so the store rules above must reject the file exactly as
   Task 2.1-b left it. Without this fixture the new rules could be
   describing a shape no implementation ever had. */

const PRE_ATOMIC_STORE = [
  'import fs from "fs";',
  'import { AUTH_FILE } from "../runtimePaths.js";',
  "",
  "export function createCtraderStore(options = {}) {",
  "  const { filePath = AUTH_FILE } = options;",
  "",
  "  function load() {",
  "    if (!fs.existsSync(filePath)) {",
  '      const savedData = fs.readFileSync(filePath, "utf8");',
  "      return JSON.parse(savedData);",
  "    }",
  "  }",
  "",
  "  function save(state) {",
  "    try {",
  '      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");',
  '      console.log("saved");',
  "    } catch (error) {",
  '      console.error("Failed to save cTrader auth:", error.message);',
  "    }",
  "  }",
  "",
  "  function clear() {",
  "    if (fs.existsSync(filePath)) {",
  "      fs.unlinkSync(filePath);",
  "    }",
  "  }",
  "",
  "  return { filePath, load, save, clear };",
  "}",
].join("\n");

test("the pre-atomic store is rejected by the store rules", () => {
  const failures = failuresFor(STORE_RULES, PRE_ATOMIC_STORE);

  assert.ok(
    failures.length >= 5,
    `a store that truncated and swallowed must break several rules, got: ${failures.join(" | ")}`
  );

  for (const expected of [
    "store: the destination is replaced by a rename, never truncated in place",
    "store: a refused persistence reaches the caller, not only the log",
  ]) {
    assert.ok(
      failures.includes(expected),
      `expected "${expected}" to reject it, got: ${failures.join(" | ")}`
    );
  }
});

const MUTANTS = [
  {
    label: "M1 AUTH_FILE falls back to process.cwd()",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      /AUTH_FILE = path\.join\(\s*SERVER_DIR,\s*"ctrader-auth\.json"\s*\)/,
      'AUTH_FILE = path.join(process.cwd(), "ctrader-auth.json")'
    ),
    rules: RUNTIME_RULES,
  },
  {
    label: "M2 PROTO_DIR falls back to process.cwd()",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      /PROTO_DIR = path\.join\(\s*SERVER_DIR,\s*"openapi-proto-messages"\s*\)/,
      'PROTO_DIR = path.join(process.cwd(), "openapi-proto-messages")'
    ),
    rules: RUNTIME_RULES,
  },
  {
    label: "M3 the store escapes to the repository root",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      /AUTH_FILE = path\.join\(\s*SERVER_DIR,\s*"ctrader-auth\.json"\s*\)/,
      'AUTH_FILE = path.join(SERVER_DIR, "..", "ctrader-auth.json")'
    ),
    rules: RUNTIME_RULES,
  },
  {
    label: "M4 the store file is renamed",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      /AUTH_FILE = path\.join\(\s*SERVER_DIR,\s*"ctrader-auth\.json"\s*\)/,
      'AUTH_FILE = path.join(SERVER_DIR, "auth.json")'
    ),
    rules: RUNTIME_RULES,
  },
  {
    label: "M5 the route re-derives its own store path",
    base: ROUTE_SOURCE,
    source: ROUTE_SOURCE.replace(
      /import \{\s*AUTH_FILE\s*\} from "\.\.\/runtimePaths\.js";/,
      'const AUTH_FILE = path.join(process.cwd(), "ctrader-auth.json");'
    ),
    rules: ROUTE_RULES,
  },
  {
    label: "M6 the service re-derives its own proto directory",
    base: SERVICE_SOURCE,
    source: SERVICE_SOURCE.replace(
      /import \{\s*PROTO_DIR\s*\} from "\.\.\/runtimePaths\.js";/,
      'const PROTO_DIR = path.join(process.cwd(), "openapi-proto-messages");'
    ),
    rules: SERVICE_RULES,
  },
  {
    label: "M7 the limitation restores the brittle line number",
    base: ADAPTER_SOURCE,
    source: ADAPTER_SOURCE.replace(
      /the WS_URL constant in server\/services\/ctraderService\.js/,
      "server/services/ctraderService.js:13"
    ),
    rules: ADAPTER_RULES,
  },
  {
    label: "M8 the observedVia label is rewritten",
    base: ADAPTER_SOURCE,
    source: ADAPTER_SOURCE.replace(
      /observedVia:\s*"server\/ctrader-auth\.json"/,
      'observedVia: "ctrader-auth.json"'
    ),
    rules: ADAPTER_RULES,
  },
  {
    label: "M9 the route builds the store without naming the file",
    base: ROUTE_SOURCE,
    source: ROUTE_SOURCE.replace(
      /createCtraderStore\(\{ filePath: AUTH_FILE \}\)/,
      "createCtraderStore()"
    ),
    rules: ROUTE_RULES,
  },
  {
    label: "M10 the store ignores the injected path when it reads",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /fileSystem\.readFileSync\(filePath, "utf8"\)/,
      'fileSystem.readFileSync(AUTH_FILE, "utf8")'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M11 the store defaults to a working-directory path",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /const \{ filePath = AUTH_FILE, fileSystem = fs \} = options;/,
      'const filePath = path.join(process.cwd(), "ctrader-auth.json");'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M12 the store hardcodes the file name beside the directory",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /const \{ filePath = AUTH_FILE, fileSystem = fs \} = options;/,
      'const filePath = path.join(SERVER_DIR, "ctrader-auth.json");'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M13 the store replaces the production file instead of the injected one",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /fileSystem\.renameSync\(tempPath, filePath\)/,
      "fileSystem.renameSync(tempPath, AUTH_FILE)"
    ),
    rules: STORE_RULES,
  },
  {
    label: "M14 the store deletes the production file instead of the injected one",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /fileSystem\.unlinkSync\(\s*filePath\s*\)/,
      "fileSystem.unlinkSync(AUTH_FILE)"
    ),
    rules: STORE_RULES,
  },
  {
    label: "M15 the store truncates the destination instead of replacing it",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /run\("write", "save", \(\) => writeAll\(handle, serialized\)\);/,
      'fileSystem.writeFileSync(filePath, serialized, "utf8");'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M16 the store renames before the bytes are flushed",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /run\("flush", "save", \(\) => fileSystem\.fsyncSync\(handle\)\);/,
      ""
    ),
    rules: STORE_RULES,
  },
  {
    label: "M17 the store gives every write the same temporary name",
    base: STORE_SOURCE,
    // Anchored on the temporary name itself: the store also builds a
    // random local account id, and an unanchored anchor would mutate
    // that instead and leave the write collision-prone.
    source: STORE_SOURCE.replace(
      /\.tmp-\$\{process\.pid\}-\$\{Math\.random\(\)\s*\.toString\(36\)\s*\.slice\(2, 8\)\}/,
      '.tmp-fixed'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M18 the store logs a refused write and reports success",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /const cleanupError = removeQuietly\(tempPath\);/,
      'console.error("Failed to save cTrader auth:", error.message);\n\n      const cleanupError = null;'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M19 ACCOUNTS_FILE names the credential file",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      /ACCOUNTS_FILE = path\.join\(\s*SERVER_DIR,\s*"ctrader-accounts\.json"\s*\)/,
      'ACCOUNTS_FILE = path.join(SERVER_DIR, "ctrader-auth.json")'
    ),
    rules: RUNTIME_RULES,
  },
  {
    label: "M20 the store re-derives the accounts file name beside the directory",
    base: STORE_SOURCE,
    source: STORE_SOURCE.replace(
      /const \{ filePath = AUTH_FILE, fileSystem = fs \} = options;/,
      'const filePath = path.join(SERVER_DIR, "ctrader-accounts.json");'
    ),
    rules: STORE_RULES,
  },
  {
    label: "M21 the accounts store re-derives its path from the working directory",
    base: DOMAIN_SOURCE,
    source: DOMAIN_SOURCE.replace(
      /const \{ filePath = ACCOUNTS_FILE, fileSystem = fs \} = options;/,
      'const filePath = path.join(process.cwd(), "ctrader-accounts.json");'
    ),
    rules: SPLIT_RULES,
  },
  {
    label: "M22 the credential store persists the account list",
    base: DOMAIN_SOURCE,
    source: DOMAIN_SOURCE.replace(
      /accessToken: state\.accessToken \|\| null,/,
      "accessToken: state.accessToken || null,\n      accounts: state.accounts || [],"
    ),
    rules: SPLIT_RULES,
  },
  {
    label: "M23 the accounts store persists the access token",
    base: DOMAIN_SOURCE,
    source: DOMAIN_SOURCE.replace(
      /activeAccountId: state\.activeAccountId \?\? null,/,
      "activeAccountId: state.activeAccountId ?? null,\n      accessToken: state.accessToken || null,"
    ),
    rules: SPLIT_RULES,
  },
  {
    label: "M24 a scoped store writes its own file instead of delegating the atomic write",
    base: DOMAIN_SOURCE,
    source: DOMAIN_SOURCE.replace(
      /engine\.save\(project\(state\)\);/,
      'fileSystem.writeFileSync(filePath, JSON.stringify(project(state)), "utf8");'
    ),
    rules: SPLIT_RULES,
  },
];

/* Every other mutant is only required to be rejected by *a* rule. These
   exist to prove the rules added by the tasks that carry them are not
   vacuous, so each is checked against the one rule that names its
   defect: a rule nobody has watched fail is a rule that may be passing
   everything. */

test("the new rules reject the defects they were written for", () => {
  const byLabel = new Map(MUTANTS.map((mutant) => [mutant.label, mutant]));

  for (const [mutantLabel, ruleLabel] of [
    [
      "M19 ACCOUNTS_FILE names the credential file",
      "runtime: the two cTrader store names are not the same file",
    ],
    [
      "M20 the store re-derives the accounts file name beside the directory",
      "store: neither cTrader file name is spelled out beside the injected path",
    ],
    [
      "M21 the accounts store re-derives its path from the working directory",
      "split: the accounts store defaults to the accounts path",
    ],
    [
      "M22 the credential store persists the account list",
      "split: the credential projection names no account field",
    ],
    [
      "M23 the accounts store persists the access token",
      "split: the account projection names no credential field",
    ],
    [
      "M24 a scoped store writes its own file instead of delegating the atomic write",
      "split: persistence is delegated to the hardened store, never re-implemented",
    ],
  ]) {
    const mutant = byLabel.get(mutantLabel);

    assert.ok(mutant, `${mutantLabel} is missing from the mutant list`);

    const failures = failuresFor(mutant.rules, mutant.source);

    assert.ok(
      failures.includes(ruleLabel),
      `expected "${ruleLabel}" to reject ${mutantLabel}, got: ${failures.join(" | ")}`
    );
  }
});

test("every mutant anchor actually rewrites its file", () => {
  for (const mutant of MUTANTS) {
    assert.notEqual(
      mutant.source,
      mutant.base,
      `${mutant.label}: the anchor text is stale, nothing was mutated`
    );
  }
});

test("every mutant is rejected by at least one rule", () => {
  for (const mutant of MUTANTS) {
    const failures = failuresFor(mutant.rules, mutant.source);

    assert.ok(
      failures.length > 0,
      `${mutant.label} passed every rule`
    );
  }
});
