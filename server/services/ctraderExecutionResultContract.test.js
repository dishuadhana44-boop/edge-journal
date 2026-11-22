import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as service from "./ctraderService.js";

/* ============================================================
   PHASE 4A TASK 3 — broker-confirmed market order execution

   A market order is only successful when a broker frame names the
   client order id this process sent. The correlation field is an
   UNVERIFIED protocol assumption, so an unmatched frame must never
   produce success: the honest outcome is "unconfirmed".

   closePosition and amendPositionSLTP are deliberately out of scope
   and are pinned as unchanged.
   ============================================================ */

const HERE = path.dirname(fileURLToPath(import.meta.url));

function readSource(relative) {
  return fs
    .readFileSync(path.join(HERE, relative), "utf8")
    .replace(/\r\n/g, "\n");
}

const SERVICE_SOURCE = readSource("./ctraderService.js");
const ROUTE_SOURCE = readSource("../routes/ctrader.js");
const ADAPTER_SOURCE = readSource("../brokers/ctraderAdapter.js");

function sectionOf(source, declaration) {
  const start = source.indexOf(declaration);

  if (start === -1) {
    throw new Error(`${declaration} is missing`);
  }

  const end = source.indexOf("\nexport ", start + 1);

  return source.slice(start, end === -1 ? source.length : end);
}

function routeBlock(source, routePath) {
  const marker = source.indexOf(`"${routePath}"`);

  if (marker === -1) {
    throw new Error(`route ${routePath} is not registered`);
  }

  const start = source.lastIndexOf("router.", marker);
  const end = source.indexOf("router.", start + 1);

  return source.slice(start, end === -1 ? source.length : end);
}

function requireExport(name) {
  const value = service[name];

  assert.equal(
    typeof value,
    "function",
    `${name} must be exported from ctraderService.js`
  );

  return value;
}

/* Long-like values are how protobufjs hands back uint64 fields. */

function int64(text) {
  return {
    __Long: true,
    toString: () => text,
  };
}

function executionFrame({ clientId = "edgeflo-order-1", ...rest } = {}) {
  return {
    clientId,
    ...rest,
  };
}

function freshRegistry() {
  requireExport("clearOrderConfirmationWaiters")();
}

/* ============================================================
   CLASSIFIER — which frame confirms which order
   ============================================================ */

test("the service exports the execution classifier and waiter registry", () => {
  for (
    const name of
    ["summarizeOrderExecution", "waitForOrderConfirmation", "recordBrokerOrderFrame", "clearOrderConfirmationWaiters"]
  ) {
    requireExport(name);
  }
});

test("an execution frame naming our client order id is accepted", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "execution",
    frame: executionFrame({ orderId: int64("88101"), price: 1.16543 }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(result.matched, true);
  assert.equal(result.status, "accepted");
  assert.equal(result.orderId, "88101", "a uint64 must be handed back as text");
  assert.equal(result.price, 1.16543);
});

test("an execution frame nested under execution is matched too", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "execution",
    frame: { execution: { clientId: "edgeflo-order-2", positionId: int64("7700") } },
    clientOrderId: "edgeflo-order-2",
  });

  assert.equal(result.matched, true);
  assert.equal(result.status, "accepted");
  assert.equal(result.positionId, "7700");
});

test("a frame naming a different order is never matched", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "execution",
    frame: executionFrame({ clientId: "edgeflo-someone-else" }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(result.matched, false);
  assert.equal(result.status, undefined, "a mismatched frame must carry no status");
  assert.equal(result.orderId, undefined);
});

test("a frame carrying no client order id is never attributed", () => {
  const summarize = requireExport("summarizeOrderExecution");

  for (const frame of [{}, { orderId: int64("1") }, { clientId: "" }, { clientId: null }, null, undefined, "execution"]) {
    const result = summarize({ kind: "execution", frame, clientOrderId: "edgeflo-order-1" });

    assert.equal(result.matched, false, `${JSON.stringify(frame)} must not be attributed`);
    assert.equal(result.status, undefined);
  }
});

test("an order without a client order id cannot be correlated", () => {
  const summarize = requireExport("summarizeOrderExecution");

  for (const clientOrderId of [undefined, null, "", "   "]) {
    const result = summarize({
      kind: "execution",
      frame: executionFrame({ clientId: "edgeflo-order-1" }),
      clientOrderId,
    });

    assert.equal(result.matched, false, "correlation requires our own id");
    assert.equal(result.code, "client_order_id_missing");
  }
});

test("an error frame naming our order is a broker rejection", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "error",
    frame: executionFrame({ description: "Not enough margin" }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(result.matched, true);
  assert.equal(result.status, "rejected");
  assert.equal(result.message, "Not enough margin");
});

