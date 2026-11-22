import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { projectCtraderDiscovery } from "./ctraderAccountDiscovery.js";

/* ============================================================
   WHAT THIS SUITE PINS

   Two functions. `mergeDiscoveredAccounts` turns a SUCCESSFUL B2-1
   projection plus the accounts already saved into the complete next
   account list, and refuses everything else. `persistDiscoveredAccounts`
   hands that list to the combined store, which is given to it rather
   than reached for, so this suite never learns a real path and never
   opens a real file.

   Every result below is asked the same two questions over and over:
   did anything get past a refusal as a list, and did any selection
   field appear anywhere it was not already saved? A merge that reports
   failure while still handing back candidates would let a caller save
   a partial discovery by forgetting to check `ok`, and a merge that
   wrote an active account would activate an account nobody chose.
   ============================================================ */

const MODULE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "ctraderAccountPersistence.js"
);
const MODULE_EXISTS = fs.existsSync(MODULE_FILE);
const MISSING = "server/services/ctraderAccountPersistence.js does not exist yet";

const NOW = "2026-01-02T03:04:05.006Z";
const now = () => NOW;
const localIdFor = (accountId) => `local-${accountId}`;

async function load() {
  assert.ok(MODULE_EXISTS, MISSING);

  const namespace = await import("./ctraderAccountPersistence.js");

  assert.equal(
    typeof namespace.mergeDiscoveredAccounts,
    "function",
    MISSING
  );
  assert.equal(
    typeof namespace.persistDiscoveredAccounts,
    "function",
    MISSING
  );

  return namespace;
}

