import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CompoundingCalculator() {
  const navigate = useNavigate();

  const [initialCapital, setInitialCapital] = useState(10000);
  const [returnRate, setReturnRate] = useState(5);
  const [periods, setPeriods] = useState(12);
  const [contribution, setContribution] = useState(0);
  const [frequency, setFrequency] = useState("Monthly");

  const result = useMemo(() => {
    const principal = Number(initialCapital);
    const rate = Number(returnRate) / 100;
    const count = Number(periods);
    const contributionAmount = Number(contribution);

    if (
      !Number.isFinite(principal) ||
      !Number.isFinite(rate) ||
      !Number.isFinite(count) ||
      !Number.isFinite(contributionAmount) ||
      principal < 0 ||
      count <= 0 ||
      contributionAmount < 0
    ) {
      return {
        finalValue: 0,
        totalContributions: 0,
        totalProfit: 0,
        valid: false,
        schedule: [],
      };
    }

    const periodicRate =
      frequency === "Yearly"
        ? rate
        : rate / 12;

    const schedule = [];

    let balance = principal;
    let totalContributions = principal;

    for (let i = 1; i <= count; i += 1) {
      balance *= 1 + periodicRate;

      if (contributionAmount > 0) {
        balance += contributionAmount;
        totalContributions += contributionAmount;
      }

      schedule.push({
        period: i,
        balance,
      });
    }

    const totalProfit =
      balance - totalContributions;

    return {
      finalValue: balance,
      totalContributions,
      totalProfit,
      valid: true,
      schedule,
    };
  }, [
    initialCapital,
    returnRate,
    periods,
    contribution,
    frequency,
  ]);

  const reset = () => {
    setInitialCapital(10000);
    setReturnRate(5);
    setPeriods(12);
    setContribution(0);
    setFrequency("Monthly");
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
            <TrendingUp
              size={20}
              className="text-violet-600"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Compounding Calculator
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Project how capital can grow through repeated returns and contributions.
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
            Compounding Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* INITIAL CAPITAL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Initial Capital
              </label>

              <input
                type="number"
                min="0"
                step="100"
                value={initialCapital}
                onChange={(e) =>
                  setInitialCapital(e.target.value)
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

            {/* RETURN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Return Per Period (%)
              </label>

              <input
                type="number"
                step="0.1"
                value={returnRate}
                onChange={(e) =>
                  setReturnRate(e.target.value)
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

            {/* PERIODS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Periods
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={periods}
                onChange={(e) =>
                  setPeriods(e.target.value)
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

            {/* FREQUENCY */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Compounding Frequency
              </label>

              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value)
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
                <option value="Monthly">
                  Monthly
                </option>
                <option value="Yearly">
                  Yearly
                </option>
              </select>
            </div>

            {/* CONTRIBUTION */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Contribution Per Period
              </label>

              <input
                type="number"
                min="0"
                step="100"
                value={contribution}
                onChange={(e) =>
                  setContribution(e.target.value)
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

          {/* FORMULA */}
          <div className="mt-6 rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Compounding Concept
            </p>

            <p className="text-sm font-semibold text-violet-600 mt-2">
              Returns are repeatedly applied to the growing balance.
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This calculator is a projection tool. Real trading
              returns are variable and can include losses.
            </p>
          </div>
        </div>

        {/* RESULT */}
        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Projection
          </h2>

          <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Final Balance
            </p>

            <p className="text-4xl font-bold text-violet-600 mt-1">
              {result.valid
                ? `$${result.finalValue.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`
                : "—"}
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Projected account value
            </p>
          </div>

          <div className="mt-5">
            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Initial Capital
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `$${Number(initialCapital).toLocaleString()}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Contributions
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `$${result.totalContributions.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Compounding Profit
              </span>

              <span
                className={`text-sm font-semibold ${
                  result.totalProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {result.valid
                  ? `$${result.totalProfit.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Periods
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid ? periods : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GROWTH TABLE */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Growth Projection
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Balance progression across the selected periods.
            </p>
          </div>

          <Calculator
            size={20}
            className="text-violet-600"
          />
        </div>

        {!result.valid ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter valid values to see the growth projection.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Period
                  </th>

                  <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Projected Balance
                  </th>
                </tr>
              </thead>

              <tbody>
                {result.schedule.map((item) => (
                  <tr
                    key={item.period}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                      {item.period}
                    </td>

                    <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                      $
                      {item.balance.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INFO */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Compounding & Trading
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Compounding can accelerate portfolio growth when positive
          returns are consistently reinvested. In real trading,
          however, returns are not guaranteed and drawdowns,
          losing periods, fees and changing market conditions can
          significantly affect the outcome.
        </p>
      </div>
    </div>
  );
}