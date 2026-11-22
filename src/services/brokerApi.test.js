// ============================================================
// BROKER TRANSPORT CONTRACTS (Phase 3)
// ============================================================
//
// What this file is: the ten exports of src/services/brokerApi.js pinned to the
// exact URL, method, headers and body the Express routes already answer, and to
// what a caller may learn when the upstream fails.
//
// The endpoints are not invented here. Each one is a route that already exists:
//   GET  /api/brokers/status        server/routes/brokers.js:21, mounted at
//                                   server/index.js:113
//   GET  /api/mt5/positions         server/routes/mt5.js:349
//   GET  /api/mt5/orders            server/routes/mt5.js:1635
//   POST /api/mt5/disconnect        server/routes/mt5.js:2266
//   GET  /api/ctrader/status        server/routes/ctrader.js:696
//   POST /api/ctrader/account       server/routes/ctrader.js:789 (accountId,
//                                   accountName) - saves, never activates
//   POST /api/ctrader/accounts/select  server/routes/ctrader.js:958 (accountId)
//                                      - the only explicit activation
//   POST /api/ctrader/start-service server/routes/ctrader.js:1229
//   POST /api/ctrader/disconnect    server/routes/ctrader.js:1565
//   GET  /api/ctrader/connect       server/routes/ctrader.js:434
//
// WHAT THIS CANNOT PROVE, stated up front: fetch is replaced for the duration of
// every scenario, so nothing here reaches a port, a broker or the Express
// process. Passing means the client asks for the right path with the right
// method and body; it says nothing about what the server answers.
//
// The base URL is NOT inherited from the ambient environment: brokerApi decides
// it once, when the module loads, so each run bundles the real module with the
// build environment a deployed Vite bundle would inject. Which environment
// yields which base URL is src/services/brokerApiBaseUrl.test.js, and this file
// deliberately uses a host that is not loopback, so a loopback default leaking
// into any path below fails here as well as there.

import test from "node:test";
import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

const TEST_API_URL = "https://broker-backend.example.test";

// Stands in for anything a real upstream body might hold. No assertion below may
// let it reach the caller, in any property other than the one allowlisted code.
const SECRET_LIKE_TEXT = "FAKE_SECRET_TOKEN_do_not_forward";

// ============================================================
// MODULE LOADING
//
// The transport decides its base URL when the module loads, so the scenarios
// bundle the real module with the environment a deployed Vite build injects
// instead of inheriting an ambient one. Dynamic, so a missing module is
// reported as a named missing contract instead of an uncaught linking error
// that would mask which export is absent.
// ============================================================

async function buildApiModule() {
  const result = await esbuild.build({
    stdin: {
      contents: 'export * from "./brokerApi.js";',
      resolveDir: here,
      loader: "js",
      sourcefile: "brokerApiContractEntry.js",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    logLevel: "silent",
    define: {
      "import.meta.env": JSON.stringify({
        BASE_URL: "/",
        MODE: "production",
        DEV: false,
        PROD: true,
        VITE_API_URL: TEST_API_URL,
      }),
    },
  });

  assert.equal(result.outputFiles.length, 1, "the harness must stay in memory");

  const loaded = { exports: {} };

  const noRequires = (specifier) =>
    assert.fail(
      `brokerApi must stay dependency-free, tried to require ${specifier}`,
    );

  new Function("require", "module", "exports", result.outputFiles[0].text)(
    noRequires,
    loaded,
    loaded.exports,
  );

  return loaded.exports;
}

let modulePromise = null;

function loadApi() {
  if (modulePromise === null) {
    modulePromise = buildApiModule().catch((error) => {
      assert.fail(
        `brokerApi must export the Phase 3 transport contract: ${error.message}`
      );
    });
  }

  return modulePromise;
}

// ============================================================
// FAKE FETCH
//
// Records { url, options } for every call, answers with the status and body the
// scenario chose, and refuses to answer once the scenario is over so a request
// cannot escape into a later test.
// ============================================================

function describeStub(stub) {
  const {
    status = 200,
    body = { success: true },
    jsonThrows = false,
    jsonErrorMessage = "FAKE_UPSTREAM_BODY_TEXT",
    networkError = null,
  } = stub ?? {};

  return { status, body, jsonThrows, jsonErrorMessage, networkError };
}

async function withFetchStub(stub, run) {
  const {
    status,
    body,
    jsonThrows,
    jsonErrorMessage,
    networkError,
  } = describeStub(stub);

  const calls = [];
  const previousFetch = globalThis.fetch;
  const previousConsole = {};
  const logged = [];

  let open = true;

  globalThis.fetch = (url, options = {}) => {
    assert.ok(
      open,
      "no request may be issued after the scenario ended"
    );

    const href = String(url);

    calls.push({ url: href, options });

    if (networkError) {
      return Promise.reject(networkError);
    }

    assert.ok(
      href.startsWith(TEST_API_URL),
      `brokerApi must build every request from the configured base URL, got ${href}`
    );

    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (jsonThrows) {
          throw new Error(jsonErrorMessage);
        }

        return body;
      },
    });
  };

  for (const method of ["log", "error", "warn", "info"]) {
    previousConsole[method] = console[method];

    console[method] = (...args) => {
      logged.push(args.map((arg) => String(arg)).join(" "));
    };
  }

  try {
    await run(calls, logged);
  } finally {
    open = false;

    globalThis.fetch = previousFetch;

    for (const method of Object.keys(previousConsole)) {
      console[method] = previousConsole[method];
    }
  }

  return calls;
}

