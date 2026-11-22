// ============================================================
// PEER ADMISSION (Bootstrap Task 2) - pure rule, no transport
// ============================================================
//
// Covers server/security/peerAdmission.js: normalizePeer(), parseAllowlist()
// and isAdmittedPeer().
//
// WHY THIS EXISTS
// The backend today listens on the unspecified address, so anything on the
// Wi-Fi network can open a socket to it, while Tailscale Serve re-originates
// remote tailnet traffic from 127.0.0.1. Those two facts have opposite
// consequences for a socket-address rule, and the tests below are what keep
// the rule honest about both:
//   - a non-loopback socket must be refused unless it is named exactly, and
//   - the rule must never pretend to decide anything about a peer whose
//     address arrives already normalised to loopback.
// Trusting a /10 or a keyword would silently admit every device enrolled in
// the tailnet, so range membership is not consulted at all - the whole
// 100.64.0.0/10 block is refused unless a specific address is listed.
//
// Forwarding headers are deliberately absent from this module's vocabulary:
// an input the module cannot read is an input it cannot be fooled by.
//
// LIMIT: this proves the decision a pure function makes for a given string.
// It does not prove that the running server hands over that string, that any
// middleware exists yet, or that the live bind is loopback-only. Task 3 owns
// those, and the tailnet reachability questions stay open.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  LOOPBACK_PEERS,
  normalizePeer,
  parseAllowlist,
  isAdmittedPeer,
} from "./peerAdmission.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ============================================================
   normalizePeer - one spelling for one socket
============================================================ */

test("normalises an IPv4 loopback peer to itself", () => {
  assert.equal(normalizePeer("127.0.0.1"), "127.0.0.1");
});

test("normalises an IPv6 loopback peer to its canonical spelling", () => {
  assert.equal(normalizePeer("::1"), "::1");
});

test("strips one IPv4-mapped prefix so a dual-stack socket compares as IPv4", () => {
  assert.equal(normalizePeer("::ffff:127.0.0.1"), "127.0.0.1");
});

test("strips the IPv4-mapped prefix of a non-loopback peer too", () => {
  assert.equal(normalizePeer("::ffff:100.83.79.109"), "100.83.79.109");
});

test("strips an upper-case IPv4-mapped prefix", () => {
  assert.equal(normalizePeer("::FFFF:192.168.1.50"), "192.168.1.50");
});

test("refuses a scoped IPv6 peer rather than guessing an interface", () => {
  assert.equal(normalizePeer("fe80::1%11"), null);
});

test("refuses the expanded IPv6 spelling of loopback instead of normalising it", () => {
  // Admitting this spelling would require full IPv6 canonicalisation, which
  // is a wider decision than the two loopback forms actually observed.
  assert.equal(normalizePeer("0:0:0:0:0:0:0:1"), null);
});

test("refuses a peer that is not a string", () => {
  for (const value of [undefined, null, 42, true, [], {}, ["127.0.0.1"]]) {
    assert.equal(normalizePeer(value), null, `peer ${String(value)}`);
  }
});

test("refuses an empty peer and one carrying whitespace", () => {
  for (const value of ["", " ", "  ", "127. 0.0.1", " 127.0.0.1", "127.0.0.1\t"]) {
    assert.equal(normalizePeer(value), null, `peer "${value}"`);
  }
});

test("refuses a peer that is not a canonical address", () => {
  for (const value of [
    "localhost",
    "example.com",
    "127.0.0",
    "127.1",
    "127.0.0.1.2",
    "256.0.0.1",
    "127.0.0.-1",
    "010.0.0.1",
    "127.0.0.01",
    "2130706433",
    "0x7f.0.0.1",
    "::",
    "::ffff:",
    "::ffff::1",
    "::ffff:1.2.3",
  ]) {
    assert.equal(normalizePeer(value), null, `peer ${value}`);
  }
});

test("keeps ordinary IPv4 peers in their canonical spelling", () => {
  assert.equal(normalizePeer("100.83.79.109"), "100.83.79.109");
  assert.equal(normalizePeer("10.0.0.5"), "10.0.0.5");
  assert.equal(normalizePeer("255.255.255.255"), "255.255.255.255");
});

/* ============================================================
   parseAllowlist - exact IPv4 literals, or nothing
============================================================ */

test("treats an absent list as loopback only", () => {
  for (const value of [undefined, null]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, true, `absent ${String(value)}`);
    assert.deepEqual(result.entries, []);
  }
});

test("treats an empty or whitespace-only list as loopback only", () => {
  for (const value of ["", " ", "   ", "\t", "\n"]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, true, `blank ${JSON.stringify(value)}`);
    assert.deepEqual(result.entries, []);
  }
});

test("accepts canonical IPv4 entries and trims outer spaces", () => {
  const result = parseAllowlist("100.83.79.109, 192.168.1.50 ,0.0.0.0");

  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, ["100.83.79.109", "192.168.1.50", "0.0.0.0"]);
});

