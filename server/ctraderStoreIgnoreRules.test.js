import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { AUTH_FILE, ACCOUNTS_FILE, SERVER_DIR } from "./runtimePaths.js";

/* ============================================================
   PHASE 2.1-d TASK 4C — THE ATOMIC WRITE'S LEFTOVER IS A SECRET

   The store writes through a sibling of the file it replaces:
   `<destination>.tmp-<process id>-<random>`, flushed and then moved
   over the destination in one rename. A write that is interrupted
   between those two steps leaves that sibling behind, and the
   sibling holds the whole state — the access token included, in the
   clear, because the file is simply the serialized state.

   The two destinations are already ignored, so a leftover of either
   one is the only way secret material can reach a commit without
   anyone choosing it: an ignored file is skipped by `git add .`, but
   `server/ctrader-auth.json.tmp-4112-k3n2xq` is not ignored by the
   rule for `server/ctrader-auth.json`, because a gitignore path
   matches itself and not its neighbours.

   Two questions are answered here, and they are different questions.
   `does the ignore file say so` is answered by reading it, which is
   what `server/runtimePaths.test.js` already does for the permanent
   files. `does git agree` is answered by asking git, in a repository
   whose only contents are the rules under test, about names that
   were invented for the question and never created.

   What this suite never does: ask git about a file that exists, or
   create any file inside the repository. Every path handed to
   `git check-ignore` is recorded, and a test at the end proves each
   of them resolved to nothing.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const IGNORE_FILE = path.join(REPO_ROOT, ".gitignore");
const SELF_SOURCE = fs
  .readFileSync(fileURLToPath(import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");

const STORE_SOURCE = fs
  .readFileSync(path.join(HERE, "services", "ctraderStore.js"), "utf8")
  .replace(/\r\n/g, "\n");

// Repository-relative, forward slashed: that is the shape a gitignore
// line matches, and it is derived from the anchored constants rather
// than typed, so renaming either store moves the rules and this suite
// together instead of leaving a stale pattern behind.
function repoRelative(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

const CREDENTIAL_PATHS = [repoRelative(AUTH_FILE), repoRelative(ACCOUNTS_FILE)];
const SERVER_PREFIX = path.posix.dirname(CREDENTIAL_PATHS[0]);

// The names that hold secrets whether or not the extension says so.
const PROTECTED_PATHS = [
  ...CREDENTIAL_PATHS,
  repoRelative(path.join(SERVER_DIR, ".env")),
  ".env",
];

/* The infix is read out of the module that produces the name, not
   assumed here: a store that changed its temporary naming would
   otherwise keep being covered by an ignore rule for a file it no
   longer writes. */
function declaredTemporaryInfix() {
  const match = STORE_SOURCE.match(/\$\{filePath\}(\.tmp-)\$\{process\.pid\}/);

  assert.ok(
    match !== null,
    "the store no longer builds a temporary name as <destination> plus an infix, so there is nothing here for an ignore rule to match"
  );

  return match[1];
}

const TEMPORARY_INFIX = declaredTemporaryInfix();

function temporaryRuleFor(credentialPath) {
  return `${credentialPath}${TEMPORARY_INFIX}*`;
}

const TEMPORARY_RULES = CREDENTIAL_PATHS.map(temporaryRuleFor);

function ignoreText() {
  return fs.readFileSync(IGNORE_FILE, "utf8").replace(/\r\n/g, "\n");
}

// The ignore file's own lines, whitespace trimmed, comments dropped:
// the same reading `runtimePaths.test.js` uses, so both suites judge
// the file by the same shape.
function ignoreRules() {
  return ignoreText()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/* The headings are part of the file's convention: a rule that says
   NEVER PUSH sits under a heading that says so, which is how a reader
   — and the next person to add a line — knows the section is not for
   build output. Comments are kept here, in order, so a rule can be
   placed relative to them. */
function ignoreLines() {
  return ignoreText().split("\n").map((line) => line.trim());
}

function sectionRules(heading) {
  const lines = ignoreLines();
  const start = lines.indexOf(heading);

  assert.notEqual(start, -1, `${heading} is not a heading in the ignore file`);

  const rules = [];

  for (let cursor = start + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];

    if (line.startsWith("#")) {
      break;
    }

    if (line !== "") {
      rules.push(line);
    }
  }

  return rules;
}

const CREDENTIAL_HEADING = ignoreLines().find(
  (line) =>
    line.startsWith("#") &&
    line.includes("cTrader") &&
    line.includes("NEVER PUSH")
);

