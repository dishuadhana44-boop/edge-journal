import test from "node:test";
import assert from "node:assert/strict";

import { createPrototypeChart } from "./chartPrototypeController.js";

// ----------------------------------------------
// CANVAS-FREE FAKES
//
// The controller accepts an injected chart factory,
// ResizeObserver factory and measure function, so init,
// line tracking and disposal are all testable in Node
// without a DOM or a real canvas.
// ----------------------------------------------

function createFakeSeries() {
  const state = { data: null, lines: [] };

  return {
    state,

    setData(data) {
      state.data = data;
    },

    createPriceLine(options) {
      const line = {
        options: { ...options },
        updates: [],
        applyOptions(next) {
          Object.assign(line.options, next);
          line.updates.push(next);
        },
      };

      state.lines.push(line);

      return line;
    },

    priceToCoordinate(price) {
      // Simple, invertible mapping: 1.0 -> 400px, 1.1 -> 300px.
      return 400 - (price - 1) * 1000;
    },

    coordinateToPrice(y) {
      return 1 + (400 - y) / 1000;
    },
  };
}

function createFakeChart() {
  const series = createFakeSeries();

  const chart = {
    series,
    lastOptions: null,
    removed: 0,
    fitCalls: 0,
    range: { from: 100, to: 200 },

    addSeries(type, options) {
      chart.seriesType = type;
      chart.seriesOptions = options;

      return series;
    },

    applyOptions(options) {
      chart.lastOptions = options;
      chart.appliedOptions = { ...(chart.appliedOptions || {}), ...options };
    },

    remove() {
      chart.removed += 1;
    },

    timeScale() {
      return {
        fitContent() {
          chart.fitCalls += 1;
        },
        getVisibleRange() {
          return chart.range;
        },
        subscribeVisibleLogicalRangeChange() {},
        unsubscribeVisibleLogicalRangeChange() {},
      };
    },
  };

  return chart;
}

function createObserverHarness() {
  const observers = [];

  return {
    observers,
    factory(element, callback) {
      const observer = {
        element,
        callback,
        disconnected: 0,
        disconnect() {
          observer.disconnected += 1;
        },
      };

      observers.push(observer);

      return observer;
    },
  };
}

const CANDLES = [
  { time: 1, open: 1.09, high: 1.1, low: 1.08, close: 1.095 },
  { time: 2, open: 1.095, high: 1.11, low: 1.09, close: 1.105 },
];

const LINES = { sl: 1.09, tp: 1.12 };

function setup(overrides = {}) {
  const chart = createFakeChart();
  const observers = createObserverHarness();

  const controller = createPrototypeChart({
    container: { clientWidth: 800, clientHeight: 600 },
    candles: CANDLES,
    lines: LINES,
    createChartImpl: () => chart,
    resizeObserverFactory: observers.factory,
    ...overrides,
  });

  return { controller, chart, observers };
}

// ----------------------------------------------
// INIT
// ----------------------------------------------

test("refuses to build without a container", () => {
  assert.throws(
    () => createPrototypeChart({ candles: CANDLES, createChartImpl: () => ({}) }),
    /container is missing/
  );
});

test("refuses to build without candles", () => {
  assert.throws(
    () =>
      createPrototypeChart({
        container: { clientWidth: 800, clientHeight: 600 },
        candles: [],
        createChartImpl: () => ({}),
      }),
    /no synthetic candles/
  );
});

test("refuses to build in a zero-sized container", () => {
  assert.throws(
    () =>
      createPrototypeChart({
        container: { clientWidth: 0, clientHeight: 0 },
        candles: CANDLES,
        createChartImpl: () => ({}),
      }),
    /no measurable size/
  );
});

test("renders the candles, fits content and creates both price lines", () => {
  const { chart } = setup();

  assert.deepEqual(chart.series.state.data, CANDLES);
  assert.equal(chart.fitCalls, 1);
  assert.equal(chart.series.state.lines.length, 2);

  const [sl, tp] = chart.series.state.lines;

  assert.equal(sl.options.price, 1.09);
  assert.equal(sl.options.title, "SL");
  assert.equal(tp.options.price, 1.12);
  assert.equal(tp.options.title, "TP");
  assert.notEqual(sl.options.color, tp.options.color);
});

// ----------------------------------------------
// LINE PRICE TRACKING (regression: v5 IPriceLine has no
// readable options object, so getLinePrice must use the map)
// ----------------------------------------------

test("getLinePrice reports the initial prices", () => {
  const { controller } = setup();

  assert.equal(controller.getLinePrice("sl"), 1.09);
  assert.equal(controller.getLinePrice("tp"), 1.12);
  assert.equal(controller.getLinePrice("missing"), null);
});

