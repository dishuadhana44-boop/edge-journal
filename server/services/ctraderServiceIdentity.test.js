/* ============================================================
   PHASE 2.1-E TASK 2 — exact cTrader service account identity

   A cTrader session is one socket authenticated to one account, and
   the service is a module singleton. Two decisions in
   startCTraderService used to be made without asking which account
   was wanted: a ready session was returned to any caller, and a
   startup already in flight was returned to any caller. Both let a
   request for account B be served by a session belonging to account
   A, which is not a display problem but an order placed with the
   wrong money.

   This suite runs the REAL service module. The socket, the protobuf
   codecs, the environment and the credential paths are injected and
   synthetic, so every scenario below executes actual startup code
   without a network, a broker, a credential file or a process. Each
   scenario states which account was asked for and what the fake
   broker is willing to confirm about it; nothing here can pass by
   reading the source.
   ============================================================ */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const SELECTION = await import("./ctraderAccountSelection.js");

const SERVICE_PATH = path.join(HERE, "ctraderService.js");
const SELECTION_PATH = path.join(HERE, "ctraderAccountSelection.js");
const RUNTIME_PATHS = path.resolve(HERE, "../runtimePaths.js");
const ROUTE_PATH = path.resolve(HERE, "../routes/ctrader.js");

/* These files are stored with CRLF endings. The guards and mutants
   below compare against literal blocks, so the source is normalised to
   LF once, here, rather than in every anchor. */
const readSource = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const SERVICE_SOURCE = readSource(SERVICE_PATH);
const ROUTE_SOURCE = readSource(ROUTE_PATH);

/* Synthetic material only. Nothing below is a token, a secret or a
   real account id, and the harness asserts that the service never
   reached a real environment or credential path. */
const ACCESS_TOKEN = "fixture-access-not-a-credential";
const CLIENT_ID = "fixture-client-id";
const CLIENT_SECRET = "fixture-client-secret";

const ACCOUNT_A = "77001122";
const ACCOUNT_B = "88002233";
const ACCOUNT_C = "99003344";
const SYMBOL_ID = 4001;

/* The service reads its payload-type enum out of the protobuf root, so
   the harness supplies it. The numbers are arbitrary; the names are
   the protocol's. */
const PAYLOAD_TYPE = {
  PROTO_OA_APPLICATION_AUTH_REQ: 101,
  PROTO_OA_APPLICATION_AUTH_RES: 102,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ: 103,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES: 104,
  PROTO_OA_ACCOUNT_AUTH_REQ: 105,
  PROTO_OA_ACCOUNT_AUTH_RES: 106,
  PROTO_OA_TRADER_REQ: 107,
  PROTO_OA_TRADER_RES: 108,
  PROTO_OA_SYMBOLS_LIST_REQ: 109,
  PROTO_OA_SYMBOLS_LIST_RES: 110,
  PROTO_OA_SYMBOL_BY_ID_REQ: 111,
  PROTO_OA_SYMBOL_BY_ID_RES: 112,
  PROTO_OA_SUBSCRIBE_SPOTS_REQ: 113,
  PROTO_OA_SUBSCRIBE_SPOTS_RES: 114,
  PROTO_OA_SPOT_EVENT: 115,
  PROTO_OA_NEW_ORDER_REQ: 116,
  PROTO_OA_CLOSE_POSITION_REQ: 117,
  PROTO_OA_AMEND_POSITION_SLTP_REQ: 118,
  PROTO_OA_EXECUTION_EVENT: 119,
  PROTO_OA_ORDER_ERROR_EVENT: 120,
  PROTO_OA_RECONCILE_REQ: 121,
  PROTO_OA_RECONCILE_RES: 122,
};

const PROTO_NAMES = [
  "ProtoMessage",
  "ProtoOAApplicationAuthReq",
  "ProtoOAApplicationAuthRes",
  "ProtoOAGetAccountListByAccessTokenReq",
  "ProtoOAGetAccountListByAccessTokenRes",
  "ProtoOAAccountAuthReq",
  "ProtoOAAccountAuthRes",
  "ProtoOATraderReq",
  "ProtoOATraderRes",
  "ProtoOASymbolsListReq",
  "ProtoOASymbolsListRes",
  "ProtoOASymbolByIdReq",
  "ProtoOASymbolByIdRes",
  "ProtoOASubscribeSpotsReq",
  "ProtoOASubscribeSpotsRes",
  "ProtoOASpotEvent",
  "ProtoOANewOrderReq",
  "ProtoOAClosePositionReq",
  "ProtoOAAmendPositionSLTPReq",
  "ProtoOAExecutionEvent",
  "ProtoOAOrderErrorEvent",
  "ProtoOAReconcileReq",
  "ProtoOAReconcileRes",
];

// ============================================================
// HARNESS
// ============================================================

const scratchDirectories = [];

