import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRecoveryWindows,
  RECOVERY_WINDOW_POLICY,
  RECOVERY_WINDOW_REASONS,
} from "./mt5RecoveryWindows.js";

// ============================================================
// Fixtures
//
// Whole-second Z instants only, because mt5-bridge/app.py:6337-6338
// truncates a range bound to the second and then refuses any deal it
// finds outside the truncated page (:6235). Every boundary asserted
// here is derived from the same arithmetic the producer applies, so a
// window this suite accepts is a window the bridge will answer.
// ============================================================

const DAY_MS = 86_400_000;
const SECOND_MS = 1000;

const ANCHOR = "2026-01-15T12:00:00Z";
const ANCHOR_MS = Date.parse(ANCHOR);

const SECOND_TEXT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function built(input = {}) {
  return buildRecoveryWindows(input);
}

function windowsOf(input) {
  const result = built(input);

  assert.equal(
    result.refusal,
    null,
    `expected windows, got refusal ${result.refusal}`
  );

  return result.windows;
}

function refused(input, reason) {
  const result = built(input);

  assert.equal(
    result.refusal,
    reason,
    `expected ${reason}, got ${JSON.stringify(result)}`
  );
  assert.deepEqual([...result.windows], []);

  return result;
}

function spanMs(window) {
  return Date.parse(window.toUtc) - Date.parse(window.fromUtc);
}

// ============================================================
// 1. The approved lookback: 90 days, tiles of at most 30 days
// ============================================================

test("builds the approved 90-day lookback in three 30-day windows", () => {
  const windows = windowsOf({ anchorUtc: ANCHOR });

  assert.equal(windows.length, 3);
  assert.equal(windows[0].fromUtc, iso(ANCHOR_MS - 90 * DAY_MS));
  assert.equal(windows.at(-1).toUtc, ANCHOR);

  for (const window of windows) {
    assert.equal(spanMs(window), 30 * DAY_MS);
  }
});

test("uses the policy defaults when the caller overrides nothing", () => {
  assert.equal(RECOVERY_WINDOW_POLICY.LOOKBACK_DAYS, 90);
  assert.equal(RECOVERY_WINDOW_POLICY.TILE_DAYS, 30);
  assert.equal(RECOVERY_WINDOW_POLICY.MAX_PAGE_DAYS, 365);

  assert.deepEqual(
    [...windowsOf({ anchorUtc: ANCHOR })],
    [
      ...windowsOf({
        anchorUtc: ANCHOR,
        lookbackDays: RECOVERY_WINDOW_POLICY.LOOKBACK_DAYS,
        tileDays: RECOVERY_WINDOW_POLICY.TILE_DAYS,
      }),
    ]
  );
});

test("orders the windows oldest first so the newest snapshot is read last", () => {
  const windows = windowsOf({ anchorUtc: ANCHOR, lookbackDays: 90, tileDays: 7 });

  for (let index = 1; index < windows.length; index += 1) {
    assert.ok(
      Date.parse(windows[index].fromUtc) > Date.parse(windows[index - 1].fromUtc),
      "windows must advance"
    );
    assert.ok(
      Date.parse(windows[index].toUtc) > Date.parse(windows[index - 1].toUtc),
      "windows must advance"
    );
  }
});

test("makes adjacent windows share exactly one boundary second with no gap", () => {
  const windows = windowsOf({ anchorUtc: ANCHOR, lookbackDays: 90, tileDays: 11 });

  assert.ok(windows.length > 2, "this fixture is meant to produce several tiles");

  for (let index = 1; index < windows.length; index += 1) {
    assert.equal(
      windows[index].fromUtc,
      windows[index - 1].toUtc,
      "a gap between tiles would silently drop the deals in it"
    );
  }
});

