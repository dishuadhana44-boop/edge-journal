// ============================================================
// cTRADER POSITION EVENT SAFETY (Phase 3)
// ============================================================
//
// What this file is: the real MarketProvider, mounted in jsdom against a fake
// WebSocket, a fake fetch and faked intervals, driven message by message. It
// covers the four ways one cTrader account's pushed data can reach another
// account's exposed cache in src/context/MarketContext.jsx:
//
//   1. handleExecution upserts account B's position into account A's cache,
//      because it stamps the new account id but never hands the cache over
//      (src/context/MarketContext.jsx:885-954 and upsertPosition at :714-777).
//   2. The generic position events read no account identity at all, so any
//      pushed position joins whatever cache is already exposed
//      (src/context/MarketContext.jsx:1143-1169).
//   3. positionClosed / position_closed read no account identity either, so
//      another account's close is applied to the cached account's list
//      (src/context/MarketContext.jsx:1171-1183).
//   4. An event with no account identity must not be treated as belonging to
//      the account authenticated by the previous event
//      (positions_update at src/context/MarketContext.jsx:1124-1141).
//
// WHAT THIS CANNOT PROVE, stated up front: nothing here talks to the cTrader
// OpenAPI, the Express server, a WebSocket port or a real browser timer. The
// fake socket delivers exactly the envelope shape the broadcast producer emits,
// so it shows how the provider reacts to a message, not what a live gateway
// sends. Prices are exercised through both of the provider's producers - the
// pushed cTrader frame and the polled MT5 quote - because they write one shared
// bid/ask pair, and TradeContext's own reaction to `positions` plus
// `cTraderAccountId` is proven by tradeBrokerSafety.runtime.test.js and the
// wiring suite.

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

const nodeRequire = createRequire(import.meta.url);

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
).replace(/\\/g, "/");

const HARNESS_GLOBAL = "__EDGEFLO_MARKET_SAFETY_HARNESS__";

// A base URL only the fakes can see. Assertions check that the socket and the
// fetch both stayed inside it, so no scenario can reach a real host.
const FAKE_API_URL = "http://fake-api.invalid:4000";
const FAKE_WS_URL = "ws://fake-api.invalid:4000/ws";

const ACCOUNT_A = "acct-7001";
const ACCOUNT_B = "acct-8002";

// ============================================================
// POSITION FIXTURES
//
// Copied from what normalizePosition actually consumes: positionId via
// getPositionId (:148-159), symbol and side via getString (:283-327), volume in
// units against CTRADER_VOLUME_PER_LOT (:347-378), entryPrice (:384-392) and
// positionStatus (:532-536).
//
// `tradeData.ticketOwner` is the field that distinguishes a handover from a
// merge. mergePosition (:596-708) spreads the incoming row over the existing
// one, so every scalar a new event carries is replaced either way; but it
// rebuilds tradeData as {...existing.tradeData, ...incoming.tradeData}
// (:703-706), so a key only A reported survives a merge and cannot survive a
// replacement. Assertions on it therefore reject the wrong implementation
// instead of passing for the wrong reason.
// ============================================================

function position(overrides = {}) {
  return {
    positionId: "7001",
    symbol: "EURUSD",
    side: "buy",
    volume: 1000000,
    entryPrice: 1.1,
    positionStatus: "POSITION_STATUS_OPEN",
    ...overrides,
  };
}

const POSITION_A = position({
  positionId: "7001",
  entryPrice: 1.1,
  tradeData: { ticketOwner: "A" },
});

const POSITION_A_SECOND = position({
  positionId: "7002",
  entryPrice: 1.2,
  tradeData: { ticketOwner: "A" },
});

const POSITION_B = position({
  positionId: "8002",
  entryPrice: 1.5,
  tradeData: { ticketOwner: "B" },
});

// The same numeric position id under a different account: brokers reuse position
// ids per account, so an id collision is not an identity match. B reports no
// tradeData at all, so a merge would leave A's ticket fields behind.
const POSITION_B_CLASHING_ID = position({
  positionId: "7001",
  entryPrice: 1.5,
  volume: 2000000,
});

