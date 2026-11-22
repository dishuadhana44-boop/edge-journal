import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  RECOVERY_COMMIT_STATUS,
  planRecoveryJournalCommit,
} from "./mt5RecoveryJournalCommit.js";

// The clock and the window policy are imported from the modules that own them,
// not restated here: a fixture has to carry the anchor the pipeline can actually
// report, and the only way to prove that is to ask the pipeline.
import {
  assessRecoveryClock,
  captureRecoveryClockSample,
} from "../utils/trading/recoveryClock.js";
import {
  buildRecoveryWindows,
  RECOVERY_WINDOW_POLICY,
} from "./mt5RecoveryWindows.js";

import {
  RECOVERY_WATERMARK_VERSION,
  RECOVERY_COMMIT_STEP_STATUS,
  RECOVERY_COMMIT_STEP_REASONS as S,
  RECOVERY_COMMIT_EVIDENCE_STATUS as V,
  recoveryWatermarkStorageKey,
  prepareRecoveryCommitStep,
  verifyRecoveryCommitEvidence,
} from "./mt5RecoveryCommitContract.js";

// Read through the namespace because the provenance version is what Phase 6C
// adds: a named import of an export that does not exist yet would fail the
// whole file to load, and every new test would report nothing.
import * as recoveryCommitContract from "./mt5RecoveryCommitContract.js";

// ============================================================
// Fixtures
//
// A proposal is copied key-for-key from the record the adapter publishes
// (src/lib/mt5RecoveryJournalAdapter.js, the record adaptRecord returns), including its
// liveSnapshotToUtc and the recoveryComponents shape componentsOf builds. A verdict is
// copied from the account preview (src/lib/mt5RecoveryAccountPreview.js
// planRecoveryPreviewForAccount's verdict over mt5RecoveryOrchestrator.js
// planMT5RecoveryPreview's verdict), which is where the identity this
// contract binds actually comes from. A journal row is copied from what
// JournalContext persists under localStorage["trades"].
//
// Happy paths run the REAL planner, so a contract that cannot read its output
// fails here rather than against an object merely shaped like a plan.
// Negative paths use forgedPlan() when the planner itself would refuse the
// input first: naming the refusal that must fire means building a plan that is
// structurally sound except for the one thing under test. Nothing here invents
// a key a producer does not write.
// ============================================================

const LOGIN = "12345678";
const OTHER_LOGIN = "87654321";
const LOGIN_WITH_ZEROS = "00012345678";

// Strips to the same account as LOGIN, but is longer than the fifteen digits
// the pipeline allows once the zeros are counted: only a rule that applies the
// ceiling AFTER stripping can tell it from a sixteen-digit login.
const LOGIN_LONG_WITH_ZEROS = "0000000000012345678";
const SERVER = "MetaTrader-Demo";
const SERVER_KEY = "metatrader-demo";
const ACCOUNT_ID = "1767000000000";
const OTHER_ACCOUNT_ID = "1767000000999";
const ANCHOR_UTC = "2026-10-21T12:00:05Z";
const ANCHOR_LATER = "2026-10-21T13:00:05Z";

const DAY_MS = 86_400_000;

// The anchor is not a string a caller may choose. recoveryClock.js:339-350
// derives it as floor((broker time + elapsed client time) to a whole second),
// and mt5RecoveryWindows.js:136-147 tiles the read so the last tile ends exactly
// on it. These fixtures therefore run the two modules that produce the values a
// committable verdict carries, so nothing here can smuggle through an anchor or
// a range the pipeline would never report.
const ANCHOR_MS = Date.parse(ANCHOR_UTC);

// The sample was taken three whole seconds before the instant the anchor is
// measured at, so the elapsed client time is exactly the offset that makes the
// derived anchor land on `anchorUtc` instead of a second near it.
const SAMPLE_AGE_MS = 3_000;

function clockCapture(anchorUtc, identity) {
  const anchorMs = Date.parse(anchorUtc);
  const sampledAtClientMsc = anchorMs - SAMPLE_AGE_MS;

  const capture = captureRecoveryClockSample({
    brokerTimeMsc: sampledAtClientMsc,
    brokerTimeSource: "tick.time_msc",
    sampledAtClientMsc,
    expectedIdentity: identity,
    returnedIdentity: identity,
  });

  if (capture.status !== "ACCEPTED") return null;

  return assessRecoveryClock({
    sample: capture.sample,
    expectedIdentity: identity,
    now: anchorMs,
  });
}

function clockFor(anchorUtc = ANCHOR_UTC, login = LOGIN, server = SERVER) {
  const assessment = clockCapture(anchorUtc, { mt5Login: login, mt5Server: server });

  assert.notEqual(
    assessment,
    null,
    `fixture clock sample was refused for login ${String(login)}`
  );
  assert.equal(
    assessment.status,
    "ACCEPTED",
    `fixture clock refused: ${assessment.reason}`
  );
  assert.equal(assessment.anchorUtc, anchorUtc);

  return assessment;
}

// A reading the clock module itself refuses: a sample older than the recovery
// window (recoveryClock.js assessRecoveryClock refuses R.STALE). Not a hand-written { status: "REFUSED" },
// which would let the fixture claim an evidence shape no producer emits.
function staleClock() {
  const anchorMs = ANCHOR_MS;
  const sampledAtClientMsc = anchorMs - SAMPLE_AGE_MS;
  const identity = { mt5Login: LOGIN, mt5Server: SERVER };

  const capture = captureRecoveryClockSample({
    brokerTimeMsc: sampledAtClientMsc,
    brokerTimeSource: "tick.time_msc",
    sampledAtClientMsc,
    expectedIdentity: identity,
    returnedIdentity: identity,
  });

  assert.equal(capture.status, "ACCEPTED");

  const assessment = assessRecoveryClock({
    sample: capture.sample,
    expectedIdentity: identity,
    now: anchorMs + 60_000,
  });

  assert.equal(assessment.status, "REFUSED");

  return assessment;
}

function windowPlan(anchorUtc = ANCHOR_UTC) {
  const plan = buildRecoveryWindows({ anchorUtc });

  assert.equal(
    plan.refusal,
    null,
    `fixture windows refused: ${plan.refusal}`
  );

  return plan;
}