/* A saved record, in the shape the combined store reads back. */
function stored(accountId, overrides = {}) {
  return {
    id: `account-${accountId}`,
    accountId: String(accountId),
    name: `Saved ${accountId}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/* A broker row: only an account id, exactly what discovery is given. */
function row(accountId, extra = {}) {
  return { accountId, ...extra };
}

/* The real projection, so a merge test cannot disagree with the
   contract it is written against. */
function project(input) {
  return projectCtraderDiscovery(input);
}

function merge(input = {}) {
  return {
    storedAccounts: [],
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
    createLocalId: localIdFor,
    now,
    ...input,
  };
}

async function mergeOf(input) {
  const { mergeDiscoveredAccounts } = await load();

  return mergeDiscoveredAccounts(merge(input));
}

/* ============================================================
   THE EXPORTED CONTRACT
   ============================================================ */

test("the module exports exactly the merge and the persistence function", async () => {
  const namespace = await load();

  assert.deepEqual(Object.keys(namespace).sort(), [
    "mergeDiscoveredAccounts",
    "persistDiscoveredAccounts",
  ]);
});

test("a successful merge result has one fixed shape", async () => {
  const out = await mergeOf({
    storedAccounts: [stored(1001)],
    projection: project({
      discoveredAccounts: [row(1001), row(2002)],
      storedAccounts: [stored(1001)],
      createLocalId: localIdFor,
    }),
  });

  assert.deepEqual(Object.keys(out).sort(), [
    "accounts",
    "addedAccountIds",
    "code",
    "message",
    "ok",
    "preservedAccountIds",
  ]);
  assert.equal(out.ok, true);
  assert.equal(out.code, "accounts_merged");
});

/* ============================================================
   THE MERGE ITSELF
   ============================================================ */

test("one new account is added to the accounts already saved", async () => {
  const out = await mergeOf({
    storedAccounts: [stored(1001)],
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [stored(1001)],
      createLocalId: localIdFor,
    }),
  });

  assert.deepEqual(out.addedAccountIds, ["2002"]);
  assert.deepEqual(out.preservedAccountIds, ["1001"]);
  assert.equal(out.accounts.length, 2);
  assert.equal(out.accounts[0].accountId, "1001");
  assert.equal(out.accounts[1].accountId, "2002");
});

test("several new accounts are added in the order discovery named them", async () => {
  const out = await mergeOf({
    storedAccounts: [stored(1001)],
    projection: project({
      discoveredAccounts: [row(3003), row(2002), row(1001)],
      storedAccounts: [stored(1001)],
      createLocalId: localIdFor,
    }),
  });

  assert.deepEqual(
    out.accounts.map((account) => account.accountId),
    ["1001", "3003", "2002"]
  );
  assert.deepEqual(out.addedAccountIds, ["3003", "2002"]);
});

test("every saved record survives, with the metadata it was saved with", async () => {
  /* A fifth key already on disk is the saved record's own metadata.
     Preserving it is what "preserve existing metadata exactly" means;
     the four-key ceiling governs the records this merge WRITES, and the
     next test is where that is pinned. */
  const saved = {
    id: "account-1001",
    accountId: "1001",
    name: "Live ISA",
    createdAt: "2026-01-01T00:00:00.000Z",
    isDefault: true,
  };

  const out = await mergeOf({
    storedAccounts: [saved, stored(4004)],
    projection: project({
      discoveredAccounts: [row(5005)],
      storedAccounts: [saved, stored(4004)],
      createLocalId: localIdFor,
    }),
  });

  assert.deepEqual(out.accounts[0], saved);
  assert.deepEqual(out.accounts[1], stored(4004));
  assert.equal(out.accounts.length, 3);
});

test("a candidate never overwrites the record already saved for it", async () => {
  const saved = stored(1001, { name: "The Name The User Chose" });

  /* The candidate carries a different name and a different local id
     than the saved record: what a projection assembled from another
     machine's file, or from a broker title, would look like. The saved
     record is what has to come back. */
  const out = await mergeOf({
    storedAccounts: [saved],
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: [
        {
          id: "local-from-elsewhere",
          accountId: "1001",
          name: "Renamed By The Broker",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      discoveredAccountIds: ["1001"],
      matchedAccountIds: ["1001"],
      newAccountIds: [],
      preservedAccountIds: [],
      rejected: [],
    },
  });

  assert.equal(out.ok, true);
  assert.deepEqual(out.addedAccountIds, []);
  assert.equal(out.accounts.length, 1);
  assert.deepEqual(out.accounts[0], saved);
});

test("a new record carries the four keys of the store contract and nothing else", async () => {
  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(7007)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
  });

  assert.deepEqual(Object.keys(out.accounts[0]).sort(), [
    "accountId",
    "createdAt",
    "id",
    "name",
  ]);
});

test("the new record values come from the injected sources, not a guess", async () => {
  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(" 7007 ")],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
  });

  assert.deepEqual(out.accounts[0], {
    id: "local-7007",
    accountId: "7007",
    name: "Trading Account",
    createdAt: NOW,
  });
});

test("a new account is named Trading Account", async () => {
  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
  });

  assert.equal(out.accounts[0].name, "Trading Account");
});

test("nothing from a candidate is copied into a new record", async () => {
  /* The projection allow-lists the candidate keys, so a fifth field
     cannot arrive through it; the merge is the place that decides the
     new record's contents, and this is where a wholesale candidate copy
     would be caught. */
  const { mergeDiscoveredAccounts } = await load();

  const forged = {
    ok: true,
    code: "discovery_projected",
    message: "synthetic",
    accounts: [
      {
        id: "local-2002",
        accountId: "2002",
        name: null,
        createdAt: null,
      },
    ],
    discoveredAccountIds: ["2002"],
    matchedAccountIds: [],
    newAccountIds: ["2002"],
    preservedAccountIds: [],
    rejected: [],
  };

  const out = mergeDiscoveredAccounts({
    storedAccounts: [],
    projection: forged,
    createLocalId: localIdFor,
    now,
  });

  assert.deepEqual(Object.keys(out.accounts[0]).sort(), [
    "accountId",
    "createdAt",
    "id",
    "name",
  ]);
  assert.equal(out.accounts[0].id, "local-2002");
  assert.equal(out.accounts[0].createdAt, NOW);
});

test("an account already saved is never added a second time", async () => {
  const saved = stored(1001);

  const out = await mergeOf({
    storedAccounts: [saved],
    projection: project({
      discoveredAccounts: [row(1001), row("1001")],
      storedAccounts: [saved],
      createLocalId: localIdFor,
    }),
  });

  /* The response names one account twice, so the projection refuses;
     a merge that saw a success and added it anyway is what this pins
     away from. */
  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_refused");
  assert.deepEqual(out.accounts, []);
});

/* ============================================================
   REFUSALS: THE PROJECTION RESULT
   ============================================================ */

test("a refused projection is refused here too", async () => {
  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: "not a list",
      createLocalId: localIdFor,
    }),
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_refused");
  assert.deepEqual(out.accounts, []);

  /* The merge flattens every refusal to one code, so the projection's own
     reason has to survive in the message or the caller is told "refused"
     with no way to tell which half was wrong. */
  assert.match(
    out.message,
    /stored_accounts_not_a_list/,
    `the refusal did not say why: ${out.message}`
  );
});

test("an incomplete projection cannot be merged", async () => {
  /* A hand-built success that still carries rejected rows: the shape a
     caller would produce by reading `ok` alone. */
  const out = await mergeOf({
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: [
        { id: "local-2002", accountId: "2002", name: null, createdAt: null },
      ],
      discoveredAccountIds: ["2002"],
      matchedAccountIds: [],
      newAccountIds: ["2002"],
      preservedAccountIds: [],
      rejected: [{ index: 1, code: "row_not_an_object" }],
    },
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_incomplete");
  assert.deepEqual(out.accounts, []);
});

test("a success whose code is not the projected code is malformed", async () => {
  const out = await mergeOf({
    projection: {
      ok: true,
      code: "something_else",
      message: "synthetic",
      accounts: [],
      discoveredAccountIds: [],
      matchedAccountIds: [],
      newAccountIds: [],
      preservedAccountIds: [],
      rejected: [],
    },
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_not_projected");
});

test("a projection result that is not a result is refused", async () => {
  for (const bad of [undefined, null, "discovery", 7, []]) {
    const out = await mergeOf({ projection: bad });

    assert.equal(out.ok, false, `a caller passing ${String(bad)} was accepted`);
    assert.equal(out.code, "projection_not_a_result");
    assert.deepEqual(out.accounts, []);
  }
});

test("a projection whose account list is not a list is refused", async () => {
  const out = await mergeOf({
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: { accountId: "2002" },
      discoveredAccountIds: ["2002"],
      matchedAccountIds: [],
      newAccountIds: ["2002"],
      preservedAccountIds: [],
      rejected: [],
    },
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_accounts_not_a_list");
});

test("a projection result missing its id lists is refused", async () => {
  /* The lists are what the cross-check reads; a result without them is a
     result assembled by someone who never called the projection. */
  const withoutLists = {
    ok: true,
    code: "discovery_projected",
    message: "synthetic",
    accounts: [
      { id: "local-2002", accountId: "2002", name: null, createdAt: null },
    ],
  };

  const missing = await mergeOf({ projection: withoutLists });

  assert.equal(missing.ok, false);
  assert.equal(missing.code, "projection_lists_missing");
  assert.deepEqual(missing.accounts, []);

  for (const list of [
    "discoveredAccountIds",
    "matchedAccountIds",
    "newAccountIds",
    "preservedAccountIds",
    "rejected",
  ]) {
    const out = await mergeOf({
      projection: { ...withoutLists, [list]: "2002" },
    });

    assert.equal(
      out.code,
      "projection_lists_missing",
      `a ${list} that is not a list was accepted`
    );
    assert.deepEqual(out.accounts, []);
  }
});

test("a candidate that is not a record is refused", async () => {
  for (const bad of [null, "2002", 2002, []]) {
    const out = await mergeOf({
      projection: {
        ok: true,
        code: "discovery_projected",
        message: "synthetic",
        accounts: [bad],
        discoveredAccountIds: [],
        matchedAccountIds: [],
        newAccountIds: [],
        preservedAccountIds: [],
        rejected: [],
      },
    });

    assert.equal(out.ok, false, `a candidate of ${String(bad)} was merged`);
    assert.equal(out.code, "candidate_not_an_object");
    assert.deepEqual(out.accounts, []);
  }
});

test("a candidate with no usable account id is refused", async () => {
  for (const bad of ["", "   ", null, undefined, {}, "[object Object]"]) {
    const out = await mergeOf({
      projection: {
        ok: true,
        code: "discovery_projected",
        message: "synthetic",
        accounts: [{ id: "x", accountId: bad, name: null, createdAt: null }],
        discoveredAccountIds: [],
        matchedAccountIds: [],
        newAccountIds: [],
        preservedAccountIds: [],
        rejected: [],
      },
    });

    assert.equal(
      out.ok,
      false,
      `accountId ${JSON.stringify(bad)} was merged as an account`
    );
    assert.equal(out.code, "candidate_account_id_unusable");
    assert.deepEqual(out.accounts, []);
  }
});

test("a projection whose lists disagree with its records is refused", async () => {
  /* The records name 2002, the lists name 3003. Either way it cannot be
     told apart from a result that was assembled from two discoveries,
     and the merge cannot know which half to believe. */
  const mismatched = await mergeOf({
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: [
        { id: "local-2002", accountId: "2002", name: null, createdAt: null },
      ],
      discoveredAccountIds: ["3003"],
      matchedAccountIds: [],
      newAccountIds: ["3003"],
      preservedAccountIds: [],
      rejected: [],
    },
  });

  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.code, "projection_inconsistent");
  assert.deepEqual(mismatched.accounts, []);

  /* A matched id that is not saved at all is the other half of the
     same disagreement. */
  const unmatched = await mergeOf({
    storedAccounts: [stored(1001)],
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: [stored(9999)],
      discoveredAccountIds: ["9999"],
      matchedAccountIds: ["9999"],
      newAccountIds: [],
      preservedAccountIds: ["1001"],
      rejected: [],
    },
  });

  assert.equal(unmatched.ok, false);
  assert.equal(unmatched.code, "projection_inconsistent");
});

/* ============================================================
   REFUSALS: DUPLICATES AND MISSING SOURCES
   ============================================================ */

test("duplicate identities in the saved accounts are refused", async () => {
  const out = await mergeOf({
    storedAccounts: [stored(1001), stored(1001, { name: "twin" })],
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: [stored(1001)],
      discoveredAccountIds: ["1001"],
      matchedAccountIds: ["1001"],
      newAccountIds: [],
      preservedAccountIds: [],
      rejected: [],
    },
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "ambiguous_stored_accounts");
  assert.deepEqual(out.accounts, []);
});

test("duplicate identities among the candidates are refused", async () => {
  const out = await mergeOf({
    projection: {
      ok: true,
      code: "discovery_projected",
      message: "synthetic",
      accounts: [
        { id: "local-2002", accountId: "2002", name: null, createdAt: null },
        { id: "local-2002-b", accountId: " 2002 ", name: null, createdAt: null },
      ],
      discoveredAccountIds: ["2002"],
      matchedAccountIds: [],
      newAccountIds: ["2002"],
      preservedAccountIds: [],
      rejected: [],
    },
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "ambiguous_candidate_accounts");
  assert.deepEqual(out.accounts, []);
});

test("a new account needs a source for its local id", async () => {
  const { mergeDiscoveredAccounts } = await load();

  const out = mergeDiscoveredAccounts({
    storedAccounts: [],
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
    createLocalId: undefined,
    now,
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "local_id_source_missing");
  assert.deepEqual(out.accounts, []);
});

test("a new account needs a source for its creation time", async () => {
  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
    now: undefined,
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "clock_source_missing");
  assert.deepEqual(out.accounts, []);
});

test("an empty discovery merges without needing either source", async () => {
  const { mergeDiscoveredAccounts } = await load();

  const out = mergeDiscoveredAccounts({
    storedAccounts: [stored(1001)],
    projection: project({
      discoveredAccounts: [row(1001)],
      storedAccounts: [stored(1001)],
    }),
  });

  /* Nothing new is written down, so no id and no timestamp is asked
     for, and the saved list comes back unchanged. */
  assert.equal(out.ok, true);
  assert.equal(out.code, "accounts_merged");
  assert.deepEqual(out.addedAccountIds, []);
  assert.deepEqual(out.accounts, [stored(1001)]);
});

test("the saved accounts do not have to be a list", async () => {
  const out = await mergeOf({
    storedAccounts: undefined,
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "stored_accounts_not_a_list");
  assert.deepEqual(out.accounts, []);
});

test("a saved record with no usable account id is refused", async () => {
  const out = await mergeOf({
    storedAccounts: [{ id: "account-x", name: "No Id" }],
    projection: project({
      discoveredAccounts: [row(2002)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "stored_account_unusable");
  assert.deepEqual(out.accounts, []);
});

/* ============================================================
   WHAT A REFUSAL NEVER CARRIES
   ============================================================ */

test("no refusal hands back a list of accounts", async () => {
  const { mergeDiscoveredAccounts } = await load();

  const refusedProjection = {
    ok: false,
    code: "no_accounts_discovered",
    message: "synthetic",
    accounts: [],
    discoveredAccountIds: [],
    matchedAccountIds: [],
    newAccountIds: [],
    preservedAccountIds: [],
    rejected: [],
  };

  const incompleteProjection = {
    ok: true,
    code: "discovery_projected",
    message: "synthetic",
    accounts: [],
    discoveredAccountIds: [],
    matchedAccountIds: [],
    newAccountIds: [],
    preservedAccountIds: [],
    rejected: [{ index: 0, code: "row_not_an_object" }],
  };

  /* Each row is one branch, named: an input that has to be refused and
     the code that has to say so. A branch that fell through to another
     code would show up here as a mismatch rather than as a success. */
  const cases = [
    [{ projection: undefined }, "projection_not_a_result"],
    [{ projection: "not a result" }, "projection_not_a_result"],
    [{ projection: refusedProjection }, "projection_refused"],
    [{ projection: incompleteProjection }, "projection_incomplete"],
    [{ storedAccounts: "no" }, "stored_accounts_not_a_list"],
    [{ storedAccounts: [null] }, "stored_account_unusable"],
    [{ createLocalId: undefined }, "local_id_source_missing"],
    [{ now: undefined }, "clock_source_missing"],
  ];

  for (const [input, expected] of cases) {
    const out = mergeDiscoveredAccounts(merge(input));

    assert.equal(
      out.ok,
      false,
      `${expected}: reported a success for ${JSON.stringify(input)}`
    );
    assert.equal(out.code, expected);
    assert.deepEqual(out.accounts, [], `${expected} handed back candidates`);
    assert.deepEqual(out.addedAccountIds, [], `${expected} handed back ids`);
  }
});

/* ============================================================
   SELECTION STAYS WHERE IT WAS
   ============================================================ */

test("a merge result contains no selection field anywhere in it", async () => {
  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(2002), row(3003)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
  });

  const names = new Set();

  const scan = (value) => {
    if (Array.isArray(value)) {
      value.forEach(scan);

      return;
    }

    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        names.add(key);
        scan(value[key]);
      }
    }
  };

  scan(out);

  assert.deepEqual(
    [...names].filter((name) => /active|select|default|polic/i.test(name)),
    [],
    "a merge result named a selection field, so a caller could read one as a change"
  );
  assert.ok(
    !/activated|now active|switched/i.test(out.message),
    `the success message claims an activation: ${out.message}`
  );
});

/* ============================================================
   INPUTS ARE READ, NOT WRITTEN
   ============================================================ */

test("neither the saved list nor the projection is changed by a merge", async () => {
  const { mergeDiscoveredAccounts } = await load();

  const saved = [stored(1001), stored(4004)];
  const projection = project({
    discoveredAccounts: [row(1001), row(2002), row(5005)],
    storedAccounts: saved,
    createLocalId: localIdFor,
  });

  const before = structuredClone({ saved, projection });

  const out = mergeDiscoveredAccounts({
    storedAccounts: saved,
    projection,
    createLocalId: localIdFor,
    now,
  });

  assert.deepEqual({ saved, projection }, before, "a merge mutated its inputs");

  out.accounts[0].name = "CLOBBERED";
  out.accounts[2].accountId = "CLOBBERED";

  assert.deepEqual(
    { saved, projection },
    before,
    "the returned records are the caller's own objects, so saving them mutates what was read"
  );
});

test("the merge is deterministic for one set of inputs", async () => {
  const { mergeDiscoveredAccounts } = await load();

  const inputs = () => ({
    storedAccounts: [stored(1001)],
    projection: project({
      discoveredAccounts: [row(3003), row(2002)],
      storedAccounts: [stored(1001)],
      createLocalId: localIdFor,
    }),
    createLocalId: localIdFor,
    now,
  });

  assert.deepEqual(
    mergeDiscoveredAccounts(inputs()),
    mergeDiscoveredAccounts(inputs())
  );
});

test("the injected sources are asked once per new account", async () => {
  const ids = [];
  const stamps = [];

  const out = await mergeOf({
    projection: project({
      discoveredAccounts: [row(2002), row(3003)],
      storedAccounts: [],
      createLocalId: localIdFor,
    }),
    createLocalId: (accountId) => {
      ids.push(accountId);

      return `local-${accountId}`;
    },
    now: () => {
      stamps.push(1);

      return NOW;
    },
  });

  assert.equal(out.ok, true);
  assert.deepEqual(ids, ["2002", "3003"]);
  assert.equal(stamps.length, 2);
});

/* ============================================================
   THE STORE INTEGRATION
   ============================================================ */

const TOKEN = "synthetic-access-token";

function stateOf(accounts, extra = {}) {
  return {
    connected: true,
    accessToken: TOKEN,
    refreshToken: "synthetic-refresh-token",
    expiresIn: 3600,
    accounts,
    activeAccountId: "1001",
    ...extra,
  };
}

function fakeStore({ state, saveError, loadError } = {}) {
  const saved = [];

  return {
    saved,
    load() {
      /* A read failure is the store refusing to answer, which is not the
         same as a file with nothing in it. */
      if (loadError) {
        throw loadError;
      }

      /* Once something has been written, the store answers with it, the
         way the real one does. Without this line a second discovery would
         be measured against the first call's file and could never re-find
         the record the first call wrote. */
      if (saved.length > 0) {
        return structuredClone(saved.at(-1));
      }

      return state === undefined ? null : structuredClone(state);
    },
    save(next) {
      saved.push(structuredClone(next));

      if (saveError) {
        throw saveError;
      }
    },
  };
}

async function persist(input) {
  const { persistDiscoveredAccounts } = await load();

  return persistDiscoveredAccounts({
    createLocalId: localIdFor,
    now,
    ...input,
  });
}

test("discovered accounts are persisted as one complete next state", async () => {
  const store = fakeStore({ state: stateOf([stored(1001)]) });

  const out = await persist({
    store,
    discoveredAccounts: [row(1001), row(2002)],
  });

  assert.equal(out.ok, true);
  assert.equal(out.code, "accounts_persisted");
  assert.equal(store.saved.length, 1);

  const written = store.saved[0];

  assert.deepEqual(
    written.accounts.map((account) => account.accountId),
    ["1001", "2002"]
  );
  assert.deepEqual(written.activeAccountId, stateOf([stored(1001)]).activeAccountId);
  assert.equal(written.accessToken, TOKEN);
  assert.equal(written.connected, true);
  assert.equal(written.expiresIn, 3600);
});

test("a write reports nothing selected and hands back no token", async () => {
  const store = fakeStore({ state: stateOf([stored(1001)]) });

  const out = await persist({
    store,
    discoveredAccounts: [row(2002)],
  });

  assert.deepEqual(Object.keys(out).sort(), [
    "accounts",
    "addedAccountIds",
    "code",
    "message",
    "ok",
    "preservedAccountIds",
  ]);
  assert.ok(
    !JSON.stringify(out).includes(TOKEN),
    "the write result carried a credential, so a caller could echo it into a response"
  );
});

test("a write with nothing saved yet is refused", async () => {
  const store = fakeStore({});

  const out = await persist({
    store,
    discoveredAccounts: [row(2002)],
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "no_stored_state");
  assert.deepEqual(out.accounts, []);
  assert.equal(store.saved.length, 0);
});

test("a store that fails to read is reported as a failure", async () => {
  const failure = new Error(
    "cTrader auth could not be read (open): ENOENT"
  );

  failure.operation = "load";
  failure.step = "open";
  failure.code = "ENOENT";

  const store = fakeStore({ loadError: failure });

  const out = await persist({ store, discoveredAccounts: [row(2002)] });

  /* A store that could not answer is not a store with nothing in it: the
     first would let a caller conclude the account was never saved. */
  assert.equal(out.ok, false);
  assert.equal(out.code, "store_read_failed");
  assert.deepEqual(out.accounts, []);
  assert.equal(store.saved.length, 0, "a failed read was followed by a write");
  assert.ok(
    !/cTrader auth could not be read/.test(out.message),
    `the store's own message was repeated: ${out.message}`
  );
});