// ============================================================
// ENVELOPES
//
// The authenticated producer field is top-level `accountId`; an omitted account
// is the account-less case, not a fallback to the previous one.
// ============================================================

function executionMessage(accountId, rawPosition) {
  const message = {
    type: "execution",
    data: {
      executionType: "DEAL_EXECUTED",
      position: rawPosition,
    },
  };

  if (accountId !== undefined) {
    message.accountId = accountId;
  }

  return message;
}

function snapshotMessage(accountId, positions) {
  const message = { type: "positions_update", positions };

  if (accountId !== undefined) {
    message.accountId = accountId;
  }

  return message;
}

function positionEventMessage(type, accountId, rawPosition) {
  const message = { type, position: rawPosition };

  if (accountId !== undefined) {
    message.accountId = accountId;
  }

  return message;
}

function closeEventMessage(type, accountId, positionId) {
  const message = { type, positionId };

  if (accountId !== undefined) {
    message.accountId = accountId;
  }

  return message;
}

// The pushed price frame, copied from the producer's own object at
// server/services/ctraderService.js:2436-2458 (`type`, `symbol`, `bid`, `ask`,
// `timestamp`). No account identity rides on it, which is exactly why both
// producers can fight over one bid/ask pair.
function priceMessage(overrides = {}) {
  return {
    type: "price",
    symbol: "EURUSD",
    bid: 1.1,
    ask: 1.1001,
    timestamp: 1700000000000,
    ...overrides,
  };
}

// The polled MT5 quote, in the shape the provider reads at
// src/context/MarketContext.jsx:1405-1436 (`success`, `symbol`, `bid`, `ask`,
// `timestamp`) out of the body server/routes/mt5.js:255 forwards verbatim.
function mt5Quote(overrides = {}) {
  return {
    success: true,
    symbol: "EURUSD",
    bid: 1.1,
    ask: 1.1001,
    timestamp: 1700000000000,
    ...overrides,
  };
}

// ============================================================
// FAKE WEBSOCKET
//
// Construction is recorded, delivery is manual: a scenario calls fireMessage()
// with the envelope it wants the provider to react to.
// ============================================================

function createFakeWebSocket(sink) {
  const instances = [];

  class FakeWebSocket {
    constructor(url) {
      this.url = String(url);
      this.readyState = FakeWebSocket.CONNECTING;
      this.sent = [];
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;

      instances.push(this);
      sink.socketUrls.push(this.url);
    }

    send(payload) {
      this.sent.push(String(payload));
    }

    close() {
      // Deliberately does not invoke onclose: the reconnect timer is out of
      // scope here, and a scheduled retry would fire after the scenario ended.
      this.readyState = FakeWebSocket.CLOSED;
    }

    fireOpen() {
      this.readyState = FakeWebSocket.OPEN;

      if (this.onopen) {
        this.onopen({ type: "open" });
      }
    }

    fireMessage(message) {
      assert.ok(
        this.onmessage,
        "the provider must install onmessage before a scenario delivers events"
      );

      this.onmessage({ data: JSON.stringify(message) });
    }
  }

  FakeWebSocket.CONNECTING = 0;
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.CLOSING = 2;
  FakeWebSocket.CLOSED = 3;

  return {
    FakeWebSocket,
    instances,
    latest() {
      return instances[instances.length - 1] ?? null;
    },
  };
}

// ============================================================
// FAKE FETCH
//
// MarketProvider polls GET /api/mt5/price?symbol=... on mount. The default
// response says success:false so no price path mutates state behind a
// scenario's back; the calls are still recorded so their URLs can be asserted.
// A scenario that wants a live MT5 quote sets sink.mt5Price first, and the
// shape is the one the route forwards verbatim (server/routes/mt5.js:232-270,
// consumed at src/context/MarketContext.jsx:1405-1436).
// ============================================================

