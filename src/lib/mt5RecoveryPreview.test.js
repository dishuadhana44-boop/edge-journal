import test from "node:test";
import assert from "node:assert/strict";

import {
  planRecoveryPreviewFromClock,
  RECOVERY_PREVIEW_STATUS,
  RECOVERY_PREVIEW_REASONS,
} from "./mt5RecoveryPreview.js";

import {
  captureRecoveryClockSample,
  RECOVERY_CLOCK_REASONS,
} from "../utils/trading/recoveryClock.js";

import {
  RECOVERY_WINDOW_POLICY,
  RECOVERY_WINDOW_REASONS,
} from "./mt5RecoveryWindows.js";

import { RECOVERY_ADAPTER_REASONS as R } from "./mt5RecoveryJournalAdapter.js";

import { RECOVERY_ORCHESTRATOR_REASONS } from "./mt5RecoveryOrchestrator.js";

// ============================================================
// Fixtures
//
// Every payload here is copied from its producer, the same way
// src/lib/mt5RecoveryOrchestrator.test.js does it: a deal row carries exactly
// the 16 keys of HISTORY_DEAL_REQUIRED_FIELDS (mt5-bridge/app.py:5630-5647)
// plus the `raw` copy app.py:6305 attaches, and a page body carries the keys
// server/routes/mt5.js historySuccessBody forwards (:1016-1047). Nothing is
// invented, so a scan this suite answers is a scan the route could answer.
//
// The clock sample is produced by captureRecoveryClockSample itself, and the
// scan, adapter and orchestrator are the real modules: a stub for any of them
// could not prove that the coordinator hands evidence through the existing
// gates instead of rebuilding a friendlier version of it.
// ============================================================

const LOGIN = "12345678";
const SERVER = "metatrader-demo";
const ACCOUNT_ID = "1767000000000";
const BOOT_ID = "0f1e2d3c4b5a69788f7e6d5c4b3a2918";
const API_URL = "http://localhost:4000";

const DAY_MS = 86_400_000;

const CLIENT_NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const BROKER_MSC = CLIENT_NOW + 850;
const ASSESS_NOW = CLIENT_NOW + 5_000;

// assessRecoveryClock anchors at broker time plus elapsed client time, floored
// to the second: 850 + 5000 ms -> 5000 ms past the sampled instant.
const ANCHOR_MS = CLIENT_NOW + 5_000;
const ANCHOR_UTC = "2026-10-21T12:00:05Z";

// The 90-day lookback in 30-day tiles, written out independently of
// mt5RecoveryWindows.js so a change to that module's arithmetic shows up here.
const EXPECTED_WINDOWS = [
  { fromUtc: iso(ANCHOR_MS - 90 * DAY_MS), toUtc: iso(ANCHOR_MS - 60 * DAY_MS) },
  { fromUtc: iso(ANCHOR_MS - 60 * DAY_MS), toUtc: iso(ANCHOR_MS - 30 * DAY_MS) },
  { fromUtc: iso(ANCHOR_MS - 30 * DAY_MS), toUtc: iso(ANCHOR_MS) },
];

function iso(ms) {
  return new Date(ms).toISOString().slice(0, 19) + "Z";
}

// Inside the first tile, and absent from the newest live snapshot.
const OPEN_MSC = ANCHOR_MS - 75 * DAY_MS;
const CLOSE_MSC = ANCHOR_MS - 74 * DAY_MS;

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