/* ============================================================
   ASKING GIT, ABOUT NOTHING THAT EXISTS
   ============================================================ */

const ASKED = [];
const SCRATCHES = [];

function git(cwd, args, input) {
  const run = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
  });

  assert.equal(
    run.error,
    undefined,
    `git could not be started for ${args.join(" ")}: ${run.error?.message}`
  );

  return run;
}

/* One question, many paths, one answer each. `--non-matching` makes
   git say so for the paths it did not match, instead of leaving the
   silence to be read either way, and `--no-index` keeps the answer
   about the ignore rules rather than about what the index happens to
   hold. The attributed source and pattern are returned because a
   match from a machine-wide file would answer a different question. */
function verdicts(paths, cwd = REPO_ROOT) {
  for (const pathname of paths) {
    ASKED.push({ cwd, pathname });
  }

  const run = git(
    cwd,
    ["check-ignore", "--no-index", "--verbose", "--non-matching", "--stdin"],
    `${paths.join("\n")}\n`
  );

  assert.equal(
    run.stderr.trim(),
    "",
    `check-ignore complained: ${run.stderr.trim()}`
  );

  const answers = new Map();

  for (const line of run.stdout.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }

    const [rule, pathname] = line.split("\t");

    assert.equal(
      typeof pathname,
      "string",
      `an answer could not be split into a rule and a path: ${line}`
    );

    if (rule === "::") {
      answers.set(pathname, null);
      continue;
    }

    const separator = rule.lastIndexOf(":");

    answers.set(pathname, {
      source: rule.slice(0, rule.indexOf(":")),
      pattern: rule.slice(separator + 1),
    });
  }

  assert.equal(
    answers.size,
    paths.length,
    `asked about ${paths.length} paths, git answered for ${answers.size}`
  );

  return answers;
}

function ignoredBy(pathname) {
  return verdicts([pathname]).get(pathname);
}

/* A repository whose entire content is the file under test. Nothing
   else can be carrying these rules: no index, no other ignore file,
   and no file at all — the paths asked about are names the store
   would produce, never names that exist here. */
function rulesOnlyRepository() {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-ignore-rules-"))
  );

  assert.equal(
    dir.startsWith(fs.realpathSync(os.tmpdir())),
    true,
    "the isolated rule copy must not live inside the repository"
  );

  SCRATCHES.push(dir);

  fs.writeFileSync(path.join(dir, ".gitignore"), ignoreText(), "utf8");

  const init = git(dir, ["init", "--quiet"]);

  assert.equal(init.status, 0, `the scratch repository refused to start: ${init.stderr}`);

  return dir;
}

// A name in exactly the shape the store builds, with a suffix this
// suite made up. Nothing is created under it, anywhere.
function temporaryNameFor(credentialPath, seed) {
  return `${credentialPath}${TEMPORARY_INFIX}${process.pid}-${seed}`;
}