// The whole-second spelling the window builder emits
// (src/lib/mt5RecoveryWindows.js:87-89). Only a test that has to name a range
// the builder would refuse needs to write a tile by hand.
function isoSec(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function tile(fromMs, toMs) {
  return Object.freeze({ fromUtc: isoSec(fromMs), toUtc: isoSec(toMs) });
}

function tilePlan(...tiles) {
  return Object.freeze({
    windows: Object.freeze(tiles),
    refusal: null,
  });
}

const OPEN_MSC = Date.UTC(2026, 9, 14, 9, 30, 0);
const CLOSE_MSC = Date.UTC(2026, 9, 14, 15, 5, 0);

function proposal(overrides = {}) {
  const positionId = overrides.positionId ?? "900";

  return Object.freeze({
    id: `mt5-position-${LOGIN}-${positionId}`,
    accountId: ACCOUNT_ID,
    mt5Login: LOGIN,
    mt5Server: SERVER,
    broker: "MT5",
    source: "history-recovery",
    status: "CLOSED",
    positionId,
    brokerPositionId: positionId,
    symbol: "EURUSD.pro",
    side: "buy",
    volume: "0.10",
    openedAt: OPEN_MSC,
    closedAt: CLOSE_MSC,
    openedAtMsc: OPEN_MSC,
    closedAtMsc: CLOSE_MSC,
    pnl: "12.50",
    netProfit: "12.50",
    netPnL: "12.50",
    realizedPnL: "12.50",
    reconstructedNetPnl: "12.50",
    pnlBasis: "reconstructed-broker-reported-total",
    recoveryComponents: Object.freeze({
      profit: "15.00",
      commission: "-2.50",
      swap: "0.00",
      fee: "0.00",
    }),
    dealTickets: Object.freeze(["7001", "7002"]),
    openingTickets: Object.freeze(["7001"]),
    closingTickets: Object.freeze(["7002"]),
    liveSnapshotToUtc: ANCHOR_UTC,
    coverageComplete: false,
    dataGaps: Object.freeze([
      "CURRENCY",
      "STOP_LOSS",
      "TAKE_PROFIT",
      "ENTRY_PRICE",
      "EXIT_PRICE",
      "RISK_REWARD",
    ]),
    ...overrides,
  });
}

// Copied key-for-key from the preview this contract has to read: the
// orchestrator freezes identity as { mt5Login, mt5Server } with the login
// canonicalised and the server kept in the broker's own spelling
// (mt5RecoveryOrchestrator.js planMT5RecoveryPreview's identity), the clock coordinator adds
// anchorUtc/anchorMs/clock/windowPlan/windows (src/lib/mt5RecoveryPreview.js:154-161)
// and the account layer adds accountId (its planRecoveryPreviewForAccount return).
// A verdict is only a preview if the ranges it names are the ranges its own
// anchor produces, so the fixture cannot paste a hand-written window list or a
// null clock: it asks the two producers and copies what they answer. A test
// that needs evidence which DISAGREES with its own verdict names the clock or
// the window plan it wants, and the producers' output for the base anchor is
// what stays everywhere else.
const WHOLE_SECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function usableAnchor(value) {
  return typeof value === "string" && WHOLE_SECOND_UTC.test(value)
    ? value
    : ANCHOR_UTC;
}

// The identity a clock sample may belong to, or null when the verdict's own
// identity claim is one the clock module would never accept. Such a verdict is
// a forgery either way; the fixture leaves its evidence at the base pair so the
// refusal the test names is the identity refusal, not an artifact here.
function usableIdentity(value) {
  if (!isPlainValue(value)) return null;

  const login = value.mt5Login;
  const server = value.mt5Server;

  if (typeof login !== "string" && typeof login !== "number") return null;
  if (typeof server !== "string" || server.trim() === "") return null;

  if (clockCapture(ANCHOR_UTC, value) === null) return null;

  return value;
}

function isPlainValue(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

function preview(records, overrides = {}) {
  const anchorUtc = usableAnchor(overrides.anchorUtc);
  const identity = usableIdentity(overrides.identity) ?? {
    mt5Login: LOGIN,
    mt5Server: SERVER,
  };

  const plan = windowPlan(anchorUtc);

  // An override arrives exactly as the test wrote it, including an explicit
  // null; only an absent key means "the producers' own evidence for this claim".
  const evidence = (key, produced) =>
    key in overrides ? overrides[key] : produced;

  const derivedClock =
    clockCapture(anchorUtc, identity) ??
    clockFor(anchorUtc, LOGIN, SERVER);

  return Object.freeze({
    status: "preview",
    refusals: Object.freeze([]),
    records: Object.freeze(records),
    skipped: Object.freeze([]),
    rejected: Object.freeze([]),
    remaining: Object.freeze({
      unresolvedCount: 0,
      unassignedCount: 0,
      refusedCount: 0,
    }),
    coverageComplete: false,
    retentionVerified: false,
    journalWritten: false,
    watermarkAdvanced: false,
    identity: Object.freeze(identity),
    outcome: null,
    clock: evidence("clock", derivedClock),
    windowPlan: evidence("windowPlan", plan),
    anchorUtc,
    anchorMs: evidence("anchorMs", Date.parse(anchorUtc)),
    windows: evidence("windows", plan.windows),
    accountId: ACCOUNT_ID,
    ...overrides,
  });
}

function journalRow(overrides = {}) {
  return {
    id: "journal-1760000000000-abc123",
    accountId: ACCOUNT_ID,
    pair: "EURUSD",
    symbol: "EURUSD",
    side: "buy",
    volume: 0.1,
    status: "Closed",
    openedAt: "2026-10-14",
    closedAt: "2026-10-14",
    netProfit: 30,
    notes: "user words that must survive",
    ...overrides,
  };
}

function identity(overrides = {}) {
  return { mt5Login: LOGIN, mt5Server: SERVER, ...overrides };
}

function planned(verdict, existingJournal, accountId = ACCOUNT_ID) {
  const plan = planRecoveryJournalCommit({
    verdict,
    existingJournal,
    accountId,
  });

  assert.equal(plan.status, RECOVERY_COMMIT_STATUS.PLANNED);
  assert.deepEqual([...plan.refusals], []);

  return plan;
}

// A plan the planner would have produced for these rows and these existing
// rows: structurally sound, so the refusal a test names is the only one that
// can fire.
function forgedPlan(appendRows, existingRows = [], overrides = {}) {
  return {
    status: RECOVERY_COMMIT_STATUS.PLANNED,
    refusals: [],
    append: appendRows,
    rejected: [],
    journal: [...existingRows, ...appendRows],
    changed: appendRows.length > 0,
    accountId: ACCOUNT_ID,
    coverageComplete: false,
    retentionVerified: false,
    journalWritten: false,
    watermarkAdvanced: false,
    ...overrides,
  };
}

// Explicit `in` checks: a test that means to hand the contract an absent or
// null input must have it arrive as written, not be quietly defaulted.
//
// `verdict` defaults to the preview of exactly the rows the plan appends, which
// is the case where plan and preview agree; a test that needs them to DISAGREE
// names its own verdict. A plan with no readable append rows defaults to an
// empty preview, so a malformed-plan test never trips the provenance gate by
// accident.
function input(args) {
  const plan = args.plan;

  const derivedRows =
    plan !== null &&
    typeof plan === "object" &&
    Array.isArray(plan.append)
      ? [...plan.append]
      : [];

  const built = {
    plan,
    verdict: preview(derivedRows),
    existingJournal: [],
    accountId: ACCOUNT_ID,
    identity: identity(),
    anchorUtc: ANCHOR_UTC,
  };

  for (const key of [
    "verdict",
    "existingJournal",
    "accountId",
    "identity",
    "anchorUtc",
  ]) {
    if (key in args) built[key] = args[key];
  }

  return built;
}

function prepared(args) {
  const step = prepareRecoveryCommitStep(input(args));

  assert.equal(
    step.status,
    RECOVERY_COMMIT_STEP_STATUS.PREPARED,
    `expected a prepared step, got ${JSON.stringify(step.refusals)}`
  );
  assert.deepEqual([...step.refusals], []);

  return step;
}

function refusedPrep(args, ...reasons) {
  const step = prepareRecoveryCommitStep(input(args));

  assert.equal(step.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);

  for (const reason of reasons) {
    assert.ok(
      step.refusals.includes(reason),
      `expected refusal ${reason}, got ${JSON.stringify(step.refusals)}`
    );
  }

  // A refused step must carry nothing a writer could hand to storage.
  assert.equal(step.journal, null);
  assert.equal(step.append, null);
  assert.equal(step.watermark, null);
  assert.equal(step.journalBytes, null);
  assert.equal(step.watermarkBytes, null);
  assert.equal(step.provenance, null);
  assert.equal(step.provenanceBytes, null);
  assert.equal(step.changed, false);
  assert.equal(step.committed, false);
  assert.equal(step.journalWritten, false);
  assert.equal(step.watermarkAdvanced, false);
  assert.equal(step.coverageComplete, false);
  assert.equal(step.retentionVerified, false);

  return step;
}

// A refused step's refusals are the whole story of why nothing was prepared:
// prepareRecoveryCommitStep pushes readPlan, readPreview, provenance and
// collision reasons into one accumulating array and returns it as-is, so
// naming a reason that is merely present would let an unrelated second refusal
// ride along unnoticed. The expected array is compared as given, keeping its
// order and any repeats.
function refusedPrepExactly(args, ...reasons) {
  const step = refusedPrep(args, ...reasons);

  assert.deepEqual([...step.refusals], reasons);

  return step;
}

function bytes(value) {
  return { readBack: JSON.stringify(value) };
}

function commit(step, plan) {
  return verifyRecoveryCommitEvidence({
    prepared: step,
    journalEvidence: bytes(plan.journal),
    watermarkEvidence: bytes(step.watermark),
  });
}

// ==========================================================
// Requirement 1 - consume a successful planner result
// ==========================================================

test("prepares a step from a real planner result", () => {
  const first = proposal({ positionId: "900" });
  const second = proposal({ positionId: "901" });
  const existing = journalRow();
  const plan = planned(preview([first, second]), [existing]);

  const step = prepared({ plan, existingJournal: [existing] });

  assert.deepEqual([...step.append], [first, second]);
  assert.deepEqual([...step.journal], [existing, first, second]);
  assert.equal(step.changed, true);
  assert.equal(step.accountId, ACCOUNT_ID);
  assert.equal(step.anchorUtc, ANCHOR_UTC);
  assert.equal(step.identity.mt5Login, LOGIN);
  assert.equal(step.identity.mt5Server, SERVER_KEY);
});

test("binds the watermark to the account and canonical broker identity", () => {
  const plan = planned(preview([proposal()]), []);

  const step = prepared({ plan, existingJournal: [] });

  assert.equal(step.watermark.version, RECOVERY_WATERMARK_VERSION);
  assert.equal(step.watermark.accountId, ACCOUNT_ID);
  assert.equal(step.watermark.mt5Login, LOGIN);
  assert.equal(step.watermark.mt5Server, SERVER_KEY);
  assert.equal(step.watermark.anchorUtc, ANCHOR_UTC);
  assert.equal(
    step.watermark.storageKey,
    recoveryWatermarkStorageKey({
      accountId: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: SERVER_KEY,
    })
  );
  assert.equal(step.watermark.coverageComplete, false);
  assert.equal(step.watermark.retentionVerified, false);

  // The versioned schema is exactly these fields: a watermark value carries a
  // scope and a boundary, never a write claim.
  assert.deepEqual(
    Object.keys(step.watermark).sort(),
    [
      "accountId",
      "anchorUtc",
      "coverageComplete",
      "mt5Login",
      "mt5Server",
      "retentionVerified",
      "storageKey",
      "version",
    ].sort()
  );
});

test("names the watermark key with the version, identity and account", () => {
  const key = recoveryWatermarkStorageKey({
    accountId: ACCOUNT_ID,
    mt5Login: LOGIN,
    mt5Server: SERVER_KEY,
  });

  assert.equal(
    key,
    `mt5-recovery-watermark:${RECOVERY_WATERMARK_VERSION}:${LOGIN}:${SERVER_KEY}:${ACCOUNT_ID}`
  );

  assert.notEqual(
    key,
    recoveryWatermarkStorageKey({
      accountId: OTHER_ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: SERVER_KEY,
    })
  );

  // The account id is last, so a component that itself contains a separator
  // cannot shift the fields and name a different account.
  assert.equal(
    recoveryWatermarkStorageKey({
      accountId: "1767000000000:extra",
      mt5Login: LOGIN,
      mt5Server: SERVER_KEY,
    }).startsWith(`mt5-recovery-watermark:${RECOVERY_WATERMARK_VERSION}:`),
    true
  );

  assert.throws(
    () =>
      recoveryWatermarkStorageKey({
        accountId: ACCOUNT_ID,
        mt5Login: LOGIN,
        mt5Server: "   ",
      }),
    /server/
  );

  assert.throws(
    () =>
      recoveryWatermarkStorageKey({
        accountId: ACCOUNT_ID,
        mt5Login: "12345678",
        mt5Server: `metatrader\u0000demo`,
      }),
    /server/
  );

  assert.throws(
    () =>
      recoveryWatermarkStorageKey({
        accountId: "   ",
        mt5Login: LOGIN,
        mt5Server: SERVER_KEY,
      }),
    /account/
  );

  assert.throws(
    () =>
      recoveryWatermarkStorageKey({
        accountId: ACCOUNT_ID,
        mt5Login: "12a45678",
        mt5Server: SERVER_KEY,
      }),
    /login/
  );
});

// ==========================================================
// Requirement 3 - explicit canonical account, never a selected-account default
// ==========================================================

test("refuses without an explicit canonical account id", () => {
  const plan = planned(preview([proposal()]), []);

  refusedPrep({ plan, accountId: undefined }, S.ACCOUNT_ID_MISSING);
  refusedPrep({ plan, accountId: "  " }, S.ACCOUNT_ID_MISSING);
  refusedPrep({ plan, accountId: null }, S.ACCOUNT_ID_MISSING);
  refusedPrep({ plan, accountId: { id: ACCOUNT_ID } }, S.ACCOUNT_ID_MISSING);
  refusedPrep({ plan, accountId: Number.NaN }, S.ACCOUNT_ID_MISSING);
});

test("canonicalises the account id the way the planner does", () => {
  const plan = planned(preview([proposal()]), []);

  const step = prepared({ plan, accountId: ` ${ACCOUNT_ID} ` });

  assert.equal(step.accountId, ACCOUNT_ID);

  const numeric = prepared({ plan, accountId: Number(ACCOUNT_ID) });

  assert.equal(numeric.accountId, ACCOUNT_ID);
});

test("refuses a plan that names a different account than the step", () => {
  const plan = planned(preview([proposal()]), []);

  // The preview agrees with the step's account and the plan does not, so the
  // refusal can only come from the plan's own attribution.
  refusedPrep(
    {
      plan,
      accountId: OTHER_ACCOUNT_ID,
      verdict: preview([proposal()], { accountId: OTHER_ACCOUNT_ID }),
    },
    S.PLAN_ACCOUNT_MISMATCH
  );
});

test("refuses an append attributed to another account", () => {
  const row = proposal({ accountId: OTHER_ACCOUNT_ID });
  const plan = forgedPlan([row]);

  refusedPrep({ plan }, S.RECORD_ACCOUNT_MISMATCH);
});

test("refuses a journal snapshot the caller did not supply", () => {
  const plan = planned(preview([proposal()]), []);

  refusedPrep({ plan, existingJournal: null }, S.EXISTING_JOURNAL_INVALID);
  refusedPrep({ plan, existingJournal: {} }, S.EXISTING_JOURNAL_INVALID);
  refusedPrep(
    { plan, existingJournal: [null] },
    S.EXISTING_JOURNAL_INVALID
  );
});

// ==========================================================
// Requirement 2 - a plan that claims unproven facts is refused
// ==========================================================

test("refuses a plan that claims a write happened", () => {
  const base = planned(preview([proposal()]), []);

  for (const key of ["journalWritten", "watermarkAdvanced"]) {
    refusedPrep(
      { plan: { ...base, [key]: true } },
      S.PLAN_CLAIMS_WRITE
    );
  }

  for (const key of ["coverageComplete", "retentionVerified"]) {
    refusedPrep(
      { plan: { ...base, [key]: true } },
      S.PLAN_CLAIMS_COVERAGE
    );
  }
});

test("refuses a plan that is not a clean commit plan", () => {
  const refused = planRecoveryJournalCommit({
    verdict: preview([proposal()]),
    existingJournal: null,
    accountId: ACCOUNT_ID,
  });

  assert.equal(refused.status, RECOVERY_COMMIT_STATUS.REFUSED);

  refusedPrep({ plan: refused }, S.PLAN_NOT_COMMITTABLE);

  const withRefusals = planned(preview([proposal()]), []);

  refusedPrep(
    {
      plan: {
        ...withRefusals,
        refusals: ["A_REFUSAL_NO_CLEARER_CLEARED"],
      },
    },
    S.PLAN_NOT_COMMITTABLE
  );

  refusedPrep({ plan: null }, S.PLAN_NOT_COMMITTABLE);
  refusedPrep({ plan: { ...withRefusals, changed: false } }, S.PLAN_NOT_COMMITTABLE);
  refusedPrep({ plan: { ...withRefusals, journal: null } }, S.PLAN_NOT_COMMITTABLE);
  refusedPrep(
    { plan: { ...withRefusals, append: "not-an-array" } },
    S.PLAN_NOT_COMMITTABLE
  );
});

test("refuses an append row that is not a recovery record", () => {
  const cases = [
    [{ ...proposal(), source: "manual" }, S.RECORD_PROVENANCE_INVALID],
    [{ ...proposal(), broker: "MT4" }, S.RECORD_PROVENANCE_INVALID],
    [{ ...proposal(), id: "" }, S.RECORD_ID_INVALID],
    [{ ...proposal(), brokerPositionId: "9o0" }, S.RECORD_POSITION_INVALID],
    [{ ...proposal(), coverageComplete: true }, S.RECORD_CLAIMS_COVERAGE],
    [null, S.RECORD_INVALID],
  ];

  for (const [row, reason] of cases) {
    refusedPrep({ plan: forgedPlan([row]) }, reason);
  }
});

// ==========================================================
// Requirements 5 and 9 - collisions, batch duplicates, replay
// ==========================================================

test("refuses an append whose id is already in the journal", () => {
  const edited = journalRow({ id: proposal().id, notes: "edited by the user" });
  const row = proposal();
  const plan = forgedPlan([row], [edited]);

  refusedPrepExactly({ plan, existingJournal: [edited] }, S.ID_COLLISION);
});

// Policy 3X-7D-B, enforced here rather than inherited. The step this contract
// prepares is what a writer hands storage, so the contract cannot rely on the
// planner having noticed: naming this reason proves the gate is this module's
// own, because a contract that skipped it would reach the reproduce step and
// be refused with PLAN_NOT_PREVIEW_OUTPUT instead.
test("refuses an append whose id is journaled under another account", () => {
  const held = journalRow({
    id: proposal().id,
    accountId: OTHER_ACCOUNT_ID,
    notes: "another account's own words",
  });
  const row = proposal();
  const plan = forgedPlan([row], [held]);

  refusedPrepExactly({ plan, existingJournal: [held] }, S.ID_JOURNALED_ELSEWHERE);
});

test("keeps the account-scoped collision reason when an id is journaled twice", () => {
  const row = proposal();
  const elsewhere = journalRow({ id: row.id, accountId: OTHER_ACCOUNT_ID });
  const held = journalRow({ id: row.id, accountId: ACCOUNT_ID });

  const plan = forgedPlan([row], [elsewhere, held]);

  const step = refusedPrep(
    { plan, existingJournal: [elsewhere, held] },
    S.ID_COLLISION
  );

  // The account the caller is committing to is named first: the new global
  // reason must not relabel a same-account collision.
  assert.deepEqual([...step.refusals], [S.ID_COLLISION]);
});

test("refuses a broker position already journaled under the live id namespace", () => {
  const live = journalRow({
    id: "mt5-900",
    broker: "MT5",
    brokerPositionId: "900",
  });
  const row = proposal();
  const plan = forgedPlan([row], [live]);

  refusedPrep({ plan, existingJournal: [live] }, S.POSITION_COLLISION);
});

test("does not silence a position collision across brokers", () => {
  const other = journalRow({
    id: "fx-900",
    broker: "OANDA",
    brokerPositionId: "900",
  });
  const row = proposal();
  const plan = forgedPlan([row], [other]);

  const step = prepared({ plan, existingJournal: [other] });

  assert.deepEqual([...step.append], [row]);
});

test("refuses duplicate identities inside one batch", () => {
  const row = proposal();

  const byId = prepareRecoveryCommitStep(
    input({ plan: forgedPlan([row, row]) })
  );

  assert.equal(byId.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);
  assert.ok(byId.refusals.includes(S.DUPLICATE_ID));

  const copy = proposal({ id: `mt5-position-${LOGIN}-900-copy` });
  const byPosition = prepareRecoveryCommitStep(
    input({ plan: forgedPlan([row, copy]) })
  );

  assert.equal(byPosition.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);
  assert.ok(byPosition.refusals.includes(S.DUPLICATE_POSITION));
});

test("replaying a committed recovery plan appends nothing", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);
  const step = prepared({ plan, existingJournal: [] });

  assert.equal(commit(step, plan).status, V.COMMITTED);

  // The same verdict over the journal as it stands after that commit: the
  // planner rejects the already-journaled position, so a replay cannot
  // duplicate the trade or grow the journal.
  const replay = planned(preview([row]), plan.journal);

  assert.deepEqual([...replay.append], []);
  assert.equal(replay.changed, false);

  const replayStep = prepared({
    plan: replay,
    verdict: preview([row]),
    existingJournal: [...plan.journal],
  });

  assert.deepEqual([...replayStep.append], []);
  assert.equal(replayStep.changed, false);
  assert.deepEqual([...replayStep.journal], [row]);
  assert.equal(replayStep.watermark.anchorUtc, ANCHOR_UTC);

  // A plan that appends nothing still carries the preview's provenance, which
  // is the case the row checks alone could never bind.
  assert.equal(replayStep.provenance.anchorUtc, ANCHOR_UTC);
  assert.equal(replayStep.provenance.mt5Login, LOGIN);
});

