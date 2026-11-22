// ============================================================
// SETTINGS TAB ON A BROKER RETURN (Phase 3, Task 9)
// ============================================================
//
// Both broker workflows leave the app and come back in a new document: the
// cTrader OAuth round trip and the MT5 terminal login both land on
// /settings?<something>, and the user has to find the broker tab again. That
// routing rule lives in src/pages/Settings.jsx, and this suite mounts the real
// component to test it.
//
// WHAT IS REAL HERE
//
//   - src/pages/Settings.jsx is bundled from disk.
//   - react-router-dom is real: each scenario mounts the page inside a
//     MemoryRouter whose initial entry is the URL the broker redirected to, so
//     useLocation() sees a genuine query string.
//   - src/components/settings/SettingsTabs.jsx is real, so the tab click below
//     goes through the same buttons a user sees.
//
// WHAT IS SUBSTITUTED, AND WHY
//
//   - The nine settings pages and PageHeader. Their own behaviour belongs to
//     their own suites; here the only question is which one Settings renders, so
//     each stub is a marker node that names itself. A real BrokerIntegrationPage
//     would start reading storage and making requests, which would test Task 8
//     and Task 9 again instead of this routing rule.
//   - localStorage: an in-memory fake that records writes, because the legacy
//     ctrader_code path is part of the contract and must be readable without a
//     real browser.
//
// WHAT THIS CANNOT PROVE
//
// Nothing about a real redirect. The URL shapes come from the server routes that
// produce them (server/routes/ctrader.js:666 and 680, server/routes/mt5.js:27
// and 38), but a browser still has to follow one for the round trip to be real.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

const nodeRequire = createRequire(import.meta.url);

const NATIVE_SET_TIMEOUT = globalThis.setTimeout;

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

const SETTINGS_FILE = "src/pages/Settings.jsx";

const SECRET = "FAKE_SECRET_TOKEN";

// The tab every broker return must land on, spelled exactly as Settings.jsx
// spells it in the setActiveTab call and in SettingsTabs.jsx.
const BROKER_TAB = "Broker Integration";

const STUB_PAGES = [
  "AccountPage",
  "TradingAccountsPage",
  "TradingPreferencesPage",
  "BrokerIntegrationPage",
  "LanguageRegionPage",
  "NotificationsPage",
  "AppearancePage",
  "SecurityPage",
  "AboutPage",
];

const STUB_NAMESPACE = "edgeflo-settings-stub";
const ENTRY_FILE = "settingsBrokerReturnRuntimeEntry.js";

// ============================================================
// GATE
// ============================================================
//
// The pattern this suite exists to pin: a return parameter is a reason to open
// the broker tab, and the legacy status parameter keeps working. Checking the
// source first means a RED run says which parameter is ignored instead of only
// reporting that some stub was rendered.

function readSettings() {
  assert.equal(
    existsSync(`${repoRoot}/${SETTINGS_FILE}`),
    true,
    `the settings page must exist on disk at ${SETTINGS_FILE}`,
  );

  return readFileSync(`${repoRoot}/${SETTINGS_FILE}`, "utf8");
}

test("the settings page reads every broker return parameter", () => {
  const source = readSettings();

  for (const key of ["status", "ctrader", "mt5"]) {
    assert.match(
      source,
      new RegExp(`["']${key}["']`),
      `Settings must recognise the ?${key}= return parameter`,
    );
  }

  assert.match(
    source,
    /ctrader_code/,
    "and the legacy ctrader_code hand-off",
  );

  assert.match(
    source,
    /setActiveTab\(\s*"Broker Integration"\s*\)/,
    "and it must open the broker tab, not any other",
  );
});

// ============================================================
// STUBS
// ============================================================

const REACT_IMPORT = 'import { createElement } from "react";\n';

const HEADER_STUB = `${REACT_IMPORT}
export default function PageHeader({ title }) {
  return createElement("h1", { "data-page-header": "" }, title);
}`;

// A stub per settings page, each naming itself, so "which tab is open" is read
// straight off the DOM instead of inferred from a side effect.
function settingsStubPlugin() {
  return {
    name: "edgeflo-settings-stubs",
    setup(build) {
      for (const name of STUB_PAGES) {
        build.onResolve({ filter: new RegExp(`components/settings/${name}$`) }, () => ({
          path: name,
          namespace: STUB_NAMESPACE,
        }));
      }

      build.onResolve({ filter: /components\/common\/PageHeader$/ }, () => ({
        path: "PageHeader",
        namespace: STUB_NAMESPACE,
      }));

      build.onLoad({ filter: /.*/, namespace: STUB_NAMESPACE }, (args) => {
        if (args.path === "PageHeader") {
          return { contents: HEADER_STUB, loader: "js" };
        }

        return {
          contents: `${REACT_IMPORT}
export default function ${args.path}() {
  return createElement("div", { "data-stub-page": "${args.path}" });
}`,
          loader: "js",
        };
      });
    },
  };
}

// ============================================================
// BUNDLE
// ============================================================