after(() => {
  for (const dir of SCRATCHES) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ============================================================
   WHAT THE FILE SAYS
   ============================================================ */

test("the ignore file exists and is read as plain lines", () => {
  assert.equal(fs.existsSync(IGNORE_FILE), true, "there is no ignore file to guard the store");
  assert.equal(ignoreRules().length > 0, true);
  assert.equal(
    ignoreText().includes("\r"),
    false,
    "the ignore file carries carriage returns, so a line-by-line reading would be judging the line ending"
  );
});

test("the two permanent credential files are still listed", () => {
  for (const credentialPath of CREDENTIAL_PATHS) {
    assert.equal(
      ignoreRules().includes(credentialPath),
      true,
      `${credentialPath} stopped being ignored, and this task only meant to cover its temporary sibling`
    );
  }
});

test("both stores' temporary files are listed on their own lines", () => {
  for (const rule of TEMPORARY_RULES) {
    assert.equal(
      ignoreRules().includes(rule),
      true,
      `${rule} is not an ignore rule, so a leftover of an interrupted write can be staged by a broad git add`
    );
  }
});

test("the listed pattern is the credential path plus the infix the store writes", () => {
  assert.equal(
    TEMPORARY_INFIX,
    ".tmp-",
    `the store's temporary infix moved to "${TEMPORARY_INFIX}", so the rule this suite expects is no longer the rule that would help`
  );

  for (const [index, credentialPath] of CREDENTIAL_PATHS.entries()) {
    const rule = TEMPORARY_RULES[index];

    assert.equal(
      rule.startsWith(credentialPath),
      true,
      `${rule} does not begin with the file whose write it guards`
    );
    assert.equal(
      rule.slice(0, -1),
      `${credentialPath}${TEMPORARY_INFIX}`,
      `${rule} matches names the store never writes`
    );
    assert.equal(
      ignoreRules().includes(rule),
      true,
      `${rule} is not in the ignore file`
    );
  }
});

test("no rule takes any of them back", () => {
  const negations = ignoreRules().filter((rule) => rule.startsWith("!"));

  for (const negation of negations) {
    for (const credentialPath of CREDENTIAL_PATHS) {
      assert.equal(
        negation.includes(credentialPath),
        false,
        `${negation} re-admits ${credentialPath} or its temporary sibling, which the credential section exists to prevent`
      );
    }
  }
});

test("every credential rule sits under the heading that says never push", () => {
  assert.equal(
    typeof CREDENTIAL_HEADING,
    "string",
    "the ignore file no longer has a cTrader section, so nothing tells a reader which rules are secrets"
  );

  assert.deepEqual(
    sectionRules(CREDENTIAL_HEADING).slice().sort(),
    [...CREDENTIAL_PATHS, ...TEMPORARY_RULES].sort(),
    `the ${CREDENTIAL_HEADING} section holds something other than the two files and their two temporary rules`
  );
});

test("each credential rule is an anchored path, not a widened glob", () => {
  assert.equal(
    typeof CREDENTIAL_HEADING,
    "string",
    "the ignore file no longer has a cTrader section, so there are no rules to judge"
  );

  for (const rule of sectionRules(CREDENTIAL_HEADING)) {
    assert.equal(
      rule.startsWith("!"),
      false,
      `${rule} is a negation, which un-ignores something the section exists to hide`
    );
    assert.equal(
      rule.startsWith(`${SERVER_PREFIX}/`),
      true,
      `${rule} is not anchored to ${SERVER_PREFIX}, so it reaches a same-named file in every directory`
    );
    assert.equal(
      rule.includes("**"),
      false,
      `${rule} uses a recursive wildcard, which matches more than the one file it names`
    );
    assert.equal(
      rule.split("*").length - 1 <= 1,
      true,
      `${rule} holds more than the one wildcard that stands for the random suffix`
    );

    const narrow =
      CREDENTIAL_PATHS.includes(rule) || rule.endsWith(`${TEMPORARY_INFIX}*`);

    assert.equal(
      narrow,
      true,
      `${rule} is neither one of the two stored files nor a pattern that ends where the store's temporary name begins, so it can swallow an unrelated file`
    );
  }
});

/* ============================================================
   WHAT GIT DECIDES
   ============================================================ */

test("git ignores a temporary file of the credential store", () => {
  const pathname = temporaryNameFor(CREDENTIAL_PATHS[0], "aaaaaaaa");

  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, pathname)),
    false,
    "a temporary credential file exists in the working tree, which this task must never create"
  );

  const verdict = ignoredBy(pathname);

  assert.notEqual(
    verdict,
    null,
    `${pathname} is not ignored: an interrupted write of the token store leaves an access token to be staged`
  );
  assert.equal(
    verdict.pattern,
    temporaryRuleFor(CREDENTIAL_PATHS[0]),
    `${pathname} was matched by ${verdict.pattern}, a rule this suite does not recognise`
  );
  assert.equal(
    verdict.source,
    ".gitignore",
    `${pathname} was ignored by ${verdict.source}, not by the file under test`
  );
});

test("git ignores a temporary file of the accounts store", () => {
  const pathname = temporaryNameFor(CREDENTIAL_PATHS[1], "bbbbbbbb");

  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, pathname)),
    false,
    "a temporary account file exists in the working tree, which this task must never create"
  );

  const verdict = ignoredBy(pathname);

  assert.notEqual(
    verdict,
    null,
    `${pathname} is not ignored: an interrupted write of the account store leaves account metadata to be staged`
  );
  assert.equal(
    verdict.pattern,
    temporaryRuleFor(CREDENTIAL_PATHS[1]),
    `${pathname} was matched by ${verdict.pattern}, a rule this suite does not recognise`
  );
  assert.equal(
    verdict.source,
    ".gitignore",
    `${pathname} was ignored by ${verdict.source}, not by the file under test`
  );
});