// ==========================================================
// Requirement 4 - existing rows survive untouched
// ==========================================================

test("keeps existing rows by reference so an edit cannot be merged away", () => {
  const edited = journalRow({ notes: "the user's own words" });
  const plan = planned(preview([proposal()]), [edited]);

  const step = prepared({ plan, existingJournal: [edited] });

  assert.equal(step.journal[0], edited);
  assert.equal(step.journal[0].notes, "the user's own words");
  assert.equal(step.append.length, 1);
});

test("refuses a plan whose journal is not existing rows then the append", () => {
  const edited = journalRow();
  const row = proposal();
  const base = planned(preview([row]), [edited]);

  const merged = prepareRecoveryCommitStep(
    input({
      plan: {
        ...base,
        journal: [{ ...edited, notes: "overwritten by recovery" }, row],
      },
      existingJournal: [edited],
    })
  );

  assert.equal(merged.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);
  assert.ok(merged.refusals.includes(S.PLAN_NOT_APPEND_ONLY));

  const dropped = prepareRecoveryCommitStep(
    input({
      plan: { ...base, journal: [row] },
      existingJournal: [edited],
    })
  );

  assert.equal(dropped.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);
  assert.ok(dropped.refusals.includes(S.PLAN_NOT_APPEND_ONLY));

  const reordered = prepareRecoveryCommitStep(
    input({
      plan: { ...base, journal: [row, edited] },
      existingJournal: [edited],
    })
  );

  assert.equal(reordered.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);
  assert.ok(reordered.refusals.includes(S.PLAN_NOT_APPEND_ONLY));

  const swappedTail = prepareRecoveryCommitStep(
    input({
      plan: { ...base, journal: [edited, { ...row }] },
      existingJournal: [edited],
    })
  );

  assert.equal(swappedTail.status, RECOVERY_COMMIT_STEP_STATUS.REFUSED);
  assert.ok(swappedTail.refusals.includes(S.PLAN_NOT_APPEND_ONLY));
});

