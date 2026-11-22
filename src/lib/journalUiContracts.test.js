// ============================================================
// JOURNAL UI CONTRACTS (Phase 3X-7A, Task A)
// ============================================================
//
// Two kinds of assertion live in this file, and they are deliberately kept
// apart:
//
//   1. PURE CONTRACTS - real calls to the already-tested
//      describeJournalPersistence() (src/lib/journalPersistenceStatus.js) for
//      every persistence state the UI can be handed. These prove behaviour.
//   2. SOURCE CONTRACTS - text assertions over the .jsx files. A .jsx file
//      cannot be imported by Node (no React test environment is installed:
//      package.json has no jsdom, @testing-library or vitest), so these check
//      that the wiring was authored the way the contract requires. THEY ARE
//      NOT RUNTIME BEHAVIOR TESTS: they cannot show that a banner appeared, a
//      click worked or bytes reached storage. Rendered behavior is
//      journalUiStaticRender.test.js, and clicks/effects/timers stay untested
//      by both files.
//
// Wording is never restated here as a second source of truth: the strings come
// from describeJournalPersistence() itself. Only the visibility table, the
// severity table and the forbidden-claim list are authored here, because those
// three are the product contract being enforced.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  JOURNAL_PERSISTENCE_SEVERITY,
  JOURNAL_PERSISTENCE_STATUS,
  describeJournalPersistence,
} from "./journalPersistenceStatus.js";
import {
  JOURNAL_READ_STATUS,
  JOURNAL_WRITE_STATUS,
} from "./journalStorage.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function readUi(relativePath) {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

const UI = {
  appLayout: readUi("layouts/AppLayout.jsx"),
  tradeJournal: readUi("pages/TradeJournal.jsx"),
  statisticsOverview: readUi("components/edge/statistics/StatisticsOverview.jsx"),
  performanceTable: readUi("components/edge/statistics/PerformanceTable.jsx"),
  journalContext: readUi("context/JournalContext.jsx"),
  app: readUi("App.jsx"),
  main: readUi("main.jsx"),
  planStatistics: readUi("components/edge/statistics/PlanStatistics.jsx"),
};

// ============================================================
// PERSISTENCE SNAPSHOTS
// ============================================================
//
// Exactly the shape JournalContext publishes (src/context/JournalContext.jsx
// :117-123 and :280-284): a read status, a persistence eligibility flag, and
// the last write outcome.

function snapshot({
  readStatus = JOURNAL_READ_STATUS.OK,
  canPersist = true,
  writeStatus = null,
  persisted = false,
  message = null,
} = {}) {
  return Object.freeze({ readStatus, canPersist, writeStatus, persisted, message });
}

const SNAPSHOTS = Object.freeze({
  healthy: snapshot({
    writeStatus: JOURNAL_WRITE_STATUS.OK,
    persisted: true,
  }),
  ready: snapshot(),
  firstRun: snapshot({ readStatus: JOURNAL_READ_STATUS.ABSENT }),
  unknown: snapshot({ readStatus: null }),
  unreadableJson: snapshot({
    readStatus: JOURNAL_READ_STATUS.INVALID_JSON,
    canPersist: false,
    message: "Unexpected token o in JSON at position 1",
  }),
  unreadableNotArray: snapshot({
    readStatus: JOURNAL_READ_STATUS.NOT_ARRAY,
    canPersist: false,
  }),
  unreadableReadError: snapshot({
    readStatus: JOURNAL_READ_STATUS.READ_ERROR,
    canPersist: false,
  }),
  blocked: snapshot({ canPersist: false }),
  writeFailed: snapshot({
    writeStatus: JOURNAL_WRITE_STATUS.WRITE_ERROR,
    message: "QuotaExceededError",
  }),
  writeUnverified: snapshot({ writeStatus: JOURNAL_WRITE_STATUS.OK }),
  writeUnverifiedStatus: snapshot({
    writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED,
  }),
});