const getOptions = { method: "GET", cache: "no-store" };

// ============================================================
// 1. THE CONTRACT EXISTS
// ============================================================

const EXPORTS = [
  "getBrokerStatus",
  "getMt5Positions",
  "getMt5Orders",
  "disconnectMt5",
  "getCtraderStatus",
  "selectCtraderAccount",
  "addCtraderAccount",
  "startCtraderService",
  "disconnectCtrader",
  "ctraderConnectUrl",
];

test("brokerApi exports the whole Phase 3 transport contract", async () => {
  const api = await loadApi();

  for (const name of EXPORTS) {
    assert.equal(typeof api[name], "function", `${name} must be exported`);
  }
});

// ============================================================
// 2. GET CONTRACTS
// ============================================================

test("getBrokerStatus reads the aggregate status route with no cache", async () => {
  const { getBrokerStatus } = await loadApi();

  await withFetchStub({}, async (calls) => {
    const data = await getBrokerStatus();

    assert.equal(calls[0].url, `${TEST_API_URL}/api/brokers/status`);
    assert.deepEqual(calls[0].options, getOptions);
    assert.deepEqual(data, { success: true }, "a good response is returned parsed");
  });
});

test("getMt5Positions encodes the local account id", async () => {
  const { getMt5Positions } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await getMt5Positions("local account/1");

    assert.equal(
      calls[0].url,
      `${TEST_API_URL}/api/mt5/positions?accountId=local%20account%2F1`
    );
    assert.deepEqual(calls[0].options, getOptions);
  });
});

test("getMt5Positions sends the MT5 positions route for a plain login id", async () => {
  const { getMt5Positions } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await getMt5Positions("mt5-1001");

    assert.equal(
      calls[0].url,
      `${TEST_API_URL}/api/mt5/positions?accountId=mt5-1001`
    );
  });
});

test("getMt5Orders reads the MT5 pending orders route", async () => {
  const { getMt5Orders } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await getMt5Orders();

    assert.equal(calls[0].url, `${TEST_API_URL}/api/mt5/orders`);
    assert.deepEqual(calls[0].options, getOptions);
  });
});

test("getCtraderStatus reads the cTrader status route", async () => {
  const { getCtraderStatus } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await getCtraderStatus();

    assert.equal(calls[0].url, `${TEST_API_URL}/api/ctrader/status`);
    assert.deepEqual(calls[0].options, getOptions);
  });
});

// ============================================================
// 3. POST CONTRACTS
// ============================================================

test("disconnectMt5 posts without a body", async () => {
  const { disconnectMt5 } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await disconnectMt5();

    assert.equal(calls[0].url, `${TEST_API_URL}/api/mt5/disconnect`);
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.body, undefined);
    assert.equal(calls[0].options.cache, undefined);
  });
});

test("startCtraderService posts without a body", async () => {
  const { startCtraderService } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await startCtraderService();

    assert.equal(calls[0].url, `${TEST_API_URL}/api/ctrader/start-service`);
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.body, undefined);
  });
});

test("disconnectCtrader posts without a body", async () => {
  const { disconnectCtrader } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await disconnectCtrader();

    assert.equal(calls[0].url, `${TEST_API_URL}/api/ctrader/disconnect`);
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.body, undefined);
  });
});

test("selectCtraderAccount sends the accountId body", async () => {
  const { selectCtraderAccount } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await selectCtraderAccount("77001122");

    assert.equal(
      calls[0].url,
      `${TEST_API_URL}/api/ctrader/accounts/select`
    );
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      accountId: "77001122",
    });
  });
});

test("addCtraderAccount sends the account id as text and the trimmed name", async () => {
  const { addCtraderAccount } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await addCtraderAccount({
      accountId: 77001122,
      accountName: "  Main demo ",
    });

    assert.equal(calls[0].url, `${TEST_API_URL}/api/ctrader/account`);
    assert.equal(calls[0].options.method, "POST");

    const body = JSON.parse(calls[0].options.body);

    // The route's own contract is text (server/routes/ctrader.js:782 reads
    // String(accountId)), so a numeric id must not be forwarded as a JSON
    // number.
    assert.equal(body.accountId, "77001122");
    assert.equal(body.accountName, "Main demo");
  });
});

