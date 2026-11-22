// ==========================================================
// MT5 HISTORY RECONSTRUCTION — Stage D Phase 1 (pure)
// ==========================================================
//
// Turns already-validated `/api/mt5/history` pages into a
// deterministic picture of which MT5 positions can be PROVEN closed
// and which must stay unresolved.
//
// This module is pure: no React state, no storage, no fetch, no
// timers, no process access, no MT5 import. It writes nothing
// anywhere, including the retry hints it returns.
//
// INPUT
//   pages: Array<{ accepted: boolean, page: object | null }>
//   `page` is the success body of server/routes/mt5.js GET /history:
//   the verified page, whose `history` rows come from
//   mt5-bridge/app.py validate_history_deal (:6251-6269) and whose
//   `positions` rows come from validate_live_position (:6309-6317).
//
//   `accepted` is the caller's verdict. Attestations (success,
//   page_query_complete, source_scan_complete, identity echo,
//   count/coverage) are NOT re-checked here — that is the Express
//   route's job. Only the structural fields this module reads are
//   checked, and a page that fails them is discarded whole.
//
// OUTPUT
//   {
//     closed:     [Candidate],     // proven lifecycles, safe to journal
//     unresolved: [Unresolved],    // explicit reasons, never guessed
//     financialDeals: [{ ticket, type, timeMsc }],  // evidence only
//     scan: {
//       acceptedPages, rejectedPages, dealRows, duplicateDealRows,
//       conflictingFinancialRows, generationAmbiguous,
//       snapshotAmbiguous, liveSnapshotToUtc, rejectedSnapshotToUtc,
//       snapshotEvidenceIncomplete, coverageComplete: false
//     }
//   }
//
// ASSUMPTIONS AND LIMITS (all deliberate)
//   1. Grouping is by `position_id`, never by deal ticket. A ticket
//      identifies one deal; a position has many.
//   2. A position is CLOSED only when its first deal is the only IN in the
//      group, every remaining deal classifies against that opener, the
//      signed volume nets to exactly zero in decimal arithmetic, at least
//      one deal reduces it, and its position_id is absent from the
//      live-position snapshot of the newest accepted page — with no
//      rejected page cast over that instant (see 14).
//   3. Volume is signed by lifecycle role, not by direction alone: an OUT
//      must oppose the opener, an INOUT may add or reduce, and any other
//      combination (a second IN, an OUT in the opener's own direction) is
//      UNCLASSIFIABLE_DEAL_ENTRY.
//   4. Two or more deals at the earliest instant leave the opener, the side
//      and the opening time unprovable, because ticket order is not evidence
//      of what happened first: AMBIGUOUS_OPENING_TIME. Ties later in the
//      lifecycle are harmless, since the net does not depend on order.
//   5. An INOUT deal can never be proven to be an opener here: nothing
//      in the supplied evidence describes the position's state before
//      the first deal. INOUT after a proven IN is normal and accepted.
//   6. CLOSE_BY (entry 3) is always unresolved. The bridge row carries
//      ticket, order, position_id, symbol, type, entry, volume, price,
//      profit, commission, swap, fee, time, time_msc, comment, magic,
//      raw — no reference to the counterpart position — so the
//      counterpart can never be reconciled from this payload.
//   7. Volumes must be positive, as the bridge requires (app.py:6216-6219
//      for trade deals, :6304-6307 for live positions): a zero-volume trade
//      row is MALFORMED_DEAL_ROW and a zero-volume live row drops the page.
//   8. Live identity is enforced, not assumed: a live row must carry the
//      keys validate_live_position emits and satisfy
//      position_id === identifier (app.py:6309-6317), otherwise the page is
//      dropped whole and its snapshot proves nothing.
//      [unverified for netting vs hedging accounts]
//   9. Cross-page continuation is NOT assumed: the bridge validates a
//      continuation token only inside the request that carries it
//      (app.py:6431-6439), so `coverageComplete` is hard-coded false
//      and a scan is never reported complete here.
//   10. Accepted pages spanning more than one bridge_boot_id /
//      connection_generation cannot be ordered, so every closure claim
//      across them is demoted to unresolved.
//   11. Pages that share the newest `to_utc` instant but disagree about a
//      position_id make that position's liveness unknowable, so it is
//      reported as AMBIGUOUS_LIVE_SNAPSHOT rather than as open, closed or
//      contradicted.
//   12. Deal timestamps are not re-checked against a page window; the
//      bridge refuses out-of-window deals (app.py:6235-6238).
//   13. No money aggregation in this phase: P&L belongs to Phase 2 and
//      is deliberately absent from every returned record.
//   14. A rejected page is never proof of absence. Closure needs the
//      position to be provably NOT live, and a dropped page was dropped
//      precisely because its live set cannot be trusted; because pages are
//      atomic (assumption 8) an untrustworthy page casts doubt on every
//      position_id at its instant, so there is no per-id carve-out. When a
//      dropped page's `utc_range.to_utc` is at or after the newest accepted
//      snapshot, or when its instant cannot be read at all, candidates that
//      rest on absence are demoted to LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE
//      (retryable) instead of being emitted as CLOSED. Express refusals
//      carry no range (server/routes/mt5.js historyRefusal :529-541), so a
//      caller-reported rejection always makes coverage unknowable until the
//      caller refetches that window.
// ==========================================================