after(() => {
  for (const directory of scratchDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function scratchDirectory() {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-service-identity-"))
  );

  scratchDirectories.push(directory);

  /* loadProtobuf lists a directory and refuses an empty one, so the
     harness keeps a real (and meaningless) .proto file in scratch. The
     codec is injected, so nothing ever parses it. */
  fs.writeFileSync(
    path.join(directory, "fixture.proto"),
    'syntax = "proto3";\n',
    "utf8"
  );

  return directory;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function ticks(rounds) {
  for (let index = 0; index < rounds; index += 1) {
    await tick();
  }
}

async function waitUntil(predicate, attempts = 200) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) {
      return true;
    }

    await tick();
  }

  return false;
}

/* The fake broker. Every outgoing frame is answered from the fixture,
   so a scenario states what the broker will confirm rather than
   hand-writing a message script — and can decline to confirm exactly
   one thing. */
function brokerReplyFor(fixture, frame) {
  const request = frame.payload || {};

  if (
    frame.payloadType === PAYLOAD_TYPE.PROTO_OA_APPLICATION_AUTH_REQ
  ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_APPLICATION_AUTH_RES,
      payload: { responseStatus: "ACK" },
    };
  }

  if (
    frame.payloadType ===
    PAYLOAD_TYPE.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ
  ) {
    return {
      payloadType:
        PAYLOAD_TYPE.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES,
      payload: {
        ctidTraderAccount: fixture.authorizedAccounts.map(
          (accountId) => ({
            ctidTraderAccountId: accountId,
            name: `Fixture ${accountId}`,
            currency: "USD",
          })
        ),
      },
    };
  }

  if (frame.payloadType === PAYLOAD_TYPE.PROTO_OA_ACCOUNT_AUTH_REQ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_ACCOUNT_AUTH_RES,
      payload: {
        ctidTraderAccountId:
          fixture.authenticatedAccountId === undefined
            ? request.ctidTraderAccountId
            : fixture.authenticatedAccountId,
        responseStatus: "ACK",
      },
    };
  }

  if (frame.payloadType === PAYLOAD_TYPE.PROTO_OA_TRADER_REQ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_TRADER_RES,
      payload: {
        trader: {
          ctidTraderAccountId: String(request.ctidTraderAccountId),
          balance: 1000,
          equity: 1000,
          margin: 0,
          freeMargin: 1000,
          depositCurrency: "USD",
          leverage: 100,
          brokerName: "Fixture Broker",
        },
      },
    };
  }

  if (frame.payloadType === PAYLOAD_TYPE.PROTO_OA_SYMBOLS_LIST_REQ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_SYMBOLS_LIST_RES,
      payload: { symbol: [{ symbolId: SYMBOL_ID, symbolName: "EURUSD" }] },
    };
  }

  if (frame.payloadType === PAYLOAD_TYPE.PROTO_OA_SYMBOL_BY_ID_REQ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_SYMBOL_BY_ID_RES,
      payload: {
        symbol: [
          {
            symbolId: SYMBOL_ID,
            digits: 5,
            minVolume: 0.01,
            maxVolume: 100,
            stepVolume: 0.01,
            lotSize: 100000,
          },
        ],
      },
    };
  }

  if (frame.payloadType === PAYLOAD_TYPE.PROTO_OA_SUBSCRIBE_SPOTS_REQ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_SUBSCRIBE_SPOTS_RES,
      payload: { responseStatus: "ACK" },
    };
  }

  if (frame.payloadType === PAYLOAD_TYPE.PROTO_OA_RECONCILE_REQ) {
    return {
      payloadType: PAYLOAD_TYPE.PROTO_OA_RECONCILE_RES,
      payload: { position: [] },
    };
  }

  return null;
}

