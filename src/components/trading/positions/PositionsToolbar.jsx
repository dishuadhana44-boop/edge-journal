import {
    Search,
    Filter,
    Download,
    RefreshCw,
  } from "lucide-react";
  
  import { useTrade } from "../../../context/TradeContext";
  
  export default function PositionsToolbar() {
  
    const { openTrades } = useTrade();
  
    const floatingPnL = openTrades.reduce(
      (sum, trade) => sum + trade.pnl,
      0
    );
  
    return (
  
      <div className="border-b border-gray-200 bg-white">
  
        <div className="flex items-center justify-between px-4 py-3">
  
          <div className="flex items-center gap-6">
  
            <div>
  
              <p className="text-[11px] uppercase text-gray-400">
                Floating P/L
              </p>
  
              <p className="font-semibold text-emerald-600">
                ${floatingPnL.toFixed(2)}
              </p>
  
            </div>
  
            <div>
  
              <p className="text-[11px] uppercase text-gray-400">
                Open Trades
              </p>
  
              <p className="font-semibold">
                {openTrades.length}
              </p>
  
            </div>
  
          </div>
  
          <div className="flex items-center gap-2">
  
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <RefreshCw size={16} />
            </button>
  
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <Search size={16} />
            </button>
  
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <Filter size={16} />
            </button>
  
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <Download size={16} />
            </button>
  
          </div>
  
        </div>
  
      </div>
  
    );
  
  }