function createFakeFetch(sink) {
  const fetchImpl = (url) => {
    const href = String(url);

    sink.fetchCalls.push(href);

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => sink.mt5Price ?? { success: false },
    });
  };

  return { fetchImpl };
}

// ============================================================
// BUNDLE
// ============================================================

const ENTRY = [
  'export { MarketProvider, useMarket } from "./context/MarketContext.jsx";',
  'import { useMarket } from "./context/MarketContext.jsx";',
  `export function Probe() {
  const market = useMarket();

  globalThis["${HARNESS_GLOBAL}"].marketValue = market;

  globalThis["${HARNESS_GLOBAL}"].snapshots.push({
    positions: market.positions,
    cTraderAccountId: market.cTraderAccountId,
    lastExecution: market.lastExecution,
    symbol: market.symbol,
    bid: market.bid,
    ask: market.ask,
    spread: market.spread,
    priceSource: market.priceSource,
    isMarketConnected: market.isMarketConnected,
  });

  return null;
}`,
].join("\n");

async function buildRuntimeBundle() {
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY,
      resolveDir: `${repoRoot}/src`,
      loader: "js",
      sourcefile: "marketBrokerSafetyEntry.js",
    },
    bundle: true,
    write: false,
    metafile: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    // MarketContext.jsx:11-16 reads import.meta.env, which the cjs output would
    // otherwise empty and then throw on during evaluation.
    define: {
      "import.meta.env": JSON.stringify({ VITE_API_URL: FAKE_API_URL }),
    },
    external: ["react", "react/jsx-runtime", "react-dom/client"],
  });

  assert.equal(
    result.outputFiles.length,
    1,
    "the runtime harness must stay in memory"
  );

  return {
    code: result.outputFiles[0].text,
    inputs: Object.keys(result.metafile.inputs).sort(),
  };
}

function evaluateBundle(code, shared) {
  const loaded = { exports: {} };

  const guardedRequire = (specifier) => {
    const supplied = shared[specifier];

    assert.ok(
      supplied,
      `the market safety bundle may only require shared React modules, got ${specifier}`
    );

    return supplied;
  };

  new Function("require", "module", "exports", code)(
    guardedRequire,
    loaded,
    loaded.exports
  );

  return loaded.exports;
}

// ============================================================
// SCENARIO RUNNER
// ============================================================

const TRANSPORT_GLOBALS = Object.freeze([
  "XMLHttpRequest",
  "EventSource",
]);

const nativeSetTimeout = setTimeout;

// A real macrotask, captured before any timer faking: React needs to flush the
// effects that the mount itself schedules.
const realTick = () =>
  new Promise((resolve) => nativeSetTimeout(resolve, 0));