async function loadService({
  source = SERVICE_SOURCE,
  authorizedAccounts = [ACCOUNT_A, ACCOUNT_B],
  authenticatedAccountId,
  autoRespond = true,
  failFirstSend = false,
} = {}) {
  const fixture = { authorizedAccounts, authenticatedAccountId };

  const state = {
    sockets: [],
    sent: [],
    inbound: [],
    urls: [],
    logs: [],
    dotenvPaths: [],
    filesystemCalls: [],
    deniedFilesystemCalls: [],
    timers: [],
    dependencies: [],
    throwOnSend: failFirstSend,
  };

  const directory = scratchDirectory();
  const protoDir = directory;
  const envFile = path.join(directory, "synthetic.env");

  let brokerAsleep = !autoRespond;
  let answeredFrames = 0;

  function record(level, args) {
    const text = args
      .map((value) => {
        if (typeof value === "string") {
          return value;
        }

        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      })
      .join(" ");

    state.logs.push({ level, text });
  }

  const quietConsole = {};

  for (const level of ["log", "warn", "error", "info", "debug"]) {
    quietConsole[level] = (...args) => record(level, args);
  }

  const fakeProcess = {
    env: {
      CTRADER_CLIENT_ID: CLIENT_ID,
      CTRADER_CLIENT_SECRET: CLIENT_SECRET,
    },
    pid: 4242,
  };

  /* Only the injected proto directory is reachable. Anything else —
     including every real credential or environment path — is refused
     and recorded, and assertConfined fails the scenario if the service
     ever asked. */
  const confined = (name) => (target) => {
    state.deniedFilesystemCalls.push(`${name}:${String(target)}`);

    throw new Error(`harness: fs.${name} is not available to this scenario`);
  };

  const confinedFs = {
    existsSync(target) {
      state.filesystemCalls.push(String(target));

      if (path.resolve(String(target)) !== protoDir) {
        state.deniedFilesystemCalls.push(`existsSync:${String(target)}`);

        return false;
      }

      return fs.existsSync(target);
    },
    readdirSync(target) {
      state.filesystemCalls.push(String(target));

      if (path.resolve(String(target)) !== protoDir) {
        state.deniedFilesystemCalls.push(`readdirSync:${String(target)}`);

        return [];
      }

      return fs.readdirSync(target);
    },
    readFileSync: confined("readFileSync"),
    writeFileSync: confined("writeFileSync"),
    openSync: confined("openSync"),
    renameSync: confined("renameSync"),
    unlinkSync: confined("unlinkSync"),
    mkdirSync: confined("mkdirSync"),
    statSync: confined("statSync"),
  };

  const dotenvStub = {
    config(options) {
      state.dotenvPaths.push(options && options.path);

      return { parsed: {} };
    },
  };

  /* Frames travel as plain objects: the codec is a pass-through, so no
     byte buffer crosses the realm boundary and no scenario can be
     confused by serialisation. */
  const outerMessage = {
    create: (value) => value,
    encode: (value) => ({ finish: () => value }),
    decode: () => {
      if (state.inbound.length === 0) {
        throw new Error("harness: a message arrived with no frame queued");
      }

      return state.inbound.shift();
    },
  };

  const passThrough = {
    create: (value) => value,
    encode: (value) => ({ finish: () => value }),
    decode: (value) => value,
  };

  const types = new Map();

  for (const name of PROTO_NAMES) {
    types.set(name, name === "ProtoMessage" ? outerMessage : passThrough);
  }

  const protobufStub = {
    load: async () => ({
      lookupType: (name) => {
        if (!types.has(name)) {
          state.dependencies.push(`unknown-type:${name}`);

          throw new Error(`harness: ${name} is not in the fixture schema`);
        }

        return types.get(name);
      },
      lookupEnum: () => ({ values: PAYLOAD_TYPE }),
    }),
  };

  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.CONNECTING;
      this.listeners = new Map();

      state.sockets.push(this);
      state.urls.push(url);

      state.timers.push(
        setTimeout(() => {
          this.open();
        }, 0)
      );
    }

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }

      this.listeners.get(event).push(handler);

      return this;
    }

    removeAllListeners() {
      this.listeners.clear();

      return this;
    }

    emit(event, ...args) {
      return Promise.all(
        (this.listeners.get(event) || []).map((handler) => handler(...args))
      );
    }

    open() {
      if (this.readyState !== FakeWebSocket.CONNECTING) {
        return Promise.resolve();
      }

      this.readyState = FakeWebSocket.OPEN;

      return this.emit("open");
    }

    send(frame) {
      if (this.readyState !== FakeWebSocket.OPEN) {
        throw new Error("harness: send on a socket that is not open");
      }

      /* One scenario needs the very first frame to fail on the wire, so
         the socket throws inside the open handler instead of answering. */
      if (state.throwOnSend) {
        state.throwOnSend = false;

        throw new Error("fixture: the socket refused to send");
      }

      state.sent.push(frame);

      if (brokerAsleep) {
        return;
      }

      this.answer(frame);
    }

    answer(frame) {
      const reply = brokerReplyFor(fixture, frame || state.sent[state.sent.length - 1]);

      if (!reply) {
        return Promise.resolve();
      }

      state.inbound.push(reply);

      return this.emit("message", {});
    }

    deliver(frame) {
      if (this.readyState !== FakeWebSocket.OPEN) {
        return Promise.resolve();
      }

      state.inbound.push(frame);

      return this.emit("message", {});
    }

    close(code = 1000, reason = "closed") {
      if (this.readyState === FakeWebSocket.CLOSED) {
        return Promise.resolve();
      }

      this.readyState = FakeWebSocket.CLOSED;

      return this.emit("close", code, reason);
    }
  }

  const context = createContext(
    {
      process: fakeProcess,
      console: quietConsole,
      setTimeout: (callback, delay) => {
        const handle = setTimeout(callback, delay);

        state.timers.push(handle);

        return handle;
      },
      clearTimeout,
      TextEncoder,
      URL,
    },
    { codeGeneration: { strings: false, wasm: false } }
  );

  const modules = new Map();

  function synthetic(identifier, exports) {
    if (!modules.has(identifier)) {
      modules.set(
        identifier,
        new SyntheticModule(
          Object.keys(exports),
          function populate() {
            for (const [name, value] of Object.entries(exports)) {
              this.setExport(name, value);
            }
          },
          { context, identifier }
        )
      );
    }

    return modules.get(identifier);
  }

  function rejectDependency(specifier) {
    state.dependencies.push(String(specifier));

    throw new Error(`harness: ${specifier} is outside the injected graph`);
  }

  function sourceModule(filename) {
    const identifier = pathToFileURL(filename).href;

    if (!modules.has(identifier)) {
      modules.set(
        identifier,
        new SourceTextModule(source, {
          context,
          identifier,
          importModuleDynamically: rejectDependency,
        })
      );
    }

    return modules.get(identifier);
  }

  function link(specifier, referencingModule) {
    if (specifier === "ws") {
      return synthetic("stub:ws", { default: FakeWebSocket });
    }

    if (specifier === "protobufjs") {
      return synthetic("stub:protobufjs", { default: protobufStub });
    }

    if (specifier === "dotenv") {
      return synthetic("stub:dotenv", { default: dotenvStub });
    }

    if (specifier === "fs" || specifier === "node:fs") {
      return synthetic("stub:fs", { ...confinedFs, default: confinedFs });
    }

    if (specifier === "path" || specifier === "node:path") {
      return synthetic("stub:path", { ...path, default: path });
    }

    if (!specifier.startsWith(".")) {
      return rejectDependency(specifier);
    }

    const resolved = fileURLToPath(
      new URL(specifier, referencingModule.identifier)
    );

    if (resolved === RUNTIME_PATHS) {
      return synthetic("stub:runtimePaths", {
        PROTO_DIR: protoDir,
        ENV_FILE: envFile,
        AUTH_FILE: path.join(directory, "auth.fixture.json"),
        ACCOUNTS_FILE: path.join(directory, "accounts.fixture.json"),
      });
    }

    if (resolved === SELECTION_PATH) {
      return synthetic("stub:selection", { ...SELECTION });
    }

    if (resolved !== SERVICE_PATH) {
      return rejectDependency(specifier);
    }

    return sourceModule(SERVICE_PATH);
  }

  const entry = sourceModule(SERVICE_PATH);

  await entry.link(link);
  await entry.evaluate({ timeout: 5000 });

  const api = entry.namespace;

  function currentStatus() {
    return api.getCTraderServiceStatus();
  }

  /* A launch that never blocks the scenario: handle.settled is read
     directly, so a startup can be inspected while it is in flight. */
  function launch(requestedAccountId) {
    const handle = { settled: null };

    handle.pending = () => handle.settled === null;

    handle.promise = api
      .startCTraderService(() => {}, () => {}, ACCESS_TOKEN, requestedAccountId)
      .then(
        (value) => {
          handle.settled = { ok: true, value };
        },
        (error) => {
          handle.settled = { ok: false, error };
        }
      );

    handle.await = async () => {
      if (await waitUntil(() => handle.settled !== null)) {
        return handle.settled;
      }

      throw new Error(
        `harness: the request for ${describe(requestedAccountId)} never settled`
      );
    };

    return handle;
  }

  const harness = {
    api,
    state,
    fixture,
    directory,
    currentStatus,
    launch,
    attempt: (requestedAccountId) => launch(requestedAccountId).await(),
    get socket() {
      return state.sockets[state.sockets.length - 1] || null;
    },
    /* Wake the sleeping broker and let the handshake that is already
       under way finish. */
    async wakeBroker() {
      brokerAsleep = false;

      while (answeredFrames < state.sent.length) {
        const frame = state.sent[answeredFrames];

        answeredFrames += 1;

        const reply = brokerReplyFor(fixture, frame);

        if (reply) {
          await this.socket.deliver(reply);
        }

        await tick();
      }
    },
    async reachReady(requestedAccountId) {
      const outcome = await this.attempt(requestedAccountId);

      if (!outcome.ok) {
        throw new Error(
          `harness: could not reach a ready session for ${requestedAccountId}: ${outcome.error.message}`
        );
      }

      return outcome.value;
    },
    async dispose() {
      for (const handle of state.timers) {
        clearTimeout(handle);
      }

      state.timers.length = 0;
    },
    assertConfined() {
      assert.deepEqual(
        state.deniedFilesystemCalls,
        [],
        "the service must not reach a real credential or environment path"
      );
      assert.deepEqual(
        state.dependencies,
        [],
        "the service must stay inside the injected module graph"
      );
      assert.deepEqual(
        state.dotenvPaths,
        [envFile],
        "dotenv must only ever be handed the injected path"
      );
      assert.equal(
        state.logs.some(
          (entry) =>
            entry.text.includes(ACCESS_TOKEN) ||
            entry.text.includes(CLIENT_SECRET)
        ),
        false,
        "startup must not print the access token or the client secret"
      );
    },
  };

  return harness;
}