// The product contract: only these four states may raise a banner, and only
// the write failure may escalate past a warning.
const BANNER_VISIBLE = Object.freeze([
  JOURNAL_PERSISTENCE_STATUS.UNREADABLE,
  JOURNAL_PERSISTENCE_STATUS.BLOCKED,
  JOURNAL_PERSISTENCE_STATUS.WRITE_FAILED,
  JOURNAL_PERSISTENCE_STATUS.UNVERIFIED,
]);

// No state may ever say any of these, because no persistence outcome the app
// can observe proves them.
const FORBIDDEN_CLAIMS = Object.freeze([
  "lost",
  "loss",
  "deleted",
  "removed permanently",
  "empty",
  "corrupt",
  "no trades",
  "0 trades",
  "zero trades",
  "reset",
  "restored",
  "recovered",
  "saved successfully",
]);

function viewOf(name) {
  const view = describeJournalPersistence(SNAPSHOTS[name]);

  assert.equal(
    typeof view.title,
    "string",
    `${name}: title must be text`,
  );

  return view;
}

function wordingOf(view) {
  return [view.title, view.detail, view.technicalDetail ?? ""]
    .join(" ")
    .toLowerCase();
}

// ============================================================
// 1. PURE CONTRACTS - describeJournalPersistence()
// ============================================================

test("pure contract: only unreadable, blocked, write-failed and write-unverified ask for a banner", () => {
  const expectedVisible = new Set(BANNER_VISIBLE);

  for (const [name, snapshotValue] of Object.entries(SNAPSHOTS)) {
    const view = describeJournalPersistence(snapshotValue);

    assert.equal(
      view.showBanner,
      expectedVisible.has(view.status),
      `${name}: showBanner must follow the documented visibility table for ${view.status}`,
    );
  }

  // The table must not quietly become vacuous.
  assert.equal(viewOf("healthy").showBanner, false);
  assert.equal(viewOf("ready").showBanner, false);
  assert.equal(viewOf("firstRun").showBanner, false);
  assert.equal(viewOf("unknown").showBanner, false);
  assert.equal(viewOf("unreadableJson").showBanner, true);
  assert.equal(viewOf("blocked").showBanner, true);
  assert.equal(viewOf("writeFailed").showBanner, true);
  assert.equal(viewOf("writeUnverified").showBanner, true);
});

test("pure contract: hidden states carry no severity and visible states warn", () => {
  const severities = new Map();

  for (const [name, snapshotValue] of Object.entries(SNAPSHOTS)) {
    const view = describeJournalPersistence(snapshotValue);

    severities.set(view.status, view.severity);

    if (view.showBanner) {
      assert.ok(
        [
          JOURNAL_PERSISTENCE_SEVERITY.WARNING,
          JOURNAL_PERSISTENCE_SEVERITY.ERROR,
        ].includes(view.severity),
        `${name}: a visible state must be warning or error`,
      );
    } else {
      assert.equal(
        view.severity,
        JOURNAL_PERSISTENCE_SEVERITY.NONE,
        `${name}: a hidden state must not carry a severity`,
      );
    }
  }

  assert.equal(
    severities.get(JOURNAL_PERSISTENCE_STATUS.WRITE_FAILED),
    JOURNAL_PERSISTENCE_SEVERITY.ERROR,
  );
  assert.equal(
    severities.get(JOURNAL_PERSISTENCE_STATUS.UNREADABLE),
    JOURNAL_PERSISTENCE_SEVERITY.WARNING,
  );
});

test("pure contract: only a proven read-back may be described as saved", () => {
  for (const [name, snapshotValue] of Object.entries(SNAPSHOTS)) {
    const view = describeJournalPersistence(snapshotValue);

    assert.equal(
      view.savedConfirmed,
      view.status === JOURNAL_PERSISTENCE_STATUS.HEALTHY,
      `${name}: savedConfirmed must be reserved for the read-back state`,
    );
  }

  // A write that reported ok but was never read back must not look like a save.
  assert.equal(viewOf("writeUnverified").savedConfirmed, false);
  assert.equal(viewOf("ready").savedConfirmed, false);
});