const ENTRY = `
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import Settings from "./pages/Settings.jsx";

export function SettingsAt({ url }) {
  return createElement(
    MemoryRouter,
    { initialEntries: [url] },
    createElement(Settings),
  );
}
`;

async function buildSettingsBundle() {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "jsx",
      sourcefile: ENTRY_FILE,
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
    plugins: [settingsStubPlugin()],
    external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
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
      "react-dom": nodeRequire("react-dom"),
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
      `a settings bundle may only require shared React modules, got ${specifier}`,
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(guardedRequire, loaded, loaded.exports);

  return loaded.exports;
}

// ============================================================
// FAKE STORAGE AND TRANSPORT TRIPWIRES
// ============================================================

function createFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];

  return {
    writes,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      writes.push({ type: "set", key, value: String(value) });

      data.set(key, String(value));
    },
    removeItem(key) {
      writes.push({ type: "remove", key });

      data.delete(key);
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    clear() {
      throw new Error("the settings page must not clear storage");
    },
    get length() {
      return data.size;
    },
  };
}

const TRANSPORT_GLOBALS = Object.freeze([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "setInterval",
]);

const DOM_GLOBAL_CANDIDATES = Object.freeze([
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "Event",
  "CustomEvent",
  "MouseEvent",
]);

// ============================================================
// SCENARIO RUNNER
// ============================================================

async function withSettings({ url = "/settings", storage = {}, expectTripwire = null }, scenario) {
  const fakeStorage = createFakeStorage(storage);

  const touched = [];
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/settings",
  });
  const win = dom.window;

  const restoreSteps = [];
  const logged = { error: [] };

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

  for (const name of TRANSPORT_GLOBALS) {
    const tripwire = (label) => ({
      configurable: true,
      enumerable: true,
      get() {
        touched.push(`${label}.${name}`);

        throw new Error(`the settings page reached ${label}.${name}`);
      },
    });

    define(globalThis, name, tripwire("globalThis"));
    define(win, name, tripwire("window"));
  }

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

  for (const name of ["localStorage", "sessionStorage"]) {
    define(globalThis, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fakeStorage,
    });

    define(win, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fakeStorage,
    });
  }

  define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: true,
  });

  const ctx = {
    container: null,
    window: win,
    storageWrites: fakeStorage.writes,
    text() {
      return ctx.container.textContent;
    },
    html() {
      return ctx.container.innerHTML;
    },
    find(selector) {
      return ctx.container.querySelector(selector);
    },
    findAll(selector) {
      return [...ctx.container.querySelectorAll(selector)];
    },
    // The one rendered settings page is the answer to "which tab is open".
    activePage() {
      const node = ctx.find("[data-stub-page]");

      assert.ok(node, "the settings page must render exactly one tab body");

      return node.getAttribute("data-stub-page");
    },
    drain() {
      return new Promise((resolve) => {
        NATIVE_SET_TIMEOUT(resolve, 0);
      });
    },
    async act(fn) {
      return React.act(fn);
    },
    async clickTab(label) {
      const button = ctx
        .findAll("button")
        .find((node) => node.textContent.trim() === label);

      assert.ok(button, `a ${label} tab button must render`);

      await ctx.act(async () => {
        button.click();

        await ctx.drain();
      });
    },
  };

  let React = null;
  let root = null;
  let scenarioFailure = null;
  let teardownFailure = null;

  try {
    const shared = await loadSharedModules();

    React = shared.react;
    ctx.React = React;

    assert.equal(typeof React.act, "function", "React 19 must expose act");

    const natives = { error: console.error };

    console.error = (...args) => logged.error.push(args.map(String).join(" "));

    restoreSteps.push(() => {
      console.error = natives.error;
    });

    const built = await buildSettingsBundle();

    ctx.inputs = built.inputs;

    const { SettingsAt } = evaluateBundle(built.code, shared);

    const container = win.document.createElement("div");

    win.document.body.appendChild(container);

    ctx.container = container;
    root = shared["react-dom/client"].createRoot(container);

    await ctx.act(async () => {
      root.render(React.createElement(SettingsAt, { url }));

      await ctx.drain();
    });

    await scenario(ctx);

    assert.equal(
      ctx.html().includes(SECRET),
      false,
      "no query parameter value may be rendered",
    );
  } catch (error) {
    scenarioFailure = error;
  } finally {
    if (root !== null) {
      try {
        await React.act(async () => {
          root.unmount();
        });
      } catch (error) {
        teardownFailure = error;
      }
    }

    try {
      win.close();
    } catch (error) {
      teardownFailure = teardownFailure ?? error;
    }

    for (let index = restoreSteps.length - 1; index >= 0; index -= 1) {
      restoreSteps[index]();
    }
  }

  if (scenarioFailure) {
    throw scenarioFailure;
  }

  if (teardownFailure) {
    throw teardownFailure;
  }

  assert.deepEqual(
    touched,
    expectTripwire ?? [],
    "the settings page may not reach the network to decide which tab to open",
  );

  assert.deepEqual(logged.error, [], "rendering must not log a React error");
}