async function withMarketScenario(runScenario) {
  const sink = {
    snapshots: [],
    marketValue: null,
    socketUrls: [],
    fetchCalls: [],
    intervals: [],
    mt5Price: null,
  };

  globalThis[HARNESS_GLOBAL] = sink;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const win = dom.window;
  const restoreSteps = [];
  const touched = [];

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

          throw new Error(`the market safety harness reached ${label}.${name}`);
        },
      });
    }
  }

  const sockets = createFakeWebSocket(sink);
  const fakeFetch = createFakeFetch(sink);

  let scenarioFailure = null;
  let unmountFailure = null;
  let scenarioResult;
  let root = null;
  let shared = null;

  const ctx = {
    sink,
    win,
    modules: null,
    React: null,
    latest() {
      return sink.snapshots[sink.snapshots.length - 1];
    },
    positions() {
      return ctx.latest().positions.map((entry) => ({
        positionId: String(entry.positionId),
        entryPrice: entry.entryPrice,
        lots: entry.lots,
        ticketOwner: entry.tradeData?.ticketOwner,
      }));
    },
    positionIds() {
      return ctx.positions().map((entry) => entry.positionId);
    },
    accountId() {
      return ctx.latest().cTraderAccountId;
    },
    socket() {
      const socket = sockets.latest();

      assert.ok(
        socket,
        "the provider must construct the fake WebSocket on mount"
      );

      return socket;
    },
    async act(fn) {
      return ctx.React.act(fn);
    },
    async mount() {
      await ctx.act(() => {
        root.render(
          ctx.React.createElement(
            ctx.modules.MarketProvider,
            null,
            ctx.React.createElement(ctx.modules.Probe)
          )
        );
      });

      await ctx.act(async () => {
        await realTick();
      });
    },
    async openSocket() {
      await ctx.act(() => {
        ctx.socket().fireOpen();
      });
    },
    async send(message) {
      const socket = ctx.socket();

      await ctx.act(async () => {
        socket.fireMessage(message);
        await realTick();
      });
    },
    marketValue() {
      assert.ok(
        sink.marketValue,
        "the probe must have rendered before a scenario reads the context value"
      );

      return sink.marketValue;
    },
    bid() {
      return ctx.latest().bid;
    },
    ask() {
      return ctx.latest().ask;
    },
    priceSource() {
      return ctx.latest().priceSource;
    },
    // The only address the provider polls for a quote, counted apart from any
    // other request so a scenario cannot pass on an unrelated fetch.
    mt5PriceCalls() {
      return sink.fetchCalls.filter((href) =>
        href.includes("/api/mt5/price")
      );
    },
    livePollCount() {
      return sink.intervals.filter((entry) => !entry.cleared).length;
    },
    // The interval never fires by itself, so a scenario drives one MT5 poll and
    // waits for the fetch promise chain the handler starts.
    async pollMt5() {
      const live = sink.intervals.filter((entry) => !entry.cleared);

      assert.equal(
        live.length,
        1,
        "a scenario that polls must have exactly one live MT5 interval"
      );

      await ctx.act(async () => {
        live[0].handler();
        await realTick();
      });
    },
    setMt5Price(price) {
      sink.mt5Price = price;
    },
    // A quote request already in flight when the selection moves: the handler is
    // started, the declaration is written in the same tick before any promise
    // resolves, and only then does the response land. This is the case a
    // synchronous ref exists for, and the only scenario that reaches handlePrice
    // with the losing source - stopping the poll alone cannot prove that gate.
    async raceMt5PollAgainstDeclaration(source) {
      await ctx.act(async () => {
        const live = sink.intervals.filter((entry) => !entry.cleared);

        assert.equal(
          live.length,
          1,
          "an MT5 poll must be live to race a declaration against it"
        );

        live[0].handler();
        ctx.marketValue().setPriceSource(source);

        await realTick();
      });
    },
    // The declaration a selected account makes. Called through the context
    // value, never by poking provider internals: the provider must own it.
    async declarePriceSource(source) {
      assert.equal(
        typeof ctx.marketValue().setPriceSource,
        "function",
        "the market context must expose the price-source setter"
      );

      await ctx.act(async () => {
        ctx.marketValue().setPriceSource(source);
        await realTick();
      });
    },
  };

  try {
    tripwire(globalThis, "globalThis");
    tripwire(win, "window");

    for (const name of [
      "window",
      "self",
      "document",
      "navigator",
      "HTMLElement",
      "HTMLDivElement",
      "Element",
      "Node",
      "Text",
      "Event",
      "CustomEvent",
      "getComputedStyle",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "MessageChannel",
    ]) {
      if (name in win) {
        define(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: win[name],
        });
      }
    }

    // The socket is faked rather than tripped: delivering envelopes by hand is
    // the whole point of the harness.
    for (const target of [globalThis, win]) {
      define(target, "WebSocket", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: sockets.FakeWebSocket,
      });

      define(target, "fetch", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: fakeFetch.fetchImpl,
      });

      // Polling must not fire on its own: intervals are recorded and only run
      // when a scenario asks. The cleared flag is what lets a scenario tell a
      // live poll from the dead handler of an effect React already tore down -
      // running that dead handler would still issue a fetch, because the
      // provider checks `cancelled` only after the response resolves.
      define(target, "setInterval", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (handler, ms) => {
          sink.intervals.push({
            handler,
            ms,
            cleared: false,
            target: target === win ? "window" : "globalThis",
          });

          return sink.intervals.length;
        },
      });

      define(target, "clearInterval", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (id) => {
          const entry = sink.intervals[Number(id) - 1];

          if (entry) {
            entry.cleared = true;
          }
        },
      });
    }

    define(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });

    // The provider logs every message verbosely; scenarios assert on behaviour,
    // so the noise is silenced and restored by the same ledger.
    for (const method of ["log", "error", "warn"]) {
      define(console, method, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: () => undefined,
      });
    }

    shared = {
      react: nodeRequire("react"),
      "react/jsx-runtime": nodeRequire("react/jsx-runtime"),
      "react-dom/client": nodeRequire("react-dom/client"),
    };

    assert.equal(
      typeof shared.react.act,
      "function",
      "React 19 must expose act"
    );

    const built = await buildRuntimeBundle();

    // The bundle must really contain the provider under test and nothing else
    // of the app: MarketContext imports React and the pure price-source module,
    // which is the whole point of keeping that decision in src/lib. Widening
    // this list means the provider grew a new dependency, and a scenario that
    // only fakes transports can no longer be trusted to cover it.
    assert.ok(
      built.inputs.some((input) => input.endsWith("src/context/MarketContext.jsx")),
      "the bundle must include the real MarketContext.jsx"
    );
    assert.deepEqual(
      built.inputs.filter(
        (input) =>
          // esbuild lists its own injected define as a virtual input.
          !input.startsWith("<") &&
          !input.endsWith("src/context/MarketContext.jsx") &&
          !input.endsWith("src/lib/marketPriceSource.js") &&
          !input.endsWith("marketBrokerSafetyEntry.js")
      ),
      [],
      "the market safety bundle must pull in no project module beyond the provider and the price-source helper"
    );

    const exports = evaluateBundle(built.code, shared);

    assert.deepEqual(
      Object.keys(exports).sort(),
      ["MarketProvider", "Probe", "useMarket"],
      "the market safety entry must export the provider, the hook and the probe"
    );

    ctx.modules = exports;
    ctx.React = shared.react;

    const container = win.document.createElement("div");

    win.document.body.appendChild(container);
    root = shared["react-dom/client"].createRoot(container);

    await ctx.mount();

    assert.equal(
      sockets.instances.length,
      1,
      "mount opens exactly one fake socket"
    );
    assert.equal(
      sockets.latest().url,
      FAKE_WS_URL,
      "the socket must be built from the fake base URL"
    );

    scenarioResult = await runScenario(ctx);
  } catch (error) {
    scenarioFailure = error;
  } finally {
    if (root !== null) {
      try {
        await ctx.React.act(async () => {
          await realTick();
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

    delete globalThis[HARNESS_GLOBAL];
  }

  if (scenarioFailure) {
    throw scenarioFailure;
  }

  if (unmountFailure) {
    throw unmountFailure;
  }

  assert.deepEqual(touched, [], "no scenario may read a real transport entry point");

  return scenarioResult;
}

// ============================================================
// 1. CONTROL: one account's events behave, so the races below cannot pass
//    vacuously
// ============================================================

test("control: executions for one account accumulate in that account's cache", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.openSocket();

    assert.deepEqual(
      JSON.parse(ctx.socket().sent[0]),
      { type: "subscribe", symbol: "EURUSD" },
      "the handshake must reach the fake socket and nothing else"
    );

    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    assert.deepEqual(ctx.positionIds(), ["7001"]);
    assert.equal(ctx.accountId(), ACCOUNT_A);

    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A_SECOND));

    assert.deepEqual(
      ctx.positionIds(),
      ["7001", "7002"],
      "a second position for the same account must be kept"
    );
    assert.equal(ctx.accountId(), ACCOUNT_A);

    assert.deepEqual(
      ctx.sink.fetchCalls.filter((url) => !url.startsWith(FAKE_API_URL)),
      [],
      "every price request must stay inside the fake base URL"
    );
  });
});