const DEAL_TYPE_BUY = 0;

const DEAL_ENTRY_IN = 0;
const DEAL_ENTRY_OUT = 1;
const DEAL_ENTRY_INOUT = 2;
const DEAL_ENTRY_CLOSE_BY = 3;

// validate_history_deal reads entry with history_small_int(maximum=3).
const DEAL_ENTRY_MAXIMUM = DEAL_ENTRY_CLOSE_BY;

const TRADE_DEAL_TYPES = new Set([DEAL_TYPE_BUY, 1]);
const FINANCIAL_DEAL_TYPES = new Set([2, 3, 4, 5]);

const DEAL_FIELDS = [
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

// validate_live_position returns these keys besides `raw`
// (app.py:6309-6317), and its `position_id` is that serializer's copy of
// `identifier`. A row that does not carry all of them, or where the two
// identities disagree, is not that shape, so its snapshot cannot decide
// liveness and the whole page is dropped.
const LIVE_FIELDS = [
  "ticket",
  "position_id",
  "identifier",
  "symbol",
  "type",
  "volume",
];

const DIGITS_ONLY = /^[0-9]+$/;
const DECIMAL_TEXT = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const UTC_INSTANT =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{3})?Z$/;

export const RECONSTRUCTION_REASONS = Object.freeze({
  OPENING_DEAL_MISSING: "OPENING_DEAL_MISSING",
  INOUT_OPENER_UNPROVEN: "INOUT_OPENER_UNPROVEN",
  INCOMPLETE_CLOSE_BY_EVIDENCE: "INCOMPLETE_CLOSE_BY_EVIDENCE",
  VOLUME_NOT_FLAT: "VOLUME_NOT_FLAT",
  VOLUME_NET_NEGATIVE: "VOLUME_NET_NEGATIVE",
  STILL_OPEN: "STILL_OPEN",
  LIFECYCLE_CONTRADICTS_SNAPSHOT: "LIFECYCLE_CONTRADICTS_SNAPSHOT",
  AMBIGUOUS_OPENING_TIME: "AMBIGUOUS_OPENING_TIME",
  UNCLASSIFIABLE_DEAL_ENTRY: "UNCLASSIFIABLE_DEAL_ENTRY",
  CONFLICTING_DUPLICATE_DEALS: "CONFLICTING_DUPLICATE_DEALS",
  UNKNOWN_DEAL_ENTRY: "UNKNOWN_DEAL_ENTRY",
  MALFORMED_DEAL_ROW: "MALFORMED_DEAL_ROW",
  AMBIGUOUS_LIVE_SNAPSHOT: "AMBIGUOUS_LIVE_SNAPSHOT",
  GENERATION_AMBIGUOUS_SNAPSHOT: "GENERATION_AMBIGUOUS_SNAPSHOT",
  LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE: "LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE",
});

// Only evidence-integrity reasons can co-occur on one position: the
// lifecycle and snapshot gates are consulted one at a time in the fixed
// order written in evaluateGroup. This ranks the integrity reasons.
const REASON_PRIORITY = [
  RECONSTRUCTION_REASONS.MALFORMED_DEAL_ROW,
  RECONSTRUCTION_REASONS.CONFLICTING_DUPLICATE_DEALS,
  RECONSTRUCTION_REASONS.UNKNOWN_DEAL_ENTRY,
];

