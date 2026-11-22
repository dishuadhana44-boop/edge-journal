import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import "./testsupport/envIsolationPreload.mjs";

import dotenv from "dotenv";

import * as runtimePaths from "./runtimePaths.js";

/* ============================================================
   PHASE 4A TASK 7 — cwd-independent dotenv resolution

   server/index.js and server/services/ctraderService.js each called
   dotenv.config() with no path, so each of them loaded
   "<working directory>/.env". The backend is normally started with
   its working directory inside server/, which happens to be right,
   but the same code started from the repository root loads the
   FRONTEND file instead: the client id is there, the client secret
   is not, and the OAuth handover then fails as server_config_missing.
   Started from a directory that holds no such file, it fails
   silently, because dotenv reports a missing file on result.error and
   both call sites ignored the return value.

   The fix is one shared constant, ENV_FILE in
   server/runtimePaths.js, used by both call sites. Both calls stay:
   ESM imports are evaluated before the body of the importing module,
   so the entry point's call runs after the routers have already read
   their own configuration, and the service's call is the one that
   configures the environment for the credential reads. Dropping
   either one would leave a reader with an unset value.

   SECRET HANDLING. Both real configuration files hold live
   credentials, so no test here may open them.
   envIsolationPreload.mjs answers every open of a file named exactly
   ".env" from an in-memory fixture and records only the absolute path
   that was asked for. That is what lets these tests say WHICH file a
   code site reached for without touching either real file.

   Checked by source contract only: server/index.js, because importing
   it starts the HTTP listener and binds the port.

   Out of scope and unchanged: the manual live-socket scripts keep
   their own cwd-relative reads, dotenv keeps override: false, and no
   missing-file warning or logging behaviour was added.
   ============================================================ */

const isolation = globalThis.__qoderEnvIsolation;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(path.resolve(HERE));

const MARKER = "QODER_ATTEMPTS:";

/* ============================================================
   ASSEMBLED FROM FRAGMENTS.

   These are the exact strings the guards below forbid. If this file
   held any of them whole, the guard would fire on its own source and
   the suite could never pass, so each one is put together at runtime.
   ============================================================ */

const VALUE_PRINT_TOKENS = [
  "console" + "." + "log(process.env",
  "JSON" + "." + "stringify(process.env",
  "JSON" + "." + "stringify(result.parsed",
];

const CONFIG_KEY_TOKENS = [
  "CTRADER" + "_CLIENT_ID",
  "CTRADER" + "_CLIENT_SECRET",
  "GEMINI" + "_API_KEY",
];

function printsValues(text) {
  return VALUE_PRINT_TOKENS.filter((token) => text.includes(token));
}

function copiesConfigKeys(text) {
  return CONFIG_KEY_TOKENS
    .map((token) => token + "=")
    .filter((token) => text.includes(token));
}

function readSource(relative) {
  return fs
    .readFileSync(path.join(HERE, relative), "utf8")
    .replace(/\r\n/g, "\n");
}

const RUNTIME_SOURCE = readSource("./runtimePaths.js");
const INDEX_SOURCE = readSource("./index.js");
const SERVICE_SOURCE = readSource("./services/ctraderService.js");
const PRELOAD_SOURCE = readSource("./testsupport/envIsolationPreload.mjs");
const SELF_SOURCE = readSource("./dotenvPath.test.js");

const PRELOAD_HREF = pathToFileURL(
  path.join(HERE, "testsupport", "envIsolationPreload.mjs")
).href;
const SERVICE_HREF = pathToFileURL(
  path.join(HERE, "services", "ctraderService.js")
).href;
const DOTENV_HREF = pathToFileURL(
  createRequire(import.meta.url).resolve("dotenv")
).href;

function failuresFor(rules, text) {
  return rules.filter((rule) => !rule.passes(text)).map((rule) => rule.label);
}

function assertClean(rules, text, subject) {
  const failures = failuresFor(rules, text);

  assert.deepEqual(
    failures,
    [],
    `${subject} breaks: ${failures.join(" | ")}`
  );
}

