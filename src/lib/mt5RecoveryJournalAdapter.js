import { sumDecimalTexts, sumDealMoney } from "./mt5DealAmounts.js";
import { buildRecoveryJournalRecords } from "./mt5HistoryRecoveryJournal.js";
import { reconstructClosedPositions } from "./mt5HistoryReconstruction.js";
import { canonicalLogin } from "../utils/trading/recoveryClock.js";

// ==========================================================
// Recovered positions -> journal-ready proposals
//
// Three modules already answer narrower questions:
//   mt5HistoryRecoveryScan proves what the bridge reported and refuses what
//                            it could not,
//   mt5HistoryReconstruction proves which deals formed one closed position,
//   mt5HistoryRecoveryJournal joins those deals back to broker money.
//
// None of them knows about accounts, about ids the journal can dedupe on,
// or about the field names the journal's P&L consumers read. This module
// adds exactly that and invents nothing: every amount is the broker's own
// decimal text, carried through unchanged.
//
// P&L precedence is why the four components live under recoveryComponents.
// normalizeJournalTrade and the positions panel walk netProfit / netPnL /
// grossProfit / profit / commission / swap, so a top-level `profit` would
// be read as a gross figure and combined again with a commission already
// inside the total (src/context/JournalContext.jsx:552-559,
// src/components/trading/positions/shared.js:211-303).
//
// Pure by construction: no React, storage, network, timer or journal call.
// It returns proposals; a later, separately approved call site decides
// whether anything is written.
// ==========================================================

const DIGITS_ONLY = /^[0-9]+$/;
const DECIMAL_TEXT = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;

const MONEY_FIELDS = Object.freeze(["profit", "commission", "swap", "fee"]);

// The reconstruction's own vocabulary (mt5HistoryReconstruction.js:101-106).
// extractPage accepts no other type for a trade deal (:365 with :111), and
// evaluateGroup refuses a first deal that is not an IN (:760), so the two
// mappings below cover every row a candidate can have been built from;
// anything else is refused rather than guessed at.
const DEAL_TYPE_BUY = 0;
const DEAL_TYPE_SELL = 1;
const DEAL_ENTRY_IN = 0;

function sideOfDealType(type) {
  if (type === DEAL_TYPE_BUY) return "buy";
  if (type === DEAL_TYPE_SELL) return "sell";

  return null;
}

// Facts deal history never reported, named so no consumer can infer them.
export const RECOVERY_DATA_GAPS = Object.freeze([
  "CURRENCY",
  "STOP_LOSS",
  "TAKE_PROFIT",
  "ENTRY_PRICE",
  "EXIT_PRICE",
  "RISK_REWARD",
]);

export const RECOVERY_ADAPTER_STATUS = Object.freeze({
  PROPOSED: "proposed",
  BLOCKED: "blocked",
});

