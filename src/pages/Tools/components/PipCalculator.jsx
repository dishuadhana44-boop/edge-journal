import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PipCalculator() {
  const navigate = useNavigate();

  const [symbolType, setSymbolType] = useState("Forex");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [lotSize, setLotSize] = useState(1);
  const [pipValue, setPipValue] = useState(10);

  const result = useMemo(() => {
    const entry = Number(entryPrice);
    const exit = Number(exitPrice);
    const lots = Number(lotSize);
    const valuePerPip = Number(pipValue);

    if (
      !Number.isFinite(entry) ||
      !Number.isFinite(exit) ||
      !Number.isFinite(lots) ||
      !Number.isFinite(valuePerPip) ||
      entry <= 0 ||
      exit <= 0 ||
      lots <= 0 ||
      valuePerPip <= 0
    ) {
      return {
        pipDistance: 0,
        totalPipValue: 0,
        estimatedPnL: 0,
        valid: false,
      };
    }

    const pipSize =
      symbolType === "JPY" ? 0.01 : 0.0001;

    const pipDistance =
      Math.abs(exit - entry) / pipSize;

    const totalPipValue = valuePerPip * lots;

    const estimatedPnL =
      pipDistance * totalPipValue;

    return {
      pipDistance,
      totalPipValue,
      estimatedPnL,
      valid: true,
    };
  }, [
    symbolType,
    entryPrice,
    exitPrice,
    lotSize,
    pipValue,
  ]);

  const reset = () => {
    setSymbolType("Forex");
    setEntryPrice("");
    setExitPrice("");
    setLotSize(1);
    setPipValue(10);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b0b] px-6 py-3">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/tools")}
            className="
              w-9 h-9 rounded-xl
              border border-gray-200 dark:border-gray-800
              bg-white dark:bg-[#151515]
              flex items-center justify-center
              text-gray-600 dark:text-gray-300
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
              Pip Calculator
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Calculate pip distance and estimated pip value.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="
            flex items-center gap-2
            h-9 px-3 rounded-xl
            border border-gray-200 dark:border-gray-800
            bg-white dark:bg-[#151515]
            text-sm font-medium
            text-gray-600 dark:text-gray-300
            hover:text-purple-600
            transition
          "
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      {/* MAIN */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* INPUTS */}
        <div className="xl:col-span-2 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Pip Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* SYMBOL TYPE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pair Type
              </label>

              <select
                value={symbolType}
                onChange={(e) =>
                  setSymbolType(e.target.value)
                }
                className="
                  w-full h-11 px-3 rounded-xl
                  border border-gray-300 dark:border-gray-700
                  bg-white dark:bg-[#101010]
                  text-gray-900 dark:text-white
                  outline-none
                  focus:ring-2 focus:ring-violet-500
                "
              >
                <option value="Forex">
                  Standard Forex
                </option>
                <option value="JPY">
                  JPY Pair
                </option>
              </select>
            </div>

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

            {/* LOT SIZE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Lot Size
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={lotSize}
                onChange={(e) =>
                  setLotSize(e.target.value)
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

            {/* PIP VALUE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pip Value / Standard Lot
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={pipValue}
                onChange={(e) =>
                  setPipValue(e.target.value)
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

          {/* PIP SIZE */}
          <div className="mt-6 rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pip Size
            </p>

            <p className="text-xl font-bold text-violet-600 mt-1">
              {symbolType === "JPY"
                ? "0.01"
                : "0.0001"}
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {symbolType === "JPY"
                ? "JPY pairs use 0.01 per pip."
                : "Standard forex pairs use 0.0001 per pip."}
            </p>
          </div>
        </div>

        {/* RESULTS */}
        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Pip Result
          </h2>

          <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pip Distance
            </p>

            <p className="text-4xl font-bold text-violet-600 mt-1">
              {result.valid
                ? result.pipDistance.toFixed(1)
                : "—"}
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Pips
            </p>
          </div>

          <div className="mt-5">
            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Lot Size
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? Number(lotSize).toFixed(2)
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pip Value / Lot
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `$${Number(pipValue).toFixed(2)}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Value / Pip
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `$${result.totalPipValue.toFixed(2)}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Estimated P&L
              </span>

              <span className="text-sm font-semibold text-green-600">
                {result.valid
                  ? `$${result.estimatedPnL.toFixed(2)}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Pip Calculation
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Pip distance is calculated from the difference between
          entry and exit prices divided by the applicable pip size.
          Actual pip value can vary by currency pair, account
          currency, contract size and broker specifications.
        </p>
      </div>
    </div>
  );
}