// Reasons that a wider or later scan could plausibly resolve.
const RETRYABLE_REASONS = new Set([
  RECONSTRUCTION_REASONS.OPENING_DEAL_MISSING,
  RECONSTRUCTION_REASONS.INOUT_OPENER_UNPROVEN,
  RECONSTRUCTION_REASONS.VOLUME_NOT_FLAT,
  RECONSTRUCTION_REASONS.VOLUME_NET_NEGATIVE,
  RECONSTRUCTION_REASONS.INCOMPLETE_CLOSE_BY_EVIDENCE,
  RECONSTRUCTION_REASONS.AMBIGUOUS_LIVE_SNAPSHOT,
  RECONSTRUCTION_REASONS.GENERATION_AMBIGUOUS_SNAPSHOT,
  // Refetching the window a rejected page covered can restore a
  // trustworthy live snapshot, so a suppressed closure is worth retrying.
  RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE,
]);

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

function hasFields(row, fields) {
  for (const field of fields) {
    if (!Object.hasOwn(row, field)) return false;
  }

  return true;
}

function isDigitText(value) {
  return typeof value === "string" && DIGITS_ONLY.test(value);
}

function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// The bridge refuses a trade deal or a live position whose volume is not
// positive (app.py:6216-6219, :6304-6307), so "0", "0.0" and "0.000" are
// malformed here too. Text is already known to match DECIMAL_TEXT.
function isZeroDecimal(text) {
  return text.replace(".", "").replace(/0+$/, "") === "";
}

function isPositiveDecimalText(value) {
  return (
    typeof value === "string" &&
    DECIMAL_TEXT.test(value) &&
    !isZeroDecimal(value)
  );
}

// Broker identifiers are digit strings that can exceed Number safety,
// so they are compared as length-then-lexicographic text.
function compareIdentifierText(a, b) {
  if (a === b) return 0;
  if (a.length !== b.length) return a.length - b.length;

  return a < b ? -1 : 1;
}

function compareDeals(a, b) {
  if (a.time_msc !== b.time_msc) return a.time_msc - b.time_msc;

  return compareIdentifierText(a.ticket, b.ticket);
}

// Only UTC math: no clock, no timezone, no local Date getters.
function instantToMsc(text) {
  if (typeof text !== "string") return null;

  const parts = UTC_INSTANT.exec(text);

  if (parts === null) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const ms = Number(parts[8] ?? "0");

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const epoch = Date.UTC(year, month - 1, day, hour, minute, second, ms);

  if (!Number.isFinite(epoch)) return null;

  // Rejects impossible dates Date.UTC would silently roll over.
  if (new Date(epoch).toISOString().slice(0, 10) !== parts.slice(1, 4).join("-")) {
    return null;
  }

  return epoch;
}

function dealSignature(row) {
  return JSON.stringify(DEAL_FIELDS.map((field) => row[field]));
}

function decimalPlaces(text) {
  const dot = text.indexOf(".");

  return dot === -1 ? 0 : text.length - dot - 1;
}

function decimalToScaled(text, places) {
  const dot = text.indexOf(".");
  const whole = dot === -1 ? text : text.slice(0, dot);
  const fraction = dot === -1 ? "" : text.slice(dot + 1);

  return BigInt(whole + fraction.padEnd(places, "0").slice(0, places));
}

function formatScaled(value, places) {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;

  let text = magnitude.toString().padStart(places + 1, "0");

  if (places > 0) {
    text = `${text.slice(0, -places)}.${text.slice(-places)}`.replace(
      /\.?0+$/,
      ""
    );
  }

  if (text === "") text = "0";

  return negative && text !== "0" ? `-${text}` : text;
}

// ==========================================================
// Page extraction — a page is accepted whole or dropped whole
// ==========================================================

