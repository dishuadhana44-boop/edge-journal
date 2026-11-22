import test from "node:test";
import assert from "node:assert/strict";

import {
  planRecoveryPreviewForAccount,
  RECOVERY_ACCOUNT_PREVIEW_STATUS,
  RECOVERY_ACCOUNT_PREVIEW_REASONS,
} from "./mt5RecoveryAccountPreview.js";

import {
  canonicalLogin,
  captureRecoveryClockSample,
  RECOVERY_CLOCK_REASONS,
} from "../utils/trading/recoveryClock.js";

import { RECOVERY_PREVIEW_REASONS } from "./mt5RecoveryPreview.js";
import { RECOVERY_WINDOW_REASONS } from "./mt5RecoveryWindows.js";
import { RECOVERY_ORCHESTRATOR_REASONS } from "./mt5RecoveryOrchestrator.js";
import { RECOVERY_ADAPTER_REASONS as R } from "./mt5RecoveryJournalAdapter.js";

// ============================================================
// Fixtures
//
// The wire format is copied from the producers, exactly as in
// src/lib/mt5RecoveryPreview.test.js: deal rows follow
// mt5-bridge/app.py validate_history_deal (HISTORY_DEAL_REQUIRED_FIELDS,
// :5630-5647 plus the `raw` copy at :6305), page bodies follow
// server/routes/mt5.js historySuccessBody (:1016-1047), and a persisted
// account row carries the keys src/components/settings/AddTradingAccountModal.jsx
// writes into localStorage["tradingAccounts"] (:34-105) — `id`, `mt5Login`,
// `mt5Server`, `brokerAccountId`, and no invented platform key.
//
// The clock sample comes from captureRecoveryClockSample itself and every
// stage below this module (preview coordinator, orchestrator, scan, adapter,
// reconstruction) is the real thing: a stub for any of them could not prove
// that resolution hands the pipeline the account the live identity names and
// the gates it already has, rather than a friendlier substitute.
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

// broker time + elapsed client time, floored to the whole second.
const ANCHOR_MS = CLIENT_NOW + 5_000;
const ANCHOR_UTC = "2026-10-21T12:00:05Z";

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
  accountName: "Demo MT5",
  currency: "USD",
  startingBalance: 10000,
  balance: 10000,
  equity: 10000,
  accountType: "demo",
  leverage: 100,
  isDefault: true,
  isBrokerAccount: true,
  broker: "MT5",
  brokerAccountId: LOGIN,
  connectionStatus: "connected",
  lastSynced: null,
  mt5Login: LOGIN,
  mt5Server: SERVER,
  mt5Connected: true,
  mt5TerminalId: null,
  strategyId: null,
  strategyName: null,
  marginUsed: 0,
  freeMargin: 10000,
  floatingPnL: 0,
  createdAt: "2026-10-21T12:00:00.000Z",
  ...overrides,
});

// A second real account in the same catalog, so a preview that names the
// wrong one is visible rather than merely untested.
const OTHER_LOGIN = "87654321";
const OTHER_ACCOUNT = (overrides = {}) =>
  ACCOUNT({
    id: "1767000011111",
    accountName: "Live MT5",
    isDefault: false,
    mt5Login: OTHER_LOGIN,
    brokerAccountId: OTHER_LOGIN,
    ...overrides,
  });

const LIVE_IDENTITY = { mt5Login: LOGIN, mt5Server: SERVER };

