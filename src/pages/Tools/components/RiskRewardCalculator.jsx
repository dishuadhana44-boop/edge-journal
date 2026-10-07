import { useMemo, useState } from "react";
import {
  ArrowLeft,
  RotateCcw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RiskRewardCalculator() {
  const navigate = useNavigate();

  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [quantity, setQuantity] = useState(1);

  const result = useMemo(() => {
    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const qty = Number(quantity);

    if (
      !Number.isFinite(entry) ||
      !Number.isFinite(sl) ||
      !Number.isFinite(tp) ||
      !Number.isFinite(qty) ||
      entry <= 0 ||
      sl <= 0 ||
      tp <= 0 ||
      qty <= 0
    ) {
      return {
        riskPerUnit: 0,
        rewardPerUnit: 0,
        totalRisk: 0,
        totalReward: 0,
        ratio: 0,
        valid: false,
        direction: "",
      };
    }

    const isLong = tp > entry && sl < entry;
    const isShort = tp < entry && sl > entry;

    if (!isLong && !isShort) {
      return {
        riskPerUnit: 0,
        rewardPerUnit: 0,
        totalRisk: 0,
        totalReward: 0,
        ratio: 0,
        valid: false,
        direction: "",
      };
    }

    const riskPerUnit = Math.abs(entry - sl);
    const rewardPerUnit = Math.abs(tp - entry);

    const totalRisk = riskPerUnit * qty;
    const totalReward = rewardPerUnit * qty;

    const ratio =
      riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;

    return {
      riskPerUnit,
      rewardPerUnit,
      totalRisk,
      totalReward,
      ratio,
      valid: true,
      direction: isLong ? "Long" : "Short",
    };
  }, [entryPrice, stopLoss, takeProfit, quantity]);

  const reset = () => {
    setEntryPrice("");
    setStopLoss("");
    setTakeProfit("");
    setQuantity(1);
  };

  const getRatioStatus = () => {
    if (!result.valid) return "Enter valid trade levels";
    if (result.ratio >= 3) return "Excellent Risk / Reward";
    if (result.ratio >= 2) return "Strong Risk / Reward";
    if (result.ratio >= 1.5) return "Good Risk / Reward";
    if (result.ratio >= 1) return "Acceptable Risk / Reward";
    return "Poor Risk / Reward";
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
            <Scale
              size={20}
              className="text-violet-600"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Risk / Reward Calculator
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Measure potential reward against the amount you risk.
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

      {/* MAIN */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* INPUTS */}
        <div className="xl:col-span-2 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Trade Parameters
          </h2>

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

            {/* STOP LOSS */}
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

            {/* TAKE PROFIT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Take Profit
              </label>

              <input
                type="number"
                step="any"
                placeholder="e.g. 1.16250"
                value={takeProfit}
                onChange={(e) =>
                  setTakeProfit(e.target.value)
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
                step="0.01"
                min="0"
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
          </div>

          {/* TRADE DIRECTION */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Trade Direction
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                className={`
                  rounded-xl
                  border
                  p-4
                  ${
                    result.direction === "Long"
                      ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                      : "border-gray-200 dark:border-gray-800"
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp
                    size={18}
                    className="text-green-600"
                  />

                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Long
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Take profit above entry and stop loss below entry.
                </p>
              </div>

              <div
                className={`
                  rounded-xl
                  border
                  p-4
                  ${
                    result.direction === "Short"
                      ? "border-red-400 bg-red-50 dark:bg-red-900/10"
                      : "border-gray-200 dark:border-gray-800"
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <TrendingDown
                    size={18}
                    className="text-red-600"
                  />

                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Short
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Take profit below entry and stop loss above entry.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RESULT */}
        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Risk / Reward
          </h2>

          <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Risk / Reward Ratio
            </p>

            <p className="text-4xl font-bold text-violet-600 mt-1">
              {result.valid
                ? `1 : ${result.ratio.toFixed(2)}`
                : "—"}
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {getRatioStatus()}
            </p>
          </div>

          <div className="space-y-1 mt-5">
            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Direction
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.direction || "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Risk / Unit
              </span>

              <span className="text-sm font-semibold text-red-600">
                {result.valid
                  ? result.riskPerUnit.toFixed(5)
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Reward / Unit
              </span>

              <span className="text-sm font-semibold text-green-600">
                {result.valid
                  ? result.rewardPerUnit.toFixed(5)
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Risk
              </span>

              <span className="text-sm font-semibold text-red-600">
                {result.valid
                  ? result.totalRisk.toFixed(2)
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Reward
              </span>

              <span className="text-sm font-semibold text-green-600">
                {result.valid
                  ? result.totalReward.toFixed(2)
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* VISUAL BREAKDOWN */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Risk / Reward Breakdown
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Visual comparison of your potential loss and profit.
            </p>
          </div>

          {result.valid && (
            <span
              className={`
                text-xs font-semibold px-3 py-1.5 rounded-full
                ${
                  result.ratio >= 2
                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : result.ratio >= 1
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                }
              `}
            >
              {result.ratio >= 2
                ? "High Quality"
                : result.ratio >= 1
                ? "Moderate"
                : "Low Quality"}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Risk
              </span>

              <span className="text-sm font-semibold text-red-600">
                {result.valid
                  ? result.totalRisk.toFixed(2)
                  : "—"}
              </span>
            </div>

            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-300"
                style={{
                  width:
                    result.valid
                      ? `${Math.min(
                          100,
                          (1 / Math.max(result.ratio, 1)) *
                            100
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Reward
              </span>

              <span className="text-sm font-semibold text-green-600">
                {result.valid
                  ? result.totalReward.toFixed(2)
                  : "—"}
              </span>
            </div>

            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{
                  width:
                    result.valid
                      ? `${Math.min(
                          100,
                          result.ratio * 33.33
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Risk Management
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          A 1:2 risk/reward ratio means you are risking 1 unit
          to potentially make 2 units. Always define your stop
          loss before entering a trade and make sure the setup
          supports the required reward.
        </p>
      </div>
    </div>
  );
}