/* ============================================================
   THE GUARD ITSELF — nothing below can reach a real file
   ============================================================ */

test("the dotenv isolation guard is installed in this process", () => {
  assert.equal(
    isolation?.active,
    true,
    "without the guard this suite would open the real credential files"
  );

  assert.equal(
    isolation.fixtureName,
    "QODER_ENV_ISOLATION_SENTINEL"
  );

  assert.equal(
    isolation.fixtureText,
    `${isolation.fixtureName}=${isolation.fixtureValue}`
  );
});

test("the guard answers a .env read from the fixture, not the disk", () => {
  const before = isolation.attempts.length;

  const target = path.join(os.tmpdir(), "qoder-dotenv-isolation", ".env");

  assert.equal(
    fs.readFileSync(target, "utf8"),
    isolation.fixtureText,
    "a .env path that does not exist must still be answered, never thrown"
  );

  assert.deepEqual(
    isolation.attempts.slice(before),
    [path.resolve(target)],
    "the guard must record the absolute path it answered for"
  );
});

test("the guard leaves every other read alone", () => {
  const before = isolation.attempts.length;

  assert.match(
    fs.readFileSync(path.join(HERE, "runtimePaths.js"), "utf8"),
    /export const SERVER_DIR/,
    "normal reads must pass straight through"
  );

  assert.deepEqual(
    isolation.attempts.slice(before),
    [],
    "a pass-through read must not be recorded as a configuration read"
  );
});

test("the guard records paths and never contents", () => {
  assert.equal(
    /attempts\.push\(path\.resolve\(target\)\)/.test(PRELOAD_SOURCE),
    true,
    "the recorder must store the resolved path only"
  );

  assert.equal(
    /SYNTHETIC_FIXTURE/.test(PRELOAD_SOURCE),
    true,
    "the answer must come from a named fixture constant"
  );

  assert.deepEqual(
    printsValues(PRELOAD_SOURCE),
    [],
    "the guard must never emit environment values"
  );
});

/* ============================================================
   BEHAVIOUR — the anchored value
   ============================================================ */

test("runtimePaths exports ENV_FILE as the file beside the server modules", () => {
  assert.equal(
    typeof runtimePaths.ENV_FILE,
    "string",
    "ENV_FILE must be exported"
  );

  assert.equal(
    runtimePaths.ENV_FILE,
    path.join(path.resolve(HERE), ".env"),
    "the backend configuration file must stay in server/, where it is today"
  );

  assert.equal(path.isAbsolute(runtimePaths.ENV_FILE), true);
  assert.equal(path.basename(runtimePaths.ENV_FILE), ".env");
  assert.equal(
    path.dirname(runtimePaths.ENV_FILE),
    path.resolve(runtimePaths.SERVER_DIR)
  );
});

test("the anchored backend file is not the frontend file", () => {
  assert.equal(
    typeof runtimePaths.ENV_FILE,
    "string",
    "ENV_FILE must be exported"
  );

  assert.notEqual(
    runtimePaths.ENV_FILE,
    path.join(REPO_ROOT, ".env"),
    "the repository root file belongs to the frontend build"
  );

  assert.notEqual(
    path.dirname(runtimePaths.ENV_FILE),
    path.resolve(REPO_ROOT),
    "the backend must not be pointed one level up"
  );
});

test("dotenv with ENV_FILE reaches for exactly the anchored file", () => {
  const before = isolation.attempts.length;

  const result = dotenv.config({ path: runtimePaths.ENV_FILE });

  assert.equal(
    result.error,
    undefined,
    "the anchored read must succeed, not surface a missing-file error"
  );

  assert.deepEqual(
    isolation.attempts.slice(before),
    [path.resolve(runtimePaths.ENV_FILE)],
    "exactly one file, the anchored one"
  );

  assert.deepEqual(
    Object.keys(result.parsed),
    [isolation.fixtureName],
    "the content read must be the fixture, never a real configuration file"
  );

  assert.equal(process.env[isolation.fixtureName], isolation.fixtureValue);
});