// ==========================================================
// Requirement 6 - identity and anchor are proven, not assumed
// ==========================================================

test("refuses a missing or malformed broker identity", () => {
  const plan = planned(preview([proposal()]), []);

  refusedPrep({ plan, identity: undefined }, S.IDENTITY_INVALID);
  refusedPrep(
    { plan, identity: { mt5Login: LOGIN, mt5Server: "  " } },
    S.IDENTITY_INVALID
  );
  refusedPrep(
    { plan, identity: { mt5Login: "not-a-login", mt5Server: SERVER } },
    S.IDENTITY_INVALID
  );
  refusedPrep(
    { plan, identity: { mt5Login: "123456789012345678", mt5Server: SERVER } },
    S.IDENTITY_INVALID
  );
});

test("takes the broker identity in the server's own spelling", () => {
  const plan = planned(preview([proposal()]), []);

  const step = prepared({
    plan,
    existingJournal: [],
    identity: { mt5Login: ` ${LOGIN} `, mt5Server: SERVER.toLowerCase() },
  });

  assert.equal(step.identity.mt5Login, LOGIN);
  assert.equal(step.identity.mt5Server, SERVER_KEY);
});

test("refuses an append that names a different broker identity", () => {
  const row = proposal({ mt5Login: "87654321" });

  refusedPrep({ plan: forgedPlan([row]) }, S.RECORD_IDENTITY_MISMATCH);

  const otherServer = proposal({ mt5Server: "Other-Server" });

  refusedPrep({ plan: forgedPlan([otherServer]) }, S.RECORD_IDENTITY_MISMATCH);
});

test("refuses a missing or malformed anchor", () => {
  const plan = planned(preview([proposal()]), []);

  refusedPrep({ plan, anchorUtc: undefined }, S.ANCHOR_INVALID);
  refusedPrep({ plan, anchorUtc: "2026-10-21" }, S.ANCHOR_INVALID);
  refusedPrep({ plan, anchorUtc: "2026-10-21T12:00:05.123456Z" }, S.ANCHOR_INVALID);
  refusedPrep({ plan, anchorUtc: "2026-10-21T12:00:05+00:00" }, S.ANCHOR_INVALID);
});

test("refuses an append whose broker snapshot is not the anchor", () => {
  const row = proposal({ liveSnapshotToUtc: "2026-10-20T09:00:00Z" });

  refusedPrep({ plan: forgedPlan([row]) }, S.RECORD_ANCHOR_MISMATCH);
});

// ==========================================================
// Requirement 6, phase 6C - the provenance belongs to the preview
//
// identity and anchorUtc used to be assertions the caller made next to the
// plan, and the only cross-check was the appended rows. A plan that appends
// nothing - the replay case, and any case a caller might forge - carried no
// evidence at all, so these tests bind both values to the preview verdict that
// produced the plan, and require the plan to be reproducible from it.
// ==========================================================