// ============================================================
// SCENARIOS
// ============================================================

test("a settings visit with no parameters opens the Account tab", async () => {
  await withSettings({ url: "/settings" }, (ctx) => {
    assert.equal(ctx.activePage(), "AccountPage", "the default tab is unchanged");
  });
});

test("?status=connected still opens the broker tab", async () => {
  await withSettings({ url: "/settings?status=connected" }, (ctx) => {
    assert.equal(
      ctx.activePage(),
      "BrokerIntegrationPage",
      "the status parameter is the older broker hand-off and must keep working",
    );
  });
});

test("?ctrader=connected opens the broker tab", async () => {
  await withSettings({ url: "/settings?ctrader=connected" }, (ctx) => {
    assert.equal(
      ctx.activePage(),
      "BrokerIntegrationPage",
      `a cTrader authorization that came back must land on ${BROKER_TAB}`,
    );
  });
});

test("?ctrader=error opens the broker tab without rendering the message", async () => {
  await withSettings(
    { url: `/settings?ctrader=error&message=${SECRET}` },
    (ctx) => {
      assert.equal(
        ctx.activePage(),
        "BrokerIntegrationPage",
        "a failed authorization is still the user's reason to visit this tab",
      );

      assert.equal(
        ctx.text().includes(SECRET),
        false,
        "the upstream message never reaches the screen",
      );
    },
  );
});

test("?ctrader=error=0 still counts as a return", async () => {
  await withSettings({ url: "/settings?ctrader" }, (ctx) => {
    assert.equal(
      ctx.activePage(),
      "BrokerIntegrationPage",
      "the parameter's presence is what matters, not its value",
    );
  });
});

test("?mt5=connected opens the broker tab", async () => {
  await withSettings({ url: "/settings?mt5=connected" }, (ctx) => {
    assert.equal(
      ctx.activePage(),
      "BrokerIntegrationPage",
      "an MT5 terminal login must land on the broker tab too",
    );
  });
});

test("?mt5=error opens the broker tab", async () => {
  await withSettings({ url: "/settings?mt5=error" }, (ctx) => {
    assert.equal(
      ctx.activePage(),
      "BrokerIntegrationPage",
      "and so must a failed one, because the fix lives here",
    );
  });
});

test("the legacy ctrader_code hand-off still opens the broker tab", async () => {
  await withSettings(
    { url: "/settings", storage: { ctrader_code: "FAKE_CODE" } },
    (ctx) => {
      assert.equal(
        ctx.activePage(),
        "BrokerIntegrationPage",
        "a code parked in storage by an older redirect still routes here",
      );
    },
  );
});

test("a broker return does not trap the user on the broker tab", async () => {
  await withSettings({ url: "/settings?ctrader=connected" }, async (ctx) => {
    assert.equal(ctx.activePage(), "BrokerIntegrationPage", "it starts on the broker tab");

    await ctx.clickTab("Account");

    assert.equal(
      ctx.activePage(),
      "AccountPage",
      "an explicit tab click must stick, even while the URL still carries the return",
    );
  });
});

test("choosing the broker tab by hand works without any parameter", async () => {
  await withSettings({ url: "/settings" }, async (ctx) => {
    await ctx.clickTab(BROKER_TAB);

    assert.equal(ctx.activePage(), "BrokerIntegrationPage", "the real tab buttons still work");
  });
});

test("the settings page stores nothing while it decides", async () => {
  await withSettings({ url: "/settings?ctrader=connected" }, (ctx) => {
    assert.deepEqual(
      ctx.storageWrites,
      [],
      "routing is not a reason to write to storage",
    );
  });
});

test("the bundle holds the real settings page and router, and no settings body", async () => {
  await withSettings({ url: "/settings?mt5=connected" }, (ctx) => {
    // The stub namespace and esbuild's own pseudo-inputs are not first-party
    // code; everything that survives the filter has to be accounted for, so a
    // real settings page cannot quietly join the bundle.
    const firstParty = ctx.inputs.filter(
      (input) =>
        !input.startsWith("node_modules/") &&
        !input.startsWith(`${STUB_NAMESPACE}:`) &&
        !input.startsWith("<"),
    );

    assert.deepEqual(
      firstParty,
      [
        "src/pages/Settings.jsx",
        "src/components/settings/SettingsTabs.jsx",
        `src/${ENTRY_FILE}`,
      ].sort(),
      "only the settings page, the real tab strip and this entry are first-party code",
    );

    const stubbed = ctx.inputs
      .filter((input) => input.startsWith(`${STUB_NAMESPACE}:`))
      .map((input) => input.slice(`${STUB_NAMESPACE}:`.length))
      .sort();

    assert.deepEqual(
      stubbed,
      [...STUB_PAGES, "PageHeader"].sort(),
      "every settings child page is replaced by its stub, so this suite proves which tab is " +
        "open without executing the page it opens",
    );
  });
});