test("covers the whole lookback from anchor minus 90 days to the anchor", () => {
  for (const tileDays of [3, 7, 11, 15, 30]) {
    const windows = windowsOf({ anchorUtc: ANCHOR, lookbackDays: 90, tileDays });

    assert.equal(windows[0].fromUtc, iso(ANCHOR_MS - 90 * DAY_MS));
    assert.equal(windows.at(-1).toUtc, ANCHOR);

    const covered = windows.reduce(
      (total, window) => total + spanMs(window),
      0
    );

    // Consecutive tiles share a boundary, so the spans telescope: their sum is
    // the lookback itself, which is what proves neither gap nor overrun.
    assert.equal(covered, 90 * DAY_MS);
  }
});

test("keeps every window at or below the tile size it was given", () => {
  const windows = windowsOf({ anchorUtc: ANCHOR, lookbackDays: 90, tileDays: 25 });

  assert.equal(windows.length, 4);

  for (const window of windows) {
    assert.ok(spanMs(window) <= 25 * DAY_MS);
  }
});

test("never emits a window wider than the bridge's page limit", () => {
  for (const { lookbackDays, tileDays } of [
    { lookbackDays: 365, tileDays: 30 },
    { lookbackDays: 365, tileDays: 15 },
    { lookbackDays: 90, tileDays: 3 },
  ]) {
    const windows = windowsOf({ anchorUtc: ANCHOR, lookbackDays, tileDays });

    assert.ok(windows.length <= RECOVERY_WINDOW_POLICY.MAX_WINDOWS);

    for (const window of windows) {
      assert.ok(
        spanMs(window) <= RECOVERY_WINDOW_POLICY.MAX_PAGE_DAYS * DAY_MS,
        `${window.fromUtc}/${window.toUtc} exceeds one page`
      );
    }
  }
});

test("refuses a tile wider than the 30-day policy instead of clamping it", () => {
  // A clamp would hand back a narrower plan than the caller asked for and a
  // pass-through would manufacture a bridge refusal. Both are refused here,
  // before any window exists.
  for (const tileDays of [31, 40, 365, 366]) {
    refused(
      { anchorUtc: ANCHOR, lookbackDays: 90, tileDays },
      RECOVERY_WINDOW_REASONS.TILE_TOO_WIDE
    );
  }
});

test("accepts a tile of exactly the 30-day policy maximum", () => {
  const windows = windowsOf({
    anchorUtc: ANCHOR,
    lookbackDays: 90,
    tileDays: RECOVERY_WINDOW_POLICY.TILE_DAYS,
  });

  assert.equal(windows.length, 3);

  for (const window of windows) {
    assert.equal(spanMs(window), 30 * DAY_MS);
  }

  assert.deepEqual([...windows], [...windowsOf({ anchorUtc: ANCHOR })]);
});

// ============================================================
// 2. Determinism
// ============================================================

test("builds the identical windows twice for the same inputs", () => {
  const once = windowsOf({ anchorUtc: ANCHOR });
  const twice = windowsOf({ anchorUtc: ANCHOR });

  assert.deepEqual([...twice], [...once]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(twice)),
    JSON.parse(JSON.stringify(once))
  );
});

test("shifts every window when the anchor moves and nothing else", () => {
  const later = iso(Date.parse(ANCHOR) + 60 * SECOND_MS);

  const before = windowsOf({ anchorUtc: ANCHOR });
  const after = windowsOf({ anchorUtc: later });

  assert.equal(after.length, before.length);

  for (let index = 0; index < before.length; index += 1) {
    assert.equal(
      Date.parse(after[index].fromUtc) - Date.parse(before[index].fromUtc),
      60 * SECOND_MS
    );
    assert.equal(after.at(-1).toUtc, later);
  }
});

test("freezes the windows so a caller cannot widen one after the fact", () => {
  const result = built({ anchorUtc: ANCHOR });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.windows), true);
  assert.equal(Object.isFrozen(result.windows[0]), true);
});

// ============================================================
// 3. Whole-second boundaries
// ============================================================

test("emits whole-second Z timestamps for every boundary", () => {
  for (const window of windowsOf({ anchorUtc: "2026-01-15T12:00:00.500Z" })) {
    assert.match(window.fromUtc, SECOND_TEXT);
    assert.match(window.toUtc, SECOND_TEXT);
  }
});