function extractPage(body) {
  if (
    !isPlainObject(body) ||
    !Array.isArray(body.history) ||
    !Array.isArray(body.positions) ||
    !isPlainObject(body.utc_range) ||
    !isPlainObject(body.identity)
  ) {
    return null;
  }

  const toUtc = body.utc_range.to_utc;
  const toMsc = instantToMsc(toUtc);

  if (
    toMsc === null ||
    typeof body.bridge_boot_id !== "string" ||
    !isNonNegativeInteger(body.connection_generation)
  ) {
    return null;
  }

  const deals = [];
  const financial = [];

  for (const row of body.history) {
    if (!isPlainObject(row) || !hasFields(row, DEAL_FIELDS)) return null;

    const { type } = row;

    if (typeof type !== "number" || !Number.isInteger(type)) return null;

    if (FINANCIAL_DEAL_TYPES.has(type)) {
      financial.push(row);
      continue;
    }

    if (!TRADE_DEAL_TYPES.has(type)) return null;

    // A trade deal that does not name a position cannot be grouped,
    // so nothing from this page can be trusted.
    if (!isDigitText(row.position_id) || row.position_id === "0") return null;

    deals.push(row);
  }

  const liveIds = [];

  for (const row of body.positions) {
    if (!isPlainObject(row) || !hasFields(row, LIVE_FIELDS)) return null;

    // Liveness is decided on one identity only, so a row that names two
    // different ones cannot prove anything about either.
    if (
      !isDigitText(row.position_id) ||
      !isDigitText(row.identifier) ||
      !isDigitText(row.ticket) ||
      row.position_id === "0" ||
      row.identifier === "0" ||
      row.ticket === "0" ||
      row.position_id !== row.identifier ||
      typeof row.symbol !== "string" ||
      row.symbol === "" ||
      typeof row.type !== "number" ||
      !Number.isInteger(row.type) ||
      !isPositiveDecimalText(row.volume)
    ) {
      return null;
    }

    liveIds.push(row.position_id);
  }

  return {
    toUtc,
    toMsc,
    bootKey: `${body.bridge_boot_id}\u0000${body.connection_generation}`,
    deals,
    financial,
    liveIds: [...new Set(liveIds)],
  };
}

// ==========================================================
// Evidence collection
// ==========================================================

function collectEvidence(pages) {
  const groups = new Map();
  const seenDeals = new Map();
  const seenFinancial = new Map();
  const financialDeals = [];

  const tally = {
    dealRows: 0,
    duplicateDealRows: 0,
    conflictingFinancialRows: 0,
  };

  function group(positionId) {
    let entry = groups.get(positionId);

    if (entry === undefined) {
      entry = { positionId, deals: [], reasons: new Set(), symbol: null };
      groups.set(positionId, entry);
    }

    return entry;
  }

  for (const page of pages) {
    for (const row of page.deals) {
      const signature = dealSignature(row);
      const previous = seenDeals.get(row.ticket);

      if (previous !== undefined) {
        if (previous.signature === signature) {
          tally.duplicateDealRows += 1;
          continue;
        }

        // The same ticket reported twice with different contents:
        // neither version can be believed for any position it touches.
        group(previous.positionId).reasons.add(
          RECONSTRUCTION_REASONS.CONFLICTING_DUPLICATE_DEALS
        );
        group(row.position_id).reasons.add(
          RECONSTRUCTION_REASONS.CONFLICTING_DUPLICATE_DEALS
        );
        continue;
      }

      seenDeals.set(row.ticket, { signature, positionId: row.position_id });

      const entry = group(row.position_id);

      entry.deals.push(row);
      tally.dealRows += 1;

      if (entry.symbol === null && typeof row.symbol === "string" && row.symbol) {
        entry.symbol = row.symbol;
      }

      if (
        typeof row.entry !== "number" ||
        !Number.isInteger(row.entry) ||
        row.entry < 0 ||
        row.entry > DEAL_ENTRY_MAXIMUM
      ) {
        entry.reasons.add(RECONSTRUCTION_REASONS.UNKNOWN_DEAL_ENTRY);
      }

      if (
        !isPositiveDecimalText(row.volume) ||
        !isNonNegativeInteger(row.time_msc) ||
        !isDigitText(row.ticket) ||
        row.ticket === "0"
      ) {
        entry.reasons.add(RECONSTRUCTION_REASONS.MALFORMED_DEAL_ROW);
      }
    }

    for (const row of page.financial) {
      if (
        !isDigitText(row.ticket) ||
        row.ticket === "0" ||
        !isNonNegativeInteger(row.time_msc)
      ) {
        continue;
      }

      const signature = dealSignature(row);
      const previous = seenFinancial.get(row.ticket);

      if (previous !== undefined) {
        if (previous === signature) {
          tally.duplicateDealRows += 1;
        } else {
          tally.conflictingFinancialRows += 1;
          seenFinancial.delete(row.ticket);
          const index = financialDeals.findIndex(
            (item) => item.ticket === row.ticket
          );

          if (index !== -1) financialDeals.splice(index, 1);
        }

        continue;
      }

      seenFinancial.set(row.ticket, signature);
      financialDeals.push({
        ticket: row.ticket,
        type: row.type,
        timeMsc: row.time_msc,
      });
    }
  }

  for (const entry of groups.values()) {
    entry.deals.sort(compareDeals);
  }

  financialDeals.sort(
    (a, b) => a.timeMsc - b.timeMsc || compareIdentifierText(a.ticket, b.ticket)
  );

  return { groups, financialDeals, tally };
}

