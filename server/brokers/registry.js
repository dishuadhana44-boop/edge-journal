import { makeBrokerIdentity } from "./identity.js";

export const BROKER_STATUS_CONTRACT_VERSION = 1;

/**
 * @typedef {object} BrokerAdapter
 * @property {string} id                        stable broker key ("mt5" | "ctrader")
 * @property {string} displayName
 * @property {() => Promise<BrokerSnapshot>} probe        never rejects
 * @property {() => Promise<BrokerAccounts>} listAccounts never rejects
 *
 * A broker adapter owns its connection lifecycle, its account identity and its
 * data source. Adapters must never read or merge another broker's state, and
 * must never report a value they did not observe. `connection.state` and
 * `accounts.source` exist so that "unknown" is never rendered as "false" or as
 * an empty list that looks authoritative.
 *
 * An execution provider is a property of the adapter snapshot, not of the UI:
 * replacing execution.provider/transport/browserCompatible with a
 * browser-compatible or remotely hosted provider happens inside one adapter and
 * needs no frontend or registry change.
 */

function failedSnapshot(adapterId, error) {
  const message =
    (error && typeof error.message === "string" && error.message.trim()) ||
    "Broker adapter failed without an error message.";

  return {
    id: adapterId,
    displayName: adapterId,
    connection: {
      state: "error",
      connected: false,
      serviceReachable: false,
      observedAt: new Date().toISOString(),
      sourceTimestamp: null,
      reason: message,
    },
    session: {
      scope: "unknown",
      accountScoped: false,
      identity: null,
      limitations: [
        "This broker's adapter threw while being probed, so no statement about its connection state is available.",
      ],
    },
    account: null,
    accounts: {
      broker: adapterId,
      enumerable: false,
      source: "none",
      isLive: false,
      items: [],
      activeAccountId: null,
      activeAccount: null,
      note: "The account list could not be read because the adapter failed.",
    },
    execution: null,
    capabilities: {},
    lifecycle: {},
    errors: [{ code: "adapter_failed", message }],
  };
}

/**
 * A snapshot may only claim an account for the broker that produced it. A
 * missing identity is published as "no identity claimed"; a foreign one is
 * kept visible and reported as a conflict, because rewriting it would hide the
 * defect that produced it.
 */
function reconcileIdentity(adapterId, snapshot) {
  const identity =
    snapshot.identity && typeof snapshot.identity === "object"
      ? snapshot.identity
      : null;

  const claimed = identity ? identity.broker : undefined;

  const conflict = (code, message) => {
    if (!Array.isArray(snapshot.errors)) {
      snapshot.errors = [];
    }

    snapshot.errors.push({ code, message });

    return {
      adapterId,
      claimedBroker: claimed,
      externalId: identity.externalId ?? null,
      key: identity.key ?? null,
      reason: code,
    };
  };

  if (claimed === adapterId) {
    const externalId =
      identity.externalId === undefined || identity.externalId === null
        ? null
        : String(identity.externalId).trim() || null;
    const expectedKey = externalId ? `${adapterId}:${externalId}` : null;

    if (!externalId) {
      const key = identity.key ?? null;

      snapshot.identity = makeBrokerIdentity({
        ...identity,
        broker: adapterId,
        externalId: null,
      });

      if (key) {
        return conflict(
          "identity_incomplete",
          `The ${adapterId} adapter published an identity key without an external account id.`
        );
      }

      return null;
    }

    if (identity.key !== expectedKey) {
      snapshot.identity = {
        ...identity,
        externalId,
        key: null,
        note: `The published identity key did not match ${expectedKey}, so the identity is not verified.`,
      };

      return conflict(
        "identity_key_mismatch",
        `The ${adapterId} adapter published an identity key that does not match its broker and external account id.`
      );
    }

    return null;
  }

  if (!identity || claimed === null || claimed === undefined) {
    snapshot.identity = makeBrokerIdentity({
      broker: adapterId,
      externalId: null,
      note: `The ${adapterId} adapter did not report an account identity, so none is claimed.`,
    });

    return null;
  }

  return conflict(
    "identity_mismatch",
    `The ${adapterId} adapter published an identity for broker "${claimed}", which is not its own broker.`
  );
}

/**
 * Probes every adapter in parallel and never rejects: a dead broker must not
 * hide the status of a live one.
 */
export async function buildStatusResponse(adapters) {
  const observedAt = new Date().toISOString();

  const entries = await Promise.all(
    (adapters || []).map(async (adapter) => {
      try {
        const snapshot = await adapter.probe();

        if (!snapshot || typeof snapshot !== "object") {
          return [
            adapter.id,
            failedSnapshot(
              adapter.id,
              new Error("Adapter returned no snapshot.")
            ),
          ];
        }

        return [adapter.id, snapshot];
      } catch (error) {
        return [adapter.id, failedSnapshot(adapter.id, error)];
      }
    })
  );

  const identityConflicts = entries
    .map(([adapterId, snapshot]) => reconcileIdentity(adapterId, snapshot))
    .filter(Boolean);

  return {
    success: true,
    contractVersion: BROKER_STATUS_CONTRACT_VERSION,
    observedAt,
    identityConflicts,
    brokers: Object.fromEntries(entries),
  };
}
