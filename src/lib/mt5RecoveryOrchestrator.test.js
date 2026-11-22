import test from "node:test";
import assert from "node:assert/strict";

import {
  planMT5RecoveryPreview,
  RECOVERY_ORCHESTRATOR_STATUS,
  RECOVERY_ORCHESTRATOR_REASONS,
} from "./mt5RecoveryOrchestrator.js";

import { canonicalLogin } from "../utils/trading/recoveryClock.js";

import { RECOVERY_ADAPTER_REASONS as R } from "./mt5RecoveryJournalAdapter.js";

// ============================================================
// Fixtures
//
// The wire format is copied from the producer, exactly as in
// src/lib/mt5RecoveryJournalAdapter.test.js and
// src/lib/mt5HistoryRecoveryScan.test.js: deal rows follow
// mt5-bridge/app.py validate_history_deal, page bodies follow
// server/routes/mt5.js historySuccessBody. Nothing here invents a
// key, so a page this suite feeds the pipeline is a page the route
// could have answered with.
//
// The recovery modules under test are real: no scan or adapter stub
// can prove that the orchestrator passes the scan's exact outcome
// through the existing gates instead of rebuilding evidence of its own.
// ============================================================

const LOGIN = "12345678";
const OTHER_LOGIN = "87654321";
const SERVER = "metatrader-demo";
const ACCOUNT_ID = "1767000000000";
const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";
const API_URL = "http://localhost:4000";

const W1 = { fromUtc: "2026-01-01T00:00:00Z", toUtc: "2026-01-08T00:00:00Z" };
const W2 = { fromUtc: "2026-01-08T00:00:00Z", toUtc: "2026-01-15T00:00:00Z" };

const OPEN_MSC = Date.parse("2026-01-03T01:00:00Z");
const CLOSE_MSC = Date.parse("2026-01-05T01:00:00Z");

let ticketCounter = 1000;

function deal(overrides = {}) {
  const index = ++ticketCounter;

  const fields = {
    ticket: String(overrides.ticket ?? index),
    order: String(overrides.order ?? 500_000 + index),
    position_id: String(overrides.position_id ?? 9_000),
    symbol: overrides.symbol ?? "EURUSD",
    type: overrides.type ?? 0,
    entry: overrides.entry ?? 0,
    volume: overrides.volume ?? "0.1",
    price: overrides.price ?? "1.10000",
    profit: overrides.profit ?? "0",
    commission: overrides.commission ?? "-0.35",
    swap: overrides.swap ?? "0",
    fee: overrides.fee ?? "0",
    time: 0,
    time_msc: overrides.time_msc ?? OPEN_MSC,
    comment: overrides.comment ?? "edgeflo",
    magic: overrides.magic ?? 12345,
  };

  fields.time = Math.floor(fields.time_msc / 1000);

  return { ...fields, raw: { ...fields, ticket: Number(fields.ticket) } };
}

function openDeal(positionId, volume, timeMsc, overrides = {}) {
  return deal({
    position_id: positionId,
    type: 0,
    entry: 0,
    volume,
    time_msc: timeMsc,
    ...overrides,
  });
}

function closeDeal(positionId, volume, timeMsc, overrides = {}) {
  return deal({
    position_id: positionId,
    type: 1,
    entry: 1,
    volume,
    time_msc: timeMsc,
    ...overrides,
  });
}

function historyPage(history, positions, window, { generation = 0 } = {}) {
  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity: { mt5Login: LOGIN, mt5Server: SERVER },
    utc_range: { from_utc: window.fromUtc, to_utc: window.toUtc },
    scan_range: { from_utc: window.fromUtc, to_utc: window.toUtc },
    coverage: {
      boundaries: "inclusive",
      returned_deal_count: history.length,
      serialized_deal_count: history.length,
    },
    retention_verified: false,
    bridge_boot_id: BOOT_ID,
    connection_generation: generation,
    count: history.length,
    history,
    positions,
    classification: {
      trade_deal_count: history.length,
      financial_deal_count: 0,
      unknown_type_count: 0,
    },
  };
}

function okJson(body) {
  return { ok: true, status: 200, json: async () => body };
}

