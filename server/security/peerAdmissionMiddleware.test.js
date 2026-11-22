// ============================================================
// PEER ADMISSION MIDDLEWARE (Bootstrap Task 3)
// ============================================================
//
// Covers server/security/peerAdmissionMiddleware.js: resolveAllowlist()
// (the boot-time parse) and createPeerAdmissionMiddleware() (the guard).
//
// The guard's whole contract is one sentence: decide from the peer address
// the connection actually came from, and from nothing that the caller can
// write. A proxy header is caller-controlled text, so the tests below hand
// the guard requests whose headers contradict their own peer address in
// both directions - a spoofed header must not open the door, and must not
// close it either.
//
// The second half of the contract is what leaves the process: a refusal
// body and refusal log line must not carry an authorization code, a token,
// a client secret or the configured allowlist.
//
// LIMIT: these tests drive the guard with plain objects, not Express. They
// prove the decision, the 403 shape and the silence about secrets. They do
// not prove the mount chosen in server/index.js, that the running backend
// loaded this code, or that a real socket hands over an address in any
// particular spelling - and they do not resolve D-TAILNET: a remote tailnet
// peer routed through Tailscale Serve arrives as loopback and is admitted.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveAllowlist,
  createPeerAdmissionMiddleware,
} from "./peerAdmissionMiddleware.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ============================================================
   helpers
============================================================ */

function makeRes() {
  const sent = { statusCode: null, body: null, jsonCalls: 0 };

  const res = {
    status(code) {
      sent.statusCode = code;
      return res;
    },
    json(body) {
      sent.body = body;
      sent.jsonCalls += 1;
      return res;
    },
  };

  return { res, sent };
}

function makeReq(remoteAddress, headers = {}) {
  return {
    method: "POST",
    path: "/discover-accounts",
    url: "/discover-accounts?code=AUTH_CODE_FROM_BROKER&state=abc",
    socket: remoteAddress === undefined ? undefined : { remoteAddress },
    headers: {
      // Present so that any use of them by the guard is observable.
      "x-forwarded-for": "127.0.0.1",
      forwarded: 'for="127.0.0.1";by=proxy',
      "x-real-ip": "127.0.0.1",
      authorization: "Bearer opaque-token-value",
      cookie: "session=cookie-value",
      ...headers,
    },
  };
}

function guardWithLog(allowlist) {
  const logLines = [];

  return {
    guard: createPeerAdmissionMiddleware({
      allowlist,
      log: (line) => logLines.push(line),
    }),
    logLines,
  };
}

/* ============================================================
   resolveAllowlist - the boot-time decision
============================================================ */

test("an unset allowlist is a valid empty list", () => {
  const verdict = resolveAllowlist(undefined);

  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.entries, []);
});

test("a blank allowlist is a valid empty list, not a parse failure", () => {
  for (const value of ["", "   ", "\t"]) {
    const verdict = resolveAllowlist(value);

    assert.equal(verdict.ok, true, `${JSON.stringify(value)} was refused`);
    assert.deepEqual(verdict.entries, []);
  }
});

test("a valid allowlist becomes the entries the guard receives", () => {
  const verdict = resolveAllowlist("100.83.79.109, 192.168.1.50");

  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.entries, ["100.83.79.109", "192.168.1.50"]);
});

test("a range in the allowlist is refused, not expanded", () => {
  const verdict = resolveAllowlist("100.64.0.0/10");

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "ranges_not_supported");
  assert.equal(verdict.entry, "100.64.0.0/10");
  assert.equal(verdict.entries, undefined);
});

test("a duplicate in the allowlist is refused, not collapsed", () => {
  const verdict = resolveAllowlist("1.2.3.4,1.2.3.4");

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "duplicate_entry");
});

test("a keyword in the allowlist is refused, not substituted", () => {
  const verdict = resolveAllowlist("tailscale");

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "ranges_not_supported");
});

test("a non-string allowlist is refused instead of coerced", () => {
  for (const value of [42, true, {}, [], ["1.2.3.4"]]) {
    const verdict = resolveAllowlist(value);

    assert.equal(verdict.ok, false, `${String(value)} was accepted`);
    assert.equal(verdict.code, "not_a_string");
  }
});

test("every refusal explains itself in one readable line", () => {
  const verdict = resolveAllowlist("010.0.0.1");

  assert.equal(verdict.ok, false);
  assert.equal(typeof verdict.detail, "string");
  assert.ok(
    verdict.detail.includes("010.0.0.1"),
    `the refusal did not name the entry: ${verdict.detail}`,
  );
});