test("the broker's own reason wins, in the order the service already uses", () => {
  const summarize = requireExport("summarizeOrderExecution");

  assert.equal(
    summarize({
      kind: "error",
      frame: executionFrame({ description: "first", errorDescription: "second", errorCode: 9 }),
      clientOrderId: "edgeflo-order-1",
    }).message,
    "first"
  );

  assert.equal(
    summarize({
      kind: "error",
      frame: executionFrame({ errorDescription: "second", errorCode: 9 }),
      clientOrderId: "edgeflo-order-1",
    }).message,
    "second"
  );

  assert.equal(
    summarize({
      kind: "error",
      frame: executionFrame({ errorCode: 9 }),
      clientOrderId: "edgeflo-order-1",
    }).message,
    "9"
  );
});

test("an error frame with no text gets a generic reason, not an invented one", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "error",
    frame: executionFrame({ errorCode: 0 }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(result.status, "rejected");
  assert.equal(typeof result.message, "string");
  assert.notEqual(result.message.length, 0);
  assert.doesNotMatch(result.message, /margin|price|limit|invalid/i, "no invented reason");
});

test("broker fields are passed through or left null, never fabricated", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const bare = summarize({
    kind: "execution",
    frame: executionFrame(),
    clientOrderId: "edgeflo-order-1",
  });

  for (const field of ["orderId", "positionId", "price", "volume", "symbolId"]) {
    assert.equal(bare[field], null, `${field} must stay null when the frame omits it`);
  }

  const full = summarize({
    kind: "execution",
    frame: executionFrame({
      orderId: int64("41"),
      positionId: int64("42"),
      symbolId: int64("2509"),
      price: 1.1,
      volume: 1000,
      orderStatus: 3,
    }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(full.orderId, "41");
  assert.equal(full.positionId, "42");
  assert.equal(full.symbolId, "2509");
  assert.equal(full.price, 1.1);
  assert.equal(full.volume, 1000);
  assert.equal(full.orderStatus, 3, "the raw status value must not be reinterpreted");
});

test("a decoded protobuf default is reported as absent, not as a value", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "execution",
    frame: executionFrame({
      orderId: int64("0"),
      positionId: int64("0"),
      symbolId: int64("0"),
      price: 0,
      volume: 0,
    }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(result.matched, true);

  for (const field of ["orderId", "positionId", "symbolId", "price", "volume"]) {
    assert.equal(
      result[field],
      null,
      `${field} must not be reported from a protobuf default`
    );
  }
});

test("plain objects never masquerade as identifiers", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const result = summarize({
    kind: "execution",
    frame: executionFrame({ orderId: { nested: true } }),
    clientOrderId: "edgeflo-order-1",
  });

  assert.equal(result.matched, true);
  assert.equal(result.orderId, null, "[object Object] must not be reported as an id");
});

test("the classifier leaves its frame untouched", () => {
  const summarize = requireExport("summarizeOrderExecution");

  const frame = executionFrame({ orderId: "41", position: { positionId: "42" } });
  const snapshot = JSON.stringify(frame);

  summarize({ kind: "execution", frame, clientOrderId: "edgeflo-order-1" });

  assert.equal(JSON.stringify(frame), snapshot);
});

/* ============================================================
   WAITER REGISTRY — bounded, never a false success
   ============================================================ */

function fakeTimers() {
  const scheduled = [];
  const cleared = [];

  return {
    scheduled,
    cleared,

    setTimeoutFn: (callback, ms) => {
      scheduled.push({ callback, ms });

      return scheduled.length - 1;
    },

    clearTimeoutFn: (handle) => {
      if (handle === undefined || handle === null) {
        throw new Error("clearTimeout called with no handle");
      }

      cleared.push(handle);
    },
  };
}

test("a matching frame resolves the waiter as accepted", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  const timers = fakeTimers();

  const pending = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-1",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  const settled = recordBrokerOrderFrame("execution", executionFrame({ orderId: int64("88101") }));

  assert.equal(settled, true, "the frame must settle the waiter");

  const outcome = await pending;

  assert.equal(outcome.status, "accepted");
  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.success, true);
  assert.equal(outcome.orderId, "88101");
  assert.equal(timers.scheduled.length, 1, "a bounded timeout must be armed");
  assert.equal(timers.cleared.length, 1, "the timer must not leak");
});

test("no frame resolves the bounded wait as unconfirmed, never as success", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");

  const timers = fakeTimers();

  const pending = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-2",
    timeoutMs: 10000,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  assert.equal(timers.scheduled[0].ms, 10000);

  timers.scheduled[0].callback();

  const outcome = await pending;

  assert.equal(outcome.status, "unconfirmed");
  assert.equal(outcome.confirmed, false);
  assert.equal(outcome.success, false, "a timeout must never report success");
  assert.equal(typeof outcome.message, "string");
  assert.notEqual(outcome.message.length, 0);
});