function refusal(status, code) {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      page_query_complete: false,
      source_scan_complete: false,
      history: null,
      positions: null,
      code,
      message: "MT5 history is unavailable.",
    }),
  };
}

// One closed position inside W1, proved absent by the newest snapshot in W2:
// the only lifecycle these gates allow a proposal for. Tickets are fixed so
// two previews of one fixture are comparable record for record.
const CLEAN_LIFECYCLE = () => [
  openDeal("9001", "0.1", OPEN_MSC, { ticket: "2001", order: "3001" }),
  closeDeal("9001", "0.1", CLOSE_MSC, {
    ticket: "2002",
    order: "3002",
    profit: "1",
    swap: "-0.12",
  }),
];

function transport(...responses) {
  const calls = [];
  let index = 0;

  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    return responses[Math.min(index++, responses.length - 1)];
  };

  return { calls, fetchImpl };
}

const ACCOUNT = (overrides = {}) => ({
  id: ACCOUNT_ID,
  platform: "mt5",
  mt5Login: LOGIN,
  mt5Server: SERVER,
  brokerAccountId: LOGIN,
  ...overrides,
});

const LIVE_IDENTITY = { mt5Login: LOGIN, mt5Server: SERVER };

// An explicit `undefined` in these tests always means "the caller never
// provided it", never "fall back to the fixture", so a default here would
// quietly test the wrong input.
function preview(provided = {}) {
  const withDefault = (key, fallback) => (key in provided ? provided[key] : fallback);

  const pages = withDefault("pages", [
    historyPage(CLEAN_LIFECYCLE(), [], W1),
    historyPage([], [], W2),
  ]);

  const transportFixture = transport(
    ...pages.map((page) => (page.ok === false ? page : okJson(page)))
  );

  return planMT5RecoveryPreview({
    apiUrl: withDefault("apiUrl", API_URL),
    fetchImpl: withDefault("fetchImpl", transportFixture.fetchImpl),
    account: withDefault("account", ACCOUNT()),
    liveIdentity: withDefault("liveIdentity", LIVE_IDENTITY),
    windows: withDefault("windows", [W1, W2]),
    existingJournal: withDefault("existingJournal", []),
  }).then((result) => ({ calls: transportFixture.calls, result }));
}

function solo(items, what = "item") {
  assert.equal(items.length, 1, `expected one ${what}, got ${items.length}`);

  return items[0];
}

function blocked(result, code) {
  assert.equal(result.status, RECOVERY_ORCHESTRATOR_STATUS.BLOCKED);
  assert.deepEqual([...result.records], []);
  assert.deepEqual([...result.skipped], []);
  assert.deepEqual([...result.rejected], []);
  assert.ok(
    result.refusals.includes(code),
    `expected refusal ${code}, got ${JSON.stringify(result.refusals)}`
  );

  return result;
}

// ============================================================
// 1. Nothing is read before the account is confirmed
// ============================================================

test("blocks without a persisted account identity and asks for no history", async () => {
  const { calls, result } = await preview({ account: undefined });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_REQUIRED);
  assert.equal(calls.length, 0);
});

test("blocks a persisted account that cannot name its MT5 login and asks for no history", async () => {
  const { calls, result } = await preview({
    account: ACCOUNT({ mt5Login: undefined }),
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_REQUIRED);
  assert.equal(calls.length, 0);
});

test("blocks a persisted account without an id and asks for no history", async () => {
  const { calls, result } = await preview({ account: ACCOUNT({ id: "" }) });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_REQUIRED);
  assert.equal(calls.length, 0);
});

test("blocks without a confirmed live identity and asks for no history", async () => {
  const { calls, result } = await preview({ liveIdentity: undefined });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.LIVE_IDENTITY_REQUIRED);
  assert.equal(calls.length, 0);
});

test("blocks a login that is not a positive decimal number and asks for no history", async () => {
  for (const liveIdentity of [
    { mt5Login: "12345678a", mt5Server: SERVER },
    { mt5Login: "0", mt5Server: SERVER },
    { mt5Login: LOGIN, mt5Server: "   " },
  ]) {
    const { calls, result } = await preview({ liveIdentity });

    blocked(result, RECOVERY_ORCHESTRATOR_REASONS.LIVE_IDENTITY_REQUIRED);
    assert.equal(calls.length, 0);
  }
});