function historyPage(history, window, { generation = 0, identity } = {}) {
  return {
    success: true,
    page_query_complete: true,
    source_scan_complete: false,
    identity: identity ?? { mt5Login: LOGIN, mt5Server: SERVER },
    requested_range: { from_utc: window.fromUtc, to_utc: window.toUtc },
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
    positions: [],
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

// One closed position in the first tile, proved absent by the newest live
// snapshot in the last one. Tickets are fixed so two previews of one fixture
// are comparable record for record.
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

// The sample is whatever captureRecoveryClockSample agreed to remember, so a
// fixture cannot smuggle through a marker the bridge would never report.
function clockSample(
  captureOverrides = {},
  { account = ACCOUNT() } = {}
) {
  const outcome = captureRecoveryClockSample({
    brokerTimeMsc: BROKER_MSC,
    brokerTimeSource: "tick.time_msc",
    sampledAtClientMsc: CLIENT_NOW,
    expectedIdentity: {
      mt5Login: account.mt5Login,
      mt5Server: account.mt5Server,
    },
    returnedIdentity: {
      mt5Login: LOGIN,
      mt5Server: SERVER,
    },
    ...captureOverrides,
  });

  assert.equal(
    outcome.status,
    "ACCEPTED",
    `fixture clock sample was refused: ${outcome.reason}`
  );

  return outcome.sample;
}

// An explicit `undefined` in these tests always means "the caller never
// provided it", never "fall back to the fixture". Anything else the test names
// is forwarded untouched, so a caller can try to smuggle in its own windows.
const COORDINATOR_KEYS = [
  "apiUrl",
  "fetchImpl",
  "account",
  "clockSample",
  "now",
  "existingJournal",
];

async function preview(provided = {}) {
  const withDefault = (key, fallback) =>
    key in provided ? provided[key] : fallback;

  const windows = EXPECTED_WINDOWS;

  const pages = withDefault("pages", [
    historyPage(CLEAN_LIFECYCLE(), windows[0]),
    historyPage([], windows[1]),
    historyPage([], windows[2]),
  ]);

  const transportFixture = transport(
    ...pages.map((page) => (page.ok === false ? page : okJson(page)))
  );

  const input = {
    apiUrl: withDefault("apiUrl", API_URL),
    fetchImpl: withDefault("fetchImpl", transportFixture.fetchImpl),
    account: withDefault("account", ACCOUNT()),
    clockSample: withDefault("clockSample", clockSample()),
    now: withDefault("now", ASSESS_NOW),
    existingJournal: withDefault("existingJournal", []),
  };

  for (const [key, value] of Object.entries(provided)) {
    if (key === "pages" || COORDINATOR_KEYS.includes(key)) continue;

    input[key] = value;
  }

  const result = await planRecoveryPreviewFromClock(input);

  return { calls: transportFixture.calls, result };
}

function solo(items, what = "item") {
  assert.equal(items.length, 1, `expected one ${what}, got ${items.length}`);

  return items[0];
}

function blocked(result, code) {
  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.BLOCKED);
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
// 1. Nothing is read before the broker clock is trusted
// ============================================================

test("previews the closed position a fresh broker clock and a clean scan support", async () => {
  const { calls, result } = await preview();

  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.PREVIEW);
  assert.deepEqual([...result.refusals], []);
  assert.equal(result.anchorUtc, ANCHOR_UTC);
  assert.equal(calls.length, 3);

  const record = solo(result.records);

  assert.equal(record.id, `mt5-position-${LOGIN}-9001`);
  assert.equal(record.accountId, ACCOUNT_ID);
  assert.equal(record.source, "history-recovery");
  assert.equal(record.status, "CLOSED");
  assert.equal(record.netProfit, "0.18");
});

test("asks for exactly the whole-second windows the accepted anchor covers", async () => {
  const { calls, result } = await preview();

  assert.equal(result.anchorUtc, ANCHOR_UTC);

  const requested = calls.map((call) => {
    const url = new URL(call.url);

    return {
      fromUtc: url.searchParams.get("from_utc"),
      toUtc: url.searchParams.get("to_utc"),
      path: url.pathname,
    };
  });

  assert.deepEqual(requested, EXPECTED_WINDOWS.map((window) => ({
    fromUtc: window.fromUtc,
    toUtc: window.toUtc,
    path: "/api/mt5/history",
  })));

  assert.deepEqual([...result.windows], EXPECTED_WINDOWS);
});

test("requests history under the identity the broker itself reported", async () => {
  const { calls, result } = await preview({
    account: ACCOUNT({ mt5Login: ` 00${LOGIN} ` }),
    clockSample: clockSample(),
  });

  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.PREVIEW);
  assert.equal(result.identity.mt5Login, LOGIN);
  assert.equal(result.identity.mt5Server, SERVER);

  for (const call of calls) {
    const url = new URL(call.url);

    assert.equal(url.searchParams.get("mt5_login"), LOGIN);
    assert.equal(url.searchParams.get("mt5_server"), SERVER);
    assert.deepEqual(call.options, { cache: "no-store" });
  }
});

