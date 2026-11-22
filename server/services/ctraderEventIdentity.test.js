import test from "node:test";
import assert from "node:assert/strict";

const {
  authenticatedAccountIdForEvent,
  buildExecutionBroadcastMessage,
} = await import("./ctraderService.js");

test("only a connected, authenticated and ready session identifies event positions", () => {
  assert.equal(typeof authenticatedAccountIdForEvent, "function");

  const ready = {
    connected: true,
    authenticated: true,
    ready: true,
    accountId: 77001122,
  };

  assert.equal(authenticatedAccountIdForEvent(ready), "77001122");
  assert.equal(
    authenticatedAccountIdForEvent({ ...ready, connected: false }),
    null
  );
  assert.equal(
    authenticatedAccountIdForEvent({ ...ready, authenticated: false }),
    null
  );
  assert.equal(
    authenticatedAccountIdForEvent({ ...ready, ready: false }),
    null
  );
  assert.equal(
    authenticatedAccountIdForEvent({ ...ready, accountId: null }),
    null
  );
});

test("the broadcast envelope uses event identity and preserves reconciliation positions", () => {
  assert.equal(typeof buildExecutionBroadcastMessage, "function");

  const positions = [{ positionId: "position-1" }];
  const message = buildExecutionBroadcastMessage(
    {
      type: "positions_update",
      accountId: "77001122",
      reason: "reconcile",
      positions,
      timestamp: 123,
    },
    456
  );

  assert.equal(message.accountId, "77001122");
  assert.equal(message.type, "positions_update");
  assert.equal(message.timestamp, 456);
  assert.deepEqual(message.data.positions, positions);
  assert.equal(message.data.reason, "reconcile");
});

test("an account-less execution cannot borrow a cached account and keeps sibling positions", () => {
  assert.equal(typeof buildExecutionBroadcastMessage, "function");

  const execution = { position: { positionId: "position-2" } };
  const positions = [execution.position];
  const message = buildExecutionBroadcastMessage(
    {
      type: "execution",
      data: execution,
      positions,
    },
    789
  );

  assert.equal(message.accountId, null);
  assert.equal(message.data.position, execution.position);
  assert.deepEqual(message.data.positions, positions);
});