function describe(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}

async function scenario(options, run) {
  const harness = await loadService(options);

  try {
    await run(harness);
  } finally {
    await harness.dispose();
  }

  harness.assertConfined();
}

const isReady = (status) =>
  Boolean(
    status.running &&
      status.connected &&
      status.authenticated &&
      status.ready
  );

function namesAccount(message, accountId) {
  return (
    typeof message === "string" && message.includes(String(accountId))
  );
}

// ============================================================
// A — COLD STARTUP IS BOUND TO AN EXPLICIT REQUEST
// ============================================================

for (const [label, requested] of [
  ["missing", undefined],
  ["null", null],
  ["blank", ""],
  ["whitespace only", "   "],
  ["an object", {}],
  ["a boolean", true],
  ["NaN", Number.NaN],
]) {
  test(`a ${label} requested account id refuses startup before a socket is built`, async () => {
    await scenario({}, async (harness) => {
      const outcome = await harness.attempt(requested);

      assert.equal(
        outcome.ok,
        false,
        `a request whose account id is ${describe(requested)} must fail closed`
      );
      assert.deepEqual(
        harness.state.sockets,
        [],
        `a request whose account id is ${describe(requested)} may not dial the broker`
      );
      assert.equal(isReady(harness.currentStatus()), false);
      assert.equal(harness.currentStatus().tradingAccountId, null);
    });
  });
}

