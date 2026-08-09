import useOrder from "./context/useOrder";
import { useTrade } from "../../../context/TradeContext";

export default function RiskSection() {
  const {

    risk,
    setRisk,

    riskAmount,

    rewardAmount,

    riskPips,

    rewardPips,

    rr,

    side,

    entry,

    sl,

    tp,

    orderType,

    lotSize,

} = useOrder();

const {
  executeTrade,
  addPendingOrder,
} = useTrade();

const handleExecuteTrade = () => {

  const trade = {

    symbol: "EURUSD",

    side,

    entry,

    stopLoss: sl,

    takeProfit: tp,

    quantity: lotSize,

    risk,

    orderType,

  };

  if (orderType === "Market") {

    executeTrade(trade);

  } else {

    addPendingOrder(trade);

  }

};
console.log("Risk Side:", side);
  return (
    <div className="px-4 pt-5">

      {/* Top Inputs */}

      <div className="grid grid-cols-2 gap-3">

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Risk per Trade
          </label>

          <input
  type="number"
  min="0.25"
  max="10"
  step="0.25"
  value={risk}
  onChange={(e) => setRisk(e.target.value)}
  className="
    w-full
    rounded-lg
    border
    border-gray-200
    px-3
    py-2
    text-sm
    focus:border-violet-500
    focus:ring-2
    focus:ring-violet-100
    outline-none
  "
/>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Lots
          </label>

          <input
            value={lotSize.toFixed(2)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
            readOnly
          />
        </div>

      </div>

      {/* Auto Calculation */}

      <div className="flex justify-end mt-2">

       

      </div>

      {/* RR */}

      <div className="mt-4 text-xs text-gray-800">
       R:R 1 : {Number(rr.toFixed(2))}
      </div>

      {/* Risk Return Card */}

      <div className="mt-2 flex rounded-xl overflow-hidden border border-gray-200">

        <div className="flex-1 bg-red-50 px-4 py-3">

        <div className="text-red-500 text-xs font-medium">
  Risk {Number(risk).toFixed(0)}%
</div>

<div className="mt-1 text-red-600 font-bold text-lg">
-${riskAmount.toFixed(2)}
</div>

        </div>

        <div className="w-px bg-gray-200"></div>

        <div className="flex-1 bg-emerald-50 px-4 py-3 text-right">

        <div className="text-emerald-500 text-xs font-medium">
  Reward {(risk * rr).toFixed(2).replace(/\.00$/, "")}%
</div>

<div className="mt-1 text-emerald-600 font-bold text-lg">
+${rewardAmount.toFixed(2)}
</div>

        </div>

      </div>

      {/* Execute Button */}

      <button
      
      onClick={handleExecuteTrade}
      className={`
        mt-4
        w-full
        rounded-xl
        text-white
        font-semibold
        py-3
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:shadow-lg
        ${
          side === "buy"
            ? "bg-emerald-500 hover:bg-emerald-600"
            : "bg-red-500 hover:bg-red-600"
        }
      `}
      >
        {side === "buy" ? "Buy" : "Sell"} {lotSize.toFixed(2)} Lots @ {entry}
      </button>

    </div>
  );
}