// ============================================================
// CTRADER CONNECTION WIZARD - COMPONENTS
// ============================================================
//
// WHAT IS REAL HERE
//
// The wizard components are bundled with esbuild and mounted with the installed
// React 19 runtime in a jsdom document, the same way
// src/lib/brokerIntegrationComponents.runtime.test.js mounts the Phase 3
// components. Sessions handed to the wizard come out of the real
// validateCtraderSession(), account choices out of the real accountChoices(),
// and the step maths out of the real currentStep(), so a component cannot pass
// by agreeing with a fixture this file invented.
//
// WHAT IS SUBSTITUTED, AND WHY
//
// Only lucide-react, and only so the bundle does not pull an icon package into a
// Node process. No page, context, service or transport is mounted: the wizard is
// presentational and receives the page's existing handlers as props, so the
// bundle graph below is the structural proof of that.
//
// ISOLATION, STATED EXACTLY
//
//   - No runScripts and no resources:"usable" on the JSDOM instance.
//   - fetch, XMLHttpRequest, WebSocket, EventSource and setInterval on both
//     globalThis and the jsdom window are tripwires, as are localStorage,
//     sessionStorage and indexedDB. The runner asserts none of them was reached
//     after every scenario, so "the wizard persists nothing itself" is evidence.
//   - A fresh bundle is built per scenario and every descriptor is restored in
//     reverse order in finally, including after a failure.
//   - Mutation probes are applied to the text esbuild reads, never to a
//     repository file.
//
// WHAT THIS CANNOT PROVE
//
// This is jsdom, not a browser. It proves the wizard renders the copy, the
// branches and the disabled states its props ask for. It proves nothing about
// real CSS layout or breakpoints, and nothing about a live cTrader session -
// which this task is explicitly not permitted to reach.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

import {
  STEPS,
  VERIFICATION,
  accountChoices,
  advanceBlock,
  brokerSuggestions,
  canMarkConnected,
  createInitialState,
  currentStep,
  reduce,
  searchSavedAccounts,
  verificationState,
} from "./brokerWizardModel.js";

import { validateCtraderSession } from "./brokerIntegrationModel.js";

const nodeRequire = createRequire(import.meta.url);

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

// ============================================================
// THE CONTRACT UNDER TEST
// ============================================================

const WIZARD_FILES = Object.freeze({
  BrokerWizardOverlay:
    "src/components/settings/broker-wizard/BrokerWizardOverlay.jsx",
  WizardStepper: "src/components/settings/broker-wizard/WizardStepper.jsx",
  SearchBrokerStep:
    "src/components/settings/broker-wizard/steps/SearchBrokerStep.jsx",
  ChooseMethodStep:
    "src/components/settings/broker-wizard/steps/ChooseMethodStep.jsx",
  AuthorizationIntroStep:
    "src/components/settings/broker-wizard/steps/AuthorizationIntroStep.jsx",
  AuthorizationPendingStep:
    "src/components/settings/broker-wizard/steps/AuthorizationPendingStep.jsx",
  AccountSelectModal:
    "src/components/settings/broker-wizard/steps/AccountSelectModal.jsx",
  VerificationStep:
    "src/components/settings/broker-wizard/steps/VerificationStep.jsx",
});

const SECRET = "FAKE_SECRET_TOKEN";

const CT_ACCOUNT_ID = "5784123";
const OTHER_CT_ACCOUNT_ID = "5784131";
const CT_TRADER_LOGIN = "556677";

// ============================================================
// BACKEND-SHAPED FIXTURES
// ============================================================

function ctraderBlock({
  connected = true,
  authenticated = true,
  ready = true,
  accountSource = "live",
} = {}) {
  const live = connected && authenticated && ready;
  const authenticatedAccountId = live ? CT_ACCOUNT_ID : null;
  const state = live ? "connected" : connected ? "authenticating" : "disconnected";

  const items =
    accountSource === "none"
      ? []
      : accountSource === "live"
        ? [
            {
              accountId: CT_ACCOUNT_ID,
              traderLogin: CT_TRADER_LOGIN,
              isLive: true,
              name: "Demo 5784123",
              nameSource: "local_cache",
              accessToken: SECRET,
            },
            {
              accountId: OTHER_CT_ACCOUNT_ID,
              traderLogin: "556678",
              isLive: true,
              name: "Demo 5784131",
              nameSource: "local_cache",
              accessToken: SECRET,
            },
          ]
        : [
            {
              accountId: CT_ACCOUNT_ID,
              name: "Main demo",
              traderLogin: null,
              isLive: null,
              accessToken: SECRET,
            },
          ];

  return {
    id: "ctrader",
    displayName: "cTrader",
    connection: {
      state,
      connected: state === "connected",
      serviceReachable: true,
      observedAt: "2026-11-05T10:00:00.000Z",
      reason: null,
    },
    authorization: {
      connected: true,
      hasAccessToken: true,
      accessToken: SECRET,
      refreshToken: SECRET,
    },
    session: {
      scope: "process_singleton_socket",
      accountScoped: true,
      identity: { accountId: authenticatedAccountId },
      limitations: [],
    },
    identity: {
      broker: "ctrader",
      externalId: authenticatedAccountId,
      server: null,
      accessToken: SECRET,
    },
    accounts: {
      broker: "ctrader",
      activeAccountId: authenticatedAccountId,
      mismatch: false,
      enumerable: accountSource !== "none",
      source: accountSource,
      isLive: accountSource === "live",
      items,
      activeAccount: items.length
        ? { ...items[0], activeAccountSource: accountSource }
        : null,
    },
    capabilities: { orderListing: false, pendingOrderSubmission: false },
  };
}

