import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

function getPnL(trade) {
  const value = Number(
    trade?.pnl ??
      trade?.profit ??
      trade?.netPL ??
      trade?.netProfit ??
      trade?.netPnL ??
      0
  );

  return Number.isFinite(value) ? value : 0;
}

function getR(trade) {
  const directR = Number(
    trade?.r ??
      trade?.R ??
      trade?.netR ??
      trade?.resultR
  );

  if (Number.isFinite(directR)) {
    return directR;
  }

  const riskAmount = Number(
    trade?.riskAmount ??
      trade?.risk ??
      trade?.initialRisk ??
      0
  );

  if (Number.isFinite(riskAmount) && riskAmount > 0) {
    return getPnL(trade) / riskAmount;
  }

  return null;
}

export default function RMultipleAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const stats = useMemo(() => {
    const trades = Array.isArray(filteredTrades)
      ? filteredTrades.filter(Boolean)
      : [];

    const rValues = trades
      .map(getR)
      .filter(
        (value) =>
          value !== null &&
          Number.isFinite(value)
      );

    if (rValues.length === 0) {
      return {
        netR: 0,
        averageR: 0,
        bestR: 0,
        worstR: 0,
        winners: 0,
        losers: 0,
      };
    }

    const netR = rValues.reduce(
      (sum, value) => sum + value,
      0
    );

    const averageR = netR / rValues.length;

    const bestR = Math.max(...rValues);
    const worstR = Math.min(...rValues);

    const winners = rValues.filter(
      (value) => value > 0
    ).length;

    const losers = rValues.filter(
      (value) => value < 0
    ).length;

    return {
      netR,
      averageR,
      bestR,
      worstR,
      winners,
      losers,
    };
  }, [filteredTrades]);

  const formatR = (value) => {
    const sign = value > 0 ? "+" : "";

    return `${sign}${value.toFixed(2)}R`;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          R-Multiple Analysis
        </h3>

       
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Net R
          </p>

          <p
            className={`mt-2 text-xl font-semibold ${
              stats.netR > 0
                ? "text-green-600"
                : stats.netR < 0
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {formatR(stats.netR)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Average R
          </p>

          <p
            className={`mt-2 text-xl font-semibold ${
              stats.averageR > 0
                ? "text-green-600"
                : stats.averageR < 0
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {formatR(stats.averageR)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Best Trade
          </p>

          <p className="mt-2 text-xl font-semibold text-green-600">
            {formatR(stats.bestR)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Worst Trade
          </p>

          <p className="mt-2 text-xl font-semibold text-red-600">
            {formatR(stats.worstR)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            R Winners
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {stats.winners}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            R Losers
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {stats.losers}
          </p>
        </div>
      </div>

      {stats.netR === 0 &&
        stats.averageR === 0 &&
        stats.bestR === 0 &&
        stats.worstR === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            No realized R-multiple data is available for the selected trades.
          </div>
        )}
    </div>
  );
}