// ============================================================
// 2. EXECUTION: A TO B HANDS THE CACHE OVER
// ============================================================

test("an execution for another account cannot join the cached account's positions", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A_SECOND));

    await ctx.send(executionMessage(ACCOUNT_B, POSITION_B));

    assert.deepEqual(
      ctx.positionIds(),
      ["8002"],
      "A's positions may not survive in B's cache"
    );
    assert.equal(ctx.accountId(), ACCOUNT_B);
    assert.deepEqual(
      ctx.positions().map((entry) => entry.ticketOwner),
      ["B"],
      "no ticket data owned by A may be carried into B"
    );
  });
});

test("an execution for another account cannot merge into a position that shares its id", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    await ctx.send(executionMessage(ACCOUNT_B, POSITION_B_CLASHING_ID));

    assert.deepEqual(
      ctx.positionIds(),
      ["7001"],
      "B's row must be the only holder of the id it reported"
    );

    const [row] = ctx.positions();

    assert.equal(
      row.ticketOwner,
      undefined,
      "A's ticket data must not survive under B's row: B reported none"
    );
    assert.equal(row.entryPrice, 1.5, "B's entry price must not be A's");
    assert.equal(ctx.accountId(), ACCOUNT_B);
  });
});

// ============================================================
// 3. ACCOUNT-LESS EXECUTION
// ============================================================