test("a stored state that is not a record cannot be written to", async () => {
  for (const bad of ["connected", 7, [], true]) {
    const store = fakeStore({ state: bad });

    const out = await persist({ store, discoveredAccounts: [row(2002)] });

    assert.equal(
      out.ok,
      false,
      `a stored state of ${JSON.stringify(bad)} was treated as a record`
    );
    assert.equal(out.code, "stored_state_unusable");
    assert.deepEqual(out.accounts, []);
    assert.equal(
      store.saved.length,
      0,
      "a state that is not a record was still handed to the store"
    );
  }
});

test("a store that cannot be used is refused", async () => {
  for (const bad of [undefined, null, {}, { load: () => null }]) {
    const out = await persist({ store: bad, discoveredAccounts: [row(2002)] });

    assert.equal(out.ok, false, `a store of ${JSON.stringify(bad)} was used`);
    assert.equal(out.code, "store_not_usable");
    assert.deepEqual(out.accounts, []);
  }
});

test("a refused store write is reported as a failure", async () => {
  const failure = new Error("cTrader auth could not be written (rename)");

  failure.operation = "save";
  failure.step = "rename";
  failure.code = "EBUSY";

  const store = fakeStore({ state: stateOf([stored(1001)]), saveError: failure });

  const out = await persist({
    store,
    discoveredAccounts: [row(2002)],
  });

  assert.equal(out.ok, false, "a write that threw was reported as a success");
  assert.equal(out.code, "store_write_failed");
  assert.deepEqual(out.accounts, []);
  assert.deepEqual(out.addedAccountIds, []);
});

