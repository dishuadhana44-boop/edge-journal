import { useState } from "react";

export default function BuySellToggle() {
  const [side, setSide] = useState("buy");

  return (
    <div className="px-4 pt-4">

      <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1">

        <button
          onClick={() => setSide("buy")}
          className={`
            py-2
            rounded-lg
            text-sm
            font-semibold
            transition-all
            duration-200
            ${
              side === "buy"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-white"
            }
          `}
        >
          Buy
        </button>

        <button
          onClick={() => setSide("sell")}
          className={`
            py-2
            rounded-lg
            text-sm
            font-semibold
            transition-all
            duration-200
            ${
              side === "sell"
                ? "bg-red-500 text-white shadow-sm"
                : "text-gray-500 hover:bg-white"
            }
          `}
        >
          Sell
        </button>

      </div>

    </div>
  );
}