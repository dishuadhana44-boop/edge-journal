// ============================================================
// JOURNAL UI RUNTIME (Phase 3X-8E-3B)
// ============================================================
//
// What this file is: the Phase 3X-8C acknowledgement chain run for real, in a
// jsdom document, with the installed React 19 runtime. The chain under test is
//
//   Save click -> JournalContext's persistence effect -> byte-verified write
//   into a FAKE in-memory storage -> receipt publication ->
//   useSyncExternalStore notification -> the acknowledgement in
//   src/pages/TradeJournal.jsx
//
// What is real here: src/context/JournalContext.jsx (provider, store
// subscription, save effect, storage-event effect), src/pages/TradeJournal.jsx,
// src/components/trade/JournalLayout.jsx and src/components/trade/TradeHeader.jsx
// including its real Save button and onClick, plus the tested pure modules they
// import. Nothing about the acknowledgement is stubbed.
//
// What is substituted, and only to keep the module graph inside this chain:
// TradeDetails, ChartsSection, ReflectionSection and lucide-react. The provider
// and the header are deliberately NOT substituted, which is what separates this
// file from journalUiStaticRender.test.js - that file could run no effect, so it
// could never show a toast appear or change.
//
// ISOLATION, stated exactly:
//   - Storage is a fake object built in this file, installed as
//     globalThis.localStorage and window.localStorage before React mounts. It is
//     a Map, and nothing here reaches a browser's real storage.
//   - No router from the application is mounted: MemoryRouter only, at
//     /trade/1, with a seeded row whose id is "1" so the existing
//     trades.find() in src/pages/TradeJournal.jsx:33-35 has a match.
//   - Every transport entry point on both globalThis and the jsdom window is a
//     throwing tripwire, and the runner asserts it recorded nothing after every
//     scenario.
//   - jsdom is built with no runScripts and no resources:"usable", so this file
//     cannot load an external resource even by accident.
//   - A fresh bundle is built and evaluated for every scenario, because the
//     receipt counter, the published snapshot and the listener set are module
//     globals (src/context/JournalContext.jsx:49-54) and would otherwise leak
//     from one scenario into the next.
//   - React.act and react-dom/client.createRoot drive the tree; every root is
//     unmounted, mocked timers reset and every installed descriptor restored in
//     finally, including when an assertion fails.
//
// THE LIMIT OF THIS FILE, stated up front: this is jsdom, not Chrome. It proves
// the chain above runs and produces the copy the components ask for; it proves
// nothing about CSS animation, real quota behaviour, a second tab's process, or
// a real browser's storage semantics. It also does not prove per-click
// attribution: a receipt says a verified write was reported, never which click
// caused it (src/lib/journalPersistenceStore.js:16-21), and no test here claims
// otherwise. The reducer's rejection of a receipt that is not strictly newer is
// exercised by journalPersistenceStore.test.js; the cross-tab scenario below
// shows only that a reload publishes no save event of its own.
//
// 8E-5B DETECTION LIMITS of the three added mutants, stated where they are
// mapped:
//   - notificationSuppressed proves subscriber notification only at MOUNT. The
//     provider performs no state update of its own there
//     (src/context/JournalContext.jsx:184-336), so the published readStatus can
//     reach a render only through useSyncExternalStore. After a save the trades
//     state moves too (src/pages/TradeJournal.jsx:89-105), so a save-time
//     notification can never be distinguished from that render - no probe here
//     claims it.
//   - receiptOnUnverifiedWrite is invisible to a verified write: the increment
//     runs exactly once either way, so only the failed and unverified branches
//     can reject it.
//   - keyChangeConfirms is only detectable where the key moves AND the verdict
//     forbids the saved claim. Both mismatchedReadback and throwingWrite qualify
//     now that throwingWrite arms its failure after a healthy mount, so the save
//     effect moves writeStatus from OK to the failure while the baseline still
//     holds the healthy key. firstVerifiedSave does NOT qualify: there the key
//     moves too, but savedConfirmed is legitimately true, so a comparator that
//     ignores it renders the correct toast and cannot reject the mutant.

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

import {
  JOURNAL_PERSISTENCE_STATUS,
  describeJournalPersistence,
} from "./journalPersistenceStatus.js";
import {
  JOURNAL_READ_STATUS,
  JOURNAL_STORAGE_KEY,
  JOURNAL_WRITE_STATUS,
} from "./journalStorage.js";
import { journalPersistenceKey } from "./journalPersistenceStore.js";

const nodeRequire = createRequire(import.meta.url);

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

const HARNESS_GLOBAL = "__EDGEFLO_RUNTIME_HARNESS__";
const ROUTE = "/trade/1";
const ACCOUNT_ID = "acct-1";
const STORAGE_KEYS = Object.freeze(["selectedAccountId", "trades"]);

const TRANSPORT_GLOBALS = Object.freeze([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
]);

// Only names the bundle or React can actually reach. Every value copied here
// comes from this scenario's jsdom window and is restored afterwards.
const DOM_GLOBAL_CANDIDATES = Object.freeze([
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLDivElement",
  "HTMLButtonElement",
  "HTMLAnchorElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "StorageEvent",
  "getComputedStyle",
]);

// ============================================================
// FIXTURES
// ============================================================
//
// Row shapes come from the producer: normalizeJournalTrade keeps `id`, derives
// pair/symbol/date/day/session/direction/result/pnl and reads accountId
// (src/lib/journalTradeNormalization.js:557-680), so these are ordinary live
// rows.

const SEED_TRADES = Object.freeze([
  Object.freeze({
    id: "1",
    accountId: ACCOUNT_ID,
    pair: "EURUSD",
    direction: "Buy",
    result: "Win",
    pnl: 12.5,
    entryPrice: 1.085,
    stopLoss: 1.08,
    takeProfit: 1.095,
    openedAt: "2026-10-01T10:00:00.000Z",
    closedAt: "2026-10-01T11:30:00.000Z",
    reflection: Object.freeze({ selectedPlanId: "plan-a" }),
  }),
  Object.freeze({
    id: "2",
    accountId: ACCOUNT_ID,
    pair: "GBPUSD",
    direction: "Sell",
    result: "Loss",
    pnl: -8,
    entryPrice: 1.27,
    stopLoss: 1.28,
    takeProfit: 1.26,
    openedAt: "2026-10-02T09:00:00.000Z",
    closedAt: "2026-10-02T09:45:00.000Z",
    reflection: Object.freeze({ selectedPlanId: "plan-a" }),
  }),
]);

function journalBytes(rows) {
  return JSON.stringify(rows);
}

// ============================================================
// FAKE STORAGE
// ============================================================
//
// One object can produce every outcome the chain meets: setItem throwing gives a
// write failure, and a getItem that answers with different bytes gives an
// unverified write, because journalStorage.js:235 only reports OK when the
// read-back is identical to what it wrote. `verifiedWrites()` counts exactly
// what the storage helper would have accepted, so a receipt is checked against
// storage behaviour rather than against a number this file happens to expect.