test("resolveAllowlist never invents a peer when the list is absent", () => {
  const verdict = resolveAllowlist(undefined);

  assert.deepEqual(verdict.entries, []);
  assert.equal(verdict.entries.includes("127.0.0.1"), false);
});

test("the validated entries cannot be widened after the boot", () => {
  const verdict = resolveAllowlist("100.83.79.109");

  assert.equal(verdict.ok, true);
  assert.ok(Object.isFrozen(verdict.entries));
  assert.equal(verdict.entries.length, 1);
});

/* ============================================================
   the guard - one input, the peer address
============================================================ */

test("admits an IPv4 loopback peer and continues the chain", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("127.0.0.1"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(sent.statusCode, null);
  assert.equal(sent.jsonCalls, 0);
});

test("admits an IPv6 loopback peer", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("::1"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(sent.statusCode, null);
});

test("admits a dual-stack spelling of loopback", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("::ffff:127.0.0.1"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(sent.statusCode, null);
});

test("refuses a LAN peer with 403 and never continues the chain", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("192.168.1.11"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 0, "a refused peer was handed to the router");
  assert.equal(sent.statusCode, 403);
  assert.equal(sent.jsonCalls, 1);
});

test("refuses a tailnet peer that no entry names", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("100.83.79.109"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 0);
  assert.equal(sent.statusCode, 403);
});