test("keeps a redundant loopback entry instead of silently dropping it", () => {
  const result = parseAllowlist("127.0.0.1");

  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, ["127.0.0.1"]);
});

test("rejects an entry that carries a port", () => {
  const result = parseAllowlist("1.2.3.4:4000");

  assert.equal(result.ok, false);
  assert.equal(result.code, "port_suffix_not_allowed");
  assert.equal(result.entry, "1.2.3.4:4000");
});

test("rejects a CIDR entry instead of expanding it", () => {
  for (const value of ["1.2.3.0/24", "100.64.0.0/10", "0.0.0.0/0"]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "ranges_not_supported", value);
    assert.equal(result.entry, value);
  }
});

test("rejects the keywords that would stand for a whole group", () => {
  for (const value of ["tailscale", "TAILSCALE", "any", "all", "*", "*.*.*.*"]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "ranges_not_supported", value);
  }
});

test("rejects an IPv6 entry because only IPv4 peers may be listed", () => {
  for (const value of [
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "fe80::1%11",
    "2001:db8::1",
    "[::1]:443",
  ]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "ipv6_not_supported_use_ipv4", value);
    assert.equal(result.entry, value);
  }
});

test("rejects a hostname entry as not a canonical IPv4 address", () => {
  for (const value of ["laptop.local", "desktop-vlh0aej", "localhost"]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "not_canonical_ipv4", value);
  }
});

test("rejects short, out-of-range and non-decimal IPv4 forms", () => {
  for (const value of [
    "1.2.3",
    "1.2.3.4.5",
    "256.0.0.1",
    "1.2.3.-4",
    "127.1",
    "2130706433",
    "0x7f.0.0.1",
    "010.0.0.1",
    "1.2.3.04",
    "1.2. 3.4",
    "1..2.3",
    ".1.2.3",
  ]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "not_canonical_ipv4", value);
    assert.equal(result.entry, value);
  }
});

test("rejects an empty entry from a doubled, leading or trailing comma", () => {
  for (const value of ["1.2.3.4,,5.6.7.8", "1.2.3.4,", ",1.2.3.4", ","]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "empty_entry", value);
  }
});

