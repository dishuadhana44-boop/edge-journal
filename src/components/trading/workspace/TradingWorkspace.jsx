import { useState } from "react";

import TradingChart from "../chart/TradingChart";
import OrderPanel from "../order-panel/OrderPanel";
import QuickOrderPanel from "../quick-order/QuickOrderPanel";
import { useUI } from "../../../context/UIContext";
import PositionsPanel from "../positions/PositionsPanel";

export default function TradingWorkspace() {

  const {

    orderOpen,
    setOrderOpen,

    quickOrderOpen,
    setQuickOrderOpen,

  } = useUI();

  const [terminalHeight, setTerminalHeight] = useState(300);

  const [isDragging, setIsDragging] = useState(false);

  const startDragging = () => {

    setIsDragging(true);
  
    const handleMouseMove = (e) => {
  
      const container = document.getElementById("chart-area");
  
      if (!container) return;
  
      const rect = container.getBoundingClientRect();
  
      const newHeight = rect.bottom - e.clientY;
  
      if (newHeight >= 180 && newHeight <= 650) {
        setTerminalHeight(newHeight);
      }
  
    };
  
    const stopDragging = () => {
  
      setIsDragging(false);
  
      window.removeEventListener(
        "mousemove",
        handleMouseMove
      );
  
      window.removeEventListener(
        "mouseup",
        stopDragging
      );
  
    };
  
    window.addEventListener(
      "mousemove",
      handleMouseMove
    );
  
    window.addEventListener(
      "mouseup",
      stopDragging
    );
  
  };

  const startResize = (e) => {
    e.preventDefault();
  
    const startY = e.clientY;
    const startHeight = terminalHeight;
  
    const handleMouseMove = (event) => {
      const delta = startY - event.clientY;
  
      const newHeight = startHeight + delta;
  
      // Min & Max height
      if (newHeight >= 180 && newHeight <= 600) {
        setTerminalHeight(newHeight);
      }
    };
  
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

    return (

        <div className="flex h-full gap-4">
        
        <div
  className={`
    relative
    h-[calc(100vh-90px)]
    transition-all
    duration-300
    ${orderOpen ? "flex-1" : "w-full"}
  `}
>



  {/* Chart */}

  <div
  className="flex flex-col"
  style={{
    height: "calc(100vh - 120px)",
  }}
>

  {/* Chart */}

  <div
    style={{
      flex: 1,
    }}
  >
    <TradingChart />
  </div>

  {/* Drag Handle */}

  <div
  id="terminal-resize-handle"
  onMouseDown={startResize}
  className="
    h-2
    bg-gray-200
    hover:bg-violet-500
    cursor-row-resize
    transition
    flex
    items-center
    justify-center
    select-none
  "
>
    <div className="w-14 h-1 rounded-full bg-gray-400"></div>
  </div>

  {/* Positions */}

  <div
    style={{
      height: `${terminalHeight}px`,
    }}
    className="overflow-hidden"
  >
    <PositionsPanel />
  </div>

</div>


  {quickOrderOpen && (
    <QuickOrderPanel
      setQuickOrderOpen={setQuickOrderOpen}
    />
  )}

</div>
          {orderOpen && (
            <div className="w-[300px] shrink-0">
 <OrderPanel setOrderOpen={setOrderOpen} />
            </div>
          )}
        
        </div>
        
        );
}