// The sample is whatever captureRecoveryClockSample agreed to remember for
// the account it is told about, so a fixture cannot smuggle through a marker
// the bridge would never report, nor a sample tied to a different login.
function clockSample(captureOverrides = {}, { account = ACCOUNT() } = {}) {
  const outcome = captureRecoveryClockSample({
    brokerTimeMsc: BROKER_MSC,
    brokerTimeSource: "tick.time_msc",
    sampledAtClientMsc: CLIENT_NOW,
    expectedIdentity: {
      mt5Login: account.mt5Login,
      mt5Server: account.mt5Server,
    },
    returnedIdentity: {
      mt5Login: account.mt5Login,
      mt5Server: account.mt5Server,
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

// An explicit `undefined` always means "the caller never provided it".
// Anything outside this list is forwarded untouched, so a test can try to
// smuggle in its own account, sample or windows.
const INTEGRATION_KEYS = [
  "accounts",
  "liveIdentity",
  "getRecoveryClockSample",
  "now",
  "apiUrl",
  "fetchImpl",
  "existingJournal",
];

async function preview(provided = {}) {
  const withDefault = (key, fallback) =>
    key in provided ? provided[key] : fallback;

  const accounts = withDefault("accounts", [ACCOUNT()]);
  const liveIdentity = withDefault("liveIdentity", LIVE_IDENTITY);

  const pages = withDefault("pages", [
    historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0]),
    historyPage([], EXPECTED_WINDOWS[1]),
    historyPage([], EXPECTED_WINDOWS[2]),
  ]);

  const transportFixture = transport(
    ...pages.map((page) => (page.ok === false ? page : okJson(page)))
  );

  const input = {
    accounts,
    liveIdentity,
    getRecoveryClockSample: withDefault(
      "getRecoveryClockSample",
      () => clockSample({}, { account: firstMatch(accounts, liveIdentity) })
    ),
    now: withDefault("now", ASSESS_NOW),
    apiUrl: withDefault("apiUrl", API_URL),
    fetchImpl: withDefault("fetchImpl", transportFixture.fetchImpl),
    existingJournal: withDefault("existingJournal", []),
  };

  for (const [key, value] of Object.entries(provided)) {
    if (key === "pages" || INTEGRATION_KEYS.includes(key)) continue;

    input[key] = value;
  }

  const result = await planRecoveryPreviewForAccount(input);

  return { calls: transportFixture.calls, result };
}

// The default sample is the one the resolved account's own poll produced, so
// the fixture never hands this module a clock that belongs to somebody else
// unless a test asks for exactly that. The canonical form is the pipeline's
// own rule, taken from the module that owns it (recoveryClock.js
// canonicalLogin, shared by every recovery module since phase 3X-6E) —
// TradeContext.jsx:2622-2636 resolves the same way.
// The canonical form is the pipeline's own rule, read from the module that
// owns it rather than restated here: digits only, every leading zero
// dropped, refused when what is left is empty or longer than the ceiling.
function canonLogin(value) {
  const verdict = canonicalLogin(value);

  return typeof verdict.login === "string" ? verdict.login : null;
}

function canonServer(value) {
  const text = typeof value === "string" ? value.trim() : "";

  return text === "" ? null : text.toLowerCase();
}

function firstMatch(accounts, liveIdentity) {
  const login = canonLogin(liveIdentity?.mt5Login);
  const server = canonServer(liveIdentity?.mt5Server);

  if (!Array.isArray(accounts) || login === null || server === null) {
    return ACCOUNT();
  }

  const matches = accounts.filter(
    (row) =>
      row !== null &&
      typeof row === "object" &&
      canonLogin(row.mt5Login ?? row.login) === login &&
      canonServer(row.mt5Server ?? row.server) === server
  );

  return matches.length === 1 ? matches[0] : ACCOUNT();
}

function solo(items, what = "item") {
  assert.equal(items.length, 1, `expected one ${what}, got ${items.length}`);

  return items[0];
}

function blocked(result, code) {
  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.BLOCKED);
  assert.deepEqual([...result.records], []);
  assert.deepEqual([...result.skipped], []);
  assert.deepEqual([...result.rejected], []);
  assert.ok(
    result.refusals.includes(code),
    `expected refusal ${code}, got ${JSON.stringify(result.refusals)}`
  );

  return result;
}

// The account layer forwards the adapter's refusal array untouched:
// planMT5RecoveryPreview hands back identityBlocked([...proposal.refusals]),
// so a reason named here is only attributable to the gate under test when
// nothing else travelled with it. This pins the whole ordered array instead of
// one member of it.
function blockedByExactly(result, code) {
  blocked(result, code);

  assert.deepEqual([...result.refusals], [code]);

  return result;
}

// ============================================================
// 1. The account is the one the live identity names
// ============================================================

test("previews the persisted account the confirmed live identity names", async () => {
  const { calls, result } = await preview();

  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.deepEqual([...result.refusals], []);
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(calls.length, 3);

  const record = solo(result.records);

  assert.equal(record.id, `mt5-position-${LOGIN}-9001`);
  assert.equal(record.accountId, ACCOUNT_ID);
  assert.equal(record.source, "history-recovery");
  assert.equal(record.status, "CLOSED");
  assert.equal(record.netProfit, "0.18");
});

test("resolves a login stored with padding or leading zeros", async () => {
  const row = ACCOUNT({ mt5Login: ` 00${LOGIN} `, brokerAccountId: ` 00${LOGIN} ` });

  const { calls, result } = await preview({
    accounts: [OTHER_ACCOUNT(), row],
    liveIdentity: { mt5Login: LOGIN, mt5Server: SERVER },
  });

  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(result.identity.mt5Login, LOGIN);
  assert.equal(solo(result.records).accountId, ACCOUNT_ID);

  for (const call of calls) {
    assert.equal(new URL(call.url).searchParams.get("mt5_login"), LOGIN);
  }
});

test("resolves a server that differs only by case or padding", async () => {
  // The stored row keeps the one spelling the route can confirm
  // (server/routes/mt5.js:765 lowercases what it forwards, :937-947 refuses a
  // page naming anything else), and the case variant is what the live identity
  // arrives as. That is where catalog lookup is allowed to fold: the row it
  // resolves to still carries its own stored spelling.
  const row = ACCOUNT();

  const { calls, result } = await preview({
    accounts: [OTHER_ACCOUNT(), row],
    liveIdentity: { mt5Login: LOGIN, mt5Server: "  MetaTrader-Demo " },
  });

  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(result.identity.mt5Server, SERVER);

  for (const call of calls) {
    assert.equal(
      new URL(call.url).searchParams.get("mt5_server"),
      SERVER,
      "a folded lookup key must never become the server the scan asks for"
    );
  }
});

test("refuses a stored server identity the pipeline can never confirm", async () => {
  // Policy 3X-7D-A. Case-insensitivity is a lookup convenience, not a
  // recoverable identity: a row stored in a spelling no accepted page can
  // name is refused with the reason that says so, and this module neither
  // rewrites the row nor previews it.
  //
  // The pages echo the stored spelling on purpose. runHistoryRecoveryScan
  // forwards the account's own trimmed server (mt5HistoryRecoveryScan.js:173-176,
  // :237) and the adapter pairs each page with that request
  // (mt5RecoveryJournalAdapter.js:399-412), so a page naming anything else
  // would be refused for the pairing, not for the stored row. Only a page that
  // agrees with the request leaves the account-level canonicality check as the
  // reason that fires.
  const stored = ACCOUNT({ mt5Server: "  MetaTrader-Demo " });

  const { result } = await preview({
    accounts: [OTHER_ACCOUNT(), stored],
    liveIdentity: { mt5Login: LOGIN, mt5Server: SERVER },
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0], {
        identity: { mt5Login: LOGIN, mt5Server: "MetaTrader-Demo" },
      }),
      historyPage([], EXPECTED_WINDOWS[1], {
        identity: { mt5Login: LOGIN, mt5Server: "MetaTrader-Demo" },
      }),
      historyPage([], EXPECTED_WINDOWS[2], {
        identity: { mt5Login: LOGIN, mt5Server: "MetaTrader-Demo" },
      }),
    ],
  });

  blockedByExactly(result, R.IDENTITY_SERVER_NONCANONICAL);
  assert.equal(result.accountId, ACCOUNT_ID);
});