test("blocks when the live identity names another account and asks for no history", async () => {
  const { calls, result } = await preview({
    liveIdentity: { mt5Login: "87654321", mt5Server: SERVER },
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_MISMATCH);
  assert.equal(calls.length, 0);
});

test("blocks when the live identity names another server and asks for no history", async () => {
  const { calls, result } = await preview({
    liveIdentity: { mt5Login: LOGIN, mt5Server: "metatrader-live" },
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_MISMATCH);
  assert.equal(calls.length, 0);
});

test("confirms a server that differs only by case or padding, but still lets the pages speak", async () => {
  const { calls, result } = await preview({
    liveIdentity: { mt5Login: LOGIN, mt5Server: " MetaTrader-Demo " },
  });

  assert.equal(calls.length, 2);
  assert.equal(result.status, RECOVERY_ORCHESTRATOR_STATUS.PREVIEW);
  assert.equal(solo(result.records).id, `mt5-position-${LOGIN}-9001`);
});

test("confirms a login stored as a number or with padding on either side", async () => {
  const { calls, result } = await preview({
    account: ACCOUNT({ mt5Login: ` 00${LOGIN} ` }),
    liveIdentity: { mt5Login: Number(LOGIN), mt5Server: SERVER },
  });

  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).searchParams.get("mt5_login"), LOGIN);
  assert.equal(result.identity.mt5Login, LOGIN);
  assert.equal(solo(result.records).mt5Login, LOGIN);
});

// Phase 3X-6E: this module's login rule is the one in recoveryClock.js, so
// the two have to agree spelling for spelling. Every expectation below is
// read back from the shared function instead of being restated here, which
// makes these tests about the wiring at each call site rather than a second
// copy of a table somebody could keep in sync by hand.
const LOGIN_SPELLINGS = [
  LOGIN,
  `00${LOGIN}`,
  ` 00${LOGIN} `,
  Number(LOGIN),
  `00000000000${LOGIN}`,
  "0",
  "0000",
  "12345678a",
  "1234567890123456",
  "-12345678",
  1.5,
  "",
  "   ",
  undefined,
  null,
];

function canonicalOrNone(value) {
  const verdict = canonicalLogin(value);

  return typeof verdict.login === "string" ? verdict.login : null;
}

test("agrees with the shared login rule about the account it is handed", async () => {
  for (const spelling of LOGIN_SPELLINGS) {
    const expected = canonicalOrNone(spelling);
    const { calls, result } = await preview({
      account: ACCOUNT({ mt5Login: spelling }),
    });

    if (expected === null) {
      blocked(
        result,
        RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_REQUIRED
      );
      assert.equal(calls.length, 0, `no history for "${String(spelling)}"`);
      continue;
    }

    assert.equal(
      result.status,
      RECOVERY_ORCHESTRATOR_STATUS.PREVIEW,
      `"${String(spelling)}" canonicalises to ${expected}, got ${JSON.stringify(result.refusals)}`
    );
    assert.equal(result.identity.mt5Login, expected);
    assert.equal(solo(result.records).mt5Login, expected);
    assert.equal(new URL(calls[0].url).searchParams.get("mt5_login"), expected);
  }
});

test("agrees with the shared login rule about the live identity", async () => {
  for (const spelling of LOGIN_SPELLINGS) {
    const expected = canonicalOrNone(spelling);

    // The account stays in the pipeline's canonical form, so only the
    // live-side reading of the same rule is under test here.
    const { calls, result } = await preview({
      liveIdentity: { mt5Login: spelling, mt5Server: SERVER },
    });

    if (expected === null) {
      blocked(
        result,
        RECOVERY_ORCHESTRATOR_REASONS.LIVE_IDENTITY_REQUIRED
      );
      assert.equal(calls.length, 0, `no history for "${String(spelling)}"`);
      continue;
    }

    assert.equal(
      result.status,
      RECOVERY_ORCHESTRATOR_STATUS.PREVIEW,
      `"${String(spelling)}" canonicalises to ${expected}, got ${JSON.stringify(result.refusals)}`
    );
    assert.equal(result.identity.mt5Login, LOGIN);
  }
});