test("blocks a preview with no clock sample and asks for no history", async () => {
  for (const clockSampleValue of [undefined, null, "1767225600000"]) {
    const { calls, result } = await preview({ clockSample: clockSampleValue });

    assert.equal(calls.length, 0);
    blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
    assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.SAMPLE_MISSING);
    assert.equal(result.anchorUtc, null);
  }
});

test("blocks a stale clock sample and asks for no history", async () => {
  const { calls, result } = await preview({
    now: CLIENT_NOW + 11_000,
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.STALE);
});

test("blocks a remembered sample whose source is not an MT5 tick", async () => {
  // State can only hold what capture agreed to, so the tampering is explicit:
  // a sample carrying the bridge's own wall-clock fallback.
  for (const brokerTimeSource of ["local_wall_clock", undefined, "system_clock"]) {
    const tampered = { ...clockSample() };

    if (brokerTimeSource === undefined) delete tampered.brokerTimeSource;
    else tampered.brokerTimeSource = brokerTimeSource;

    const { calls, result } = await preview({ clockSample: tampered });

    assert.equal(calls.length, 0);
    blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
    assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.SOURCE_UNTRUSTED);
  }

  // A bare object is sample-shaped but never reported a marker, which is the
  // first thing wrong with it — same refusal the clock suite pins for itself.
  const bare = await preview({ clockSample: {} });

  assert.equal(bare.calls.length, 0);
  blocked(bare.result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(bare.result.clock.reason, RECOVERY_CLOCK_REASONS.SOURCE_UNTRUSTED);
});

test("blocks a clock sample that belongs to another account and asks for no history", async () => {
  const { calls, result } = await preview({
    clockSample: clockSample(
      { returnedIdentity: { mt5Login: "87654321", mt5Server: SERVER } },
      { account: ACCOUNT({ mt5Login: "87654321" }) }
    ),
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.IDENTITY_MISMATCH);
});

test("blocks when the account record cannot name its MT5 identity", async () => {
  for (const [account, code] of [
    [ACCOUNT({ mt5Login: undefined }), RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED],
    [ACCOUNT({ mt5Server: "   " }), RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED],
    [undefined, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED],
    // A record that can name its broker account but not itself is the
    // orchestrator's own gate, reached only after the clock is trusted.
    [ACCOUNT({ id: "" }), RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_REQUIRED],
  ]) {
    const { calls, result } = await preview({ account });

    assert.equal(calls.length, 0);
    blocked(result, code);
  }
});

test("blocks without an injected now instead of reading the machine clock", async () => {
  const { calls, result } = await preview({ now: undefined });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.NOW_MISSING);
  assert.equal(result.anchorUtc, null);
});

test("blocks a sample taken in the future and never anchors on local time", async () => {
  const { calls, result } = await preview({
    now: CLIENT_NOW - 60_000,
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.SAMPLE_IN_FUTURE);
  assert.equal(result.anchorUtc, null);
  assert.equal(result.anchorMs, null);
});

// ============================================================
// 2. The window plan comes from the accepted anchor and the policy
// ============================================================

test("plans the 90-day lookback in tiles no wider than the 30-day policy", async () => {
  const { result } = await preview();

  assert.equal(
    result.windowPlan.refusal,
    null,
    `window plan was refused: ${result.windowPlan.refusal}`
  );
  assert.equal(result.windows.length, 3);
  assert.equal(
    RECOVERY_WINDOW_POLICY.LOOKBACK_DAYS / RECOVERY_WINDOW_POLICY.TILE_DAYS,
    3
  );

  for (const window of result.windows) {
    assert.equal(
      Date.parse(window.toUtc) - Date.parse(window.fromUtc) <=
        RECOVERY_WINDOW_POLICY.TILE_DAYS * DAY_MS,
      true
    );
  }

  assert.equal(result.windows[0].fromUtc, iso(ANCHOR_MS - 90 * DAY_MS));
  assert.equal(result.windows[result.windows.length - 1].toUtc, ANCHOR_UTC);
});

test("blocks a broker clock too close to the epoch to cover the lookback", async () => {
  // The bridge will not read before 1970, so a tick that reports a nonsense
  // instant must stop the scan instead of planning a doomed range.
  const { calls, result } = await preview({
    clockSample: clockSample({ brokerTimeMsc: 1_000 }),
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.WINDOWS_REFUSED);
  assert.equal(
    result.windowPlan.refusal,
    RECOVERY_WINDOW_REASONS.ANCHOR_OUT_OF_RANGE
  );
  assert.equal(result.anchorUtc, "1970-01-01T00:00:06Z");
});

test("ignores a caller-supplied window list instead of trusting it", async () => {
  // A wide or hand-made range is exactly what the window policy exists to
  // prevent, so the coordinator derives windows from the anchor alone.
  const { calls, result } = await preview({
    windows: [{ fromUtc: "2020-01-01T00:00:00Z", toUtc: ANCHOR_UTC }],
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0]),
      historyPage([], EXPECTED_WINDOWS[1]),
      historyPage([], EXPECTED_WINDOWS[2]),
    ],
  });

  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.PREVIEW);
  assert.equal(calls.length, 3);
  assert.equal(new URL(calls[0].url).searchParams.get("from_utc"), EXPECTED_WINDOWS[0].fromUtc);
});

