// ============================================================
// JOURNAL UI STATIC RENDER (Phase 3X-7A, Task B)
// ============================================================
//
// What this file is: the existing .jsx components, bundled by the installed
// esbuild JS API IN MEMORY (write:false - no bundle file is produced) and
// rendered to a string with the installed react-dom/server. The components
// themselves are real, and so is the persistence logic they call:
// describeJournalPersistence() enters the bundle from
// src/lib/journalPersistenceStatus.js, so wording is asserted against the same
// tested verdicts, never against a copy.
//
// What is substituted, and why:
//   - src/context/JournalContext is stubbed. Mounting the real provider cannot
//     prove a first paint, because it publishes its read outcome from an effect
//     (src/context/JournalContext.jsx:178-182) and effects never run in a
//     static render - so every banner assertion would be vacuously green. The
//     stub instead feeds controlled snapshots and keeps the real provider,
//     browser storage and application init completely out of the process.
//   - src/components/Sidebar and the four sections under JournalLayout are
//     stubbed so no unrelated module graph (and no transport-capable import)
//     is loaded.
//   - AppLayout, TradeJournal and both statistics components are NOT stubbed,
//     and react-router-dom is the real package driven by a real MemoryRouter,
//     so useParams and <Outlet /> behave as authored.
//
// THE LIMIT OF THIS FILE, stated up front: renderToStaticMarkup produces one
// string from one mount. It runs no effect, starts no timer, fires no handler,
// updates no state and touches no storage. So nothing here is evidence that
// Dismiss works, that the save toast appears or changes wording after a click,
// that the 4 second auto-hide runs, or that a journal round-trips through real
// browser storage. journalUiContracts.test.js covers the pure verdicts and the
// source wiring; those interactions stay unverified until a browser (or a DOM
// test environment, which is not installed) runs them.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as reactRouter from "react-router-dom";

import {
  JOURNAL_PERSISTENCE_STATUS,
  describeJournalPersistence,
} from "./journalPersistenceStatus.js";
import {
  JOURNAL_READ_STATUS,
  JOURNAL_WRITE_STATUS,
} from "./journalStorage.js";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

const OUTLET_MARKER = "OUTLET_MARKER";
const HEADER_MARKER = "TRADE_HEADER";
const DETAILS_MARKER = "TRADE_DETAILS";

// ============================================================
// STUBS
// ============================================================
//
// Test-only module replacements, supplied to esbuild through an in-memory
// namespace. They read the harness off globalThis so the bundle and the test
// file agree on one controlled snapshot.

const harness = {
  journal: null,
  setTradesCalls: 0,
  bundleInputs: null,
};

globalThis.__EDGEFLO_UI_HARNESS__ = harness;

const REACT_IMPORT = 'import { createElement } from "react";\n';

const STUBS = Object.freeze({
  // Only useJournal() is read by the components under test. The real provider
  // is never imported, so nothing here can reach storage.
  journalContext: `${REACT_IMPORT}
export function useJournal() {
  const current = globalThis.__EDGEFLO_UI_HARNESS__.journal;

  if (!current) {
    throw new Error("static render requested with no journal snapshot");
  }

  return {
    trades: current.trades,
    setTrades: current.setTrades,
    journalPersistence: current.journalPersistence,
  };
}
export const JournalProvider = ({ children }) => children;
export default JournalProvider;`,

  sidebar: `${REACT_IMPORT}
export default function Sidebar() {
  return createElement("div", null, "SIDEBAR_MARKER");
}`,

  // JournalLayout itself stays real - its "no trade" branch is part of what is
  // being rendered - so only its four leaf sections are replaced, each one
  // echoing the props it was handed.
  tradeHeader: `${REACT_IMPORT}
const idOf = (row) => {
  if (row === null) return "null";
  if (row === undefined) return "undefined";
  return String(row.id);
};
export default function TradeHeader(props) {
  const parts = [
    "TRADE_HEADER",
    "|trade=", idOf(props.trade),
    "|prev=", idOf(props.previousTrade),
    "|next=", idOf(props.nextTrade),
    "|onSave=", typeof props.onSave,
  ];
  return createElement("div", null, parts.join(""));
}`,

  tradeDetails: `${REACT_IMPORT}
export default function TradeDetails(props) {
  const parts = [
    "TRADE_DETAILS",
    "|trade=", String(props.trade ? props.trade.id : "none"),
    "|setTrade=", typeof props.setTrade,
  ];
  return createElement("div", null, parts.join(""));
}`,

  chartsSection: `${REACT_IMPORT}
export default function ChartsSection(props) {
  return createElement("div", null, ["CHARTS_SECTION", "|trade=",
    String(props.trade ? props.trade.id : "none")].join(""));
}`,

  reflectionSection: `${REACT_IMPORT}
export default function ReflectionSection(props) {
  return createElement("div", null, ["REFLECTION_SECTION", "|trade=",
    String(props.trade ? props.trade.id : "none")].join(""));
}`,

  // Icons render as empty svg elements: enough to keep the metric cards intact
  // without pulling the whole icon package into the bundle. Only the six names
  // the two statistics components import are listed - if the build ever fails
  // with "No matching export ... for import <Name>", the module graph has grown
  // past what this harness substitutes, which is exactly what the bundle-input
  // allowlist below is there to catch.
  lucide: `${REACT_IMPORT}
const icon = (name) => function Icon() {
  return createElement("svg", { "data-icon": name });
};
export const TrendingUp = icon("TrendingUp");
export const Target = icon("Target");
export const Activity = icon("Activity");
export const DollarSign = icon("DollarSign");
export const BarChart3 = icon("BarChart3");
export const Award = icon("Award");`,
});