test("a late frame after the window changes nothing", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  const timers = fakeTimers();

  const pending = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-3",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  timers.scheduled[0].callback();
  await pending;

  assert.equal(
    recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "edgeflo-order-3" })
    ),
    false,
    "a frame for a settled order must be ignored"
  );
});

test("a second frame for the same order cannot resolve twice", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  const timers = fakeTimers();

  const pending = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-4",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  assert.equal(
    recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "edgeflo-order-4", orderId: int64("1") })
    ),
    true
  );

  assert.equal(
    recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "edgeflo-order-4", orderId: int64("2") })
    ),
    false
  );

  const outcome = await pending;

  assert.equal(outcome.orderId, "1", "the first broker answer is the one reported");
});

test("two orders are confirmed independently", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  const timers = fakeTimers();

  const first = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-A",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  const second = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-B",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  recordBrokerOrderFrame("error", { clientId: "edgeflo-order-B", description: "Rejected for B" });

  timers.scheduled[0].callback();

  const [a, b] = await Promise.all([first, second]);

  assert.equal(a.status, "unconfirmed", "B's answer must not confirm A");
  assert.equal(b.status, "rejected");
  assert.equal(b.message, "Rejected for B");
});

test("a frame for an order nobody is waiting on is ignored", () => {
  freshRegistry();
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  assert.equal(recordBrokerOrderFrame("execution", executionFrame({ clientId: "edgeflo-unknown" })), false);
  assert.equal(recordBrokerOrderFrame("execution", {}), false);
  assert.equal(recordBrokerOrderFrame("error", null), false);
});

test("clearing the registry resolves outstanding waits as unconfirmed", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");
  const clearOrderConfirmationWaiters = requireExport("clearOrderConfirmationWaiters");
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  const timers = fakeTimers();

  const pending = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-5",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  clearOrderConfirmationWaiters();

  const outcome = await pending;

  assert.equal(outcome.status, "unconfirmed");
  assert.equal(outcome.success, false);
  assert.equal(timers.cleared.length, 1, "clearing must also clear the timer");

  assert.equal(
    recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "edgeflo-order-5" })
    ),
    false,
    "the registry must be empty afterwards"
  );
});

test("registering the same order id twice does not orphan the first", async () => {
  freshRegistry();
  const waitForOrderConfirmation = requireExport("waitForOrderConfirmation");
  const recordBrokerOrderFrame = requireExport("recordBrokerOrderFrame");

  const timers = fakeTimers();

  const first = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-6",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  const second = waitForOrderConfirmation({
    clientOrderId: "edgeflo-order-6",
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  assert.equal(
    recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "edgeflo-order-6", orderId: int64("55") })
    ),
    true
  );

  const [a, b] = await Promise.all([first, second]);

  assert.equal(a.status, "accepted");
  assert.equal(b.status, "accepted");
});

/* ============================================================
   SERVICE CONTRACT — placeMarketOrder waits before it claims
   ============================================================ */

const ORDER_DECLARATION = "export async function placeMarketOrder";