test("normalizes an anchor to the second it started in rather than rounding up", () => {
  const floored = windowsOf({ anchorUtc: "2026-01-15T12:00:00.999Z" });
  const exact = windowsOf({ anchorUtc: ANCHOR });

  assert.equal(floored.at(-1).toUtc, ANCHOR);
  assert.deepEqual([...floored], [...exact]);
});

test("normalizes microsecond precision down to the same second", () => {
  const windows = windowsOf({ anchorUtc: "2026-01-15T12:00:00.000001Z" });

  assert.equal(windows.at(-1).toUtc, ANCHOR);
});

// ============================================================
// 4. Invalid input is refused before any range exists
// ============================================================

test("refuses an anchor that is not a bare UTC Z instant", () => {
  for (const anchorUtc of [
    undefined,
    null,
    1767355200000,
    "2026-01-15T12:00:00",
    "2026-01-15 12:00:00Z",
    "2026-01-15T12:00:00+05:30",
    "yesterday",
    "",
  ]) {
    refused({ anchorUtc }, RECOVERY_WINDOW_REASONS.ANCHOR_INVALID);
  }
});

test("refuses a lookback that is not a positive whole number of days", () => {
  for (const lookbackDays of [null, 0, -90, 1.5, Number.NaN, "90", Infinity]) {
    refused(
      { anchorUtc: ANCHOR, lookbackDays },
      RECOVERY_WINDOW_REASONS.LOOKBACK_INVALID
    );
  }
});

test("refuses a tile that is not a positive whole number of days", () => {
  for (const tileDays of [0, -30, 7.5, Number.NaN, "30"]) {
    refused(
      { anchorUtc: ANCHOR, tileDays },
      RECOVERY_WINDOW_REASONS.TILE_INVALID
    );
  }
});

test("refuses a tile plan that would fan out past the bounded read", () => {
  refused(
    { anchorUtc: ANCHOR, lookbackDays: 365, tileDays: 1 },
    RECOVERY_WINDOW_REASONS.TOO_MANY_WINDOWS
  );

  assert.equal(
    windowsOf({
      anchorUtc: ANCHOR,
      lookbackDays: RECOVERY_WINDOW_POLICY.MAX_WINDOWS,
      tileDays: 1,
    }).length,
    RECOVERY_WINDOW_POLICY.MAX_WINDOWS
  );
});

test("refuses a range the bridge cannot name at all", () => {
  // mt5-bridge/app.py:5589-5591 supports 1970-01-01Z through 2200-01-01Z,
  // and a range outside it is a 400 before any broker read.
  for (const input of [
    { anchorUtc: "1970-01-01T00:00:00Z" },
    { anchorUtc: "1970-06-01T00:00:00Z", lookbackDays: 365, tileDays: 30 },
    { anchorUtc: "2200-01-01T00:00:01Z" },
    { anchorUtc: "2200-01-02T00:00:00Z", lookbackDays: 365, tileDays: 30 },
  ]) {
    assert.equal(
      built(input).refusal,
      RECOVERY_WINDOW_REASONS.ANCHOR_OUT_OF_RANGE,
      input.anchorUtc
    );
  }
});

test("accepts an anchor whose whole lookback is inside the supported range", () => {
  const windows = windowsOf({
    anchorUtc: "1971-01-02T00:00:00Z",
    lookbackDays: 365,
    tileDays: 30,
  });

  assert.equal(windows[0].fromUtc, "1970-01-02T00:00:00Z");
});

// ============================================================
// 5. The windows are a scan input the existing contract accepts
// ============================================================

test("emits window keys the recovery scan already validates", () => {
  for (const window of windowsOf({ anchorUtc: ANCHOR })) {
    assert.deepEqual(Object.keys(window).sort(), ["fromUtc", "toUtc"]);
    assert.ok(Date.parse(window.toUtc) > Date.parse(window.fromUtc));
  }
});

test("refuses to build when the input is not an object at all", () => {
  assert.equal(
    buildRecoveryWindows().refusal,
    RECOVERY_WINDOW_REASONS.ANCHOR_INVALID
  );
});