test("pure contract: a blocked session or a failed write still reports its readable journal", () => {
  const trustedReads = new Set([
    JOURNAL_READ_STATUS.OK,
    JOURNAL_READ_STATUS.ABSENT,
  ]);

  for (const [name, snapshotValue] of Object.entries(SNAPSHOTS)) {
    const view = describeJournalPersistence(snapshotValue);

    assert.equal(
      view.readConfirmed,
      trustedReads.has(snapshotValue.readStatus),
      `${name}: readConfirmed must follow the read itself`,
    );
  }

  assert.equal(viewOf("blocked").readConfirmed, true);
  assert.equal(viewOf("writeFailed").readConfirmed, true);
  assert.equal(viewOf("unreadableJson").readConfirmed, false);
});

test("pure contract: no state may claim loss, emptiness or a success it cannot prove", () => {
  for (const [name, snapshotValue] of Object.entries(SNAPSHOTS)) {
    const view = describeJournalPersistence(snapshotValue);
    const wording = wordingOf(view);

    for (const claim of FORBIDDEN_CLAIMS) {
      assert.equal(
        wording.includes(claim),
        false,
        `${name} (${view.status}) must not say "${claim}": ${view.title} / ${view.detail}`,
      );
    }
  }

  // Missing information is described as missing, never as an empty journal.
  for (const unusable of [undefined, null, {}, "nope", []]) {
    const view = describeJournalPersistence(unusable);
    const wording = wordingOf(view);

    for (const claim of FORBIDDEN_CLAIMS) {
      assert.equal(wording.includes(claim), false);
    }

    assert.equal(view.showBanner, false);
    assert.equal(view.savedConfirmed, false);
    assert.equal(view.readConfirmed, false);
  }
});

test("pure contract: the four visible conditions are distinguishable by their titles", () => {
  const titles = BANNER_VISIBLE.map((status) => {
    const match = Object.values(SNAPSHOTS).find(
      (value) => describeJournalPersistence(value).status === status,
    );

    assert.ok(match, `no snapshot reaches ${status}`);

    return describeJournalPersistence(match).title;
  });

  assert.equal(
    new Set(titles).size,
    titles.length,
    `titles must differ per condition: ${titles.join(" | ")}`,
  );
});

test("pure contract: the technical detail stays available without rewriting the plain message", () => {
  const withMessage = viewOf("unreadableJson");
  const withoutMessage = viewOf("unreadableNotArray");

  assert.equal(
    withMessage.technicalDetail,
    SNAPSHOTS.unreadableJson.message,
  );
  assert.equal(withoutMessage.technicalDetail, null);
  assert.equal(withMessage.detail, withoutMessage.detail);
});

test("pure contract: verdicts are frozen, so a component cannot rewrite the claim", () => {
  const view = describeJournalPersistence(SNAPSHOTS.writeFailed);

  assert.equal(Object.isFrozen(view), true);

  // A component that tried to soften the verdict would throw in strict mode,
  // and even a tolerated mutation must not land, so the assertion is on both.
  for (const patch of [
    () => { view.showBanner = false; },
    () => { view.title = "everything is fine"; },
    () => { Object.assign(view, { showBanner: false, savedConfirmed: true }); },
  ]) {
    assert.throws(patch, TypeError);
  }

  assert.equal(view.showBanner, true);
  assert.notEqual(view.title, "everything is fine");
});

// ============================================================
// 2. SOURCE CONTRACTS - how the UI is authored
// ============================================================
//
// Text assertions only. Each one names the wiring it expects; none of them can
// prove that wiring ran.

test("source contract: the banner is authored immediately before the routed page", () => {
  const banner = UI.appLayout.indexOf("<JournalPersistenceBanner");
  const outlet = UI.appLayout.indexOf("<Outlet />");

  assert.ok(banner !== -1, "AppLayout must render JournalPersistenceBanner");
  assert.ok(outlet !== -1, "AppLayout must still render the routed page");
  assert.ok(
    banner < outlet,
    "the banner must be authored before <Outlet />",
  );
  assert.ok(
    banner < UI.appLayout.indexOf("</main>"),
    "the banner must stay inside the routed content area",
  );
});

