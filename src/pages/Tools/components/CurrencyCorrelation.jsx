import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const PAIRS = [
  {
    symbol: "EURUSD",
    label: "EUR/USD",
    base: "EUR",
    quote: "USD",
  },
  {
    symbol: "GBPUSD",
    label: "GBP/USD",
    base: "GBP",
    quote: "USD",
  },
  {
    symbol: "USDJPY",
    label: "USD/JPY",
    base: "USD",
    quote: "JPY",
  },
  {
    symbol: "AUDUSD",
    label: "AUD/USD",
    base: "AUD",
    quote: "USD",
  },
  {
    symbol: "USDCAD",
    label: "USD/CAD",
    base: "USD",
    quote: "CAD",
  },
  {
    symbol: "USDCHF",
    label: "USD/CHF",
    base: "USD",
    quote: "CHF",
  },
  {
    symbol: "NZDUSD",
    label: "NZD/USD",
    base: "NZD",
    quote: "USD",
  },
  {
    symbol: "XAUUSD",
    label: "XAU/USD",
    base: "XAU",
    quote: "USD",
  },
];

const LOOKBACKS = {
  "1D": 1,
  "5D": 5,
  "20D": 20,
  "60D": 60,
};

const TIMEFRAMES = {
  M15: {
    label: "15 Minutes",
    barsPerDay: 96,
  },
  H1: {
    label: "1 Hour",
    barsPerDay: 24,
  },
  H4: {
    label: "4 Hours",
    barsPerDay: 6,
  },
  D1: {
    label: "Daily",
    barsPerDay: 1,
  },
};

function getRequiredBars(lookback, timeframe) {
  const barsPerDay =
    TIMEFRAMES[timeframe]?.barsPerDay || 24;

  const days =
    LOOKBACKS[lookback] || 20;

  return Math.max(
    days * barsPerDay + 5,
    20
  );
}

function calculateReturns(candles) {
  if (!Array.isArray(candles)) {
    return [];
  }

  const sorted = [...candles]
    .filter(
      (candle) =>
        Number.isFinite(Number(candle?.time)) &&
        Number.isFinite(Number(candle?.close))
    )
    .sort(
      (a, b) =>
        Number(a.time) -
        Number(b.time)
    );

  const returns = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previousClose = Number(
      sorted[index - 1].close
    );

    const currentClose = Number(
      sorted[index].close
    );

    if (
      !Number.isFinite(previousClose) ||
      !Number.isFinite(currentClose) ||
      previousClose <= 0 ||
      currentClose <= 0
    ) {
      continue;
    }

    returns.push({
      time: Number(
        sorted[index].time
      ),
      value:
        (currentClose -
          previousClose) /
        previousClose,
    });
  }

  return returns;
}

function pearsonCorrelation(
  first,
  second
) {
  if (
    !Array.isArray(first) ||
    !Array.isArray(second)
  ) {
    return 0;
  }

  const secondMap = new Map(
    second.map((item) => [
      item.time,
      item.value,
    ])
  );

  const paired = first
    .filter((item) =>
      secondMap.has(item.time)
    )
    .map((item) => [
      item.value,
      secondMap.get(item.time),
    ])
    .filter(
      ([x, y]) =>
        Number.isFinite(x) &&
        Number.isFinite(y)
    );

  if (paired.length < 3) {
    return 0;
  }

  const meanX =
    paired.reduce(
      (sum, [x]) => sum + x,
      0
    ) / paired.length;

  const meanY =
    paired.reduce(
      (sum, [, y]) => sum + y,
      0
    ) / paired.length;

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (const [x, y] of paired) {
    const differenceX =
      x - meanX;

    const differenceY =
      y - meanY;

    numerator +=
      differenceX *
      differenceY;

    denominatorX +=
      differenceX *
      differenceX;

    denominatorY +=
      differenceY *
      differenceY;
  }

  const denominator =
    Math.sqrt(
      denominatorX *
        denominatorY
    );

  if (
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return 0;
  }

  const correlation =
    numerator / denominator;

  return Math.max(
    -1,
    Math.min(1, correlation)
  );
}