test("canonicalising a login never lets one account confirm another", async () => {
  const { calls, result } = await preview({
    liveIdentity: { mt5Login: `000${OTHER_LOGIN}`, mt5Server: SERVER },
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_MISMATCH);
  assert.equal(calls.length, 0);
});

// ============================================================
// 2. The scan it runs is the existing scan, unchanged
// ============================================================

test("previews the journal-safe record a clean scan of the confirmed account produces", async () => {
  const { calls, result } = await preview();

  assert.equal(result.status, RECOVERY_ORCHESTRATOR_STATUS.PREVIEW);
  assert.deepEqual([...result.refusals], []);

  const record = solo(result.records);

  assert.equal(record.positionId, "9001");
  assert.equal(record.accountId, ACCOUNT_ID);
  assert.equal(record.brokerPositionId, "9001");
  assert.equal(record.source, "history-recovery");
  assert.equal(record.status, "CLOSED");
  assert.equal(record.netProfit, "0.18");
  assert.equal(result.skipped.length, 0);

  const first = new URL(calls[0].url);
  const second = new URL(calls[1].url);

  assert.equal(calls.length, 2);
  assert.equal(first.pathname, "/api/mt5/history");
  assert.equal(first.searchParams.get("mt5_login"), LOGIN);
  assert.equal(first.searchParams.get("mt5_server"), SERVER);
  assert.equal(first.searchParams.get("from_utc"), W1.fromUtc);
  assert.equal(first.searchParams.get("to_utc"), W1.toUtc);
  assert.equal(second.searchParams.get("from_utc"), W2.fromUtc);
  assert.deepEqual(calls[0].options, { cache: "no-store" });
});

test("hands the adapter the scan outcome itself rather than a rebuilt one", async () => {
  const { result } = await preview();

  assert.equal(Object.isFrozen(result.outcome), true);
  assert.deepEqual(result.outcome.identity, result.identity);
  assert.equal(result.outcome.result.closed.length, 1);
  assert.equal(result.outcome.pages.length, 2);

  // The proposal quotes the scan's own live snapshot instant, so a record
  // cannot have come from a different read than the evidence carried here.
  assert.equal(
    result.outcome.result.scan.liveSnapshotToUtc,
    solo(result.records).liveSnapshotToUtc
  );
});

test("blocks a scan with no windows to read and asks for no history", async () => {
  for (const windows of [
    undefined,
    [],
    [W1, null],
    [{ fromUtc: "2026-01-01T00:00:00+03:00", toUtc: W1.toUtc }],
    [{ fromUtc: W1.toUtc, toUtc: W1.fromUtc }],
  ]) {
    const { calls, result } = await preview({ windows });

    blocked(result, RECOVERY_ORCHESTRATOR_REASONS.RECOVERY_WINDOWS_REQUIRED);
    assert.equal(calls.length, 0);
  }
});

test("blocks a window with sub-second precision before asking for any history", async () => {
  // The bridge truncates a range bound to the second and then refuses a page
  // containing a deal in the dropped fraction (mt5-bridge/app.py:6337-6338
  // with :6235), so an exact-millisecond window is a doomed request.
  const { calls, result } = await preview({
    windows: [
      { fromUtc: "2026-01-01T00:00:00.500Z", toUtc: "2026-01-08T00:00:00Z" },
      W2,
    ],
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.RECOVERY_WINDOWS_REQUIRED);
  assert.equal(calls.length, 0);
});

test("blocks a window wider than one bridge page before asking for any history", async () => {
  const { calls, result } = await preview({
    windows: [
      {
        fromUtc: "2025-01-01T00:00:00Z",
        toUtc: "2026-01-02T00:00:01Z",
      },
    ],
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.RECOVERY_WINDOWS_REQUIRED);
  assert.equal(calls.length, 0);
});

test("blocks a window wider than the 30-day recovery tile before asking for any history", async () => {
  // The bridge would answer a page of up to 365 days, but the recovery policy
  // reads at most TILE_DAYS at a time (mt5RecoveryWindows.js), because the
  // deals that fit in one page were never proven against a real account. A
  // hand-supplied wider window is a policy violation, not a shortcut.
  for (const windows of [
    [{ fromUtc: "2026-01-01T00:00:00Z", toUtc: "2026-02-01T00:00:00Z" }],
    [{ fromUtc: "2026-01-01T00:00:00Z", toUtc: "2026-02-10T00:00:00Z" }],
    [{ fromUtc: "2025-01-01T00:00:00Z", toUtc: "2026-01-01T00:00:00Z" }],
    [
      W2,
      { fromUtc: "2026-01-15T00:00:00Z", toUtc: "2026-02-15T00:00:01Z" },
    ],
  ]) {
    const { calls, result } = await preview({ windows });

    blocked(result, RECOVERY_ORCHESTRATOR_REASONS.RECOVERY_WINDOWS_REQUIRED);
    assert.equal(calls.length, 0);
  }
});

test("accepts a window of exactly 30 days", async () => {
  // The tile ceiling is inclusive: 30 days is the widest read the policy
  // allows, so exactly 30 must reach the scan instead of being refused.
  const TILE = {
    fromUtc: "2026-01-01T00:00:00Z",
    toUtc: "2026-01-31T00:00:00Z",
  };

  const { calls, result } = await preview({
    windows: [TILE],
    pages: [historyPage(CLEAN_LIFECYCLE(), [], TILE)],
  });

  assert.equal(calls.length, 1);
  assert.equal(result.status, RECOVERY_ORCHESTRATOR_STATUS.PREVIEW);
  assert.equal(solo(result.records).positionId, "9001");
});

test("blocks without a transport instead of throwing", async () => {
  const result = await planMT5RecoveryPreview({
    apiUrl: API_URL,
    account: ACCOUNT(),
    liveIdentity: LIVE_IDENTITY,
    windows: [W1, W2],
    existingJournal: [],
  });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.FETCH_TRANSPORT_REQUIRED);
});

test("blocks without an API base URL", async () => {
  const { calls, result } = await preview({ apiUrl: "   " });

  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.API_URL_REQUIRED);
  assert.equal(calls.length, 0);
});

// ============================================================
// 3. Every existing gate still stops a proposal
// ============================================================

test("proposes nothing for a refused page", async () => {
  const { calls, result } = await preview({
    pages: [
      historyPage(CLEAN_LIFECYCLE(), [], W1),
      refusal(504, "MT5_HISTORY_TIMEOUT"),
    ],
  });

  assert.equal(calls.length, 2);
  blocked(result, R.SCAN_RETRY_REQUIRED);
  assert.ok(result.refusals.includes(R.SCAN_REFUSALS_PRESENT));
  assert.ok(result.refusals.includes(R.REJECTED_PAGES_PRESENT));
  assert.equal(result.outcome.result.closed.length, 0);
});

test("proposes nothing when the accepted pages span two bridge generations", async () => {
  const { result } = await preview({
    pages: [
      historyPage(CLEAN_LIFECYCLE(), [], W1, { generation: 0 }),
      historyPage([], [], W2, { generation: 1 }),
    ],
  });

  assert.equal(result.outcome.result.scan.generationAmbiguous, true);
  blocked(result, R.SNAPSHOT_GENERATION_AMBIGUOUS);
});

test("proposes nothing for a scan that accepted no page at all", async () => {
  const { result } = await preview({
    pages: [refusal(502, "MT5_NOT_CONNECTED"), refusal(502, "MT5_NOT_CONNECTED")],
  });

  blocked(result, R.NO_ACCEPTED_PAGE_EVIDENCE);
});

test("proposes nothing when the pages name an account other than the one confirmed", async () => {
  const first = historyPage(CLEAN_LIFECYCLE(), [], W1);
  const newest = historyPage([], [], W2);

  // The route echoes the bridge identity, so a page naming someone else was
  // not read for this account. The orchestrator still asks, and still refuses.
  first.identity = { mt5Login: "87654321", mt5Server: SERVER };
  newest.identity = { mt5Login: "87654321", mt5Server: SERVER };

  const { result } = await preview({ pages: [first, newest] });

  blocked(result, R.SCAN_IDENTITY_MISMATCH);
});

test("proposes nothing for a journal it cannot read", async () => {
  const { result } = await preview({ existingJournal: undefined });

  blocked(result, R.EXISTING_JOURNAL_INVALID);
});

// ============================================================
// 4. Duplicates and repeat scans
// ============================================================

test("skips a position the journal already holds by id instead of proposing it twice", async () => {
  const { result } = await preview({
    existingJournal: [
      {
        id: `mt5-position-${LOGIN}-9001`,
        accountId: ACCOUNT_ID,
        broker: "MT5",
        brokerPositionId: "9001",
      },
    ],
  });

  assert.equal(result.status, RECOVERY_ORCHESTRATOR_STATUS.PREVIEW);
  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped).reason, R.ALREADY_JOURNALED_ID);
});