function createFakeStorage(initial, mode = {}) {
  const values = new Map(Object.entries(initial));
  const flags = { throwOnSetItem: false, corruptReadback: false, ...mode };
  const log = { writes: [], reads: 0 };

  let pending = null;

  function answer(key, raw) {
    const corrupted =
      flags.corruptReadback && key === JOURNAL_STORAGE_KEY && typeof raw === "string";

    return corrupted ? `${raw} ` : raw;
  }

  const storage = {
    getItem(name) {
      const key = String(name);

      log.reads += 1;

      const raw = answer(key, values.has(key) ? values.get(key) : null);

      if (pending !== null && pending.key === key) {
        pending.readBack = raw;
        pending.verified = raw === pending.value;
        pending = null;
      }

      return raw;
    },
    setItem(name, value) {
      const key = String(name);
      const record = {
        key,
        value: String(value),
        threw: false,
        readBack: undefined,
        verified: false,
      };

      log.writes.push(record);

      if (flags.throwOnSetItem) {
        record.threw = true;

        throw new Error("QuotaExceededError: simulated storage failure");
      }

      values.set(key, String(value));

      pending = record;
    },
    removeItem(name) {
      values.delete(String(name));
    },
  };

  return {
    storage,
    mode: flags,
    log,
    keys: () => [...values.keys()].sort(),
    rawValue: (key) => (values.has(key) ? values.get(key) : null),
    verifiedWrites: () =>
      log.writes.filter((write) => write.threw === false && write.verified === true)
        .length,
    // An external writer (another tab) changes the value without producing a
    // write record, so any receipt it appears to have earned is visibly one the
    // chain could not have produced.
    setExternally: (key, value) => {
      values.set(key, value);
    },
  };
}

// ============================================================
// STUBS
// ============================================================
//
// Leaf UI only. There is deliberately no substitution for
// context/JournalContext or TradeHeader: the point of this file is that the real
// provider publishes and the real header's button is what gets clicked.

const REACT_IMPORT = 'import { createElement } from "react";\n';

const STUBS = Object.freeze({
  tradeDetails: `${REACT_IMPORT}
export default function TradeDetails(props) {
  return createElement("div", { "data-stub": "tradeDetails" }, [
    "TRADE_DETAILS|trade=",
    String(props.trade ? props.trade.id : "none"),
  ].join(""));
}`,

  chartsSection: `${REACT_IMPORT}
export default function ChartsSection(props) {
  return createElement("div", { "data-stub": "chartsSection" }, [
    "CHARTS_SECTION|trade=",
    String(props.trade ? props.trade.id : "none"),
  ].join(""));
}`,

  reflectionSection: `${REACT_IMPORT}
export default function ReflectionSection(props) {
  return createElement("div", { "data-stub": "reflectionSection" }, [
    "REFLECTION_SECTION|trade=",
    String(props.trade ? props.trade.id : "none"),
  ].join(""));
}`,

  // Only the four icons src/components/trade/TradeHeader.jsx:1-6 imports. If the
  // graph ever grows past them, esbuild fails with "No matching export", which is
  // the same signal the bundle-input allowlist below gives.
  lucide: `${REACT_IMPORT}
const icon = (name) => function Icon() {
  return createElement("svg", { "data-icon": name });
};
export const ArrowLeft = icon("ArrowLeft");
export const ChevronLeft = icon("ChevronLeft");
export const ChevronRight = icon("ChevronRight");
export const Save = icon("Save");`,
});

const SUBSTITUTIONS = Object.freeze([
  [/TradeDetails$/, "tradeDetails"],
  [/ChartsSection$/, "chartsSection"],
  [/ReflectionSection$/, "reflectionSection"],
  [/^lucide-react$/, "lucide"],
]);

function stubPlugin(substitutions) {
  return {
    name: "edgeflo-runtime-stubs",
    setup(build) {
      for (const [filter, key] of substitutions) {
        build.onResolve({ filter }, () => ({
          path: key,
          namespace: "edgeflo-runtime-stub",
        }));
      }

      build.onLoad(
        { filter: /.*/, namespace: "edgeflo-runtime-stub" },
        (args) => ({
          contents: STUBS[args.path],
          loader: "js",
          resolveDir: `${repoRoot}/src`,
        }),
      );
    },
  };
}

// ============================================================
// IN-MEMORY MUTATIONS
// ============================================================
//
// Each one is a plausible wrong implementation, applied only to the text esbuild
// reads. No repository file is written. mutationPlugin asserts the replacement
// changed the source, so a mutant whose anchor no longer exists fails loudly
// instead of quietly passing as "verified".