function getCorrelationLabel(value) {
  if (value >= 0.8) {
    return "Very Strong Positive";
  }

  if (value >= 0.6) {
    return "Strong Positive";
  }

  if (value >= 0.3) {
    return "Moderate Positive";
  }

  if (value > -0.3) {
    return "Neutral";
  }

  if (value > -0.6) {
    return "Moderate Negative";
  }

  if (value > -0.8) {
    return "Strong Negative";
  }

  return "Very Strong Negative";
}

function getCorrelationColor(value) {
  if (value >= 0.6) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (value >= 0.3) {
    return "bg-green-50 text-green-700";
  }

  if (value > -0.3) {
    return "bg-gray-50 text-gray-700";
  }

  if (value > -0.6) {
    return "bg-orange-50 text-orange-700";
  }

  return "bg-red-50 text-red-700";
}

function formatCorrelation(value) {
  return Number(value || 0).toFixed(2);
}

function getPairLabel(symbol) {
  return (
    PAIRS.find(
      (pair) =>
        pair.symbol === symbol
    )?.label || symbol
  );
}

function getMatrixCellColor(value) {
  if (value >= 0.8) {
    return "bg-emerald-500 text-white";
  }

  if (value >= 0.6) {
    return "bg-emerald-300 text-emerald-950";
  }

  if (value >= 0.3) {
    return "bg-green-100 text-green-900";
  }

  if (value > -0.3) {
    return "bg-gray-100 text-gray-800";
  }

  if (value > -0.6) {
    return "bg-orange-100 text-orange-900";
  }

  if (value > -0.8) {
    return "bg-red-300 text-red-950";
  }

  return "bg-red-500 text-white";
}

function getInterpretation(
  selectedPair,
  comparedPair,
  correlation
) {
  const selectedLabel =
    getPairLabel(selectedPair);

  const comparedLabel =
    getPairLabel(comparedPair);

  if (correlation >= 0.8) {
    return `${selectedLabel} and ${comparedLabel} are moving very closely together. Holding both can create concentrated exposure.`;
  }

  if (correlation >= 0.6) {
    return `${selectedLabel} and ${comparedLabel} show strong positive co-movement. Be careful about doubling similar risk.`;
  }

  if (correlation >= 0.3) {
    return `${selectedLabel} and ${comparedLabel} have moderate positive co-movement. Some diversification exists, but exposure can still overlap.`;
  }

  if (correlation <= -0.8) {
    return `${selectedLabel} and ${comparedLabel} have a very strong inverse relationship. This can be useful for hedging, but the relationship can change.`;
  }

  if (correlation <= -0.6) {
    return `${selectedLabel} and ${comparedLabel} show strong negative co-movement and may provide useful portfolio offset.`;
  }

  if (correlation <= -0.3) {
    return `${selectedLabel} and ${comparedLabel} have moderate inverse behaviour. Treat it as a potential hedge rather than a guaranteed one.`;
  }

  return `${selectedLabel} and ${comparedLabel} currently have relatively weak linear correlation.`;
}

