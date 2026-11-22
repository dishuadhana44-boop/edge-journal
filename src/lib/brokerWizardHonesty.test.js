// ============================================================
// CTRADER CONNECTION WIZARD - SOURCE GATES
// ============================================================
//
// What this file is: text assertions against the wizard's own files. The
// runtime suites mount those files in jsdom and prove what they render; a
// mounted component cannot be shown to have *avoided* a thing it never does, so
// the absences - the other broker, a transport call, a credential, an invented
// number - are proven here, against the source the bundle was built from. This
// follows the precedent of brokerAccountIdentityWiring.test.js.
//
// WHAT THIS CANNOT PROVE, stated up front: nothing here runs the wizard. A
// region of source text without a fetch is not evidence that a browser session
// never issued one; it is evidence that no wizard file could. The behaviours
// these gates protect are separately proven by brokerWizard.runtime.test.js,
// which reaches no transport or storage either - that suite holds the tripwires,
// this suite holds the reading.
//
// Every forbidden term is assembled from fragments. A gate that contained the
// literal it forbids would fail its own file the moment someone widened the
// scan, and a gate nobody can read is a gate nobody trusts.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

// ============================================================
// THE SCANNED SET
// ============================================================

const WIZARD_COMPONENTS = Object.freeze([
  "components/settings/broker-wizard/BrokerWizardOverlay.jsx",
  "components/settings/broker-wizard/WizardStepper.jsx",
  "components/settings/broker-wizard/steps/SearchBrokerStep.jsx",
  "components/settings/broker-wizard/steps/ChooseMethodStep.jsx",
  "components/settings/broker-wizard/steps/AuthorizationIntroStep.jsx",
  "components/settings/broker-wizard/steps/AuthorizationPendingStep.jsx",
  "components/settings/broker-wizard/steps/AccountSelectModal.jsx",
  "components/settings/broker-wizard/steps/VerificationStep.jsx",
]);

const WIZARD_MODEL = "lib/brokerWizardModel.js";

const WIZARD_FILES = Object.freeze([...WIZARD_COMPONENTS, WIZARD_MODEL]);

const sources = Object.freeze(
  Object.fromEntries(WIZARD_FILES.map((relative) => [relative, source(relative)])),
);

test("the wizard source this suite reads is the source the runtime suite mounts", () => {
  // Both suites build the same file list from disk. If a wizard file is added
  // under a different name, or one is renamed, the runtime bundle and these
  // gates would silently start describing different code.
  const runtimeManifest = source("lib/brokerWizard.runtime.test.js");

  for (const relative of WIZARD_COMPONENTS) {
    assert.ok(
      runtimeManifest.includes(relative),
      `${relative} must be part of the mounted wizard`,
    );
  }
});

// ============================================================
// THE PATTERNS
// ============================================================

// Assembled, not written out, so this file cannot be a false positive.
function term(...parts) {
  return parts.join("");
}

const FORBIDDEN = Object.freeze({
  otherBroker: Object.freeze([
    [term("the other broker's short name"), new RegExp(term("MT", "5"), "i")],
    [term("the other broker's full name"), new RegExp(term("Meta", "Trader"), "i")],
  ]),

  transport: Object.freeze([
    ["a network call", new RegExp("\\bfetch\\s*\\(", "i")],
    ["a browser request object", new RegExp(term("XML", "HttpRequest"), "i")],
    ["a socket", new RegExp("WebSocket", "i")],
    ["a server-push stream", new RegExp("EventSource", "i")],
    ["a polling timer", new RegExp("setInterval", "i")],
    ["a request library", new RegExp("\\baxios\\b", "i")],
  ]),

  storage: Object.freeze([
    ["browser storage", new RegExp("localStorage", "i")],
    ["session storage", new RegExp("sessionStorage", "i")],
    ["an origin database", new RegExp("indexedDB", "i")],
    ["a document cookie", new RegExp("\\bdocument\\.cookie\\b", "i")],
  ]),

  credential: Object.freeze([
    ["an access token", new RegExp("accessToken", "i")],
    ["a refresh token", new RegExp("refreshToken", "i")],
  ]),

  inventedNumber: Object.freeze([
    ["a hardcoded account id", /\b\d{6,}\b/],
  ]),

  inventedEndpoint: Object.freeze([
    ["a hardcoded URL", /https?:\/\//],
  ]),

  quotaCopy: Object.freeze([
    ["a quota claim", new RegExp(term("quo", "ta"), "i")],
    ["a plan-tier claim", new RegExp(term("free", " plan"), "i")],
    ["an upgrade prompt", new RegExp("upgrade", "i")],
  ]),
});

function findings(text, patterns) {
  const found = [];

  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) {
      found.push(label);
    }
  }

  return found;
}