test("addCtraderAccount leaves a blank name out of the body", async () => {
  const { addCtraderAccount } = await loadApi();

  await withFetchStub({}, async (calls) => {
    await addCtraderAccount({ accountId: "77001122", accountName: "   " });

    assert.deepEqual(JSON.parse(calls[0].options.body), {
      accountId: "77001122",
    });
  });
});

// ============================================================
// 4. THE CONNECT LINK IS A STRING, NOT A REQUEST
// ============================================================

test("ctraderConnectUrl builds the OAuth entry point without requesting it", async () => {
  const { ctraderConnectUrl } = await loadApi();

  await withFetchStub({}, async (calls) => {
    assert.equal(
      ctraderConnectUrl(),
      `${TEST_API_URL}/api/ctrader/connect`
    );
    assert.deepEqual(calls, [], "building a link must not contact the server");
  });
});

// ============================================================
// 5. FAILURES CARRY NO UPSTREAM TEXT
// ============================================================

test("a failing upstream response never leaks its body", async () => {
  const { getBrokerStatus } = await loadApi();

  await withFetchStub(
    {
      status: 500,
      body: { success: false, message: "FAKE_SECRET_TOKEN" },
    },
    async (calls, logged) => {
      const error = await getBrokerStatus().then(
        () => null,
        (failure) => failure
      );

      assert.ok(error instanceof Error, "a 500 must reject");
      assert.equal(error.message.includes("FAKE_SECRET_TOKEN"), false);
      assert.equal(error.message.includes("500"), true);
      assert.deepEqual(
        logged,
        [],
        "a failing status may not be written to the console"
      );
      assert.equal(calls.length, 1);
    }
  );
});

test("an upstream success:false answer is a failure even with HTTP 200", async () => {
  const { disconnectCtrader } = await loadApi();

  await withFetchStub(
    {
      status: 200,
      body: { success: false, message: "FAKE_PASSWORD_do_not_log" },
    },
    async (calls, logged) => {
      const error = await disconnectCtrader().then(
        () => null,
        (failure) => failure
      );

      assert.ok(error instanceof Error, "success:false must reject");
      assert.equal(error.message.includes("FAKE_PASSWORD_do_not_log"), false);
      assert.match(error.message, /^cTrader disconnect failed\./);
      assert.deepEqual(logged, []);
    }
  );
});

test("an unreadable response is reported generically", async () => {
  const { getCtraderStatus } = await loadApi();

  await withFetchStub({ jsonThrows: true }, async () => {
    const error = await getCtraderStatus().then(
      () => null,
      (failure) => failure
    );

    assert.ok(error instanceof Error, "a body that cannot be parsed must reject");
    assert.equal(error.message.includes("FAKE_UPSTREAM_BODY_TEXT"), false);
    assert.match(error.message, /^cTrader status returned an unreadable response\./);
  });
});

test("a 401 keeps its status and still carries no upstream text", async () => {
  const { selectCtraderAccount } = await loadApi();

  await withFetchStub(
    {
      status: 401,
      body: { success: false, message: "cTrader OAuth is not connected FAKE_TOKEN" },
    },
    async () => {
      const error = await selectCtraderAccount("77001122").then(
        () => null,
        (failure) => failure
      );

      assert.ok(error instanceof Error);
      assert.equal(error.message.includes("FAKE_TOKEN"), false);
      assert.equal(error.message.includes("401"), true);
    }
  );
});

test("no export swallows a rejected request", async () => {
  const api = await loadApi();

  const callers = {
    getBrokerStatus: () => api.getBrokerStatus(),
    getMt5Positions: () => api.getMt5Positions("mt5-1001"),
    getMt5Orders: () => api.getMt5Orders(),
    disconnectMt5: () => api.disconnectMt5(),
    getCtraderStatus: () => api.getCtraderStatus(),
    selectCtraderAccount: () => api.selectCtraderAccount("77001122"),
    addCtraderAccount: () => api.addCtraderAccount({ accountId: "77001122" }),
    startCtraderService: () => api.startCtraderService(),
    disconnectCtrader: () => api.disconnectCtrader(),
  };

  for (const [name, call] of Object.entries(callers)) {
    await withFetchStub(
      { networkError: new Error("FAKE_NETWORK_FAILURE") },
      async (calls, logged) => {
        const error = await call().then(
          () => null,
          (failure) => failure
        );

        assert.ok(error instanceof Error, `${name} must reject a network failure`);
        assert.equal(calls.length, 1, `${name} must issue exactly one request`);
        assert.equal(error.message.includes("FAKE_NETWORK_FAILURE"), true);
        assert.deepEqual(logged, [], `${name} may not log a transport failure`);
      }
    );
  }
});