test("takes its provenance from the preview the plan was planned from", () => {
  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);

  const step = prepared({ plan, verdict, existingJournal: [] });

  assert.equal(
    step.provenance.version,
    recoveryCommitContract.RECOVERY_COMMIT_PROVENANCE_VERSION
  );
  assert.equal(step.provenance.accountId, ACCOUNT_ID);
  assert.equal(step.provenance.mt5Login, LOGIN);
  assert.equal(step.provenance.mt5Server, SERVER_KEY);
  assert.equal(step.provenance.anchorUtc, ANCHOR_UTC);

  // Exactly these fields: a provenance record names a scope and a boundary and
  // never carries a write or coverage claim.
  assert.deepEqual(
    Object.keys(step.provenance).sort(),
    ["accountId", "anchorUtc", "mt5Login", "mt5Server", "version"]
  );

  assert.equal(JSON.stringify(step.provenance), step.provenanceBytes);

  // The durable value is scoped by the same provenance, so the two can never
  // drift apart into two different accounts' watermarks.
  assert.equal(step.watermark.mt5Login, step.provenance.mt5Login);
  assert.equal(step.watermark.mt5Server, step.provenance.mt5Server);
  assert.equal(step.watermark.anchorUtc, step.provenance.anchorUtc);
  assert.equal(step.watermark.accountId, step.provenance.accountId);
});

test("refuses a preview that is not a clean preview verdict", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  refusedPrep({ plan, verdict: undefined }, S.PREVIEW_INVALID);
  refusedPrep({ plan, verdict: null }, S.PREVIEW_INVALID);
  refusedPrep({ plan, verdict: "preview" }, S.PREVIEW_INVALID);
  refusedPrep(
    { plan, verdict: preview([row], { status: "blocked" }) },
    S.PREVIEW_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { records: null }) },
    S.PREVIEW_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { refusals: ["SCAN_NOT_SCANNED"] }) },
    S.PREVIEW_REFUSALS_PRESENT
  );
});

test("refuses a preview that already claims a write or a coverage proof", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  for (const key of ["journalWritten", "watermarkAdvanced"]) {
    refusedPrep(
      { plan, verdict: preview([row], { [key]: true }) },
      S.PREVIEW_CLAIMS_WRITE
    );
  }

  for (const key of ["coverageComplete", "retentionVerified"]) {
    refusedPrep(
      { plan, verdict: preview([row], { [key]: true }) },
      S.PREVIEW_CLAIMS_COVERAGE
    );
  }
});

test("refuses a preview whose identity is not the broker's own spelling", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  // The orchestrator names { mt5Login, mt5Server } (its planMT5RecoveryPreview identity).
  // Anything else - including the { accountId, login, server } spelling this
  // suite used to invent - is not evidence of who was scanned.
  refusedPrep(
    {
      plan,
      verdict: preview([row], {
        identity: { accountId: ACCOUNT_ID, login: LOGIN, server: SERVER },
      }),
    },
    S.PREVIEW_IDENTITY_INVALID
  );

  refusedPrep(
    { plan, verdict: preview([row], { identity: null }) },
    S.PREVIEW_IDENTITY_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { identity: { mt5Login: "not-a-login", mt5Server: SERVER } }) },
    S.PREVIEW_IDENTITY_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { identity: { mt5Login: LOGIN, mt5Server: "   " } }) },
    S.PREVIEW_IDENTITY_INVALID
  );
});

test("refuses a preview with no validated anchor", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  refusedPrep(
    { plan, verdict: preview([row], { anchorUtc: undefined }) },
    S.PREVIEW_ANCHOR_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { anchorUtc: null }) },
    S.PREVIEW_ANCHOR_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { anchorUtc: "2026-10-21T12:00:05.123Z" }) },
    S.PREVIEW_ANCHOR_INVALID
  );
  refusedPrep(
    { plan, verdict: preview([row], { anchorUtc: "2026-10-21T12:00:05+00:00" }) },
    S.PREVIEW_ANCHOR_INVALID
  );
});

test("refuses a preview planned for another account", () => {
  const row = proposal({ accountId: OTHER_ACCOUNT_ID });
  const verdict = preview([row], { accountId: OTHER_ACCOUNT_ID });
  const plan = planned(verdict, [], OTHER_ACCOUNT_ID);

  refusedPrep(
    { plan, verdict, accountId: ACCOUNT_ID },
    S.PREVIEW_ACCOUNT_MISMATCH
  );
});

test("refuses a broker identity that is not the preview's", () => {
  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);

  refusedPrep(
    { plan, verdict, identity: identity({ mt5Login: OTHER_LOGIN }) },
    S.PROVENANCE_IDENTITY_CONFLICT
  );

  refusedPrep(
    { plan, verdict, identity: identity({ mt5Server: "Other-Server" }) },
    S.PROVENANCE_IDENTITY_CONFLICT
  );
});

test("refuses an anchor that is not the preview's", () => {
  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);

  refusedPrep(
    { plan, verdict, anchorUtc: ANCHOR_LATER },
    S.PROVENANCE_ANCHOR_CONFLICT
  );
});

// ==========================================================
// Requirement 6, phase 6D - the login and the anchor are the pipeline's own
//
// Two things make a preview's identity and anchor trustworthy, and this module
// may only re-state them the way their producers do:
//
//   * one canonical login rule, shared with the clock, the orchestrator, the
//     adapter and the account layer (recoveryClock.js exports the one
//     canonicalLogin; the orchestrator and account layer import it as loginText,
//     the adapter calls it directly): trim, strip every leading zero,
//     refuse what is left empty or longer than fifteen digits. A second rule
//     here would scope a watermark under "00012345678" while the journal rows
//     name "12345678", and the next run would not find its own watermark;
//   * the anchor is a broker-clock second the preview's own sample produced,
//     and the ranges are the ranges that anchor builds
//     (mt5RecoveryPreview.js:116-161). A timestamp-shaped string proves
//     neither, so the clock and the window plan on the verdict are read.
// ==========================================================

test("takes a login the preview reports in the pipeline's canonical form", () => {
  // The account record may spell its login with leading zeros
  // (useTrustedDevice.js:33-37 stores what the broker gave). The pipeline
  // strips them, so this is one account, not two.
  const row = proposal();
  const plan = planned(preview([row]), []);

  const step = prepared({
    plan,
    verdict: preview([row]),
    identity: identity({ mt5Login: LOGIN_WITH_ZEROS }),
  });

  assert.equal(step.provenance.mt5Login, LOGIN);
  assert.equal(step.identity.mt5Login, LOGIN);
  assert.equal(step.watermark.mt5Login, LOGIN);

  // The scope the next run looks up has to be the scope the rows are filed
  // under, or a re-run appends the whole batch a second time.
  assert.equal(
    step.watermark.storageKey,
    recoveryWatermarkStorageKey({
      accountId: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: SERVER,
    })
  );
});

test("canonicalises a login exactly as the recovery clock does", () => {
  const accepted = [
    LOGIN,
    ` ${LOGIN} `,
    Number(LOGIN),
    LOGIN_WITH_ZEROS,
    "00000000000000012345678",
  ];

  const refused = [
    "0",
    "0000",
    "",
    "   ",
    0,
    -12345678,
    1.5,
    "not-a-login",
    "12 3456 78",
    "1234567890123456",
    "123456789012345678",
    null,
    undefined,
    {},
  ];

  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);

  for (const login of accepted) {
    const step = prepared({ plan, verdict, identity: identity({ mt5Login: login }) });

    // The reference is the module the anchor's own identity came from, not a
    // string copied into this file.
    const sample = clockFor(ANCHOR_UTC, login, SERVER);

    assert.equal(
      step.provenance.mt5Login,
      sample.sample.identity.mt5Login,
      `${String(login)} was canonicalised differently from the clock's own rule`
    );
    assert.equal(step.provenance.mt5Login, LOGIN);
  }

  for (const login of refused) {
    refusedPrep(
      { plan, verdict, identity: identity({ mt5Login: login }) },
      S.IDENTITY_INVALID
    );
  }
});

test("keeps the login ceiling past the zeros the pipeline strips", () => {
  // Nineteen characters, eight significant digits: the account exists, and a
  // rule that measures the ceiling before stripping throws it away.
  const row = proposal();
  const plan = planned(preview([row]), []);

  const step = prepared({
    plan,
    verdict: preview([row]),
    identity: identity({ mt5Login: LOGIN_LONG_WITH_ZEROS }),
  });

  assert.equal(step.provenance.mt5Login, LOGIN);

  // The ceiling itself is unchanged: fifteen significant digits is still the
  // widest login the producers accept, and it is taken in the caller's own
  // spelling.
  const widest = "123456789012345";
  const widestRow = proposal({ mt5Login: widest, id: `mt5-position-${widest}-900` });
  const widestVerdict = preview([widestRow], {
    identity: { mt5Login: widest, mt5Server: SERVER },
  });

  const preparedWidest = prepared({
    plan: planned(widestVerdict, []),
    verdict: widestVerdict,
    identity: identity({ mt5Login: `000${widest}` }),
  });

  assert.equal(preparedWidest.provenance.mt5Login, widest);

  // Sixteen digits is not a login at all, stripped or not.
  const tooWide = "1234567890123456";

  refusedPrep(
    {
      plan,
      verdict: preview([row], { identity: { mt5Login: tooWide, mt5Server: SERVER } }),
    },
    S.PREVIEW_IDENTITY_INVALID
  );

  refusedPrep(
    { plan, verdict: preview([row]), identity: identity({ mt5Login: tooWide }) },
    S.IDENTITY_INVALID
  );
});