test("a sole authorized account is never started for without an explicit request", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A] }, async (harness) => {
    const outcome = await harness.attempt(null);

    assert.equal(
      outcome.ok,
      false,
      "exactly one authorized account is not a reason to start trading on it"
    );
    assert.deepEqual(harness.state.sockets, []);
    assert.equal(harness.currentStatus().tradingAccountId, null);
  });
});

test("the exact requested account is the one the service authenticates", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A, ACCOUNT_B] }, async (harness) => {
    const status = await harness.reachReady(ACCOUNT_B);

    assert.equal(status.ready, true);
    assert.equal(status.tradingAccountId, ACCOUNT_B);

    const authRequest = harness.state.sent.find(
      (frame) => frame.payloadType === PAYLOAD_TYPE.PROTO_OA_ACCOUNT_AUTH_REQ
    );

    assert.ok(authRequest, "the service must request account authentication");
    assert.equal(
      String(authRequest.payload.ctidTraderAccountId),
      ACCOUNT_B,
      "the account auth request must name the requested account, not the first one"
    );
  });
});

// ============================================================
// B — A WARM SESSION IS REUSED ONLY FOR ITS OWN ACCOUNT
// ============================================================

test("a ready session is reused for the account it already serves", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A, ACCOUNT_B] }, async (harness) => {
    await harness.reachReady(ACCOUNT_A);

    assert.equal(harness.state.sockets.length, 1);

    const outcome = await harness.attempt(ACCOUNT_A);

    assert.equal(outcome.ok, true, outcome.error && outcome.error.message);
    assert.equal(outcome.value.ready, true);
    assert.equal(outcome.value.tradingAccountId, ACCOUNT_A);
    assert.equal(
      harness.state.sockets.length,
      1,
      "reuse must not build a second socket"
    );
  });
});

test("a ready session is not reused for a different account", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A, ACCOUNT_B] }, async (harness) => {
    await harness.reachReady(ACCOUNT_A);

    const outcome = await harness.attempt(ACCOUNT_B);

    assert.equal(
      outcome.ok,
      false,
      "a session authenticated to one account cannot serve another"
    );
    assert.ok(
      namesAccount(outcome.error.message, ACCOUNT_A) &&
        namesAccount(outcome.error.message, ACCOUNT_B),
      `the refusal must name both the session account and the requested one, got: ${outcome.error.message}`
    );
    assert.equal(harness.state.sockets.length, 1);
  });
});

test("refusing a different account leaves the existing session intact", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A, ACCOUNT_B] }, async (harness) => {
    await harness.reachReady(ACCOUNT_A);

    const before = harness.currentStatus();
    const outcome = await harness.attempt(ACCOUNT_B);

    assert.equal(outcome.ok, false);

    const after = harness.currentStatus();

    assert.equal(after.running, true);
    assert.equal(after.connected, true);
    assert.equal(after.authenticated, true);
    assert.equal(
      after.ready,
      true,
      "a refused request must not take down the session it was not for"
    );
    assert.equal(after.tradingAccountId, ACCOUNT_A);
    assert.equal(after.symbol, before.symbol);
    assert.equal(harness.socket.readyState, FakeOpen(), "the live socket must still be open");
    assert.equal(harness.state.sockets.length, 1);
  });
});

const FakeOpen = () => 1;

test("a session whose account cannot be read is never reused", async () => {
  for (const unreadable of [null, undefined, "", "   ", {}, "[object Object]"]) {
    const outcome = verifySession({
      requestedAccountId: ACCOUNT_A,
      sessionId: unreadable,
    });

    assert.equal(
      outcome.ok,
      false,
      `a session id of ${describe(unreadable)} proves nothing about who it serves`
    );
    assert.equal(outcome.accountId, null);
    assert.ok(
      /no account|not be reused|cannot|nothing/i.test(outcome.message),
      `the refusal must say plainly that no session was reused, got: ${outcome.message}`
    );
  }
});

test("a blank request is refused by the session rule as well as at startup", async () => {
  for (const unusable of [null, undefined, "", "   ", {}]) {
    const outcome = verifySession({
      requestedAccountId: unusable,
      sessionId: ACCOUNT_A,
    });

    assert.equal(
      outcome.ok,
      false,
      `a request of ${describe(unusable)} cannot authorise reuse of anything`
    );
    assert.equal(outcome.accountId, null);
  }
});

