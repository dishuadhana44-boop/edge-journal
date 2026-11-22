// ==========================================================
// CHART PROTOTYPE — DRAGGABLE SL/TP OVERLAY (Phase 1)
//
// THIS FILE IS A STANDALONE PROTOTYPE. It is not mounted by the
// app, not routed, and not connected to any trade, position or
// broker object. Delete the whole `prototype/` folder plus
// `chart-prototype.html` and nothing else in the app changes.
//
// How anchoring works:
//   - the lightweight-charts series draws the horizontal rule at
//     the real price (series.createPriceLine);
//   - this overlay positions a DOM handle for the same price by
//     asking series.priceToCoordinate(price) on every sync.
//
// No pixel is ever stored. Only prices live in state. When the
// user pans, zooms or resizes, the price is unchanged and the y
// is recomputed, which is exactly what keeps a line anchored.
// ==========================================================

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SYNTHETIC_LABEL,
  deriveInitialLinePrices,
  generateSyntheticCandles,
} from "./syntheticCandles.js";

import {
  PROTOTYPE_LINES,
  createPrototypeChart,
} from "./chartPrototypeController.js";

import {
  formatPriceLabel,
  pricePrecision,
  priceStep,
  resolveDragPrice,
} from "./lineGeometry.js";

// Clears the right price axis so the chip never covers the
// chart's own axis label.
const AXIS_GUTTER = 76;

const EMPTY_PRICES = { sl: null, tp: null };

