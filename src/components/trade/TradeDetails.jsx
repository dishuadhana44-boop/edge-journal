import { useParams } from "react-router-dom";
function TradeDetails() {
  const { id } = useParams();

const trades = JSON.parse(localStorage.getItem("trades")) || [];

const trade = trades.find((t) => t.id === Number(id));
if (!trade) {
  return (
    <div className="p-10 text-center">
      <h2 className="text-2xl font-bold">Trade Not Found</h2>
    </div>
  );
}
    return (
        <div className="w-[300px] h-[1040px] bg-white border border-gray-200 rounded-2xl overflow-hidden">
      
          {/* ================= TRADE DETAILS ================= */}
      
          <div className="px-5 py-5 border-b border-gray-200">
      
            <h2 className="text-lg font-semibold">
              Trade Details
            </h2>
      
            <div className="mt-5">
      
            <h1
  className={`text-4xl font-bold ${
    trade.pnl.toString().includes("-")
      ? "text-red-500"
      : "text-green-500"
  }`}
>
  {trade.pnl}
</h1>
      
              <p className="text-xs text-gray-400 mt-1">
                NET P&L
              </p>
      
            </div>
      
            <div className="grid grid-cols-3 gap-4 mt-7">
      
              <div>
                <p className="text-[10px] uppercase text-gray-400">
                  Instrument
                </p>
      
                <p className="font-semibold mt-1">
  {trade.pair}
</p>
              </div>
      
              <div>
                <p className="text-[10px] uppercase text-gray-400">
                  Direction
                </p>
      
                <p className="font-semibold mt-1">
  {trade.direction}
</p>
              </div>
      
              <div>
                <p className="text-[10px] uppercase text-gray-400">
                  Lot Size
                </p>
      
                <p className="font-semibold mt-1">
  {trade.lotSize || "-"}
</p>
              </div>
      
            </div>
      
          </div>
      
          {/* ================= EXECUTION ================= */}
      
          <div className="px-5 py-5 border-b border-gray-200">
      
            <h3 className="font-semibold text-sm mb-4">
              Execution
            </h3>
      
            <div className="space-y-3">
      
              
            <Row label="Date" value={new Date(trade.date).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})} />
<Row label="Session" value={trade.session} />
<Row label="Entry Time" value={trade.entryTime || "-"} />
<Row label="Exit Time" value={trade.exitTime || "-"} />
<Row label="Duration" value={trade.duration || "-"} />
<Row label="Entry Price" value={trade.entryPrice || "-"} />
<Row label="Stop Loss" value={trade.stopLoss || "-"} />
<Row label="Take Profit" value={trade.takeProfit || "-"} />
      
            </div>
      
          </div>
      
{/* ================= POSITIONS ================= */}
      
<div className="px-5 py-5">
      
      <h3 className="font-semibold text-sm mb-4">
        Position
      </h3>

      <div className="space-y-3">

      <Row label="Lot Size" value={trade.lotSize || "-"} />
      <Row label="Account" value={trade.account || "-"} />
        

      </div>

    </div>

          {/* ================= PERFORMANCE ================= */}
      
          <div className="px-5 py-5">
      
            <h3 className="font-semibold text-sm mb-4">
              Performance
            </h3>
      
            <div className="space-y-3">
      
            <Row label="Risk (R)" value={trade.riskR || "-"} />
            <Row label="Return (R)" value={trade.returnR || "-"} />
              
      
            </div>
      
          </div>
      
{/* ================= EXTRA================= */}
      
<div className="px-5 py-5">
      
      <h3 className="font-semibold text-sm mb-4">
        Extra
      </h3>

      <div className="space-y-3">

      <Row label="Trade Type" value={trade.tradeType || "-"} />
<Row label="Timeframe" value={trade.timeframe || "-"} />


      </div>

    </div>

        </div>
      );
  }
  function Row({ label, value }) {
    return (
      <div className="flex justify-between text-sm">
  
        <span className="text-gray-500">
          {label}
        </span>
  
        <span className="font-medium text-gray-900">
          {value}
        </span>
  
      </div>
    );
  }
  export default TradeDetails;