// ============================================================
// 6. ONE DIAGNOSTIC CODE MAY TRAVEL, AND ONLY FROM THE ALLOWLIST
// ============================================================
//
// The select route answers a refusal with a `code` that names which of seven
// things went wrong, and the page turns each into its own sentence. That is the
// only piece of an upstream failure body this transport is allowed to hand on,
// and only when it is one of the seven strings - so a body can never become a
// channel for text, an id or a credential the caller was not expecting.

const SELECTION_CODES = [
  "explicit_selection_required",
  "requested_account_not_available",
  "no_accounts_available",
  "ambiguous_account_ids",
  "session_not_started",
  "session_identity_unverifiable",
  "session_identity_mismatch",
];

test("every cTrader selection code reaches the caller with the message intact", async () => {
  const { selectCtraderAccount } = await loadApi();

  for (const code of SELECTION_CODES) {
    await withFetchStub(
      {
        status: 409,
        body: {
          success: false,
          code,
          message: `FAKE_UPSTREAM_TEXT_FOR_${code}`,
          accessToken: SECRET_LIKE_TEXT,
        },
      },
      async (calls, logged) => {
        const error = await selectCtraderAccount("77001122").then(
          () => null,
          (failure) => failure
        );

        assert.ok(error instanceof Error, `${code} must reject`);
        assert.equal(
          error.code,
          code,
          `the ${code} diagnosis must reach the page that explains it`
        );
        assert.equal(
          error.message,
          "cTrader account selection failed with HTTP 409.",
          "carrying a code must not change the sentence the user reads"
        );
        assert.equal(error.message.includes(code), false);
        assert.equal(logged.length, 0);
        assert.equal(calls.length, 1);
      }
    );
  }
});

test("a code the transport has never heard of is not carried", async () => {
  const { selectCtraderAccount } = await loadApi();

  await withFetchStub(
    {
      status: 500,
      body: {
        success: false,
        code: "FAKE_INTERNAL_STACK_FRAME",
        message: "FAKE_UPSTREAM_TEXT",
      },
    },
    async () => {
      const error = await selectCtraderAccount("77001122").then(
        () => null,
        (failure) => failure
      );

      assert.ok(error instanceof Error);
      assert.equal(
        "code" in error,
        false,
        "an unlisted code must not become a property the page could render"
      );
      assert.equal(error.message.includes("FAKE_INTERNAL_STACK_FRAME"), false);
    }
  );
});

test("only the code key travels, and only as a listed string", async () => {
  const { selectCtraderAccount } = await loadApi();

  const bodies = [
    // Right name, wrong shape.
    { success: false, code: { toString: () => "session_not_started" } },
    // Wrong name, right value.
    { success: false, errorCode: "session_not_started" },
    // A listed code smuggling a payload next to it.
    {
      success: false,
      code: "session_not_started",
      detail: { accessToken: SECRET_LIKE_TEXT },
    },
  ];

  for (const [index, body] of bodies.entries()) {
    await withFetchStub({ status: 500, body }, async () => {
      const error = await selectCtraderAccount("77001122").then(
        () => null,
        (failure) => failure
      );

      assert.ok(error instanceof Error, `body ${index} must reject`);

      if (index === 2) {
        assert.equal(error.code, "session_not_started");
        assert.deepEqual(
          Object.keys(error),
          ["code"],
          `body ${index}: the error may carry the code and nothing else from the body`
        );
        assert.equal(error.detail, undefined);
      } else {
        assert.equal(
          "code" in error,
          false,
          `body ${index}: only an allowlisted string may be carried`
        );
      }

      assert.equal(error.errorCode, undefined);
    });
  }
});

test("a successful answer is returned untouched and carries no diagnostic", async () => {
  const { selectCtraderAccount } = await loadApi();

  await withFetchStub(
    {
      status: 200,
      body: {
        success: true,
        message: "Account switched successfully",
        activeAccountId: "77001122",
      },
    },
    async () => {
      const data = await selectCtraderAccount("77001122");

      assert.deepEqual(data, {
        success: true,
        message: "Account switched successfully",
        activeAccountId: "77001122",
      });
    }
  );
});

test("a network failure carries no code", async () => {
  const { selectCtraderAccount } = await loadApi();

  await withFetchStub(
    { networkError: new Error("FAKE_NETWORK_FAILURE") },
    async () => {
      const error = await selectCtraderAccount("77001122").then(
        () => null,
        (failure) => failure
      );

      assert.equal("code" in error, false);
    }
  );
});
