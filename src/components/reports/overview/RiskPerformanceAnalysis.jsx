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

function getRisk(trade) {
  const value = Number(
    trade?.riskAmount ??
      trade?.risk ??
      trade?.initialRisk ??
      trade?.plannedRisk ??
      0
  );

  return Number.isFinite(value) && value > 0
    ? value
    : null;
}

function formatMoney(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";

  return `${sign}$${Math.abs(value).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

export default function RiskPerformanceAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const stats = useMemo(() => {
    const trades = Array.isArray(filteredTrades)
      ? filteredTrades.filter(Boolean)
      : [];

    let totalRisk = 0;
    let totalPnL = 0;
    let riskTrades = 0;
    let profitableRiskTrades = 0;
    let losingRiskTrades = 0;

    let largestRisk = 0;
    let largestRiskPnL = 0;

    for (const trade of trades) {
      const risk = getRisk(trade);
      const pnl = getPnL(trade);

      totalPnL += pnl;

      if (risk === null) continue;

      riskTrades += 1;
      totalRisk += risk;

      if (pnl > 0) {
        profitableRiskTrades += 1;
      }

      if (pnl < 0) {
        losingRiskTrades += 1;
      }

      if (risk > largestRisk) {
        largestRisk = risk;
        largestRiskPnL = pnl;
      }
    }

    const averageRisk =
      riskTrades > 0
        ? totalRisk / riskTrades
        : 0;

    const riskEfficiency =
      totalRisk > 0
        ? totalPnL / totalRisk
        : 0;

    const riskWinRate =
      riskTrades > 0
        ? (profitableRiskTrades / riskTrades) * 100
        : 0;

    return {
      totalRisk,
      averageRisk,
      riskEfficiency,
      riskWinRate,
      riskTrades,
      profitableRiskTrades,
      losingRiskTrades,
      largestRisk,
      largestRiskPnL,
    };
  }, [filteredTrades]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Risk Performance
        </h3>

       
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total Risk
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {formatMoney(stats.totalRisk)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Across {stats.riskTrades} trades
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Average Risk
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {formatMoney(stats.averageRisk)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Per risk-defined trade
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Risk Efficiency
          </p>

          <p
            className={`mt-2 text-xl font-semibold ${
              stats.riskEfficiency > 0
                ? "text-green-600"
                : stats.riskEfficiency < 0
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {stats.riskEfficiency.toFixed(2)}x
          </p>

          <p className="mt-1 text-xs text-gray-500">
            P&L / total risk
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Risk Win Rate
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {stats.riskWinRate.toFixed(1)}%
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Risk-defined trades
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Largest Risk
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {formatMoney(stats.largestRisk)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Trade result: {formatMoney(stats.largestRiskPnL)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Risk Trade Split
          </p>

          <div className="mt-2 flex gap-3 text-sm">
            <span className="font-semibold text-green-600">
              {stats.profitableRiskTrades} W
            </span>

            <span className="font-semibold text-red-600">
              {stats.losingRiskTrades} L
            </span>
          </div>

          <p className="mt-1 text-xs text-gray-500">
            With defined risk
          </p>
        </div>
      </div>

      {stats.riskTrades === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No risk amount data is available for the selected trades.
        </div>
      )}
    </div>
  );
}