test("never previews the other account in the catalog", async () => {
  const { calls, result } = await preview({
    accounts: [ACCOUNT(), OTHER_ACCOUNT()],
  });

  assert.equal(calls.length, 3);
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(solo(result.records).accountId, ACCOUNT_ID);
  assert.equal(solo(result.records).mt5Login, LOGIN);
});

test("resolves a live login the broker reported as a number", async () => {
  // /api/mt5/account hands `login` straight from the terminal, which is a
  // number there, so the lookup key has to be the same digits the journal ids
  // use rather than a text comparison.
  const { calls, result } = await preview({
    liveIdentity: { mt5Login: Number(LOGIN), mt5Server: SERVER },
  });

  assert.equal(calls.length, 3);
  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.equal(result.accountId, ACCOUNT_ID);
});

test("resolves a row that names its broker account under the older keys", async () => {
  // TradeContext's own matcher reads `login` and `server` as well as
  // `mt5Login` and `mt5Server` (TradeContext.jsx:2662-2679), so this row is
  // the connected account. The pipeline below still refuses it, because the
  // orchestrator and adapter read only `mt5Login`/`mt5Server`
  // (mt5RecoveryOrchestrator.js:151-152) — resolution here never grows a
  // fallback of its own to talk around that.
  const { calls, result } = await preview({
    accounts: [
      {
        id: ACCOUNT_ID,
        accountName: "Older row",
        login: LOGIN,
        server: SERVER,
        broker: "MT5",
        brokerAccountId: LOGIN,
      },
    ],
    getRecoveryClockSample: () =>
      clockSample({
        expectedIdentity: { mt5Login: LOGIN, mt5Server: SERVER },
        returnedIdentity: { mt5Login: LOGIN, mt5Server: SERVER },
      }),
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_ORCHESTRATOR_REASONS.ACCOUNT_IDENTITY_REQUIRED);
  assert.equal(result.accountId, ACCOUNT_ID);
});

// ============================================================
// 2. Resolution fails closed instead of guessing
// ============================================================

test("blocks when no persisted account names the connected login and asks for no history", async () => {
  const { calls, result } = await preview({
    accounts: [OTHER_ACCOUNT()],
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_NOT_PERSISTED);
  assert.equal(result.accountId, null);
});

test("blocks when the login matches but the server does not", async () => {
  const { calls, result } = await preview({
    accounts: [ACCOUNT({ mt5Server: "metatrader-other" })],
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_NOT_PERSISTED);
});

test("blocks instead of substituting a row that cannot name its server", async () => {
  // AddTradingAccountModal writes mt5Login: null / mt5Server: null for a
  // manually created account, and the live sync path tolerates a missing
  // server. Recovery may not: an unnamed server matches every connection.
  for (const account of [
    ACCOUNT({ mt5Server: null }),
    ACCOUNT({ mt5Server: "   " }),
    ACCOUNT({ mt5Login: null, mt5Server: SERVER }),
    ACCOUNT({ mt5Login: "12345678a" }),
  ]) {
    const { calls, result } = await preview({ accounts: [account] });

    assert.equal(calls.length, 0);
    blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_NOT_PERSISTED);
  }
});

test("blocks when two persisted accounts both name the connected identity", async () => {
  const { calls, result } = await preview({
    accounts: [ACCOUNT(), ACCOUNT({ accountName: "Duplicate" })],
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_MATCH_AMBIGUOUS);
});

test("blocks a catalog it cannot read instead of treating it as empty", async () => {
  for (const accounts of [undefined, null, {}, "[]", ACCOUNT()]) {
    const { calls, result } = await preview({ accounts });

    assert.equal(calls.length, 0);
    blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_CATALOG_INVALID);
  }
});

test("blocks a live identity that cannot name a login and a server", async () => {
  for (const liveIdentity of [
    undefined,
    null,
    {},
    { mt5Login: LOGIN },
    { mt5Server: SERVER },
    { mt5Login: "0", mt5Server: SERVER },
    { mt5Login: "12345678a", mt5Server: SERVER },
    { mt5Login: LOGIN, mt5Server: "   " },
  ]) {
    const { calls, result } = await preview({ liveIdentity });

    assert.equal(calls.length, 0);
    blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.LIVE_IDENTITY_INVALID);
  }
});

// Phase 3X-6E: the account layer reads a login through the shared rule in
// recoveryClock.js. Each expectation is taken from that function, so the
// table tests the wiring at both of this module's call sites - the live
// identity and the persisted row - instead of a hand-kept copy of the rule.
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

test("agrees with the shared login rule about the live identity", async () => {
  for (const spelling of LOGIN_SPELLINGS) {
    const expected = canonLogin(spelling);
    const { calls, result } = await preview({
      liveIdentity: { mt5Login: spelling, mt5Server: SERVER },
    });

    if (expected === null) {
      assert.equal(calls.length, 0);
      blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.LIVE_IDENTITY_INVALID);
      continue;
    }

    assert.ok(
      !result.refusals.includes(
        RECOVERY_ACCOUNT_PREVIEW_REASONS.LIVE_IDENTITY_INVALID
      ),
      `"${String(spelling)}" canonicalises to ${expected}, got ${JSON.stringify(result.refusals)}`
    );
    assert.equal(result.accountId, ACCOUNT_ID);
  }
});

