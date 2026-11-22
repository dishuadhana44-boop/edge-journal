// ============================================================
// PEER ADMISSION - the pure rule behind the cTrader route guard
// ============================================================
//
// Three decisions, made only from a peer address string and a list of
// exact IPv4 literals:
//   normalizePeer()  - one spelling per address, or null
//   parseAllowlist() - accept exact IPv4 entries, or refuse the whole list
//   isAdmittedPeer() - loopback, or a listed address, or refusal
//
// No range, no keyword, no group and no pattern is ever expanded: a listed
// address matches one peer and nothing else. Two loopback spellings are
// admitted by default, so the safe configuration is an empty list.
//
// The reason a peer address is the only admitted input is recorded in the
// test file, together with the limits of what these functions can prove.

const LOOPBACK_V6 = "::1";
const MAPPED_V4_PREFIX = "::ffff:";

const CANONICAL_IPV4 =
  /^(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/;

const IPV4_WITH_PORT = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]+$/;

const GROUP_KEYWORDS = new Set(["tailscale", "any", "all"]);

export const LOOPBACK_PEERS = Object.freeze(["127.0.0.1", LOOPBACK_V6]);

export function normalizePeer(raw) {
  if (typeof raw !== "string") {
    return null;
  }

  if (raw === "" || /\s/.test(raw)) {
    return null;
  }

  const spelling = raw.toLowerCase();

  if (spelling === LOOPBACK_V6) {
    return LOOPBACK_V6;
  }

  if (spelling.startsWith(MAPPED_V4_PREFIX)) {
    const mapped = spelling.slice(MAPPED_V4_PREFIX.length);

    return CANONICAL_IPV4.test(mapped) ? mapped : null;
  }

  return CANONICAL_IPV4.test(spelling) ? spelling : null;
}

function refuse(code, entry, detail) {
  return { ok: false, code, entry, detail };
}

export function parseAllowlist(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return { ok: true, entries: [] };
  }

  if (typeof rawValue !== "string") {
    return refuse(
      "not_a_string",
      null,
      "the allowlist must be a comma-separated string of IPv4 addresses",
    );
  }

  if (rawValue.trim() === "") {
    return { ok: true, entries: [] };
  }

  const entries = [];
  const seen = new Set();

  for (const token of rawValue.split(",")) {
    const entry = token.trim();

    if (entry === "") {
      return refuse(
        "empty_entry",
        token,
        `"${token}" is not an address; check for a doubled or trailing comma`,
      );
    }

    if (IPV4_WITH_PORT.test(entry)) {
      return refuse(
        "port_suffix_not_allowed",
        entry,
        `"${entry}" names a port; the rule admits addresses only`,
      );
    }

    if (
      entry.includes("/") ||
      entry.includes("*") ||
      GROUP_KEYWORDS.has(entry.toLowerCase())
    ) {
      return refuse(
        "ranges_not_supported",
        entry,
        `"${entry}" stands for more than one address; list each IPv4 address you want admitted`,
      );
    }

    if (entry.includes(":")) {
      return refuse(
        "ipv6_not_supported_use_ipv4",
        entry,
        `"${entry}" is IPv6; peers are compared as IPv4, so list the IPv4 address instead`,
      );
    }

    if (!CANONICAL_IPV4.test(entry)) {
      return refuse(
        "not_canonical_ipv4",
        entry,
        `"${entry}" is not four decimal octets in canonical spelling`,
      );
    }

    if (seen.has(entry)) {
      return refuse(
        "duplicate_entry",
        entry,
        `"${entry}" appears more than once; remove the repeat instead of relying on de-duplication`,
      );
    }

    seen.add(entry);
    entries.push(entry);
  }

  return { ok: true, entries };
}

export function isAdmittedPeer({ remoteAddress, allowlist = [] } = {}) {
  const normalized = normalizePeer(remoteAddress);

  if (!Array.isArray(allowlist)) {
    return {
      admitted: false,
      normalized,
      reason: "invalid_allowlist",
    };
  }

  if (normalized === null) {
    return {
      admitted: false,
      normalized: null,
      reason: "unrecognised_peer",
    };
  }

  if (LOOPBACK_PEERS.includes(normalized)) {
    return { admitted: true, normalized, reason: "loopback" };
  }

  if (allowlist.includes(normalized)) {
    return { admitted: true, normalized, reason: "allowlist" };
  }

  return { admitted: false, normalized, reason: "peer_not_admitted" };
}