test("skips a position the journal already holds under a different id", async () => {
  const { result } = await preview({
    existingJournal: [
      {
        id: "trade-from-the-live-poller",
        accountId: ACCOUNT_ID,
        broker: "MT5",
        brokerPositionId: "9001",
      },
    ],
  });

  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped).reason, R.ALREADY_JOURNALED_POSITION);
});

test("still proposes when the same position number belongs to another account", async () => {
  const { result } = await preview({
    existingJournal: [
      {
        id: "mt5-position-87654321-9001",
        accountId: "1767000099999",
        broker: "MT5",
        brokerPositionId: "9001",
      },
    ],
  });

  assert.equal(solo(result.records).positionId, "9001");
  assert.equal(result.skipped.length, 0);
});

test("repeating the scan skips what the first preview already offered", async () => {
  const first = await preview();

  assert.equal(solo(first.result.records).positionId, "9001");

  const second = await preview({ existingJournal: [...first.result.records] });

  assert.equal(second.calls.length, 2);
  assert.equal(second.result.status, RECOVERY_ORCHESTRATOR_STATUS.PREVIEW);
  assert.deepEqual([...second.result.records], []);
  assert.equal(solo(second.result.skipped).reason, R.ALREADY_JOURNALED_ID);
  assert.deepEqual(
    [...second.result.skipped.map((entry) => entry.id)],
    [...first.result.records.map((record) => record.id)]
  );
});