test("rejects a duplicate entry instead of masking the second one", () => {
  for (const value of ["1.2.3.4,1.2.3.4", "1.2.3.4, 1.2.3.4"]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${value} was accepted`);
    assert.equal(result.code, "duplicate_entry", value);
    assert.equal(result.entry, "1.2.3.4");
  }
});

test("refuses the whole list when one entry is bad", () => {
  const result = parseAllowlist("100.83.79.109,tailscale,192.168.1.50");

  assert.equal(result.ok, false);
  assert.equal(result.code, "ranges_not_supported");
  assert.equal(result.entry, "tailscale");
  assert.equal(result.entries, undefined);
});

test("names the offending entry and the rule in every refusal", () => {
  const result = parseAllowlist("1.2.3.0/24");

  assert.equal(result.ok, false);
  assert.equal(typeof result.detail, "string");
  assert.ok(result.detail.length > 0);
  assert.ok(result.detail.includes("1.2.3.0/24"));
});

test("rejects a non-string list value", () => {
  for (const value of [42, true, {}, [], ["1.2.3.4"]]) {
    const result = parseAllowlist(value);

    assert.equal(result.ok, false, `${String(value)} was accepted`);
    assert.equal(result.code, "not_a_string");
  }
});

/* ============================================================
   isAdmittedPeer - the decision, from a socket address alone
============================================================ */

test("admits the loopback peer over IPv4", () => {
  const result = isAdmittedPeer({ remoteAddress: "127.0.0.1" });

  assert.equal(result.admitted, true);
  assert.equal(result.normalized, "127.0.0.1");
  assert.equal(result.reason, "loopback");
});

test("admits the loopback peer over IPv6", () => {
  const result = isAdmittedPeer({ remoteAddress: "::1" });

  assert.equal(result.admitted, true);
  assert.equal(result.reason, "loopback");
});

test("admits an IPv4-mapped loopback peer as loopback", () => {
  const result = isAdmittedPeer({ remoteAddress: "::ffff:127.0.0.1" });

  assert.equal(result.admitted, true);
  assert.equal(result.normalized, "127.0.0.1");
  assert.equal(result.reason, "loopback");
});

test("admits only the two loopback spellings, not the whole block", () => {
  for (const value of ["127.0.0.2", "127.0.1.1", "::ffff:127.0.0.2"]) {
    const result = isAdmittedPeer({ remoteAddress: value });

    assert.equal(result.admitted, false, `${value} was admitted`);
    assert.equal(result.reason, "peer_not_admitted", value);
  }
});

test("admits an explicitly listed peer", () => {
  const result = isAdmittedPeer({
    remoteAddress: "100.83.79.109",
    allowlist: ["100.83.79.109"],
  });

  assert.equal(result.admitted, true);
  assert.equal(result.reason, "allowlist");
});

test("admits the mapped spelling of a listed peer", () => {
  const result = isAdmittedPeer({
    remoteAddress: "::ffff:100.83.79.109",
    allowlist: ["100.83.79.109"],
  });

  assert.equal(result.admitted, true);
  assert.equal(result.normalized, "100.83.79.109");
  assert.equal(result.reason, "allowlist");
});

test("refuses a non-loopback peer that was not listed", () => {
  const result = isAdmittedPeer({
    remoteAddress: "192.168.1.11",
    allowlist: ["100.83.79.109"],
  });

  assert.equal(result.admitted, false);
  assert.equal(result.reason, "peer_not_admitted");
});

test("refuses a peer inside the tailnet range that no entry names", () => {
  // This is the test that fails for anyone who implements range membership.
  for (const value of ["100.64.0.1", "100.100.100.100", "100.83.0.1"]) {
    const result = isAdmittedPeer({
      remoteAddress: value,
      allowlist: ["100.83.79.109"],
    });

    assert.equal(result.admitted, false, `${value} was admitted`);
    assert.equal(result.reason, "peer_not_admitted", value);
  }
});

test("never treats an entry as a pattern", () => {
  for (const entry of ["*", "1.2.3.*", "10.*.*.*", "1.2.", "prefix"]) {
    const result = isAdmittedPeer({
      remoteAddress: "1.2.3.4",
      allowlist: [entry],
    });

    assert.equal(result.admitted, false, `entry ${entry} matched`);
    assert.equal(result.reason, "peer_not_admitted", entry);
  }
});

test("treats the unspecified address as an ordinary peer, never a wildcard", () => {
  const unlisted = isAdmittedPeer({ remoteAddress: "0.0.0.0" });

  assert.equal(unlisted.admitted, false);
  assert.equal(unlisted.reason, "peer_not_admitted");

  const emptyList = isAdmittedPeer({
    remoteAddress: "8.8.8.8",
    allowlist: ["0.0.0.0"],
  });

  assert.equal(emptyList.admitted, false);
});

test("refuses a peer that cannot be normalised", () => {
  for (const value of [undefined, null, "", "not-an-ip", "fe80::1%11", 7]) {
    const result = isAdmittedPeer({ remoteAddress: value });

    assert.equal(result.admitted, false, `${String(value)} was admitted`);
    assert.equal(result.normalized, null);
    assert.equal(result.reason, "unrecognised_peer");
  }
});

test("refuses when the allowlist is not a usable array", () => {
  for (const value of ["127.0.0.1", null, {}, 42, new Set(["1.2.3.4"])]) {
    const result = isAdmittedPeer({
      remoteAddress: "10.0.0.5",
      allowlist: value,
    });

    assert.equal(result.admitted, false, `${String(value)} was used`);
    assert.equal(result.reason, "invalid_allowlist");
  }
});

test("defaults to loopback only when no allowlist is supplied", () => {
  assert.equal(isAdmittedPeer({ remoteAddress: "127.0.0.1" }).admitted, true);
  assert.equal(isAdmittedPeer({ remoteAddress: "10.0.0.5" }).admitted, false);
  assert.equal(
    isAdmittedPeer({ remoteAddress: "10.0.0.5", allowlist: undefined }).admitted,
    false,
  );
});

test("answers for every peer without reaching the loopback set", () => {
  const loopbackPeer = isAdmittedPeer({ remoteAddress: "::1" });

  assert.equal(loopbackPeer.normalized, LOOPBACK_PEERS[1]);
  assert.equal(
    isAdmittedPeer({ remoteAddress: "::ffff:127.0.0.1" }).normalized,
    LOOPBACK_PEERS[0],
  );
});

/* ============================================================
   The module stays pure
============================================================ */

test("exposes a frozen loopback set holding exactly the two spellings", () => {
  assert.ok(Object.isFrozen(LOOPBACK_PEERS));
  assert.deepEqual([...LOOPBACK_PEERS], ["127.0.0.1", "::1"]);
  assert.ok(!LOOPBACK_PEERS.includes("127.0.0.2"));
});

test("the module never reaches a transport, the clock or the environment", () => {
  const source = fs
    .readFileSync(path.join(HERE, "peerAdmission.js"), "utf8")
    .replace(/\r\n/g, "\n");

  const forbidden = [
    [/(^|\n)\s*import\b/, "an import"],
    [/node:/, "a built-in dependency"],
    [/require\s*\(/, "require()"],
    [/\bprocess\s*\./, "process"],
    [/\bsocket\b/, "a socket"],
    [/\b(req|res)\s*\./, "a request or response object"],
    [/\bheaders\b/, "request headers"],
    [/\bfetch\s*\(/, "fetch()"],
    [/\bDate\s*\.\s*now\b/, "the clock"],
    [/\bMath\s*\.\s*random\b/, "randomness"],
    [/\bnew\s+Set\s*\(\s*[a-z]/, "an unbounded cache"],
  ];

  for (const [pattern, label] of forbidden) {
    assert.equal(
      pattern.test(source),
      false,
      `peerAdmission.js must not use ${label}`,
    );
  }
});
