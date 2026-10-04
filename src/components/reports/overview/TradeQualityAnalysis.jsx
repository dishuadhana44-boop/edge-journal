
import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

function getPnL(trade) {
  const value = Number(
    trade?.pnl ??
      trade?.profit ??
      trade?.netPL ??
      trade?.netProfit ??
      trade?.netPnL ??
      trade?.PnL ??
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

  const pnl = getPnL(trade);

  const risk = Number(
    trade?.riskAmount ??
      trade?.risk ??
      trade?.initialRisk ??
      0
  );

  if (risk > 0) {
    return pnl / risk;
  }

  return 0;
}

function getRisk(trade) {
  const value = Number(
    trade?.riskAmount ??
      trade?.risk ??
      trade?.initialRisk ??
      0
  );

  return Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function getSetup(trade) {
  return (
    trade?.setup ??
    trade?.plan ??
    trade?.strategy ??
    trade?.setupName ??
    trade?.planName ??
    trade?.playbook ??
    "Unknown"
  );
}

function getExecutionScore(trade) {
  const value = Number(
    trade?.executionScore ??
      trade?.executionQuality ??
      trade?.execution ??
      trade?.qualityScore
  );

  return Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 100)
    : null;
}

function calculateQuality(trade) {
  const pnl = getPnL(trade);
  const r = getR(trade);
  const risk = getRisk(trade);
  const execution = getExecutionScore(trade);

  let score = 50;

  if (pnl > 0) {
    score += 15;
  } else if (pnl < 0) {
    score -= 10;
  }

  if (r >= 2) {
    score += 20;
  } else if (r >= 1) {
    score += 12;
  } else if (r > 0) {
    score += 5;
  } else if (r < -2) {
    score -= 20;
  } else if (r < 0) {
    score -= 8;
  }

  if (risk > 0) {
    score += 5;
  }

  if (execution !== null) {
    score =
      score * 0.7 +
      execution * 0.3;
  }

  return Math.min(
    Math.max(score, 0),
    100
  );
}

function getQualityLabel(score) {
  if (score >= 80) {
    return "Excellent";
  }

  if (score >= 65) {
    return "Good";
  }

  if (score >= 50) {
    return "Average";
  }

  if (score >= 35) {
    return "Weak";
  }

  return "Poor";
}

export default function TradeQualityAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const analysis = useMemo(() => {
    const trades = filteredTrades
      .filter(Boolean)
      .map((trade, index) => ({
        trade,
        index,
        pnl: getPnL(trade),
        r: getR(trade),
        risk: getRisk(trade),
        setup: getSetup(trade),
        quality: calculateQuality(trade),
      }));

    const averageQuality =
      trades.length > 0
        ? trades.reduce(
            (sum, item) =>
              sum + item.quality,
            0
          ) / trades.length
        : 0;

    const excellent = trades.filter(
      (item) => item.quality >= 80
    ).length;

    const good = trades.filter(
      (item) =>
        item.quality >= 65 &&
        item.quality < 80
    ).length;

    const average = trades.filter(
      (item) =>
        item.quality >= 50 &&
        item.quality < 65
    ).length;

    const weak = trades.filter(
      (item) =>
        item.quality >= 35 &&
        item.quality < 50
    ).length;

    const poor = trades.filter(
      (item) => item.quality < 35
    ).length;

    const highestQuality = [...trades].sort(
      (a, b) => b.quality - a.quality
    )[0];

    const lowestQuality = [...trades].sort(
      (a, b) => a.quality - b.quality
    )[0];

    return {
      trades,
      averageQuality,
      excellent,
      good,
      average,
      weak,
      poor,
      highestQuality,
      lowestQuality,
    };
  }, [filteredTrades]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Trade Quality Analysis
        </h2>

       
      </div>

      {analysis.trades.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No trade data available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Average Quality
              </div>

              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {analysis.averageQuality.toFixed(0)}
                <span className="text-sm text-gray-400">
                  /100
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Excellent
              </div>

              <div className="mt-1 text-2xl font-semibold text-green-600">
                {analysis.excellent}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Good
              </div>

              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {analysis.good}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Weak / Poor
              </div>

              <div className="mt-1 text-2xl font-semibold text-red-600">
                {analysis.weak +
                  analysis.poor}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
              <div className="text-xs text-gray-500">
                Excellent
              </div>

              <div className="mt-1 font-semibold text-green-700">
                {analysis.excellent}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="text-xs text-gray-500">
                Good
              </div>

              <div className="mt-1 font-semibold text-gray-700">
                {analysis.good}
              </div>
            </div>

            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
              <div className="text-xs text-gray-500">
                Average
              </div>

              <div className="mt-1 font-semibold text-yellow-700">
                {analysis.average}
              </div>
            </div>

            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
              <div className="text-xs text-gray-500">
                Weak
              </div>

              <div className="mt-1 font-semibold text-orange-700">
                {analysis.weak}
              </div>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <div className="text-xs text-gray-500">
                Poor
              </div>

              <div className="mt-1 font-semibold text-red-700">
                {analysis.poor}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Highest Quality Trade
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {analysis.highestQuality?.quality.toFixed(
                  0
                )}
                /100
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {analysis.highestQuality?.setup}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Lowest Quality Trade
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {analysis.lowestQuality?.quality.toFixed(
                  0
                )}
                /100
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {analysis.lowestQuality?.setup}
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-3 pr-4 font-medium">
                    Setup
                  </th>

                  <th className="py-3 px-4 font-medium">
                    P&L
                  </th>

                  <th className="py-3 px-4 font-medium">
                    R
                  </th>

                  <th className="py-3 px-4 font-medium">
                    Risk
                  </th>

                  <th className="py-3 pl-4 font-medium text-right">
                    Quality
                  </th>
                </tr>
              </thead>

              <tbody>
                {analysis.trades
                  .slice()
                  .sort(
                    (a, b) =>
                      b.quality - a.quality
                  )
                  .slice(0, 10)
                  .map((item) => {
                    const label =
                      getQualityLabel(
                        item.quality
                      );

                    return (
                      <tr
                        key={`${item.index}-${item.setup}`}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-900">
                            {item.setup}
                          </div>
                        </td>

                        <td
                          className={`py-3 px-4 font-medium ${
                            item.pnl > 0
                              ? "text-green-600"
                              : item.pnl < 0
                                ? "text-red-600"
                                : "text-gray-600"
                          }`}
                        >
                          {item.pnl >= 0
                            ? "+"
                            : ""}
                          $
                          {item.pnl.toFixed(
                            2
                          )}
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          {item.r >= 0
                            ? "+"
                            : ""}
                          {item.r.toFixed(2)}R
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          {item.risk > 0
                            ? `$${item.risk.toFixed(
                                2
                              )}`
                            : "—"}
                        </td>

                        <td className="py-3 pl-4 text-right">
                          <span className="font-semibold text-gray-900">
                            {item.quality.toFixed(
                              0
                            )}
                            /100
                          </span>

                          <span className="ml-2 text-xs text-gray-500">
                            {label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}