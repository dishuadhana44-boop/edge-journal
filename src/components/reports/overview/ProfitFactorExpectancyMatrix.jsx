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

export default function ProfitFactorExpectancyMatrix() {
  const { filteredTrades = [] } = useJournal();

  const stats = useMemo(() => {
    const trades = Array.isArray(filteredTrades)
      ? filteredTrades.filter(Boolean)
      : [];

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        lossRate: 0,
        averageWin: 0,
        averageLoss: 0,
        rewardRisk: 0,
        expectancy: 0,
        profitFactor: 0,
        edgeScore: 0,
        grossProfit: 0,
        grossLoss: 0,
      };
    }

    const pnls = trades.map(getPnL);

    const winningTrades = pnls.filter(
      (pnl) => pnl > 0
    );

    const losingTrades = pnls.filter(
      (pnl) => pnl < 0
    );

    const grossProfit = winningTrades.reduce(
      (sum, pnl) => sum + pnl,
      0
    );

    const grossLoss = losingTrades.reduce(
      (sum, pnl) => sum + Math.abs(pnl),
      0
    );

    const winRate =
      (winningTrades.length / trades.length) * 100;

    const lossRate =
      (losingTrades.length / trades.length) * 100;

    const averageWin =
      winningTrades.length > 0
        ? grossProfit / winningTrades.length
        : 0;

    const averageLoss =
      losingTrades.length > 0
        ? grossLoss / losingTrades.length
        : 0;

    const rewardRisk =
      averageLoss > 0
        ? averageWin / averageLoss
        : 0;

    const expectancy =
      trades.length > 0
        ? pnls.reduce((sum, pnl) => sum + pnl, 0) /
          trades.length
        : 0;

    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0;

    /*
      Edge score combines:
      - Win rate
      - Reward/Risk
      - Profit Factor
      - Positive expectancy
    */

    const winRateScore = Math.min(
      winRate,
      100
    );

    const rewardRiskScore = Math.min(
      rewardRisk * 25,
      100
    );

    const profitFactorScore =
      Math.min(
        profitFactor === Infinity
          ? 100
          : profitFactor * 25,
        100
      );

    const expectancyScore =
      expectancy > 0
        ? Math.min(
            50 + expectancy,
            100
          )
        : Math.max(
            50 + expectancy,
            0
          );

    const edgeScore =
      winRateScore * 0.25 +
      rewardRiskScore * 0.25 +
      profitFactorScore * 0.25 +
      expectancyScore * 0.25;

    return {
      totalTrades: trades.length,
      winRate,
      lossRate,
      averageWin,
      averageLoss,
      rewardRisk,
      expectancy,
      profitFactor,
      edgeScore,
      grossProfit,
      grossLoss,
    };
  }, [filteredTrades]);

  const getStatus = () => {
    if (stats.expectancy > 0 && stats.profitFactor > 1) {
      return {
        label: "Positive Edge",
        className: "text-green-700 bg-green-50 border-green-200",
      };
    }

    if (
      stats.expectancy === 0 ||
      stats.profitFactor === 1
    ) {
      return {
        label: "Neutral Edge",
        className: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    }

    return {
      label: "Negative Edge",
      className: "text-red-700 bg-red-50 border-red-200",
    };
  };

  const status = getStatus();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Profit Factor & Expectancy Matrix
          </h2>

          
        </div>

        <div
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </div>
      </div>

      {stats.totalTrades === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No trade data available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Win Rate
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {stats.winRate.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Avg Win
              </div>

              <div className="mt-1 text-xl font-semibold text-green-600">
                +${stats.averageWin.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Avg Loss
              </div>

              <div className="mt-1 text-xl font-semibold text-red-600">
                -${stats.averageLoss.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Reward / Risk
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                1 : {stats.rewardRisk.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Profit Factor
              </div>

              <div
                className={`mt-1 text-xl font-semibold ${
                  stats.profitFactor > 1
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {stats.profitFactor === Infinity
                  ? "∞"
                  : stats.profitFactor.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Expectancy
              </div>

              <div
                className={`mt-1 text-xl font-semibold ${
                  stats.expectancy > 0
                    ? "text-green-600"
                    : stats.expectancy < 0
                      ? "text-red-600"
                      : "text-gray-900"
                }`}
              >
                {stats.expectancy >= 0 ? "+" : ""}
                ${stats.expectancy.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Gross Profit
              </div>

              <div className="mt-1 text-xl font-semibold text-green-600">
                +${stats.grossProfit.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Edge Score
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {stats.edgeScore.toFixed(0)}/100
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Trading Edge Strength
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Based on win rate, reward/risk, profit factor and expectancy.
                </div>
              </div>

              <div className="text-sm font-semibold text-gray-900">
                {stats.edgeScore.toFixed(0)}%
              </div>
            </div>

            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    Math.max(stats.edgeScore, 0),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div
              className={`rounded-lg border p-4 ${
                stats.expectancy > 0
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="text-xs text-gray-500">
                Expectancy Interpretation
              </div>

              <div className="mt-2 text-sm font-medium text-gray-900">
                {stats.expectancy > 0
                  ? "Your average trade produces positive expected value."
                  : "Your average trade currently does not produce positive expected value."}
              </div>
            </div>

            <div
              className={`rounded-lg border p-4 ${
                stats.profitFactor > 1
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="text-xs text-gray-500">
                Profit Factor Interpretation
              </div>

              <div className="mt-2 text-sm font-medium text-gray-900">
                {stats.profitFactor > 1
                  ? "Gross profits exceed gross losses."
                  : "Gross losses currently exceed gross profits."}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}