test("the rules ignore with nothing but themselves behind them", () => {
  const scratch = rulesOnlyRepository();

  for (const credentialPath of CREDENTIAL_PATHS) {
    const pathname = temporaryNameFor(credentialPath, "dddddddd");

    assert.equal(
      fs.existsSync(path.join(scratch, pathname)),
      false,
      `the scratch repository was asked about ${pathname}, which it holds`
    );

    const verdict = verdicts([pathname], scratch).get(pathname);

    assert.notEqual(
      verdict,
      null,
      `${pathname} is ignored only because something outside the ignore file says so`
    );
    assert.equal(verdict.source, ".gitignore");
    assert.equal(verdict.pattern, temporaryRuleFor(credentialPath));
  }
});

test("the rules do not reach names they were not written for", () => {
  const [credential, accounts] = CREDENTIAL_PATHS;

  const lookalikes = [
    `${credential}${TEMPORARY_INFIX.slice(0, -1)}`,
    `${credential}.bak`,
    `${credential}.old`,
    `${accounts}${TEMPORARY_INFIX.slice(0, -1)}`,
    `${accounts}.bak`,
    `${accounts}.old`,
    "server/ctrader-authentication.json.tmp-1-aaaaaaaa",
    "server/ctrader-accounts.bak.json",
    "server/ctrader-positions.json.tmp-1-aaaaaaaa",
    "server/package.json.tmp-1-aaaaaaaa",
    `${SERVER_PREFIX}/sub/ctrader-auth.json.tmp-1-aaaaaaaa`,
    `docs/ctrader-auth.json.tmp-1-aaaaaaaa`,
  ];

  const answers = verdicts(lookalikes);

  for (const [pathname, verdict] of answers) {
    assert.equal(
      verdict,
      null,
      `${pathname} is ignored, which is broader than the one interrupted write the rule guards`
    );
  }
});

test("nothing the rules cover is already tracked", () => {
  const tracked = git(REPO_ROOT, [
    "ls-files",
    "--",
    ...CREDENTIAL_PATHS.map((credentialPath) => `${credentialPath}*`),
  ]);

  assert.equal(tracked.status, 0, tracked.stderr);
  assert.deepEqual(
    tracked.stdout.split(/\r?\n/).filter((line) => line !== ""),
    [],
    "a credential file or one of its temporary siblings is in the index, which no ignore rule can undo"
  );

  const swallowed = git(REPO_ROOT, [
    "ls-files",
    "--ignored",
    "--cached",
    "--exclude-standard",
  ]);

  assert.equal(swallowed.status, 0, swallowed.stderr);
  assert.deepEqual(
    swallowed.stdout
      .split(/\r?\n/)
      .filter((line) => line !== "")
      .filter(
        (line) =>
          CREDENTIAL_PATHS.some(
            (credentialPath) =>
              line.startsWith(`${credentialPath}${TEMPORARY_INFIX}`) ||
              line === credentialPath
          )
      ),
    [],
    "the new rules swallowed a file the repository already tracks"
  );
});

/* ============================================================
   WHAT THIS SUITE ITSELF TOUCHED
   ============================================================ */

test("git was never asked about a file that exists", () => {
  assert.equal(
    ASKED.length > 0,
    true,
    "no question was asked, so the list proves nothing"
  );

  for (const { cwd, pathname } of ASKED) {
    assert.equal(
      PROTECTED_PATHS.includes(pathname),
      false,
      `${pathname} is a credential or environment file; its ignore status is judged from the file's own lines, never by asking about the real thing`
    );
    assert.equal(
      fs.existsSync(path.join(cwd, pathname)),
      false,
      `${pathname} exists where it was asked about, so git was pointed at a real file`
    );
  }
});

test("no temporary credential file was left in the server directory", () => {
  const leftovers = fs
    .readdirSync(SERVER_DIR)
    .filter((name) => name.includes(TEMPORARY_INFIX));

  assert.deepEqual(
    leftovers,
    [],
    `these files sit in the repository holding serialized state: ${leftovers.join(", ")}`
  );
});

test("this suite imports nothing but the runtime paths and Node", () => {
  const specifiers = [
    ...SELF_SOURCE.matchAll(/^import\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm),
  ].map((match) => match[1]);

  const statements = SELF_SOURCE.match(/^import\b/gm) || [];

  assert.equal(
    specifiers.length,
    statements.length,
    "an import was not read as a dependency; the guard needs a wider pattern"
  );

  assert.deepEqual(specifiers.sort(), [
    "./runtimePaths.js",
    "node:assert/strict",
    "node:child_process",
    "node:fs",
    "node:os",
    "node:path",
    "node:process",
    "node:test",
    "node:url",
  ]);
});
