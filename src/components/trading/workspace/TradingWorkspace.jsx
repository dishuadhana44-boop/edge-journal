
import { useCallback, useRef, useState } from "react";

import TradingChart from "../chart/TradingChart";
import OrderPanel from "../order-panel/OrderPanel";
import QuickOrderPanel from "../quick-order/QuickOrderPanel";
import { useUI } from "../../../context/UIContext";
import PositionsPanel from "../positions/PositionsPanel";
import TradingInsightsPanel from "../right-panel/TradingInsightsPanel";
import TradeExecutionNotification from "../../../components/trading/TradeExecutionNotification";

// ==========================================================
// TERMINAL SWEEP
// TradingView style: the handle follows the pointer 1:1 while
// dragging (no transition), then eases into the nearest snap
// height on release, keeping the drag momentum in mind.
// ==========================================================

const SNAP_DURATION_MS = 260;
const SNAP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const TAP_THRESHOLD_PX = 4;

export default function TradingWorkspace() {
  const {
    orderOpen,
    setOrderOpen,
    quickOrderOpen,
    setQuickOrderOpen,
    rightPanel,
  } = useUI();

  // Positions terminal height
  const [terminalHeight, setTerminalHeight] = useState(0);
  const [dragging, setDragging] = useState(false);

  const chartAreaRef = useRef(null);
  const dragRef = useRef(null);
  const lastOpenHeightRef = useRef(0);

  // Snap stops are relative to the visible chart area so the
  // terminal can never swallow the whole chart.
  const getStops = useCallback(() => {
    const available =
      chartAreaRef.current?.clientHeight ??
      window.innerHeight - 55;

    const max = Math.round(Math.min(Math.max(available - 140, 240), 620));

    return [0, Math.round(max * 0.42), Math.round(max * 0.72), max];
  }, []);

  const clampHeight = useCallback(
    (value) => {
      const stops = getStops();

      return Math.min(stops[stops.length - 1], Math.max(0, value));
    },
    [getStops]
  );

  const snapHeight = useCallback(
    (value, velocity) => {
      const stops = getStops();

      // Project the release momentum (px/ms, up = growing panel)
      const projected = value + velocity * 90;

      return stops.reduce(
        (best, stop) =>
          Math.abs(projected - stop) < Math.abs(projected - best)
            ? stop
            : best,
        stops[0]
      );
    },
    [getStops]
  );

  const startResize = (event) => {
    event.preventDefault();

    const pointerId = event.pointerId;

    const now = performance.now();

    dragRef.current = {
      startY: event.clientY,
      startHeight: terminalHeight,
      lastY: event.clientY,
      lastTime: now,
      moved: 0,
      velocity: 0,
    };

    setDragging(true);

    const handleMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const drag = dragRef.current;

      if (!drag) return;

      const time = performance.now();
      const elapsed = Math.max(time - drag.lastTime, 1);

      drag.velocity = (drag.lastY - moveEvent.clientY) / elapsed;
      drag.lastY = moveEvent.clientY;
      drag.lastTime = time;

      const delta = drag.startY - moveEvent.clientY;

      drag.moved = Math.max(drag.moved, Math.abs(delta));

      setTerminalHeight(clampHeight(drag.startHeight + delta));
    };

    const handleUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);

      const drag = dragRef.current;

      dragRef.current = null;
      setDragging(false);

      if (!drag) return;

      const isTap = drag.moved < TAP_THRESHOLD_PX;

      if (isTap) {
        setTerminalHeight((current) => {
          if (current > 8) {
            lastOpenHeightRef.current = current;

            return 0;
          }

          return lastOpenHeightRef.current || getStops()[1];
        });

        return;
      }

      const released = clampHeight(
        drag.startHeight + (drag.startY - upEvent.clientY)
      );

      const target = snapHeight(released, drag.velocity);

      if (target > 0) lastOpenHeightRef.current = target;

      setTerminalHeight(target);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleTransition = dragging
    ? "none"
    : `bottom ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;

  const panelTransition = dragging
    ? "none"
    : `height ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;

  return (
    <>
      <div className="flex h-[calc(100vh-58px)] min-h-0 gap-1 overflow-hidden">
        {/* Main chart area */}
        <div
          className={`
            relative h-[calc(100vh-90px)] transition-all duration-300
            ${
              orderOpen || rightPanel === "insights"
                ? "flex-1"
                : "w-full"
            }
          `}
        >
          <div
            ref={chartAreaRef}
            className="relative overflow-hidden"
            style={{
              height: "calc(100vh - 55px)",
            }}
          >
            {/* Trading chart */}
            <div className="absolute inset-0">
              <TradingChart />
            </div>

            {/* Drag handle */}
            <div
              id="terminal-resize-handle"
              onPointerDown={startResize}
              className="
                absolute left-0 right-0 z-30 flex h-6 cursor-ns-resize
                touch-none select-none items-center justify-center
              "
              style={{
                bottom: `${terminalHeight}px`,
                transition: handleTransition,
              }}
            >
              <div
                className={`
                  h-[5px] rounded-full transition-colors duration-200
                  ${
                    dragging
                      ? "w-24 bg-purple-500"
                      : "w-16 bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500"
                  }
                `}
              />
            </div>

            {/* Positions terminal */}
            <div
              className="
                absolute bottom-0 left-0 right-0 z-20
                overflow-x-hidden overflow-y-auto border-t bg-white
              "
              style={{
                height: terminalHeight,
                transition: panelTransition,
                willChange: dragging ? "height" : "auto",
              }}
            >
              <PositionsPanel />
            </div>
          </div>

          {/* Quick order panel */}
          {quickOrderOpen && (
            <QuickOrderPanel
              setQuickOrderOpen={setQuickOrderOpen}
            />
          )}
        </div>

        {/* Order panel */}
        {orderOpen && (
          <div className="w-[300px] shrink-0">
            <OrderPanel setOrderOpen={setOrderOpen} />
          </div>
        )}

        {/* Trading insights */}
        {rightPanel === "insights" && !orderOpen && (
          <div className="h-full min-h-0 w-[300px] shrink-0">
            <TradingInsightsPanel />
          </div>
        )}
      </div>

      {/* Only one trade execution notification */}
      <TradeExecutionNotification />
    </>
  );
}