test("the session rule accepts only the account that was asked for", async () => {
  const padded = verifySession({
    requestedAccountId: ` ${ACCOUNT_A} `,
    sessionId: ACCOUNT_B,
  });

  assert.equal(padded.ok, false, "padding is not a new account id");
  assert.ok(
    namesAccount(padded.message, ACCOUNT_A) &&
      namesAccount(padded.message, ACCOUNT_B),
    `both accounts must appear in the refusal, got: ${padded.message}`
  );

  const exact = verifySession({
    requestedAccountId: ` ${ACCOUNT_A} `,
    sessionId: Number(ACCOUNT_A),
  });

  assert.equal(exact.ok, true);
  assert.equal(exact.accountId, ACCOUNT_A);
});

function verifySession(input) {
  if (typeof SELECTION.verifySessionAccountIdentity !== "function") {
    throw new Error(
      "verifySessionAccountIdentity is not exported from the shared selection rule"
    );
  }

  return SELECTION.verifySessionAccountIdentity(input);
}

// ============================================================
// C — A STARTUP IN FLIGHT BELONGS TO ITS REQUESTED ACCOUNT
// ============================================================

test("a second request for the same account joins the startup in flight", async () => {
  await scenario(
    { authorizedAccounts: [ACCOUNT_A, ACCOUNT_B], autoRespond: false },
    async (harness) => {
      const first = harness.launch(ACCOUNT_A);

      await ticks(3);

      assert.equal(first.pending(), true, "harness: the broker must still owe the first startup a response");

      const second = harness.launch(ACCOUNT_A);

      assert.equal(
        harness.state.sockets.length,
        1,
        "the same account must not build a second socket behind the first request's back"
      );

      await harness.wakeBroker();

      const [firstOutcome, secondOutcome] = [await first.await(), await second.await()];

      assert.equal(firstOutcome.ok, true, firstOutcome.error && firstOutcome.error.message);
      assert.equal(secondOutcome.ok, true, secondOutcome.error && secondOutcome.error.message);
      assert.equal(secondOutcome.value.tradingAccountId, ACCOUNT_A);
      assert.equal(harness.state.sockets.length, 1);
    }
  );
});

test("a different account requested while a startup is in flight is refused", async () => {
  await scenario(
    { authorizedAccounts: [ACCOUNT_A, ACCOUNT_B], autoRespond: false },
    async (harness) => {
      const first = harness.launch(ACCOUNT_A);

      await ticks(3);

      assert.equal(first.pending(), true);

      const second = harness.launch(ACCOUNT_B);

      /* The refusal has to arrive on the second call's own tick, not
         after the first startup finishes: a request that is going to be
         refused must not be made to wait. */
      const settled = await waitUntil(() => second.settled !== null, 3);

      assert.equal(
        settled,
        true,
        "a request for another account must be refused at once, not absorbed into the startup in flight"
      );
      assert.equal(second.settled.ok, false);
      assert.ok(
        namesAccount(second.settled.error.message, ACCOUNT_B),
        `the refusal must name the account it turned down, got: ${second.settled.error.message}`
      );
      assert.equal(harness.state.sockets.length, 1);

      await harness.wakeBroker();

      /* Refusing the second request must not have cancelled or hijacked
         the first one. */
      const firstOutcome = await first.await();

      assert.equal(firstOutcome.ok, true, firstOutcome.error && firstOutcome.error.message);
      assert.equal(firstOutcome.value.tradingAccountId, ACCOUNT_A);
    }
  );
});

// ============================================================
// D — A FAILED STARTUP LEAVES NOTHING THAT LOOKS USABLE
// ============================================================

test("a requested account the broker does not authorize refuses startup", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A, ACCOUNT_B] }, async (harness) => {
    const outcome = await harness.attempt(ACCOUNT_C);

    assert.equal(outcome.ok, false);
    assert.ok(
      namesAccount(outcome.error.message, ACCOUNT_C),
      `the refusal must name the missing account, got: ${outcome.error.message}`
    );

    const status = harness.currentStatus();

    assert.equal(status.ready, false);
    assert.equal(status.running, false, "a refused startup must not leave the service looking started");
    assert.equal(status.connected, false);
    assert.equal(status.authenticated, false);
    assert.equal(
      status.tradingAccountId,
      null,
      "a refused startup must not leave an account marked as the selected one"
    );
  });
});

test("a broker that authenticates a different account is refused", async () => {
  await scenario(
    {
      authorizedAccounts: [ACCOUNT_A, ACCOUNT_B],
      /* The broker lists both accounts and then authenticates the other
         one: the classic way a session ends up serving money nobody
         asked to touch. */
      authenticatedAccountId: ACCOUNT_B,
    },
    async (harness) => {
      const outcome = await harness.attempt(ACCOUNT_A);

      assert.equal(
        outcome.ok,
        false,
        "an authentication response that names another account must not be adopted"
      );

      const status = harness.currentStatus();

      assert.equal(status.authenticated, false);
      assert.equal(status.ready, false);
      assert.equal(status.tradingAccountId, null);
    }
  );
});