test("binds the clock to the server's own spelling rather than its case", () => {
  // The verdict's identity comes from the persisted account and the sample's
  // from the broker's response, so the two may differ in case and padding and
  // still be one connection (mt5RecoveryOrchestrator.js planMT5RecoveryPreview compares the
  // server case-insensitively for exactly this reason).
  const row = proposal();
  const verdict = preview([row], {
    identity: { mt5Login: LOGIN, mt5Server: "  METATRADER-DEMO " },
  });

  assert.equal(verdict.clock.sample.identity.mt5Server, "METATRADER-DEMO");

  const plan = planned(verdict, []);
  const step = prepared({ plan, verdict });

  assert.equal(step.identity.mt5Server, SERVER_KEY);
  assert.equal(step.provenance.mt5Server, SERVER_KEY);
  assert.equal(
    step.watermark.storageKey,
    recoveryWatermarkStorageKey({
      accountId: ACCOUNT_ID,
      mt5Login: LOGIN,
      mt5Server: SERVER_KEY,
    })
  );

  // A server name the producers could never carry stays refused.
  refusedPrep(
    {
      plan,
      verdict: preview([row], {
        identity: { mt5Login: LOGIN, mt5Server: "Meta\u0001Trader" },
      }),
    },
    S.PREVIEW_IDENTITY_INVALID
  );
});

test("takes the record login in the spelling the adapter publishes", () => {
  // The adapter writes the canonical login into every record
  // (its checkIdentity and adaptRecord), while the account it came from may
  // be stored with leading zeros. Both arrive here, and they are one account.
  const row = proposal({ mt5Login: LOGIN, id: `mt5-position-${LOGIN}-900` });
  const verdict = preview([row], {
    identity: { mt5Login: LOGIN_WITH_ZEROS, mt5Server: SERVER },
  });

  const plan = planned(verdict, []);
  const step = prepared({ plan, verdict });

  assert.equal(step.provenance.mt5Login, LOGIN);
  assert.equal(step.append.length, 1);
});

test("accepts an anchor its own clock and windows agree on", () => {
  const row = proposal({ liveSnapshotToUtc: ANCHOR_LATER });
  const verdict = preview([row], { anchorUtc: ANCHOR_LATER });

  // The evidence moved with the claim: this is the cover the builder makes for
  // a later second, so agreement here cannot be the fixture agreeing with itself.
  assert.equal(verdict.clock.anchorUtc, ANCHOR_LATER);
  assert.equal(verdict.windowPlan.windows.length, verdict.windows.length);
  assert.notEqual(ANCHOR_LATER, ANCHOR_UTC);

  const plan = planned(verdict, []);
  const step = prepared({ plan, verdict, anchorUtc: ANCHOR_LATER });

  assert.equal(step.provenance.anchorUtc, ANCHOR_LATER);
  assert.equal(step.anchorUtc, ANCHOR_LATER);
});

test("refuses an anchor its own clock contradicts", () => {
  // Valid to the second, and named by a broker sample two hours earlier. The
  // ranges on this verdict are the later anchor's own, so the clock is the only
  // thing that disagrees.
  const laterRow = proposal({ liveSnapshotToUtc: ANCHOR_LATER });
  const staleAnchor = preview([laterRow], {
    anchorUtc: ANCHOR_LATER,
    clock: clockFor(ANCHOR_UTC),
  });

  refusedPrep(
    {
      plan: planned(staleAnchor, []),
      verdict: staleAnchor,
      anchorUtc: ANCHOR_LATER,
    },
    S.PREVIEW_CLOCK_ANCHOR_MISMATCH
  );

  // The anchor text is the clock's, and the millisecond beside it is not.
  const driftedMs = preview([proposal()], { anchorMs: ANCHOR_MS + 60_000 });

  refusedPrep(
    { plan: planned(driftedMs, []), verdict: driftedMs },
    S.PREVIEW_CLOCK_ANCHOR_MISMATCH
  );

  // The reverse: the milliseconds are this anchor's and the text beside them is
  // a second later. One instant cannot be spelled two ways, and the text is
  // what the watermark and every record's liveSnapshotToUtc are compared to.
  const driftedText = preview([proposal()], {
    clock: Object.freeze({
      ...clockFor(ANCHOR_UTC),
      anchorUtc: "2026-10-21T12:00:06Z",
    }),
  });

  refusedPrep(
    { plan: planned(driftedText, []), verdict: driftedText },
    S.PREVIEW_CLOCK_ANCHOR_MISMATCH
  );
});

test("refuses a preview with no usable clock evidence", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  // The shape every preview carried before this gate existed: an anchor string
  // with nothing behind it.
  refusedPrep(
    { plan, verdict: preview([row], { clock: null }) },
    S.PREVIEW_CLOCK_INVALID
  );

  // A reading the clock module itself refused (older than the recovery window),
  // which is a blocked preview, not an anchor.
  refusedPrep(
    { plan, verdict: preview([row], { clock: staleClock() }) },
    S.PREVIEW_CLOCK_INVALID
  );

  // An accepted status that carries no sample and no instant.
  refusedPrep(
    { plan, verdict: preview([row], { clock: { status: "ACCEPTED" } }) },
    S.PREVIEW_CLOCK_INVALID
  );

  // Internally inconsistent: it names this anchor to the millisecond and
  // arrives with no reading behind it, so there is nothing to say which clock
  // the second came from.
  refusedPrep(
    {
      plan,
      verdict: preview([row], {
        clock: Object.freeze({
          status: "ACCEPTED",
          anchorUtc: ANCHOR_UTC,
          anchorMs: ANCHOR_MS,
          sample: null,
        }),
      }),
    },
    S.PREVIEW_CLOCK_INVALID
  );
});

test("refuses clock evidence belonging to another MT5 account", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  // The sample is fresh, trusted and anchored on this very second - and it came
  // from somebody else's terminal (recoveryClock.js:17-21).
  refusedPrep(
    { plan, verdict: preview([row], { clock: clockFor(ANCHOR_UTC, OTHER_LOGIN) }) },
    S.PREVIEW_CLOCK_IDENTITY_MISMATCH
  );

  refusedPrep(
    {
      plan,
      verdict: preview([row], {
        clock: clockFor(ANCHOR_UTC, LOGIN, "Other-Server"),
      }),
    },
    S.PREVIEW_CLOCK_IDENTITY_MISMATCH
  );
});

test("refuses a preview with no window plan for its anchor", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  refusedPrep(
    { plan, verdict: preview([row], { windowPlan: null }) },
    S.PREVIEW_WINDOWS_INVALID
  );

  refusedPrep(
    { plan, verdict: preview([row], { windows: null }) },
    S.PREVIEW_WINDOWS_INVALID
  );

  // A plan the builder itself refused has no ranges to have read
  // (mt5RecoveryPreview.js:128-135).
  refusedPrep(
    {
      plan,
      verdict: preview([row], {
        windowPlan: Object.freeze({
          windows: Object.freeze([]),
          refusal: "RECOVERY_ANCHOR_INVALID",
        }),
        windows: Object.freeze([]),
      }),
    },
    S.PREVIEW_WINDOWS_INVALID
  );
});

test("refuses windows that are not the plan the preview carries", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  // The ranges the scan is claimed to have read, and the plan beside them, are
  // two different covers.
  refusedPrep(
    {
      plan,
      verdict: preview([row], { windows: windowPlan(ANCHOR_LATER).windows }),
    },
    S.PREVIEW_WINDOW_SEQUENCE_INVALID
  );

  // And the narrower lie: every range starts where the plan says and ends one
  // second later. The plan alone is what the anchor bounds, so a cover whose
  // ends disagree with it is not the cover this preview read.
  refusedPrep(
    {
      plan,
      verdict: preview([row], {
        windows: preview([row]).windows.map((window) =>
          Object.freeze({
            fromUtc: window.fromUtc,
            toUtc: isoSec(Date.parse(window.toUtc) + 1_000),
          })
        ),
      }),
    },
    S.PREVIEW_WINDOW_SEQUENCE_INVALID
  );
});