test("source contract: banner visibility comes from the tested showBanner result", () => {
  assert.ok(
    UI.appLayout.includes("view.showBanner === false"),
    "the banner must be gated by describeJournalPersistence().showBanner",
  );

  // Gating cannot be re-implemented from the status vocabulary, because the
  // status enum is not even imported here.
  assert.equal(
    /JOURNAL_PERSISTENCE_STATUS/.test(UI.appLayout),
    false,
    "AppLayout must not re-derive visibility from raw statuses",
  );

  // Nor may it invent wording.
  assert.ok(UI.appLayout.includes("{view.title}"));
  assert.ok(UI.appLayout.includes("{view.detail}"));
  assert.equal(
    /role="status"/.test(UI.appLayout),
    true,
    "the banner must be announced as a status region",
  );
  assert.equal(
    /aria-live="polite"/.test(UI.appLayout),
    true,
    "the banner must use a polite live region",
  );
});

test("source contract: dismissal hides the message without touching persistence", () => {
  assert.ok(
    /onClick=\{\(\) => setDismissedKey\(conditionKey\)\}/.test(UI.appLayout),
    "dismissal may only record the hidden condition",
  );

  for (const forbidden of ["localStorage", "setItem", "removeItem", "reloadTrades", "canPersist ="]) {
    assert.equal(
      UI.appLayout.includes(forbidden),
      false,
      `dismissal must not reach for ${forbidden}`,
    );
  }
});

test("source contract: statistics consume context trades instead of parsing storage", () => {
  for (const [name, source] of [
    ["StatisticsOverview", UI.statisticsOverview],
    ["PerformanceTable", UI.performanceTable],
  ]) {
    assert.equal(
      source.includes("JSON.parse"),
      false,
      `${name} must not parse stored bytes during render`,
    );
    assert.equal(
      source.includes("localStorage"),
      false,
      `${name} must not read browser storage`,
    );
    assert.ok(
      source.includes("useJournal()"),
      `${name} must read the normalized journal from the context`,
    );
    assert.ok(
      source.includes("Array.isArray(trades)"),
      `${name} must guard a non-array journal before calling .filter()`,
    );
  }
});

test("source contract: the statistics fallback is unreadable-only", () => {
  for (const [name, source] of [
    ["StatisticsOverview", UI.statisticsOverview],
    ["PerformanceTable", UI.performanceTable],
  ]) {
    assert.equal(
      source.split("JOURNAL_PERSISTENCE_STATUS.").length - 1,
      1,
      `${name} should branch on exactly one persistence status`,
    );
    assert.ok(
      source.includes(
        "persistenceView.status === JOURNAL_PERSISTENCE_STATUS.UNREADABLE",
      ),
      `${name}'s fallback must key on the unreadable status`,
    );

    // Trustworthy numbers must not be hidden by the fallback.
    for (const hidden of ["HEALTHY", "READY", "FIRST_RUN", "UNKNOWN", "BLOCKED"]) {
      assert.equal(source.includes(hidden), false);
    }

    assert.ok(
      source.includes("persistenceView.title") &&
        source.includes("persistenceView.detail"),
      `${name}'s fallback must reuse the tested wording`,
    );
  }
});