// ==========================================================
// The newest accepted live-position snapshot
// ==========================================================

function resolveSnapshot(pages) {
  if (pages.length === 0) {
    return {
      liveIds: new Set(),
      ambiguousIds: new Set(),
      snapshotAmbiguous: false,
      generationAmbiguous: false,
      newestMsc: null,
      liveSnapshotToUtc: null,
    };
  }

  const generations = new Set(pages.map((page) => page.bootKey));
  const newestMsc = Math.max(...pages.map((page) => page.toMsc));
  const newest = pages.filter((page) => page.toMsc === newestMsc);

  const liveIds = new Set();
  const counts = new Map();

  for (const page of newest) {
    for (const positionId of page.liveIds) {
      liveIds.add(positionId);
      counts.set(positionId, (counts.get(positionId) ?? 0) + 1);
    }
  }

  // A position reported by only some of the pages that share the newest
  // instant is a snapshot the caller cannot order, so its liveness is
  // unknown rather than assumed.
  const ambiguousIds = new Set();

  for (const positionId of liveIds) {
    if (counts.get(positionId) !== newest.length) {
      ambiguousIds.add(positionId);
    }
  }

  return {
    liveIds,
    ambiguousIds,
    snapshotAmbiguous: ambiguousIds.size > 0,
    generationAmbiguous: generations.size > 1,
    newestMsc,
    liveSnapshotToUtc: newest[0].toUtc,
  };
}

// ==========================================================
// What the rejected pages say about that snapshot
// ==========================================================

// A dropped page is dropped whole, so the only thing still readable from it
// is the window it claimed to cover. That instant decides whether the dropped
// page could have reported a live position the accepted snapshot misses.
function rejectedInstant(record) {
  const body =
    isPlainObject(record) && isPlainObject(record.page) ? record.page : null;

  if (body === null || !isPlainObject(body.utc_range)) return null;

  const toUtc = body.utc_range.to_utc;
  const msc = instantToMsc(toUtc);

  return msc === null ? null : { msc, toUtc };
}

function assessRejectedEvidence(rejected, snapshot) {
  let newestMsc = null;
  let newestUtc = null;
  let instantUnknown = false;

  for (const record of rejected) {
    const instant = rejectedInstant(record);

    if (instant === null) {
      // An Express refusal carries no range at all (server/routes/mt5.js
      // historyRefusal :529-541), so this page covers an unknowable instant
      // and cannot be dismissed as merely old.
      instantUnknown = true;
      continue;
    }

    if (newestMsc === null || instant.msc > newestMsc) {
      newestMsc = instant.msc;
      newestUtc = instant.toUtc;
    }
  }

  // Rejected evidence never advances scan.liveSnapshotToUtc; it can only
  // cast doubt on the accepted snapshot that already exists.
  return {
    rejectedSnapshotToUtc: newestUtc,
    snapshotEvidenceIncomplete:
      snapshot.newestMsc !== null &&
      (instantUnknown ||
        (newestMsc !== null && newestMsc >= snapshot.newestMsc)),
  };
}

// ==========================================================
// Lifecycle evaluation
// ==========================================================

function primaryReason(reasons) {
  for (const reason of REASON_PRIORITY) {
    if (reasons.has(reason)) return reason;
  }

  return [...reasons][0];
}