test("an execution with no account identity clears the exposed positions", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    await ctx.send(executionMessage(undefined, POSITION_B));

    assert.deepEqual(
      ctx.positionIds(),
      [],
      "an account-less execution may not reuse A's cache"
    );
    assert.equal(ctx.accountId(), null);
    assert.equal(
      ctx.latest().lastExecution?.accountId,
      ACCOUNT_A,
      "an execution that reported no account may not replace the last execution"
    );
  });
});

// ============================================================
// 4. SNAPSHOT
// ============================================================

test("a positions_update replaces only the account that reported it", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    await ctx.send(snapshotMessage(ACCOUNT_B, [POSITION_B]));

    assert.deepEqual(
      ctx.positionIds(),
      ["8002"],
      "B's snapshot must not be merged onto A"
    );
    assert.equal(ctx.accountId(), ACCOUNT_B);
  });
});

test("a positions_update with no account identity clears instead of reusing A", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    await ctx.send(snapshotMessage(undefined, [POSITION_B]));

    assert.deepEqual(
      ctx.positionIds(),
      [],
      "an account-less snapshot may not expose B's rows under A"
    );
    assert.equal(ctx.accountId(), null);
  });
});

// ============================================================
// 5. GENERIC POSITION EVENTS
// ============================================================

for (const type of ["position", "positionUpdate", "position_update"]) {
  test(`an account-less ${type} event cannot mutate the cached account's positions`, async () => {
    await withMarketScenario(async (ctx) => {
      await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

      await ctx.send(positionEventMessage(type, undefined, POSITION_B));

      assert.deepEqual(
        ctx.positionIds(),
        [],
        `an account-less ${type} event may not join A's cache or reuse A's identity`
      );
      assert.equal(
        ctx.accountId(),
        null,
        `an account-less ${type} event may not keep reporting A as the authenticated account`
      );
    });
  });

  test(`a ${type} event for another account cannot join the cached account's positions`, async () => {
    await withMarketScenario(async (ctx) => {
      await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

      await ctx.send(positionEventMessage(type, ACCOUNT_B, POSITION_B));

      assert.deepEqual(
        ctx.positionIds(),
        ["8002"],
        `${type} must hand the cache over to the account that reported it`
      );
      assert.equal(ctx.accountId(), ACCOUNT_B);
    });
  });
}