const SUBSTITUTIONS = [
  [/context\/JournalContext$/, "journalContext"],
  [/components\/Sidebar$/, "sidebar"],
  [/TradeHeader$/, "tradeHeader"],
  [/TradeDetails$/, "tradeDetails"],
  [/ChartsSection$/, "chartsSection"],
  [/ReflectionSection$/, "reflectionSection"],
  [/^lucide-react$/, "lucide"],
];

const stubPlugin = {
  name: "edgeflo-ui-stubs",
  setup(build) {
    for (const [filter, key] of SUBSTITUTIONS) {
      build.onResolve({ filter }, () => ({ path: key, namespace: "edgeflo-stub" }));
    }

    build.onLoad(
      { filter: /.*/, namespace: "edgeflo-stub" },
      (args) => ({
        contents: STUBS[args.path],
        loader: "js",
        resolveDir: `${repoRoot}/src`,
      }),
    );
  },
};

let bundlePromise = null;

// A plausible wrong implementation of each rendered contract, applied to the
// source esbuild reads - in memory only, never on disk and never to the
// repository file. The last test in section 1 uses these to show the render
// assertions can fail; an assertion that survives a broken component is not
// evidence of anything.
const MUTATIONS = Object.freeze({
  // The banner ignores the tested verdict and always shows.
  bannerAlwaysVisible: {
    file: "layouts/AppLayout.jsx",
    from: "if (view.showBanner === false) {",
    to: "if (false) {",
  },
  // The banner is authored below the routed page instead of above it.
  bannerBelowOutlet: {
    file: "layouts/AppLayout.jsx",
    from: /(<JournalPersistenceBanner[\s\S]*?\/>)(\s*)(<Outlet \/>)/,
    to: "$3$2$1",
  },
  // The polite live region is dropped.
  bannerNotPolite: {
    file: "layouts/AppLayout.jsx",
    from: 'aria-live="polite"',
    to: 'aria-live="off"',
  },
  // The statistics fallback keys on the wrong status, so a readable journal in
  // a blocked session is hidden behind a notice.
  fallbackOnBlocked: {
    file: "components/edge/statistics/StatisticsOverview.jsx",
    from: "persistenceView.status === JOURNAL_PERSISTENCE_STATUS.UNREADABLE",
    to: "persistenceView.status === JOURNAL_PERSISTENCE_STATUS.BLOCKED",
  },
  // The array guard is weakened to a truthiness check.
  unguardedTrades: {
    file: "components/edge/statistics/StatisticsOverview.jsx",
    from: "Array.isArray(trades) ? trades : []",
    to: "trades ? trades : []",
  },
  // The plan filter stops filtering.
  unfilteredPlan: {
    file: "components/edge/statistics/StatisticsOverview.jsx",
    from: "trade?.reflection?.selectedPlanId === plan?.id",
    to: "Boolean(trade?.reflection)",
  },
  // The next-row bound is off by one, so the last row points at itself.
  nextOffByOne: {
    file: "pages/TradeJournal.jsx",
    from: "currentIndex < trades.length - 1",
    to: "currentIndex < trades.length",
  },
});

function mutationPlugin(mutation) {
  return {
    name: "edgeflo-ui-mutation",
    setup(build) {
      if (!mutation) {
        return;
      }

      build.onLoad({ filter: /\.jsx$/ }, (args) => {
        const relative = args.path.replace(/\\/g, "/");

        if (!relative.endsWith(`src/${mutation.file}`)) {
          return null;
        }

        const before = readFileSync(args.path, "utf8");
        const after = before.replace(mutation.from, mutation.to);

        assert.notEqual(
          after,
          before,
          `${JSON.stringify(mutation.from)} must change ${mutation.file}`,
        );

        return { contents: after, loader: "jsx" };
      });
    },
  };
}

function loadBundle() {
  if (bundlePromise === null) {
    bundlePromise = buildBundle();
  }

  return bundlePromise;
}