const MUTATIONS = Object.freeze({
  // The feedback key stops reading the receipt, so a second verified write is
  // indistinguishable from silence - the defect 3X-8C fixed (R1).
  keyIgnoresReceipt: {
    file: "lib/journalPersistenceStore.js",
    from: "    value.writeReceipt ?? null,",
    to: "    null,",
  },
  // A verified write stops stamping a receipt.
  noReceiptStamp: {
    file: "context/JournalContext.jsx",
    from: "journalWriteReceipt += 1;",
    to: "journalWriteReceipt += 0;",
  },
  // A read-only publish reports a successful write it never performed and mints
  // a newer receipt for it. Note that a receipt alone is not enough to get the
  // lie published: reduceJournalPersistence refuses a receipt whose patch does
  // not report a write status (src/lib/journalPersistenceStore.js:63-66), so
  // this mutant has to carry both halves. That guard is what makes the runtime
  // unable to reach the reducer's bad-receipt rejection on its own.
  reloadMintsReceipt: {
    file: "context/JournalContext.jsx",
    from: /publishJournalPersistence\(\{\r?\n[ ]{6}readStatus: read\.status,\r?\n[ ]{6}message: null,\r?\n[ ]{4}\}\)/,
    to: [
      "publishJournalPersistence({",
      "      readStatus: read.status,",
      "      message: null,",
      '      writeStatus: "ok",',
      "      persisted: true,",
      "      writeReceipt: journalWriteReceipt + 1,",
      "    })",
    ].join("\n"),
  },
  // The storage-event cleanup registers instead of unregistering.
  storageListenerLeak: {
    file: "context/JournalContext.jsx",
    from: "window.removeEventListener(",
    to: "window.addEventListener(",
  },
  // Byte verification is skipped, so a mismatched read-back reports success.
  verifyMismatchIgnored: {
    file: "lib/journalStorage.js",
    from: "  if (written !== serialized) {",
    to: "  if (false) {",
  },
  // A setItem that throws is reported as a persisted write.
  setItemThrowIgnored: {
    file: "lib/journalStorage.js",
    from: /return writeResult\(\r?\n[ ]{6}JOURNAL_WRITE_STATUS\.WRITE_ERROR,\r?\n[ ]{6}false,\r?\n[ ]{6}count,\r?\n[ ]{6}"SET_ITEM_THREW",/,
    to: [
      "return writeResult(",
      "      JOURNAL_WRITE_STATUS.OK,",
      "      true,",
      "      count,",
      '      "SET_ITEM_THREW",',
    ].join("\n"),
  },
  // The read that proves the journal is intact answers that it is not.
  journalUnreadableAtMount: {
    file: "lib/journalStorage.js",
    from: "return readResult(JOURNAL_READ_STATUS.OK, parsed.slice());",
    to: [
      "return readResult(",
      "      JOURNAL_READ_STATUS.NOT_ARRAY,",
      "      null,",
      '      "MUTANT",',
      '      "mutated read",',
      "    );",
    ].join("\n"),
  },
  // The acknowledgement is never rendered.
  ackNeverRendered: {
    file: "pages/TradeJournal.jsx",
    from: "{saveAcknowledged && (",
    to: "{false && (",
  },
  // The auto-hide deadline is shortened.
  ackHidesEarly: {
    file: "pages/TradeJournal.jsx",
    from: "      4000",
    to: "      3000",
  },
  // The timer stops depending on the published state, so a newer write cannot
  // rearm it.
  timerNotRearmed: {
    file: "pages/TradeJournal.jsx",
    from: "  }, [saveAcknowledged, journalPersistence]);",
    to: "  }, [saveAcknowledged]);",
  },
  // 8E-5B A. The receipt increment leaves the verified-write gate, so a write
  // that threw or read back differently still mints one. A verified write
  // behaves exactly as before - the increment runs once either way - so only the
  // failure branches can tell this apart, which is what makes it surgical rather
  // than a blanket break.
  receiptOnUnverifiedWrite: {
    file: "context/JournalContext.jsx",
    // Multi-line anchors have to allow \r\n: the repository files are CRLF, and
    // a \\n-only anchor simply would not match.
    from: /if \(result\.persisted\) \{\r?\n[ ]{6}journalWriteReceipt \+= 1;\r?\n[ ]{4}\} else \{/,
    to: [
      "journalWriteReceipt += 1;",
      "    if (result.persisted) {",
      "      ;",
      "    } else {",
    ].join("\n"),
  },
  // 8E-5B B. The published snapshot still replaces the module's snapshot, and
  // `changed` is still honoured, but no subscriber is told to re-read it.
  // journalPersistenceStore.js is pure and holds no listeners
  // (src/lib/journalPersistenceStore.js:28-121), so the notification loop this
  // mutant targets is the provider's (src/context/JournalContext.jsx:70-72) -
  // that is where "subscriber notification suppressed" actually lives.
  notificationSuppressed: {
    file: "context/JournalContext.jsx",
    from: /journalPersistenceListeners\.forEach\(\r?\n[ ]{4}\(listener\) => listener\(\)\r?\n[ ]{2}\);/,
    to: "// MUTANT B: subscriber notification suppressed",
  },
  // 8E-5B C. The comparator accepts a moved feedback key on its own, so a write
  // the storage helper could not verify is acknowledged to the user as saved.
  // The returned shape is unchanged; only the conjunction is.
  keyChangeConfirms: {
    file: "lib/journalPersistenceStore.js",
    from: "    confirmed: keyChanged && savedConfirmed,",
    to: "    confirmed: keyChanged,",
  },
});

function mutationPlugin(mutation) {
  return {
    name: "edgeflo-runtime-mutation",
    setup(build) {
      if (!mutation) {
        return;
      }

      // Both extensions: the chain runs through pure .js modules as well as the
      // components.
      build.onLoad({ filter: /\.(jsx|js)$/ }, (args) => {
        const relative = args.path.replace(/\\/g, "/");

        if (!relative.endsWith(`src/${mutation.file}`)) {
          return null;
        }

        const before = readFileSync(args.path, "utf8");

        // An anchor may match exactly once. `replace` takes the first
        // occurrence, so a repeated anchor would silently mutate a different
        // site than the one this file documents. A stale anchor has to be
        // reported as an assertion too, not as reading .length of null.
        const matches =
          typeof mutation.from === "string"
            ? before.split(mutation.from).length - 1
            : (before.match(new RegExp(mutation.from.source, "g")) ?? []).length;

        assert.equal(
          matches,
          1,
          `${String(mutation.from)} must match ${mutation.file} exactly once, got ${matches}`,
        );

        const after = before.replace(mutation.from, mutation.to);

        assert.notEqual(
          after,
          before,
          `${String(mutation.from)} must change ${mutation.file}`,
        );

        return {
          contents: after,
          loader: /\.jsx$/.test(relative) ? "jsx" : "js",
        };
      });
    },
  };
}

// ============================================================
// BUNDLE
// ============================================================

const ENTRY = [
  'export { JournalProvider, useJournal } from "./context/JournalContext.jsx";',
  'export { default as TradeJournal } from "./pages/TradeJournal.jsx";',
  'import { useJournal } from "./context/JournalContext.jsx";',
  // esbuild resolves this specifier and the one TradeJournal.jsx uses to the
  // same absolute path, so Probe and the page read one provider instance - and
  // what Probe records is exactly what useSyncExternalStore handed to the page.
  `export function Probe() {
  const journal = useJournal();

  globalThis["${HARNESS_GLOBAL}"].renders.push({
    snapshot: journal.journalPersistence,
    trades: journal.trades,
    selectedAccountId: journal.selectedAccountId,
  });

  return null;
}`,
].join("\n");

async function buildRuntimeBundle(mutation, substitutions = SUBSTITUTIONS) {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "journalUiRuntimeEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    plugins: [mutationPlugin(mutation), stubPlugin(substitutions)],
    // Held out so the components run against this process's React and router
    // rather than a second copy with its own dispatcher.
    external: ["react", "react/jsx-runtime", "react-dom/client", "react-router-dom"],
  });

  assert.equal(result.outputFiles.length, 1, "the runtime harness must stay in memory");

  return {
    code: result.outputFiles[0].text,
    inputs: Object.keys(result.metafile.inputs).sort(),
  };
}

// React is required only after jsdom globals are installed, so react-dom/client
// initializes against a document instead of recording a documentless canUseDOM.
let sharedPromise = null;

function loadSharedModules() {
  if (sharedPromise === null) {
    sharedPromise = Promise.resolve().then(() => ({
      react: nodeRequire("react"),
      "react/jsx-runtime": nodeRequire("react/jsx-runtime"),
      "react-dom/client": nodeRequire("react-dom/client"),
      "react-router-dom": nodeRequire("react-router-dom"),
    }));
  }

  return sharedPromise;
}

