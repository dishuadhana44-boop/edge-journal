import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Info,
  Link2,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const PAIRS = [
  { symbol: "EUR/USD", base: "EUR", quote: "USD" },
  { symbol: "GBP/USD", base: "GBP", quote: "USD" },
  { symbol: "AUD/USD", base: "AUD", quote: "USD" },
  { symbol: "NZD/USD", base: "NZD", quote: "USD" },
  { symbol: "USD/CAD", base: "USD", quote: "CAD" },
  { symbol: "USD/CHF", base: "USD", quote: "CHF" },
  { symbol: "USD/JPY", base: "USD", quote: "JPY" },
  { symbol: "XAU/USD", base: "XAU", quote: "USD" },
];

const LOOKBACKS = [
  { label: "1 Day", value: "1D" },
  { label: "5 Days", value: "5D" },
  { label: "20 Days", value: "20D" },
  { label: "60 Days", value: "60D" },
];

const TIMEFRAMES = ["1H", "4H", "Daily"];

const BASE_CORRELATIONS = {
  "EUR/USD": {
    "EUR/USD": 1,
    "GBP/USD": 0.84,
    "AUD/USD": 0.71,
    "NZD/USD": 0.68,
    "USD/CAD": -0.63,
    "USD/CHF": -0.82,
    "USD/JPY": -0.28,
    "XAU/USD": 0.58,
  },
  "GBP/USD": {
    "EUR/USD": 0.84,
    "GBP/USD": 1,
    "AUD/USD": 0.67,
    "NZD/USD": 0.64,
    "USD/CAD": -0.56,
    "USD/CHF": -0.74,
    "USD/JPY": -0.24,
    "XAU/USD": 0.52,
  },
  "AUD/USD": {
    "EUR/USD": 0.71,
    "GBP/USD": 0.67,
    "AUD/USD": 1,
    "NZD/USD": 0.88,
    "USD/CAD": -0.72,
    "USD/CHF": -0.58,
    "USD/JPY": 0.08,
    "XAU/USD": 0.63,
  },
  "NZD/USD": {
    "EUR/USD": 0.68,
    "GBP/USD": 0.64,
    "AUD/USD": 0.88,
    "NZD/USD": 1,
    "USD/CAD": -0.67,
    "USD/CHF": -0.53,
    "USD/JPY": 0.05,
    "XAU/USD": 0.59,
  },
  "USD/CAD": {
    "EUR/USD": -0.63,
    "GBP/USD": -0.56,
    "AUD/USD": -0.72,
    "NZD/USD": -0.67,
    "USD/CAD": 1,
    "USD/CHF": 0.49,
    "USD/JPY": 0.31,
    "XAU/USD": -0.47,
  },
  "USD/CHF": {
    "EUR/USD": -0.82,
    "GBP/USD": -0.74,
    "AUD/USD": -0.58,
    "NZD/USD": -0.53,
    "USD/CAD": 0.49,
    "USD/CHF": 1,
    "USD/JPY": 0.42,
    "XAU/USD": -0.61,
  },
  "USD/JPY": {
    "EUR/USD": -0.28,
    "GBP/USD": -0.24,
    "AUD/USD": 0.08,
    "NZD/USD": 0.05,
    "USD/CAD": 0.31,
    "USD/CHF": 0.42,
    "USD/JPY": 1,
    "XAU/USD": -0.18,
  },
  "XAU/USD": {
    "EUR/USD": 0.58,
    "GBP/USD": 0.52,
    "AUD/USD": 0.63,
    "NZD/USD": 0.59,
    "USD/CAD": -0.47,
    "USD/CHF": -0.61,
    "USD/JPY": -0.18,
    "XAU/USD": 1,
  },
};

function getAdjustedCorrelation(a, b, lookback, timeframe) {
  const base = BASE_CORRELATIONS[a]?.[b] ?? 0;

  if (a === b) return 1;

  const lookbackAdjustment = {
    "1D": 0.04,
    "5D": 0.02,
    "20D": 0,
    "60D": -0.02,
  }[lookback];

  const timeframeAdjustment = {
    "1H": 0.02,
    "4H": 0,
    Daily: -0.01,
  }[timeframe];

  const sign = base >= 0 ? 1 : -1;

  const adjusted =
    base +
    sign * (lookbackAdjustment || 0) +
    sign * (timeframeAdjustment || 0);

  return Math.max(-1, Math.min(1, Number(adjusted.toFixed(2))));
}

function getCorrelationLabel(value) {
  const abs = Math.abs(value);

  if (abs >= 0.8) return "Very Strong";
  if (abs >= 0.6) return "Strong";
  if (abs >= 0.4) return "Moderate";
  if (abs >= 0.2) return "Weak";
  return "Neutral";
}

function getCorrelationTone(value) {
  if (value >= 0.6) return "positive";
  if (value <= -0.6) return "negative";
  return "neutral";
}

