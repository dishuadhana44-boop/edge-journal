import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MarginCalculator() {
  const navigate = useNavigate();

  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [price, setPrice] = useState("");
  const [lotSize, setLotSize] = useState(1);
  const [contractSize, setContractSize] = useState(100000);
  const [leverage, setLeverage] = useState(100);

  const result = useMemo(() => {
    const marketPrice = Number(price);
    const lots = Number(lotSize);
    const contract = Number(contractSize);
    const lev = Number(leverage);

    if (
      !Number.isFinite(marketPrice) ||
      !Number.isFinite(lots) ||
      !Number.isFinite(contract) ||
      !Number.isFinite(lev) ||
      marketPrice <= 0 ||
      lots <= 0 ||
      contract <= 0 ||
      lev <= 0
    ) {
      return {
        notionalValue: 0,
        marginRequired: 0,
        leveragePercent: 0,
        valid: false,
      };
    }

    const notionalValue =
      marketPrice * contract * lots;

    const marginRequired =
      notionalValue / lev;

    const leveragePercent =
      (1 / lev) * 100;

    return {
      notionalValue,
      marginRequired,
      leveragePercent,
      valid: true,
    };
  }, [
    price,
    lotSize,
    contractSize,
    leverage,
  ]);

  const reset = () => {
    setAccountCurrency("USD");
    setPrice("");
    setLotSize(1);
    setContractSize(100000);
    setLeverage(100);
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
              Margin Calculator
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estimate the margin required to open a leveraged position.
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
            Position Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* CURRENCY */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Currency
              </label>

              <select
                value={accountCurrency}
                onChange={(e) =>
                  setAccountCurrency(e.target.value)
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
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>

            {/* PRICE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Market Price
              </label>

              <input
                type="number"
                step="any"
                placeholder="e.g. 1.15350"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value)
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

            {/* CONTRACT SIZE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contract Size
              </label>

              <input
                type="number"
                min="0"
                step="1000"
                value={contractSize}
                onChange={(e) =>
                  setContractSize(e.target.value)
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

            {/* LEVERAGE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Leverage
              </label>

              <select
                value={leverage}
                onChange={(e) =>
                  setLeverage(e.target.value)
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
                <option value="10">1:10</option>
                <option value="20">1:20</option>
                <option value="30">1:30</option>
                <option value="50">1:50</option>
                <option value="100">1:100</option>
                <option value="200">1:200</option>
                <option value="500">1:500</option>
              </select>
            </div>

            {/* LEVERAGE CUSTOM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Leverage
              </label>

              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 100"
                value={leverage}
                onChange={(e) =>
                  setLeverage(e.target.value)
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
              Margin Formula
            </p>

            <p className="text-sm font-semibold text-violet-600 mt-2">
              Required Margin = Notional Value ÷ Leverage
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Higher leverage reduces the initial margin requirement,
              but it also increases the amount of exposure relative
              to your account equity.
            </p>
          </div>
        </div>

        {/* RESULT */}
        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
            Margin Requirement
          </h2>

          <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required Margin
            </p>

            <p className="text-4xl font-bold text-violet-600 mt-1">
              {result.valid
                ? `${accountCurrency} ${result.marginRequired.toFixed(2)}`
                : "—"}
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Estimated initial margin
            </p>
          </div>

          <div className="mt-5">
            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Market Price
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? Number(price).toFixed(5)
                  : "—"}
              </span>
            </div>

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
                Contract Size
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? Number(contractSize).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Leverage
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `1:${Number(leverage)}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Notional Value
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {result.valid
                  ? `${accountCurrency} ${result.notionalValue.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LEVERAGE INFO */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Margin Percentage
          </p>

          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {result.valid
              ? `${result.leveragePercent.toFixed(2)}%`
              : "—"}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Equity required relative to notional exposure.
          </p>
        </div>

        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Exposure Multiplier
          </p>

          <p className="text-2xl font-bold text-violet-600 mt-1">
            {result.valid
              ? `${Number(leverage)}x`
              : "—"}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Position exposure relative to required margin.
          </p>
        </div>

        <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Position Size
          </p>

          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {result.valid
              ? `${Number(lotSize).toFixed(2)} lots`
              : "—"}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Based on the contract size entered above.
          </p>
        </div>
      </div>

      {/* WARNING */}
      <div className="mt-5 bg-white dark:bg-[#151515] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Margin & Leverage
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Margin is the amount of account equity required to
          maintain a leveraged position. Actual margin can differ
          because brokers may apply symbol-specific contract sizes,
          conversion rates, margin tiers, hedging rules and
          other risk controls. Always verify the final requirement
          with your broker before trading.
        </p>
      </div>
    </div>
  );
}