export default function CurrencyCorrelation() {
  const navigate = useNavigate();

  const [selectedPair, setSelectedPair] =
    useState("EURUSD");

  const [comparePair, setComparePair] =
    useState("GBPUSD");

  const [lookback, setLookback] =
    useState("20D");

  const [timeframe, setTimeframe] =
    useState("H1");

  const [candles, setCandles] =
    useState({});

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const requiredBars = useMemo(
    () =>
      getRequiredBars(
        lookback,
        timeframe
      ),
    [lookback, timeframe]
  );

  const fetchCorrelationData =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const results =
          await Promise.all(
            PAIRS.map(async (pair) => {
              const response =
                await fetch(
                  `/api/mt5/candles?symbol=${encodeURIComponent(
                    pair.symbol
                  )}&timeframe=${encodeURIComponent(
                    timeframe
                  )}&count=${requiredBars}`
                );

              const data =
                await response.json();

              if (
                !response.ok ||
                !data?.success
              ) {
                throw new Error(
                  data?.message ||
                    `Failed to fetch ${pair.label}`
                );
              }

              return {
                symbol: pair.symbol,
                candles:
                  data.candles || [],
              };
            })
          );

        const nextCandles = {};

        for (const result of results) {
          nextCandles[
            result.symbol
          ] = result.candles;
        }

        setCandles(nextCandles);
        setLastUpdated(
          new Date()
        );
      } catch (fetchError) {
        console.error(
          "Currency correlation error:",
          fetchError
        );

        setError(
          fetchError?.message ||
            "Unable to fetch live MT5 correlation data."
        );
      } finally {
        setLoading(false);
      }
    }, [
      timeframe,
      requiredBars,
    ]);

  useEffect(() => {
    fetchCorrelationData();
  }, [fetchCorrelationData]);

  const returnsMap = useMemo(() => {
    const result = {};

    for (const pair of PAIRS) {
      result[pair.symbol] =
        calculateReturns(
          candles[pair.symbol]
        );
    }

    return result;
  }, [candles]);

  const correlationMatrix =
    useMemo(() => {
      const matrix = {};

      for (const firstPair of PAIRS) {
        matrix[firstPair.symbol] = {};

        for (const secondPair of PAIRS) {
          if (
            firstPair.symbol ===
            secondPair.symbol
          ) {
            matrix[firstPair.symbol][
              secondPair.symbol
            ] = 1;
            continue;
          }

          matrix[firstPair.symbol][
            secondPair.symbol
          ] = pearsonCorrelation(
            returnsMap[
              firstPair.symbol
            ] || [],
            returnsMap[
              secondPair.symbol
            ] || []
          );
        }
      }

      return matrix;
    }, [returnsMap]);

  const selectedCorrelations =
    useMemo(() => {
      return PAIRS.filter(
        (pair) =>
          pair.symbol !== selectedPair
      )
        .map((pair) => ({
          symbol: pair.symbol,
          label: pair.label,
          value:
            correlationMatrix[
              selectedPair
            ]?.[pair.symbol] ?? 0,
        }))
        .sort(
          (a, b) =>
            Math.abs(b.value) -
            Math.abs(a.value)
        );
    }, [
      selectedPair,
      correlationMatrix,
    ]);

  const strongestPositive =
    useMemo(() => {
      return [...selectedCorrelations]
        .sort(
          (a, b) =>
            b.value - a.value
        )[0] || null;
    }, [selectedCorrelations]);

  const strongestNegative =
    useMemo(() => {
      return [...selectedCorrelations]
        .sort(
          (a, b) =>
            a.value - b.value
        )[0] || null;
    }, [selectedCorrelations]);

  const selectedCorrelation =
    correlationMatrix[
      selectedPair
    ]?.[comparePair] ?? 0;

  const selectedDataCount =
    returnsMap[
      selectedPair
    ]?.length || 0;

  const compareDataCount =
    returnsMap[
      comparePair
    ]?.length || 0;

  const hasEnoughData =
    selectedDataCount >= 3 &&
    compareDataCount >= 3;

  const lastUpdatedLabel =
    lastUpdated
      ? lastUpdated.toLocaleTimeString(
          "en-IN",
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }
        )
      : "—";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-7xl mx-auto px-4 py-5">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate("/tools")
              }
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
            >
              <ArrowLeft
                size={18}
                className="text-gray-700"
              />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <BarChart3
                    size={20}
                    className="text-violet-600"
                  />
                </div>

                <h1 className="text-2xl font-bold text-gray-900">
                  Currency Correlation
                </h1>

                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  LIVE MT5
                </span>
              </div>

              <p className="text-sm text-gray-500 mt-1 ml-12">
                Real-time historical correlation analysis from your connected MT5 terminal.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchCorrelationData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>

        {/* CONTROLS */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Primary Pair
              </label>

              <select
                value={selectedPair}
                onChange={(event) =>
                  setSelectedPair(
                    event.target.value
                  )
                }
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-violet-200"
              >
                {PAIRS.map((pair) => (
                  <option
                    key={pair.symbol}
                    value={pair.symbol}
                  >
                    {pair.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Compare With
              </label>

              <select
                value={comparePair}
                onChange={(event) =>
                  setComparePair(
                    event.target.value
                  )
                }
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-violet-200"
              >
                {PAIRS.map((pair) => (
                  <option
                    key={pair.symbol}
                    value={pair.symbol}
                  >
                    {pair.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Lookback
              </label>

              <select
                value={lookback}
                onChange={(event) =>
                  setLookback(
                    event.target.value
                  )
                }
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="1D">
                  1 Day
                </option>
                <option value="5D">
                  5 Days
                </option>
                <option value="20D">
                  20 Days
                </option>
                <option value="60D">
                  60 Days
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Timeframe
              </label>

              <select
                value={timeframe}
                onChange={(event) =>
                  setTimeframe(
                    event.target.value
                  )
                }
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-violet-200"
              >
                {Object.entries(
                  TIMEFRAMES
                ).map(
                  ([
                    value,
                    config,
                  ]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {config.label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        {/* STATUS */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600">
            <Clock3
              size={15}
              className="text-gray-400"
            />
            Updated {lastUpdatedLabel}
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600">
            <BarChart3
              size={15}
              className="text-gray-400"
            />
            {timeframe} · {lookback}
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600">
            <ShieldCheck
              size={15}
              className="text-emerald-500"
            />
            {requiredBars} candles requested
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <CircleAlert
              size={19}
              className="text-red-600 mt-0.5 shrink-0"
            />

            <div>
              <p className="text-sm font-semibold text-red-800">
                Live MT5 data error
              </p>

              <p className="text-sm text-red-700 mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SELECTED COMPARISON */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Pair Comparison
                </p>

                <h2 className="text-xl font-bold text-gray-900 mt-1">
                  {getPairLabel(
                    selectedPair
                  )}{" "}
                  vs{" "}
                  {getPairLabel(
                    comparePair
                  )}
                </h2>
              </div>

              <div
                className={`px-3 py-2 rounded-xl text-sm font-semibold ${getCorrelationColor(
                  selectedCorrelation
                )}`}
              >
                {getCorrelationLabel(
                  selectedCorrelation
                )}
              </div>
            </div>

            <div className="flex items-end gap-5">
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Pearson correlation
                </p>

                <p className="text-5xl font-bold text-gray-900 tracking-tight">
                  {formatCorrelation(
                    selectedCorrelation
                  )}
                </p>
              </div>

              <div className="flex-1 pb-2">
                <div className="h-3 rounded-full bg-gradient-to-r from-red-400 via-gray-200 to-emerald-400 relative">
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-500" />

                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-900 border-2 border-white shadow"
                    style={{
                      left: `calc(${
                        ((selectedCorrelation +
                          1) /
                          2) *
                          100
                      }% - 8px)`,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-gray-400 mt-2">
                  <span>-1.00</span>
                  <span>0</span>
                  <span>+1.00</span>
                </div>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-sm text-gray-700 leading-6">
                {getInterpretation(
                  selectedPair,
                  comparePair,
                  selectedCorrelation
                )}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Data Quality
            </p>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {getPairLabel(
                    selectedPair
                  )}
                </span>

                <span className="text-sm font-semibold text-gray-900">
                  {selectedDataCount} returns
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {getPairLabel(
                    comparePair
                  )}
                </span>

                <span className="text-sm font-semibold text-gray-900">
                  {compareDataCount} returns
                </span>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {hasEnoughData ? (
                    <CheckCircle2
                      size={17}
                      className="text-emerald-500"
                    />
                  ) : (
                    <CircleAlert
                      size={17}
                      className="text-orange-500"
                    />
                  )}

                  <span className="text-sm font-medium text-gray-700">
                    {hasEnoughData
                      ? "Enough aligned data"
                      : "Limited aligned data"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EXTREMES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp
                size={18}
                className="text-emerald-600"
              />

              <h3 className="font-bold text-gray-900">
                Strongest Positive
              </h3>
            </div>

            {strongestPositive ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {
                      strongestPositive.label
                    }
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    vs{" "}
                    {getPairLabel(
                      selectedPair
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCorrelation(
                      strongestPositive.value
                    )}
                  </p>

                  <p className="text-xs text-gray-500">
                    {
                      getCorrelationLabel(
                        strongestPositive.value
                      )
                    }
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No data available.
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown
                size={18}
                className="text-red-600"
              />

              <h3 className="font-bold text-gray-900">
                Strongest Negative
              </h3>
            </div>

            {strongestNegative ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {
                      strongestNegative.label
                    }
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    vs{" "}
                    {getPairLabel(
                      selectedPair
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">
                    {formatCorrelation(
                      strongestNegative.value
                    )}
                  </p>

                  <p className="text-xs text-gray-500">
                    {
                      getCorrelationLabel(
                        strongestNegative.value
                      )
                    }
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No data available.
              </p>
            )}
          </div>
        </div>

        {/* MATRIX */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Live Correlation Matrix
              </p>

              <h2 className="text-xl font-bold text-gray-900 mt-1">
                MT5 Market Relationships
              </h2>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw
                  size={15}
                  className="animate-spin"
                />
                Updating...
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-semibold text-gray-500">
                    Pair
                  </th>

                  {PAIRS.map(
                    (pair) => (
                      <th
                        key={pair.symbol}
                        className="p-2 text-center text-xs font-semibold text-gray-500"
                      >
                        {pair.label}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {PAIRS.map(
                  (rowPair) => (
                    <tr
                      key={
                        rowPair.symbol
                      }
                    >
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPair(
                              rowPair.symbol
                            )
                          }
                          className={`text-sm font-semibold ${
                            selectedPair ===
                            rowPair.symbol
                              ? "text-violet-600"
                              : "text-gray-700"
                          }`}
                        >
                          {rowPair.label}
                        </button>
                      </td>

                      {PAIRS.map(
                        (columnPair) => {
                          const value =
                            correlationMatrix[
                              rowPair.symbol
                            ]?.[
                              columnPair.symbol
                            ] ?? 0;

                          return (
                            <td
                              key={
                                columnPair.symbol
                              }
                              className="p-0"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPair(
                                    rowPair.symbol
                                  );
                                  setComparePair(
                                    columnPair.symbol
                                  );
                                }}
                                className={`w-full h-12 rounded-lg flex items-center justify-center text-xs font-bold transition-transform hover:scale-[1.03] ${getMatrixCellColor(
                                  value
                                )}`}
                              >
                                {formatCorrelation(
                                  value
                                )}
                              </button>
                            </td>
                          );
                        }
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-5 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              Legend:
            </span>

            <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">
              Positive
            </span>

            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
              Neutral
            </span>

            <span className="px-2 py-1 rounded bg-red-100 text-red-700">
              Negative
            </span>
          </div>
        </div>

        {/* RANKING */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Relationship Ranking
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-1">
              {getPairLabel(
                selectedPair
              )} correlations
            </h2>
          </div>

          <div className="space-y-3">
            {selectedCorrelations.map(
              (item, index) => (
                <button
                  type="button"
                  key={item.symbol}
                  onClick={() =>
                    setComparePair(
                      item.symbol
                    )
                  }
                  className="w-full text-left flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition"
                >
                  <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {index + 1}
                  </span>

                  <span className="w-24 text-sm font-semibold text-gray-800">
                    {item.label}
                  </span>

                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.value >= 0
                          ? "bg-emerald-400"
                          : "bg-red-400"
                      }`}
                      style={{
                        width: `${
                          Math.abs(
                            item.value
                          ) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <span
                    className={`w-14 text-right text-sm font-bold ${
                      item.value >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCorrelation(
                      item.value
                    )}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* RISK WARNING */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <CircleAlert
              size={20}
              className="text-amber-600 mt-0.5 shrink-0"
            />

            <div>
              <h3 className="font-bold text-amber-900">
                Correlation is dynamic
              </h3>

              <p className="text-sm text-amber-800 mt-1 leading-6">
                Correlation measures historical co-movement over the selected period. It is not a guarantee that pairs will continue moving together. Use it as an exposure and risk-management tool, not as a standalone trade signal.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center text-xs text-gray-400">
          Pearson correlation is calculated from aligned MT5 candle returns using the selected timeframe and lookback.
        </div>
      </div>
    </div>
  );
}