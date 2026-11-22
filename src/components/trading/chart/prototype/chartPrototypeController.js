// ==========================================================
// CHART PROTOTYPE — CONTROLLER (framework-free)
//
// Owns exactly one lightweight-charts instance and one
// candlestick series. No React, no contexts, no trade code, no
// network. Everything it needs is injected so it can be tested
// without a canvas.
//
// Why native price lines draw the SL/TP rules: lightweight-charts
// v5 paints price lines itself and exposes only applyOptions() on
// IPriceLine — there is no pointer target. So the library draws
// the horizontal rule at the exact price (pixel-perfect, with its
// own axis label), while the React overlay above it supplies the
// draggable handle and the live label. Both read the same price.
// ==========================================================

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
} from "lightweight-charts";

// ==========================================================
// VISUALS
// ==========================================================

export const PROTOTYPE_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: "#0b0c10" },
    textColor: "#a1a1aa",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 12,
  },
  grid: {
    vertLines: { color: "#191b22" },
    horzLines: { color: "#191b22" },
  },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: {
    borderColor: "#292c34",
    scaleMargins: { top: 0.12, bottom: 0.12 },
  },
  timeScale: {
    borderColor: "#292c34",
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 4,
  },
};

export const CANDLE_THEME = {
  upColor: "#16c784",
  downColor: "#ef4444",
  borderUpColor: "#16c784",
  borderDownColor: "#ef4444",
  wickUpColor: "#16c784",
  wickDownColor: "#ef4444",
};

export const PROTOTYPE_LINES = [
  {
    kind: "sl",
    label: "SL",
    color: "#ef4444",
    lineWidth: 2,
    lineStyle: LineStyle.Solid,
  },
  {
    kind: "tp",
    label: "TP",
    color: "#16c784",
    lineWidth: 2,
    lineStyle: LineStyle.Solid,
  },
];

export function getLineDefinition(kind) {
  return PROTOTYPE_LINES.find((line) => line.kind === kind) || null;
}

// v5 wants full objects here, not booleans: passing `false` is
// silently ignored, which would let the chart pan underneath a
// drag. These are the explicit on/off shapes for the options the
// chart actually supports.
function interactionOptions(enabled) {
  return {
    handleScroll: {
      mouseWheel: enabled,
      pressedMouseMove: enabled,
      horzTouchDrag: enabled,
      vertTouchDrag: enabled,
    },
    handleScale: {
      axisPressedMouseMove: enabled,
      axisDoubleClickReset: enabled,
      mouseWheel: enabled,
      pinch: enabled,
    },
  };
}

// ==========================================================
// DEFAULTS
// ==========================================================

function defaultMeasure(container) {
  return {
    width: Math.floor(container?.clientWidth || 0),
    height: Math.floor(container?.clientHeight || 0),
  };
}

function defaultResizeObserverFactory(element, callback) {
  if (typeof ResizeObserver === "undefined") return null;

  const observer = new ResizeObserver(() => callback());
  observer.observe(element);

  return observer;
}

// ==========================================================
// FACTORY
// ==========================================================

export function createPrototypeChart({
  container,
  candles,
  lines = {},
  createChartImpl = createChart,
  resizeObserverFactory = defaultResizeObserverFactory,
  measure = defaultMeasure,
  onViewportChange,
} = {}) {
  if (!container) {
    throw new Error("Chart line prototype: chart container is missing.");
  }

  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error("Chart line prototype: no synthetic candles to render.");
  }

  const size = measure(container);

  if (!(size.width > 0) || !(size.height > 0)) {
    throw new Error(
      "Chart line prototype: chart container has no measurable size."
    );
  }

  const chart = createChartImpl(container, {
    ...PROTOTYPE_THEME,
    width: size.width,
    height: size.height,
  });

  const series = chart.addSeries(CandlestickSeries, CANDLE_THEME);

  series.setData(candles);

  chart.timeScale().fitContent();

  const priceLines = new Map();

  // v5's IPriceLine exposes only applyOptions() — there is no
  // readable options/price property. The authoritative price is
  // therefore mirrored here, and getLinePrice reads this map.
  const prices = new Map();

  for (const definition of PROTOTYPE_LINES) {
    const price = Number(lines[definition.kind]);

    if (!Number.isFinite(price) || price <= 0) continue;

    priceLines.set(
      definition.kind,
      series.createPriceLine({
        price,
        color: definition.color,
        lineWidth: definition.lineWidth,
        lineStyle: definition.lineStyle,
        lineVisible: true,
        axisLabelVisible: true,
        title: definition.label,
      })
    );

    prices.set(definition.kind, price);
  }

  let disposed = false;

  const resize = () => {
    if (disposed) return;

    const next = measure(container);

    if (!(next.width > 0) || !(next.height > 0)) return;

    chart.applyOptions({ width: next.width, height: next.height });

    if (typeof onViewportChange === "function") {
      onViewportChange();
    }
  };

  let observer = null;

  try {
    observer = resizeObserverFactory(container, resize);
  } catch {
    // A missing ResizeObserver only costs automatic reflow; the
    // caller still re-syncs on window resize.
    observer = null;
  }

  return {
    chart,
    series,

    setLinePrice(kind, price) {
      const line = priceLines.get(kind);
      const value = Number(price);

      if (disposed || !line || !Number.isFinite(value) || value <= 0) {
        return false;
      }

      line.applyOptions({ price: value });

      prices.set(kind, value);

      return true;
    },

    getLinePrice(kind) {
      return prices.get(kind) ?? null;
    },

    // Price -> pixel, asked fresh every time. Never cached.
    priceToY(price) {
      if (disposed || !Number.isFinite(price)) return null;

      const coordinate = series.priceToCoordinate(price);

      return Number.isFinite(coordinate) ? coordinate : null;
    },

    // Pixel -> price for a drag. Null when the pane cannot answer.
    yToPrice(y) {
      if (disposed || !Number.isFinite(y)) return null;

      const price = series.coordinateToPrice(y);

      return Number.isFinite(price) ? price : null;
    },

    getVisibleRange() {
      if (disposed) return null;

      return chart.timeScale().getVisibleRange() || null;
    },

    // Used while a handle is being dragged so the chart cannot pan
    // or zoom underneath the pointer. Always restored on pointerup,
    // pointercancel, error and unmount.
    setInteractionEnabled(enabled) {
      if (disposed) return false;

      try {
        chart.applyOptions(interactionOptions(!!enabled));
      } catch {
        return false;
      }

      return true;
    },

    resize,

    dispose() {
      if (disposed) return;

      disposed = true;

      try {
        observer?.disconnect();
      } catch {
        // Observer already gone.
      }

      priceLines.clear();
      prices.clear();

      try {
        chart.remove();
      } catch {
        // Chart already removed.
      }
    },

    get isDisposed() {
      return disposed;
    },
  };
}