async function buildBundle(mutation = null) {
  const result = await esbuild.build({
    stdin: {
      contents: [
        'export { default as AppLayout } from "./layouts/AppLayout.jsx";',
        'export { default as TradeJournal } from "./pages/TradeJournal.jsx";',
        'export { default as StatisticsOverview } from "./components/edge/statistics/StatisticsOverview.jsx";',
        'export { default as PerformanceTable } from "./components/edge/statistics/PerformanceTable.jsx";',
      ].join("\n"),
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "journalUiHarnessEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    plugins: [mutationPlugin(mutation), stubPlugin],
    // Held out of the bundle so the components share this process's React and
    // router instances instead of getting a second copy.
    external: ["react", "react/jsx-runtime", "react-dom", "react-dom/server", "react-router-dom"],
  });

  assert.equal(result.outputFiles.length, 1, "the harness must stay in memory");

  if (mutation === null) {
    harness.bundleInputs = Object.keys(result.metafile.inputs).sort();
  }

  const sharedModules = {
    react: React,
    "react/jsx-runtime": { jsx, jsxs, Fragment },
    "react-dom": { renderToStaticMarkup },
    "react-dom/server": { renderToStaticMarkup },
    "react-router-dom": reactRouter,
  };

  const loaded = { exports: {} };

  const guardedRequire = (specifier) => {
    const supplied = sharedModules[specifier];

    assert.ok(
      supplied,
      `the harness bundle may only require shared React/router modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", result.outputFiles[0].text)(
    guardedRequire,
    loaded,
    loaded.exports,
  );

  return loaded.exports;
}

// ============================================================
// SNAPSHOTS AND FIXTURES
// ============================================================
//
// The snapshots are exactly the shape JournalContext publishes; the verdict
// each one produces is taken from describeJournalPersistence() itself.

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
  healthy: snapshot({ writeStatus: JOURNAL_WRITE_STATUS.OK, persisted: true }),
  ready: snapshot(),
  firstRun: snapshot({ readStatus: JOURNAL_READ_STATUS.ABSENT }),
  unknown: snapshot({ readStatus: null }),
  // The provider's own initial value (src/context/JournalContext.jsx:37-43):
  // nothing has been read yet, so nothing may be claimed about it.
  providerInitial: Object.freeze({
    readStatus: null,
    canPersist: true,
    writeStatus: null,
    persisted: false,
    message: null,
  }),
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
  writeUnverifiedStatus: snapshot({ writeStatus: JOURNAL_WRITE_STATUS.UNVERIFIED }),
});

const VISIBLE = [
  ["unreadableJson", JOURNAL_PERSISTENCE_STATUS.UNREADABLE],
  ["unreadableNotArray", JOURNAL_PERSISTENCE_STATUS.UNREADABLE],
  ["unreadableReadError", JOURNAL_PERSISTENCE_STATUS.UNREADABLE],
  ["blocked", JOURNAL_PERSISTENCE_STATUS.BLOCKED],
  ["writeFailed", JOURNAL_PERSISTENCE_STATUS.WRITE_FAILED],
  ["writeUnverified", JOURNAL_PERSISTENCE_STATUS.UNVERIFIED],
  ["writeUnverifiedStatus", JOURNAL_PERSISTENCE_STATUS.UNVERIFIED],
];

const HIDDEN = [
  "healthy",
  "ready",
  "firstRun",
  "unknown",
  "providerInitial",
];

// Rows shaped the way the components read them: reflection.selectedPlanId for
// the plan filter, result / pnl / rr for the metrics. pnl deliberately mixes a
// number and a signed currency string, and the plan filter has rows to exclude,
// so a component that ignored either would produce different numbers.
const PLAN = Object.freeze({ id: "p1" });

const TRADES = Object.freeze([
  Object.freeze({ id: 1, result: "Win", pnl: 100, rr: "2.5", reflection: Object.freeze({ selectedPlanId: "p1" }) }),
  Object.freeze({ id: 2, result: "Loss", pnl: "-40.25", rr: "1.0", reflection: Object.freeze({ selectedPlanId: "p1" }) }),
  Object.freeze({ id: 3, result: "BE", pnl: 0, rr: "0", reflection: Object.freeze({ selectedPlanId: "p1" }) }),
  Object.freeze({ id: 4, result: "Win", pnl: 500, rr: "3", reflection: Object.freeze({ selectedPlanId: "other" }) }),
]);

// ============================================================
// RENDER HELPERS
// ============================================================

function setJournal(journalPersistence, trades = TRADES) {
  harness.journal = {
    journalPersistence,
    trades,
    setTrades: () => {
      harness.setTradesCalls += 1;
      throw new Error("the static harness must not mutate the journal");
    },
  };
}

const OutletSentinel = () => createElement("div", null, OUTLET_MARKER);

// The routed tree AppLayout actually lives in (src/App.jsx:125, :279), minus
// the routes this file does not exercise.
function routedTree({ AppLayout, TradeJournal }, location) {
  return createElement(
    reactRouter.MemoryRouter,
    { initialEntries: [location] },
    createElement(
      reactRouter.Routes,
      null,
      createElement(
        reactRouter.Route,
        { element: createElement(AppLayout) },
        createElement(reactRouter.Route, {
          path: "/trade/:id",
          element: createElement(TradeJournal),
        }),
        createElement(reactRouter.Route, {
          path: "/journal",
          element: createElement(OutletSentinel),
        }),
      ),
    ),
  );
}

function render(tree) {
  // TradeJournal logs the route param on every render (src/pages/TradeJournal.jsx:13).
  // That is pre-existing app behavior, not harness output, so it is captured
  // instead of left to pollute the test report.
  const log = console.log;
  const captured = [];

  console.log = (...args) => {
    captured.push(args.join(" "));
  };

  try {
    return { html: renderToStaticMarkup(tree), captured };
  } finally {
    console.log = log;
  }
}

async function renderLayout(snapshotValue, { trades = TRADES, location = "/journal", modules = null } = {}) {
  const bundle = modules ?? (await loadBundle());

  setJournal(snapshotValue, trades);

  return render(routedTree(bundle, location));
}

async function renderTradeAt(snapshotValue, id, { trades = TRADES, modules = null } = {}) {
  const bundle = modules ?? (await loadBundle());
  const { TradeJournal } = bundle;

  setJournal(snapshotValue, trades);

  return render(
    createElement(
      reactRouter.MemoryRouter,
      { initialEntries: [`/trade/${id}`] },
      createElement(
        reactRouter.Routes,
        null,
        createElement(reactRouter.Route, {
          path: "/trade/:id",
          element: createElement(TradeJournal),
        }),
      ),
    ),
  );
}

async function renderStatistics(Component, snapshotValue, { trades = TRADES, plan = PLAN, modules = null } = {}) {
  const bundle = modules ?? (await loadBundle());
  const Target = bundle[Component];

  setJournal(snapshotValue, trades);

  return render(createElement(Target, { plan }));
}

// renderToStaticMarkup escapes quotes and apostrophes, so wording is compared
// after decoding. Tag and attribute checks always use the raw markup.
function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapePattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pull the value a statistics component rendered next to a label, so an
// assertion is about the number a reader would see rather than its presence
// somewhere in the markup.
function labelledValue(html, label) {
  // Labels are compared in markup form, where an ampersand has been escaped.
  const markupLabel = escapePattern(label.replace(/&/g, "&amp;"));
  const pattern = new RegExp(
    `>${markupLabel}</span>\\s*<span[^>]*>([^<]*)</span>` +
      "|" +
      `>${markupLabel}</p>\\s*<h2[^>]*>([^<]*)</h2>`,
  );
  const match = html.match(pattern);

  return match ? (match[1] ?? match[2]) : null;
}

// ============================================================
// 1. THE HARNESS ITSELF
// ============================================================

test("harness loads the real components in memory without reaching the browser or the network", async () => {
  const guarded = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource",
    "localStorage", "sessionStorage", "indexedDB", "navigator"];

  const originals = new Map();
  const touched = [];

  for (const name of guarded) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);

    originals.set(name, previous);

    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        touched.push(name);
        throw new Error(`static render reached ${name}`);
      },
    });
  }

  try {
    const modules = await loadBundle();

    assert.deepEqual(
      Object.keys(modules).sort(),
      ["AppLayout", "PerformanceTable", "StatisticsOverview", "TradeJournal"],
    );

    await renderLayout(SNAPSHOTS.unreadableJson);
    await renderTradeAt(SNAPSHOTS.healthy, 2);
    await renderStatistics("StatisticsOverview", SNAPSHOTS.healthy);
    await renderStatistics("PerformanceTable", SNAPSHOTS.healthy);
  } finally {
    for (const [name, previous] of originals) {
      if (previous) {
        Object.defineProperty(globalThis, name, previous);
      } else {
        delete globalThis[name];
      }
    }
  }

  assert.deepEqual(touched, [], "no browser or transport global may be read during a render");
  assert.equal(harness.setTradesCalls, 0, "no render may write the journal");
  assert.equal(globalThis.__EDGEFLO_UI_HARNESS__, harness);
});

test("harness bundles only the components under test and the tested status module", async () => {
  await loadBundle();

  const inputs = harness.bundleInputs;

  assert.ok(inputs, "the build must report the graph it produced");

  // Nothing from node_modules may be bundled: react, the router and the server
  // renderer stay external and shared, so the components run against this
  // process's own copies rather than a second instance.
  assert.deepEqual(
    inputs.filter((input) => input.includes("node_modules")),
    [],
  );

  // Every repository file that entered the graph is listed. If a substitution
  // stops matching, a real leaf component (and through it charts, editors or
  // transport-capable imports) would appear here and this test would fail.
  assert.deepEqual(
    inputs.filter((input) => input.startsWith("src/")).sort(),
    [
      "src/components/edge/statistics/PerformanceTable.jsx",
      "src/components/edge/statistics/StatisticsOverview.jsx",
      "src/components/trade/JournalLayout.jsx",
      // The in-memory entry this harness feeds esbuild through stdin. It is a
      // build input, never a file on disk.
      "src/journalUiHarnessEntry.js",
      "src/layouts/AppLayout.jsx",
      "src/lib/journalPersistenceStatus.js",
      "src/lib/journalPersistenceStore.js",
      "src/lib/journalStorage.js",
      "src/pages/TradeJournal.jsx",
    ],
  );

  // The stubs are exactly the substituted modules, and the real provider,
  // Sidebar and the four trade sections are not among the graph's sources.
  for (const forbidden of [
    "src/context/JournalContext.jsx",
    "src/components/Sidebar.jsx",
    "src/components/trade/TradeHeader.jsx",
    "src/components/trade/TradeDetails.jsx",
    "src/components/trade/ChartsSection.jsx",
    "src/components/trade/ReflectionSection.jsx",
    "src/main.jsx",
    "src/App.jsx",
  ]) {
    assert.equal(
      inputs.includes(forbidden),
      false,
      `${forbidden} must never enter the static harness`,
    );
  }
});

test("harness render assertions fail against broken components", async () => {
  // Each mutant is a plausible wrong implementation, fed to esbuild in memory
  // only - no repository file is touched. Every case asserts that the predicate
  // this file relies on rejects it, so none of the render checks above can pass
  // by accident.
  const hidden = SNAPSHOTS.healthy;
  const alwaysVisible = await buildBundle(MUTATIONS.bannerAlwaysVisible);
  const { html: mutantHealthy } = await renderLayout(hidden, { modules: alwaysVisible });

  assert.ok(
    mutantHealthy.includes('role="status"'),
    "a banner that ignores showBanner would still render for a healthy journal",
  );

  const belowOutlet = await buildBundle(MUTATIONS.bannerBelowOutlet);
  const { html: mutantOrder } = await renderLayout(SNAPSHOTS.unreadableJson, {
    modules: belowOutlet,
  });

  assert.ok(mutantOrder.includes('role="status"'));
  assert.ok(
    mutantOrder.indexOf('role="status"') > mutantOrder.indexOf(OUTLET_MARKER),
    "the ordering check must be able to see a banner placed after the page",
  );

  const notPolite = await buildBundle(MUTATIONS.bannerNotPolite);
  const { html: mutantAria } = await renderLayout(SNAPSHOTS.blocked, { modules: notPolite });

  assert.equal(
    mutantAria.includes('aria-live="polite"'),
    false,
    "the live-region check must be able to see it removed",
  );

  const wrongFallback = await buildBundle(MUTATIONS.fallbackOnBlocked);
  const blockedMutant = await renderStatistics("StatisticsOverview", SNAPSHOTS.blocked, {
    modules: wrongFallback,
  });
  const readableHtml = decode(blockedMutant.html);

  assert.ok(
    readableHtml.includes(describeJournalPersistence(SNAPSHOTS.blocked).title) &&
      labelledValue(blockedMutant.html, "Win Rate") === null,
    "a fallback keyed on the wrong status must hide the metrics it should keep",
  );

  const unguarded = await buildBundle(MUTATIONS.unguardedTrades);

  await assert.rejects(
    async () => {
      await renderStatistics("StatisticsOverview", SNAPSHOTS.ready, {
        trades: "not an array",
        modules: unguarded,
      });
    },
    TypeError,
    "weakening the array guard must make the render throw",
  );

  const unfiltered = await buildBundle(MUTATIONS.unfilteredPlan);
  const unfilteredHtml = (await renderStatistics("StatisticsOverview", SNAPSHOTS.ready, {
    modules: unfiltered,
  })).html;

  assert.equal(
    labelledValue(unfilteredHtml, "Total Trades"),
    "4",
    "a component that ignores the plan must count every row",
  );
  assert.notEqual(
    labelledValue(
      (await renderStatistics("StatisticsOverview", SNAPSHOTS.ready)).html,
      "Total Trades",
    ),
    "4",
    "and the real component must not",
  );

  const offByOne = await buildBundle(MUTATIONS.nextOffByOne);
  const lastRow = await renderTradeAt(SNAPSHOTS.ready, 4, { modules: offByOne });

  assert.ok(
    lastRow.html.includes("|next=undefined"),
    "an off-by-one bound leaks a missing row onto the last trade, which the real page does not do",
  );
  assert.ok(
    (await renderTradeAt(SNAPSHOTS.ready, 4)).html.includes("|next=null"),
    "and the real page reports no next row for the last trade",
  );
});

test("harness runs no effect, timer, handler or state update", async () => {
  const timers = { setTimeout: globalThis.setTimeout, clearInterval: globalThis.clearInterval };
  let timerCalls = 0;

  globalThis.setTimeout = (...args) => {
    timerCalls += 1;
    return timers.setTimeout(...args);
  };

  try {
    await renderLayout(SNAPSHOTS.blocked);
    await renderTradeAt(SNAPSHOTS.healthy, 2);
    await renderStatistics("StatisticsOverview", SNAPSHOTS.writeFailed);
  } finally {
    globalThis.setTimeout = timers.setTimeout;
    globalThis.clearInterval = timers.clearInterval;
  }

  // TradeJournal hides its acknowledgement with a 4 s timer behind an effect,
  // and effects do not run in a static render. That is the point: nothing in
  // this file can observe the toast appearing, changing or disappearing.
  assert.equal(timerCalls, 0);
  assert.equal(harness.setTradesCalls, 0);
});

// ============================================================
// 2. THE BANNER, AS RENDERED
// ============================================================

test("banner: healthy, ready, first-run and unknown render nothing above the page", async () => {
  for (const name of HIDDEN) {
    const { html } = await renderLayout(SNAPSHOTS[name]);

    assert.equal(
      html.includes('role="status"'),
      false,
      `${name}: a hidden state must leave the page untouched`,
    );
    assert.equal(
      html.includes(OUTLET_MARKER),
      true,
      `${name}: the routed page must still render`,
    );

    const view = describeJournalPersistence(SNAPSHOTS[name]);

    assert.equal(view.showBanner, false, `${name}: the tested verdict must agree`);
  }
});

test("banner: unreadable and blocked and write states render the tested wording", async () => {
  for (const [name, status] of VISIBLE) {
    const snapshotValue = SNAPSHOTS[name];
    const view = describeJournalPersistence(snapshotValue);
    const { html } = await renderLayout(snapshotValue);
    const text = decode(html);

    assert.equal(view.status, status, `${name}: snapshot must reach the intended status`);

    assert.ok(
      html.includes('role="status"'),
      `${name}: the message must be a status region`,
    );
    assert.ok(
      html.includes('aria-live="polite"'),
      `${name}: the message must be announced politely`,
    );
    assert.ok(
      text.includes(view.title),
      `${name}: the tested title must be the rendered title`,
    );
    assert.ok(
      text.includes(view.detail),
      `${name}: the tested detail must be the rendered detail`,
    );

    // Only the technical detail may carry the storage message, and only when
    // the snapshot supplied one.
    if (snapshotValue.message === null) {
      assert.equal(
        text.includes(SNAPSHOTS.unreadableJson.message),
        false,
        `${name}: a snapshot with no message must not borrow another one's`,
      );
    } else {
      assert.ok(
        text.includes(snapshotValue.message),
        `${name}: the supplied technical detail must reach the reader`,
      );
    }
  }
});