test("a failed write says which step refused, without repeating the file system", async () => {
  const failure = new Error(
    `EACCES: permission denied, open 'C:\\secrets\\ctrader-auth.json'`
  );

  failure.step = "open";
  failure.code = "EACCES";

  const out = await persist({
    store: fakeStore({
      state: stateOf([stored(1001)]),
      saveError: failure,
    }),
    discoveredAccounts: [row(2002)],
  });

  assert.match(out.message, /open/);
  assert.match(out.message, /EACCES/);
  assert.ok(
    !/ctrader-auth\.json|secrets|permission denied/i.test(out.message),
    `the store's own message was repeated, so the path reached the caller: ${out.message}`
  );
});

test("nothing is written when discovery itself failed", async () => {
  const store = fakeStore({ state: stateOf([stored(1001)]) });

  const out = await persist({
    store,
    /* The same account named twice: the one response a discovery must
       never be allowed to write down. */
    discoveredAccounts: [row(2002), row(2002)],
  });

  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_refused");
  assert.deepEqual(out.accounts, []);
  assert.equal(store.saved.length, 0);
});

test("nothing is written when a saved list is already ambiguous", async () => {
  const store = fakeStore({
    state: stateOf([stored(1001), stored(1001, { name: "twin" })]),
  });

  const out = await persist({ store, discoveredAccounts: [row(2002)] });

  assert.equal(out.ok, false);
  assert.equal(out.code, "projection_refused");
  assert.equal(store.saved.length, 0);
});