function evaluateBundle(code, shared) {
  const loaded = { exports: {} };

  const guardedRequire = (specifier) => {
    const supplied = shared[specifier];

    assert.ok(
      supplied,
      `the runtime bundle may only require shared React/router modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(
    guardedRequire,
    loaded,
    loaded.exports,
  );

  return loaded.exports;
}

function journalTree(modules, shared, { strict }) {
  const { react: React, "react-router-dom": router } = shared;

  const tree = React.createElement(
    modules.JournalProvider,
    null,
    React.createElement(
      React.Fragment,
      null,
      React.createElement(modules.Probe),
      React.createElement(
        router.MemoryRouter,
        { initialEntries: [ROUTE] },
        React.createElement(
          router.Routes,
          null,
          React.createElement(router.Route, {
            path: "/trade/:id",
            element: React.createElement(modules.TradeJournal),
          }),
        ),
      ),
    ),
  );

  return strict ? React.createElement(React.StrictMode, null, tree) : tree;
}

// ============================================================
// SCENARIO RUNNER
// ============================================================
//
// One scenario = one JSDOM, one fake storage, one freshly built and evaluated
// bundle. The scenario body receives a ctx and asserts; everything installed
// here is put back in finally, after the root is unmounted and timers reset.

async function withRuntime(options, scenario) {
  const {
    mutation = null,
    substitutions = SUBSTITUTIONS,
    seedTrades = SEED_TRADES,
    mode = null,
    strictMode = false,
    skipMount = false,
  } = options ?? {};

  const fake = createFakeStorage(
    {
      [JOURNAL_STORAGE_KEY]: journalBytes(seedTrades),
      selectedAccountId: ACCOUNT_ID,
    },
    mode ?? {},
  );

  // No runScripts, no resources:"usable".
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const win = dom.window;

  const sink = { renders: [] };
  const touched = [];
  const ledger = { adds: 0, removes: 0 };
  const logged = { log: [], error: [], warn: [] };
  const restoreSteps = [];

  let root = null;
  let timersEnabled = false;
  let unmountFailure = null;
  let scenarioFailure = null;

  function define(target, name, descriptor) {
    const previous = Object.getOwnPropertyDescriptor(target, name);

    restoreSteps.push(() => {
      if (previous) {
        Object.defineProperty(target, name, previous);
      } else {
        delete target[name];
      }
    });

    Object.defineProperty(target, name, descriptor);
  }

  function tripwire(target, label) {
    for (const name of TRANSPORT_GLOBALS) {
      define(target, name, {
        configurable: true,
        enumerable: true,
        get() {
          touched.push(`${label}.${name}`);

          throw new Error(`the journal runtime harness reached ${label}.${name}`);
        },
      });
    }
  }

  const ctx = {
    fake,
    seedTrades,
    ledger,
    logged,
    inputs: null,
    modules: null,
    shared: null,
    React: null,
    container: null,
    get renders() {
      return sink.renders;
    },
    latest() {
      return sink.renders[sink.renders.length - 1];
    },
    snapshot() {
      return ctx.latest().snapshot;
    },
    receipt() {
      return ctx.snapshot().writeReceipt;
    },
    trades() {
      return ctx.latest().trades;
    },
    selectedAccountId() {
      return ctx.latest().selectedAccountId;
    },
    keys() {
      return fake.keys();
    },
    bytes(key) {
      return fake.rawValue(key);
    },
    writeCount() {
      return fake.log.writes.length;
    },
    verifiedWrites() {
      return fake.verifiedWrites();
    },
    view() {
      return describeJournalPersistence(ctx.snapshot());
    },
    ack() {
      const region = ctx.container.querySelector('[role="status"]');

      if (!region) {
        return null;
      }

      const divs = [...region.querySelectorAll("div")];
      const badge = divs.find(
        (node) =>
          node.className.includes("rounded-full") && node.textContent !== "",
      );
      const bar = divs.find((node) => node.className.includes("toast-progress"));
      const paragraphs = [...region.querySelectorAll("p")].map(
        (node) => node.textContent,
      );

      return {
        role: region.getAttribute("role"),
        ariaLive: region.getAttribute("aria-live"),
        badge: badge ? badge.textContent : null,
        tone: badge ? badge.className : null,
        title: paragraphs[0] ?? null,
        detail: paragraphs[1] ?? null,
        bar: bar ? bar.className : null,
      };
    },
    text() {
      return ctx.container.textContent;
    },
    mode(patch) {
      Object.assign(fake.mode, patch);
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    async mount() {
      await ctx.act(() => {
        root.render(journalTree(ctx.modules, ctx.shared, { strict: strictMode }));
      });
    },
    async clickSave() {
      const button = [...ctx.container.querySelectorAll("button")].find(
        (node) => node.textContent.trim() === "Save",
      );

      assert.ok(button, "the real TradeHeader must render its Save button");

      await ctx.act(() => {
        button.click();
      });

      return button;
    },
    async enableTimers() {
      if (timersEnabled === false) {
        mock.timers.enable({ apis: ["setTimeout"] });

        timersEnabled = true;
      }
    },
    async tick(ms) {
      assert.ok(timersEnabled, "the scenario must enable mocked timers first");

      await ctx.act(() => {
        mock.timers.tick(ms);
      });
    },
    async reloadFromOtherTab(rows) {
      const value = journalBytes(rows);

      await ctx.act(() => {
        fake.setExternally(JOURNAL_STORAGE_KEY, value);

        win.dispatchEvent(
          new win.StorageEvent("storage", {
            key: JOURNAL_STORAGE_KEY,
            newValue: value,
          }),
        );
      });
    },
    async unmountNow() {
      await ctx.act(() => {
        root.unmount();
      });

      root = null;
    },
    // The anti-vacuity anchor, asserted by every mounted scenario: the journal
    // really was read and saving really is permitted, so an amber
    // acknowledgement below can only be about the write, never about an
    // unreadable or blocked session.
    assertMountPreconditions() {
      const snapshot = ctx.snapshot();

      assert.ok(ctx.renders.length > 0, "the provider must render");
      // The provider performs no state update of its own at mount
      // (src/context/JournalContext.jsx:184-336), so this value can only reach a
      // render through the store subscription. That is what makes the
      // notificationSuppressed probe below causal.
      // 8E-5D: two checks, one per defect. The store starts from
      // JOURNAL_PERSISTENCE_INITIAL, whose readStatus is null
      // (src/lib/journalPersistenceStore.js:28-35), so a publish that never
      // reaches a subscriber leaves exactly that null here, while a publish that
      // does reach one but reports an unreadable journal leaves a non-null
      // failure. One combined assertion could only say "not ok", which is why
      // notificationSuppressed and journalUnreadableAtMount used to be
      // indistinguishable. Together the two are the original assertion.
      assert.ok(
        snapshot.readStatus !== null,
        "the mount publish must reach a subscriber",
      );
      assert.equal(
        snapshot.readStatus,
        JOURNAL_READ_STATUS.OK,
        "the journal must be readable at mount",
      );
      assert.equal(snapshot.canPersist, true);
      assert.equal(ctx.selectedAccountId(), ACCOUNT_ID);
      assert.deepEqual(ctx.keys(), [...STORAGE_KEYS]);
      assert.equal(
        ctx.verifiedWrites(),
        ctx.receipt() ?? 0,
        "only a storage-verified write may be stamped on the receipt",
      );
      assert.equal(ctx.ack(), null, "nothing is acknowledged before a save");
    },
  };

  try {
    tripwire(globalThis, "globalThis");

    for (const name of DOM_GLOBAL_CANDIDATES) {
      if (name in win) {
        define(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: win[name],
        });
      }
    }

    define(globalThis, "localStorage", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fake.storage,
    });

    define(win, "localStorage", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fake.storage,
    });

    tripwire(win, "window");

    const addEventListener = win.addEventListener;
    const removeEventListener = win.removeEventListener;

    define(win, "addEventListener", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: (type, ...rest) => {
        if (type === "storage") {
          ledger.adds += 1;
        }

        return addEventListener.call(win, type, ...rest);
      },
    });

    define(win, "removeEventListener", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: (type, ...rest) => {
        if (type === "storage") {
          ledger.removes += 1;
        }

        return removeEventListener.call(win, type, ...rest);
      },
    });

    define(globalThis, HARNESS_GLOBAL, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: sink,
    });

    define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });

    const shared = await loadSharedModules();

    ctx.shared = shared;
    ctx.React = shared.react;

    assert.equal(typeof shared.react.act, "function", "React 19 must expose act");
    assert.equal(
      typeof shared["react-dom/client"].createRoot,
      "function",
      "react-dom/client must expose createRoot",
    );

    // TradeJournal logs the route param on every render
    // (src/pages/TradeJournal.jsx:17) and the provider reports storage failures
    // (:111-116, :280-286). Both are pre-existing app behaviour, captured so the
    // test report stays readable.
    const natives = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    console.log = (...args) => logged.log.push(args.map(String).join(" "));
    console.error = (...args) => logged.error.push(args.map(String).join(" "));
    console.warn = (...args) => logged.warn.push(args.map(String).join(" "));

    restoreSteps.push(() => {
      console.log = natives.log;
      console.error = natives.error;
      console.warn = natives.warn;
    });

    const built = await buildRuntimeBundle(mutation, substitutions);

    ctx.inputs = built.inputs;
    ctx.modules = evaluateBundle(built.code, shared);

    assert.deepEqual(
      Object.keys(ctx.modules).sort(),
      ["JournalProvider", "Probe", "TradeJournal", "useJournal"],
    );

    if (!skipMount) {
      const container = win.document.createElement("div");

      win.document.body.appendChild(container);

      ctx.container = container;
      root = shared["react-dom/client"].createRoot(container);

      await ctx.mount();
    }

    await scenario(ctx);
  } catch (error) {
    scenarioFailure = error;
  } finally {
    if (root !== null) {
      try {
        await ctx.React.act(async () => {
          root.unmount();
        });
      } catch (error) {
        unmountFailure = error;
      }

      root = null;
    }

    if (timersEnabled) {
      mock.timers.reset();
    }

    for (let index = restoreSteps.length - 1; index >= 0; index -= 1) {
      restoreSteps[index]();
    }
  }

  if (scenarioFailure) {
    throw scenarioFailure;
  }

  if (unmountFailure) {
    throw unmountFailure;
  }

  assert.deepEqual(
    touched,
    [],
    "no scenario may read a transport entry point",
  );

  return ctx;
}

// ============================================================
// SCENARIOS
// ============================================================

async function scenarioBundleGraph(ctx) {
  // Nothing from node_modules: React, the router and jsdom stay outside the
  // bundle, so the components use this process's own copies.
  assert.deepEqual(
    ctx.inputs.filter((input) => input.includes("node_modules")),
    [],
  );

  assert.deepEqual(
    ctx.inputs.filter((input) => input.startsWith("src/")).sort(),
    [
      "src/components/trade/JournalLayout.jsx",
      "src/components/trade/TradeHeader.jsx",
      "src/context/JournalContext.jsx",
      // The in-memory stdin entry. A build input, never a file on disk.
      "src/journalUiRuntimeEntry.js",
      "src/lib/journalPersistenceStatus.js",
      "src/lib/journalPersistenceStore.js",
      "src/lib/journalStorage.js",
      "src/lib/journalTradeNormalization.js",
      "src/pages/TradeJournal.jsx",
    ],
  );

  for (const forbidden of [
    "src/main.jsx",
    "src/App.jsx",
    "src/components/Sidebar.jsx",
    "src/layouts/AppLayout.jsx",
    "src/components/trade/TradeDetails.jsx",
    "src/components/trade/ChartsSection.jsx",
    "src/components/trade/ReflectionSection.jsx",
  ]) {
    assert.equal(
      ctx.inputs.includes(forbidden),
      false,
      `${forbidden} must never enter the runtime harness`,
    );
  }

  // The provider and the header are real, which is what the list above protects.
  assert.equal(ctx.inputs.includes("src/context/JournalContext.jsx"), true);
  assert.equal(ctx.inputs.includes("src/components/trade/TradeHeader.jsx"), true);

  // Negative control: dropping one substitution must change the graph, or the
  // allowlist would only be proving that a stub is still a stub.
  let grew;

  try {
    const withoutDetails = await buildRuntimeBundle(
      null,
      SUBSTITUTIONS.filter(([, key]) => key !== "tradeDetails"),
    );

    grew = withoutDetails.inputs.includes("src/components/trade/TradeDetails.jsx");
  } catch (error) {
    // A graph that cannot even be built once the stub is gone is the same
    // evidence: the allowlist is watching a real boundary.
    grew = error instanceof Error;
  }

  assert.equal(grew, true, "removing a substitution must grow the bundle graph");
}

async function scenarioMountPreconditions(ctx) {
  ctx.assertMountPreconditions();

  // The seeded row is the one the route asks for, and the real header rendered
  // it, so the page under test is a journal a user can see.
  assert.equal(ctx.trades().length, 2);
  assert.equal(String(ctx.trades()[0].id), "1");
  assert.match(ctx.text(), /EURUSD/);
  assert.match(ctx.text(), /TRADE_DETAILS\|trade=1/);
  assert.equal(ctx.view().readConfirmed, true);

  // Reading is what got here; nothing was written yet beyond what the journal
  // write effect could prove.
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), journalBytes(ctx.trades()));
}

async function scenarioFirstVerifiedSave(ctx) {
  ctx.assertMountPreconditions();

  const before = ctx.snapshot();
  const receiptBefore = ctx.receipt() ?? 0;
  const storedBefore = ctx.bytes(JOURNAL_STORAGE_KEY);

  await ctx.clickSave();

  const after = ctx.snapshot();
  const ack = ctx.ack();

  assert.ok(ack, "a verified save must be acknowledged on screen");

  // The write landed byte-for-byte in the fake storage, carrying the change the
  // click made.
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), journalBytes(ctx.trades()));
  assert.notEqual(ctx.bytes(JOURNAL_STORAGE_KEY), storedBefore);
  assert.notEqual(
    JSON.parse(ctx.bytes(JOURNAL_STORAGE_KEY))[0].updatedAt,
    JSON.parse(storedBefore)[0].updatedAt,
  );

  // A receipt was published for it, and only for writes storage proved.
  assert.ok(ctx.receipt() > receiptBefore);
  assert.equal(ctx.verifiedWrites(), ctx.receipt());
  assert.equal(after.writeStatus, JOURNAL_WRITE_STATUS.OK);
  assert.equal(after.persisted, true);
  assert.notEqual(after.writeReceipt, before.writeReceipt);

  // The acknowledgement the user sees, and the tested verdict behind it.
  assert.equal(ctx.view().status, JOURNAL_PERSISTENCE_STATUS.HEALTHY);
  assert.equal(ack.role, "status");
  assert.equal(ack.ariaLive, "polite");
  assert.equal(ack.badge, "✓", "a verified save must render the confirmed badge");
  assert.match(ack.tone, /bg-green-500/);
  assert.match(ack.bar, /bg-green-400/);
  assert.equal(ack.title, ctx.view().title);
  assert.equal(ack.detail, ctx.view().detail);
}

async function scenarioRepeatedSaveConfirms(ctx) {
  ctx.assertMountPreconditions();

  await ctx.clickSave();

  const firstAck = ctx.ack();

  assert.ok(firstAck, "the first save must be acknowledged");
  assert.match(
    firstAck.tone,
    /bg-green-500/,
    "a verified save must paint the acknowledgement green",
  );

  const afterFirst = ctx.snapshot();
  const keyAfterFirst = journalPersistenceKey(afterFirst);

  await ctx.clickSave();

  const afterSecond = ctx.snapshot();
  const ack = ctx.ack();

  assert.ok(ack, "the second save must be acknowledged");

  // Every status field repeated itself, so the receipt is the only thing that
  // could tell this save apart - and it did.
  assert.equal(afterSecond.readStatus, afterFirst.readStatus);
  assert.equal(afterSecond.canPersist, afterFirst.canPersist);
  assert.equal(afterSecond.writeStatus, afterFirst.writeStatus);
  assert.equal(afterSecond.persisted, afterFirst.persisted);
  assert.equal(afterSecond.message, afterFirst.message);
  assert.notEqual(afterSecond.writeReceipt, afterFirst.writeReceipt);
  assert.ok(afterSecond.writeReceipt > afterFirst.writeReceipt);
  assert.notEqual(
    journalPersistenceKey(afterSecond),
    keyAfterFirst,
    "a newer verified write must move the feedback key",
  );

  assert.equal(ctx.verifiedWrites(), ctx.receipt());
  assert.equal(ack.badge, "✓");
  assert.match(ack.tone, /bg-green-500/);
  assert.match(ack.bar, /bg-green-400/);
  assert.equal(ack.title, ctx.view().title);
  assert.equal(ack.detail, ctx.view().detail);
}

async function scenarioThrowingWrite(ctx) {
  // 8E-5B: the storage failure is armed AFTER the mount write rather than from
  // the start. It was always allowed to throw at mount, and the shared
  // invariant in assertMountPreconditions still catches a receipt minted there,
  // but that meant an unearned receipt was rejected by a precondition instead of
  // by this scenario's own write-failure branch. Mounting healthy first lets the
  // assertions below establish the failure and only then test the receipt, which
  // is the order a detection has to happen in.
  ctx.assertMountPreconditions();

  const before = ctx.snapshot();
  const storedBefore = ctx.bytes(JOURNAL_STORAGE_KEY);
  const verifiedBefore = ctx.verifiedWrites();

  assert.equal(before.writeStatus, JOURNAL_WRITE_STATUS.OK);
  assert.equal(before.persisted, true);
  assert.ok(before.writeReceipt > 0, "the mount write earned the starting receipt");

  ctx.mode({ throwOnSetItem: true });

  await ctx.clickSave();

  const after = ctx.snapshot();
  const ack = ctx.ack();

  // The intended branch really ran: setItem threw, so the write failed, nothing
  // was verified, and storage still holds the pre-click journal.
  assert.equal(
    after.writeStatus,
    JOURNAL_WRITE_STATUS.WRITE_ERROR,
    "a write that threw must be reported as a write failure",
  );
  assert.equal(after.persisted, false);
  assert.equal(ctx.verifiedWrites(), verifiedBefore, "a throwing write verifies nothing");
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), storedBefore);
  assert.notEqual(journalBytes(ctx.trades()), storedBefore);

  // Only after that evidence: a write that threw mints no receipt.
  assert.equal(
    after.writeReceipt,
    before.writeReceipt,
    "a write that threw may not earn a receipt",
  );

  assert.equal(ctx.view().status, JOURNAL_PERSISTENCE_STATUS.WRITE_FAILED);
  assert.equal(ctx.view().savedConfirmed, false);

  // The page says so instead of claiming a save.
  assert.ok(ack, "a failed save must still answer the click");
  assert.equal(ack.ariaLive, "polite");
  assert.equal(ack.badge, "!", "a failed write may not be acknowledged as saved");
  assert.match(ack.tone, /bg-amber-500/);
  assert.match(ack.bar, /bg-amber-300/);
  assert.equal(ack.title, "Changes are not confirmed as saved");
  assert.equal(
    ack.detail,
    "This browser has not confirmed that these changes reached its storage.",
  );
  assert.notEqual(ack.title, ctx.view().title);
}

async function scenarioMismatchedReadback(ctx) {
  ctx.assertMountPreconditions();

  const before = ctx.snapshot();
  const verifiedBefore = ctx.verifiedWrites();

  assert.equal(before.writeStatus, JOURNAL_WRITE_STATUS.OK);

  ctx.mode({ corruptReadback: true });

  await ctx.clickSave();

  const after = ctx.snapshot();
  const ack = ctx.ack();

  // The bytes went in, but the read-back was not identical, so no save may be
  // claimed and no new receipt may be stamped.
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), journalBytes(ctx.trades()));
  assert.ok(ctx.writeCount() > 1);
  assert.equal(
    after.writeStatus,
    JOURNAL_WRITE_STATUS.UNVERIFIED,
    "a mismatched read-back may not be reported as verified",
  );
  assert.equal(after.persisted, false);
  assert.equal(
    after.message,
    "The saved journal did not read back as it was written.",
  );
  assert.equal(ctx.verifiedWrites(), verifiedBefore);
  assert.equal(
    after.writeReceipt,
    before.writeReceipt,
    "an unverified write may not earn a receipt",
  );

  assert.equal(ctx.view().status, JOURNAL_PERSISTENCE_STATUS.UNVERIFIED);
  assert.equal(ctx.view().savedConfirmed, false);

  assert.ok(ack, "an unverified write must still answer the click");
  assert.equal(ack.badge, "!", "an unverified write may not be acknowledged as saved");
  assert.match(ack.tone, /bg-amber-500/);
  assert.equal(ack.title, "Changes are not confirmed as saved");
  assert.equal(
    ack.detail,
    "This browser has not confirmed that these changes reached its storage.",
  );
}

async function scenarioCrossTabReload(ctx) {
  ctx.assertMountPreconditions();

  await ctx.clickSave();

  const beforeEvent = ctx.snapshot();
  const rendersBefore = ctx.renders.length;
  const writesBefore = ctx.writeCount();

  assert.equal(beforeEvent.writeReceipt, ctx.verifiedWrites());

  const reloaded = [
    ...ctx.seedTrades,
    Object.freeze({
      id: "3",
      accountId: ACCOUNT_ID,
      pair: "USDJPY",
      direction: "Buy",
      result: "Win",
      pnl: 4,
      openedAt: "2026-10-03T01:00:00.000Z",
      closedAt: "2026-10-03T02:00:00.000Z",
    }),
  ];

  await ctx.reloadFromOtherTab(reloaded);

  // Subscriber notification and rendering: the reload reached the provider and
  // the page re-rendered with the other tab's journal.
  assert.ok(ctx.renders.length > rendersBefore, "the reload must re-render");

  const reloadedRender = ctx.renders.find(
    (render) => render.trades.length === ctx.seedTrades.length + 1,
  );

  assert.ok(reloadedRender, "the reloaded journal must be the one rendered");

  // Reducer snapshot identity: the publish that carried the reload only reported
  // read fields, so the store handed back the SAME frozen object and minted
  // nothing. That is what separates a re-read from a save event.
  assert.equal(
    reloadedRender.snapshot,
    beforeEvent,
    "a reload may not publish a save event of its own",
  );
  assert.equal(reloadedRender.snapshot.writeReceipt, beforeEvent.writeReceipt);
  assert.equal(reloadedRender.snapshot.readStatus, JOURNAL_READ_STATUS.OK);

  // The journal write effect then re-verified the reloaded rows, which is a real
  // write and earns its receipt. Nothing here came from the reload publish.
  assert.ok(ctx.writeCount() > writesBefore);
  assert.equal(ctx.receipt(), ctx.verifiedWrites());
  assert.ok(ctx.receipt() > beforeEvent.writeReceipt);

  const ack = ctx.ack();

  assert.ok(ack);
  assert.match(ack.tone, /bg-green-500/);
  assert.equal(ack.title, ctx.view().title);
}

async function scenarioAutoHide(ctx) {
  ctx.assertMountPreconditions();

  await ctx.enableTimers();
  await ctx.clickSave();

  assert.ok(ctx.ack(), "the acknowledgement must appear on the click");

  await ctx.tick(3999);

  const stillThere = ctx.ack();

  assert.ok(stillThere, "the acknowledgement must survive 3999 ms");
  assert.equal(stillThere.ariaLive, "polite");
  assert.match(stillThere.tone, /bg-green-500/);

  await ctx.tick(1);

  assert.equal(ctx.ack(), null, "the acknowledgement must hide at 4000 ms");

  // The journal is still saved; only the transient prompt went away.
  assert.equal(ctx.view().status, JOURNAL_PERSISTENCE_STATUS.HEALTHY);
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), journalBytes(ctx.trades()));
}

async function scenarioTimerRearms(ctx) {
  ctx.assertMountPreconditions();

  await ctx.enableTimers();
  await ctx.clickSave();

  assert.ok(ctx.ack(), "a save must answer the click with an acknowledgement");

  await ctx.tick(2000);
  await ctx.clickSave();

  const afterSecond = ctx.snapshot();

  assert.ok(afterSecond.writeReceipt, "the second save must publish a receipt");
  assert.ok(ctx.ack(), "the second save keeps the acknowledgement up");

  // 8E-5D: 4500 ms is past the FIRST click's deadline (0 + 4000) and still
  // inside the rearmed one (2000 + 4000), so this is where a timer that never
  // moved can be told apart from a timer that was simply shortened. The
  // unmutated chain has to be here at 4500 to be here at 5999 as well, which the
  // check below already required, so this step only narrows when the two fail.
  await ctx.tick(2500);

  assert.ok(ctx.ack(), "the acknowledgement must outlive the original deadline");

  // 3999 ms after the rearm is 5999 ms after the first click, so the prompt can
  // only still be here because the published state rearmed it.
  await ctx.tick(1499);

  assert.ok(ctx.ack(), "a newer persistence event must rearm the timer");

  await ctx.tick(1);

  assert.equal(ctx.ack(), null, "the rearmed timer must still expire");
}

async function scenarioStrictMode(ctx) {
  // StrictMode double-invokes effects, so this scenario never names a write or
  // receipt count: it only checks that what was published was earned.
  assert.ok(ctx.renders.length > 0, "the tree must mount under StrictMode");

  ctx.assertMountPreconditions();

  assert.ok(ctx.writeCount() >= 1, "the mount effect must have written at least once");
  assert.equal(ctx.verifiedWrites(), ctx.receipt());
  assert.equal(ctx.ledger.adds - ctx.ledger.removes, 1, "exactly one live listener");

  await ctx.clickSave();

  const ack = ctx.ack();

  assert.ok(ack, "StrictMode must not swallow the acknowledgement");
  assert.equal(ack.role, "status");
  assert.equal(ack.ariaLive, "polite");
  assert.equal(ack.badge, "✓");
  assert.match(ack.tone, /bg-green-500/);
  assert.equal(ack.title, ctx.view().title);
  assert.equal(ctx.view().status, JOURNAL_PERSISTENCE_STATUS.HEALTHY);
  assert.equal(ctx.verifiedWrites(), ctx.receipt());
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), journalBytes(ctx.trades()));
  assert.equal(ctx.ledger.adds - ctx.ledger.removes, 1);
}

async function scenarioStorageListenerCleanup(ctx) {
  ctx.assertMountPreconditions();

  assert.equal(ctx.ledger.adds, 1, "the provider registers one storage listener");
  assert.equal(ctx.ledger.removes, 0);

  await ctx.unmountNow();

  assert.equal(ctx.ledger.removes, 1, "unmount must remove the storage listener");
  assert.equal(ctx.ledger.adds - ctx.ledger.removes, 0);

  const rendersAfterUnmount = ctx.renders.length;
  const writesAfterUnmount = ctx.writeCount();
  const reloaded = [
    ...ctx.seedTrades,
    Object.freeze({
      id: "3",
      accountId: ACCOUNT_ID,
      pair: "USDJPY",
      direction: "Buy",
      result: "Win",
      pnl: 4,
      openedAt: "2026-10-03T01:00:00.000Z",
      closedAt: "2026-10-03T02:00:00.000Z",
    }),
  ];

  // A reload now reaches nobody: no listener, no render, no re-read, no write.
  // The other tab's bytes are still sitting in storage because the app never
  // looked at them.

  await ctx.reloadFromOtherTab(reloaded);

  assert.equal(ctx.renders.length, rendersAfterUnmount);
  assert.equal(
    ctx.writeCount(),
    writesAfterUnmount,
    "an unmounted provider must not re-read or rewrite the journal",
  );
  assert.equal(ctx.bytes(JOURNAL_STORAGE_KEY), journalBytes(reloaded));
  assert.equal(ctx.container.childElementCount, 0, "the unmounted root renders nothing");
}

const SCENARIOS = Object.freeze({
  bundleGraph: scenarioBundleGraph,
  mountPreconditions: scenarioMountPreconditions,
  firstVerifiedSave: scenarioFirstVerifiedSave,
  repeatedSaveConfirms: scenarioRepeatedSaveConfirms,
  throwingWrite: scenarioThrowingWrite,
  mismatchedReadback: scenarioMismatchedReadback,
  crossTabReload: scenarioCrossTabReload,
  autoHide: scenarioAutoHide,
  timerRearms: scenarioTimerRearms,
  strictMode: scenarioStrictMode,
  storageListenerCleanup: scenarioStorageListenerCleanup,
});

// ============================================================
// 1. THE HARNESS ITSELF
// ============================================================

test("runtime harness bundles the real journal chain in memory and nothing else", () =>
  withRuntime({ skipMount: true }, SCENARIOS.bundleGraph));

test("runtime harness mounts the real provider against fake storage and reads the seeded journal", () =>
  withRuntime({}, SCENARIOS.mountPreconditions));

// ============================================================
// 2. THE ACKNOWLEDGEMENT CHAIN
// ============================================================

test("a first verified save publishes a receipt and renders the healthy acknowledgement", () =>
  withRuntime({}, SCENARIOS.firstVerifiedSave));

test("a second verified save confirms even though every status field repeated", () =>
  withRuntime({}, SCENARIOS.repeatedSaveConfirms));

// 8E-5B: the failure is armed by the scenario after a healthy mount, so the
// mount itself must start clean for the write-failure branch to be the one that
// rejects a mutant.
test("a storage write that throws never renders a healthy acknowledgement", () =>
  withRuntime({}, SCENARIOS.throwingWrite));

test("a byte-mismatched read-back never renders a healthy acknowledgement", () =>
  withRuntime({}, SCENARIOS.mismatchedReadback));

test("a cross-tab reload publishes no save event of its own", () =>
  withRuntime({}, SCENARIOS.crossTabReload));

test("the acknowledgement is visible through 3999 ms and hides at 4000 ms", () =>
  withRuntime({}, SCENARIOS.autoHide));

test("a newer persistence event rearms the acknowledgement timer", () =>
  withRuntime({}, SCENARIOS.timerRearms));

test("StrictMode keeps the acknowledgement honest without assuming a write count", () =>
  withRuntime({ strictMode: true }, SCENARIOS.strictMode));

test("unmounting removes the storage listener and stops the chain", () =>
  withRuntime({}, SCENARIOS.storageListenerCleanup));

// ============================================================
// 3. MUTATION PROBES
// ============================================================
//
// Each row names a mutant and the scenarios that must reject it. A scenario that
// stayed green while the production behaviour it watches was broken would be
// asserting nothing, so these rows are the evidence that the tests above bite.
// Each one must fail with an assertion, not with a crash.
//
// 8E-5B adds a third element: one RegExp per mapped scenario naming the
// assertion that has to reject the mutant. Without it a probe could go "green" by
// tripping any unrelated invariant - a broken mount, a missing button - and the
// suite would report a detection that proved nothing about the behaviour the
// mutant changed. Each row also re-runs its scenario with NO mutation first, so
// a rejection can only mean the mutant moved something.

const PROBES = Object.freeze([
  // 8E-5D gives every legacy row the same evidence the 8E-5B rows already had:
  // the one assertion that has to reject the mutant, in the order the scenario
  // reaches it. Each message below is the literal message of the first assertion
  // the mutant trips in that scenario, established by source inspection.
  [
    "keyIgnoresReceipt",
    ["repeatedSaveConfirms", "firstVerifiedSave"],
    [
      /a verified save must paint the acknowledgement green/,
      /a verified save must render the confirmed badge/,
    ],
  ],
  // The receipt never moves, so the shared precondition is what notices: the
  // fake still counts the mount write as verified
  // (src/lib/journalPersistenceStore.js:47-49 rejects a zero receipt), and no
  // other mutant can reach that assertion.
  [
    "noReceiptStamp",
    ["firstVerifiedSave", "repeatedSaveConfirms", "strictMode"],
    [
      /only a storage-verified write may be stamped on the receipt/,
      /only a storage-verified write may be stamped on the receipt/,
      /only a storage-verified write may be stamped on the receipt/,
    ],
  ],
  [
    "reloadMintsReceipt",
    ["crossTabReload"],
    [/a reload may not publish a save event of its own/],
  ],
  [
    "storageListenerLeak",
    ["storageListenerCleanup"],
    [/unmount must remove the storage listener/],
  ],
  [
    "verifyMismatchIgnored",
    ["mismatchedReadback"],
    [/a mismatched read-back may not be reported as verified/],
  ],
  [
    "setItemThrowIgnored",
    ["throwingWrite"],
    [/a write that threw must be reported as a write failure/],
  ],
  // 8E-5D collision A: the presence half of the mount precondition answers for
  // notificationSuppressed, so this mutant is named by the read half alone.
  [
    "journalUnreadableAtMount",
    ["mountPreconditions"],
    [/the journal must be readable at mount/],
  ],
  [
    "ackNeverRendered",
    [
      "firstVerifiedSave",
      "throwingWrite",
      "mismatchedReadback",
      "autoHide",
      "timerRearms",
      "strictMode",
    ],
    [
      /a verified save must be acknowledged on screen/,
      /a failed save must still answer the click/,
      /an unverified write must still answer the click/,
      /the acknowledgement must appear on the click/,
      /a save must answer the click with an acknowledgement/,
      /StrictMode must not swallow the acknowledgement/,
    ],
  ],
  // 8E-5D collision B: a shortened deadline still rearms, so it survives the new
  // 4500 ms checkpoint and fails at the 5999 ms one. A dropped dependency never
  // reaches 4500 ms alive, which is what keeps these two rows apart.
  [
    "ackHidesEarly",
    ["autoHide", "timerRearms"],
    [
      /the acknowledgement must survive 3999 ms/,
      /a newer persistence event must rearm the timer/,
    ],
  ],
  [
    "timerNotRearmed",
    ["timerRearms"],
    [/the acknowledgement must outlive the original deadline/],
  ],

  // 8E-5B. A receipt minted by an unverified or failed write is rejected by the
  // one assertion in each scenario that compares receipts, and both scenarios
  // first assert their own failure evidence (WRITE_ERROR / UNVERIFIED + the
  // mismatch message), so the receipt line cannot be reached on an unrelated
  // path.
  [
    "receiptOnUnverifiedWrite",
    ["throwingWrite", "mismatchedReadback"],
    [
      /a write that threw may not earn a receipt/,
      /an unverified write may not earn a receipt/,
    ],
  ],
  // 8E-5B. Only the mount precondition can show a suppressed notification, and
  // it does so causally: the provider performs no state update of its own at
  // mount, so the published readStatus reaches a render only through the store
  // subscription. Per-SAVE notification is NOT covered by this probe - after a
  // save the provider re-renders anyway because the trades state moved.
  ["notificationSuppressed", ["mountPreconditions"], [/the mount publish must reach a subscriber/]],
  // 8E-5B. `keyChanged` alone confirms, so a save that failed is acknowledged
  // with the healthy wording even though the verdict forbids the saved claim.
  // Both scenarios here qualify: each mounts healthy, so the failed save really
  // does move the key away from the baseline captured at the click while
  // savedConfirmed stays false. firstVerifiedSave is deliberately NOT mapped -
  // under this mutant its toast is correct, so it could only reject by luck.
  [
    "keyChangeConfirms",
    ["mismatchedReadback", "throwingWrite"],
    [
      /an unverified write may not be acknowledged as saved/,
      /a failed write may not be acknowledged as saved/,
    ],
  ],
]);

for (const [name, scenarioNames, expects = null] of PROBES) {
  test(`mutation probe: ${name} is rejected by the runtime assertions`, async () => {
    for (const [index, scenarioName] of scenarioNames.entries()) {
      // Control: the same scenario against the same untouched disk source with no
      // mutation must pass. If it does not, a rejection below only proves the
      // scenario is broken, so this run is deliberately left uncaught.
      await withRuntime({}, SCENARIOS[scenarioName]);

      let failure = null;

      try {
        await withRuntime({ mutation: MUTATIONS[name] }, SCENARIOS[scenarioName]);
      } catch (error) {
        failure = error;
      }

      assert.ok(
        failure,
        `${name} must make ${scenarioName} fail, and it stayed green`,
      );

      const code = failure.code ?? failure.cause?.code;

      assert.equal(
        code,
        "ERR_ASSERTION",
        `${scenarioName} must reject ${name} with an assertion, got ${String(failure)}`,
      );

      if (expects) {
        // Not every assertion counts as detection: the mutant has to be rejected
        // by the assertion that names the behavior it broke.
        const assertionError = failure.code === "ERR_ASSERTION" ? failure : failure.cause;

        assert.match(
          String(assertionError.message),
          expects[index],
          `${name} must be rejected by the ${scenarioName} assertion named for it`,
        );
      }
    }
  });
}

// ============================================================
// 4. PROBE REGISTRY ARITY
// ============================================================
//
// A row can lose its attribution evidence in the one way nothing else notices:
// a scenario is added to a row, or an expectation is dropped, and the loop above
// reads expects[index] past the end. That reaches assert.match with no RegExp
// and fails as a TypeError naming neither the probe nor the two lists - the same
// silent loss this whole section exists to prevent. The check runs on the
// registry itself, so no bundle is built and no runtime is mounted.
//
// A row with NO expectation list is not a mismatch. That is a legacy row that
// deliberately claims no attribution, and this guard must not reject it for it.
function probeRegistryProblems(probes) {
  const problems = [];

  for (const [name, scenarioNames, expects = null] of probes) {
    if (expects === null) {
      continue;
    }

    if (expects.length !== scenarioNames.length) {
      problems.push(
        `${name} maps ${scenarioNames.length} scenarios to ` +
          `${expects.length} expected assertions`,
      );
    }
  }

  return problems;
}

test("every probe row pairs each scenario with its own expected assertion", () => {
  assert.deepEqual(
    probeRegistryProblems(PROBES),
    [],
    "each row must carry either no expectation list or exactly one per scenario",
  );
});

test("the arity guard rejects a row whose expectations fall short", () => {
  // Drift built from real registry data: the scenarios and expectation list of a
  // shipped row with one scenario added and no expectation for it.
  const drifted = [
    [
      "keyIgnoresReceipt",
      ["repeatedSaveConfirms", "firstVerifiedSave", "autoHide"],
      [
        /a verified save must paint the acknowledgement green/,
        /a verified save must render the confirmed badge/,
      ],
    ],
  ];

  assert.deepEqual(
    probeRegistryProblems(drifted),
    ["keyIgnoresReceipt maps 3 scenarios to 2 expected assertions"],
    "a mismatch must name the probe and both lengths",
  );
});

test("the arity guard leaves a row that claims no attribution alone", () => {
  assert.deepEqual(
    probeRegistryProblems([["legacyProbe", ["autoHide", "timerRearms"], null]]),
    [],
    "a legacy row without expectations is valid",
  );
});