test("a refused startup can be followed by a successful one", async () => {
  await scenario({ authorizedAccounts: [ACCOUNT_A, ACCOUNT_B] }, async (harness) => {
    const refused = await harness.attempt(ACCOUNT_C);

    assert.equal(refused.ok, false);

    const status = await harness.reachReady(ACCOUNT_A);

    assert.equal(
      status.ready,
      true,
      "a failed startup must not leave a promise that dooms every later request"
    );
    assert.equal(status.tradingAccountId, ACCOUNT_A);
  });
});

test("a socket that fails mid-handshake leaves no misleading state", async () => {
  await scenario(
    { authorizedAccounts: [ACCOUNT_A, ACCOUNT_B], autoRespond: false },
    async (harness) => {
      const first = harness.launch(ACCOUNT_A);

      await ticks(3);

      assert.equal(first.pending(), true);

      harness.socket.close(1006, "fixture drop");

      const outcome = await first.await();

      assert.equal(outcome.ok, false, "a handshake cut short must not report a session");

      const status = harness.currentStatus();

      assert.equal(status.ready, false);
      assert.equal(status.running, false);
      assert.equal(status.tradingAccountId, null);

      /* The retry is answered: the broker was only held asleep to keep
         the first handshake unfinished. */
      await harness.wakeBroker();

      const retry = await harness.attempt(ACCOUNT_A);

      assert.equal(retry.ok, true, retry.error && retry.error.message);
      assert.equal(retry.value.tradingAccountId, ACCOUNT_A);
    }
  );
});

test("a startup whose first send fails leaves nothing half-started", async () => {
  /* The open handler catches, so this is the one failure path that can
     report a connection that was never authenticated to anybody. */
  await scenario(
    { authorizedAccounts: [ACCOUNT_A, ACCOUNT_B], failFirstSend: true },
    async (harness) => {
      const outcome = await harness.attempt(ACCOUNT_A);

      assert.equal(outcome.ok, false, "a socket that refused to send must not report a session");

      const status = harness.currentStatus();

      assert.equal(status.running, false, "a failed startup must not leave the service looking started");
      assert.equal(status.connected, false);
      assert.equal(status.ready, false);
      assert.equal(status.tradingAccountId, null);

      const retry = await harness.attempt(ACCOUNT_A);

      assert.equal(
        retry.ok,
        true,
        `the failed startup must not doom the next request: ${retry.error && retry.error.message}`
      );
      assert.equal(retry.value.tradingAccountId, ACCOUNT_A);
    }
  );
});

// ============================================================
// WIRING: the route must not treat a ready socket as its own
// ============================================================

function sliceBetween(text, start, end, label) {
  const from = text.indexOf(start);

  if (from === -1) {
    throw new Error(`harness: ${label} no longer contains ${start}`);
  }

  const to = text.indexOf(end, from + start.length);

  if (to === -1) {
    throw new Error(`harness: ${label} no longer contains ${end}`);
  }

  return text.slice(from, to);
}

