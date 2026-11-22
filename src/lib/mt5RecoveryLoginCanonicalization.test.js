import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalLogin } from "../utils/trading/recoveryClock.js";
import {
  RECOVERY_SCAN_CODES,
  runHistoryRecoveryScan,
} from "./mt5HistoryRecoveryScan.js";

// ============================================================
// One login rule, spelled out once
//
// Phase 3X-6D proved that two copies of this rule can drift apart in ways
// that matter: a ceiling applied before the leading zeros are stripped
// refuses an account the pipeline accepts, and a copy that keeps the zeros
// keys a watermark on a login the next run will not look up. The rule lives
// in src/utils/trading/recoveryClock.js and every recovery module takes it
// from there, so this suite is written against the one function rather than
// against a table of expectations each file could restate its own way.
//
// canonicalLogin returns a tagged result - { login } when the value names an
// account, { missing } when the caller never named one, { invalid } when it
// named something that cannot be an MT5 login. Callers that only need a yes
// or no translate that tag; the translation is what the behavioral tables in
// the module suites check, and these source contracts check that nobody is
// left writing the rule again.
//
// Known remaining copy, deliberately not converged here:
// mt5HistoryRecoveryScan.js still carries its own string-only version, so it
// refuses a login the shared rule accepts. Widening the scan is a change to
// what an HTTP-facing module accepts, so it is a decision for its own phase;
// the last test below pins the difference instead of letting it go unnoticed.
// ============================================================

const here = fileURLToPath(new URL(".", import.meta.url));
const srcRoot = join(here, "..");

function readSource(relativePath) {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

const LOGIN = "12345678";
const OTHER_LOGIN = "87654321";
const SERVER = "metatrader-demo";

// Spellings of one account, and spellings that are not an account at all.
const CANONICAL_FORMS = [
  [LOGIN, LOGIN],
  ["00012345678", LOGIN],
  ["0000000000012345678", LOGIN],
  [Number(LOGIN), LOGIN],
  [" 12345678 ", LOGIN],
  ["00000000000000012345678", LOGIN],
];

const NOT_A_LOGIN = [
  ["0", "invalid"],
  ["0000", "invalid"],
  ["12345678a", "invalid"],
  ["1234567890123456", "invalid"],
  ["12 34", "invalid"],
  ["-12345678", "invalid"],
  ["", "missing"],
  ["   ", "missing"],
  [undefined, "missing"],
  [null, "missing"],
  [{}, "missing"],
  [[], "missing"],
  [0, "invalid"],
  [-12345678, "invalid"],
  [1.5, "invalid"],
  [Number.NaN, "invalid"],
  [Number.POSITIVE_INFINITY, "invalid"],
];

// The oracle every module test compares itself against.
function expectedLogin(value) {
  const verdict = canonicalLogin(value);

  if (typeof verdict.login === "string") return verdict.login;

  return null;
}

// Files that still write the rule out as their own function. Anything new
// here has to be justified, not added quietly.
const ALLOWED_LOGIN_RULE_FILES = [
  "lib/mt5HistoryRecoveryScan.js",
  "utils/trading/recoveryClock.js",
];

function filesDefiningLoginRule() {
  const found = [];

  for (const directory of ["lib", "utils/trading"]) {
    const root = join(srcRoot, directory);

    for (const entry of readdirSync(root, { recursive: true })) {
      if (typeof entry !== "string") continue;
      if (!entry.endsWith(".js") || entry.endsWith(".test.js")) continue;

      if (
        /function canonicalLogin\s*\(/.test(
          readFileSync(join(root, entry), "utf8")
        )
      ) {
        found.push(relative(srcRoot, join(root, entry)).replace(/\\/g, "/"));
      }
    }
  }

  return found.sort();
}

// ==========================================================
// 1. The shared rule is the only rule
// ==========================================================

test("keeps one definition of the login rule in the recovery pipeline", () => {
  assert.deepEqual(filesDefiningLoginRule(), ALLOWED_LOGIN_RULE_FILES);
});

for (const module of [
  "lib/mt5RecoveryOrchestrator.js",
  "lib/mt5RecoveryJournalAdapter.js",
  "lib/mt5RecoveryAccountPreview.js",
  "lib/mt5RecoveryCommitContract.js",
]) {
  test(`${module} takes its login rule from the recovery clock`, () => {
    const text = readSource(module);

    assert.ok(
      !/function canonicalLogin\s*\(/.test(text),
      `${module} defines its own canonicalLogin`
    );
    assert.ok(
      !/MAX_LOGIN_DIGITS/.test(text),
      `${module} restates the login digit ceiling`
    );
    assert.match(
      text,
      /import\s*\{[^}]*\bcanonicalLogin\b[^}]*\}\s*from\s*"\.\.\/utils\/trading\/recoveryClock\.js"/s,
      `${module} does not import the shared canonicalLogin`
    );
  });
}

test("the scan's own login copy is still the only documented exception", () => {
  const text = readSource("lib/mt5HistoryRecoveryScan.js");

  // Named so the exception cannot quietly become the norm: when the scan is
  // converged this assertion has to be deleted, not carried forward.
  assert.match(text, /function canonicalLogin\s*\(/);
  assert.equal(ALLOWED_LOGIN_RULE_FILES.length, 2);
});

// ==========================================================
// 2. What the shared rule itself decides
// ==========================================================

test("canonicalises every spelling of one account to the same login", () => {
  for (const [value, expected] of CANONICAL_FORMS) {
    const verdict = canonicalLogin(value);

    assert.equal(
      verdict.login,
      expected,
      `expected "${String(value)}" to canonicalise to ${expected}`
    );
    assert.equal(verdict.missing, undefined);
    assert.equal(verdict.invalid, undefined);
  }
});

test("refuses a value that cannot name an MT5 login", () => {
  for (const [value, kind] of NOT_A_LOGIN) {
    const verdict = canonicalLogin(value);

    assert.equal(
      verdict.login,
      undefined,
      `expected "${String(value)}" to be refused, got ${verdict.login}`
    );
    assert.equal(
      Boolean(verdict[kind]),
      true,
      `expected "${String(value)}" to be tagged ${kind}`
    );
  }
});

test("canonicalising a login never merges two accounts", () => {
  for (const [value] of CANONICAL_FORMS) {
    assert.notEqual(
      expectedLogin(value),
      expectedLogin(OTHER_LOGIN),
      `"${String(value)}" and "${OTHER_LOGIN}" must not share a login`
    );
  }

  assert.notEqual(expectedLogin("00087654321"), expectedLogin(LOGIN));
});

// ==========================================================
// 3. The remaining divergence, pinned rather than assumed away
// ==========================================================

test("the scan still refuses a numeric login the shared rule accepts", async () => {
  const numericLogin = Number(LOGIN);

  assert.equal(canonicalLogin(numericLogin).login, LOGIN);

  const calls = [];

  const outcome = await runHistoryRecoveryScan({
    apiUrl: "http://localhost:4000",
    fetchImpl: async (url) => {
      calls.push(url);

      return { ok: false, status: 503, json: async () => ({ success: false }) };
    },
    identity: { mt5Login: numericLogin, mt5Server: SERVER },
    windows: [
      { fromUtc: "2026-01-01T00:00:00Z", toUtc: "2026-01-08T00:00:00Z" },
    ],
  });

  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.code, RECOVERY_SCAN_CODES.INVALID_MT5_IDENTITY);
  assert.equal(calls.length, 0);
});
