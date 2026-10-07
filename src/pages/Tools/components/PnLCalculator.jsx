import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PnLCalculator() {
  const navigate = useNavigate();

  const [direction, setDirection] = useState("Long");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [commission, setCommission] = useState(0);

  const result = useMemo(() => {
    const entry = Number(entryPrice);
    const exit = Number(exitPrice);
    const qty = Number(quantity);
    const fees = Number(commission);

    if (
      !Number.isFinite(entry) ||
      !Number.isFinite(exit) ||
      !Number.isFinite(qty) ||
      !Number.isFinite(fees) ||
      entry <= 0 ||
      exit <= 0 ||
      qty <= 0 ||
      fees < 0
    ) {
      return {
        grossPnL: 0,
        netPnL: 0,
        priceDifference: 0,
        returnPercent: 0,
        valid: false,
      };
    }

    const priceDifference =
      direction === "Long"
        ? exit - entry
        : entry - exit;

    const grossPnL = priceDifference * qty;
    const netPnL = grossPnL - fees;

    const investedAmount = entry * qty;

    const returnPercent =
      investedAmount > 0
        ? (netPnL / investedAmount) * 100
        : 0;

    return {
      grossPnL,
      netPnL,
      priceDifference,
      returnPercent,
      valid: true,
    };
  }, [
    direction,
    entryPrice,
    exitPrice,
    quantity,
    commission,
  ]);

  const reset = () => {
    setDirection("Long");
    setEntryPrice("");
    setExitPrice("");
    setQuantity(1);
    setCommission(0);
  };

  const isProfit = result.netPnL > 0;
  const isLoss = result.netPnL < 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b0b] px-6 py-3">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/tools")}
            className="
              w-9 h-9
              rounded-xl
              border
              border-gray-200
              dark:border-gray-800
              bg-white
              dark:bg-[#151515]
              flex
              items-center
              justify-center
              text-gray-600
              dark:text-gray-300
              hover:text-purple-600
              hover:border-purple-300
              transition
            "
          >
            <ArrowLeft size={18} />
          </button>

          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Calculator
              size={20}
              className="text-violet-600"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              P&L Calculator
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Calculate your potential profit or loss from a trade.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="
            flex
            items-center
            gap-2
            h-9
            px-3
            rounded-xl
            border
            border-gray-200
            dark:border-gray-800
            bg-white
            dark:bg-[#151515]
            text-sm
            font-medium
            text-gray-600
            dark:text-gray-300
            hover:text-purple-600
            transition
          "
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* INPUTS */}
        <div className="xl:col-span-2 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Trade Parameters
          </h2>

          {/* DIRECTION */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Trade Direction
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection("Long")}
                className={`
                  h-11 rounded-xl border
                  flex items-center justify-center gap-2
                  text-sm font-semibold transition
                  ${
                    direction === "Long"
                      ? "border-green-400 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400"
                  }
                `}
              >
                <TrendingUp size={17} />
                Long / Buy
              </button>

              <button
                type="button"
                onClick={() => setDirection("Short")}
                className={`
                  h-11 rounded-xl border
                  flex items-center justify-center gap-2
                  text-sm font-semibold transition
                  ${
                    direction === "Short"
                      ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400"
                  }
                `}
              >
                <TrendingDown size={17} />
                Short / Sell
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ENTRY */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Entry Price
              </label>

              <input
                type="number"
                step="any"
                placeholder="e.g. 1.15350"
                value={entryPrice}
                onChange={(e) =>
                  setEntryPrice(e.target.value)
                }
                className="
                  w-full h-11 px-3 rounded-xl
                  border border-gray-300 dark:border-gray-700
                  bg-white dark:bg-[#101010]
                  text-gray-900 dark:text-white
                  outline-none
                  focus:ring-2 focus:ring-violet-500
                "
              />
            </div>

            {/* EXIT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Exit Price
              </label>

              <input
                type="number"
                step="any"
                placeholder="e.g. 1.16250"
                value={exitPrice}
                onChange={(e) =>
                  setExitPrice(e.target.value)
                }
                className="
                  w-full h-11 px-3 rounded-xl
                  border border-gray-300 dark:border-gray-700
                  bg-white dark:bg-[#101010]
                  text-gray-900 dark:text-white
                  outline-none
                  focus:ring-2 focus:ring-violet-500
                "
              />
            </div>

            {/* QUANTITY */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantity / Units
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value)
                }
                className="
                  w-full h-11 px-3 rounded-xl
                  border border-gray-300 dark:border-gray-700
                  bg-white dark:bg-[#101010]
                  text-gray-900 dark:text-white
                  outline-none
                  focus:ring-2 focus:ring-violet-500
                "
              />
            </div>

            {/* COMMISSION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Commission / Fees
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={commission}
                onChange={(e) =>
                  setCommission(e.target.value)
                }
                className="
                  w-full h-11 px-3 rounded-xl
                  border border-gray-300 dark:border-gray-700
                  bg-white dark:bg-[#101010]
                  text-gray-900 dark:text-white
                  outline-none
                  focus:ring-2 focus:ring-violet-500
                "
              />
            </div>
          </div>
        </div>

        {/* RESULT */}
        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Trade Result
          </h2>

          <div
            className={`
              rounded-xl p-5
              ${
                isProfit
                  ? "bg-green-50 dark:bg-green-900/20"
                  : isLoss
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "bg-gray-50 dark:bg-gray-900/30"
              }
            `}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Net P&L
            </p>

            <p
              className={`
                text-4xl font-bold mt-1
                ${
                  isProfit
                    ? "text-green-600"
                    : isLoss
                    ? "text-red-600"
                    : "text-gray-700 dark:text-gray-300"
                }
              `}
            >
              {result.valid
                ? `${result.netPnL >= 0 ? "+" : "-"}$${Math.abs(
                    result.netPnL
                  ).toFixed(2)}`
                : "—"}
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {result.valid
                ? isProfit
                  ? "Profitable trade"
                  : isLoss
                  ? "Losing trade"
                  : "Break-even trade"
                : "Enter trade values"}
            </p>
          </div>

          <div className="mt-5">
            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Direction
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {direction}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Price Difference
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? result.priceDifference.toFixed(5)
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Gross P&L
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `$${result.grossPnL.toFixed(2)}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Fees
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `$${Number(commission).toFixed(2)}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Return
              </span>

              <span
                className={`
                  text-sm font-semibold
                  ${
                    result.returnPercent > 0
                      ? "text-green-600"
                      : result.returnPercent < 0
                      ? "text-red-600"
                      : "text-gray-900 dark:text-white"
                  }
                `}
              >
                {result.valid
                  ? `${result.returnPercent.toFixed(2)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BREAKDOWN */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          P&L Breakdown
        </h3>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Understand how your trade result is calculated.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Gross P&L
            </p>

            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {result.valid
                ? `$${result.grossPnL.toFixed(2)}`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Trading Costs
            </p>

            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {result.valid
                ? `$${Number(commission).toFixed(2)}`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Net P&L
            </p>

            <p
              className={`
                text-xl font-bold mt-1
                ${
                  result.netPnL > 0
                    ? "text-green-600"
                    : result.netPnL < 0
                    ? "text-red-600"
                    : "text-gray-900 dark:text-white"
                }
              `}
            >
              {result.valid
                ? `$${result.netPnL.toFixed(2)}`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          P&L Calculation
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          For a long trade, profit is calculated from Exit Price
          minus Entry Price. For a short trade, Entry Price minus
          Exit Price is used. Trading fees are then deducted to
          calculate your net P&L.
        </p>
      </div>
    </div>
  );
}