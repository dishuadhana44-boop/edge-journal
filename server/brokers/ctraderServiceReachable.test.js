import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createCtraderAdapter } from "./ctraderAdapter.js";
import { makeBrokerIdentity } from "./identity.js";

/* ============================================================
   serviceReachable honesty

   `connection.serviceReachable` must describe an observation the cTrader
   adapter actually made. The service this adapter reads is in-process module
   state (server/brokers/index.js wires getServiceStatus straight out of
   ctraderService.js), so the honest claim is "the module returned a usable
   status object" and nothing about the broker endpoint. Nothing here opens a
   socket.
   ============================================================ */

const ADAPTER_URL = new URL("./ctraderAdapter.js", import.meta.url);

function adapterSource() {
  return readFileSync(ADAPTER_URL, "utf8").replace(/\r\n/g, "\n");
}

function adapterFor({ service, live = [], auth = {} } = {}) {
  return createCtraderAdapter({
    getServiceStatus: typeof service === "function" ? service : () => service,
    getLiveAccounts: () => live,
    getAuthSummary: () => auth,
  });
}

const READY_SERVICE = {
  running: true,
  connected: true,
  authenticated: true,
  ready: true,
  tradingAccountId: "77001122",
};

/* ============================================================
   AN ANSWERING SERVICE IS REACHABLE
   ============================================================ */

test("a service that answers with a dead socket is reachable and disconnected", async () => {
  const snapshot = await adapterFor({
    service: { running: false, connected: false },
  }).probe();

  assert.equal(snapshot.connection.serviceReachable, true);
  assert.equal(snapshot.connection.state, "disconnected");
  assert.match(
    snapshot.connection.reason,
    /connected=false/,
    "a service that answered may be described by the flags it returned"
  );
});

test("a service that answers ready is reachable and connected", async () => {
  const snapshot = await adapterFor({ service: READY_SERVICE }).probe();

  assert.equal(snapshot.connection.serviceReachable, true);
  assert.equal(snapshot.connection.state, "connected");
  assert.equal(snapshot.connection.reason, null);
});

/* ============================================================
   AN UNANSWERED READ IS NOT REACHABILITY
   ============================================================ */

test("a throwing status accessor is not reported as reachable", async () => {
  const snapshot = await adapterFor({
    service: () => {
      throw new Error("status read exploded");
    },
  }).probe();

  assert.equal(
    snapshot.connection.serviceReachable,
    false,
    "a status this adapter could not read cannot be reported as a service it reached"
  );

  assert.equal(
    snapshot.connection.state,
    "disconnected",
    "deriveState is unchanged by this work: the state label stays as Phase 3 pinned it"
  );
});

test("an unreadable status does not claim socket flags it never saw", async () => {
  const snapshot = await adapterFor({
    service: () => {
      throw new Error("status read exploded");
    },
  }).probe();

  assert.match(snapshot.connection.reason, /could not be read/);
  assert.equal(
    snapshot.connection.reason.includes("connected="),
    false,
    "the reason string must not look like the service answered with false flags"
  );
});

test("a status that is not a usable object is not reachable", async () => {
  for (const unusable of [undefined, null, "running", 42, []]) {
    const snapshot = await adapterFor({ service: unusable }).probe();

    assert.equal(
      snapshot.connection.serviceReachable,
      false,
      `${JSON.stringify(unusable)} is not a status object, so nothing was observed`
    );
  }
});

test("the unread status is disclosed as unknown rather than down", async () => {
  const unread = await adapterFor({
    service: () => {
      throw new Error("status read exploded");
    },
  }).probe();

  const answering = await adapterFor({
    service: { running: false, connected: false },
  }).probe();

  const disclosesAFailedRead = (snapshot) =>
    snapshot.session.limitations.some((text) => /failed read/.test(text));

  assert.equal(
    disclosesAFailedRead(unread),
    true,
    "an unread status must be disclosed in the limitations, not only in the reason"
  );

  assert.equal(
    unread.session.limitations.some(
      (text) => /failed read/.test(text) && /unknown/.test(text)
    ),
    true,
    "the disclosure must name the state as unknown"
  );

  assert.equal(
    disclosesAFailedRead(answering),
    false,
    "a service that answered must not claim its status was unreadable"
  );
});