export const RECOVERY_ADAPTER_REASONS = Object.freeze({
  SCAN_NOT_SCANNED: "SCAN_NOT_SCANNED",
  RESULT_INVALID: "RESULT_INVALID",
  PAGES_INVALID: "PAGES_INVALID",
  RECOVERY_INVALID: "RECOVERY_INVALID",
  EXISTING_JOURNAL_INVALID: "EXISTING_JOURNAL_INVALID",

  SCAN_RETRY_REQUIRED: "SCAN_RETRY_REQUIRED",
  SCAN_REFUSALS_PRESENT: "SCAN_REFUSALS_PRESENT",
  REJECTED_PAGES_PRESENT: "REJECTED_PAGES_PRESENT",
  SNAPSHOT_EVIDENCE_INCOMPLETE: "SNAPSHOT_EVIDENCE_INCOMPLETE",
  SNAPSHOT_GENERATION_AMBIGUOUS: "SNAPSHOT_GENERATION_AMBIGUOUS",
  SNAPSHOT_AMBIGUOUS: "SNAPSHOT_AMBIGUOUS",
  SNAPSHOT_TIMESTAMP_MISSING: "SNAPSHOT_TIMESTAMP_MISSING",
  COVERAGE_CLAIMED: "COVERAGE_CLAIMED",
  PAGES_EVIDENCE_MISMATCH: "PAGES_EVIDENCE_MISMATCH",
  RECOVERY_EVIDENCE_MISMATCH: "RECOVERY_EVIDENCE_MISMATCH",
  NO_ACCEPTED_PAGE_EVIDENCE: "NO_ACCEPTED_PAGE_EVIDENCE",
  SCAN_EVIDENCE_MISSING: "SCAN_EVIDENCE_MISSING",
  PAGES_NOT_SCAN_EVIDENCE: "PAGES_NOT_SCAN_EVIDENCE",
  SCAN_IDENTITY_MISMATCH: "SCAN_IDENTITY_MISMATCH",
  RESULT_NOT_SCAN_EVIDENCE: "RESULT_NOT_SCAN_EVIDENCE",
  RECOVERY_NOT_SCAN_EVIDENCE: "RECOVERY_NOT_SCAN_EVIDENCE",

  ACCOUNT_INVALID: "ACCOUNT_INVALID",
  MISSING_ACCOUNT_ID: "MISSING_ACCOUNT_ID",
  MISSING_MT5_LOGIN: "MISSING_MT5_LOGIN",
  MISSING_MT5_SERVER: "MISSING_MT5_SERVER",
  IDENTITY_INVALID: "IDENTITY_INVALID",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
  IDENTITY_SERVER_NONCANONICAL: "IDENTITY_SERVER_NONCANONICAL",
  BROKER_ACCOUNT_ID_CONFLICT: "BROKER_ACCOUNT_ID_CONFLICT",

  UNKNOWN_POSITION_EVIDENCE: "UNKNOWN_POSITION_EVIDENCE",
  TICKET_EVIDENCE_MISMATCH: "TICKET_EVIDENCE_MISMATCH",
  CANDIDATE_SNAPSHOT_MISMATCH: "CANDIDATE_SNAPSHOT_MISMATCH",
  CANDIDATE_SYMBOL_MISMATCH: "CANDIDATE_SYMBOL_MISMATCH",
  CANDIDATE_SIDE_MISMATCH: "CANDIDATE_SIDE_MISMATCH",
  CANDIDATE_LIFECYCLE_MISMATCH: "CANDIDATE_LIFECYCLE_MISMATCH",
  CANDIDATE_DEAL_COUNT_MISMATCH: "CANDIDATE_DEAL_COUNT_MISMATCH",
  DEAL_ROW_MISSING: "DEAL_ROW_MISSING",
  DEAL_ROW_CONFLICT: "DEAL_ROW_CONFLICT",
  DEAL_ROW_MALFORMED: "DEAL_ROW_MALFORMED",
  DEAL_ROW_POSITION_MISMATCH: "DEAL_ROW_POSITION_MISMATCH",
  DEAL_ROW_SYMBOL_MISMATCH: "DEAL_ROW_SYMBOL_MISMATCH",
  DEAL_OPEN_TIME_MISMATCH: "DEAL_OPEN_TIME_MISMATCH",
  DEAL_OPEN_ENTRY_MISMATCH: "DEAL_OPEN_ENTRY_MISMATCH",
  DEAL_OPEN_TYPE_MISMATCH: "DEAL_OPEN_TYPE_MISMATCH",
  DEAL_CLOSE_TIME_MISMATCH: "DEAL_CLOSE_TIME_MISMATCH",
  DEAL_VOLUME_MISMATCH: "DEAL_VOLUME_MISMATCH",
  DEAL_MONEY_EVIDENCE_MISMATCH: "DEAL_MONEY_EVIDENCE_MISMATCH",

  TICKET_EVIDENCE_MISSING: "TICKET_EVIDENCE_MISSING",
  MISSING_POSITION_ID: "MISSING_POSITION_ID",
  MISSING_SYMBOL: "MISSING_SYMBOL",
  SIDE_INVALID: "SIDE_INVALID",
  VOLUME_INVALID: "VOLUME_INVALID",
  LIFECYCLE_TIME_ORDER_INVALID: "LIFECYCLE_TIME_ORDER_INVALID",
  RECOVERY_COMPONENTS_INVALID: "RECOVERY_COMPONENTS_INVALID",
  RECOVERY_TOTAL_INVALID: "RECOVERY_TOTAL_INVALID",
  RECOVERY_TOTAL_COMPONENTS_MISMATCH: "RECOVERY_TOTAL_COMPONENTS_MISMATCH",
  POSITION_UNRESOLVED: "POSITION_UNRESOLVED",
  DEAL_EVIDENCE_REFUSED: "DEAL_EVIDENCE_REFUSED",

  ALREADY_JOURNALED_ID: "ALREADY_JOURNALED_ID",
  ALREADY_JOURNALED_ID_ELSEWHERE: "ALREADY_JOURNALED_ID_ELSEWHERE",
  ALREADY_JOURNALED_POSITION: "ALREADY_JOURNALED_POSITION",
});

const R = RECOVERY_ADAPTER_REASONS;

const SIDES = new Set(["buy", "sell"]);

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

// The login form the whole recovery pipeline agrees on lives in
// src/utils/trading/recoveryClock.js, together with the clock sample and the
// window plan a commit has to be able to reproduce. This module keeps the
// tagged result because its refusals distinguish an account that was never
// named from one that was named badly.
function accountText(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "string" && value.trim() !== "") return value.trim();

  return null;
}

function digitText(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? String(value) : null;
  }

  if (typeof value === "string" && DIGITS_ONLY.test(value)) return value;

  return null;
}

function isTicketText(value) {
  return typeof value === "string" && DIGITS_ONLY.test(value) && value !== "0";
}

function ticketTrail(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(isTicketText)) return null;

  return value;
}

function sameTickets(a, b) {
  if (a.length !== b.length) return false;

  return a.every((ticket, index) => ticket === b[index]);
}