const ORDER_RULES = [
  {
    label: "the waiter is armed before the frame is sent",
    passes: (body) => {
      const armed = body.search(/waitForOrderConfirmation\s*\(/);
      const sent = body.search(/sendCTraderMessage\s*\(/);

      return armed !== -1 && sent !== -1 && armed < sent;
    },
  },
  {
    label: "the order id used for correlation is the one that was sent",
    passes: (body) =>
      /waitForOrderConfirmation\s*\(\s*\{\s*clientOrderId\s*\}\s*\)/.test(body) &&
      /sendCTraderMessage\s*\(\s*PAYLOAD\.NEW_ORDER_REQ,\s*payload,\s*clientOrderId\s*\)/s.test(
        body
      ),
  },
  {
    label: "the result awaits the broker before returning",
    passes: (body) => {
      const awaited = body.search(/await\s+orderConfirmation\b/);
      const returned = body.search(/return\s*\{/);

      return awaited !== -1 && returned !== -1 && awaited < returned;
    },
  },
  {
    label: "success comes only from a confirmed broker answer",
    passes: (body) =>
      /success:\s*confirmation\.status === "accepted"/.test(body) &&
      !/success:\s*true/.test(body),
  },
  {
    label: "the outcome status and confirmed flag are reported",
    passes: (body) =>
      /status:\s*confirmation\.status/.test(body) &&
      /confirmed:\s*confirmation\.status === "accepted"/.test(body),
  },
  {
    label: "the request-sent fact is kept separate",
    passes: (body) => /sent:\s*true/.test(body),
  },
  {
    label: "the resolved symbol is still echoed",
    passes: (body) =>
      /symbol:\s*symbolData\.symbolName/.test(body) &&
      /symbolId:\s*toStringSafe\(\s*symbolData\.symbolId\s*\)/.test(body),
  },
  {
    label: "the broker's own fields are surfaced when present",
    passes: (body) =>
      /orderId:\s*confirmation\.orderId/.test(body) &&
      /positionId:\s*confirmation\.positionId/.test(body),
  },
];

function orderViolations(body) {
  return ORDER_RULES.filter((rule) => !rule.passes(body)).map((r) => r.label);
}

test("service: placeMarketOrder satisfies the execution-result contract", () => {
  assert.deepEqual(orderViolations(sectionOf(SERVICE_SOURCE, ORDER_DECLARATION)), []);
});

test("service: the send-time success implementation is rejected", () => {
  const preFix = `export async function placeMarketOrder({ symbol, side, lots }) {
  const clientOrderId = "edgeflo-1";

  const request = NewOrderReq.create({ symbolId: symbolData.symbolId, clientOrderId, volume });

  sendCTraderMessage(PAYLOAD.NEW_ORDER_REQ, payload, clientOrderId);

  return {
    success: true,

    symbol: symbolData.symbolName,

    symbolId: toStringSafe(symbolData.symbolId),
  };
}`;

  assert.deepEqual(orderViolations(preFix), [
    "the waiter is armed before the frame is sent",
    "the order id used for correlation is the one that was sent",
    "the result awaits the broker before returning",
    "success comes only from a confirmed broker answer",
    "the outcome status and confirmed flag are reported",
    "the request-sent fact is kept separate",
    "the broker's own fields are surfaced when present",
  ]);
});

test("service: claiming success without a broker answer is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const claiming = body.replace(
    /success:\s*confirmation\.status === "accepted",/,
    "success: true,"
  );

  assert.notEqual(claiming, body, "anchor must exist");
  assert.ok(
    orderViolations(claiming).includes("success comes only from a confirmed broker answer"),
    "a literal success must be rejected"
  );
});

test("service: arming the waiter after the send is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const armed = body.replace("waitForOrderConfirmation(", "movedWaiter(");

  assert.notEqual(armed, body, "anchor must exist");
  assert.ok(
    orderViolations(armed).includes("the waiter is armed before the frame is sent"),
    "registering after the write cannot see a fast answer"
  );
});

test("service: dropping the bounded wait is rejected", () => {
  const body = sectionOf(SERVICE_SOURCE, ORDER_DECLARATION);

  const unawaited = body.replace(/await\s+orderConfirmation/, "orderConfirmation");

  assert.notEqual(unawaited, body, "anchor must exist");
  assert.ok(
    orderViolations(unawaited).includes("the result awaits the broker before returning"),
    "returning the promise must be rejected"
  );
});

/* ============================================================
   DISPATCHER CONTRACT — inbound frames reach the registry
   ============================================================ */

const DISPATCH_RULES = [
  {
    label: "execution frames are offered to the registry",
    passes: (source) => /recordBrokerOrderFrame\(\s*"execution"/.test(source),
  },
  {
    label: "order error frames are offered to the registry",
    passes: (source) => /recordBrokerOrderFrame\(\s*"error"/.test(source),
  },
  {
    label: "the frontend broadcast still happens",
    passes: (source) =>
      /onExecutionUpdate\(\s*\{\s*type:\s*"execution"/.test(source),
  },
  {
    label: "reset clears outstanding order waits",
    passes: (source) => {
      const start = source.indexOf("function resetServiceState");

      if (start === -1) {
        return false;
      }

      const end = source.indexOf("\nfunction ", start + 1);

      return /clearOrderConfirmationWaiters\s*\(/.test(
        source.slice(start, end === -1 ? source.length : end)
      );
    },
  },
];

function dispatchViolations(source) {
  return DISPATCH_RULES.filter((rule) => !rule.passes(source)).map((r) => r.label);
}

test("dispatcher: inbound broker frames feed the order registry", () => {
  assert.deepEqual(dispatchViolations(SERVICE_SOURCE), []);
});

test("dispatcher: the pre-fix message handler is rejected", () => {
  const preFix = `function onMessage() {
  if (payloadType === PAYLOAD.EXECUTION_EVENT) {
    onExecutionUpdate({
      type: "execution",
      data: execution,
    });
  }
}`;

  assert.deepEqual(dispatchViolations(preFix), [
    "execution frames are offered to the registry",
    "order error frames are offered to the registry",
    "reset clears outstanding order waits",
  ]);
});

test("dispatcher: losing the frontend broadcast is rejected", () => {
  const silent = SERVICE_SOURCE.replace(
    /onExecutionUpdate\(\s*\{\s*type:\s*"execution"/,
    'movedBroadcast({ type: "execution"'
  );

  assert.notEqual(silent, SERVICE_SOURCE, "anchor must exist");
  assert.ok(
    dispatchViolations(silent).includes("the frontend broadcast still happens"),
    "confirming the route must not starve the websocket feed"
  );
});

test("dispatcher: losing the reset cleanup is rejected", () => {
  const reset = sectionOf(SERVICE_SOURCE, "function resetServiceState");

  const leaking = reset.replace("clearOrderConfirmationWaiters(", "movedClear(");

  assert.notEqual(leaking, reset, "anchor must exist");
  assert.ok(
    DISPATCH_RULES.find((r) => r.label === "reset clears outstanding order waits").passes(leaking) === false,
    "an order wait that outlives its socket must be rejected"
  );
});

/* ============================================================
   UNTOUCHED PATHS — close and amend stay as they were
   ============================================================ */

for (const declaration of ["export async function closePosition", "export async function amendPositionSLTP"]) {
  test(`service: ${declaration.replace("export async function ", "")} stays send-time and untouched`, () => {
    const body = sectionOf(SERVICE_SOURCE, declaration);

    assert.equal(
      /waitForOrderConfirmation|recordBrokerOrderFrame|confirmation\./.test(body),
      false,
      "Task 3 must not reach this execution path"
    );
    assert.match(body, /success:\s*true/, "its send-time success claim stays as documented");
  });
}

/* ============================================================
   ROUTE CONTRACT — the three outcomes are distinguishable
   ============================================================ */

const ROUTE_RULES = [
  {
    label: "a confirmed order is the only accepted outcome",
    passes: (block) => /result\.status === "accepted"\s*\?\s*200/.test(block),
  },
  {
    label: "a broker rejection is not a 200",
    passes: (block) =>
      /result\.status === "rejected"\s*\?\s*(409|422|502)/.test(block),
  },
  {
    label: "an unconfirmed order is a gateway timeout",
    passes: (block) =>
      /result\.status === "unconfirmed"\s*\?\s*504/.test(block),
  },
  {
    label: "an outcome the route does not recognise is never a success",
    passes: (block) => /:\s*50[0-9]\b/.test(block),
  },
  {
    label: "success is read from the outcome, not from silence",
    passes: (block) =>
      /success:\s*result\.status === "accepted"/.test(block) &&
      block.search(/placeMarketOrder\s*\(/) <
        block.search(/success:\s*result\.status === "accepted"/),
  },
  {
    label: "the Task 2 symbol refusals stay",
    passes: (block) => {
      const placed = block.search(/placeMarketOrder\s*\(/);

      return (
        placed !== -1 &&
        block.search(/res\s*\.\s*status\s*\(\s*400\s*\)/) < placed &&
        block.search(/res\s*\.\s*status\s*\(\s*409\s*\)/) < placed
      );
    },
  },
];

function routeViolations(block) {
  return ROUTE_RULES.filter((rule) => !rule.passes(block)).map((r) => r.label);
}

test("route: POST /order distinguishes the three outcomes", () => {
  assert.deepEqual(routeViolations(routeBlock(ROUTE_SOURCE, "/order")), []);
});

test("route: the pre-fix order handler is rejected", () => {
  const preFix = `router.post("/order", async (req, res) => {
  const { symbol } = req.body;

  if (!symbol) {
    return res.status(400).json({ success: false });
  }

  const target = resolveOrderSymbolTarget({ symbols: getAvailableSymbols(), symbol });

  if (!target.ok) {
    return res.status(409).json({ success: false });
  }

  const result = await placeMarketOrder({ symbol: target.symbolId });

  return res.json(result);
});`;

  assert.deepEqual(routeViolations(preFix), [
    "a confirmed order is the only accepted outcome",
    "a broker rejection is not a 200",
    "an unconfirmed order is a gateway timeout",
    "an outcome the route does not recognise is never a success",
    "success is read from the outcome, not from silence",
  ]);
});

test("route: answering an unconfirmed order with 200 is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/order");

  const collapsed = block.replace(
    /result\.status === "unconfirmed"\s*\?\s*504/,
    'result.status === "unconfirmed"\n            ? 200'
  );

  assert.notEqual(collapsed, block, "anchor must exist");
  assert.ok(
    routeViolations(collapsed).includes("an unconfirmed order is a gateway timeout"),
    "a timeout must not answer 200"
  );
});

test("route: inferring success from the absence of an error is rejected", () => {
  const block = routeBlock(ROUTE_SOURCE, "/order");

  const inferred = block.replace(
    /success:\s*result\.status === "accepted"/,
    "success: true"
  );

  assert.notEqual(inferred, block, "anchor must exist");
  assert.ok(
    routeViolations(inferred).includes("success is read from the outcome, not from silence"),
    "a literal success must be rejected"
  );
});

/* ============================================================
   STATUS HONESTY — claims must match what is proven
   ============================================================ */

function limitationLines(source) {
  const start = source.indexOf("const limitations = [");

  assert.notEqual(start, -1, "the ctrader adapter must declare its limitations");

  const end = source.indexOf("];", start);

  return source.slice(start, end);
}

test("status: market order confirmation is disclosed as unproven", () => {
  const lines = limitationLines(ADAPTER_SOURCE);

  assert.match(
    lines,
    /unconfirmed/,
    "the correlation assumption must be disclosed"
  );
  assert.match(
    lines,
    /client order id|clientOrderId/,
    "the disclosed mechanism must be named"
  );
});

test("status: send-time success stays disclosed for the untouched paths", () => {
  const lines = limitationLines(ADAPTER_SOURCE);

  assert.match(lines, /send time/, "close and amend still report success at send time");
  assert.match(lines, /amend/i, "the amend path's status must be disclosed");
});

test("status: marketOrders and closePosition capabilities stay disabled", () => {
  const capabilities = sectionOf(ADAPTER_SOURCE, "capabilities: {");

  assert.match(capabilities, /marketOrders:\s*false/);
  assert.match(capabilities, /closePosition:\s*false/);
});

test("status: an enabled marketOrders claim is rejected", () => {
  const flipped = ADAPTER_SOURCE.replace("marketOrders: false", "marketOrders: true");

  assert.notEqual(flipped, ADAPTER_SOURCE, "anchor must exist");
  assert.match(
    sectionOf(flipped, "capabilities: {"),
    /marketOrders:\s*true/,
    "the mutant must actually flip the flag"
  );
});

/* ============================================================
   BEHAVIOURAL MUTATION TABLE

   The classifier and the registry are pure enough to rebuild in
   memory from their own source, so each mutant below is a real
   alternative implementation that must be caught by the checks.

   Two tempting mutants are deliberately absent because they are
   behaviourally equivalent, not weak tests: dropping the
   `orderConfirmationWaiters.has(key)` guard, and dropping
   `if (!summary.matched)`, both end at the same answers since the
   key handed to the classifier is always read from the frame.
   ============================================================ */

const CONFIRMATION_START = "const CLIENT_ORDER_ID_FIELDS = [";
const CONFIRMATION_END = "// MANUAL REFRESH POSITIONS";

const CONFIRMATION_SOURCE = SERVICE_SOURCE.slice(
  SERVICE_SOURCE.indexOf(CONFIRMATION_START),
  SERVICE_SOURCE.indexOf(CONFIRMATION_END)
);

function buildConfirmationModule(source, waiters) {
  assert.notEqual(SERVICE_SOURCE.indexOf(CONFIRMATION_START), -1, CONFIRMATION_START);
  assert.ok(
    CONFIRMATION_SOURCE.includes("export function clearOrderConfirmationWaiters"),
    "the confirmation section must be self-contained"
  );

  return new Function(
    "orderConfirmationWaiters",
    "ORDER_CONFIRMATION_TIMEOUT_MS",
    `${source.replace(/\bexport /g, "")}

     return {
       summarizeOrderExecution,
       waitForOrderConfirmation,
       recordBrokerOrderFrame,
       clearOrderConfirmationWaiters,
     };`
  )(waiters, 10000);
}

async function withDeadline(promise) {
  let timer = null;

  const answer = await Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve("__pending__"), 1000);
    }),
  ]);

  clearTimeout(timer);

  assert.notEqual(answer, "__pending__", "a confirmation must always settle");

  return answer;
}

async function confirmationBehaviours(mod) {
  const failures = [];

  const check = async (name, fn) => {
    try {
      if ((await fn()) !== true) {
        failures.push(name);
      }
    } catch {
      failures.push(name);
    }
  };

  const S = mod.summarizeOrderExecution;

  await check("attributes-a-matching-frame", async () => {
    const result = S({
      kind: "execution",
      frame: executionFrame({ orderId: int64("88101"), price: 1.16543 }),
      clientOrderId: "edgeflo-order-1",
    });

    return (
      result.matched === true &&
      result.status === "accepted" &&
      result.orderId === "88101" &&
      result.price === 1.16543
    );
  });

  await check("refuses-a-foreign-frame", async () => {
    const result = S({
      kind: "execution",
      frame: executionFrame({ clientId: "edgeflo-other" }),
      clientOrderId: "edgeflo-order-1",
    });

    return result.matched === false && result.status === undefined;
  });

  await check("refuses-an-unattributed-frame", async () =>
    [
      {},
      { orderId: int64("1") },
      { clientId: "" },
      { clientId: null },
      null,
      "execution",
    ].every(
      (frame) =>
        S({ kind: "execution", frame, clientOrderId: "edgeflo-order-1" })
          .matched === false
    )
  );

  await check("requires-our-own-id", async () =>
    [undefined, null, "", "   "].every(
      (clientOrderId) =>
        S({
          kind: "execution",
          frame: executionFrame(),
          clientOrderId,
        }).code === "client_order_id_missing"
    )
  );

  await check("reads-a-nested-entry", async () => {
    const result = S({
      kind: "execution",
      frame: { execution: { clientId: "edgeflo-order-2", positionId: int64("7700") } },
      clientOrderId: "edgeflo-order-2",
    });

    return result.matched === true && result.positionId === "7700";
  });

  await check("hides-protobuf-zero-defaults", async () => {
    const result = S({
      kind: "execution",
      frame: executionFrame({
        orderId: int64("0"),
        positionId: int64("0"),
        symbolId: int64("0"),
        price: 0,
        volume: 0,
      }),
      clientOrderId: "edgeflo-order-1",
    });

    return ["orderId", "positionId", "symbolId", "price", "volume"].every(
      (field) => result[field] === null
    );
  });

  await check("refuses-object-ids", async () => {
    const result = S({
      kind: "execution",
      frame: executionFrame({ orderId: { nested: true } }),
      clientOrderId: "edgeflo-order-1",
    });

    return result.matched === true && result.orderId === null;
  });

  await check("orders-the-brokers-reason", async () => {
    const first = S({
      kind: "error",
      frame: executionFrame({ description: "first", errorDescription: "second", errorCode: 9 }),
      clientOrderId: "edgeflo-order-1",
    }).message;

    const second = S({
      kind: "error",
      frame: executionFrame({ errorDescription: "second", errorCode: 9 }),
      clientOrderId: "edgeflo-order-1",
    }).message;

    const code = S({
      kind: "error",
      frame: executionFrame({ errorCode: 9 }),
      clientOrderId: "edgeflo-order-1",
    }).message;

    const generic = S({
      kind: "error",
      frame: executionFrame({ errorCode: 0 }),
      clientOrderId: "edgeflo-order-1",
    }).message;

    return (
      first === "first" &&
      second === "second" &&
      code === "9" &&
      typeof generic === "string" &&
      generic.length > 0 &&
      generic !== "0" &&
      !/margin|price|limit|invalid/i.test(generic)
    );
  });

  await check("leaves-the-frame-untouched", async () => {
    const frame = executionFrame({ orderId: "41", position: { positionId: "42" } });
    const snapshot = JSON.stringify(frame);

    S({ kind: "execution", frame, clientOrderId: "edgeflo-order-1" });

    return JSON.stringify(frame) === snapshot;
  });

  await check("settles-on-a-matching-frame", async () => {
    const timers = fakeTimers();

    const pending = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-1",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    const settled = mod.recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "m-order-1", orderId: int64("88101") })
    );

    const outcome = await withDeadline(pending);

    return (
      settled === true &&
      outcome.status === "accepted" &&
      outcome.confirmed === true &&
      outcome.success === true &&
      outcome.orderId === "88101" &&
      timers.scheduled.length === 1 &&
      timers.cleared.length === 1
    );
  });

  await check("elapsed-window-is-never-success", async () => {
    const timers = fakeTimers();

    const pending = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-2",
      timeoutMs: 10000,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    assert.equal(timers.scheduled[0].ms, 10000);

    timers.scheduled[0].callback();

    const outcome = await withDeadline(pending);

    return (
      outcome.status === "unconfirmed" &&
      outcome.confirmed === false &&
      outcome.success === false &&
      typeof outcome.message === "string" &&
      outcome.message.length > 0
    );
  });

  await check("settles-each-order-separately", async () => {
    const timers = fakeTimers();

    const first = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-A",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    const second = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-B",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    mod.recordBrokerOrderFrame("error", {
      clientId: "m-order-B",
      description: "Rejected for B",
    });

    timers.scheduled[0].callback();

    const [a, b] = await Promise.all([withDeadline(first), withDeadline(second)]);

    return (
      a.status === "unconfirmed" &&
      b.status === "rejected" &&
      b.confirmed === false &&
      b.message === "Rejected for B"
    );
  });

  await check("ignores-frames-for-no-waiter", async () =>
    (
      [
        ["execution", executionFrame({ clientId: "m-order-unknown" })],
        ["execution", {}],
        ["error", null],
      ].every(([kind, frame]) => mod.recordBrokerOrderFrame(kind, frame) === false)
    )
  );

  await check("resolves-once-and-forgets", async () => {
    const timers = fakeTimers();

    const pending = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-3",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    const first = mod.recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "m-order-3", orderId: int64("1") })
    );

    const again = mod.recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "m-order-3", orderId: int64("2") })
    );

    const late = (() => {
      const other = fakeTimers();

      const waiting = mod.waitForOrderConfirmation({
        clientOrderId: "m-order-4",
        setTimeoutFn: other.setTimeoutFn,
        clearTimeoutFn: other.clearTimeoutFn,
      });

      other.scheduled[0].callback();

      return withDeadline(waiting).then(
        () =>
          mod.recordBrokerOrderFrame(
            "execution",
            executionFrame({ clientId: "m-order-4" })
          )
      );
    });

    const ignored = await late();

    const outcome = await withDeadline(pending);

    return first === true && again === false && ignored === false && outcome.orderId === "1";
  });

  await check("clearing-empties-the-registry", async () => {
    const timers = fakeTimers();

    const pending = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-5",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    mod.clearOrderConfirmationWaiters();

    const outcome = await withDeadline(pending);

    return (
      outcome.status === "unconfirmed" &&
      outcome.success === false &&
      timers.cleared.length === 1 &&
      mod.recordBrokerOrderFrame(
        "execution",
        executionFrame({ clientId: "m-order-5" })
      ) === false
    );
  });

  await check("never-orphans-a-repeat-id", async () => {
    const timers = fakeTimers();

    const first = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-6",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    const second = mod.waitForOrderConfirmation({
      clientOrderId: "m-order-6",
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });

    mod.recordBrokerOrderFrame(
      "execution",
      executionFrame({ clientId: "m-order-6", orderId: int64("55") })
    );

    const [a, b] = await Promise.all([withDeadline(first), withDeadline(second)]);

    return a.status === "accepted" && b.status === "accepted";
  });

  return failures;
}