test("banner: sits above the routed page and never replaces it", async () => {
  for (const [name] of VISIBLE) {
    const { html } = await renderLayout(SNAPSHOTS[name]);
    const banner = html.indexOf('role="status"');
    const outlet = html.indexOf(OUTLET_MARKER);

    assert.ok(banner !== -1, `${name}: a visible state must render a banner`);
    assert.ok(outlet !== -1, `${name}: the routed page must still render`);
    assert.ok(
      banner < outlet,
      `${name}: the banner must precede the routed page in the rendered output`,
    );
    assert.ok(
      banner > html.indexOf("SIDEBAR_MARKER"),
      `${name}: the banner belongs to the content area, not the navigation`,
    );
  }
});

test("banner: a failed save is louder than a warning, in the rendered classes", async () => {
  const failed = await renderLayout(SNAPSHOTS.writeFailed);
  const unreadable = await renderLayout(SNAPSHOTS.unreadableNotArray);
  const blocked = await renderLayout(SNAPSHOTS.blocked);
  const unverified = await renderLayout(SNAPSHOTS.writeUnverifiedStatus);

  assert.ok(
    failed.html.includes("bg-red-50"),
    "an error severity must render the error tone",
  );

  for (const { html } of [unreadable, blocked, unverified]) {
    assert.ok(
      html.includes("bg-amber-50"),
      "a warning severity must render the warning tone",
    );
  }

  assert.equal(failed.html.includes("bg-amber-50"), false);
});

