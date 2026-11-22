// ==========================================================
// CHART PROTOTYPE — LINE GEOMETRY (PURE)
//
// The chart's own price scale is the single source of truth for
// price <-> pixel conversion. Nothing here stores a pixel: the
// overlay always asks the chart again on every frame, which is
// what keeps a line attached to its price during pan, zoom and
// resize.
//
// This module only owns rounding, formatting and the guards
// around a drag conversion, so it can be unit-tested without a
// DOM and without the chart library.
// ==========================================================

// FX majors quote 5 decimals; metals/indices 3. Mirrors the
// existing positions formatter so the prototype labels look
// like the rest of the terminal.
export function pricePrecision(price) {
  const absolute = Math.abs(Number(price));

  if (!Number.isFinite(absolute)) return 5;

  return absolute >= 100 ? 3 : 5;
}

export function roundPrice(price, decimals = pricePrecision(price)) {
  const value = Number(price);

  if (!Number.isFinite(value)) return null;

  const places = Number.isInteger(decimals) ? decimals : pricePrecision(value);

  return Number(value.toFixed(places));
}

export function formatPriceLabel(price) {
  const value = Number(price);

  if (!Number.isFinite(value)) return "—";

  return value.toFixed(pricePrecision(value));
}

// One arrow-key step. Grid-based on the price precision rather
// than a raw float delta, so repeated nudges cannot drift.
export function priceStep(price) {
  const decimals = pricePrecision(price);

  return Number((1 / 10 ** decimals).toFixed(decimals + 1));
}

export function clampPrice(price, { min = 0, max = Infinity } = {}) {
  const value = Number(price);

  if (!Number.isFinite(value)) return null;

  return Math.min(max, Math.max(min, value));
}

// Convert a pointer y (already relative to the chart container)
// into a price.
//
// `coordinateToPrice` is the live chart series API, injected so
// this stays testable and so the overlay never keeps its own
// scale maths in sync by hand.
//
// Returns null for a conversion the chart cannot answer: outside
// the pane, over the time axis, or a non-positive price. Callers
// must ignore null instead of guessing.
export function resolveDragPrice(y, { coordinateToPrice, precision } = {}) {
  if (!Number.isFinite(y) || typeof coordinateToPrice !== "function") {
    return null;
  }

  let raw;

  try {
    raw = coordinateToPrice(y);
  } catch {
    return null;
  }

  if (!Number.isFinite(raw) || raw <= 0) return null;

  return roundPrice(raw, Number.isInteger(precision) ? precision : pricePrecision(raw));
}

// Same direction the other way, used to position the label and
// handle for a stored price. Null means "not on screen right
// now" — the overlay hides that line rather than pinning it to
// an edge.
export function resolveLineY(price, { priceToCoordinate } = {}) {
  if (!Number.isFinite(price) || typeof priceToCoordinate !== "function") {
    return null;
  }

  let coordinate;

  try {
    coordinate = priceToCoordinate(price);
  } catch {
    return null;
  }

  return Number.isFinite(coordinate) ? coordinate : null;
}
