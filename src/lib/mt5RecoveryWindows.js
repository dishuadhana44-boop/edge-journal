// ============================================================
// Stage D — which ranges a recovery run is allowed to read
//
// The scan takes whatever windows it is handed and the adapter trusts the
// scan, so the one place a range can be wrong is here. Two facts decide it:
//
//   * a tile may not exceed the policy's 30 days, even if a caller asks for
//     more. The bridge would answer a page up to 365 days
//     (mt5-bridge/app.py:5587 with :5870), but how many deals fit in a page
//     was never verified against a real account, so a wider tile is an
//     unproven read rather than a cheaper one;
//   * a page's bounds are compared at whole-second resolution
//     (mt5-bridge/app.py:6337-6338 with :6235), and a deal found outside
//     them fails the whole page. So every boundary this module emits is a
//     whole second, and an anchor that carries a fraction is floored —
//     never rounded up, which would put the end of a page inside a second
//     the bridge has already truncated away.
//
// Adjacent tiles share their boundary second instead of leaving a one-second
// gap, because the API's own end-inclusivity for a range was never verified
// from the broker side, and a lost second of deals loses the closure that
// lived in it. A shared second costs only a duplicate row, which the
// reconstruction already keys away by ticket.
//
// The count of tiles is bounded because every tile is one serialised request
// behind the bridge's connection lock with a 10 second route timeout
// (server/routes/mt5.js:418), and one refusal blocks the whole scan
// (mt5HistoryRecoveryScan.js:226).
//
// Pure: a function of its inputs, no clock, no storage, no request. A repeat
// run is the same call with a later anchor, which is what lets the journal do
// the deduping instead of a saved checkpoint.
// ============================================================

const SECOND_MS = 1000;
const DAY_MS = 86_400_000;

const UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

// The bridge's own supported history range (mt5-bridge/app.py:5589-5591).
const MIN_SUPPORTED_UTC = Date.parse("1970-01-01T00:00:00Z");
const MAX_SUPPORTED_UTC = Date.parse("2200-01-01T00:00:00Z");

export const RECOVERY_WINDOW_POLICY = Object.freeze({
  LOOKBACK_DAYS: 90,
  TILE_DAYS: 30,
  MAX_PAGE_DAYS: 365,
  MAX_WINDOWS: 31,
});

export const RECOVERY_WINDOW_REASONS = Object.freeze({
  ANCHOR_INVALID: "RECOVERY_ANCHOR_INVALID",
  ANCHOR_OUT_OF_RANGE: "RECOVERY_ANCHOR_OUT_OF_RANGE",
  LOOKBACK_INVALID: "RECOVERY_LOOKBACK_INVALID",
  TILE_INVALID: "RECOVERY_TILE_INVALID",
  TILE_TOO_WIDE: "RECOVERY_WINDOW_TILE_TOO_WIDE",
  TOO_MANY_WINDOWS: "RECOVERY_WINDOW_COUNT_TOO_LARGE",
});

const R = RECOVERY_WINDOW_REASONS;

function wholeDayCount(value) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0;
}

// Floored to the second, so a fractional anchor yields the second it is
// inside of. Returns null for anything the route would refuse outright.
function anchorSecond(value) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  if (!UTC_INSTANT.test(text)) return null;

  const parsed = Date.parse(text);

  if (!Number.isFinite(parsed)) return null;

  return Math.floor(parsed / SECOND_MS) * SECOND_MS;
}

function isoSecond(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function refused(reason) {
  return Object.freeze({
    windows: Object.freeze([]),
    refusal: reason,
  });
}

export function buildRecoveryWindows(input = {}) {
  const { LOOKBACK_DAYS, TILE_DAYS, MAX_WINDOWS } = RECOVERY_WINDOW_POLICY;

  const anchorMs = anchorSecond(
    typeof input === "object" && input !== null ? input.anchorUtc : undefined
  );

  if (anchorMs === null) return refused(R.ANCHOR_INVALID);

  // Only an absent key means "use the policy"; an explicit null is a caller
  // that has no lookback and must be refused rather than quietly defaulted.
  const lookbackDays =
    input.lookbackDays === undefined ? LOOKBACK_DAYS : input.lookbackDays;
  const tileDays = input.tileDays === undefined ? TILE_DAYS : input.tileDays;

  if (!wholeDayCount(lookbackDays)) return refused(R.LOOKBACK_INVALID);
  if (!wholeDayCount(tileDays)) return refused(R.TILE_INVALID);

  // The tile ceiling is the policy's 30 days, not the bridge's 365-day page
  // limit, and a caller cannot raise it. Refused rather than clamped: a
  // silently narrowed tile is not the plan the caller asked to audit.
  if (tileDays > TILE_DAYS) return refused(R.TILE_TOO_WIDE);

  const totalMs = lookbackDays * DAY_MS;
  const tileMs = tileDays * DAY_MS;

  if (Math.ceil(totalMs / tileMs) > MAX_WINDOWS) return refused(R.TOO_MANY_WINDOWS);

  const startMs = anchorMs - totalMs;

  if (startMs < MIN_SUPPORTED_UTC || anchorMs > MAX_SUPPORTED_UTC) {
    return refused(R.ANCHOR_OUT_OF_RANGE);
  }

  const windows = [];

  // b(0) = start, b(i) = start + i * tile, clamped so the last tile ends on
  // the anchor exactly. Sharing b(i) between neighbours keeps the cover whole.
  let fromMs = startMs;

  while (fromMs < anchorMs) {
    const toMs = Math.min(fromMs + tileMs, anchorMs);

    windows.push(Object.freeze({ fromUtc: isoSecond(fromMs), toUtc: isoSecond(toMs) }));

    fromMs = toMs;
  }

  return Object.freeze({
    windows: Object.freeze(windows),
    refusal: null,
  });
}