test("agrees with the shared login rule about the persisted row", async () => {
  for (const spelling of LOGIN_SPELLINGS) {
    const expected = canonLogin(spelling);
    const { calls, result } = await preview({
      accounts: [ACCOUNT({ mt5Login: spelling, brokerAccountId: spelling })],
    });

    if (expected === null) {
      assert.equal(calls.length, 0);
      blocked(
        result,
        RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_NOT_PERSISTED
      );
      continue;
    }

    assert.equal(
      result.status,
      RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW,
      `"${String(spelling)}" canonicalises to ${expected}, got ${JSON.stringify(result.refusals)}`
    );
    assert.equal(result.accountId, ACCOUNT_ID);
    assert.equal(result.identity.mt5Login, expected);
  }
});

test("canonicalising a login never resolves a different account", async () => {
  const { calls, result } = await preview({
    accounts: [ACCOUNT({ mt5Login: `000${OTHER_LOGIN}` })],
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.ACCOUNT_NOT_PERSISTED);
});

test("ignores a caller-supplied account, clock sample or window list", async () => {
  // The three things this module exists to decide are not arguments.
  const { calls, result } = await preview({
    account: OTHER_ACCOUNT(),
    clockSample: clockSample({}, { account: OTHER_ACCOUNT() }),
    windows: [{ fromUtc: "2020-01-01T00:00:00Z", toUtc: ANCHOR_UTC }],
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0]),
      historyPage([], EXPECTED_WINDOWS[1]),
      historyPage([], EXPECTED_WINDOWS[2]),
    ],
  });

  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(calls.length, 3);
  assert.equal(
    new URL(calls[0].url).searchParams.get("from_utc"),
    EXPECTED_WINDOWS[0].fromUtc
  );
  assert.equal(new URL(calls[0].url).searchParams.get("mt5_login"), LOGIN);
});