function scanAll(patterns, files) {
  const problems = [];

  for (const relative of files) {
    for (const label of findings(sources[relative], patterns)) {
      problems.push(`${relative}: ${label}`);
    }
  }

  return problems;
}

// ============================================================
// 1. THE GATES BITES - EACH SCANNER REPORTS ITS OWN VIOLATION
// ============================================================

test("every forbidden-term scanner reports a violation instead of staying quiet", () => {
  // A scan over an empty list is only evidence that the list was empty. Each
  // group is run against a sentence that breaks it, so a pattern that stopped
  // matching anything at all is caught here rather than in the next suite.
  const VIOLATIONS = Object.freeze([
    ["otherBroker", "Connect MT5 or MetaTrader instead."],
    ["transport", "await fetch(url) then WebSocket and setInterval."],
    ["storage", "localStorage.setItem and indexedDB and docume" + "nt.cookie"],
    ["credential", "keep the access-token in accessToken and refreshToken"],
    ["inventedNumber", "account 5784123 is always available"],
    ["inventedEndpoint", "https://api.example.test/ctrader/status"],
    ["quotaCopy", "the free plan has a low quota, upgrade for more"],
  ]);

  for (const [group, violated] of VIOLATIONS) {
    const patterns = FORBIDDEN[group];

    assert.ok(patterns, `${group} must be a declared pattern group`);

    const found = findings(violated, patterns);

    assert.ok(
      found.length > 0,
      `the ${group} scanner matched nothing, so it cannot protect anything`,
    );
  }

  // And nothing in the scanner's own vocabulary is present in clean text, so a
  // group cannot be satisfied by matching everything.
  const clean = "Choose the cTrader account to connect.";

  for (const group of Object.keys(FORBIDDEN)) {
    assert.deepEqual(findings(clean, FORBIDDEN[group]), [], `${group} must not match clean copy`);
  }
});

// ============================================================
// 2. THE WIZARD OFFERS ONE BROKER
// ============================================================

test("no wizard file names the other broker, in code or in copy", () => {
  assert.deepEqual(
    scanAll(FORBIDDEN.otherBroker, WIZARD_FILES),
    [],
    "the approved wizard is cTrader only",
  );
});

test("no wizard file reaches a transport by itself", () => {
  assert.deepEqual(
    scanAll(FORBIDDEN.transport, WIZARD_COMPONENTS),
    [],
    "a component that fetches is a component that can invent a result",
  );
});

test("no wizard file writes browser storage by itself", () => {
  assert.deepEqual(
    scanAll(FORBIDDEN.storage, WIZARD_COMPONENTS),
    [],
    "the page owns the resume envelope, the wizard may not",
  );
});

test("the pure model holds no transport or storage call", () => {
  assert.deepEqual(
    findings(sources[WIZARD_MODEL], [
      ...FORBIDDEN.transport,
      ...FORBIDDEN.storage,
    ]),
    [],
    "the model must stay importable without a browser or a server",
  );
});

test("no wizard file names a credential field", () => {
  // The resume envelope is whitelisted to five fields precisely so a token
  // cannot ride along; a component that could spell the field out is a
  // component that could be handed one.
  assert.deepEqual(
    scanAll(FORBIDDEN.credential, WIZARD_FILES),
    [],
    "no wizard file may read, write or render a token",
  );
});

test("no wizard file carries an invented id or endpoint", () => {
  assert.deepEqual(
    scanAll(
      [...FORBIDDEN.inventedNumber, ...FORBIDDEN.inventedEndpoint],
      WIZARD_COMPONENTS,
    ),
    [],
    "an id or URL typed into a component is a fixture pretending to be data",
  );
});

test("no wizard file repeats the quota copy that was dropped from the design", () => {
  assert.deepEqual(
    scanAll(FORBIDDEN.quotaCopy, WIZARD_FILES),
    [],
    "the wizard may not claim a limit it has not read",
  );
});

// ============================================================
// 3. THE MODULE GRAPH STAYS INSIDE THE WIZARD
// ============================================================