test("the limitations say what serviceReachable can and cannot mean for cTrader", async () => {
  const snapshot = await adapterFor({ service: READY_SERVICE }).probe();

  const fieldLimitation = snapshot.session.limitations.filter((text) =>
    /serviceReachable/.test(text)
  );

  assert.equal(
    fieldLimitation.length,
    1,
    "exactly one limitation defines the field, and it is present whether or not the read succeeded"
  );

  assert.match(fieldLimitation[0], /in-process/);
  assert.match(fieldLimitation[0], /no network probe|not evidence/i);
  assert.equal(
    /endpoint/.test(fieldLimitation[0]),
    true,
    "the limitation must say the field does not prove the cTrader endpoint was reached"
  );
});

test("one probe consults the service status exactly once", async () => {
  let calls = 0;

  const snapshot = await adapterFor({
    service: () => {
      calls += 1;

      return READY_SERVICE;
    },
  }).probe();

  assert.equal(
    calls,
    1,
    "a snapshot must not mix two reads of the service state"
  );
  assert.equal(snapshot.connection.serviceReachable, true);
});

test("listAccounts still reports the same reachability the probe derived", async () => {
  const throwing = adapterFor({
    service: () => {
      throw new Error("status read exploded");
    },
  });

  const accounts = await throwing.listAccounts();

  assert.equal(accounts.source, "none");
});

/* ============================================================
   SOURCE CONTRACT: the field is derived, never asserted
   ============================================================ */

