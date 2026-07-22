import {
    Zap,
    Info,
    ChevronsRight,
    PlayCircle,
    
  } from "lucide-react";
  import { useUI } from "../../../context/UIContext";


  
  export default function TradingHeader() {
    const {
      orderOpen,
      setOrderOpen,
    
      quickOrderOpen,
      setQuickOrderOpen,
    
    } = useUI();
  
    return (
        <div className="flex items-center justify-between mb-0">
  
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Trading
          </h1>
  
          <p className="text-gray-500">
            Real Time Charts.
          </p>
        </div>
  
        {/* RIGHT */}
        <div className="flex items-center gap-3">
  
          {/* Balance */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
              Balance
              <Info size={11} />
            </div>
  
            <span className="text-[14px] font-semibold text-black">
              $100,158.75
            </span>
          </div>
  
          <div className="h-10 w-px bg-gray-200" />
  
          {/* Open PnL */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
              Open P&L
              <Info size={11} />
            </div>
  
            <span className="text-[14px] font-semibold text-emerald-500">
              +$46.55
            </span>
          </div>
  
          <div className="h-10 w-px bg-gray-200" />
  
          {/* Equity */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
              Equity
              <Info size={11} />
            </div>
  
            <span className="text-[14px] font-semibold text-black">
              $100,205.30
            </span>
          </div>
  
        {/* Quick Action */}
        <button
  onClick={() => setQuickOrderOpen(true)}
  className="
    w-8
    h-8

    rounded-xl

    bg-violet-600

    hover:bg-violet-700

    flex
    items-center
    justify-center

    transition-all
    duration-200

    hover:-translate-y-1
    hover:shadow-lg
  "
>
  <Zap
    className="w-4 h-4 text-white"
    strokeWidth={2}
  />
</button>

{/* Trade */}
<button
  onClick={() => setOrderOpen(true)}
  className="
    h-9
    px-6
    rounded-xl
    bg-emerald-500
    hover:bg-emerald-600
    text-white
    text-[14px]
    font-semibold
    transition-all
    duration-200
    hover:-translate-y-[2px]
    hover:shadow-md
  "
>
Trade
</button>

{/* Pre-Market Routine */}
<button
  className="
    h-9
    px-5

    flex
    items-center
    gap-2

    rounded-xl

    bg-violet-600
    hover:bg-violet-700

    text-white
    text-[14px]
    font-semibold

    transition-all
    duration-200

    hover:-translate-y-[2px]
    hover:shadow-md
  "
>
  <PlayCircle size={16} />
  Pre-Market Routine
</button>

{/* Collapse */}
<button
  className="
    w-10
    h-10
    rounded-xl
    flex
    items-center
    justify-center
    text-gray-500
    transition-all
    duration-200
    hover:bg-gray-100
    hover:text-black
    hover:-translate-y-[2px]
    hover:shadow-sm
  "
>
  <ChevronsRight className="w-5 h-5" />
</button>
  
        </div>
  
      </div>
    );
  }