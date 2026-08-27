import { useMemo } from "react";

import TradeDistributionChart from "./TradeDistributionChart";
import TradeDistributionStats from "./TradeDistributionStats";

import { useJournal } from "../../../context/JournalContext";

export default function TradeDistributionCard() {
  const { trades = [] } = useJournal();

  // =========================================
  // CALCULATE TRADE DISTRIBUTION
  // =========================================

  const { tradeDistribution, tradeSummary } = useMemo(() => {
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;

    trades.forEach((trade) => {
      const pnlValue =
        trade?.pnl ??
        trade?.profitLoss ??
        trade?.profit ??
        trade?.netPnL ??
        trade?.netProfit ??
        0;

      const pnl = Number(pnlValue);

      if (!Number.isFinite(pnl)) return;

      if (pnl > 0) {
        winningTrades++;
      } else if (pnl < 0) {
        losingTrades++;
      } else {
        breakevenTrades++;
      }
    });

    const totalTrades =
      winningTrades +
      losingTrades +
      breakevenTrades;

    const winRate =
      totalTrades > 0
        ? (winningTrades / totalTrades) * 100
        : 0;

    const lossRate =
      totalTrades > 0
        ? (losingTrades / totalTrades) * 100
        : 0;

    const scratchRate =
      totalTrades > 0
        ? (breakevenTrades / totalTrades) * 100
        : 0;

    return {
      tradeDistribution: [
        {
          name: "Winning",
          value: winningTrades,
        },
        {
          name: "Losing",
          value: losingTrades,
        },
        {
          name: "Break Even",
          value: breakevenTrades,
        },
      ],

      tradeSummary: {
        totalTrades,
        winningTrades,
        losingTrades,
        breakevenTrades,
        winRate,
        lossRate,
        scratchRate,
      },
    };
  }, [trades]);

  // =========================================
  // UI
  // =========================================

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* HEADER */}

      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Trade Distribution
        </h2>
      </div>

      {/* CONTENT */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">

        {/* CHART */}

        <TradeDistributionChart
          data={tradeDistribution}
          totalTrades={tradeSummary.totalTrades}
        />

        {/* STATS */}

        <TradeDistributionStats
          summary={tradeSummary}
        />

      </div>

    </div>
  );
}