test("banner: the three unreadable reads are distinguishable and the message is carried", async () => {
  const withMessage = await renderLayout(SNAPSHOTS.unreadableJson);
  const withoutMessage = await renderLayout(SNAPSHOTS.unreadableReadError);

  assert.ok(decode(withMessage.html).includes(SNAPSHOTS.unreadableJson.message));
  assert.equal(
    decode(withoutMessage.html).includes(SNAPSHOTS.unreadableJson.message),
    false,
    "a snapshot with no message must not borrow another one's",
  );

  for (const [name] of VISIBLE) {
    const { html } = await renderLayout(SNAPSHOTS[name]);
    const titles = VISIBLE.map(
      ([other]) => describeJournalPersistence(SNAPSHOTS[other]).title,
    );
    const own = describeJournalPersistence(SNAPSHOTS[name]).title;

    for (const other of titles.filter((title) => title !== own)) {
      assert.equal(
        decode(html).includes(other),
        false,
        `${name}: must not display another condition's title`,
      );
    }
  }
});

test("banner: the dismiss control is rendered but inert here, and a fresh render forgets it", async () => {
  const first = await renderLayout(SNAPSHOTS.blocked);

  assert.ok(first.html.includes(">Dismiss<"), "the control must be offered");

  // Static markup carries no listeners: the string cannot show that clicking
  // hides anything, and a second mount has no memory of a first one.
  assert.equal(
    /onclick/i.test(first.html),
    false,
    "renderToStaticMarkup must not emit handler attributes",
  );

  const second = await renderLayout(SNAPSHOTS.blocked);

  assert.ok(
    second.html.includes(describeJournalPersistence(SNAPSHOTS.blocked).title),
    "a re-render shows the same message again, because dismissal state is not testable here",
  );
});