test("a successful write adds the same account exactly once", async () => {
  const store = fakeStore({ state: stateOf([stored(1001)]) });

  const first = await persist({
    store,
    discoveredAccounts: [row(2002)],
  });

  assert.equal(first.ok, true);

  /* The store now answers with what it was given, the way the real one
     would after a save, so a second discovery of the same account is
     measured against the record the first one wrote. */
  const second = await persist({
    store,
    discoveredAccounts: [row(2002)],
  });

  assert.equal(second.ok, true);
  assert.deepEqual(second.addedAccountIds, []);
  assert.equal(store.saved.at(-1).accounts.length, 2);
  assert.deepEqual(
    store.saved.at(-1).accounts.map((account) => account.accountId),
    ["1001", "2002"],
    "the second discovery wrote the account a second time"
  );
});

test("the write preserves an account the broker did not name", async () => {
  const store = fakeStore({
    state: stateOf([stored(1001), stored(9009, { name: "Kept By Hand" })]),
  });

  const out = await persist({ store, discoveredAccounts: [row(2002)] });

  assert.equal(out.ok, true);
  assert.deepEqual(out.preservedAccountIds, ["1001", "9009"]);
  assert.deepEqual(
    store.saved[0].accounts.map((account) => account.accountId),
    ["1001", "9009", "2002"]
  );
  assert.equal(store.saved[0].accounts[1].name, "Kept By Hand");
});

