export default function CalendarTooltip({
    index,
    trade,
  
  }) {

    const column = index % 7;
const topRow = index < 7;
  
    if (!trade) return null;
  
    return (
  
        <div
        className={`
            absolute
            z-50
            w-56
            
            ${
            topRow
            ? "top-full mt-2"
            : "bottom-full mb-2"
            }
            
            ${
            column === 0
            ? "left-0"
            
            : column === 6
            ? "right-0"
            
            : "left-1/2 -translate-x-1/2"
            }
            
            bg-white
            rounded-2xl
            shadow-2xl
            border
            border-gray-200
            p-4
            `}
        >
  
        <p className="text-xs text-gray-500">
  
          Trading Summary
  
        </p>
  
        <h3 className="font-bold mt-1">
  
          {trade.date}
  
        </h3>
  
        <div className="mt-4 space-y-2">
  
          <div className="flex justify-between">
  
            <span className="text-gray-500">
  
              P&L
  
            </span>
  
            <span
              className={
                trade.pnl >= 0
                  ? "text-green-600 font-bold"
                  : "text-red-600 font-bold"
              }
            >
  
              {trade.pnl >= 0 ? "+" : "-"}$
  
              {Math.abs(trade.pnl)}
  
            </span>
  
          </div>
  
          <div className="flex justify-between">
  
            <span className="text-gray-500">
  
              Trades
  
            </span>
  
            <span>
  
              {trade.trades}
  
            </span>
  
          </div>
  
          <div className="flex justify-between">
  
            <span className="text-gray-500">
  
              Win Rate
  
            </span>
  
            <span>
  
              80%
  
            </span>
  
          </div>
  
          <div className="flex justify-between">
  
            <span className="text-gray-500">
  
              Avg RR
  
            </span>
  
            <span>
  
              2.3R
  
            </span>
  
          </div>
  
        </div>
  
        <div
          className="
          mt-4
          text-xs
          text-violet-600
          font-semibold
          "
        >
  
          Click to Open TradeLog →
  
        </div>
  
      </div>
  
    );
  
  }