// ============================================================
// 3. Every existing scan and adapter gate still stops a proposal
// ============================================================

test("proposes nothing for a refused history page", async () => {
  const { calls, result } = await preview({
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0]),
      historyPage([], EXPECTED_WINDOWS[1]),
      refusal(504, "MT5_HISTORY_TIMEOUT"),
    ],
  });

  assert.equal(calls.length, 3);
  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.BLOCKED);
  assert.ok(result.refusals.includes(R.SCAN_RETRY_REQUIRED));
  assert.ok(result.refusals.includes(R.REJECTED_PAGES_PRESENT));
  assert.deepEqual([...result.records], []);
});

test("proposes nothing when a refusal leaves the snapshot evidence incomplete", async () => {
  // The scan always drops a refused page's body (mt5HistoryRecoveryScan.js:96
  // -98), so an Express refusal carries no range and the newest live snapshot
  // can never be certified. This is the same fixture as the refused-page test
  // above, naming the gate that the rejection additionally trips.
  const { result } = await preview({
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0]),
      historyPage([], EXPECTED_WINDOWS[1]),
      refusal(504, "MT5_HISTORY_TIMEOUT"),
    ],
  });

  assert.ok(result.refusals.includes(R.SNAPSHOT_EVIDENCE_INCOMPLETE));
  assert.deepEqual([...result.records], []);
});

test("proposes nothing when the accepted pages span two bridge generations", async () => {
  const { result } = await preview({
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0], { generation: 0 }),
      historyPage([], EXPECTED_WINDOWS[1], { generation: 0 }),
      historyPage([], EXPECTED_WINDOWS[2], { generation: 1 }),
    ],
  });

  blocked(result, R.SNAPSHOT_GENERATION_AMBIGUOUS);
});