test("setLinePrice updates the native line and the tracked price", () => {
  const { controller, chart } = setup();

  assert.equal(controller.setLinePrice("sl", 1.095), true);

  assert.equal(controller.getLinePrice("sl"), 1.095);
  assert.equal(chart.series.state.lines[0].options.price, 1.095);
  assert.deepEqual(chart.series.state.lines[0].updates, [{ price: 1.095 }]);
});

test("SL and TP move independently", () => {
  const { controller, chart } = setup();

  controller.setLinePrice("tp", 1.2);

  assert.equal(controller.getLinePrice("tp"), 1.2);
  assert.equal(controller.getLinePrice("sl"), 1.09);
  assert.equal(chart.series.state.lines[1].options.price, 1.2);
  assert.equal(chart.series.state.lines[0].options.price, 1.09);
});

test("setLinePrice rejects invalid prices and unknown kinds", () => {
  const { controller } = setup();

  assert.equal(controller.setLinePrice("sl", 0), false);
  assert.equal(controller.setLinePrice("sl", -1), false);
  assert.equal(controller.setLinePrice("sl", Number.NaN), false);
  assert.equal(controller.setLinePrice("nope", 1.1), false);

  assert.equal(controller.getLinePrice("sl"), 1.09);
});

// ----------------------------------------------
// CONVERSIONS
// ----------------------------------------------

test("priceToY and yToPrice use the live series scale", () => {
  const { controller } = setup();

  const y = controller.priceToY(1.1);

  assert.ok(Math.abs(y - 300) < 1e-9, `unexpected y: ${y}`);
  assert.ok(Math.abs(controller.yToPrice(300) - 1.1) < 1e-12);
  assert.equal(controller.priceToY(Number.NaN), null);
  assert.equal(controller.yToPrice(Number.NaN), null);
  assert.deepEqual(controller.getVisibleRange(), { from: 100, to: 200 });
});

// ----------------------------------------------
// RESIZE / INTERACTIONS
// ----------------------------------------------

test("observer resize re-measures and reports the new viewport", () => {
  let notified = 0;
  const element = { clientWidth: 800, clientHeight: 600 };

  const { chart, observers } = setup({
    container: element,
    onViewportChange: () => {
      notified += 1;
    },
  });

  element.clientWidth = 1024;
  element.clientHeight = 720;

  observers.observers[0].callback();

  assert.deepEqual(chart.lastOptions, { width: 1024, height: 720 });
  assert.ok(notified >= 1);
});

test("chart pan and zoom can be suppressed and restored", () => {
  const { controller, chart } = setup();

  assert.equal(controller.setInteractionEnabled(false), true);

  // v5 ignores boolean values for these options, so the
  // controller must send full explicit objects.
  assert.deepEqual(chart.lastOptions.handleScroll, {
    mouseWheel: false,
    pressedMouseMove: false,
    horzTouchDrag: false,
    vertTouchDrag: false,
  });
  assert.deepEqual(chart.lastOptions.handleScale, {
    axisPressedMouseMove: false,
    axisDoubleClickReset: false,
    mouseWheel: false,
    pinch: false,
  });

  assert.equal(controller.setInteractionEnabled(true), true);
  assert.deepEqual(chart.lastOptions.handleScroll, {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  });
  assert.equal(chart.lastOptions.handleScale.pinch, true);
});

// ----------------------------------------------
// DISPOSE
// ----------------------------------------------

test("dispose removes the chart and disconnects the observer once", () => {
  const { controller, chart, observers } = setup();

  controller.dispose();

  assert.equal(chart.removed, 1);
  assert.equal(observers.observers[0].disconnected, 1);
  assert.equal(controller.isDisposed, true);
});

test("dispose is idempotent", () => {
  const { controller, chart, observers } = setup();

  controller.dispose();
  controller.dispose();
  controller.dispose();

  assert.equal(chart.removed, 1);
  assert.equal(observers.observers[0].disconnected, 1);
});

test("a disposed controller performs no further work", () => {
  const { controller } = setup();

  controller.dispose();

  assert.equal(controller.setLinePrice("sl", 1.2), false);
  assert.equal(controller.getLinePrice("sl"), null);
  assert.equal(controller.priceToY(1.1), null);
  assert.equal(controller.yToPrice(300), null);
  assert.equal(controller.getVisibleRange(), null);
  assert.equal(controller.setInteractionEnabled(true), false);
});

test("a throwing observer factory does not break the chart", () => {
  const { controller, chart } = setup({
    resizeObserverFactory: () => {
      throw new Error("no ResizeObserver here");
    },
  });

  assert.equal(chart.removed, 0);
  assert.doesNotThrow(() => controller.resize());
  assert.doesNotThrow(() => controller.dispose());
  assert.equal(chart.removed, 1);
});
