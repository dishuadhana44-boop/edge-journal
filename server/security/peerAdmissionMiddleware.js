// ============================================================
// PEER ADMISSION GUARD - where the pure rule meets a connection
// ============================================================
//
// server/security/peerAdmission.js decides from an address string and a list
// of exact IPv4 literals. This file supplies the address, taken from the
// socket the request arrived on, and nothing else: request fields a caller
// writes about its own route are assertions, while the peer address is a fact
// about the connection, so only the fact is used.
//
// resolveAllowlist() is the boot-time parse. A list the rule cannot
// understand comes back as a refusal the caller must not start the process
// over, because a partly understood list is a wider hole than an empty one.
// createPeerAdmissionMiddleware() is the per-request decision. A refusal
// replies 403 and says only that the peer was not admitted.
//
// LIMIT: Tailscale Serve dials this server from the machine it runs on, so a
// remote tailnet peer routed through it arrives as loopback and is admitted.
// This guard narrows direct connections to the cTrader API; it does not
// resolve D-TAILNET, and it is not authentication - see the plan's A1-A4.

import { isAdmittedPeer, parseAllowlist } from "./peerAdmission.js";

const REFUSAL_MESSAGE =
  "This request did not come from an admitted peer address, " +
  "so the cTrader API refused it.";

export function resolveAllowlist(rawValue) {
  const verdict = parseAllowlist(rawValue);

  if (!verdict.ok) {
    return verdict;
  }

  return {
    ok: true,
    entries: Object.freeze(verdict.entries),
  };
}

export function createPeerAdmissionMiddleware({
  allowlist = [],
  log = () => {},
} = {}) {
  return function admitKnownPeer(req, res, next) {
    const remoteAddress =
      req && req.socket ? req.socket.remoteAddress : undefined;

    const decision = isAdmittedPeer({
      remoteAddress,
      allowlist,
    });

    if (decision.admitted) {
      next();
      return;
    }

    refuse(res, log, req, decision);
  };
}

function refuse(res, log, req, decision) {
  const peer =
    decision.normalized === undefined || decision.normalized === null
      ? "unrecognised"
      : decision.normalized;

  const method = req && req.method ? req.method : "UNKNOWN";
  const route = req && req.path ? req.path : "UNKNOWN";

  // One line, and never the request query string: an OAuth code travels in
  // it on the cTrader callback.
  log(
    `[ctrader] peer_not_admitted peer=${peer} ` +
      `decision=${decision.reason} ` +
      `method=${method} route=${route}`,
  );

  res.status(403).json({
    success: false,
    code: "peer_not_admitted",
    reason: decision.reason,
    message: REFUSAL_MESSAGE,
  });
}