const CONFIRMATION_MUTANTS = [
  {
    label: "attributes any frame that arrives",
    from: "if (observed !== expected) {",
    to: "if (false) {",
  },
  {
    label: "reports the protobuf zero default as an id",
    from: 'text === "[object Object]" || text === "0"',
    to: 'text === "[object Object]"',
  },
  {
    label: "reports a zero price and volume",
    from: "return number === 0 ? null : number;",
    to: "return number;",
  },
  {
    label: "reads only the flat frame",
    from: "for (const candidate of [frame, frame?.execution]) {",
    to: "for (const candidate of [frame]) {",
  },
  {
    label: "treats any present field as a reason",
    from: "    if (value) {",
    to: "    if (value !== undefined) {",
  },
  {
    label: "forgets to forget a settled order",
    from: "  orderConfirmationWaiters.delete(key);\n\n",
    to: "",
  },
  {
    label: "leaks the armed timer",
    from: "      clearTimer &&",
    to: "      false &&",
  },
  {
    label: "claims success when the window elapses",
    from: "    success: false,\n\n    code,",
    to: "    success: true,\n\n    code,",
  },
  {
    label: "claims confirmation for any settled outcome",
    from: "    confirmed: summary.status === \"accepted\",",
    to: "    confirmed: true,",
  },
  {
    label: "overwrites an earlier waiter for the same id",
    from: "  const waiters =\n    orderConfirmationWaiters.get(key) ?? new Set();",
    to: "  const waiters = new Set();",
  },
];

test("behaviour: the classifier and registry pass a mutation table", async () => {
  const baseline = buildConfirmationModule(CONFIRMATION_SOURCE, new Map());

  assert.deepEqual(
    await confirmationBehaviours(baseline),
    [],
    "the unmutated section must satisfy every behavioural check"
  );

  const undetected = [];

  for (const { label, from, to } of CONFIRMATION_MUTANTS) {
    assert.equal(
      CONFIRMATION_SOURCE.split(from).length - 1,
      1,
      `mutant ${label} must have exactly one anchor`
    );

    let failures;

    try {
      failures = await confirmationBehaviours(
        buildConfirmationModule(CONFIRMATION_SOURCE.replace(from, to), new Map())
      );
    } catch (error) {
      undetected.push(`${label} (invalid mutant: ${error.message})`);
      continue;
    }

    if (failures.length === 0) {
      undetected.push(label);
    }
  }

  assert.deepEqual(undetected, [], "every mutant must be caught");
});