export default function ChartLinePrototype() {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const initialPricesRef = useRef(null);
  const pricesRef = useRef({ ...EMPTY_PRICES });
  const anchorsRef = useRef({ ...EMPTY_PRICES });
  const dragRef = useRef(null);
  const endDragRef = useRef(null);
  const syncRef = useRef(null);

  const [phase, setPhase] = useState("booting");
  const [initError, setInitError] = useState("");
  const [prices, setPrices] = useState({ ...EMPTY_PRICES });
  const [anchors, setAnchors] = useState({ ...EMPTY_PRICES });
  const [dragging, setDragging] = useState(null);

  // ------------------------------------------------------
  // PRICE -> PIXEL (never cached, never inverted)
  // ------------------------------------------------------
  const syncAnchors = useCallback(() => {
    const controller = controllerRef.current;
    const element = containerRef.current;

    if (!controller || controller.isDisposed || !element) return;

    const height = element.clientHeight || 0;
    const next = { ...EMPTY_PRICES };

    for (const { kind } of PROTOTYPE_LINES) {
      const y = controller.priceToY(pricesRef.current[kind]);

      // Off-screen prices have no honest pixel position, so the
      // chip is hidden instead of pinned to an edge.
      if (y != null && y >= 0 && y <= height) next[kind] = y;
    }

    anchorsRef.current = next;

    setAnchors((previous) =>
      previous.sl === next.sl && previous.tp === next.tp ? previous : next
    );
  }, []);

  useEffect(() => {
    syncRef.current = syncAnchors;
  }, [syncAnchors]);

  useEffect(() => {
    pricesRef.current = prices;
    syncAnchors();
  }, [prices, syncAnchors]);

  // ------------------------------------------------------
  // DRAG LIFECYCLE (always restored)
  // ------------------------------------------------------
  const endDrag = useCallback(() => {
    const state = dragRef.current;

    if (!state) return;

    dragRef.current = null;

    window.removeEventListener("pointermove", state.onMove, true);
    window.removeEventListener("pointerup", state.onUp, true);
    window.removeEventListener("pointercancel", state.onUp, true);

    try {
      state.target?.releasePointerCapture?.(state.pointerId);
    } catch {
      // Capture already gone (pointercancel, unmount).
    }

    try {
      controllerRef.current?.setInteractionEnabled?.(true);
    } catch {
      // Chart already disposed.
    }

    setDragging(null);
    syncRef.current?.();
  }, []);

  useEffect(() => {
    endDragRef.current = endDrag;
  }, [endDrag]);

  const applyPrice = useCallback((kind, next) => {
    const controller = controllerRef.current;

    if (!controller || controller.isDisposed) return false;
    if (!controller.setLinePrice(kind, next)) return false;

    pricesRef.current = { ...pricesRef.current, [kind]: next };
    setPrices(pricesRef.current);
    syncRef.current?.();

    return true;
  }, []);

  const handlePointerDown = useCallback(
    (kind, event) => {
      if (typeof event.button === "number" && event.button !== 0) return;

      const controller = controllerRef.current;
      const element = containerRef.current;

      if (!controller || controller.isDisposed || !element) return;

      if (dragRef.current) endDrag();

      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
      const pointerId = event.pointerId;

      try {
        target?.setPointerCapture?.(pointerId);
      } catch {
        // Capture is an optimisation; window listeners still track.
      }

      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;

        moveEvent.preventDefault();

        const rect = element.getBoundingClientRect();
        const y = moveEvent.clientY - rect.top;

        const current = pricesRef.current[kind];
        const next = resolveDragPrice(y, {
          coordinateToPrice: (value) => controller.yToPrice(value),
          precision: pricePrecision(current),
        });

        if (next == null) return;

        applyPrice(kind, next);
      };

      const onUp = (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        endDrag();
      };

      dragRef.current = { kind, pointerId, target, onMove, onUp };

      // Belt and braces: the overlay already swallows the pointer,
      // but the chart must not pan/zoom if an event slips through.
      controller.setInteractionEnabled?.(false);

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);

      setDragging(kind);
    },
    [applyPrice, endDrag]
  );

  const handleKeyDown = useCallback(
    (kind, event) => {
      const direction =
        event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;

      if (!direction) return;

      event.preventDefault();

      const current = pricesRef.current[kind];

      if (!Number.isFinite(current)) return;

      const step = priceStep(current) * direction;
      const next = Number(
        (current + step).toFixed(pricePrecision(current))
      );

      if (next <= 0) return;

      applyPrice(kind, next);
    },
    [applyPrice]
  );

  // ------------------------------------------------------
  // MOUNT / DISPOSE
  // ------------------------------------------------------
  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      setPhase("error");
      setInitError("Chart container was not mounted.");
      return undefined;
    }

    const candles = generateSyntheticCandles();
    const initial = deriveInitialLinePrices(candles);

    if (initial.sl == null || initial.tp == null) {
      setPhase("error");
      setInitError("Synthetic candles did not produce valid SL/TP levels.");
      return undefined;
    }

    let controller;

    try {
      controller = createPrototypeChart({
        container: element,
        candles,
        lines: initial,
        onViewportChange: () => syncRef.current?.(),
      });
    } catch (error) {
      // Honest failure state — no fake chart, no silent fallback.
      setPhase("error");
      setInitError(
        error?.message || "The chart could not be initialised."
      );
      return undefined;
    }

    controllerRef.current = controller;
    initialPricesRef.current = { ...initial };
    pricesRef.current = { ...initial };

    setPrices({ ...initial });
    setPhase("ready");

    const timeScale = controller.chart?.timeScale?.();
    const onViewportChanged = () => syncRef.current?.();

    try {
      timeScale?.subscribeVisibleLogicalRangeChange?.(onViewportChanged);
    } catch {
      // Older/minimal chart shim: no subscription available.
    }

    try {
      timeScale?.subscribeVisibleTimeRangeChange?.(onViewportChanged);
    } catch {
      // Same as above.
    }

    // A pure vertical price-scale drag fires neither subscription,
    // so the pane's own pointer activity also triggers a re-sync.
    const onPanePointerMove = () => syncRef.current?.();

    window.addEventListener("resize", onViewportChanged);
    element.addEventListener("pointermove", onPanePointerMove, {
      passive: true,
    });
    element.addEventListener("wheel", onPanePointerMove, {
      passive: true,
    });

    const frame = window.requestAnimationFrame(() =>
      syncRef.current?.()
    );

    return () => {
      window.cancelAnimationFrame(frame);

      window.removeEventListener("resize", onViewportChanged);
      element.removeEventListener("pointermove", onPanePointerMove);
      element.removeEventListener("wheel", onPanePointerMove);

      try {
        timeScale?.unsubscribeVisibleLogicalRangeChange?.(
          onViewportChanged
        );
      } catch {
        // Chart already gone.
      }

      try {
        timeScale?.unsubscribeVisibleTimeRangeChange?.(
          onViewportChanged
        );
      } catch {
        // Chart already gone.
      }

      // Drops any in-flight drag listeners and restores the chart's
      // scroll/scale handlers before the chart is torn down.
      endDragRef.current?.();

      controller.dispose();

      controllerRef.current = null;
    };
  }, []);

  // ------------------------------------------------------
  // DEBUG HANDLE (prototype page only)
  // ------------------------------------------------------
  useEffect(() => {
    window.__edgefloChartPrototype = {
      get prices() {
        return { ...pricesRef.current };
      },
      get anchors() {
        return { ...anchorsRef.current };
      },
      get dragging() {
        return dragRef.current?.kind ?? null;
      },
      get chart() {
        return controllerRef.current?.chart ?? null;
      },
      getLinePrice: (kind) =>
        controllerRef.current?.getLinePrice(kind) ?? null,
      priceToY: (price) =>
        controllerRef.current?.priceToY(price) ?? null,
      yToPrice: (y) => controllerRef.current?.yToPrice(y) ?? null,
      getVisibleRange: () =>
        controllerRef.current?.getVisibleRange() ?? null,
    };

    return () => {
      delete window.__edgefloChartPrototype;
    };
  }, []);

  const handleReset = useCallback(() => {
    const controller = controllerRef.current;
    const initial = initialPricesRef.current;

    if (!controller || controller.isDisposed || !initial) return;

    const next = { ...EMPTY_PRICES };

    for (const { kind } of PROTOTYPE_LINES) {
      const price = initial[kind];

      next[kind] =
        Number.isFinite(price) && controller.setLinePrice(kind, price)
          ? price
          : pricesRef.current[kind];
    }

    pricesRef.current = next;
    setPrices(next);
    syncRef.current?.();
  }, []);

  const lastClose = (() => {
    const candles = generateSyntheticCandles();
    return candles[candles.length - 1]?.close ?? null;
  })();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 420,
        background: "#0b0c10",
        color: "#a1a1aa",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid #1f2129",
      }}
    >
      <div
        ref={containerRef}
        data-testid="prototype-chart"
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      />

      {/* Top bar: honest data label + reset */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: AXIS_GUTTER,
          display: "flex",
          alignItems: "center",
          gap: 10,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <span
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #3f3f46",
            background: "#18181bcc",
            color: "#fbbf24",
            font: "700 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace",
            letterSpacing: 0.6,
          }}
        >
          {SYNTHETIC_LABEL}
        </span>

        {lastClose != null && (
          <span style={{ font: "500 11px/1.2 ui-monospace, monospace" }}>
            last close {formatPriceLabel(lastClose)}
          </span>
        )}

        <button
          type="button"
          onClick={handleReset}
          data-testid="prototype-reset"
          style={{
            marginLeft: "auto",
            pointerEvents: "auto",
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid #3f3f46",
            background: "#18181b",
            color: "#e4e4e7",
            font: "600 11px/1.2 Inter, system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {phase === "error" ? (
        <div
          role="alert"
          data-testid="prototype-error"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 24,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <strong style={{ color: "#fca5a5", fontSize: 13 }}>
            Chart prototype could not start
          </strong>
          <span style={{ fontSize: 12, maxWidth: 360 }}>
            {initError}
          </span>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {PROTOTYPE_LINES.map((line) => {
            const y = anchors[line.kind];

            if (y == null) return null;

            const price = prices[line.kind];
            const isDragging = dragging === line.kind;

            return (
              <div
                key={line.kind}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: y,
                  height: 0,
                  pointerEvents: "none",
                }}
              >
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label={`${line.label} price`}
                  aria-valuemin={0}
                  aria-valuemax={Number.MAX_SAFE_INTEGER}
                  aria-valuenow={Number.isFinite(price) ? price : 0}
                  aria-valuetext={formatPriceLabel(price)}
                  aria-orientation="vertical"
                  data-testid={`prototype-handle-${line.kind}`}
                  data-price={Number.isFinite(price) ? price : ""}
                  onPointerDown={(event) =>
                    handlePointerDown(line.kind, event)
                  }
                  onKeyDown={(event) => handleKeyDown(line.kind, event)}
                  style={{
                    position: "absolute",
                    right: AXIS_GUTTER,
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    height: 22,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: `1px solid ${line.color}`,
                    background: isDragging ? line.color : "#12141b",
                    color: isDragging ? "#0b0c10" : "#f4f4f5",
                    font: "600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
                    cursor: isDragging ? "grabbing" : "grab",
                    pointerEvents: "auto",
                    touchAction: "none",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    boxShadow: isDragging
                      ? `0 0 0 3px ${line.color}33`
                      : "0 2px 10px #00000066",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: isDragging
                        ? "#0b0c10"
                        : line.color,
                    }}
                  />
                  <span>{line.label}</span>
                  <span data-testid={`prototype-label-${line.kind}`}>
                    {formatPriceLabel(price)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 8,
          right: AXIS_GUTTER,
          font: "500 10px/1.4 ui-monospace, monospace",
          color: "#52525b",
          pointerEvents: "none",
        }}
      >
        Drag SL / TP vertically · arrow keys nudge · chart pan,
        zoom and resize keep both lines anchored to their prices
      </div>
    </div>
  );
}