test("admits a tailnet peer only when that exact address is listed", () => {
  const listed = guardWithLog(["100.83.79.109"]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  listed.guard(makeReq("100.83.79.109"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(sent.statusCode, null);

  const other = makeRes();
  let refusedNextCalls = 0;

  listed.guard(
    makeReq("100.83.79.110"),
    other.res,
    () => {
      refusedNextCalls += 1;
    },
  );

  assert.equal(refusedNextCalls, 0, "a neighbouring address was admitted");
  assert.equal(other.sent.statusCode, 403);
});

test("admits the mapped spelling of a listed peer", () => {
  const { guard } = guardWithLog(["100.83.79.109"]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("::ffff:100.83.79.109"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(sent.statusCode, null);
});

test("a spoofed forwarding header cannot admit a refused peer", () => {
  const { guard } = guardWithLog(["100.83.79.109"]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(
    makeReq("8.8.8.8", {
      "x-forwarded-for": "127.0.0.1",
      "x-real-ip": "::1",
      forwarded: 'for="127.0.0.1"',
    }),
    res,
    () => {
      nextCalls += 1;
    },
  );

  assert.equal(nextCalls, 0, "a header opened the door");
  assert.equal(sent.statusCode, 403);
});

test("a spoofed forwarding header cannot admit a listed remote peer either", () => {
  const { guard } = guardWithLog(["100.83.79.109"]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(
    makeReq("8.8.8.8", { "x-forwarded-for": "100.83.79.109" }),
    res,
    () => {
      nextCalls += 1;
    },
  );

  assert.equal(nextCalls, 0);
  assert.equal(sent.statusCode, 403);
});

test("a header claiming a remote address cannot revoke a loopback peer", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(
    makeReq("::1", { "x-forwarded-for": "8.8.8.8, 1.2.3.4" }),
    res,
    () => {
      nextCalls += 1;
    },
  );

  assert.equal(nextCalls, 1, "a header closed the door on the local browser");
  assert.equal(sent.statusCode, null);
});

test("refuses a peer address that cannot be understood", () => {
  for (const value of ["", "not-an-ip", "fe80::1%11", "0:0:0:0:0:0:0:1"]) {
    const { guard } = guardWithLog([]);
    const { res, sent } = makeRes();
    let nextCalls = 0;

    guard(makeReq(value), res, () => {
      nextCalls += 1;
    });

    assert.equal(nextCalls, 0, `${value} was admitted`);
    assert.equal(sent.statusCode, 403, value);
  }
});

test("refuses a request with no socket at all", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  const req = makeReq("127.0.0.1");
  delete req.socket;

  guard(req, res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 0);
  assert.equal(sent.statusCode, 403);
});

test("fails closed when the allowlist handed to the guard is unusable", () => {
  for (const value of ["127.0.0.1", null, {}, 42]) {
    const guard = createPeerAdmissionMiddleware({ allowlist: value });
    const { res, sent } = makeRes();
    let nextCalls = 0;

    guard(makeReq("127.0.0.1"), res, () => {
      nextCalls += 1;
    });

    assert.equal(nextCalls, 0, `a broken allowlist admitted loopback`);
    assert.equal(sent.statusCode, 403, String(value));
  }
});

test("admits loopback when no allowlist is passed at all", () => {
  const guard = createPeerAdmissionMiddleware();
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("127.0.0.1"), res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(sent.statusCode, null);
});

/* ============================================================
   what a refusal says
============================================================ */

test("the refusal body is the documented shape", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();

  guard(makeReq("192.168.1.11"), res, () => {});

  assert.equal(sent.body.success, false);
  assert.equal(sent.body.code, "peer_not_admitted");
  assert.equal(typeof sent.body.reason, "string");
  assert.equal(typeof sent.body.message, "string");
});

test("the refusal body carries no credential and no configuration", () => {
  const { guard } = guardWithLog(["100.83.79.109"]);
  const { res, sent } = makeRes();

  guard(makeReq("192.168.1.11"), res, () => {});

  const body = JSON.stringify(sent.body);

  for (const forbidden of [
    "100.83.79.109",
    "opaque-token-value",
    "cookie-value",
    "AUTH_CODE_FROM_BROKER",
    "accessToken",
    "refreshToken",
    "clientSecret",
    "allowlist",
  ]) {
    assert.equal(
      body.includes(forbidden),
      false,
      `the refusal body exposed ${forbidden}`,
    );
  }
});

test("the refusal log names the peer and reason but no secret", () => {
  const { guard, logLines } = guardWithLog(["100.83.79.109"]);
  const { res } = makeRes();

  guard(makeReq("192.168.1.11"), res, () => {});

  assert.equal(logLines.length, 1, "the refusal was not logged once");

  const logged = logLines.join("\n");

  assert.ok(logged.includes("192.168.1.11"), logged);
  assert.ok(logged.includes("peer_not_admitted"), logged);

  for (const forbidden of [
    "100.83.79.109",
    "opaque-token-value",
    "cookie-value",
    "AUTH_CODE_FROM_BROKER",
    "abc",
    "Bearer",
  ]) {
    assert.equal(
      logged.includes(forbidden),
      false,
      `the refusal log leaked ${forbidden}`,
    );
  }
});

test("the refusal log never prints a query string", () => {
  const { guard, logLines } = guardWithLog([]);
  const { res } = makeRes();

  guard(makeReq("8.8.8.8"), res, () => {});

  assert.equal(logLines.join("\n").includes("code="), false);
  assert.equal(logLines.join("\n").includes("state="), false);
});

test("an admitted peer is not logged", () => {
  const { guard, logLines } = guardWithLog([]);
  const { res } = makeRes();

  guard(makeReq("127.0.0.1"), res, () => {});

  assert.deepEqual(logLines, []);
});

/* ============================================================
   the guard stays inside its own input
============================================================ */

test("the guard reads the peer address and no request field that lies", () => {
  const source = fs
    .readFileSync(path.join(HERE, "peerAdmissionMiddleware.js"), "utf8")
    .replace(/\r\n/g, "\n")
    .toLowerCase();

  const forbidden = [
    ["x-forwarded-for", "the forwarded-for header"],
    ["x-real-ip", "the real-ip header"],
    ["forwarded:", "the forwarded header"],
    ["req.ip", "express proxy-resolved ip"],
    ["req.ips", "express proxy-resolved ips"],
    ["trust proxy", "a trust-proxy setting"],
    ["remoteport", "the peer port"],
    [".headers", "request headers"],
    ["node:fs", "the filesystem"],
    ["node:http", "an http client"],
    ["node:net", "a raw transport"],
    ["process.", "the environment"],
    ["date.now", "the clock"],
    ["math.random", "randomness"],
  ];

  for (const [needle, label] of forbidden) {
    assert.equal(
      source.includes(needle),
      false,
      `peerAdmissionMiddleware.js touches ${label}`,
    );
  }

  assert.ok(
    source.includes("req.socket.remoteaddress"),
    "the guard must read the socket peer address",
  );
});

test("the guard sends at most one response", () => {
  const { guard } = guardWithLog([]);
  const { res, sent } = makeRes();
  let nextCalls = 0;

  guard(makeReq("10.0.0.9"), res, () => {
    nextCalls += 1;
  });

  assert.equal(sent.jsonCalls, 1);
  assert.equal(nextCalls, 0);
});
