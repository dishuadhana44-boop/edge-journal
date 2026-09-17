
import { useState, useRef } from "react";

import TradingChart from "../chart/TradingChart";
import OrderPanel from "../order-panel/OrderPanel";
import QuickOrderPanel from "../quick-order/QuickOrderPanel";
import { useUI } from "../../../context/UIContext";
import PositionsPanel from "../positions/PositionsPanel";
import TradingInsightsPanel from "../right-panel/TradingInsightsPanel";
import TradeExecutionNotification from "../../../components/trading/TradeExecutionNotification";

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
  const animationFrame = useRef(null);

  // Resize positions panel
  const startResize = (e) => {
    e.preventDefault();

    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (event) => {
      const delta = startY - event.clientY;

      let newHeight = startHeight + delta;

      if (newHeight < 0) {
        newHeight = 0;
      }

      if (newHeight > 600) {
        newHeight = 600;
      }

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }

      animationFrame.current = requestAnimationFrame(() => {
        setTerminalHeight(newHeight);
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

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
              onMouseDown={startResize}
              className="
                absolute left-0 right-0 z-30 flex cursor-row-resize
                justify-center transition-all
              "
              style={{
                bottom: `${terminalHeight}px`,
              }}
            >
              <div className="my-1 h-2 w-16 rounded-full bg-gray-400" />
            </div>

            {/* Positions terminal */}
            <div
              className="
                absolute bottom-0 left-0 right-0 z-20
                overflow-hidden border-t bg-white
              "
              style={{
                height: terminalHeight,
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