import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

export default function StreakAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const stats = useMemo(() => {
    const trades = Array.isArray(filteredTrades)
      ? filteredTrades.filter(Boolean)
      : [];

    if (trades.length === 0) {
      return {
        current: 0,
        bestWin: 0,
        bestLoss: 0,
        currentType: "None",
      };
    }

    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(
        a?.date ?? a?.openedAt ?? a?.createdAt ?? 0
      ).getTime();

      const dateB = new Date(
        b?.date ?? b?.openedAt ?? b?.createdAt ?? 0
      ).getTime();

      return dateA - dateB;
    });

    let currentWinStreak = 0;
    let currentLossStreak = 0;

    let bestWin = 0;
    let bestLoss = 0;

    let runningWin = 0;
    let runningLoss = 0;

    for (const trade of sortedTrades) {
      const pnl = Number(
        trade?.pnl ??
          trade?.profit ??
          trade?.netPL ??
          trade?.netProfit ??
          trade?.netPnL ??
          0
      );

      const safePnL = Number.isFinite(pnl) ? pnl : 0;

      if (safePnL > 0) {
        runningWin += 1;
        runningLoss = 0;

        bestWin = Math.max(bestWin, runningWin);
      } else if (safePnL < 0) {
        runningLoss += 1;
        runningWin = 0;

        bestLoss = Math.max(bestLoss, runningLoss);
      } else {
        runningWin = 0;
        runningLoss = 0;
      }
    }

    const lastTrade = sortedTrades[sortedTrades.length - 1];

    const lastPnL = Number(
      lastTrade?.pnl ??
        lastTrade?.profit ??
        lastTrade?.netPL ??
        lastTrade?.netProfit ??
        lastTrade?.netPnL ??
        0
    );

    let current = 0;
    let currentType = "None";

    if (lastPnL > 0) {
      current = runningWin;
      currentType = "Win";
    } else if (lastPnL < 0) {
      current = runningLoss;
      currentType = "Loss";
    }

    return {
      current,
      bestWin,
      bestLoss,
      currentType,
    };
  }, [filteredTrades]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Streak Analysis
        </h3>

    
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Current Streak
          </p>

          <p
            className={`mt-2 text-xl font-semibold ${
              stats.currentType === "Win"
                ? "text-green-600"
                : stats.currentType === "Loss"
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {stats.current}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {stats.currentType}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Best Win Streak
          </p>

          <p className="mt-2 text-xl font-semibold text-green-600">
            {stats.bestWin}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            consecutive wins
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Worst Loss Streak
          </p>

          <p className="mt-2 text-xl font-semibold text-red-600">
            {stats.bestLoss}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            consecutive losses
          </p>
        </div>
      </div>
    </div>
  );
}