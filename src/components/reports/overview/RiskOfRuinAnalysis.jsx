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

function randomizeTrades(values) {
  const result = [...values];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

export default function RiskOfRuinAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const analysis = useMemo(() => {
    const pnlValues = filteredTrades
      .filter(Boolean)
      .map(getPnL)
      .filter((value) => Number.isFinite(value));

    if (pnlValues.length < 2) {
      return {
        trades: pnlValues.length,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxHistoricalDrawdown: 0,
        maxSimulatedDrawdown: 0,
        averageSimulatedDrawdown: 0,
        drawdownRisk: 0,
        ruinRisk: 0,
        simulations: 0,
      };
    }

    const wins = pnlValues.filter(
      (value) => value > 0
    );

    const losses = pnlValues.filter(
      (value) => value < 0
    );

    const grossProfit = wins.reduce(
      (sum, value) => sum + value,
      0
    );

    const grossLoss = losses.reduce(
      (sum, value) => sum + Math.abs(value),
      0
    );

    const winRate =
      (wins.length / pnlValues.length) * 100;

    const averageWin =
      wins.length > 0
        ? grossProfit / wins.length
        : 0;

    const averageLoss =
      losses.length > 0
        ? grossLoss / losses.length
        : 0;

    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : Infinity;

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;

    pnlValues.forEach((pnl) => {
      equity += pnl;

      if (equity > peak) {
        peak = equity;
      }

      const drawdown = peak - equity;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const simulations = 500;
    const drawdowns = [];
    let dangerousRuns = 0;

    const historicalRange =
      Math.abs(Math.max(...pnlValues)) +
      Math.abs(Math.min(...pnlValues));

    const ruinThreshold =
      historicalRange > 0
        ? historicalRange * 5
        : 1;

    for (let simulation = 0; simulation < simulations; simulation += 1) {
      const randomized = randomizeTrades(
        pnlValues
      );

      let simulationEquity = 0;
      let simulationPeak = 0;
      let simulationDrawdown = 0;

      randomized.forEach((pnl) => {
        simulationEquity += pnl;

        if (simulationEquity > simulationPeak) {
          simulationPeak = simulationEquity;
        }

        const drawdown =
          simulationPeak - simulationEquity;

        if (drawdown > simulationDrawdown) {
          simulationDrawdown = drawdown;
        }
      });

      drawdowns.push(simulationDrawdown);

      if (simulationDrawdown >= ruinThreshold) {
        dangerousRuns += 1;
      }
    }

    const maxSimulatedDrawdown =
      Math.max(...drawdowns);

    const averageSimulatedDrawdown =
      drawdowns.reduce(
        (sum, value) => sum + value,
        0
      ) / drawdowns.length;

    const drawdownRisk =
      historicalRange > 0
        ? Math.min(
            (maxSimulatedDrawdown /
              historicalRange) *
              10,
            100
          )
        : 0;

    const ruinRisk =
      (dangerousRuns / simulations) * 100;

    return {
      trades: pnlValues.length,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      maxHistoricalDrawdown: maxDrawdown,
      maxSimulatedDrawdown,
      averageSimulatedDrawdown,
      drawdownRisk,
      ruinRisk,
      simulations,
    };
  }, [filteredTrades]);

  const getRiskStatus = () => {
    if (analysis.ruinRisk < 5) {
      return {
        label: "Low Risk",
        className:
          "text-green-700 bg-green-50 border-green-200",
      };
    }

    if (analysis.ruinRisk < 15) {
      return {
        label: "Moderate Risk",
        className:
          "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    }

    return {
      label: "High Risk",
      className:
        "text-red-700 bg-red-50 border-red-200",
    };
  };

  const status = getRiskStatus();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Risk of Ruin & Monte Carlo Analysis
          </h2>

        
        </div>

        <div
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </div>
      </div>

      {analysis.trades < 2 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          At least 2 trades are required for simulation.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Historical Max DD
              </div>

              <div className="mt-1 text-xl font-semibold text-red-600">
                ${analysis.maxHistoricalDrawdown.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Simulated Max DD
              </div>

              <div className="mt-1 text-xl font-semibold text-red-600">
                ${analysis.maxSimulatedDrawdown.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Avg Simulated DD
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                ${analysis.averageSimulatedDrawdown.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Ruin Risk
              </div>

              <div
                className={`mt-1 text-xl font-semibold ${
                  analysis.ruinRisk < 5
                    ? "text-green-600"
                    : analysis.ruinRisk < 15
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {analysis.ruinRisk.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Win Rate
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {analysis.winRate.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Profit Factor
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {analysis.profitFactor === Infinity
                  ? "∞"
                  : analysis.profitFactor.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Simulations
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {analysis.simulations}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Drawdown Risk Score
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Relative risk based on simulated drawdowns.
                </div>
              </div>

              <div className="text-sm font-semibold text-gray-900">
                {analysis.drawdownRisk.toFixed(0)}/100
              </div>
            </div>

            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full"
                style={{
                  width: `${Math.min(
                    Math.max(
                      analysis.drawdownRisk,
                      0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="text-sm font-semibold text-gray-900">
              Important
            </div>

            <p className="text-xs text-gray-600 mt-1 leading-5">
              Monte Carlo results are estimates based on your historical
              trades. They are useful for understanding drawdown sensitivity,
              but they do not guarantee future performance.
            </p>
          </div>
        </>
      )}
    </div>
  );
}