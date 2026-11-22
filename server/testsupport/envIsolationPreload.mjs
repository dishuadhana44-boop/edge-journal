// ============================================================
// TEST-ONLY DOTENV ISOLATION
//
// Regression runs import modules that configure the environment at
// load time, and the two real configuration files in this repository
// hold live credentials. This preload makes it impossible for a test
// run to read them: every open of a file named exactly ".env" is
// answered from an in-memory fixture instead of the disk, and the
// absolute path the caller asked for is recorded so a test can assert
// WHICH file a code site reached for.
//
// Nothing else is touched: other reads go straight through, no value
// from the fixture is ever secret, and the recorder never holds
// contents.
//
// Usage:
//   node --test --import file:///.../envIsolationPreload.mjs <suite>
//   NODE_OPTIONS="--import file:///.../envIsolationPreload.mjs"
// ============================================================

import fs from "node:fs";
import path from "node:path";

const SYNTHETIC_FIXTURE =
  "QODER_ENV_ISOLATION_SENTINEL=from-synthetic-fixture";

if (!globalThis.__qoderEnvIsolation) {
  const realReadFileSync = fs.readFileSync;
  const attempts = [];

  function askedForEncoding(options) {
    if (typeof options === "string") {
      return Buffer.isEncoding(options);
    }

    return (
      typeof options === "object" &&
      options !== null &&
      typeof options.encoding === "string" &&
      Buffer.isEncoding(options.encoding)
    );
  }

  fs.readFileSync = function isolatedReadFileSync(file, options) {
    let target = null;

    if (typeof file === "string") {
      target = file;
    } else if (file instanceof URL) {
      target = file.pathname;
    } else if (Buffer.isBuffer(file)) {
      target = file.toString("utf8");
    }

    if (target !== null && path.basename(target) === ".env") {
      attempts.push(path.resolve(target));

      return askedForEncoding(options)
        ? SYNTHETIC_FIXTURE
        : Buffer.from(SYNTHETIC_FIXTURE, "utf8");
    }

    return realReadFileSync.call(fs, file, options);
  };

  globalThis.__qoderEnvIsolation = {
    active: true,
    attempts,
    fixtureText: SYNTHETIC_FIXTURE,
    fixtureValue: "from-synthetic-fixture",
    fixtureName: "QODER_ENV_ISOLATION_SENTINEL",
  };
}

export default globalThis.__qoderEnvIsolation;