test("source contract: the trade journal carries no unconditional save claim", () => {
  for (const legacy of ["Trade Saved", "Journal saved successfully"]) {
    assert.equal(
      UI.tradeJournal.includes(legacy),
      false,
      `the unconditional "${legacy}" claim must stay removed`,
    );
  }

  assert.equal(UI.tradeJournal.includes("setShowSaved"), false);

  // The saved claim is no longer spelled out in the page: the page hands the
  // status module's verdict to the tested comparison, which is what requires
  // savedConfirmed (proved by "a missing or dishonest view never confirms" in
  // journalPersistenceStore.test.js).
  assert.ok(
    UI.tradeJournal.includes("describeJournalPersistence(journalPersistence)"),
    "the page must still read its verdict from the status module",
  );

  assert.ok(
    UI.tradeJournal.includes("Changes are not confirmed as saved"),
    "an unconfirmed save must be described as unconfirmed",
  );

  // The claim may only be made after the published status moved, so a previous
  // read-back cannot be read as this click's result. That measurement belongs to
  // the tested store: a page that derives its own key from the raw fields is
  // exactly what made a second successful save look unconfirmed (R1), because
  // the fields it listed could all repeat while the write itself was new.
  assert.ok(UI.tradeJournal.includes("saveBaseline"));
  assert.ok(
    UI.tradeJournal.includes("journalPersistenceKey("),
    "the save baseline must come from the tested key helper",
  );
  assert.ok(
    UI.tradeJournal.includes("compareJournalPersistence("),
    "the acknowledgement must come from the tested comparison helper",
  );
  assert.ok(
    UI.tradeJournal.includes(".confirmed"),
    "the page must confirm through the helper's verdict",
  );
  assert.match(
    UI.tradeJournal,
    /compareJournalPersistence\(\s*journalPersistence,\s*saveBaseline,\s*persistenceView\s*\)/,
    "the comparison must be given the published state, its own baseline and " +
      "the status module's verdict - dropping any one of the three would let " +
      "an old healthy state or a bare receipt confirm this save",
  );

  // The old inline comparison is the defect, not just a spelling of it.
  assert.equal(
    UI.tradeJournal.includes("persistenceKey !== saveBaseline"),
    false,
    "a key the page compares by itself cannot carry the receipt",
  );
  assert.equal(
    UI.tradeJournal.includes('].join("|")'),
    false,
    "the page must not build a persistence key out of raw fields",
  );

  for (const forbidden of ["localStorage", "setItem", "removeItem"]) {
    assert.equal(UI.tradeJournal.includes(forbidden), false);
  }
});