test("wiring: both route reuse branches verify the session account", () => {
  const blocks = {
    "startService": sliceBetween(
      ROUTE_SOURCE,
      "async function startService()",
      "// ENSURE SERVICE IS RUNNING",
      "routes/ctrader.js startService"
    ),
    "ensureServiceRunning": sliceBetween(
      ROUTE_SOURCE,
      "async function ensureServiceRunning()",
      "// cTRADER CONNECT",
      "routes/ctrader.js ensureServiceRunning"
    ),
  };

  for (const [name, text] of Object.entries(blocks)) {
    assert.match(
      text,
      /verifiedReadyStatus\(/,
      `${name} must prove a ready session belongs to the selected account before returning it`
    );
    assert.equal(
      /return\s+(currentStatus|status|newStatus);/.test(text),
      false,
      `${name} must not hand back a ready status it never attributed`
    );
  }

  assert.match(
    ROUTE_SOURCE,
    /verifySessionAccountIdentity/,
    "the route must use the shared session rule, not a second comparison"
  );
});

test("wiring: the service decides identity before it reuses, shares or dials", () => {
  const startup = sliceBetween(
    SERVICE_SOURCE,
    "export async function startCTraderService(",
    "// PLACE MARKET ORDER",
    "startCTraderService"
  );

  const unusable = startup.indexOf("requestedAccountId === null");
  const dial = startup.indexOf("new WebSocket(");
  const reuse = startup.indexOf("verifySessionAccountIdentity(");
  const reuseReturn = startup.indexOf("return getCTraderServiceStatus();", reuse);

  assert.notEqual(unusable, -1, "the startup must read the requested account");
  assert.ok(
    unusable < dial,
    "an unusable request must be refused before the service dials the broker"
  );
  assert.ok(
    reuse < reuseReturn && reuseReturn < dial,
    "a warm session may be returned only through the identity rule"
  );

  assert.match(
    startup,
    /sessionId:\s*selectedTradingAccountId/,
    "the warm reuse check must compare the account this session was authenticated to"
  );
  assert.match(
    startup,
    /startupAccountId !== requestedAccountId/,
    "a startup in flight must be bound to the account it was requested for"
  );
  assert.equal(
    /if \(startupPromise\) \{\s*return startupPromise;/.test(startup),
    false,
    "the in-flight promise may not be returned to a caller that asked for another account"
  );
  assert.ok(
    (startup.match(/startupAccountId = null/g) || []).length >= 1,
    "the startup binding must be cleared when the startup ends"
  );
  assert.ok(
    (startup.match(/startupAccountId = requestedAccountId/g) || []).length === 1,
    "exactly one startup may claim the binding"
  );
});

test("wiring: a startup that fails through the message path clears the binding", () => {
  const startup = sliceBetween(
    SERVICE_SOURCE,
    "export async function startCTraderService(",
    "// PLACE MARKET ORDER",
    "startCTraderService"
  );

  const handlerCatch = startup.indexOf("cTrader message error:");

  assert.notEqual(handlerCatch, -1, "harness: the message handler catch moved");

  const guard = startup.slice(handlerCatch, handlerCatch + 400);

  assert.match(
    guard,
    /if \(!serviceReady\) \{\s*failStartup\(error\);/,
    "a failure that arrives inside a message handler must clear the service state and the in-flight binding, not only reject"
  );
});

// ============================================================
// MUTANTS: each is an edit this feature invites
// ============================================================

const MUTANTS = [
  {
    label: "M1 a ready socket is reused for whoever asks",
    autoRespond: true,
    anchor: `    const reuse = verifySessionAccountIdentity({
      requestedAccountId,
      sessionId: selectedTradingAccountId,
    });

    if (!reuse.ok) {
      throw new Error(reuse.message);
    }

`,
    replacement: "",
    async probe(harness) {
      await harness.reachReady(ACCOUNT_A);

      const outcome = await harness.attempt(ACCOUNT_B);

      return { reused: outcome.ok === true, sockets: harness.state.sockets.length };
    },
    expectWrongEvidence: (evidence) => evidence.reused === true,
    detects: "a ready session is not reused for a different account",
  },
  {
    label: "M2 the in-flight promise is shared regardless of account",
    autoRespond: false,
    anchor: `    if (startupAccountId !== requestedAccountId) {
      throw new Error(
        \`cTrader startup is already in flight for another account, so the request for account \${requestedAccountId} was refused.\`
      );
    }

`,
    replacement: "",
    async probe(harness) {
      const first = harness.launch(ACCOUNT_A);

      await ticks(3);

      const second = harness.launch(ACCOUNT_B);

      const settled = await waitUntil(() => second.settled !== null, 3);

      return {
        refused: settled && second.settled.ok === false,
        absorbedIntoFirstStartup: !settled,
        firstStartupStillInFlight: first.pending(),
        sockets: harness.state.sockets.length,
      };
    },
    expectWrongEvidence: (evidence) => evidence.absorbedIntoFirstStartup === true,
    detects: "a different account requested while a startup is in flight is refused",
  },
  {
    label: "M3 the request is read but never enforced",
    autoRespond: true,
    anchor: `  if (requestedAccountId === null) {
    throw new Error(
      "No usable cTrader account id was requested, so the cTrader service was not started."
    );
  }

`,
    replacement: "",
    async probe(harness) {
      const outcome = await harness.attempt(null);

      return { outcome, sockets: harness.state.sockets.length };
    },
    expectWrongEvidence: (evidence) => evidence.sockets > 0,
    detects: "a null requested account id refuses startup before a socket is built",
  },
  {
    label: "M4 a message-path failure rejects but keeps the state",
    autoRespond: true,
    anchor: `                  if (!serviceReady) {
                    failStartup(error);
                  }`,
    replacement: `                  if (!serviceReady) {
                    rejectStartup(error);
                  }`,
    async probe(harness) {
      const refused = await harness.attempt(ACCOUNT_C);

      if (refused.ok) {
        return { firstRefused: false, retryOk: false };
      }

      let retry;

      try {
        retry = await harness.attempt(ACCOUNT_A);
      } catch {
        return { firstRefused: true, retryOk: false, retryHangs: true };
      }

      return { firstRefused: true, retryOk: retry.ok === true };
    },
    expectWrongEvidence: (evidence) => evidence.firstRefused === true && evidence.retryOk === false,
    detects: "a refused startup can be followed by a successful one",
  },
];

for (const mutant of MUTANTS) {
  test(`mutant ${mutant.label}`, async () => {
    assert.ok(
      SERVICE_SOURCE.includes(mutant.anchor),
      `the ${mutant.label} anchor must exist in the current source; if the startup shape moved, retarget this mutant`
    );

    const mutated = SERVICE_SOURCE.replace(mutant.anchor, mutant.replacement);

    assert.notEqual(mutated, SERVICE_SOURCE, "a mutant that changes nothing proves nothing");

    let evidence;

    await scenario(
      {
        source: mutated,
        authorizedAccounts: [ACCOUNT_A, ACCOUNT_B],
        autoRespond: mutant.autoRespond,
      },
      async (harness) => {
        evidence = await mutant.probe(harness);
      }
    );

    assert.equal(
      mutant.expectWrongEvidence(evidence),
      true,
      `${mutant.label} must behave wrongly in exactly the way the test "${mutant.detects}" refuses — if it behaves correctly, that test is not load-bearing`
    );
  });
}