// ============================================================
// 3. STATISTICS, AS RENDERED
// ============================================================

test("statistics fallback: an unreadable journal is explained instead of counted", async () => {
  for (const component of ["StatisticsOverview", "PerformanceTable"]) {
    const snapshotValue = SNAPSHOTS.unreadableNotArray;
    const view = describeJournalPersistence(snapshotValue);
    const { html } = await renderStatistics(component, snapshotValue);
    const text = decode(html);

    assert.ok(text.includes(view.title), `${component}: must state the problem`);
    assert.ok(text.includes(view.detail), `${component}: must explain it`);

    // The rows are unknown, so no number may be presented as if it were a
    // measurement of them.
    for (const label of [
      "Win Rate",
      "Total Trades",
      "Net P&L",
      "Winning Trades",
      "Losing Trades",
      "Break Even",
      "Net Profit",
      "Gross Profit",
      "Profit Factor",
      "Expectancy",
      "Max Drawdown",
    ]) {
      assert.equal(
        text.includes(label),
        false,
        `${component}: must not render the "${label}" metric for an unreadable journal`,
      );
    }

    assert.equal(
      labelledValue(html, "Win Rate"),
      null,
      `${component}: no metric value may survive the fallback`,
    );
  }

  const overview = await renderStatistics("StatisticsOverview", SNAPSHOTS.unreadableJson);

  assert.ok(
    overview.html.includes('role="status"'),
    "StatisticsOverview announces its fallback as a status region",
  );
});