// ============================================================
// 3. The clock comes from the recovery sample contract, fresh
// ============================================================

test("previews through the sample getRecoveryClockSample returns", async () => {
  const remembered = clockSample();
  const seen = [];

  const { result } = await preview({
    getRecoveryClockSample: () => {
      seen.push("called");

      return remembered;
    },
  });

  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.equal(result.anchorUtc, ANCHOR_UTC);

  // Read once, at call time, through the contract rather than a stashed value.
  assert.deepEqual(seen, ["called"]);
});

test("blocks when no broker clock has been remembered yet and asks for no history", async () => {
  const { calls, result } = await preview({
    getRecoveryClockSample: () => null,
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.SAMPLE_MISSING);
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(result.anchorUtc, null);
});

test("blocks a stale recovery sample and asks for no history", async () => {
  const { calls, result } = await preview({ now: CLIENT_NOW + 11_000 });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.STALE);
});

test("blocks a sample the broker clock tied to the other account", async () => {
  const other = OTHER_ACCOUNT();

  const { calls, result } = await preview({
    accounts: [ACCOUNT(), other],
    getRecoveryClockSample: () => clockSample({}, { account: other }),
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.CLOCK_REFUSED);
  assert.equal(result.clock.reason, RECOVERY_CLOCK_REASONS.IDENTITY_MISMATCH);
});

test("blocks without a clock provider instead of assuming a fresh sample", async () => {
  for (const getRecoveryClockSample of [
    undefined,
    null,
    clockSample(),
    "sample",
  ]) {
    const { calls, result } = await preview({ getRecoveryClockSample });

    assert.equal(calls.length, 0);
    blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.CLOCK_PROVIDER_INVALID);
  }
});