test("the write does not move the account selection", async () => {
  const store = fakeStore({
    state: stateOf([stored(1001), stored(2002)], { activeAccountId: null }),
  });

  /* 3003 is not saved yet, so this write does add a record: the one
     moment a caller could be tempted to point the session at what
     discovery just found. Nothing may move, and the account the user
     had chosen nothing is still nothing after the write. */
  const out = await persist({ store, discoveredAccounts: [row(3003)] });

  assert.equal(out.ok, true);
  assert.deepEqual(out.addedAccountIds, ["3003"]);
  assert.equal(store.saved[0].activeAccountId, null);
});

test("the read state is not mutated on the way to the store", async () => {
  const state = stateOf([stored(1001)]);
  const before = structuredClone(state);
  const store = {
    load: () => state,
    save: () => {},
  };

  const out = await persist({ store, discoveredAccounts: [row(2002)] });

  assert.equal(out.ok, true);
  assert.deepEqual(state, before, "the state the store handed back was rewritten");
});

/* ============================================================
   PURITY
   ============================================================ */

test("the module performs no I/O and reaches for no clock or randomness itself", async () => {
  assert.ok(MODULE_EXISTS, MISSING);

  const text = fs.readFileSync(MODULE_FILE, "utf8");

  /* Built from fragments so this file can carry the needles without
     pinning itself: the module under test may name a thing this scan
     may not. */
  const needles = [
    "node:" + "fs",
    "node:" + "http",
    "node:" + "net",
    "Web" + "Socket",
    "Date." + "now",
    "Math." + "random",
    "process." + "env",
    "ACCOUNTS" + "_FILE",
    "AUTH" + "_FILE",
    "readFile" + "Sync",
    "writeFile" + "Sync",
  ];

  for (const needle of needles) {
    assert.ok(
      !text.includes(needle),
      `${needle} appears in the persistence module, which is meant to be handed its store`
    );
  }

  assert.ok(!/console\./.test(text), "the persistence module logs by itself");
  assert.equal(
    (text.match(/^export /gm) || []).length,
    2,
    "the persistence module exports something other than the merge and the write"
  );
});

test("the persistence module keeps the identity rule it was given", async () => {
  assert.ok(MODULE_EXISTS, MISSING);

  const text = fs.readFileSync(MODULE_FILE, "utf8");

  assert.match(
    text,
    /import \{[^}]*normalizeAccountKey[^}]*\} from "\.\/ctraderAccountSelection\.js"/,
    "the merge stopped using the shared identity rule, so a second rule is deciding what an account id is"
  );
  assert.match(
    text,
    /import \{[^}]*projectCtraderDiscovery[^}]*\} from "\.\/ctraderAccountDiscovery\.js"/,
    "the write stopped asking the approved projection, so a caller could reach the store without it"
  );
});
