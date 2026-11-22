import test from "node:test";
import assert from "node:assert/strict";

import {
  clampPrice,
  formatPriceLabel,
  pricePrecision,
  priceStep,
  resolveDragPrice,
  resolveLineY,
  roundPrice,
} from "./lineGeometry.js";

test("precision follows the FX major / metal convention", () => {
  assert.equal(pricePrecision(1.08512), 5);
  assert.equal(pricePrecision(1234.5678), 3);
  assert.equal(pricePrecision(Number.NaN), 5);
});

test("roundPrice and formatting are stable", () => {
  assert.equal(roundPrice(1.085123456), 1.08512);
  assert.equal(roundPrice(1234.56789), 1234.568);
  assert.equal(roundPrice(Number.NaN), null);
  assert.equal(formatPriceLabel(1.08512), "1.08512");
  assert.equal(formatPriceLabel(1234.5), "1234.500");
  assert.equal(formatPriceLabel(Number.NaN), "—");
});

test("keyboard step never drifts and matches the precision grid", () => {
  assert.equal(priceStep(1.08512), 0.00001);
  assert.equal(priceStep(1234.5), 0.001);

  let price = 1.08512;

  for (let index = 0; index < 10; index += 1) {
    price = Number((price + priceStep(price)).toFixed(pricePrecision(price)));
  }

  assert.equal(price, 1.08522);
});

test("clampPrice keeps values finite and inside the bounds", () => {
  assert.equal(clampPrice(1.2, { min: 1, max: 2 }), 1.2);
  assert.equal(clampPrice(0.5, { min: 1, max: 2 }), 1);
  assert.equal(clampPrice(9, { min: 1, max: 2 }), 2);
  assert.equal(clampPrice(Number.NaN), null);
});

// ----------------------------------------------
// Drag conversion: the overlay only ever turns a
// pointer y into a price here.
// ----------------------------------------------

test("drag converts a pixel to the chart's price and snaps precision", () => {
  const price = resolveDragPrice(240, {
    coordinateToPrice: (y) => 1.2 - y * 0.0001,
    precision: 5,
  });

  assert.equal(price, 1.176);
});

test("drag snaps to 5 decimals for FX majors", () => {
  const price = resolveDragPrice(100, {
    coordinateToPrice: () => 1.0851234567,
  });

  assert.equal(price, 1.08512);
});

test("drag snaps to 3 decimals for high-priced instruments", () => {
  const price = resolveDragPrice(100, {
    coordinateToPrice: () => 2345.67891,
  });

  assert.equal(price, 2345.679);
});

test("drag rejects a pointer over the time axis or outside the pane", () => {
  // coordinateToPrice returns null when the chart cannot answer.
  assert.equal(
    resolveDragPrice(9999, { coordinateToPrice: () => null }),
    null
  );

  // And a non-positive price is never accepted.
  assert.equal(
    resolveDragPrice(10, { coordinateToPrice: () => -1 }),
    null
  );

  assert.equal(
    resolveDragPrice(10, { coordinateToPrice: () => Number.NaN }),
    null
  );
});

test("drag never guesses: bad input or a throwing chart returns null", () => {
  assert.equal(resolveDragPrice(Number.NaN, { coordinateToPrice: () => 1 }), null);
  assert.equal(resolveDragPrice(undefined, { coordinateToPrice: () => 1 }), null);
  assert.equal(resolveDragPrice(10, {}), null);
  assert.equal(
    resolveDragPrice(10, {
      coordinateToPrice: () => {
        throw new Error("chart disposed");
      },
    }),
    null
  );
});

test("price to y conversion passes through and guards failures", () => {
  const y = resolveLineY(1.08512, {
    priceToCoordinate: (price) => 400 - price * 100,
  });

  assert.ok(Math.abs(y - 291.488) < 1e-9, `unexpected y: ${y}`);
  assert.equal(resolveLineY(1.08512, { priceToCoordinate: () => null }), null);
  assert.equal(
    resolveLineY(1.08512, { priceToCoordinate: () => Number.NaN }),
    null
  );
  assert.equal(resolveLineY(Number.NaN, { priceToCoordinate: () => 1 }), null);
  assert.equal(resolveLineY(1.08512, {}), null);
  assert.equal(
    resolveLineY(1.08512, {
      priceToCoordinate: () => {
        throw new Error("chart disposed");
      },
    }),
    null
  );
});