function getCellClass(value) {
  if (value === 1) {
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
  }

  if (value >= 0.8) {
    return "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-200";
  }

  if (value >= 0.6) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300";
  }

  if (value >= 0.2) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (value <= -0.8) {
    return "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200";
  }

  if (value <= -0.6) {
    return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";
  }

  if (value <= -0.2) {
    return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300";
  }

  return "bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400";
}

function MetricCard({ icon: Icon, title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151515]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon size={15} />
        {title}
      </div>

      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>

      <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}

export default function CurrencyCorrelation() {
  const navigate = useNavigate();

  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [comparePair, setComparePair] = useState("GBP/USD");
  const [lookback, setLookback] = useState("20D");
  const [timeframe, setTimeframe] = useState("4H");

  const correlationMatrix = useMemo(() => {
    const matrix = {};

    PAIRS.forEach((row) => {
      matrix[row.symbol] = {};

      PAIRS.forEach((column) => {
        matrix[row.symbol][column.symbol] = getAdjustedCorrelation(
          row.symbol,
          column.symbol,
          lookback,
          timeframe
        );
      });
    });

    return matrix;
  }, [lookback, timeframe]);

  const selectedCorrelation =
    correlationMatrix[selectedPair]?.[comparePair] ?? 0;

  const strongestPositive = useMemo(() => {
    const results = [];

    PAIRS.forEach((a) => {
      PAIRS.forEach((b) => {
        if (a.symbol >= b.symbol) return;

        const value = correlationMatrix[a.symbol][b.symbol];

        if (value >= 0.5) {
          results.push({
            pairA: a.symbol,
            pairB: b.symbol,
            value,
          });
        }
      });
    });

    return results.sort((a, b) => b.value - a.value).slice(0, 3);
  }, [correlationMatrix]);

  const strongestNegative = useMemo(() => {
    const results = [];

    PAIRS.forEach((a) => {
      PAIRS.forEach((b) => {
        if (a.symbol >= b.symbol) return;

        const value = correlationMatrix[a.symbol][b.symbol];

        if (value <= -0.4) {
          results.push({
            pairA: a.symbol,
            pairB: b.symbol,
            value,
          });
        }
      });
    });

    return results.sort((a, b) => a.value - b.value).slice(0, 3);
  }, [correlationMatrix]);

  const exposureWarning =
    Math.abs(selectedCorrelation) >= 0.8
      ? selectedCorrelation > 0
        ? "Very high positive correlation. Trading both pairs can significantly increase directional exposure."
        : "Very high negative correlation. These positions may behave like opposite exposures."
      : Math.abs(selectedCorrelation) >= 0.6
        ? "Strong correlation detected. Consider combined risk before opening both trades."
        : "Correlation is moderate or low. Combined exposure is less concentrated.";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 dark:bg-[#0b0b0b]">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => navigate("/tools")}
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:border-violet-300 hover:text-violet-600 dark:border-gray-800 dark:bg-[#151515] dark:text-gray-200"
        >
          ← Back to Tools
        </button>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/15">
                <Link2
                  size={21}
                  className="text-violet-600 dark:text-violet-300"
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Currency Correlation
                </h1>

                <p className="text-sm text-gray-500">
                  Analyze pair relationships, concentration risk and hedging opportunities.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-[#151515]">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Lookback
              </div>

              <select
                value={lookback}
                onChange={(e) => setLookback(e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-800 outline-none dark:text-gray-200"
              >
                {LOOKBACKS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-[#151515]">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Timeframe
              </div>

              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-800 outline-none dark:text-gray-200"
              >
                {TIMEFRAMES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Link2}
            title="Selected Correlation"
            value={selectedCorrelation.toFixed(2)}
            subtitle={`${selectedPair} vs ${comparePair}`}
          />

          <MetricCard
            icon={
              selectedCorrelation >= 0 ? ArrowUpRight : ArrowDownRight
            }
            title="Relationship"
            value={getCorrelationLabel(selectedCorrelation)}
            subtitle={
              selectedCorrelation >= 0
                ? "Pairs generally move together"
                : "Pairs generally move opposite"
            }
          />

          <MetricCard
            icon={TrendingUp}
            title="Strongest Positive"
            value={
              strongestPositive[0]
                ? strongestPositive[0].value.toFixed(2)
                : "—"
            }
            subtitle={
              strongestPositive[0]
                ? `${strongestPositive[0].pairA} × ${strongestPositive[0].pairB}`
                : "No strong relationship"
            }
          />

          <MetricCard
            icon={TrendingDown}
            title="Strongest Negative"
            value={
              strongestNegative[0]
                ? strongestNegative[0].value.toFixed(2)
                : "—"
            }
            subtitle={
              strongestNegative[0]
                ? `${strongestNegative[0].pairA} × ${strongestNegative[0].pairB}`
                : "No strong inverse relationship"
            }
          />
        </div>

        <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#151515]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Correlation Matrix
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Pearson-style correlation scale from -1.00 to +1.00.
                </p>
              </div>

              <BarChart3
                size={19}
                className="text-gray-400"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-28 px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      Pair
                    </th>

                    {PAIRS.map((pair) => (
                      <th
                        key={pair.symbol}
                        className="px-2 py-2 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400"
                      >
                        {pair.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {PAIRS.map((row) => (
                    <tr key={row.symbol}>
                      <td className="rounded-lg px-2 py-3 text-xs font-bold text-gray-700 dark:text-gray-200">
                        {row.symbol}
                      </td>

                      {PAIRS.map((column) => {
                        const value =
                          correlationMatrix[row.symbol][column.symbol];

                        return (
                          <td
                            key={column.symbol}
                            className={`rounded-lg px-2 py-3 text-center text-xs font-bold transition ${getCellClass(
                              value
                            )}`}
                          >
                            {value.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-500/30" />
                Strong Positive
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-gray-100 dark:bg-gray-800" />
                Neutral
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-red-200 dark:bg-red-500/30" />
                Strong Negative
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#151515]">
            <div className="mb-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Pair Comparison
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Compare two instruments directly.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-500">
                  Primary Pair
                </label>

                <div className="relative">
                  <select
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 pr-9 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400 dark:border-gray-700 dark:bg-[#101010] dark:text-gray-200"
                  >
                    {PAIRS.map((pair) => (
                      <option key={pair.symbol} value={pair.symbol}>
                        {pair.symbol}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <div className="rounded-full border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-[#101010]">
                  <Link2 size={16} className="text-violet-500" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-500">
                  Comparison Pair
                </label>

                <div className="relative">
                  <select
                    value={comparePair}
                    onChange={(e) => setComparePair(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 pr-9 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400 dark:border-gray-700 dark:bg-[#101010] dark:text-gray-200"
                  >
                    {PAIRS.map((pair) => (
                      <option key={pair.symbol} value={pair.symbol}>
                        {pair.symbol}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center dark:border-gray-700 dark:bg-[#101010]">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Correlation
                </div>

                <div className="mt-2 text-4xl font-black text-gray-900 dark:text-white">
                  {selectedCorrelation.toFixed(2)}
                </div>

                <div
                  className={`mt-2 text-sm font-bold ${
                    getCorrelationTone(selectedCorrelation) === "positive"
                      ? "text-emerald-600"
                      : getCorrelationTone(selectedCorrelation) ===
                          "negative"
                        ? "text-red-600"
                        : "text-gray-500"
                  }`}
                >
                  {getCorrelationLabel(selectedCorrelation)}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mb-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#151515]">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2 dark:bg-emerald-500/15">
                <TrendingUp
                  size={18}
                  className="text-emerald-600 dark:text-emerald-300"
                />
              </div>

              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">
                  Strong Positive Correlations
                </h2>

                <p className="text-xs text-gray-500">
                  Potential double-exposure relationships
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {strongestPositive.map((item) => (
                <div
                  key={`${item.pairA}-${item.pairB}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800"
                >
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {item.pairA}
                    <span className="mx-2 text-gray-400">×</span>
                    {item.pairB}
                  </div>

                  <div className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    +{item.value.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#151515]">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-red-100 p-2 dark:bg-red-500/15">
                <TrendingDown
                  size={18}
                  className="text-red-600 dark:text-red-300"
                />
              </div>

              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">
                  Strong Negative Correlations
                </h2>

                <p className="text-xs text-gray-500">
                  Potential hedge or opposite exposure
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {strongestNegative.map((item) => (
                <div
                  key={`${item.pairA}-${item.pairB}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800"
                >
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {item.pairA}
                    <span className="mx-2 text-gray-400">×</span>
                    {item.pairB}
                  </div>

                  <div className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {item.value.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex gap-3">
            <div className="mt-0.5 shrink-0">
              <ShieldAlert
                size={20}
                className="text-amber-600 dark:text-amber-400"
              />
            </div>

            <div>
              <h2 className="font-bold text-amber-900 dark:text-amber-300">
                Exposure Risk
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-200/80">
                {exposureWarning}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#151515]">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-2 dark:bg-violet-500/15">
              <Target
                size={18}
                className="text-violet-600 dark:text-violet-300"
              />
            </div>

            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">
                Trading Interpretation
              </h2>

              <p className="text-xs text-gray-500">
                How to use correlation in your trade planning
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <TrendingUp size={16} className="text-emerald-500" />
                Positive
              </div>

              <p className="text-xs leading-5 text-gray-500">
                Pairs tend to move in the same direction. Multiple positions
                can create hidden concentration risk.
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <TrendingDown size={16} className="text-red-500" />
                Negative
              </div>

              <p className="text-xs leading-5 text-gray-500">
                Pairs tend to move in opposite directions. This can sometimes
                provide diversification or a hedge.
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <Info size={16} className="text-violet-500" />
                Neutral
              </div>

              <p className="text-xs leading-5 text-gray-500">
                Weak relationship means one pair provides less information
                about the expected movement of the other.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-5 flex items-center gap-2 text-xs text-gray-400">
          <Info size={14} />
          Correlation values in this first version are demonstration data.
          Live broker/market-data correlation will be connected next.
        </div>
      </div>
    </div>
  );
}