/* ============================================================
   BEHAVIOUR — offline child processes
   ============================================================ */

const CHILD_SOURCES = [];

function runChild({ cwd, source }) {
  CHILD_SOURCES.push(source);

  const run = spawnSync(
    process.execPath,
    ["--input-type=module", "-"],
    { cwd, input: source, encoding: "utf8" }
  );

  assert.equal(
    run.status,
    0,
    `child failed in ${cwd}: ${run.stderr?.trim() || run.stdout}`
  );

  const marked = run.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(MARKER));

  assert.equal(
    marked.length,
    1,
    `the child must print exactly one marker line, got: ${run.stdout}`
  );

  return JSON.parse(marked[0].slice(MARKER.length));
}

function attemptsChildSource(moduleHref) {
  return [
    `import ${JSON.stringify(PRELOAD_HREF)};`,
    moduleHref ? `import ${JSON.stringify(moduleHref)};` : "",
    "import path from \"node:path\";",
    "console.log(",
    `  ${JSON.stringify(MARKER)} + JSON.stringify(`,
    "    globalThis.__qoderEnvIsolation.attempts.map((target) => path.resolve(target)),",
    "  ),",
    ");",
  ]
    .filter(Boolean)
    .join("\n");
}

function bareDefaultChildSource() {
  return [
    `import ${JSON.stringify(PRELOAD_HREF)};`,
    `import dotenv from ${JSON.stringify(DOTENV_HREF)};`,
    `import path from "node:path";`,
    "dotenv.config();",
    "console.log(",
    `  ${JSON.stringify(MARKER)} + JSON.stringify(`,
    "    globalThis.__qoderEnvIsolation.attempts.map((target) => path.resolve(target)),",
    "  ),",
    ");",
  ].join("\n");
}

test("the child really runs from the directory under test", () => {
  const probe = [
    `import ${JSON.stringify(PRELOAD_HREF)};`,
    "console.log(\"QODER_CWD:\" + process.cwd());",
  ].join("\n");

  CHILD_SOURCES.push(probe);

  const run = spawnSync(
    process.execPath,
    ["--input-type=module", "-"],
    { cwd: REPO_ROOT, input: probe, encoding: "utf8" }
  );

  assert.equal(run.status, 0, run.stderr?.trim() || run.stdout);

  assert.equal(
    path.resolve(run.stdout.match(/QODER_CWD:(.*)/)[1]),
    path.resolve(REPO_ROOT)
  );

  assert.notEqual(
    path.resolve(run.stdout.match(/QODER_CWD:(.*)/)[1]),
    path.resolve(HERE),
    "a different working directory is what makes this a cwd test"
  );
});

test("dotenv without a path follows the working directory", () => {
  const source = bareDefaultChildSource();

  const fromRepoRoot = runChild({ cwd: REPO_ROOT, source });
  const fromTemp = runChild({ cwd: os.tmpdir(), source });

  assert.deepEqual(fromRepoRoot, [path.join(REPO_ROOT, ".env")]);
  assert.deepEqual(fromTemp, [path.join(os.tmpdir(), ".env")]);

  assert.notDeepEqual(
    fromRepoRoot,
    fromTemp,
    "the unanchored default is the defect this task closes"
  );
});

test("the service anchors its configuration when started from the repository root", () => {
  const attempts = runChild({
    cwd: REPO_ROOT,
    source: attemptsChildSource(SERVICE_HREF),
  });

  assert.deepEqual(
    attempts,
    [path.resolve(runtimePaths.ENV_FILE)],
    "the service must read server/.env whatever the working directory is"
  );
});

test("the service anchors its configuration when started from the temp dir", () => {
  const attempts = runChild({
    cwd: os.tmpdir(),
    source: attemptsChildSource(SERVICE_HREF),
  });

  assert.deepEqual(
    attempts,
    [path.resolve(runtimePaths.ENV_FILE)],
    "a working directory with no configuration file must not change the read"
  );
});