test("a second preview over an untouched journal offers the same record again", async () => {
  const first = await preview();
  const second = await preview();

  assert.deepEqual(
    [...second.result.records],
    [...first.result.records]
  );
});

// ============================================================
// 5. A preview is not a write, and not a claim of completeness
// ============================================================

test("states that nothing was journaled and no watermark moved", async () => {
  const { result } = await preview();

  assert.equal(result.journalWritten, false);
  assert.equal(result.watermarkAdvanced, false);
});

test("never claims full coverage or verified retention", async () => {
  const existingJournal = [{ id: "keep", accountId: ACCOUNT_ID }];

  const { result } = await preview({ existingJournal });

  assert.equal(result.coverageComplete, false);
  assert.equal(result.retentionVerified, false);
  assert.equal(result.outcome.result.scan.coverageComplete, false);
  assert.equal(
    result.outcome.pages
      .filter((record) => record.accepted === true)
      .every((record) => record.page.retention_verified === false),
    true
  );

  for (const record of result.records) {
    assert.equal(record.coverageComplete, false);
    assert.equal(Object.isFrozen(record), true);
  }
});

test("leaves the journal and the account it was handed unchanged", async () => {
  const account = ACCOUNT();
  const existingJournal = [{ id: "keep", accountId: ACCOUNT_ID }];

  const before = JSON.stringify({ account, existingJournal });

  const { result } = await preview({ account, existingJournal });

  assert.equal(JSON.stringify({ account, existingJournal }), before);
  assert.equal(result.status, RECOVERY_ORCHESTRATOR_STATUS.PREVIEW);
  assert.equal(solo(result.records).positionId, "9001");
});

test("freezes the preview so no caller can rewrite it into a commit", async () => {
  const { result } = await preview();

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.records), true);
  assert.equal(Object.isFrozen(result.refusals), true);
  assert.equal(Object.isFrozen(result.remaining), true);
});