test("refuses a tile wider than the recovery window policy", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  const { TILE_DAYS } = RECOVERY_WINDOW_POLICY;
  const tooWide = tile(
    ANCHOR_MS - (TILE_DAYS + 10) * DAY_MS,
    ANCHOR_MS
  );

  // Internally consistent and ending on the anchor: the only thing wrong with
  // it is that a tile this wide was never a proven read
  // (src/lib/mt5RecoveryWindows.js:11-20).
  const verdict = preview([row], {
    windowPlan: tilePlan(tooWide),
    windows: [tooWide],
  });

  refusedPrep({ plan, verdict }, S.PREVIEW_WINDOW_TOO_WIDE);
});

test("refuses a window plan that is not the cover for the preview's anchor", () => {
  const row = proposal();
  const plan = planned(preview([row]), []);

  const later = windowPlan(ANCHOR_LATER);
  const verdict = preview([row], { windowPlan: later, windows: later.windows });

  // Plan and windows agree with each other, and every tile is inside policy -
  // they simply stop two hours after the second this preview anchors on, so the
  // rows cannot be bounded by the anchor this step would record.
  assert.deepEqual(
    [...verdict.windows],
    [...later.windows],
    "the forged cover must agree with itself"
  );

  refusedPrep({ plan, verdict }, S.PREVIEW_WINDOW_PLAN_MISMATCH);
});

test("rebuilds the anchor's cover from the module that owns it", () => {
  const anchorUtc = ANCHOR_UTC;

  // Assembled the way mt5RecoveryPreview.js:116-161 assembles it: the clock
  // answers with the anchor, the window builder is asked for that anchor and
  // nothing else, and the identity is the one the broker reported on the sample.
  const clock = clockFor(anchorUtc);
  const windowPlan = buildRecoveryWindows({ anchorUtc: clock.anchorUtc });

  assert.equal(windowPlan.refusal, null);

  const row = proposal();
  const verdict = preview([row], {
    identity: Object.freeze({ ...clock.sample.identity }),
    clock,
    windowPlan,
    anchorUtc: clock.anchorUtc,
    anchorMs: clock.anchorMs,
    windows: windowPlan.windows,
  });

  const plan = planned(verdict, []);
  const step = prepared({ plan, verdict });

  assert.equal(step.provenance.anchorUtc, clock.anchorUtc);
  assert.equal(step.provenance.mt5Login, LOGIN);

  // The cover ends where the anchor is, which is the whole reason the anchor
  // bounds what this step may say about the account's history.
  const last = windowPlan.windows[windowPlan.windows.length - 1];

  assert.equal(last.toUtc, clock.anchorUtc);
  assert.equal(step.coverageComplete, false, "a full cover is not coverage");
});

test("clock and window evidence never becomes a coverage or retention claim", () => {
  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);

  const step = prepared({ plan, verdict });

  assert.equal(step.coverageComplete, false);
  assert.equal(step.retentionVerified, false);
  assert.equal(step.watermark.coverageComplete, false);
  assert.equal(step.watermark.retentionVerified, false);

  const outcome = commit(step, plan);

  assert.equal(outcome.status, V.COMMITTED);
  assert.equal(outcome.coverageComplete, false);
  assert.equal(outcome.retentionVerified, false);
});

test("refuses a plan the preview does not produce", () => {
  const row = proposal();
  const plan = forgedPlan([row]);

  // Nothing was reported as closed, yet this plan proposes a row: no row-level
  // or collision check can see it, because the rows themselves are clean.
  refusedPrep({ plan, verdict: preview([]) }, S.PLAN_NOT_PREVIEW_OUTPUT);

  // The other direction, and the one a caller could use to hide work: a replay
  // plan whose rejected list has been emptied. Its shape, rows and journal all
  // still add up, so only reproducing the plan from the preview names it.
  const reported = preview([row]);
  const first = planned(reported, []);
  const replay = planned(reported, [...first.journal]);

  assert.deepEqual([...replay.rejected], [
    {
      reason: "RECOVERY_COMMIT_ID_ALREADY_JOURNALED",
      id: row.id,
      positionId: row.brokerPositionId,
      accountId: ACCOUNT_ID,
    },
  ]);

  refusedPrep(
    {
      plan: { ...replay, rejected: [] },
      verdict: reported,
      existingJournal: [...first.journal],
    },
    S.PLAN_NOT_PREVIEW_OUTPUT
  );
});

test("detects provenance changed after the step was prepared", () => {
  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);
  const step = prepared({ plan, verdict, existingJournal: [] });

  assert.equal(commit(step, plan).status, V.COMMITTED);

  const loginSwap = {
    ...step,
    provenance: { ...step.provenance, mt5Login: OTHER_LOGIN },
    provenanceBytes: JSON.stringify({
      ...step.provenance,
      mt5Login: OTHER_LOGIN,
    }),
  };

  const anchorSwap = {
    ...step,
    provenance: { ...step.provenance, anchorUtc: ANCHOR_LATER },
    provenanceBytes: JSON.stringify({
      ...step.provenance,
      anchorUtc: ANCHOR_LATER,
    }),
  };

  const staleBytes = {
    ...step,
    provenance: { ...step.provenance, mt5Server: "another-server" },
  };

  const dropped = { ...step, provenance: null, provenanceBytes: null };

  for (const candidate of [loginSwap, anchorSwap, staleBytes, dropped]) {
    const outcome = verifyRecoveryCommitEvidence({
      prepared: candidate,
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(step.watermark),
    });

    assert.equal(outcome.status, V.REFUSED);
    assert.equal(outcome.journalWritten, false);
    assert.equal(outcome.watermarkAdvanced, false);
    assert.equal(outcome.effectiveWatermark, null);
    assert.equal(outcome.coverageComplete, false);
  }

  // A provenance that disagrees with the watermark is not this contract's step.
  assert.ok(
    verifyRecoveryCommitEvidence({
      prepared: loginSwap,
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(step.watermark),
    }).refusals.includes(S.PREPARED_STEP_INVALID)
  );

  assert.ok(
    verifyRecoveryCommitEvidence({
      prepared: anchorSwap,
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(step.watermark),
    }).refusals.includes(S.PREPARED_STEP_INVALID)
  );

  // Bytes that no longer describe the block they were frozen from are named as
  // a provenance defect, not just a step this module could not read.
  assert.ok(
    verifyRecoveryCommitEvidence({
      prepared: staleBytes,
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(step.watermark),
    }).refusals.includes(S.PROVENANCE_INVALID)
  );

  assert.ok(
    verifyRecoveryCommitEvidence({
      prepared: dropped,
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(step.watermark),
    }).refusals.includes(S.PREPARED_STEP_INVALID)
  );
});

test("a validated preview is never durable commit evidence", () => {
  const row = proposal();
  const verdict = preview([row]);
  const plan = planned(verdict, []);

  const step = prepared({ plan, verdict, existingJournal: [] });

  // Provenance accepted, and still nothing was written.
  assert.equal(step.provenance.anchorUtc, ANCHOR_UTC);
  assert.equal(step.committed, false);
  assert.equal(step.journalWritten, false);
  assert.equal(step.watermarkAdvanced, false);
  assert.equal(step.coverageComplete, false);

  const outcome = verifyRecoveryCommitEvidence({
    prepared: step,
    journalEvidence: bytes(plan.journal),
    watermarkEvidence: undefined,
  });

  assert.equal(outcome.status, V.UNCOMMITTED);
  assert.equal(outcome.watermarkAdvanced, false);
  assert.ok(outcome.refusals.includes(S.WATERMARK_EVIDENCE_INVALID));

  const committed = commit(step, plan);

  assert.equal(committed.status, V.COMMITTED);
  assert.equal(committed.coverageComplete, false);
  assert.equal(committed.retentionVerified, false);
});

// ==========================================================
// Requirements 7, 8 and 10 - evidence, fail-closed, separation
// ==========================================================

test("commits only when both byte read-backs match independently", () => {
  const plan = planned(preview([proposal()]), [journalRow()]);
  const step = prepared({ plan, existingJournal: [plan.journal[0]] });

  assert.equal(step.coverageComplete, false);
  assert.equal(step.retentionVerified, false);
  assert.equal(step.journalWritten, false);
  assert.equal(step.watermarkAdvanced, false);
  assert.equal(step.committed, false);

  const outcome = commit(step, plan);

  assert.equal(outcome.status, V.COMMITTED);
  assert.equal(outcome.journalVerified, true);
  assert.equal(outcome.watermarkVerified, true);
  assert.equal(outcome.journalWritten, true);
  assert.equal(outcome.watermarkAdvanced, true);
  assert.equal(outcome.anchorUtc, ANCHOR_UTC);
  assert.equal(outcome.accountId, ACCOUNT_ID);
  assert.deepEqual({ ...outcome.identity }, { mt5Login: LOGIN, mt5Server: SERVER_KEY });
  assert.equal(outcome.effectiveWatermark, step.watermark);

  // Durable bytes are not coverage: no verification lets a commit claim the
  // broker returned its whole history.
  assert.equal(outcome.coverageComplete, false);
  assert.equal(outcome.retentionVerified, false);
}
);