// Volume is signed by lifecycle role, not by direction alone. The opener
// is the first deal and must be an IN in the position's own direction;
// every later deal has to be classifiable against that role:
//
//   IN    same direction, first deal only -> adds
//   IN    anywhere else                    -> unprovable lifecycle
//   OUT   opposite direction               -> reduces
//   OUT   same direction                   -> unprovable lifecycle
//   INOUT same / opposite direction        -> adds / reduces
//   CLOSE_BY                              -> rejected before this point
//
// Returns null whenever a deal cannot be assigned a role, so the caller
// refuses the lifecycle instead of trusting a direction guess.
function classifyLifecycle(deals, sideType) {
  let places = 0;

  for (const deal of deals) {
    places = Math.max(places, decimalPlaces(deal.volume));
  }

  let net = 0n;
  const opening = [];
  const closing = [];

  for (let index = 0; index < deals.length; index += 1) {
    const deal = deals[index];
    const scaled = decimalToScaled(deal.volume, places);

    if (deal.entry === DEAL_ENTRY_IN) {
      if (index !== 0 || deal.type !== sideType) return null;

      opening.push(deal);
      net += scaled;
      continue;
    }

    if (deal.entry === DEAL_ENTRY_OUT) {
      if (deal.type === sideType) return null;

      closing.push(deal);
      net -= scaled;
      continue;
    }

    if (deal.entry === DEAL_ENTRY_INOUT) {
      if (deal.type === sideType) {
        opening.push(deal);
        net += scaled;
      } else {
        closing.push(deal);
        net -= scaled;
      }

      continue;
    }

    return null;
  }

  return { net, places, opening, closing };
}

function evaluateGroup(entry, snapshot) {
  const { deals, reasons, positionId } = entry;

  const sortedReasons = [...reasons].sort();
  const earliest = deals.length ? deals[0].time_msc : null;
  const latest = deals.length ? deals[deals.length - 1].time_msc : null;

  const base = {
    positionId,
    symbol: entry.symbol,
    dealCount: deals.length,
    dealTickets: deals.map((deal) => deal.ticket),
    earliestDealTimeMsc: earliest,
    latestDealTimeMsc: latest,
    liveInNewestSnapshot: snapshot.liveIds.has(positionId),
    reasons: sortedReasons,
  };

  function unresolved(reason, extra = {}) {
    return {
      unresolved: {
        ...base,
        reason,
        retryable: RETRYABLE_REASONS.has(reason),
        ...extra,
      },
    };
  }

  if (reasons.size > 0) {
    return unresolved(primaryReason(reasons), { netVolume: null });
  }

  const first = deals[0];

  // The group is sorted by (time_msc, ticket), so a second deal at the
  // opening instant means more than one deal could be the opener. Side and
  // opening time would then rest on ticket order alone, which is not
  // evidence of what happened first.
  if (deals.length > 1 && deals[1].time_msc === first.time_msc) {
    return unresolved(RECONSTRUCTION_REASONS.AMBIGUOUS_OPENING_TIME, {
      netVolume: null,
    });
  }

  if (first.entry !== DEAL_ENTRY_IN) {
    return unresolved(
      first.entry === DEAL_ENTRY_INOUT
        ? RECONSTRUCTION_REASONS.INOUT_OPENER_UNPROVEN
        : RECONSTRUCTION_REASONS.OPENING_DEAL_MISSING,
      { netVolume: null }
    );
  }

  if (deals.some((deal) => deal.entry === DEAL_ENTRY_CLOSE_BY)) {
    return unresolved(RECONSTRUCTION_REASONS.INCOMPLETE_CLOSE_BY_EVIDENCE, {
      netVolume: null,
    });
  }

  const sideType = first.type;
  const lifecycle = classifyLifecycle(deals, sideType);

  if (lifecycle === null) {
    return unresolved(RECONSTRUCTION_REASONS.UNCLASSIFIABLE_DEAL_ENTRY, {
      netVolume: null,
    });
  }

  const { net, places, opening, closing } = lifecycle;
  const netVolume = formatScaled(net, places);

  // Two accepted snapshots describe this position's instant differently,
  // so its liveness is unknown. No snapshot-derived conclusion — open,
  // closed, or contradicted — is safe here.
  if (snapshot.ambiguousIds.has(positionId)) {
    return unresolved(RECONSTRUCTION_REASONS.AMBIGUOUS_LIVE_SNAPSHOT, {
      netVolume,
    });
  }

  const present = snapshot.liveIds.has(positionId);

  if (present && net !== 0n) {
    return unresolved(RECONSTRUCTION_REASONS.STILL_OPEN, { netVolume });
  }

  if (present) {
    return unresolved(RECONSTRUCTION_REASONS.LIFECYCLE_CONTRADICTS_SNAPSHOT, {
      netVolume,
    });
  }

  if (net > 0n) {
    return unresolved(RECONSTRUCTION_REASONS.VOLUME_NOT_FLAT, { netVolume });
  }

  if (net < 0n) {
    return unresolved(RECONSTRUCTION_REASONS.VOLUME_NET_NEGATIVE, {
      netVolume,
    });
  }

  // Flat and absent from every newest snapshot: only the connection
  // generation and rejected-evidence gates can still stop the claim.
  if (snapshot.generationAmbiguous) {
    return unresolved(RECONSTRUCTION_REASONS.GENERATION_AMBIGUOUS_SNAPSHOT, {
      netVolume,
    });
  }

  // The closure needs the position to be provably absent from the live set.
  // A page covering this instant was dropped, and a dropped page says
  // nothing about what was open — so its absence is unproven, not proven.
  if (snapshot.snapshotEvidenceIncomplete) {
    return unresolved(
      RECONSTRUCTION_REASONS.LIVE_SNAPSHOT_EVIDENCE_INCOMPLETE,
      { netVolume }
    );
  }

  // Flat, absent from a complete snapshot, single-generation, yet a
  // lifecycle with nothing reducing the volume cannot have closed itself.
  // Positive volumes make this unreachable; the guard keeps it that way.
  if (closing.length === 0) {
    return unresolved(RECONSTRUCTION_REASONS.UNCLASSIFIABLE_DEAL_ENTRY, {
      netVolume,
    });
  }

  return {
    candidate: {
      positionId,
      symbol: entry.symbol,
      side: sideType === DEAL_TYPE_BUY ? "buy" : "sell",
      openedAtMsc: first.time_msc,
      closedAtMsc: closing[closing.length - 1].time_msc,
      netVolume,
      dealCount: deals.length,
      openingTickets: opening.map((deal) => deal.ticket),
      closingTickets: closing.map((deal) => deal.ticket),
      dealTickets: deals.map((deal) => deal.ticket),
      liveSnapshotToUtc: snapshot.liveSnapshotToUtc,
    },
  };
}