test("statistics: a blocked session still reports the journal it read", async () => {
  for (const component of ["StatisticsOverview", "PerformanceTable"]) {
    const { html } = await renderStatistics(component, SNAPSHOTS.blocked);
    const text = decode(html);
    const view = describeJournalPersistence(SNAPSHOTS.blocked);

    assert.equal(
      text.includes(view.title),
      false,
      `${component}: a readable journal must not be hidden behind the persistence notice`,
    );
    assert.ok(
      text.includes("Win Rate") || text.includes("Net Profit"),
      `${component}: metrics must still render`,
    );
  }

  const overview = await renderStatistics("StatisticsOverview", SNAPSHOTS.blocked);

  assert.equal(labelledValue(overview.html, "Win Rate"), "33%");
  assert.equal(labelledValue(overview.html, "Total Trades"), "3");
  assert.equal(labelledValue(overview.html, "Net P&L"), "$59.75");
});

test("statistics: the numbers describe the selected plan only", async () => {
  const overview = await renderStatistics("StatisticsOverview", SNAPSHOTS.ready);

  assert.equal(labelledValue(overview.html, "Winning Trades"), "1");
  assert.equal(labelledValue(overview.html, "Losing Trades"), "1");
  assert.equal(labelledValue(overview.html, "Break Even"), "1");

  const table = await renderStatistics("PerformanceTable", SNAPSHOTS.ready);

  assert.equal(labelledValue(table.html, "Net Profit"), "$59.75");
  assert.equal(labelledValue(table.html, "Gross Loss"), "$40.25");
  assert.equal(labelledValue(table.html, "Profit Factor"), "2.48");
  assert.equal(labelledValue(table.html, "Win Rate"), "33.3%");
});

test("statistics: a malformed journal renders metrics instead of throwing", async () => {
  // Storage could hand the provider anything; whatever reaches these two
  // components as `trades` must not make .filter() throw during a render.
  for (const malformed of [null, undefined, "not an array", {}, 42]) {
    for (const component of ["StatisticsOverview", "PerformanceTable"]) {
      const { html } = await renderStatistics(component, SNAPSHOTS.ready, {
        trades: malformed,
      });

      assert.ok(
        html.length > 0,
        `${component} must render for ${String(malformed)}`,
      );
    }
  }

  const overview = await renderStatistics("StatisticsOverview", SNAPSHOTS.ready, {
    trades: "not an array",
  });

  assert.equal(labelledValue(overview.html, "Total Trades"), "0");
  assert.equal(labelledValue(overview.html, "Win Rate"), "0%");

  // Zeros here describe an unusable list, so the persistence notice must stay
  // out of the way and the metrics must stay readable.
  assert.equal(
    overview.html.includes('grid grid-cols-3'),
    true,
    "the card layout must survive a malformed journal",
  );
});

test("statistics: only the unreadable condition triggers the fallback", async () => {
  for (const name of ["writeFailed", "writeUnverified", "unknown", "providerInitial"]) {
    for (const component of ["StatisticsOverview", "PerformanceTable"]) {
      const { html } = await renderStatistics(component, SNAPSHOTS[name]);
      const view = describeJournalPersistence(SNAPSHOTS[name]);

      assert.equal(
        view.status === JOURNAL_PERSISTENCE_STATUS.UNREADABLE,
        false,
        `${name} must not be unreadable`,
      );
      assert.equal(
        decode(html).includes(view.title),
        false,
        `${component}: must keep counting for ${name} (${view.status})`,
      );
    }
  }
});