test("proposes nothing when the pages name an account other than the clock's", async () => {
  const other = { mt5Login: "87654321", mt5Server: SERVER };

  const { result } = await preview({
    pages: EXPECTED_WINDOWS.map((window, index) =>
      historyPage(index === 0 ? CLEAN_LIFECYCLE() : [], window, {
        identity: other,
      })
    ),
  });

  blocked(result, R.SCAN_IDENTITY_MISMATCH);
});

test("proposes nothing for a scan that accepted no page at all", async () => {
  const { calls, result } = await preview({
    pages: [
      refusal(502, "MT5_NOT_CONNECTED"),
      refusal(502, "MT5_NOT_CONNECTED"),
      refusal(502, "MT5_NOT_CONNECTED"),
    ],
  });

  assert.equal(calls.length, 3);
  blocked(result, R.NO_ACCEPTED_PAGE_EVIDENCE);
});

// ============================================================
// 4. Dedupe, repeats and the read-only promise
// ============================================================

test("skips a position the journal already holds instead of proposing it twice", async () => {
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

  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.PREVIEW);
  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped).reason, R.ALREADY_JOURNALED_ID);
});

test("repeating the preview skips what the first run offered", async () => {
  const first = await preview();

  assert.equal(solo(first.result.records).positionId, "9001");

  const second = await preview({
    existingJournal: [...first.result.records],
  });

  assert.equal(second.calls.length, 3);
  assert.equal(second.result.status, RECOVERY_PREVIEW_STATUS.PREVIEW);
  assert.deepEqual([...second.result.records], []);
  assert.equal(solo(second.result.skipped).reason, R.ALREADY_JOURNALED_ID);
});

test("blocks when the caller hands no journal to dedupe against", async () => {
  const { result } = await preview({ existingJournal: undefined });

  blocked(result, R.EXISTING_JOURNAL_INVALID);
});

test("leaves the journal and the account record it was handed unchanged", async () => {
  const account = ACCOUNT();
  const existingJournal = [
    { id: "keep", accountId: ACCOUNT_ID, symbol: "GBPUSD" },
  ];

  const before = JSON.stringify({ account, existingJournal });

  const { result } = await preview({ account, existingJournal });

  assert.equal(JSON.stringify({ account, existingJournal }), before);
  assert.equal(result.status, RECOVERY_PREVIEW_STATUS.PREVIEW);
  assert.equal(solo(result.records).positionId, "9001");
});

test("never touches storage and states that nothing was journaled or advanced", async () => {
  const touched = [];

  const storage = {
    getItem(key) {
      touched.push(`get:${key}`);
      return null;
    },
    setItem(key) {
      touched.push(`set:${key}`);
    },
    removeItem(key) {
      touched.push(`remove:${key}`);
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });

  try {
    const previewed = await preview();
    const blockedRun = await preview({ now: undefined });

    assert.equal(previewed.result.journalWritten, false);
    assert.equal(previewed.result.watermarkAdvanced, false);
    assert.equal(blockedRun.result.journalWritten, false);
    assert.equal(blockedRun.result.watermarkAdvanced, false);
    assert.deepEqual(touched, []);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});

test("never claims full coverage or verified retention", async () => {
  const { result } = await preview();

  assert.equal(result.coverageComplete, false);
  assert.equal(result.retentionVerified, false);
  assert.equal(result.outcome.result.scan.coverageComplete, false);

  for (const record of result.records) {
    assert.equal(record.coverageComplete, false);
  }
});

test("freezes the preview so no caller can rewrite it into a commit", async () => {
  const { result } = await preview();

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.records), true);
  assert.equal(Object.isFrozen(result.refusals), true);
  assert.equal(Object.isFrozen(result.windows), true);

  const blockedRun = await preview({ now: undefined });

  assert.equal(Object.isFrozen(blockedRun.result), true);
  assert.equal(Object.isFrozen(blockedRun.result.refusals), true);
});
