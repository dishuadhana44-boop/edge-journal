import { useState } from "react";
import useOrder from "./context/useOrder";

export default function PriceInputs() {

  const {
    orderType,
  
    entry,
    setEntry,
  
    sl,
    setSL,
  
    tp,
    setTP,
  } = useOrder();

  return (

    <div className="px-4 pt-5 space-y-4">

      {/* Entry */}

      <div>

      <label className="block text-xs font-medium text-gray-500 mb-1">
  {orderType === "Market"
    ? "Entry Price"
    : orderType === "Limit"
    ? "Limit Price"
    : "Stop Price"}
</label>

<input
  value={entry}
  onChange={(e) => setEntry(e.target.value)}
  placeholder={
    orderType === "Market"
      ? "Current Market Price"
      : orderType === "Limit"
      ? "Enter Limit Price"
      : "Enter Stop Price"
  }
          className="
            w-full
            rounded-xl
            border
            border-gray-200
            px-4
            py-3
            text-sm
            font-medium
            outline-none
            transition
            focus:border-violet-500
            focus:ring-2
            focus:ring-violet-100
          "
        />

      </div>

      {/* SL TP */}

      <div className="grid grid-cols-2 gap-3">

        <div>

          <label className="block text-xs font-medium text-gray-500 mb-1">
            Stop Loss
          </label>

          <input
            value={sl}
            onChange={(e)=>setSL(e.target.value)}
            className="
              w-full
              rounded-xl
              border
              border-gray-200
              px-4
              py-3
              text-sm
              outline-none
              transition
              focus:border-red-500
              focus:ring-2
              focus:ring-red-100
            "
          />

        </div>

        <div>

          <label className="block text-xs font-medium text-gray-500 mb-1">
            Take Profit
          </label>

          <input
            value={tp}
            onChange={(e)=>setTP(e.target.value)}
            className="
              w-full
              rounded-xl
              border
              border-gray-200
              px-4
              py-3
              text-sm
              outline-none
              transition
              focus:border-green-500
              focus:ring-2
              focus:ring-green-100
            "
          />

        </div>

      </div>

    </div>

  );

}