test("no wizard file imports a context, a service or the page", () => {
  const imported = /from\s+["']([^"']+)["']/g;
  const problems = [];

  for (const relative of WIZARD_COMPONENTS) {
    for (const [, specifier] of sources[relative].matchAll(imported)) {
      if (
        specifier.includes("services/") ||
        specifier.includes("context/") ||
        specifier.includes("BrokerIntegrationPage") ||
        specifier.includes("ctrader")
      ) {
        problems.push(`${relative} imports ${specifier}`);
      }
    }
  }

  assert.deepEqual(problems, [], "the wizard must receive the page's work as props");
});

test("the overlay imports every step it can show", () => {
  const overlay = sources["components/settings/broker-wizard/BrokerWizardOverlay.jsx"];

  const REQUIRED_IMPORTS = Object.freeze([
    "WizardStepper.jsx",
    "SearchBrokerStep.jsx",
    "ChooseMethodStep.jsx",
    "AuthorizationIntroStep.jsx",
    "AuthorizationPendingStep.jsx",
    "AccountSelectModal.jsx",
    "VerificationStep.jsx",
  ]);

  const missing = REQUIRED_IMPORTS.filter((name) => !overlay.includes(name));

  assert.deepEqual(missing, [], `${missing.join(", ")} would be orphaned source`);
});

test("the steps read the same model the page reads", () => {
  const readers = WIZARD_COMPONENTS.filter((relative) =>
    sources[relative].includes("brokerWizardModel.js"),
  );

  assert.ok(
    readers.length > 0,
    "a step deriving its own copy of the rules is a step with its own rules",
  );
});

// ============================================================
// 4. THE TWO GATES THAT MAKE STEP FOUR UNFORGEABLE
// ============================================================

test("the final confirmation is joined to the validated session in the overlay", () => {
  const overlay = sources["components/settings/broker-wizard/BrokerWizardOverlay.jsx"];

  // The runtime suite proves the behaviour by mutating this conjunction away;
  // this gate keeps the conjunction from being quietly rewritten into something
  // a screen name alone satisfies.
  assert.match(
    overlay,
    /screen === "accounts" && verification === VERIFICATION\.connected/,
    "only the account screen joined to a validated session may confirm",
  );

  assert.ok(
    !/^const isConnected =\s*screen === "accounts";/m.test(overlay),
    "a screen name may not decide that a connection happened",
  );
});

test("the blocked-step guard reads the model's verdict rather than a local flag", () => {
  const overlay = sources["components/settings/broker-wizard/BrokerWizardOverlay.jsx"];

  assert.match(
    overlay,
    /canAdvance === false/,
    "Continue must be blocked by the model's advanceBlock(), not by a prop that could be omitted",
  );

  assert.match(
    overlay,
    /busy === true/,
    "a step in flight must not be triggerable twice",
  );
});

test("the account list labels provenance from the collection, not from a row", () => {
  const modal = sources["components/settings/broker-wizard/steps/AccountSelectModal.jsx"];

  assert.match(
    modal,
    /const isLive = accountSource === "live";/,
    "the note must follow the source the aggregate reported",
  );
});

test("the step rail reports only the step number it was handed", () => {
  const stepper = sources["components/settings/broker-wizard/WizardStepper.jsx"];

  assert.deepEqual(
    findings(stepper, FORBIDDEN.transport),
    [],
    "the rail may not read a status to decide what is complete",
  );

  assert.match(
    stepper,
    /currentIndex/,
    "the current step must arrive from the model's currentStep()",
  );
});

test("the pending screen disclaims the connection it is waiting for", () => {
  const pending = sources[
    "components/settings/broker-wizard/steps/AuthorizationPendingStep.jsx"
  ];

  assert.match(
    pending,
    /not a connection/i,
    "a return from authorization must be described as a return",
  );

  assert.ok(
    !/VERIFICATION/.test(pending),
    "the screen shown before any read may not present a verification result",
  );
});

test("the introduction describes the round trip without reporting one", () => {
  const intro = sources[
    "components/settings/broker-wizard/steps/AuthorizationIntroStep.jsx"
  ];

  assert.match(intro, /authorization/i);

  assert.ok(
    !/session|serviceResponse|lastSuccessfulSync/.test(intro),
    "nothing has been read yet, so nothing may be named as evidence",
  );
});