function statusOf(block) {
  return { brokers: { ctrader: block } };
}

function storedCtraderAccount() {
  return {
    id: `ctrader-${CT_ACCOUNT_ID}`,
    accountName: "Spotware demo",
    broker: "cTrader",
    brokerAccountId: CT_ACCOUNT_ID,
    accessToken: SECRET,
  };
}

// A session the real validator accepted, and one it refused.
function validSession() {
  return validateCtraderSession({
    accounts: [storedCtraderAccount()],
    selectedAccountId: `ctrader-${CT_ACCOUNT_ID}`,
    aggregate: statusOf(ctraderBlock()),
    serviceResponse: {
      service: {
        tradingAccountId: CT_ACCOUNT_ID,
        balance: 5000,
        currency: "USD",
        openPositions: [],
      },
    },
    synchronizedAt: "2026-11-05T10:00:05.000Z",
  });
}

function rejectedSessionResult() {
  return validateCtraderSession({
    accounts: [storedCtraderAccount()],
    selectedAccountId: `ctrader-${CT_ACCOUNT_ID}`,
    aggregate: statusOf(ctraderBlock({ authenticated: false })),
    serviceResponse: null,
    synchronizedAt: "2026-11-05T10:00:05.000Z",
  });
}

// ============================================================
// STUBS, MUTANTS, BUNDLE
// ============================================================

const LUCIDE_NAMES = [
  "ArrowLeft",
  "ArrowRight",
  "Check",
  "Link2",
  "Loader2",
  "Search",
  "ShieldCheck",
  "TriangleAlert",
  "X",
];

const STUBS = Object.freeze({
  lucide: LUCIDE_NAMES.map((name) => `export const ${name} = () => null;`).join("\n"),
});

const SUBSTITUTIONS = Object.freeze([[/^lucide-react$/, "lucide"]]);

function stubPlugin(substitutions) {
  return {
    name: "edgeflo-wizard-stubs",
    setup(build) {
      for (const [filter, key] of substitutions) {
        build.onResolve({ filter }, () => ({
          path: key,
          namespace: "edgeflo-wizard-stub",
        }));
      }

      build.onLoad(
        { filter: /.*/, namespace: "edgeflo-wizard-stub" },
        (args) => ({
          contents: STUBS[args.path],
          loader: "js",
          resolveDir: `${repoRoot}/src`,
        }),
      );
    },
  };
}

// Each mutant is a plausible wrong wizard, applied only to the text esbuild
// reads. mutationPlugin asserts the anchor matched exactly once, so a stale
// anchor fails loudly instead of reporting a phantom detection.
const MUTATIONS = Object.freeze({
  // The final confirmation renders on the screen alone, not on the validation.
  connectedIgnoresVerification: {
    file: "src/components/settings/broker-wizard/BrokerWizardOverlay.jsx",
    from: 'screen === "accounts" && verification === VERIFICATION.connected',
    to: 'screen === "accounts"',
  },
  // A blocked step advances anyway.
  continueIgnoresGuard: {
    file: "src/components/settings/broker-wizard/BrokerWizardOverlay.jsx",
    from: "canAdvance === false",
    to: "false",
  },
  // A cached account collection is presented as a live one.
  cacheShownAsLive: {
    file: "src/components/settings/broker-wizard/steps/AccountSelectModal.jsx",
    from: 'accountSource === "live"',
    to: "true",
  },
  // The MetaTrader option the brief forbids is added back.
  methodAddsMetaTrader: {
    file: "src/components/settings/broker-wizard/steps/ChooseMethodStep.jsx",
    from: "const METHODS = [",
    to: [
      "const METHODS = [",
      '  { id: "mt5", title: "MetaTrader 5", note: "Desktop terminal bridge", recommended: false },',
    ].join("\n"),
  },
});

function mutationPlugin(mutation) {
  return {
    name: "edgeflo-wizard-mutation",
    setup(build) {
      if (!mutation) {
        return;
      }

      build.onLoad({ filter: /\.(jsx|js)$/ }, (args) => {
        const relative = args.path.replace(/\\/g, "/");

        if (!relative.endsWith(mutation.file)) {
          return null;
        }

        const before = readFileSync(args.path, "utf8");

        const matches = before.split(mutation.from).length - 1;

        assert.equal(
          matches,
          1,
          `${mutation.from} must match ${mutation.file} exactly once, got ${matches}`,
        );

        const after = before.replace(mutation.from, mutation.to);

        assert.notEqual(after, before, `${mutation.from} must change ${mutation.file}`);

        return {
          contents: after,
          loader: /\.jsx$/.test(relative) ? "jsx" : "js",
        };
      });
    },
  };
}

const ENTRY = [
  'export { default as BrokerWizardOverlay } from "./components/settings/broker-wizard/BrokerWizardOverlay.jsx";',
  'export { default as WizardStepper } from "./components/settings/broker-wizard/WizardStepper.jsx";',
  'export { default as SearchBrokerStep } from "./components/settings/broker-wizard/steps/SearchBrokerStep.jsx";',
  'export { default as ChooseMethodStep } from "./components/settings/broker-wizard/steps/ChooseMethodStep.jsx";',
  'export { default as AuthorizationIntroStep } from "./components/settings/broker-wizard/steps/AuthorizationIntroStep.jsx";',
  'export { default as AuthorizationPendingStep } from "./components/settings/broker-wizard/steps/AuthorizationPendingStep.jsx";',
  'export { default as AccountSelectModal } from "./components/settings/broker-wizard/steps/AccountSelectModal.jsx";',
  'export { default as VerificationStep } from "./components/settings/broker-wizard/steps/VerificationStep.jsx";',
].join("\n");

