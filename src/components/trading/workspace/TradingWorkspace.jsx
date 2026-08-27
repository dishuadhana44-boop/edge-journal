import { useState, useRef } from "react";

import TradingChart from "../chart/TradingChart";
import OrderPanel from "../order-panel/OrderPanel";
import QuickOrderPanel from "../quick-order/QuickOrderPanel";
import { useUI } from "../../../context/UIContext";
import PositionsPanel from "../positions/PositionsPanel";
import TradingInsightsPanel from "../right-panel/TradingInsightsPanel";


export default function TradingWorkspace() {

  const {
    orderOpen,
    setOrderOpen,
  
    quickOrderOpen,
    setQuickOrderOpen,
  
    rightPanel,
  
  } = useUI();



  const [terminalHeight, setTerminalHeight] = useState(0);

  const [isDragging, setIsDragging] = useState(false);

  const animationFrame = useRef(null);
  
 

  const startResize = (e) => {
    e.preventDefault();
  
    const startY = e.clientY;
    const startHeight = terminalHeight;
  
    const handleMouseMove = (event) => {

      const delta = startY - event.clientY;
    
      let newHeight = startHeight + delta;
    
      if (newHeight < 0) newHeight = 0;
    
      if (newHeight > 600) newHeight = 600;
    
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
    };
  
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

    return (

        <div className="flex h-full gap-1">
        
        <div
  className={`
    relative
    h-[calc(100vh-90px)]
    transition-all
    duration-300
    ${orderOpen || rightPanel === "insights" ? "flex-1" : "w-full"}
  `}
>



  {/* Chart */}

  <div
  className="relative overflow-hidden"
  style={{
    height: "calc(100vh - 55px)",
  }}
>

  {/* Chart */}

  <div className="absolute inset-0">
    <TradingChart />
</div>

  {/* Drag Handle */}

  <div
    id="terminal-resize-handle"
    onMouseDown={startResize}
    className="
        absolute
        left-0
        right-0
        cursor-row-resize
        z-30
        flex
        justify-center
        transition-all
    "
    style={{
        bottom: `${terminalHeight}px`,
    }}
>
    <div className="w-16 h-2 rounded-full bg-gray-400 my-1"></div>
</div>
  

  {/* Positions */}

  <div
    className="
        absolute
        left-0
        right-0
        bottom-0
        bg-white
        border-t
        z-20
        overflow-hidden
    "
    style={{
        height: terminalHeight,
    }}
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

{rightPanel === "insights" && !orderOpen && (
  <div className="w-[300px] shrink-0">
    <TradingInsightsPanel />
  </div>
)}
        
        </div>
        
        );
}