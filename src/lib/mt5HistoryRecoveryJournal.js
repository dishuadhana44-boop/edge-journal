import {
  DEAL_MONEY_FIELDS,
  sumDealMoney,
  sumDecimalTexts,
} from "./mt5DealAmounts.js";

// ==========================================================
// Closed position -> recovered broker record
//
// The reconstruction module deliberately proves *which* deals formed a
// finished position and says nothing about money
// (src/lib/mt5HistoryReconstruction.js:845-859). This module joins a
// candidate's deal tickets back to the validated rows of the accepted
// pages that produced it, so the reported amounts come from the broker's
// own deal history and nowhere else.
//
// Every unresolved piece of evidence is returned as an explicit
// unassigned record. A position with missing, contradictory or
// unreadable amounts never becomes a trade, so recovery cannot publish a
// number the broker did not report.
// ==========================================================

// validate_history_deal's reported fields (mt5-bridge/app.py:6251-6269),
// kept in one order so two pages describing the same ticket can be
// compared exactly.
const DEAL_EVIDENCE_FIELDS = [
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
];

const DIGITS_ONLY = /^[0-9]+$/;

export const RECOVERY_JOURNAL_REASONS = Object.freeze({
  CANDIDATE_TICKETS_INVALID: "CANDIDATE_DEAL_TICKETS_INVALID",
  MISSING_DEAL_TICKETS: "MISSING_DEAL_TICKETS",
  CONFLICTING_DEAL_TICKETS: "CONFLICTING_DEAL_TICKETS",
  DEAL_MONEY_INVALID: "DEAL_MONEY_INVALID",
  OPENING_VOLUME_INVALID: "OPENING_VOLUME_INVALID",
});

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function dealSignature(row) {
  return JSON.stringify(DEAL_EVIDENCE_FIELDS.map((field) => row[field]));
}

// ==========================================================
// Ticket index over accepted pages only
// ==========================================================

function buildTicketIndex(pages) {
  const rows = new Map();
  const conflicts = new Set();

  for (const record of pages) {
    if (!isPlainObject(record) || record.accepted !== true) continue;

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

      // The same ticket reported identically is one deal, not two.
      if (previous.signature === signature) continue;

      // Reported differently, neither version can support a total.
      conflicts.add(ticket);
      rows.delete(ticket);
    }
  }

  return { rows, conflicts };
}

// ==========================================================
// One candidate
// ==========================================================

function unassigned(candidate, reason, details = {}) {
  return Object.freeze({
    positionId:
      isPlainObject(candidate) ? candidate.positionId ?? null : null,
    dealTickets:
      isPlainObject(candidate) && Array.isArray(candidate.dealTickets)
        ? Object.freeze([...candidate.dealTickets])
        : Object.freeze([]),
    reason,
    ...details,
  });
}

function ticketsOf(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

function assignCandidate(candidate, index) {
  if (!isPlainObject(candidate)) {
    return { unassigned: unassigned(candidate, RECOVERY_JOURNAL_REASONS.CANDIDATE_TICKETS_INVALID) };
  }

  const dealTickets = ticketsOf(candidate.dealTickets);
  const openingTickets = ticketsOf(candidate.openingTickets);

  if (dealTickets === null || openingTickets === null) {
    return {
      unassigned: unassigned(
        candidate,
        RECOVERY_JOURNAL_REASONS.CANDIDATE_TICKETS_INVALID
      ),
    };
  }

  const conflicting = dealTickets.filter((ticket) => index.conflicts.has(ticket));

  if (conflicting.length > 0) {
    return {
      unassigned: unassigned(
        candidate,
        RECOVERY_JOURNAL_REASONS.CONFLICTING_DEAL_TICKETS,
        { conflictingTickets: Object.freeze(conflicting) }
      ),
    };
  }

  const missing = dealTickets.filter((ticket) => !index.rows.has(ticket));

  if (missing.length > 0) {
    return {
      unassigned: unassigned(
        candidate,
        RECOVERY_JOURNAL_REASONS.MISSING_DEAL_TICKETS,
        { missingTickets: Object.freeze(missing) }
      ),
    };
  }

  const deals = dealTickets.map((ticket) => index.rows.get(ticket).row);
  const money = sumDealMoney(deals, DEAL_MONEY_FIELDS);

  if (!money.ok) {
    return {
      unassigned: unassigned(
        candidate,
        RECOVERY_JOURNAL_REASONS.DEAL_MONEY_INVALID,
        { evidenceReason: money.reason, field: money.field ?? null }
      ),
    };
  }

  const openingMissing = openingTickets.filter((ticket) => !index.rows.has(ticket));

  if (openingMissing.length > 0) {
    return {
      unassigned: unassigned(
        candidate,
        RECOVERY_JOURNAL_REASONS.MISSING_DEAL_TICKETS,
        { missingTickets: Object.freeze(openingMissing) }
      ),
    };
  }

  // netVolume proves the position is flat; the lots actually traded are
  // what the opening deals added up to.
  const volume = sumDecimalTexts(
    openingTickets.map((ticket) => index.rows.get(ticket).row.volume)
  );

  if (!volume.ok) {
    return {
      unassigned: unassigned(
        candidate,
        RECOVERY_JOURNAL_REASONS.OPENING_VOLUME_INVALID,
        { evidenceReason: volume.reason, field: "volume" }
      ),
    };
  }

  const record = {
    ...candidate,
    id: `mt5-position-${candidate.positionId}`,
    broker: "MT5",
    source: "history-recovery",
    volume: volume.total,
    profit: money.components.profit,
    commission: money.components.commission,
    swap: money.components.swap,
    fee: money.components.fee,
    reconstructedNetPnl: money.total,
    riskReward: null,
    stopLoss: null,
    coverageComplete: false,
  };

  return { record: Object.freeze(record) };
}

// ==========================================================
// Public entry point
// ==========================================================

export function buildRecoveryJournalRecords({ result, pages } = {}) {
  if (!isPlainObject(result) || !Array.isArray(result.closed)) {
    throw new TypeError(
      "buildRecoveryJournalRecords expects a reconstruction result with a closed list"
    );
  }

  if (!Array.isArray(pages)) {
    throw new TypeError(
      "buildRecoveryJournalRecords expects an array of page records"
    );
  }

  const index = buildTicketIndex(pages);
  const recovered = [];
  const unassigned = [];

  for (const candidate of result.closed) {
    const outcome = assignCandidate(candidate, index);

    if (outcome.record) {
      recovered.push(outcome.record);
      continue;
    }

    unassigned.push(outcome.unassigned);
  }

  return Object.freeze({
    recovered: Object.freeze(recovered),
    unassigned: Object.freeze(unassigned),
    // Phase 1 conclusions travel on unchanged: this module adds no
    // closed position and removes none.
    unresolved: result.unresolved,
  });
}
