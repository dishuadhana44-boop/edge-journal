import { useMemo, useState } from "react";
import { ArrowLeft, Calculator, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PositionSizeCalculator() {
  const navigate = useNavigate();

  const [accountBalance, setAccountBalance] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [pipValue, setPipValue] = useState(10);

  const result = useMemo(() => {
    const balance = Number(accountBalance);
    const risk = Number(riskPercent);
    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    const pip = Number(pipValue);

    if (
      !Number.isFinite(balance) ||
      !Number.isFinite(risk) ||
      !Number.isFinite(entry) ||
      !Number.isFinite(stop) ||
      !Number.isFinite(pip) ||
      balance <= 0 ||
      risk <= 0 ||
      entry <= 0 ||
      stop <= 0 ||
      pip <= 0 ||
      entry === stop
    ) {
      return {
        riskAmount: 0,
        stopDistance: 0,
        lotSize: 0,
        miniLots: 0,
        microLots: 0,
      };
    }

    const riskAmount = balance * (risk / 100);

    const pipSize =
      Math.abs(entry - stop) >= 1 ? 0.01 : 0.0001;

    const stopDistance = Math.abs(entry - stop) / pipSize;

    if (stopDistance <= 0) {
      return {
        riskAmount,
        stopDistance: 0,
        lotSize: 0,
        miniLots: 0,
        microLots: 0,
      };
    }

    const lotSize =
      riskAmount / (stopDistance * pip);

    return {
      riskAmount,
      stopDistance,
      lotSize,
      miniLots: lotSize * 10,
      microLots: lotSize * 100,
    };
  }, [
    accountBalance,
    riskPercent,
    entryPrice,
    stopLoss,
    pipValue,
  ]);

  const reset = () => {
    setAccountBalance(100000);
    setRiskPercent(1);
    setEntryPrice("");
    setStopLoss("");
    setPipValue(10);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b0b] px-6 py-3">
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
              Position Size Calculator
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Calculate the correct position size based on your risk.
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Trade Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Balance
              </label>

              <input
                type="number"
                value={accountBalance}
                onChange={(e) =>
                  setAccountBalance(e.target.value)
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Risk %
              </label>

              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) =>
                  setRiskPercent(e.target.value)
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stop Loss
              </label>

              <input
                type="number"
                step="any"
                placeholder="e.g. 1.15050"
                value={stopLoss}
                onChange={(e) =>
                  setStopLoss(e.target.value)
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pip Value / Standard Lot
              </label>

              <input
                type="number"
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
        </div>

        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Position Size
          </h2>

          <div className="space-y-4">
            <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recommended Lot Size
              </p>

              <p className="text-3xl font-bold text-violet-600 mt-1">
                {result.lotSize.toFixed(2)}
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Standard Lots
              </p>
            </div>

            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Amount at Risk
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                ${result.riskAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Stop Distance
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.stopDistance.toFixed(1)} pips
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Mini Lots
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.miniLots.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Micro Lots
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.microLots.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Risk Management
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Position sizing should be based on the amount you are willing
          to lose if your stop loss is hit. Always verify the pip value
          and contract specifications with your broker before placing
          a live trade.
        </p>
      </div>
    </div>
  );
}