// ==========================================================
// Public entry point
// ==========================================================

export function reconstructClosedPositions(pages) {
  if (!Array.isArray(pages)) {
    throw new TypeError(
      "reconstructClosedPositions expects an array of page records"
    );
  }

  const usable = [];
  const rejected = [];

  for (const record of pages) {
    if (!isPlainObject(record) || record.accepted !== true) {
      rejected.push(record);
      continue;
    }

    const page = extractPage(record.page);

    if (page === null) {
      rejected.push(record);
      continue;
    }

    usable.push(page);
  }

  // Stable processing order regardless of how the caller sequenced the
  // pages: newest-window last, ties broken by the boot key.
  usable.sort(
    (a, b) =>
      a.toMsc - b.toMsc ||
      (a.bootKey < b.bootKey ? -1 : a.bootKey > b.bootKey ? 1 : 0)
  );

  const snapshotBase = resolveSnapshot(usable);
  const { rejectedSnapshotToUtc, snapshotEvidenceIncomplete } =
    assessRejectedEvidence(rejected, snapshotBase);
  const snapshot = { ...snapshotBase, snapshotEvidenceIncomplete };
  const { groups, financialDeals, tally } = collectEvidence(usable);

  const closed = [];
  const unresolved = [];

  for (const entry of groups.values()) {
    const outcome = evaluateGroup(entry, snapshot);

    if (outcome.candidate) closed.push(outcome.candidate);
    if (outcome.unresolved) unresolved.push(outcome.unresolved);
  }

  const byPositionId = (a, b) => compareIdentifierText(a.positionId, b.positionId);

  closed.sort(byPositionId);
  unresolved.sort(byPositionId);

  const result = {
    closed: closed.map(Object.freeze),
    unresolved: unresolved.map(Object.freeze),
    financialDeals: financialDeals.map(Object.freeze),
    scan: Object.freeze({
      acceptedPages: usable.length,
      rejectedPages: rejected.length,
      dealRows: tally.dealRows,
      duplicateDealRows: tally.duplicateDealRows,
      conflictingFinancialRows: tally.conflictingFinancialRows,
      generationAmbiguous: snapshot.generationAmbiguous,
      snapshotAmbiguous: snapshot.snapshotAmbiguous,
      // Newest trustworthy ACCEPTED snapshot; never advanced by a rejection.
      liveSnapshotToUtc: snapshot.liveSnapshotToUtc,
      // Newest instant a dropped page claimed to cover, kept separate so
      // rejected evidence can never be read as accepted liveness.
      rejectedSnapshotToUtc,
      snapshotEvidenceIncomplete,
      // Hard false: nothing in Stage D can prove full history coverage.
      coverageComplete: false,
    }),
  };

  return Object.freeze(result);
}