test("a position event sharing A's position id cannot merge A's fields into B", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    await ctx.send(positionEventMessage("position", ACCOUNT_B, POSITION_B_CLASHING_ID));

    const [row] = ctx.positions();

    assert.deepEqual(ctx.positionIds(), ["7001"]);
    assert.equal(
      row.ticketOwner,
      undefined,
      "B's row must be normalised from B alone, not merged over A's"
    );
    assert.equal(row.entryPrice, 1.5);
  });
});

test("a position event for the same account keeps that account's cache", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

    await ctx.send(
      positionEventMessage("position_update", ACCOUNT_A, POSITION_A_SECOND)
    );

    assert.deepEqual(
      ctx.positionIds(),
      ["7001", "7002"],
      "the ownership transition must not clear the account it already belongs to"
    );
    assert.equal(ctx.accountId(), ACCOUNT_A);
  });
});

// ============================================================
// 6. CLOSE EVENTS
// ============================================================

for (const type of ["positionClosed", "position_closed"]) {
  test(`an account-less ${type} event cannot leave the cached account's positions in place`, async () => {
    await withMarketScenario(async (ctx) => {
      await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

      await ctx.send(closeEventMessage(type, undefined, "8002"));

      assert.deepEqual(
        ctx.positionIds(),
        [],
        `${type} without an account may not keep A's rows and may not remove by an unowned id`
      );
      assert.equal(ctx.accountId(), null);
    });
  });

  test(`a ${type} event for another account cannot remove or keep the cached account's position`, async () => {
    await withMarketScenario(async (ctx) => {
      await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));

      await ctx.send(closeEventMessage(type, ACCOUNT_B, "7001"));

      assert.deepEqual(
        ctx.positionIds(),
        [],
        `A's position may not survive as B's cache, and B's close may not be applied to A's row`
      );
      assert.equal(ctx.accountId(), ACCOUNT_B);
    });
  });
}

test("a close event for the owning account removes only that position", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A));
    await ctx.send(executionMessage(ACCOUNT_A, POSITION_A_SECOND));

    await ctx.send(closeEventMessage("positionClosed", ACCOUNT_A, "7001"));

    assert.deepEqual(
      ctx.positionIds(),
      ["7002"],
      "the same-account case must still remove the position that closed"
    );
    assert.equal(ctx.accountId(), ACCOUNT_A);
  });
});

// ============================================================
// 7. PRICE SOURCE: TWO PRODUCERS, ONE bid/ask PAIR
//
// MarketContext has always exposed a single bid/ask with two writers: the pushed
// cTrader frame (src/context/MarketContext.jsx:1198-1206) and the polled MT5
// quote (:1374-1461). Neither knew about the other, so with an IC Markets
// account selected the MT5 demo bridge rewrote the ticket price once a second.
// The provider now holds a declared source and refuses the feed that did not
// declare it. That the declaration reaches the provider through its own contract
// is proven here; that an explicit account selection is what makes the
// declaration is proven by tradeBrokerSafety.runtime.test.js.
// ============================================================

test("declaring cTrader stops the MT5 quote poll", async () => {
  await withMarketScenario(async (ctx) => {
    assert.ok(
      ctx.mt5PriceCalls().length >= 1,
      "a provider with nothing declared must still poll MT5, as it always did"
    );

    await ctx.declarePriceSource("ctrader");

    assert.equal(ctx.priceSource(), "ctrader");
    assert.equal(
      ctx.livePollCount(),
      0,
      "declaring cTrader must tear the MT5 poll down, not merely ignore its result"
    );

    const callsAfterDeclaration = ctx.mt5PriceCalls().length;

    await ctx.send(priceMessage({ bid: 1.2, ask: 1.2001 }));

    assert.equal(ctx.bid(), 1.2);
    assert.equal(
      ctx.mt5PriceCalls().length,
      callsAfterDeclaration,
      "no MT5 quote request may be issued while cTrader owns the price"
    );
  });
});