test("source contract: no UI file may reach storage during a render", () => {
  for (const [name, source] of Object.entries({
    appLayout: UI.appLayout,
    tradeJournal: UI.tradeJournal,
    statisticsOverview: UI.statisticsOverview,
    performanceTable: UI.performanceTable,
    planStatistics: UI.planStatistics,
  })) {
    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "fetch(",
      "XMLHttpRequest",
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${name} must not use ${forbidden}`,
      );
    }
  }
});

test("source contract: these UI changes activated no recovery scan, journal writer or watermark", () => {
  const invocations = [
    "planAccountRecoveryPreview(",
    "runHistoryRecoveryScan(",
    "adaptRecoveryJournalRecords(",
    "planRecoveryPreviewFromClock(",
  ];

  for (const [name, source] of Object.entries(UI)) {
    for (const invocation of invocations) {
      assert.equal(
        source.includes(invocation),
        false,
        `${name} must not invoke ${invocation}`,
      );
    }

    assert.equal(
      source.includes("watermark"),
      false,
      `${name} must not mention a watermark`,
    );
  }

  // The four files this work touched import no recovery module at all.
  for (const name of [
    "appLayout",
    "tradeJournal",
    "statisticsOverview",
    "performanceTable",
  ]) {
    assert.equal(UI[name].includes("mt5Recovery"), false);
    assert.equal(UI[name].includes("mt5History"), false);
  }

  // Repo-wide: no component file references recovery machinery or a watermark,
  // and the only non-invoked preview callable lives in TradeContext, which is
  // deliberately excluded here and asserted separately below.
  const jsxFiles = readdirSync(srcRoot, { recursive: true })
    .filter((entry) => entry.endsWith(".jsx"))
    .map((entry) => join(srcRoot, entry));

  const offenders = [];

  for (const filePath of jsxFiles) {
    const text = readFileSync(filePath, "utf8");
    const rel = relative(srcRoot, filePath).replace(/\\/g, "/");

    if (text.includes("watermark")) {
      offenders.push(`${rel}: watermark`);
    }

    for (const invocation of invocations) {
      if (text.includes(invocation)) {
        offenders.push(`${rel}: ${invocation}`);
      }
    }

    const importsRecovery =
      /from ["'][^"']*mt5Recovery[^"']*["']/.test(text) ||
      /from ["'][^"']*mt5History[^"']*["']/.test(text);

    if (importsRecovery && rel !== "context/TradeContext.jsx") {
      offenders.push(`${rel}: imports a recovery module`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("source contract: the journal provider still owns the only write path", () => {
  // The UI may read the published outcome, but writing remains the provider's
  // job - otherwise a banner or a toast could quietly become a writer.
  assert.ok(UI.journalContext.includes("writeJournalStorage("));
  assert.ok(UI.journalContext.includes("useSyncExternalStore"));

  for (const [name, source] of Object.entries(UI)) {
    if (name === "journalContext") {
      continue;
    }

    assert.equal(
      source.includes("writeJournalStorage"),
      false,
      `${name} must not write the journal`,
    );
  }
});

// ============================================================
// RECEIPT WIRING (Phase 3X-8C)
// ============================================================
//
// Same rule as every SOURCE CONTRACT in this file: these assertions show that
// the wiring was authored to route through src/lib/journalPersistenceStore.js,
// whose behaviour the 27 tests in journalPersistenceStore.test.js prove. They
// cannot show that a subscriber was notified, that an effect ran or that bytes
// reached storage - journalUiStaticRender.test.js renders markup and nothing
// here runs an effect, so the runtime sequence stays browser work.

test("source contract: the provider publishes through the tested reducer", () => {
  const context = UI.journalContext;

  assert.ok(
    context.includes('from "../lib/journalPersistenceStore.js"'),
    "the provider must take its persistence store from the tested module",
  );
  assert.ok(
    context.includes("reduceJournalPersistence("),
    "the published snapshot must be produced by the tested reducer",
  );
  assert.ok(
    context.includes("JOURNAL_PERSISTENCE_INITIAL"),
    "the first snapshot must be the tested initial one, not a local copy",
  );

  // R1 lived in a hand-rolled dirty check that merged the patch itself and
  // returned before notifying. It must be gone, not merely accompanied.
  assert.equal(
    context.includes("Object.keys(next).every("),
    false,
    "the provider must not keep its own field-by-field check",
  );
  assert.equal(
    context.includes("Object.freeze({ ...current, ...patch })"),
    false,
    "the provider must not merge a patch into the snapshot itself",
  );

  // The only snapshot a subscriber may ever see is the reducer's output.
  assert.ok(
    context.includes("journalPersistenceSnapshot = snapshot;"),
    "the published snapshot must be the snapshot the reducer returned",
  );
  assert.equal(
    context.includes("journalPersistenceSnapshot = Object.freeze"),
    false,
    "no snapshot may be built outside the reducer",
  );
});

test("source contract: only a verified write result may advance the receipt", () => {
  const context = UI.journalContext;

  const guard = context.indexOf("if (result.persisted) {");
  const bump = context.indexOf("journalWriteReceipt += 1");

  assert.notEqual(guard, -1, "the provider must test what the write proved");
  assert.notEqual(bump, -1, "the provider must advance a receipt counter");
  assert.ok(
    bump > guard,
    "the receipt may only advance inside the persisted branch",
  );
  assert.equal(
    context.split("journalWriteReceipt += 1").length - 1,
    1,
    "one verified write must advance the receipt by exactly one",
  );

  // Only the write path may hand the store a receipt. The mount publish and
  // reloadTrades publish read fields, so a re-read must never read as a save.
  assert.equal(
    context.split("writeReceipt:").length - 1,
    1,
    "a read or reload patch must carry no receipt at all",
  );
});

test("source contract: the feedback key carries the receipt and the banner does not", () => {
  const store = readUi("lib/journalPersistenceStore.js");

  assert.ok(
    store.includes("value.writeReceipt ?? null,"),
    "the feedback key must change when a newer verified write is reported",
  );

  // Pin of existing behaviour, recorded so a later edit does not quietly merge
  // the two keys: the banner's dismissal must survive a receipt bump, or every
  // save would resurrect a message the user already dismissed.
  assert.equal(
    UI.appLayout.includes("journalPersistenceKey"),
    false,
    "the banner must not use the save-feedback key",
  );
  assert.ok(
    UI.appLayout.includes("dismissedKey"),
    "the banner must keep its own dismissal key",
  );
});