async function buildRuntimeBundle(mutation) {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "brokerWizardRuntimeEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    define: {
      "import.meta.env": JSON.stringify({ VITE_API_URL: "http://127.0.0.1:4000" }),
    },
    plugins: [mutationPlugin(mutation), stubPlugin(SUBSTITUTIONS)],
    external: ["react", "react/jsx-runtime", "react-dom/client"],
  });

  assert.equal(result.outputFiles.length, 1, "the harness must stay in memory");

  return {
    code: result.outputFiles[0].text,
    inputs: Object.keys(result.metafile.inputs).sort(),
  };
}

let sharedPromise = null;

function loadSharedModules() {
  if (sharedPromise === null) {
    sharedPromise = Promise.resolve().then(() => ({
      react: nodeRequire("react"),
      "react/jsx-runtime": nodeRequire("react/jsx-runtime"),
      "react-dom/client": nodeRequire("react-dom/client"),
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
      `a presentational bundle may only require shared React modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(guardedRequire, loaded, loaded.exports);

  return loaded.exports;
}

// ============================================================
// SCENARIO RUNNER
// ============================================================

const TRANSPORT_GLOBALS = Object.freeze([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "setInterval",
]);

const STORAGE_GLOBALS = Object.freeze(["localStorage", "sessionStorage", "indexedDB"]);

const DOM_GLOBAL_CANDIDATES = Object.freeze([
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "Event",
  "KeyboardEvent",
  "FocusEvent",
]);

const EXPORTED_NAMES = Object.freeze([
  "AccountSelectModal",
  "AuthorizationIntroStep",
  "AuthorizationPendingStep",
  "BrokerWizardOverlay",
  "ChooseMethodStep",
  "SearchBrokerStep",
  "VerificationStep",
  "WizardStepper",
]);

function assertWizardFilesExist() {
  const missing = Object.values(WIZARD_FILES).filter(
    (relative) => !existsSync(join(repoRoot, relative)),
  );

  assert.deepEqual(missing, [], `wizard files must exist, missing ${missing.join(", ")}`);
}

async function withWizard(options, scenario) {
  const { tree = () => null, mutation = null } = options ?? {};

  // The gate runs before anything is bundled, so a missing module is an
  // assertion rather than a build crash. A mutant is built from the same disk
  // source, so the gate applies to mutated runs too.
  assertWizardFilesExist();

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const win = dom.window;

  const touched = [];
  const restoreSteps = [];
  const logged = { error: [] };

  let root = null;
  let scenarioFailure = null;
  let unmountFailure = null;

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

  function tripwire(target, label, names) {
    for (const name of names) {
      define(target, name, {
        configurable: true,
        enumerable: true,
        get() {
          touched.push(`${label}.${name}`);

          throw new Error(`a presentational wizard component reached ${label}.${name}`);
        },
      });
    }
  }

  const ctx = {
    React: null,
    modules: null,
    inputs: null,
    container: null,
    window: win,
    touched,
    text() {
      return ctx.container.textContent;
    },
    find(selector) {
      return ctx.container.querySelector(selector);
    },
    findAll(selector) {
      return [...ctx.container.querySelectorAll(selector)];
    },
    byAttr(name, value) {
      return ctx.findAll(`[${name}${value === undefined ? "" : `="${value}"]`}`);
    },
    control(selector) {
      const node = ctx.find(selector);

      assert.ok(node, `a control matching ${selector} must be rendered`);

      return node;
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    async click(node) {
      await ctx.act(() => {
        node.click();
      });
    },
    async dispatch(node, name) {
      await ctx.act(() => {
        node.dispatchEvent(new win.Event(name, { bubbles: true }));
      });
    },
    async type(input, value) {
      const setter = Object.getOwnPropertyDescriptor(
        win.HTMLInputElement.prototype,
        "value",
      ).set;

      await ctx.act(() => {
        setter.call(input, value);

        input.dispatchEvent(new win.Event("input", { bubbles: true }));
      });
    },
    async press(key) {
      await ctx.act(() => {
        win.document.dispatchEvent(
          new win.KeyboardEvent("keydown", { key, bubbles: true }),
        );
      });
    },
  };

  try {
    tripwire(globalThis, "globalThis", TRANSPORT_GLOBALS);
    tripwire(globalThis, "globalThis", STORAGE_GLOBALS);
    tripwire(win, "window", TRANSPORT_GLOBALS);
    tripwire(win, "window", STORAGE_GLOBALS);

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

    define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });

    const shared = await loadSharedModules();

    ctx.React = shared.react;

    assert.equal(typeof shared.react.act, "function", "React 19 must expose act");
    assert.equal(
      typeof shared["react-dom/client"].createRoot,
      "function",
      "react-dom/client must expose createRoot",
    );

    const natives = { error: console.error };

    console.error = (...args) => logged.error.push(args.map(String).join(" "));

    restoreSteps.push(() => {
      console.error = natives.error;
    });

    const built = await buildRuntimeBundle(mutation);

    ctx.inputs = built.inputs;
    ctx.modules = evaluateBundle(built.code, shared);

    assert.deepEqual(Object.keys(ctx.modules).sort(), [...EXPORTED_NAMES]);

    const container = win.document.createElement("div");

    win.document.body.appendChild(container);

    ctx.container = container;
    root = shared["react-dom/client"].createRoot(container);

    await ctx.act(() => {
      root.render(tree(ctx.modules, ctx.React));
    });

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

  assert.deepEqual(touched, [], "the wizard may reach no transport or storage itself");

  // React logs a key/type problem as an error; a silent suite must stay silent.
  assert.deepEqual(logged.error, [], "rendering must not log a React error");
}

// A failed assertion must not print a live DOM node: Node's inspect walks the
// React fibre back-references hanging off an element and exhausts the heap, so
// an absence check compares a count instead of a node.
function assertAbsent(ctx, selector, message) {
  assert.equal(ctx.findAll(selector).length, 0, message);
}

// Components are mounted, not called. Calling a component function directly
// returns its element tree without ever entering React's render phase, so the
// dispatcher is null and a hook is a crash rather than a feature - and the
// wizard's escape handling is a hook. Same React instance the bundle receives.
function mount(component, props) {
  return nodeRequire("react").createElement(component, props);
}

// ============================================================
// PROPS BUILT BY THE REAL MODEL
// ============================================================

// The overlay's props are what the page would derive from the model, so the
// components are tested against the same values rather than hand-written ones.
// A scenario that wants evidence of a callback passes its own array in, so the
// array asserted is the one wired into the rendered props.
function overlayProps({
  screen = "search",
  brokerName = "Spotware",
  query = "",
  accounts = [],
  choices = [],
  accountSource = "none",
  accountId = null,
  verification = VERIFICATION.verifying,
  session = null,
  busy = false,
  error = null,
  statusError = null,
  actionError = null,
  calls = null,
} = {}) {
  const state = { ...createInitialState(), screen, brokerName, query, accountId };

  const events = calls ?? [];

  function record(entry) {
    events.push(entry);
  }

  const props = {
    screen,
    brokerName,
    query,
    stepIndex: currentStep({ screen, verification }),
    matches: searchSavedAccounts({ accounts, query }),
    suggestions: brokerSuggestions({ query }),
    choices,
    accountSource,
    accountId,
    verification,
    session,
    busy,
    error: error ?? statusError ?? actionError ?? null,
    canAdvance: advanceBlock(state) === null,
    blockReason: advanceBlock(state),
    onQuery: (value) => record(["query", value]),
    onPickSaved: (match) => record(["pick", match]),
    onContinue: () => record(["continue"]),
    onBack: () => record(["back"]),
    onClose: () => record(["close"]),
    onAuthorize: () => record(["authorize"]),
    onSelectAccount: (value) => record(["select", value]),
    onConnectAccount: (value) => record(["connect", value]),
    onRetry: () => record(["retry"]),
  };

  return { props, calls: events, state };
}

function liveChoices() {
  return accountChoices({ snapshot: statusOf(ctraderBlock()) });
}

function cachedChoices() {
  return accountChoices({ snapshot: statusOf(ctraderBlock({ accountSource: "cache" })) });
}

// ============================================================
// THE SHELL
// ============================================================

test("the wizard mounts no page, context or service module", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps().props }) },
    async (ctx) => {
      // Only the wizard's own files plus the pure model modules it reads.
      const source = ctx.inputs.filter((path) => path.startsWith("src/"));

      for (const path of source) {
        assert.ok(
          !path.includes("services/") &&
            !path.includes("context/") &&
            !path.includes("BrokerIntegrationPage"),
          `the wizard bundle must stay presentational, saw ${path}`,
        );
      }

      assert.ok(
        source.some((path) => path.endsWith("brokerWizardModel.js")),
        "the wizard is expected to read its own pure model",
      );
    },
  ));

test("the shell is a modal dialog with an accessible name", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps().props }) },
    async (ctx) => {
      const dialog = ctx.find('[role="dialog"]');

      assert.ok(dialog, "the wizard must be a dialog");
      assert.equal(dialog.getAttribute("aria-modal"), "true");
      assert.ok(
        dialog.getAttribute("aria-label").includes("cTrader"),
        "the dialog must name itself as the cTrader connection",
      );
    },
  ));

test("the stepper shows four labelled steps and marks only the current one", () =>
  withWizard(
    {
      tree: (m) => mount(m.WizardStepper, { steps: [...STEPS], currentIndex: 2 }),
    },
    async (ctx) => {
      assert.equal(ctx.findAll("[data-stepper-item]").length, 4);
      assert.equal(ctx.findAll('[aria-current="step"]').length, 1);
      assert.ok(
        ctx.find('[aria-current="step"]').textContent.includes("Choose Method"),
        "the current step must be the second label",
      );
    },
  ));

test("a completed step is marked as completed rather than current", () =>
  withWizard(
    {
      tree: (m) => mount(m.WizardStepper, { steps: [...STEPS], currentIndex: 3 }),
    },
    async (ctx) => {
      const items = ctx.byAttr("data-stepper-item");

      assert.equal(items[0].getAttribute("data-stepper-state"), "completed");
      assert.equal(items[1].getAttribute("data-stepper-state"), "completed");
      assert.equal(items[0].getAttribute("aria-current"), null);
    },
  ));

test("a step the wizard has not reached is marked upcoming, not completed", () =>
  withWizard(
    {
      tree: (m) => mount(m.WizardStepper, { steps: [...STEPS], currentIndex: 1 }),
    },
    async (ctx) => {
      const items = ctx.byAttr("data-stepper-item");

      assert.equal(items[0].getAttribute("data-stepper-state"), "current");
      assert.equal(items[3].getAttribute("data-stepper-state"), "upcoming");
    },
  ));

test("the stepper names the step it describes for a screen reader", () =>
  withWizard(
    {
      tree: (m) => mount(m.WizardStepper, { steps: [...STEPS], currentIndex: 1 }),
    },
    async (ctx) => {
      assert.equal(
        ctx.find('[data-stepper-state="current"]').getAttribute("aria-current"),
        "step",
      );
    },
  ));

test("the wizard has no MetaTrader option anywhere in its shell", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "method" }).props }) },
    async (ctx) => {
      assert.ok(!/MetaTrader|MT5/i.test(ctx.text()), "the wizard must not name MT5");
      assert.equal(
        ctx.byAttr("data-method-card").length,
        1,
        "the method step must offer exactly one connection method",
      );
    },
  ));

// ============================================================
// STEP 1 - SEARCH
// ============================================================

test("an empty query lists no brokers instead of inventing a directory", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ query: "" }).props }) },
    async (ctx) => {
      assertAbsent(ctx, "[data-saved-match]", "no match may be listed for an empty query");
      assertAbsent(
        ctx,
        "[data-broker-suggestion]",
        "an empty query may not open a suggested name list either",
      );
    },
  ));

test("a suggested cTrader name is selectable once the query points at it", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ query: "ic" }).props }) },
    async (ctx) => {
      const suggestions = ctx.byAttr("data-broker-suggestion");

      assert.equal(suggestions.length, 1, "one suggested name must be offered");
      assert.equal(
        suggestions[0].getAttribute("data-broker-suggestion"),
        "IC Markets",
        "the option must be named for the broker it offers",
      );
      assert.ok(
        suggestions[0].textContent.includes("IC Markets"),
        "and show that name rather than only marking it",
      );
      assert.match(
        ctx.text(),
        /suggest/i,
        "and the group must say what it is, rather than read as a record",
      );
    },
  ));

test("choosing the suggested name reports it upward as the typed query", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls, query: "ic" }).props }) },
    async (ctx) => {
      await ctx.click(ctx.control("[data-broker-suggestion]"));

      assert.deepEqual(
        calls,
        [["query", "IC Markets"]],
        "picking a suggestion must be the same report as typing the name",
      );
    },
  );
});

test("a suggested name is not presented as a saved account or a connection", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ query: "ic" }).props }) },
    async (ctx) => {
      assertAbsent(
        ctx,
        "[data-saved-match]",
        "a suggestion carries no account, so nothing may be listed as one",
      );
      assertAbsent(
        ctx,
        "[data-connect-account]",
        "a suggested name is not a session and must not offer to connect",
      );

      const read = ctx.text().replace(/\s+/g, " ");

      assert.equal(
        /connected|successfully/i.test(read),
        false,
        `the step may not claim an outcome it has no evidence for: ${read}`,
      );
    },
  ));

test("typing into the search field reports the value upward", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls, query: "" }).props }) },
    async (ctx) => {
      await ctx.type(ctx.control("[data-wizard-query]"), "spot");

      assert.deepEqual(
        calls,
        [["query", "spot"]],
        "the search field must report the typed value to the page",
      );
    },
  );
});

test("a saved cTrader account matching the query is offered", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ query: "spot", accounts: [storedCtraderAccount()] }).props,
        }),
    },
    async (ctx) => {
      const matches = ctx.byAttr("data-saved-match");

      assert.equal(matches.length, 1, "one stored account must be offered");
      assert.ok(ctx.text().includes("Spotware demo"));
      assert.ok(!ctx.text().includes(SECRET), "a stored credential must not be rendered");
    },
  ));

test("choosing a saved account reports that match upward", async () => {
  const calls = [];
  const match = searchSavedAccounts({ accounts: [storedCtraderAccount()], query: "spot" })[0];

  await withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ calls, query: "spot", accounts: [storedCtraderAccount()] }).props,
        }),
    },
    async (ctx) => {
      await ctx.click(ctx.control("[data-saved-match]"));

      assert.deepEqual(
        calls,
        [["pick", match]],
        "the picked match must be handed to the page unchanged",
      );
    },
  );
});

test("a query with no saved match explains itself rather than showing nothing", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ query: "pepperstone", accounts: [storedCtraderAccount()] }).props,
        }),
    },
    async (ctx) => {
      assertAbsent(ctx, "[data-saved-match]", "nothing may match an unknown broker");
      assert.match(
        ctx.text(),
        /continue with/i,
        "the no-match state must name the next valid action",
      );
    },
  ));

test("continue from search is disabled while the name is blank", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ brokerName: null, screen: "search" }).props,
        }),
    },
    async (ctx) => {
      assert.equal(
        ctx.control("[data-wizard-continue]").disabled,
        true,
        "a blocked step must not offer an active Continue",
      );
      assert.ok(ctx.text().includes("broker name"));
    },
  ));

test("a blocked step states its reason instead of only going quiet", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ brokerName: null, screen: "search" }).props,
        }),
    },
    async (ctx) => {
      assert.match(
        ctx.text(),
        /Enter the broker name you want to connect\./,
        "the model's block reason must reach the user",
      );
    },
  ));

test("a chosen broker name is summarised on the next step", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "method", brokerName: "Spotware" }).props,
        }),
    },
    async (ctx) => {
      assert.ok(ctx.text().includes("Spotware"), "the chosen name must be shown back");
      assert.match(ctx.text(), /Connection method for/);
    },
  ));

// ============================================================
// STEP 2 - METHOD
// ============================================================

test("the cTrader card is the selected method and explains why", () =>
  withWizard(
    {
      tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "method" }).props }),
    },
    async (ctx) => {
      const card = ctx.control('[data-method-card="ctrader"]');

      assert.equal(card.getAttribute("data-method-selected"), "true");
      assert.match(ctx.text(), /Recommended/);
    },
  ));

test("search again walks back to the first step", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls, screen: "method" }).props }) },
    async (ctx) => {
      await ctx.click(ctx.control("[data-search-again]"));

      assert.deepEqual(calls, [["back"]], "search again must use the same walk as Back");
    },
  );
});

test("back from the method step is offered and reported", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls, screen: "method" }).props }) },
    async (ctx) => {
      await ctx.click(ctx.control("[data-wizard-back]"));

      assert.deepEqual(calls, [["back"]]);
    },
  );
});

test("the first step has no way back", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "search" }).props }) },
    async (ctx) => {
      assertAbsent(ctx, "[data-wizard-back]", "search is the first step");
    },
  ));

// ============================================================
// STEP 3 - INTRODUCTION AND PENDING
// ============================================================

test("the introduction says the user leaves for cTrader and what that means", () =>
  withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "intro" }).props }) },
    async (ctx) => {
      assert.match(ctx.text(), /cTrader/);
      assert.match(ctx.text(), /authorization/i);
      assert.equal(
        ctx.control("[data-wizard-continue]").disabled,
        false,
        "the introduction is never blocked by a missing field",
      );
    },
  ));

test("continue on the introduction hands control to the page", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls, screen: "intro" }).props }) },
    async (ctx) => {
      await ctx.click(ctx.control("[data-wizard-continue]"));

      assert.deepEqual(
        calls,
        [["authorize"]],
        "the introduction must ask the page to start the round trip, not advance itself",
      );
    },
  );
});

test("the pending screen describes a return, never a connection", () =>
  withWizard(
    {
      tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "pending" }).props }),
    },
    async (ctx) => {
      assert.match(
        ctx.text(),
        /not.*connect/i,
        "the pending screen must say a return is not a connection",
      );
      assert.ok(
        !/is connected|now connected/i.test(ctx.text()),
        "the pending screen must not claim a connection",
      );
    },
  ));

test("the pending screen still offers a way forward", () =>
  withWizard(
    {
      tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "pending" }).props }),
    },
    async (ctx) => {
      assert.equal(
        ctx.control("[data-wizard-continue]").disabled,
        false,
        "a returned user must be able to go on",
      );
    },
  ));

// ============================================================
// STEP 3 - ACCOUNT CHOICE
// ============================================================

test("live accounts are listed with their ids", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "accounts", accountSource: source, choices }).props,
        });
      },
    },
    async (ctx) => {
      const rows = ctx.byAttr("data-account-choice");

      assert.equal(rows.length, 2, "both live accounts must be listed");
      assert.ok(ctx.text().includes(CT_ACCOUNT_ID));
      assert.ok(ctx.text().includes(CT_TRADER_LOGIN));
      assert.ok(!ctx.text().includes(SECRET), "no credential may reach the account list");
    },
  ));

test("the live collection is labelled as the live account list", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "accounts", accountSource: source, choices }).props,
        });
      },
    },
    async (ctx) => {
      assert.match(ctx.text(), /live account list/i);
    },
  ));

test("a cached collection is labelled cached, not live", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = cachedChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "accounts", accountSource: source, choices }).props,
        });
      },
    },
    async (ctx) => {
      assert.match(ctx.text(), /cache/i, "a cached collection must say cached");
      assert.ok(
        !/live account list/i.test(ctx.text()),
        "a cached collection may not be labelled a live account list",
      );
    },
  ));

test("an empty account collection explains the next valid action", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "accounts", accountSource: "none", choices: [] }).props,
        }),
    },
    async (ctx) => {
      assertAbsent(ctx, "[data-account-choice]", "no account may be listed");
      assert.match(ctx.text(), /no cTrader account/i);
    },
  ));

test("choosing an account reports its id upward", async () => {
  const calls = [];

  await withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({ calls, screen: "accounts", accountSource: source, choices }).props,
        });
      },
    },
    async (ctx) => {
      await ctx.click(ctx.control("[data-account-choice]"));

      assert.deepEqual(
        calls,
        [["select", CT_ACCOUNT_ID]],
        "the first listed account must be reported by its own id",
      );
    },
  );
});

test("connect stays disabled until an account is chosen", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            accountSource: source,
            choices,
            accountId: null,
          }).props,
        });
      },
    },
    async (ctx) => {
      assert.equal(
        ctx.control("[data-connect-account]").disabled,
        true,
        "no account may be connected before one is chosen",
      );
    },
  ));

test("choosing an account enables connect", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            accountSource: source,
            choices,
            accountId: CT_ACCOUNT_ID,
          }).props,
        });
      },
    },
    async (ctx) => {
      assert.equal(
        ctx.control("[data-connect-account]").disabled,
        false,
        "a chosen account must enable the connect action",
      );
    },
  ));

test("connect is blocked while another workflow is in flight", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            accountSource: source,
            choices,
            accountId: CT_ACCOUNT_ID,
            busy: true,
          }).props,
        });
      },
    },
    async (ctx) => {
      assert.equal(
        ctx.control("[data-connect-account]").disabled,
        true,
        "a running workflow must not be double-triggered",
      );
    },
  ));

test("connect hands the chosen id to the page", async () => {
  const calls = [];

  await withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            calls,
            screen: "accounts",
            accountSource: source,
            choices,
            accountId: CT_ACCOUNT_ID,
          }).props,
        });
      },
    },
    async (ctx) => {
      await ctx.click(ctx.control("[data-connect-account]"));

      assert.deepEqual(calls, [["connect", CT_ACCOUNT_ID]]);
    },
  );
});

test("the account modal keeps the note that connecting takes a moment", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "accounts", accountSource: source, choices }).props,
        });
      },
    },
    async (ctx) => {
      assert.match(ctx.text(), /few moments/i);
    },
  ));

test("the account list never shows a balance", () =>
  withWizard(
    {
      tree: (m) => {
        const { source, choices } = liveChoices();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            accountSource: source,
            choices,
            session: validSession(),
          }).props,
        });
      },
    },
    async (ctx) => {
      assert.ok(
        !/\b5,?000\b/.test(ctx.text()),
        "a list of accounts may not present one account's balance",
      );
    },
  ));

// ============================================================
// STEP 4 - VERIFICATION, DERIVED ONLY
// ============================================================

test("a validated session is the only thing that reaches the final step", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            verification: verificationState({ session: validSession(), loading: false }),
            session: validSession(),
            accountId: CT_ACCOUNT_ID,
          }).props,
        }),
    },
    async (ctx) => {
      assert.equal(canMarkConnected(validSession()), true);
      assert.ok(ctx.find("[data-wizard-connected]"), "the confirmation must be rendered");
      assert.equal(ctx.findAll("[data-account-choice]").length, 0, "the list must be replaced");
    },
  ));

test("a rejected session cannot reach the final step", () =>
  withWizard(
    {
      tree: (m) => {
        const rejected = rejectedSessionResult();

        return mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            verification: verificationState({ session: rejected, loading: false }),
            session: rejected,
            accountId: CT_ACCOUNT_ID,
          }).props,
        });
      },
    },
    async (ctx) => {
      assert.equal(ctx.findAll("[data-wizard-connected]").length, 0);
      assert.match(
        ctx.text(),
        /Unavailable|not connected|could not/i,
        "a rejected session must say so",
      );
    },
  ));

test("verification while a read is in flight is presented as working, not failed", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ screen: "accounts", verification: VERIFICATION.verifying }).props,
        }),
    },
    async (ctx) => {
      assert.equal(ctx.findAll("[data-wizard-connected]").length, 0);
      assert.ok(!/Unavailable/i.test(ctx.text()), "an in-flight read is not a failure");
    },
  ));

test("an action failure is reported as an error with a retry", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            verification: VERIFICATION.error,
            actionError: "The cTrader service refused to start.",
          }).props,
        }),
    },
    async (ctx) => {
      assert.match(ctx.text(), /refused to start/, "the message must be the page's own");
      assert.ok(ctx.find("[data-wizard-retry]"));
    },
  ));

test("retry hands control back to the page", async () => {
  const calls = [];

  await withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            calls,
            screen: "accounts",
            verification: VERIFICATION.error,
            actionError: "The cTrader service refused to start.",
          }).props,
        }),
    },
    async (ctx) => {
      await ctx.click(ctx.control("[data-wizard-retry]"));

      assert.deepEqual(calls, [["retry"]]);
    },
  );
});

test("the final confirmation names the account but invents no numbers", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            verification: VERIFICATION.connected,
            session: validSession(),
            accountId: CT_ACCOUNT_ID,
            brokerName: "Spotware",
          }).props,
        }),
    },
    async (ctx) => {
      assert.ok(ctx.text().includes(CT_ACCOUNT_ID), "the confirmation must name the account");
      assert.ok(!/\b5,?000\b/.test(ctx.text()), "no balance may be claimed on this screen");
      assert.equal(ctx.findAll("[data-wizard-connected]").length, 1);
    },
  ));

test("the confirmation records the validated sync stamp, not a clock", () =>
  withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({
            screen: "accounts",
            verification: VERIFICATION.connected,
            session: validSession(),
            accountId: CT_ACCOUNT_ID,
          }).props,
        }),
    },
    async (ctx) => {
      assert.ok(
        ctx.text().includes("2026-11-05T10:00:05.000Z"),
        "the stamp must be the one the validator recorded",
      );
    },
  ));

test("the accounts screen is step three until a session is validated", () =>
  withWizard(
    {
      tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "accounts" }).props }),
    },
    async (ctx) => {
      assert.equal(currentStep({ screen: "accounts", verification: VERIFICATION.verifying }), 3);
      assert.equal(ctx.findAll('[data-stepper-state="current"]').length, 1);
      assert.ok(
        ctx.find('[data-stepper-state="current"]').textContent.includes("Connect Account"),
        "the accounts screen is still step three",
      );
    },
  ));

// ============================================================
// NAVIGATION WIRING
// ============================================================

test("the search to method walk is the real reducer, not a screen name in a button", () => {
  const state = { ...createInitialState(), screen: "search", brokerName: "Spotware" };
  const next = reduce(state, { type: "CONTINUE" });

  assert.equal(next.screen, "method");
  assert.equal(advanceBlock(next), null);
});

test("a blocked continue reports no navigation even when clicked", async () => {
  const calls = [];

  await withWizard(
    {
      tree: (m) =>
        mount(m.BrokerWizardOverlay, {
          ...overlayProps({ calls, brokerName: null, query: "", screen: "search" }).props,
        }),
    },
    async (ctx) => {
      // Dispatched rather than .click(): a disabled button must also be inert to
      // a synthetic click, so the guard has to live in the handler.
      await ctx.dispatch(ctx.control("[data-wizard-continue]"), "click");

      assert.deepEqual(calls, [], "a blocked step must report no navigation");
    },
  );
});

test("escape asks the page to close the wizard", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls }).props }) },
    async (ctx) => {
      await ctx.press("Escape");

      assert.deepEqual(calls, [["close"]], "escape must be the page's close handler");
    },
  );
});

test("close is offered as a control, not only as a key", async () => {
  const calls = [];

  await withWizard(
    { tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ calls }).props }) },
    async (ctx) => {
      await ctx.click(ctx.control("[data-wizard-close]"));

      assert.deepEqual(calls, [["close"]]);
    },
  );
});

// ============================================================
// MUTATION PROBES
// ============================================================

const PROBES = Object.freeze([
  [
    "connectedIgnoresVerification",
    "verification is not a confirmation",
    /only a validated session may be called connected/,
  ],
  [
    "continueIgnoresGuard",
    "a blocked step has no active continue",
    /a blocked step must not offer an active Continue/,
  ],
  [
    "cacheShownAsLive",
    "a cached collection stays cached",
    /may not be labelled a live account list/,
  ],
  [
    "methodAddsMetaTrader",
    "the method step offers cTrader only",
    /the wizard must not name MT5/,
  ],
]);

const PROBE_SCENARIOS = Object.freeze({
  "verification is not a confirmation": (mutation) =>
    withWizard(
      {
        mutation,
        tree: (m) =>
          mount(m.BrokerWizardOverlay, {
            ...overlayProps({
              screen: "accounts",
              verification: VERIFICATION.verifying,
              session: null,
            }).props,
          }),
      },
      async (ctx) => {
        assert.equal(
          ctx.findAll("[data-wizard-connected]").length,
          0,
          "only a validated session may be called connected",
        );
      },
    ),
  "a blocked step has no active continue": (mutation) =>
    withWizard(
      {
        mutation,
        tree: (m) =>
          mount(m.BrokerWizardOverlay, {
            ...overlayProps({ brokerName: null, screen: "search" }).props,
          }),
      },
      async (ctx) => {
        assert.equal(
          ctx.control("[data-wizard-continue]").disabled,
          true,
          "a blocked step must not offer an active Continue",
        );
      },
    ),
  "a cached collection stays cached": (mutation) => {
    const { source, choices } = cachedChoices();

    return withWizard(
      {
        mutation,
        tree: (m) =>
          mount(m.BrokerWizardOverlay, {
            ...overlayProps({ screen: "accounts", accountSource: source, choices }).props,
          }),
      },
      async (ctx) => {
        assert.ok(
          !/live account list/i.test(ctx.text()),
          "a cached collection may not be labelled a live account list",
        );
      },
    );
  },
  "the method step offers cTrader only": (mutation) =>
    withWizard(
      {
        mutation,
        tree: (m) => mount(m.BrokerWizardOverlay, { ...overlayProps({ screen: "method" }).props }),
      },
      async (ctx) => {
        assert.ok(!/MetaTrader|MT5/i.test(ctx.text()), "the wizard must not name MT5");
      },
    ),
});

for (const [name, scenarioName, expects] of PROBES) {
  test(`mutation probe: ${name} is rejected by the wizard assertions`, async () => {
    // Control: the same scenario against the untouched disk source must pass.
    // If it does not, a rejection below only proves the scenario is broken, so
    // this run is deliberately left uncaught.
    await PROBE_SCENARIOS[scenarioName](null);

    let failure = null;

    try {
      await PROBE_SCENARIOS[scenarioName](MUTATIONS[name]);
    } catch (error) {
      failure = error;
    }

    assert.ok(failure, `${name} must make ${scenarioName} fail, and it stayed green`);

    const code = failure.code ?? failure.cause?.code;

    assert.equal(
      code,
      "ERR_ASSERTION",
      `${scenarioName} must reject ${name} with an assertion, got ${String(failure)}`,
    );

    const assertionError = failure.code === "ERR_ASSERTION" ? failure : failure.cause;

    assert.match(
      String(assertionError.message),
      expects,
      `${name} must be rejected by the ${scenarioName} assertion named for it`,
    );
  });
}

test("every probe row names a mutant, a scenario and the assertion that rejects it", () => {
  const problems = [];

  for (const [name, scenarioName, expects] of PROBES) {
    if (!MUTATIONS[name]) {
      problems.push(`${name} maps no mutant`);
    }

    if (typeof scenarioName !== "string" || !PROBE_SCENARIOS[scenarioName]) {
      problems.push(`${name} maps no scenario`);
      continue;
    }

    if (!(expects instanceof RegExp)) {
      problems.push(`${name} has no expected assertion`);
    }
  }

  for (const name of Object.keys(MUTATIONS)) {
    if (!PROBES.some((row) => row[0] === name)) {
      problems.push(`${name} has no probe`);
    }
  }

  assert.deepEqual(problems, [], "each mutant must have one scenario and one expected assertion");
});