function isTimestamp(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isZeroDecimal(text) {
  return text.replace(".", "").replace(/0+$/, "") === "";
}

function componentsOf(record) {
  return Object.freeze(
    MONEY_FIELDS.reduce((acc, field) => ({ ...acc, [field]: record[field] }), {})
  );
}

function entry(reason, details = {}) {
  return Object.freeze({ reason, ...details });
}

function blocked(refusals) {
  return Object.freeze({
    status: RECOVERY_ADAPTER_STATUS.BLOCKED,
    refusals: Object.freeze([...refusals]),
    records: Object.freeze([]),
    skipped: Object.freeze([]),
    rejected: Object.freeze([]),
    remaining: Object.freeze({
      unresolvedCount: 0,
      unassignedCount: 0,
      refusedCount: 0,
    }),
  });
}

// ==========================================================
// Inputs
// ==========================================================

// A stable text form of a page record, used to prove the pages in hand are
// the pages a scan consumed. Reference equality alone is not enough: an
// outcome and its pages survive being persisted and reloaded as a JSON
// round trip, and that pair still has to pair. Key order is sorted because
// the order a page happens to list its fields in is not part of its
// meaning; everything else — every deal row, every amount's exact decimal
// text — is compared byte for byte.
function canonicalEvidence(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalEvidence).join(",")}]`;
  }

  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalEvidence(value[key])}`)
    .join(",")}}`;
}

// The identity a scan says it asked the route for. Both halves have to be
// usable, or there is nothing beside the pages to check them against.
function scanIdentityOf(identity) {
  if (!isPlainObject(identity)) return null;

  const login = canonicalLogin(identity.mt5Login);
  const server = accountText(identity.mt5Server);

  if (login.login === undefined || server === null) return null;

  return { login: login.login, server };
}

function readOutcome(outcome, refusals) {
  if (!isPlainObject(outcome) || outcome.status !== "scanned") {
    refusals.push(R.SCAN_NOT_SCANNED);
    return null;
  }

  if (
    !Array.isArray(outcome.refusals) ||
    !isPlainObject(outcome.result) ||
    !Array.isArray(outcome.result.closed) ||
    !Array.isArray(outcome.result.unresolved) ||
    !isPlainObject(outcome.result.scan)
  ) {
    refusals.push(R.RESULT_INVALID);
    return null;
  }

  return outcome.result;
}

// The scan carries the records it consumed, so a caller can hand over the
// outcome alone. Passing an independent copy is still allowed — section 8
// proves any copy has to be this scan's own evidence — it just no longer
// has to be passed.
function readPages(input, refusals) {
  const pages = input.pages === undefined ? input.outcome?.pages : input.pages;

  if (!Array.isArray(pages)) {
    refusals.push(R.PAGES_INVALID);
    return null;
  }

  return pages;
}

function readRecovery(recovery, refusals) {
  if (
    !isPlainObject(recovery) ||
    !Array.isArray(recovery.recovered) ||
    !Array.isArray(recovery.unassigned) ||
    !Array.isArray(recovery.unresolved)
  ) {
    refusals.push(R.RECOVERY_INVALID);
    return null;
  }

  return recovery;
}

function readJournal(existingJournal, refusals) {
  if (!Array.isArray(existingJournal) || !existingJournal.every(isPlainObject)) {
    refusals.push(R.EXISTING_JOURNAL_INVALID);
    return null;
  }

  return existingJournal;
}

// ==========================================================
// Scan safety: one failed check and nothing is proposed
// ==========================================================

function checkScan(outcome, result, pages, recovery, refusals) {
  const { scan } = result;

  if (outcome.retry !== false) refusals.push(R.SCAN_RETRY_REQUIRED);
  if (outcome.refusals.length > 0) refusals.push(R.SCAN_REFUSALS_PRESENT);
  if (scan.rejectedPages !== 0) refusals.push(R.REJECTED_PAGES_PRESENT);
  if (scan.snapshotEvidenceIncomplete !== false) {
    refusals.push(R.SNAPSHOT_EVIDENCE_INCOMPLETE);
  }
  if (scan.generationAmbiguous !== false) {
    refusals.push(R.SNAPSHOT_GENERATION_AMBIGUOUS);
  }
  if (scan.snapshotAmbiguous !== false) refusals.push(R.SNAPSHOT_AMBIGUOUS);
  if (typeof scan.liveSnapshotToUtc !== "string" || scan.liveSnapshotToUtc === "") {
    refusals.push(R.SNAPSHOT_TIMESTAMP_MISSING);
  }
  if (scan.coverageComplete !== false) refusals.push(R.COVERAGE_CLAIMED);

  // The summary has to describe the pages in hand, and the records have to
  // be the ones those pages produced: gates passed on one payload and
  // records built from another prove nothing.
  const accepted = pages.filter(
    (record) => isPlainObject(record) && record.accepted === true
  );
  const rejected = pages.filter(
    (record) => !isPlainObject(record) || record.accepted !== true
  );

  if (accepted.length !== scan.acceptedPages || rejected.length !== scan.rejectedPages) {
    refusals.push(R.PAGES_EVIDENCE_MISMATCH);
  }

  // "Nothing was read" and "everything was read and nothing closed" both
  // end with an empty closed list; only the page evidence tells them apart.
  // A scan that accepted no page proved nothing, so it has no proposal to
  // make — and an empty one must never be mistaken for a clean history.
  if (scan.acceptedPages === 0) {
    refusals.push(R.NO_ACCEPTED_PAGE_EVIDENCE);
  }

  // Every gate above was checked against this outcome, so the pages beside
  // it have to be the records this scan handed the reconstruction. Two
  // scans of one account produce pages of the same shape; shape is not
  // provenance.
  const requested = scanIdentityOf(outcome.identity);

  if (!Array.isArray(outcome.pages) || requested === null) {
    refusals.push(R.SCAN_EVIDENCE_MISSING);
    return accepted;
  }

  if (outcome.pages.length !== pages.length) {
    refusals.push(R.PAGES_NOT_SCAN_EVIDENCE);
    return accepted;
  }

  for (let index = 0; index < pages.length; index += 1) {
    // The common case is the caller handing over the array the scan itself
    // returned; only a rewritten or reloaded pair needs the text form.
    if (outcome.pages[index] === pages[index]) continue;

    if (
      canonicalEvidence(outcome.pages[index]) !== canonicalEvidence(pages[index])
    ) {
      refusals.push(R.PAGES_NOT_SCAN_EVIDENCE);
      return accepted;
    }
  }

  // The route answers 200 only after comparing the caller with the bridge
  // (server/routes/mt5.js:940-945), so a page that names an account other
  // than the one this scan queried cannot have come from it.
  for (const record of accepted) {
    const identity = record.page?.identity;

    if (!isPlainObject(identity)) continue;

    const pageLogin = canonicalLogin(identity.mt5Login);
    const pageServer = accountText(identity.mt5Server);

    if (pageLogin.login === undefined || pageServer === null) continue;

    if (pageLogin.login !== requested.login || pageServer !== requested.server) {
      refusals.push(R.SCAN_IDENTITY_MISMATCH);
      return accepted;
    }
  }

  if (
    recovery.recovered.length + recovery.unassigned.length !== result.closed.length ||
    recovery.unresolved.length !== result.unresolved.length
  ) {
    refusals.push(R.RECOVERY_EVIDENCE_MISMATCH);
  }

  return accepted;
}

// ==========================================================
// Account identity: the pages name the account that was queried
// ==========================================================

// Policy 3X-7D-A. The route lowercases the server it forwards
// (server/routes/mt5.js:765) and verifyHistoryPage refuses any page whose
// identity is not that exact text (:937-947), so an accepted page can only ever
// name a server that is already its own trimmed lowercase form. A stored row in
// any other spelling therefore names an identity no page can confirm: it is not
// a case variant to fold away at attribution time, and not a row to repair. The
// raw stored text is compared, so a padded lowercase value fails too — the
// padding is exactly what an accepted page could never reproduce.
function isCanonicalStoredServer(value) {
  if (typeof value !== "string") return true;

  return value === value.trim().toLowerCase();
}

function checkIdentity(account, acceptedPages, refusals) {
  if (!isPlainObject(account)) {
    refusals.push(R.ACCOUNT_INVALID);
    return null;
  }

  const accountId = accountText(account.id);
  const login = canonicalLogin(account.mt5Login);
  const server = accountText(account.mt5Server);

  if (accountId === null) refusals.push(R.MISSING_ACCOUNT_ID);
  if (login.missing) refusals.push(R.MISSING_MT5_LOGIN);
  else if (login.invalid) refusals.push(R.IDENTITY_INVALID);
  if (server === null) refusals.push(R.MISSING_MT5_SERVER);
  else if (!isCanonicalStoredServer(account.mt5Server)) {
    refusals.push(R.IDENTITY_SERVER_NONCANONICAL);
  }

  let brokerAccountId = null;

  if (account.brokerAccountId !== undefined && account.brokerAccountId !== null) {
    const broker = canonicalLogin(account.brokerAccountId);

    if (broker.missing || broker.invalid) refusals.push(R.IDENTITY_INVALID);
    else if (login.login !== undefined && broker.login !== login.login) {
      refusals.push(R.BROKER_ACCOUNT_ID_CONFLICT);
    } else brokerAccountId = broker.login;
  }

  if (refusals.length > 0 || accountId === null || login.login === undefined || server === null) {
    return null;
  }

  for (const record of acceptedPages) {
    const identity = record.page?.identity;

    if (!isPlainObject(identity)) {
      refusals.push(R.IDENTITY_INVALID);
      return null;
    }

    const pageLogin = canonicalLogin(identity.mt5Login);
    const pageServer = identity.mt5Server;

    if (
      pageLogin.login === undefined ||
      typeof pageServer !== "string" ||
      pageServer === ""
    ) {
      refusals.push(R.IDENTITY_INVALID);
      return null;
    }

    if (pageLogin.login !== login.login || pageServer !== server) {
      refusals.push(R.IDENTITY_MISMATCH);
      return null;
    }
  }

  if (acceptedPages.length === 0) {
    refusals.push(R.IDENTITY_INVALID);
    return null;
  }

  return Object.freeze({ accountId, login: login.login, server, brokerAccountId });
}

// ==========================================================
// What the journal already holds
//
// Ids are collected across every account, positions only for this one. The
// journal is a single array and its writer matches on String(id) alone
// (src/context/JournalContext.jsx:398-402), so an id another account holds is
// taken; broker position numbers are per-account broker namespaces, so the same
// number under two accounts names two positions.
// ==========================================================

function indexJournal(existingJournal, accountId) {
  const ids = new Set();
  const foreignIds = new Set();
  const positions = new Set();

  for (const existing of existingJournal) {
    if (existing.id !== undefined && existing.id !== null) {
      if (accountText(existing.accountId) === accountId) {
        ids.add(String(existing.id));
      } else {
        foreignIds.add(String(existing.id));
      }
    }

    if (accountText(existing.accountId) !== accountId) continue;

    const positionId = digitText(existing.brokerPositionId);

    if (positionId === null) continue;

    // Another broker's position numbers live in a different space, so they
    // must not silence a recovery for this one.
    if (existing.broker !== undefined && existing.broker !== null && existing.broker !== "MT5") {
      continue;
    }

    positions.add(positionId);
  }

  return { ids, foreignIds, positions };
}

// ==========================================================
// Deal-row evidence index over the accepted pages in hand
//
// The record's own fields are claims, not evidence. Every amount, the
// volume and the lifecycle instants are re-derived here from the rows the
// bridge reported, using the same ticket-keyed rules the mapper uses
// (src/lib/mt5HistoryRecoveryJournal.js:71-109): one deal per ticket,
// identical duplicates once, and a ticket two pages disagree about can
// support nothing at all.
// ==========================================================

// validate_history_deal's reported fields (mt5-bridge/app.py:6251-6269),
// compared positionally so two pages describing one ticket can be
// checked exactly.
const DEAL_EVIDENCE_FIELDS = Object.freeze([
  "ticket",
  "order",
  "position_id",
  "symbol",
  "type",
  "entry",
  "volume",
  "price",
  "profit",
  "commission",
  "swap",
  "fee",
  "time",
  "time_msc",
  "comment",
  "magic",
]);

function dealSignature(row) {
  return JSON.stringify(DEAL_EVIDENCE_FIELDS.map((field) => row[field]));
}

function buildDealIndex(acceptedPages) {
  const rows = new Map();
  const conflicts = new Set();

  for (const record of acceptedPages) {
    const history = record.page?.history;

    if (!Array.isArray(history)) continue;

    for (const row of history) {
      if (!isPlainObject(row)) continue;

      const { ticket } = row;

      if (typeof ticket !== "string" || !DIGITS_ONLY.test(ticket) || ticket === "0") {
        continue;
      }

      const signature = dealSignature(row);
      const previous = rows.get(ticket);

      if (previous === undefined) {
        rows.set(ticket, { signature, row });
        continue;
      }

      if (previous.signature === signature) continue;

      conflicts.add(ticket);
      rows.delete(ticket);
    }
  }

  return { rows, conflicts };
}

// ==========================================================
// One mapped record
// ==========================================================

// Evidence that cannot be tied back to the scan blocks the whole run: the
// payload handed to the adapter is not the one the gates were checked on.
// A record that is merely incomplete is refused on its own.
function adaptRecord(record, candidate, scan, identity, deals) {
  if (!isPlainObject(record)) {
    return { refuse: R.UNKNOWN_POSITION_EVIDENCE };
  }

  const positionId = record.positionId;

  if (!isTicketText(positionId)) {
    return { reject: entry(R.MISSING_POSITION_ID) };
  }

  const dealTickets = ticketTrail(record.dealTickets);
  const openingTickets = ticketTrail(record.openingTickets);
  const closingTickets = ticketTrail(record.closingTickets);

  if (dealTickets === null || openingTickets === null || closingTickets === null) {
    return { reject: entry(R.TICKET_EVIDENCE_MISSING, { positionId }) };
  }

  if (candidate === null) {
    return { refuse: R.UNKNOWN_POSITION_EVIDENCE, positionId };
  }

  if (
    !sameTickets(dealTickets, candidate.dealTickets) ||
    !sameTickets(openingTickets, candidate.openingTickets) ||
    !sameTickets(closingTickets, candidate.closingTickets)
  ) {
    return { refuse: R.TICKET_EVIDENCE_MISMATCH, positionId };
  }

  if (record.liveSnapshotToUtc !== scan.liveSnapshotToUtc) {
    return {
      refuse: R.CANDIDATE_SNAPSHOT_MISMATCH,
      positionId,
      details: {
        liveSnapshotToUtc: record.liveSnapshotToUtc ?? null,
        scanSnapshotToUtc: scan.liveSnapshotToUtc,
      },
    };
  }

  if (typeof record.symbol !== "string" || record.symbol === "") {
    return { reject: entry(R.MISSING_SYMBOL, { positionId }) };
  }

  if (!SIDES.has(record.side)) {
    return { reject: entry(R.SIDE_INVALID, { positionId, side: record.side ?? null }) };
  }

  if (!isTimestamp(record.openedAtMsc) || !isTimestamp(record.closedAtMsc)) {
    return { reject: entry(R.LIFECYCLE_TIME_ORDER_INVALID, { positionId }) };
  }

  if (record.closedAtMsc < record.openedAtMsc) {
    return {
      reject: entry(R.LIFECYCLE_TIME_ORDER_INVALID, {
        positionId,
        openedAtMsc: record.openedAtMsc,
        closedAtMsc: record.closedAtMsc,
      }),
    };
  }

  if (
    typeof record.volume !== "string" ||
    !DECIMAL_TEXT.test(record.volume) ||
    record.volume.startsWith("-") ||
    isZeroDecimal(record.volume)
  ) {
    return { reject: entry(R.VOLUME_INVALID, { positionId, volume: record.volume ?? null }) };
  }

  for (const field of MONEY_FIELDS) {
    const value = record[field];

    if (typeof value !== "string" || !DECIMAL_TEXT.test(value)) {
      return {
        reject: entry(R.RECOVERY_COMPONENTS_INVALID, {
          positionId,
          field,
          value: value ?? null,
        }),
      };
    }
  }

  const total = record.reconstructedNetPnl;

  if (typeof total !== "string" || !DECIMAL_TEXT.test(total)) {
    return { reject: entry(R.RECOVERY_TOTAL_INVALID, { positionId, total: total ?? null }) };
  }

  // Checked, never re-derived: the published amount stays the broker's own
  // text, so a total the components do not support is refused instead of
  // corrected, and no float is ever introduced.
  if (sumDecimalTexts(MONEY_FIELDS.map((field) => record[field])).total !== total) {
    return {
      reject: entry(R.RECOVERY_TOTAL_COMPONENTS_MISMATCH, {
        positionId,
        total,
        components: componentsOf(record),
      }),
    };
  }

  // ==========================================================
  // Evidence binding
  //
  // Nothing above proves the record came from this scan's candidate or
  // from the rows these pages reported — only that it is well formed and
  // internally consistent. Each field is therefore compared against the
  // evidence, and a record that disagrees is refused outright; candidate
  // values are never copied over a mismatch to repair it.
  // ==========================================================

  if (record.symbol !== candidate.symbol) {
    return { refuse: R.CANDIDATE_SYMBOL_MISMATCH, positionId };
  }

  if (record.side !== candidate.side) {
    return { refuse: R.CANDIDATE_SIDE_MISMATCH, positionId };
  }

  if (
    record.openedAtMsc !== candidate.openedAtMsc ||
    record.closedAtMsc !== candidate.closedAtMsc
  ) {
    return { refuse: R.CANDIDATE_LIFECYCLE_MISMATCH, positionId };
  }

  if (record.liveSnapshotToUtc !== candidate.liveSnapshotToUtc) {
    return { refuse: R.CANDIDATE_SNAPSHOT_MISMATCH, positionId };
  }

  if (candidate.dealCount !== dealTickets.length) {
    return { refuse: R.CANDIDATE_DEAL_COUNT_MISMATCH, positionId };
  }

  if (dealTickets.some((ticket) => deals.conflicts.has(ticket))) {
    return { refuse: R.DEAL_ROW_CONFLICT, positionId };
  }

  const rows = dealTickets.map((ticket) => deals.rows.get(ticket)?.row);

  if (rows.some((row) => row === undefined)) {
    return { refuse: R.DEAL_ROW_MISSING, positionId };
  }

  // The rows carry the position they belong to, so a candidate renamed
  // onto another position's deals cannot pair with them.
  if (rows.some((row) => row.position_id !== positionId)) {
    return { refuse: R.DEAL_ROW_POSITION_MISMATCH, positionId };
  }

  const money = sumDealMoney(rows, MONEY_FIELDS);

  if (!money.ok) {
    return { refuse: R.DEAL_ROW_MALFORMED, positionId };
  }

  // The broker's text has to match digit for digit. A reported total that
  // differs on its own cannot survive the internal sum above once every
  // component agrees with the rows, so that last comparison is redundant
  // defence in depth rather than a separate finding — no test can reach it
  // without also breaking a component.
  const reported = [
    ...MONEY_FIELDS.map((field) => [field, money.components[field]]),
    ["reconstructedNetPnl", money.total],
  ];

  for (const [field, evidenceValue] of reported) {
    if (record[field] !== evidenceValue) {
      return { refuse: R.DEAL_MONEY_EVIDENCE_MISMATCH, positionId };
    }
  }

  const openingRows = openingTickets.map((ticket) => deals.rows.get(ticket)?.row);

  if (openingRows.some((row) => row === undefined)) {
    return { refuse: R.DEAL_ROW_MISSING, positionId };
  }

  const tradedVolume = sumDecimalTexts(openingRows.map((row) => row.volume));

  if (!tradedVolume.ok) {
    return { refuse: R.DEAL_ROW_MALFORMED, positionId };
  }

  if (record.volume !== tradedVolume.total) {
    return { refuse: R.DEAL_VOLUME_MISMATCH, positionId };
  }

  // ==========================================================
  // Lifecycle evidence
  //
  // The candidate's two instants, its symbol and its side are not facts
  // the scan was handed; they are conclusions the reconstruction drew from
  // these very rows. It sorts each position's deals by (time_msc, ticket)
  // (mt5HistoryReconstruction.js:528 with compareDeals :242-246), opens at
  // the first deal (:748, :850), closes at the last closing deal (:851),
  // names the side for that deal's type (:775, :849) and takes the symbol
  // from the group's rows (:467-469, :848). The trails matched above index
  // for index, so the row behind each named ticket is the row the
  // conclusion came from: equality is the honest test, and a row that
  // reports otherwise means the payload in hand is not the one the gates
  // were checked on. Nothing here repairs a conclusion toward its rows or
  // the other way round.
  // ==========================================================

  for (const row of rows) {
    if (row.symbol !== candidate.symbol) {
      return { refuse: R.DEAL_ROW_SYMBOL_MISMATCH, positionId };
    }
  }

  const opening = rows[0];

  if (opening.time_msc !== candidate.openedAtMsc) {
    return { refuse: R.DEAL_OPEN_TIME_MISMATCH, positionId };
  }

  if (opening.entry !== DEAL_ENTRY_IN) {
    return { refuse: R.DEAL_OPEN_ENTRY_MISMATCH, positionId };
  }

  if (sideOfDealType(opening.type) !== candidate.side) {
    return { refuse: R.DEAL_OPEN_TYPE_MISMATCH, positionId };
  }

  const closingRows = closingTickets.map((ticket) => deals.rows.get(ticket)?.row);

  if (closingRows.some((row) => row === undefined)) {
    return { refuse: R.DEAL_ROW_MISSING, positionId };
  }

  if (closingRows[closingRows.length - 1].time_msc !== candidate.closedAtMsc) {
    return { refuse: R.DEAL_CLOSE_TIME_MISMATCH, positionId };
  }

  const { accountId, login, server, brokerAccountId } = identity;

  return {
    record: Object.freeze({
      id: `mt5-position-${login}-${positionId}`,
      accountId,
      mt5Login: login,
      mt5Server: server,
      ...(brokerAccountId === null ? null : { brokerAccountId }),
      broker: "MT5",
      source: "history-recovery",
      status: "CLOSED",
      positionId,
      brokerPositionId: positionId,
      symbol: record.symbol,
      side: record.side,
      volume: record.volume,
      openedAt: record.openedAtMsc,
      closedAt: record.closedAtMsc,
      openedAtMsc: record.openedAtMsc,
      closedAtMsc: record.closedAtMsc,
      pnl: total,
      netProfit: total,
      netPnL: total,
      realizedPnL: total,
      reconstructedNetPnl: total,
      pnlBasis: "reconstructed-broker-reported-total",
      recoveryComponents: componentsOf(record),
      dealTickets: Object.freeze([...dealTickets]),
      openingTickets: Object.freeze([...openingTickets]),
      closingTickets: Object.freeze([...closingTickets]),
      liveSnapshotToUtc: record.liveSnapshotToUtc,
      coverageComplete: false,
      dataGaps: RECOVERY_DATA_GAPS,
    }),
  };
}

// ==========================================================
// Public entry point
// ==========================================================

export function adaptRecoveryJournalRecords(input = {}) {
  const refusals = [];

  const result = readOutcome(input.outcome, refusals);
  const pages = readPages(input, refusals);
  const journal = readJournal(input.existingJournal, refusals);

  // Both producers beside this module are pure functions of the same inputs
  // it already holds: reconstructClosedPositions reads only the page records
  // it is given (mt5HistoryReconstruction.js:866-945 — no clock, no
  // randomness, no I/O or globals, every sort key derived from the input,
  // result frozen before it returns), and buildRecoveryJournalRecords reads
  // only its { result, pages } argument. So the scan outcome alone is enough
  // evidence to work from, and running either one again here cannot invent a
  // conclusion the original run could not have reached.
  const recovery =
    input.recovery === undefined
      ? result !== null && pages !== null
        ? buildRecoveryJournalRecords({ result, pages })
        : null
      : readRecovery(input.recovery, refusals);

  if (result === null || recovery === null || journal === null || pages === null) {
    return blocked(refusals);
  }

  const acceptedPages = checkScan(input.outcome, result, pages, recovery, refusals);
  const identity = checkIdentity(input.account, acceptedPages, refusals);

  if (refusals.length > 0 || identity === null) {
    return blocked(refusals);
  }

  const candidates = new Map();

  for (const candidate of result.closed) {
    if (!candidates.has(candidate.positionId)) {
      candidates.set(candidate.positionId, candidate);
    }
  }

  const deals = buildDealIndex(acceptedPages);

  // What this evidence produces, computed independently of the caller's copy.
  // RECOVERY_EVIDENCE_MISMATCH can only compare counts, and every binding
  // below checks a record against its candidate and its rows — neither proves
  // the *list* is this scan's recovery, because a payload of the right size
  // can carry the wrong positions, or the right positions with conclusions
  // these pages never drew. Re-deriving it is the only way to say so.
  const derived = buildRecoveryJournalRecords({ result, pages: acceptedPages });
  const produced = new Map();

  for (const record of derived.recovered) {
    if (!produced.has(record.positionId)) {
      produced.set(record.positionId, record);
    }
  }

  const seen = indexJournal(journal, identity.accountId);
  const matched = new Set();
  const records = [];
  const skipped = [];
  const rejected = [];

  for (const unresolvedEntry of recovery.unresolved) {
    rejected.push(
      entry(R.POSITION_UNRESOLVED, {
        positionId: unresolvedEntry?.positionId ?? null,
        evidenceReason: unresolvedEntry?.reason ?? null,
      })
    );
  }

  for (const unassigned of recovery.unassigned) {
    rejected.push(
      entry(R.DEAL_EVIDENCE_REFUSED, {
        positionId: unassigned?.positionId ?? null,
        evidenceReason: unassigned?.reason ?? null,
      })
    );
  }

  for (const mapped of recovery.recovered) {
    const candidate =
      isPlainObject(mapped) && candidates.has(mapped.positionId)
        ? candidates.get(mapped.positionId)
        : null;

    const outcome = adaptRecord(mapped, candidate, result.scan, identity, deals);

    if (outcome.refuse) {
      refusals.push(outcome.refuse);
      continue;
    }

    if (outcome.reject) {
      rejected.push(outcome.reject);
      continue;
    }

    const proposed = outcome.record;

    // Every check above compares this record against evidence it quotes;
    // none of them can see a conclusion the journal never reads, such as the
    // net volume the reconstruction derived, or tell one position's record
    // from another's. This does: the record has to be exactly what this scan's
    // own evidence derives, and only once.
    const producedByEvidence = produced.get(mapped.positionId);

    if (
      producedByEvidence === undefined ||
      matched.has(mapped.positionId) ||
      canonicalEvidence(producedByEvidence) !== canonicalEvidence(mapped)
    ) {
      refusals.push(R.RECOVERY_NOT_SCAN_EVIDENCE);
      continue;
    }

    matched.add(mapped.positionId);

    if (seen.ids.has(proposed.id)) {
      skipped.push(
        entry(R.ALREADY_JOURNALED_ID, {
          id: proposed.id,
          positionId: proposed.positionId,
          accountId: proposed.accountId,
        })
      );
      continue;
    }

    // Policy 3X-7D-B. The id is taken somewhere else in the same array, so
    // this stage says what the commit planner will refuse for it rather than
    // proposing a record no writer may append.
    if (seen.foreignIds.has(proposed.id)) {
      skipped.push(
        entry(R.ALREADY_JOURNALED_ID_ELSEWHERE, {
          id: proposed.id,
          positionId: proposed.positionId,
          accountId: proposed.accountId,
        })
      );
      continue;
    }

    if (seen.positions.has(proposed.positionId)) {
      skipped.push(
        entry(R.ALREADY_JOURNALED_POSITION, {
          id: proposed.id,
          positionId: proposed.positionId,
          accountId: proposed.accountId,
        })
      );
      continue;
    }

    records.push(proposed);
  }

  // Nothing was refused so far, so the payload in hand still has to be the
  // one these pages produced. The candidates are what the reconstruction
  // proves from the deal rows; the lists for positions it could not publish
  // are what the mapper derives from those candidates. Either one differing
  // means the gates above were checked on a different scan than the records
  // now propose.
  if (refusals.length === 0) {
    if (
      canonicalEvidence(reconstructClosedPositions(pages)) !==
      canonicalEvidence(result)
    ) {
      refusals.push(R.RESULT_NOT_SCAN_EVIDENCE);
    } else if (
      canonicalEvidence(derived.unassigned) !==
        canonicalEvidence(recovery.unassigned) ||
      canonicalEvidence(derived.unresolved) !== canonicalEvidence(recovery.unresolved)
    ) {
      refusals.push(R.RECOVERY_NOT_SCAN_EVIDENCE);
    }
  }

  if (refusals.length > 0) return blocked(refusals);

  return Object.freeze({
    status: RECOVERY_ADAPTER_STATUS.PROPOSED,
    refusals: Object.freeze([]),
    records: Object.freeze(records),
    skipped: Object.freeze(skipped),
    rejected: Object.freeze(rejected),
    remaining: Object.freeze({
      unresolvedCount: recovery.unresolved.length,
      unassignedCount: recovery.unassigned.length,
      refusedCount: rejected.length,
    }),
  });
}
