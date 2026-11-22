// ============================================================
// PEER ADMISSION WIRING CONTRACT (Bootstrap Task 3)
// ============================================================
//
// server/index.js cannot be imported by a test: it reads the environment,
// mounts every router and starts listening as a side effect of loading. The
// repo's answer for that situation is a source contract, so this file pins
// the wiring decisions that the unit tests in
// server/security/peerAdmissionMiddleware.test.js cannot see:
//
//   - the guard is mounted with the cTrader router and with nothing else,
//   - SERVER_ALLOW is validated once, at boot, and a bad list stops the
//     process before it starts listening,
//   - the bind argument list is untouched.
//
// LIMIT: a source contract proves the text of the wiring, not that the
// running backend loaded it. Restarting the service to confirm that is the
// owner's action, never this file's.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const INDEX_SOURCE = fs
  .readFileSync(path.join(HERE, "index.js"), "utf8")
  .replace(/\r\n/g, "\n");

const LOWERED_INDEX_SOURCE = INDEX_SOURCE.toLowerCase();

function countOf(source, needle) {
  let count = 0;
  let at = source.indexOf(needle);

  while (at !== -1) {
    count += 1;
    at = source.indexOf(needle, at + needle.length);
  }

  return count;
}

function expectAt(source, needle, label) {
  const at = source.indexOf(needle);

  assert.notEqual(at, -1, `${label} is missing from server/index.js`);

  return at;
}

/* ============================================================
   the mount
============================================================ */

test("the cTrader mount still reaches the router", () => {
  assert.notEqual(
    INDEX_SOURCE.indexOf('"/api/ctrader"'),
    -1,
    "the /api/ctrader mount is gone",
  );
});

test("the guard is mounted inside the /api/ctrader arguments", () => {
  const mountAt = expectAt(INDEX_SOURCE, '"/api/ctrader"', "the cTrader mount");
  const routerAt = expectAt(
    INDEX_SOURCE.slice(mountAt),
    "ctraderRouter",
    "the cTrader router argument",
  );

  const argumentsSlice = INDEX_SOURCE.slice(mountAt, mountAt + routerAt);

  assert.ok(
    argumentsSlice.includes("createPeerAdmissionMiddleware("),
    "the cTrader mount does not run the peer guard before the router",
  );
});

test("the guard appears exactly once in the whole file", () => {
  assert.equal(
    countOf(INDEX_SOURCE, "createPeerAdmissionMiddleware("),
    1,
    "the guard is mounted more than once",
  );
});

test("every other API route is mounted without the guard", () => {
  for (const [marker, label] of [
    ['app.use("/api/mt5", mt5Router);', "the MT5 router"],
    ['app.use("/api/ai", aiRouter);', "the AI router"],
    ["createBrokersRouter(", "the broker aggregate router"],
    ['app.get("/api/health"', "the health check"],
  ]) {
    assert.ok(
      INDEX_SOURCE.includes(marker),
      `${label} is no longer mounted in its own unguarded form`,
    );
  }

  assert.equal(
    countOf(INDEX_SOURCE, "createPeerAdmissionMiddleware("),
    1,
    "a second mount would change routes this task must not touch",
  );
});

test("index.js delegates the decision instead of making it", () => {
  for (const needle of [
    "remoteaddress",
    "isadmittedpeer",
    "normalizepeer",
    "loopback_peers",
    "x-forwarded",
    "forwarded",
    "real-ip",
    "trust proxy",
    ".headers",
  ]) {
    assert.equal(
      LOWERED_INDEX_SOURCE.includes(needle),
      false,
      `server/index.js must not decide peers itself: found ${needle}`,
    );
  }
});

/* ============================================================
   the boot-time allowlist validation
============================================================ */

test("SERVER_ALLOW is read exactly once", () => {
  assert.equal(
    countOf(INDEX_SOURCE, "process.env.SERVER_ALLOW"),
    1,
    "the allowlist must be read in one place",
  );
});

test("the value read is handed to the boot validator", () => {
  expectAt(
    INDEX_SOURCE,
    "resolveAllowlist(process.env.SERVER_ALLOW)",
    "the allowlist validation call",
  );
});

test("an unusable allowlist stops the boot", () => {
  const guardAt = expectAt(
    INDEX_SOURCE,
    "if (!SERVER_ALLOW_VERDICT.ok) {",
    "the boot refusal branch",
  );

  const refusalAt = expectAt(
    INDEX_SOURCE,
    "SERVER_ALLOW is not usable",
    "the boot refusal",
  );

  const refusalSlice = INDEX_SOURCE.slice(guardAt, refusalAt);

  assert.ok(refusalAt > guardAt, "the refusal must sit inside the failure branch");

  assert.ok(
    refusalSlice.includes("throw"),
    "the boot refusal must throw, not log and continue",
  );

  assert.ok(
    !refusalSlice.includes("console."),
    "the boot refusal must not print and carry on",
  );
});

test("the refusal explains the code and the entry", () => {
  const refusalAt = expectAt(
    INDEX_SOURCE,
    "SERVER_ALLOW is not usable",
    "the boot refusal",
  );
  const message = INDEX_SOURCE.slice(refusalAt, refusalAt + 400);

  assert.ok(message.includes("SERVER_ALLOW_VERDICT.code"), message);
  assert.ok(message.includes("SERVER_ALLOW_VERDICT.detail"), message);
});

test("the refusal happens before the server starts listening", () => {
  const refusalAt = expectAt(
    INDEX_SOURCE,
    "SERVER_ALLOW is not usable",
    "the boot refusal",
  );
  const listenAt = expectAt(INDEX_SOURCE, "server.listen(", "the listen call");

  assert.ok(
    refusalAt < listenAt,
    "a broken allowlist must not be discovered after the port is open",
  );
});

test("the guard is built from the validated entries", () => {
  const mountAt = expectAt(INDEX_SOURCE, '"/api/ctrader"', "the cTrader mount");
  const routerAt = expectAt(
    INDEX_SOURCE.slice(mountAt),
    "ctraderRouter",
    "the cTrader router argument",
  );
  const argumentsSlice = INDEX_SOURCE.slice(mountAt, mountAt + routerAt);

  assert.ok(
    argumentsSlice.includes("SERVER_ALLOW_VERDICT.entries"),
    "the guard must receive the parsed entries, not the raw environment value",
  );
  assert.equal(
    argumentsSlice.includes("process.env.SERVER_ALLOW"),
    false,
    "the guard must not re-read the environment",
  );
});

/* ============================================================
   the bind stays as it is
============================================================ */

test("the listen call still takes no host argument", () => {
  expectAt(
    INDEX_SOURCE,
    "server.listen(PORT, () =>",
    "the unchanged listen call",
  );

  assert.equal(
    LOWERED_INDEX_SOURCE.includes("server.bind"),
    false,
    "a bind helper appeared",
  );

  for (const needle of ['listen(PORT, "', "listen(PORT, '"]) {
    assert.equal(
      INDEX_SOURCE.includes(needle),
      false,
      `the bind host was changed: ${needle}`,
    );
  }
});

test("the listen port still comes from PORT alone", () => {
  expectAt(INDEX_SOURCE, "const PORT = process.env.PORT || 4000;", "the port");

  assert.equal(
    countOf(INDEX_SOURCE, "process.env.PORT"),
    1,
    "a second port reading would fork the configuration",
  );
});