test("blocks a clock provider that throws instead of throwing itself", async () => {
  const { calls, result } = await preview({
    getRecoveryClockSample: () => {
      throw new Error("context torn down mid-call");
    },
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_ACCOUNT_PREVIEW_REASONS.CLOCK_PROVIDER_INVALID);
});

// ============================================================
// 4. Windows, scan and adapter gates are passed through untouched
// ============================================================

test("plans the policy's whole-second tiles from the accepted anchor", async () => {
  const { calls, result } = await preview();

  assert.equal(result.anchorUtc, ANCHOR_UTC);
  assert.equal(result.windowPlan.refusal, null);
  assert.deepEqual([...result.windows], EXPECTED_WINDOWS);

  assert.deepEqual(
    calls.map((call) => {
      const url = new URL(call.url);

      return {
        path: url.pathname,
        fromUtc: url.searchParams.get("from_utc"),
        toUtc: url.searchParams.get("to_utc"),
        options: call.options,
      };
    }),
    EXPECTED_WINDOWS.map((window) => ({
      path: "/api/mt5/history",
      fromUtc: window.fromUtc,
      toUtc: window.toUtc,
      options: { cache: "no-store" },
    }))
  );
});

test("blocks a broker clock too close to the epoch to cover the lookback", async () => {
  const { calls, result } = await preview({
    getRecoveryClockSample: () => clockSample({ brokerTimeMsc: 1_000 }),
  });

  assert.equal(calls.length, 0);
  blocked(result, RECOVERY_PREVIEW_REASONS.WINDOWS_REFUSED);
  assert.equal(
    result.windowPlan.refusal,
    RECOVERY_WINDOW_REASONS.ANCHOR_OUT_OF_RANGE
  );
});

test("proposes nothing for a refused history page", async () => {
  const { calls, result } = await preview({
    pages: [
      historyPage(CLEAN_LIFECYCLE(), EXPECTED_WINDOWS[0]),
      historyPage([], EXPECTED_WINDOWS[1]),
      refusal(504, "MT5_HISTORY_TIMEOUT"),
    ],
  });

  assert.equal(calls.length, 3);
  assert.ok(result.refusals.includes(R.SCAN_RETRY_REQUIRED));
  assert.ok(result.refusals.includes(R.REJECTED_PAGES_PRESENT));
  assert.deepEqual([...result.records], []);
  assert.equal(result.accountId, ACCOUNT_ID);
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

test("proposes nothing when the pages name an account other than the resolved one", async () => {
  const other = { mt5Login: OTHER_LOGIN, mt5Server: SERVER };

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

test("blocks without a transport or base URL instead of throwing", async () => {
  const withoutTransport = await preview({ fetchImpl: undefined });

  blocked(
    withoutTransport.result,
    RECOVERY_ORCHESTRATOR_REASONS.FETCH_TRANSPORT_REQUIRED
  );
  assert.equal(withoutTransport.result.accountId, ACCOUNT_ID);

  const withoutUrl = await preview({ apiUrl: "  " });

  blocked(withoutUrl.result, RECOVERY_ORCHESTRATOR_REASONS.API_URL_REQUIRED);
});

// ============================================================
// 5. The journal snapshot in, the journal snapshot out
// ============================================================

test("skips a position the journal snapshot already holds", async () => {
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

  assert.equal(result.status, RECOVERY_ACCOUNT_PREVIEW_STATUS.PREVIEW);
  assert.deepEqual([...result.records], []);
  assert.equal(solo(result.skipped).reason, R.ALREADY_JOURNALED_ID);
});

test("repeated calls preserve the journal snapshot they were handed", async () => {
  const existingJournal = [
    { id: "keep", accountId: ACCOUNT_ID, symbol: "GBPUSD" },
  ];

  const before = JSON.stringify(existingJournal);

  const first = await preview({ existingJournal });
  const second = await preview({ existingJournal });

  assert.equal(JSON.stringify(existingJournal), before);
  assert.equal(Object.isFrozen(existingJournal), false);

  assert.equal(solo(first.result.records).positionId, "9001");
  assert.equal(solo(second.result.records).positionId, "9001");

  // Nothing was appended to the caller's snapshot between the two runs, so
  // the second plan deduped against exactly what the first one saw.
  assert.deepEqual(
    [...second.result.records],
    [...first.result.records]
  );

  const afterJournal = [...existingJournal, ...first.result.records];

  assert.equal(JSON.stringify(existingJournal), before);

  const third = await preview({ existingJournal: afterJournal });

  assert.deepEqual([...third.result.records], []);
  assert.equal(solo(third.result.skipped).reason, R.ALREADY_JOURNALED_ID);
});

test("blocks when the caller hands no journal snapshot to dedupe against", async () => {
  const { result } = await preview({ existingJournal: undefined });

  blocked(result, R.EXISTING_JOURNAL_INVALID);
});

test("reads no storage and states that nothing was journaled or advanced", async () => {
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
    const blockedRun = await preview({ getRecoveryClockSample: () => null });

    assert.equal(previewed.result.journalWritten, false);
    assert.equal(previewed.result.watermarkAdvanced, false);
    assert.equal(blockedRun.result.journalWritten, false);
    assert.equal(blockedRun.result.watermarkAdvanced, false);

    // The catalog is an argument: this module never goes looking for it.
    assert.deepEqual(touched, []);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});

test("keeps every completeness and write flag false on both outcomes", async () => {
  const previewed = await preview();
  const blockedRun = await preview({ liveIdentity: undefined });

  for (const result of [previewed.result, blockedRun.result]) {
    assert.equal(result.coverageComplete, false);
    assert.equal(result.retentionVerified, false);
    assert.equal(result.journalWritten, false);
    assert.equal(result.watermarkAdvanced, false);
  }

  assert.equal(
    previewed.result.outcome.result.scan.coverageComplete,
    false
  );
});

test("freezes the integration verdict so no caller can rewrite it", async () => {
  const { result } = await preview();

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.records), true);
  assert.equal(Object.isFrozen(result.refusals), true);
  assert.equal(Object.isFrozen(result.windows), true);
  assert.equal(result.accountId, ACCOUNT_ID);

  const blockedRun = await preview({ accounts: [] });

  assert.equal(Object.isFrozen(blockedRun.result), true);
  assert.equal(Object.isFrozen(blockedRun.result.refusals), true);
  assert.deepEqual([...blockedRun.result.records], []);
});