const CONNECTION_RULES = [
  {
    label: "serviceReachable is not a hardcoded true",
    passes: (source) => !/serviceReachable:\s*true\b/.test(source),
  },
  {
    label: "serviceReachable reads the observed flag",
    passes: (source) =>
      /serviceReachable:\s*service\.statusObserved\b/.test(source),
  },
  {
    label: "readService publishes whether the status was usable",
    passes: (source) =>
      /const statusObserved =[\s\S]{0,200}typeof rawStatus === "object"/.test(
        source
      ) && /!Array\.isArray\(rawStatus\)/.test(source),
  },
  {
    label: "a failed or non-object read falls back to an unusable status",
    passes: (source) =>
      /safeInvoke\(\(\) => getServiceStatus\(\), null\)/.test(source) &&
      /const status = statusObserved \? rawStatus : \{\}/.test(source),
  },
  {
    label: "the unread reason is chosen on the observed flag",
    passes: (source) =>
      /!service\.statusObserved\s*\n?\s*\?\s*STATUS_UNREAD_REASON/.test(source),
  },
  {
    label: "the unread limitation is added only for an unread status",
    passes: (source) =>
      /if \(!service\.statusObserved\) \{\s*\n\s*limitations\.unshift\(STATUS_UNREAD_LIMITATION\)/.test(
        source
      ),
  },
];

test("source contract: every serviceReachable rule holds in the adapter", () => {
  const source = adapterSource();

  const violated = CONNECTION_RULES.filter((rule) => !rule.passes(source));

  assert.deepEqual(
    violated.map((rule) => rule.label),
    [],
    "the connection block must derive reachability from the read it performed"
  );
});

test("source contract: the pre-fix shape violates exactly the rules it should", () => {
  const beforeFix = adapterSource()
    .replace(
      /serviceReachable: service\.statusObserved,/,
      "serviceReachable: true,"
    )
    .replace(
      /const statusObserved =[\s\S]{0,400}?\n\n    return \{\n      statusObserved,\n/,
      "\n    return {\n"
    )
    .replace(
      /safeInvoke\(\(\) => getServiceStatus\(\), null\)/,
      'safeInvoke(() => getServiceStatus(), {})'
    )
    .replace(
      /const status = statusObserved \? rawStatus : \{\};/,
      ""
    )
    .replace(
      /!service\.statusObserved\n\s*\?\s*STATUS_UNREAD_REASON/,
      "false\n            ? null"
    )
    .replace(
      /if \(!service\.statusObserved\) \{\n\s*limitations\.unshift\(STATUS_UNREAD_LIMITATION\);\n\s*\}/,
      ""
    );

  const violated = CONNECTION_RULES.filter((rule) => !rule.passes(beforeFix));

  assert.equal(
    violated.length,
    CONNECTION_RULES.length,
    `every rule must be load-bearing, but these still held: ${CONNECTION_RULES
      .filter((rule) => rule.passes(beforeFix))
      .map((rule) => rule.label)
      .join(", ")}`
  );
});

/* ============================================================
   MUTATION TABLE: each mutant is caught by a behaviour
   ============================================================ */

function buildAdapterFactory(source) {
  const body = source
    .replace(/^import[^\n]*\n/, "")
    .replace(/\bexport /g, "");

  return new Function(
    "makeBrokerIdentity",
    `${body}\nreturn createCtraderAdapter;`
  )(makeBrokerIdentity);
}

function inject({ service, live = [], auth = {} }, factory) {
  return factory({
    getServiceStatus:
      typeof service === "function" ? service : () => service,
    getLiveAccounts: () => live,
    getAuthSummary: () => auth,
  });
}

const exploded = () => {
  throw new Error("status read exploded");
};

const BEHAVIOURS = [
  {
    label: "answering service is reachable",
    async run(factory) {
      const snapshot = await inject({ service: { connected: false } }, factory)
        .probe();

      assert.equal(snapshot.connection.serviceReachable, true);
    },
  },
  {
    label: "unread status is not reachable",
    async run(factory) {
      const snapshot = await inject({ service: exploded }, factory).probe();

      assert.equal(snapshot.connection.serviceReachable, false);
    },
  },
  {
    label: "non-object status is not reachable",
    async run(factory) {
      const snapshot = await inject({ service: "running" }, factory).probe();

      assert.equal(snapshot.connection.serviceReachable, false);
    },
  },
  {
    label: "unread status reason claims no socket flags",
    async run(factory) {
      const snapshot = await inject({ service: exploded }, factory).probe();

      assert.match(snapshot.connection.reason, /could not be read/);
      assert.equal(snapshot.connection.reason.includes("connected="), false);
    },
  },
  {
    label: "unread status is disclosed in the limitations",
    async run(factory) {
      const snapshot = await inject({ service: exploded }, factory).probe();

      assert.equal(
        snapshot.session.limitations.some(
          (text) => /failed read/.test(text) && /unknown/.test(text)
        ),
        true
      );
    },
  },
  {
    label: "the field semantics are documented",
    async run(factory) {
      const snapshot = await inject({ service: READY_SERVICE }, factory).probe();

      assert.equal(
        snapshot.session.limitations.filter((text) =>
          /serviceReachable/.test(text)
        ).length,
        1
      );
    },
  },
  {
    label: "the service is read once per probe",
    async run(factory) {
      let calls = 0;

      await inject(
        {
          service: () => {
            calls += 1;

            return READY_SERVICE;
          },
        },
        factory
      ).probe();

      assert.equal(calls, 1);
    },
  },
];

async function failuresFor(factory) {
  const failed = [];

  for (const behaviour of BEHAVIOURS) {
    try {
      await behaviour.run(factory);
    } catch {
      failed.push(behaviour.label);
    }
  }

  return failed;
}

const MUTANTS = [
  {
    label: "reachability asserted as a literal",
    mutate: (source) =>
      source.replace(
        "serviceReachable: service.statusObserved,",
        "serviceReachable: true,"
      ),
  },
  {
    label: "readService reports the status usable no matter what came back",
    mutate: (source) =>
      source.replace(
        /statusObserved,\n(\s+)running:/,
        "statusObserved: true,\n$1running:"
      ),
  },
  {
    label: "an unread status falls back to the socket-flag reason",
    mutate: (source) =>
      source.replace(
        "? STATUS_UNREAD_REASON",
        "? `Socket connected=${service.connected}.`"
      ),
  },
  {
    label: "the field semantics limitation is dropped",
    mutate: (source) => source.replace("STATUS_FIELD_LIMITATION,", ""),
  },
  {
    label: "the unread status limitation is never added",
    mutate: (source) =>
      source.replace(
        "limitations.unshift(STATUS_UNREAD_LIMITATION);",
        "limitations.unshift();"
      ),
  },
];

test("behaviour: the real adapter satisfies every serviceReachable behaviour", async () => {
  assert.deepEqual(
    await failuresFor(buildAdapterFactory(adapterSource())),
    [],
    "the shipped adapter must pass the table"
  );
});

for (const mutant of MUTANTS) {
  test(`mutation: "${mutant.label}" is caught by a behaviour`, async () => {
    const mutated = mutant.mutate(adapterSource());

    assert.notEqual(
      mutated,
      adapterSource(),
      `the "${mutant.label}" anchor no longer matches the adapter source`
    );

    const failed = await failuresFor(buildAdapterFactory(mutated));

    assert.equal(
      failed.length > 0,
      true,
      `no behaviour noticed "${mutant.label}"`
    );
  });
}