// ============================================================
// 4. THE TRADE PAGE, AS RENDERED
// ============================================================

test("trade page: resolves the route param through the real router and finds the row", async () => {
  // prev/next follow the stored array order, which is what the page did before
  // this work - including across plans, since the row list is not filtered here.
  for (const [id, expected] of [
    [1, { trade: "1", prev: "null", next: "2" }],
    [2, { trade: "2", prev: "1", next: "3" }],
    [3, { trade: "3", prev: "2", next: "4" }],
    [4, { trade: "4", prev: "3", next: "null" }],
  ]) {
    const { html, captured } = await renderTradeAt(SNAPSHOTS.ready, id);

    assert.deepEqual(captured, [String(id)], "the page must see the routed id");

    const header = html.match(new RegExp(`${HEADER_MARKER}[^<]*`));

    assert.ok(header, `id ${id}: the header must render`);
    assert.ok(
      header[0].includes(`|trade=${expected.trade}`),
      `id ${id}: expected ${expected.trade}, got ${header[0]}`,
    );
    assert.ok(
      header[0].includes(`|prev=${expected.prev}`),
      `id ${id}: expected previous ${expected.prev}, got ${header[0]}`,
    );
    assert.ok(
      header[0].includes(`|next=${expected.next}`),
      `id ${id}: expected next ${expected.next}, got ${header[0]}`,
    );
    assert.ok(header[0].includes("|onSave=function"));

    // Editing stays wired the way it was before this work: the sections get the
    // row and a callback, and nothing here invokes it.
    assert.ok(html.includes(`${DETAILS_MARKER}|trade=${expected.trade}|setTrade=function`));
    assert.equal(html.includes(">Dismiss<"), false);
  }
});

test("trade page: an unknown id falls back to the loading state", async () => {
  const { html } = await renderTradeAt(SNAPSHOTS.ready, 999);

  assert.ok(
    html.includes("Loading Trade..."),
    "an id with no row must render the loading state rather than a half-filled form",
  );
  assert.equal(html.includes(HEADER_MARKER), false);
  assert.equal(html.includes(DETAILS_MARKER), false);
});

test("trade page: nothing is claimed about a save until one is acknowledged", async () => {
  for (const name of ["healthy", "ready", "blocked", "writeFailed"]) {
    const { html } = await renderTradeAt(SNAPSHOTS[name], 1);
    const text = decode(html);

    // The acknowledgement only ever appears behind handleSave, which a static
    // render cannot press. So the honest outcome here is that no wording at
    // all - confirmed or not - is proof of the toast.
    assert.equal(
      text.includes("Changes are not confirmed as saved"),
      false,
      `${name}: an unrequested save must not be described`,
    );
    assert.equal(
      text.includes(describeJournalPersistence(SNAPSHOTS.healthy).title),
      false,
      `${name}: no state may announce a save that did not happen`,
    );
    assert.equal(text.includes("Trade Saved"), false);
    assert.equal(text.includes("Journal saved successfully"), false);
    assert.equal(
      html.includes('aria-live="polite"'),
      false,
      `${name}: the toast region must be absent without an acknowledgement`,
    );
  }
});

test("trade page: the honest fallback wording exists but is unreachable without an interaction", async () => {
  const { html } = await renderTradeAt(SNAPSHOTS.blocked, 1);

  // Recorded so that the gap is measured rather than assumed: the amber
  // wording is authored in the page (see journalUiContracts.test.js) and this
  // render proves it stays hidden until handleSave runs - which no static
  // render, and no test in this repository today, can do.
  assert.equal(html.includes("Changes are not confirmed as saved"), false);
});

// ============================================================
// 5. WHAT THIS FILE DELIBERATELY DOES NOT PROVE
// ============================================================

test("the static renderer is not evidence for clicks, effects, timers or real storage", async () => {
  const banner = await renderLayout(SNAPSHOTS.writeFailed, { trades: TRADES });
  const page = await renderTradeAt(SNAPSHOTS.writeFailed, 2);

  assert.ok(banner.html.includes(">Dismiss<"));

  // One mount, one string: static markup emits no handler attributes, so the
  // rendered Dismiss control proves the affordance exists and nothing about
  // what pressing it does.
  for (const { html } of [banner, page]) {
    assert.equal(
      /on(?:click|change|input|submit|focus)=/i.test(html),
      false,
      "static markup must not carry an event handler",
    );
  }

  // What stays unverified until a browser, or an installed DOM test
  // environment, runs it: clicking Dismiss hides the banner for the session; a
  // dismissed condition reappears when storage reports a different failure;
  // pressing Save shows the acknowledgement and re-words it when the published
  // status changes; that acknowledgement disappears after its 4 s timer; a
  // journal round-trips through real browser storage; another tab's storage
  // event reloads the journal here.
  assert.equal(harness.setTradesCalls, 0);
  assert.equal(
    (await renderLayout(SNAPSHOTS.writeFailed)).html.includes(">Dismiss<"),
    true,
    "a second mount cannot inherit a first mount's dismissal",
  );
});