test("an MT5 quote already in flight cannot overwrite a cTrader price", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(priceMessage({ bid: 1.3, ask: 1.3001 }));

    assert.equal(ctx.bid(), 1.3);

    ctx.setMt5Price(mt5Quote({ bid: 9.9, ask: 9.9001 }));

    await ctx.raceMt5PollAgainstDeclaration("ctrader");

    assert.equal(
      ctx.bid(),
      1.3,
      "a response that started before the selection moved may not price the selected account"
    );
    assert.equal(ctx.ask(), 1.3001);
  });
});

test("a pushed cTrader price cannot overwrite a declared MT5 source", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.declarePriceSource("mt5");
    ctx.setMt5Price(mt5Quote({ bid: 1.4, ask: 1.4001 }));

    await ctx.pollMt5();

    assert.equal(
      ctx.bid(),
      1.4,
      "an explicitly selected MT5 account keeps its quote poll"
    );

    await ctx.send(priceMessage({ bid: 2.4, ask: 2.4001 }));

    assert.equal(
      ctx.bid(),
      1.4,
      "the mirror case: cTrader may not price an MT5 selection either"
    );
    assert.equal(ctx.priceSource(), "mt5");
  });
});

test("nothing is declared on mount, so neither feed is silently enabled", async () => {
  await withMarketScenario(async (ctx) => {
    assert.equal(
      ctx.priceSource(),
      null,
      "the provider must not guess a source before an account declares one"
    );

    ctx.setMt5Price(mt5Quote({ bid: 1.5, ask: 1.5001 }));

    await ctx.pollMt5();

    assert.equal(
      ctx.bid(),
      1.5,
      "the legacy MT5 poll must keep working until an account says otherwise"
    );

    await ctx.send(priceMessage({ bid: 2.5, ask: 2.5001 }));

    assert.equal(
      ctx.bid(),
      2.5,
      "and the legacy pushed price must keep working too"
    );
  });
});

test("a declaration outside the vocabulary leaves the provider unasserted", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.declarePriceSource("IC Markets");

    assert.equal(
      ctx.priceSource(),
      null,
      "a broker label is not a price source and may not be read as one"
    );
    assert.equal(
      ctx.livePollCount(),
      1,
      "an unreadable declaration may not switch the only working feed off"
    );
  });
});

test("declaring MT5 again resumes the poll that cTrader stopped", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.declarePriceSource("ctrader");

    assert.equal(ctx.livePollCount(), 0);

    await ctx.declarePriceSource("mt5");

    assert.equal(
      ctx.livePollCount(),
      1,
      "leaving cTrader must restart the poll, not wait for the next symbol change"
    );

    ctx.setMt5Price(mt5Quote({ bid: 1.6, ask: 1.6001 }));

    const callsBefore = ctx.mt5PriceCalls().length;

    await ctx.pollMt5();

    assert.equal(ctx.mt5PriceCalls().length, callsBefore + 1);
    assert.equal(ctx.bid(), 1.6);
  });
});

test("the symbol guard still rejects another symbol's price", async () => {
  await withMarketScenario(async (ctx) => {
    await ctx.send(priceMessage({ bid: 1.7, ask: 1.7001 }));

    assert.equal(ctx.bid(), 1.7);

    await ctx.send(
      priceMessage({ symbol: "GBPUSD", bid: 2.7, ask: 2.7001 })
    );

    assert.equal(
      ctx.bid(),
      1.7,
      "a source gate must not displace the existing symbol guard"
    );
  });
});

// Kept out of withMarketScenario on purpose: a guard the shared harness raises
// fails every scenario in the file at once, which would hide the reason the
// scenarios above fail.
test("the provider decides the price source through the shared helper", async () => {
  const built = await buildRuntimeBundle();

  assert.ok(
    built.inputs.some((input) =>
      input.endsWith("src/lib/marketPriceSource.js")
    ),
    "MarketContext must import src/lib/marketPriceSource.js rather than keep its own copy of the decision"
  );
});