test("every child process this suite starts installs the guard", () => {
  assert.ok(
    CHILD_SOURCES.length >= 4,
    `the child sources must be collected as they run, got ${CHILD_SOURCES.length}`
  );

  for (const source of CHILD_SOURCES) {
    assert.ok(
      source.includes(PRELOAD_HREF),
      `a child was started without the guard: ${source.slice(0, 120)}`
    );

    const configCall = source.lastIndexOf("dotenv.config(");

    assert.ok(
      configCall === -1 || source.indexOf(PRELOAD_HREF) < configCall,
      "a child that configures the environment must install the guard first"
    );
  }
});

/* ============================================================
   SOURCE CONTRACTS
   ============================================================ */

test("server/index.js cannot be imported by a test, so it stays a contract", () => {
  assert.match(
    INDEX_SOURCE,
    /\.listen\(/,
    "the entry point binds a port at load; that is why its call site is pinned here"
  );
});

function callSiteRules(importSpec) {
  const importLine = `import { ENV_FILE } from "${importSpec}";`;

  return [
    {
      label: "site: dotenv reads the anchored configuration path",
      passes: (text) =>
        /dotenv\.config\(\s*\{\s*path:\s*ENV_FILE\s*\}\s*\)/.test(text),
    },
    {
      label: "site: the working-directory default form is gone",
      passes: (text) => !/dotenv\.config\(\s*\)/.test(text),
    },
    {
      label: "site: ENV_FILE comes from the shared runtime module",
      passes: (text) => text.includes(importLine),
    },
    {
      label: "site: dotenv keeps its default override behaviour",
      passes: (text) =>
        !/dotenv\.config\(\s*\{[^}]*\boverride\b/.test(text),
    },
    {
      label: "site: exactly one dotenv.config call remains",
      passes: (text) =>
        (text.match(/dotenv\.config\(/g) ?? []).length === 1,
    },
    {
      label: "site: no process.cwd() anywhere",
      passes: (text) => !/process\.cwd\(/.test(text),
    },
    {
      label: "site: only the shared constant names the configuration file",
      passes: (text) => !/["'`]\.env["'`]/.test(text),
    },
    {
      label: "site: the configuration file is never written",
      passes: (text) =>
        !/writeFileSync\([^)]*(ENV_FILE|"\.env")/.test(text),
    },
    {
      label: "site: no environment value is printed",
      passes: (text) =>
        !/console\.(log|info|warn|error)\(\s*process\.env/.test(text) &&
        !/JSON\.stringify\(\s*process\.env/.test(text) &&
        !/JSON\.stringify\(\s*result\.parsed/.test(text),
    },
  ];
}

const INDEX_RULES = callSiteRules("./runtimePaths.js");
const SERVICE_DOTENV_RULES = callSiteRules("../runtimePaths.js");

const RUNTIME_ENV_RULES = [
  {
    label: "runtime: ENV_FILE joins SERVER_DIR and the backend file name",
    passes: (text) =>
      /ENV_FILE\s*=\s*path\.join\(\s*SERVER_DIR,\s*"\.env"\s*\)/.test(text),
  },
  {
    label: "runtime: ENV_FILE is exported",
    passes: (text) => /export const ENV_FILE/.test(text),
  },
  {
    label: "runtime: the comment tells the backend file from the frontend one",
    passes: (text) =>
      /\/\/[^\n]*backend/i.test(text) && /\/\/[^\n]*frontend/i.test(text),
  },
  {
    label: "runtime: no process.cwd() anywhere",
    passes: (text) => !/process\.cwd\(/.test(text),
  },
  {
    label: "runtime: the module performs no I/O and reads no environment",
    passes: (text) =>
      !/\bfs\b|node:fs|dotenv|process\.env|WebSocket|fetch\(|protobuf|net\b|http/.test(
        text
      ),
  },
  {
    label: "runtime: no parent-directory escape",
    passes: (text) => !/"\.\."|\.\.\//.test(text),
  },
];

const SELF_RULES = [
  {
    label: "suite: the guard is imported before any configuration read",
    passes: (text) =>
      text.includes('import "./testsupports/envIsolationPreload.mjs";') &&
      text.indexOf("envIsolationPreload.mjs") < text.indexOf('from "dotenv"'),
  },
  {
    label: "suite: no environment value is printed",
    passes: (text) => printsValues(text).length === 0,
  },
  {
    label: "suite: the anchored file is only read through dotenv",
    passes: (text) => !/readFileSync\([^)]*ENV_FILE/.test(text),
  },
  {
    label: "suite: no real configuration key is copied into the test",
    passes: (text) => copiesConfigKeys(text).length === 0,
  },
];

test("index.js follows every dotenv call-site rule", () => {
  assertClean(INDEX_RULES, INDEX_SOURCE, "index.js");
});

test("services/ctraderService.js follows every dotenv call-site rule", () => {
  assertClean(SERVICE_DOTENV_RULES, SERVICE_SOURCE, "services/ctraderService.js");
});

test("runtimePaths.js follows every ENV_FILE rule", () => {
  assertClean(RUNTIME_ENV_RULES, RUNTIME_SOURCE, "runtimePaths.js");
});

test("this suite keeps the guard ahead of every read", () => {
  assertClean(SELF_RULES, SELF_SOURCE, "dotenvPath.test.js");
});

/* ============================================================
   BEFORE-FIX FIXTURE + MUTANTS
   ============================================================ */

const PRE_FIX_CALL_SITE = [
  'import dotenv from "dotenv";',
  "",
  "dotenv.config();",
].join("\n");

test("the pre-fix call site is rejected by the dotenv rules", () => {
  const failures = failuresFor(INDEX_RULES, PRE_FIX_CALL_SITE);

  assert.ok(
    failures.length >= 3,
    `the unanchored call must break several rules, got: ${failures.join(" | ")}`
  );

  assert.ok(
    failures.some((label) => label.startsWith("site: dotenv reads the anchored")),
    `expected the anchored-path rule to reject it, got: ${failures.join(" | ")}`
  );
});

const INDEX_IMPORT_ANCHOR = 'import { ENV_FILE } from "./runtimePaths.js";';
const SERVICE_IMPORT_ANCHOR = 'import { ENV_FILE } from "../runtimePaths.js";';
const CONFIG_CALL_ANCHOR = "dotenv.config({ path: ENV_FILE });";
const ENV_FILE_ANCHOR =
  'export const ENV_FILE = path.join(SERVER_DIR, ".env");';

const MUTANTS = [
  {
    label: "M1 the entry point drops back to the unanchored default",
    base: INDEX_SOURCE,
    source: INDEX_SOURCE.replace(CONFIG_CALL_ANCHOR, "dotenv.config();"),
    rules: INDEX_RULES,
    rejectedBy: [
      "site: dotenv reads the anchored configuration path",
      "site: the working-directory default form is gone",
    ],
  },
  {
    label: "M2 the entry point lets the file overwrite the real environment",
    base: INDEX_SOURCE,
    source: INDEX_SOURCE.replace(
      CONFIG_CALL_ANCHOR,
      "dotenv.config({ path: ENV_FILE, override: true });"
    ),
    rules: INDEX_RULES,
    rejectedBy: ["site: dotenv keeps its default override behaviour"],
  },
  {
    label: "M3 the entry point hardcodes a relative file name",
    base: INDEX_SOURCE,
    source: INDEX_SOURCE.replace(
      CONFIG_CALL_ANCHOR,
      'dotenv.config({ path: ".env" });'
    ),
    rules: INDEX_RULES,
    rejectedBy: [
      "site: dotenv reads the anchored configuration path",
      "site: only the shared constant names the configuration file",
    ],
  },
  {
    label: "M4 the entry point re-derives the path from the working directory",
    base: INDEX_SOURCE,
    source: INDEX_SOURCE.replace(
      INDEX_IMPORT_ANCHOR,
      'const ENV_FILE = path.join(process.cwd(), ".env");'
    ),
    rules: INDEX_RULES,
    rejectedBy: [
      "site: ENV_FILE comes from the shared runtime module",
      "site: no process.cwd() anywhere",
      "site: only the shared constant names the configuration file",
    ],
  },
  {
    label: "M5 the service drops back to the unanchored default",
    base: SERVICE_SOURCE,
    source: SERVICE_SOURCE.replace(CONFIG_CALL_ANCHOR, "dotenv.config();"),
    rules: SERVICE_DOTENV_RULES,
    rejectedBy: [
      "site: dotenv reads the anchored configuration path",
      "site: the working-directory default form is gone",
    ],
  },
  {
    label: "M6 the service adds a second unanchored call",
    base: SERVICE_SOURCE,
    source: SERVICE_SOURCE.replace(
      CONFIG_CALL_ANCHOR,
      "dotenv.config({ path: ENV_FILE });\ndotenv.config();"
    ),
    rules: SERVICE_DOTENV_RULES,
    rejectedBy: [
      "site: the working-directory default form is gone",
      "site: exactly one dotenv.config call remains",
    ],
  },
  {
    label: "M7 the service takes the path from an operator-supplied variable",
    base: SERVICE_SOURCE,
    source: SERVICE_SOURCE.replace(
      CONFIG_CALL_ANCHOR,
      "dotenv.config({ path: process.env.EDGEFLO_ENV_FILE });"
    ),
    rules: SERVICE_DOTENV_RULES,
    rejectedBy: ["site: dotenv reads the anchored configuration path"],
  },
  {
    label: "M8 ENV_FILE escapes to the directory holding the frontend file",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      ENV_FILE_ANCHOR,
      'export const ENV_FILE = path.join(SERVER_DIR, "..", ".env");'
    ),
    rules: RUNTIME_ENV_RULES,
    rejectedBy: [
      "runtime: ENV_FILE joins SERVER_DIR and the backend file name",
      "runtime: no parent-directory escape",
    ],
  },
  {
    label: "M9 ENV_FILE becomes overridable from the environment",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      ENV_FILE_ANCHOR,
      'export const ENV_FILE = process.env.EDGEFLO_ENV_FILE ?? path.join(SERVER_DIR, ".env");'
    ),
    rules: RUNTIME_ENV_RULES,
    rejectedBy: [
      "runtime: ENV_FILE joins SERVER_DIR and the backend file name",
      "runtime: the module performs no I/O and reads no environment",
    ],
  },
  {
    label: "M10 the constant stops being exported",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace(
      ENV_FILE_ANCHOR,
      'const ENV_FILE = path.join(SERVER_DIR, ".env");'
    ),
    rules: RUNTIME_ENV_RULES,
    rejectedBy: ["runtime: ENV_FILE is exported"],
  },
  {
    label: "M11 the comment stops naming the frontend file",
    base: RUNTIME_SOURCE,
    source: RUNTIME_SOURCE.replace("frontend", "client side"),
    rules: RUNTIME_ENV_RULES,
    rejectedBy: [
      "runtime: the comment tells the backend file from the frontend one",
    ],
  },
];

test("every mutant anchor actually rewrites its file", () => {
  for (const mutant of MUTANTS) {
    assert.ok(
      mutant.source !== mutant.base,
      `${mutant.label}: the anchor text is stale, nothing was mutated`
    );
  }
});

test("every mutant is rejected by the rule that names its defect", () => {
  for (const mutant of MUTANTS) {
    const failures = failuresFor(mutant.rules, mutant.source);

    for (const expected of mutant.rejectedBy) {
      assert.ok(
        failures.includes(expected),
        `${mutant.label} was expected to break "${expected}", got: ${failures.join(" | ") || "nothing"}`
      );
    }
  }
});