test("fails closed when the journal bytes did not read back", () => {
  const plan = planned(preview([proposal()]), []);
  const step = prepared({ plan, existingJournal: [] });

  const outcome = verifyRecoveryCommitEvidence({
    prepared: step,
    journalEvidence: { readBack: "[]" },
    watermarkEvidence: bytes(step.watermark),
  });

  assert.equal(outcome.status, V.UNCOMMITTED);
  assert.equal(outcome.journalVerified, false);
  assert.equal(outcome.watermarkVerified, true);
  assert.equal(outcome.journalWritten, false);
  assert.equal(outcome.watermarkAdvanced, false);
  assert.ok(outcome.refusals.includes(S.JOURNAL_EVIDENCE_MISMATCH));
});

test("fails closed when the watermark bytes did not read back", () => {
  const plan = planned(preview([proposal()]), []);
  const step = prepared({ plan, existingJournal: [] });

  const outcome = verifyRecoveryCommitEvidence({
    prepared: step,
    journalEvidence: bytes(plan.journal),
    watermarkEvidence: {
      readBack: JSON.stringify({ ...step.watermark, advanced: true }),
    },
  });

  assert.equal(outcome.status, V.UNCOMMITTED);
  assert.equal(outcome.journalVerified, true);
  assert.equal(outcome.watermarkVerified, false);
  assert.equal(outcome.journalWritten, false);
  assert.equal(outcome.watermarkAdvanced, false);
  assert.ok(outcome.refusals.includes(S.WATERMARK_EVIDENCE_MISMATCH));
});

test("fails closed when either read-back is not bytes", () => {
  const plan = planned(preview([proposal()]), []);
  const step = prepared({ plan, existingJournal: [] });

  const cases = [
    [undefined, bytes(step.watermark), S.JOURNAL_EVIDENCE_INVALID],
    [bytes(plan.journal), undefined, S.WATERMARK_EVIDENCE_INVALID],
    [{ readBack: null }, bytes(step.watermark), S.JOURNAL_EVIDENCE_INVALID],
    [bytes(plan.journal), { readBack: 42 }, S.WATERMARK_EVIDENCE_INVALID],
    [{}, {}, S.JOURNAL_EVIDENCE_INVALID],
    [undefined, undefined, S.JOURNAL_EVIDENCE_INVALID],
  ];

  for (const [journalEvidence, watermarkEvidence, reason] of cases) {
    const outcome = verifyRecoveryCommitEvidence({
      prepared: step,
      journalEvidence,
      watermarkEvidence,
    });

    assert.equal(outcome.status, V.UNCOMMITTED);
    assert.equal(outcome.journalWritten, false);
    assert.equal(outcome.watermarkAdvanced, false);
    assert.ok(
      outcome.refusals.includes(reason),
      `expected ${reason}, got ${JSON.stringify(outcome.refusals)}`
    );
  }
});

test("refuses evidence handed to anything but a prepared step", () => {
  const plan = planned(preview([proposal()]), []);
  const step = prepared({ plan, existingJournal: [] });

  const forgedKey = {
    ...step,
    watermark: { ...step.watermark, storageKey: "someone-elses-watermark" },
  };

  const broken = [
    null,
    { ...step, status: RECOVERY_COMMIT_STEP_STATUS.REFUSED },
    { ...step, journalWritten: true },
    { ...step, coverageComplete: true },
    { ...step, watermarkBytes: JSON.stringify({ forged: true }) },
    { ...step, accountId: OTHER_ACCOUNT_ID },
    { ...step, anchorUtc: "2026-10-21" },
    { ...forgedKey, watermarkBytes: JSON.stringify(forgedKey.watermark) },
  ];

  for (const candidate of broken) {
    const outcome = verifyRecoveryCommitEvidence({
      prepared: candidate,
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(step.watermark),
    });

    assert.equal(outcome.status, V.REFUSED);
    assert.equal(outcome.journalVerified, false);
    assert.equal(outcome.watermarkVerified, false);
    assert.equal(outcome.journalWritten, false);
    assert.equal(outcome.watermarkAdvanced, false);
    assert.equal(outcome.coverageComplete, false);
    assert.equal(outcome.retentionVerified, false);
    assert.equal(outcome.effectiveWatermark, null);

    // Nothing about a step this module could not read is echoed back: an
    // account, identity or anchor it disagrees with cannot become a claim.
    assert.equal(outcome.accountId, null);
    assert.equal(outcome.identity, null);
    assert.equal(outcome.anchorUtc, null);
    assert.ok(outcome.refusals.includes(S.PREPARED_STEP_INVALID));
  }
});

test("refuses a step whose watermark is not the schema it belongs to", () => {
  const plan = planned(preview([proposal()]), []);
  const step = prepared({ plan, existingJournal: [] });

  const forgeries = [
    // a write claim smuggled into the durable value
    { ...step.watermark, journalWritten: true },
    // the boundary moved without the step knowing
    { ...step.watermark, anchorUtc: "2027-01-01T00:00:00Z" },
    // another account's key
    { ...step.watermark, storageKey: "mt5-recovery-watermark:1:12345678:other:x" },
    // a scope field missing
    { ...step.watermark, storageKey: undefined },
  ];

  for (const watermark of forgeries) {
    const outcome = verifyRecoveryCommitEvidence({
      prepared: { ...step, watermark, watermarkBytes: JSON.stringify(watermark) },
      journalEvidence: bytes(plan.journal),
      watermarkEvidence: bytes(watermark),
    });

    assert.equal(outcome.status, V.REFUSED);
    assert.equal(outcome.watermarkAdvanced, false);
    assert.equal(outcome.journalWritten, false);
    assert.ok(outcome.refusals.includes(S.PREPARED_STEP_INVALID));
  }
});

test("a step and its watermark serialize deterministically", () => {  const rows = [proposal({ positionId: "901" }), proposal({ positionId: "900" })];
  const existing = [journalRow()];

  const firstPlan = planned(preview(rows), existing);
  const secondPlan = planned(preview(rows), existing);

  const first = prepared({ plan: firstPlan, existingJournal: existing });
  const second = prepared({
    plan: secondPlan,
    existingJournal: existing,
    identity: identity({ mt5Server: SERVER_KEY.toUpperCase() }),
  });

  assert.equal(first.watermarkBytes, second.watermarkBytes);
  assert.equal(JSON.stringify(first.watermark), first.watermarkBytes);
  assert.equal(JSON.stringify(first.journal), first.journalBytes);

  // The bytes are the writer's contract: a read-back must equal them exactly,
  // including the existing row sitting ahead of the recovered ones.
  assert.equal(
    first.journalBytes,
    JSON.stringify([existing[0], rows[0], rows[1]])
  );
});

test("freezes the step so a writer cannot rewrite the proposal", () => {
  const plan = planned(preview([proposal()]), []);
  const step = prepared({ plan, existingJournal: [] });

  assert.ok(Object.isFrozen(step));
  assert.ok(Object.isFrozen(step.append));
  assert.ok(Object.isFrozen(step.journal));
  assert.ok(Object.isFrozen(step.watermark));
  assert.ok(Object.isFrozen(step.identity));
  assert.ok(Object.isFrozen(step.refusals));

  const outcome = commit(step, plan);

  assert.ok(Object.isFrozen(outcome));
  assert.ok(Object.isFrozen(outcome.refusals));
});

// ==========================================================
// Purity - this contract performs no I/O of its own
// ==========================================================

test("the contract module performs no I/O", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./mt5RecoveryCommitContract.js", import.meta.url)),
    "utf8"
  );

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "fetch(",
    "Date.now(",
    "new Date(",
    "require(",
    "readFileSync",
    "node:fs",
    "node:http",
  ]) {
    assert.ok(
      source.includes(forbidden) === false,
      `the contract must not contain ${forbidden}`
    );
  }

  assert.ok(
    source.includes("./mt5RecoveryJournalCommit.js"),
    "the contract must take its plan status vocabulary from the planner"
  );
});
