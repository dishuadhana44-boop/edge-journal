import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useJournal } from "../../../context/JournalContext";

export default function MistakeAnalysis({ plan }) {
  const { trades = [] } = useJournal();

  const stats = useMemo(() => {
    const planTrades = trades.filter((trade) => {
      const selectedPlanId =
        trade?.reflection?.selectedPlanId ??
        trade?.selectedPlanId ??
        trade?.planId;

      return (
        String(selectedPlanId) === String(plan?.id)
      );
    });

    let totalMistakes = 0;
    let tradesWithMistakes = 0;

    const mistakeCounts = {};

    let mistakeTradePnL = 0;
    let cleanTradePnL = 0;

    planTrades.forEach((trade) => {
      const mistakes = Array.isArray(trade?.mistakes)
        ? trade.mistakes
        : [];

      const pnl = Number(
        String(
          trade?.pnl ??
            trade?.netPnL ??
            trade?.netPnl ??
            0
        ).replace(/[₹$,\s+]/g, "")
      ) || 0;

      if (mistakes.length > 0) {
        tradesWithMistakes++;
        mistakeTradePnL += pnl;

        totalMistakes += mistakes.length;

        mistakes.forEach((mistake) => {
          const name = String(mistake).trim();

          if (!name) return;

          mistakeCounts[name] =
            (mistakeCounts[name] || 0) + 1;
        });
      } else {
        cleanTradePnL += pnl;
      }
    });

    const totalTrades = planTrades.length;

    const mistakeFreeRate =
      totalTrades > 0
        ? ((totalTrades - tradesWithMistakes) /
            totalTrades) *
          100
        : 0;

    const mistakeRows = Object.entries(
      mistakeCounts
    ).sort((a, b) => b[1] - a[1]);

    const mostCommonMistake =
      mistakeRows.length > 0
        ? mistakeRows[0][0]
        : "None";

    return {
      totalTrades,
      totalMistakes,
      tradesWithMistakes,
      mistakeFreeTrades:
        totalTrades - tradesWithMistakes,
      mistakeFreeRate,
      mistakeRows,
      mostCommonMistake,
      mistakeTradePnL,
      cleanTradePnL,
    };
  }, [trades, plan]);

  const maxCount =
    stats.mistakeRows.length > 0
      ? stats.mistakeRows[0][1]
      : 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

      {/* HEADER */}

      <div className="p-6 border-b">

        <h2 className="text-xl font-bold text-gray-900">
          Mistake Analysis
        </h2>


      </div>

      {/* STATS */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b">

        <StatCard
          label="Total Mistakes"
          value={stats.totalMistakes}
        />

        <StatCard
          label="Trades With Mistakes"
          value={stats.tradesWithMistakes}
        />

        <StatCard
          label="Mistake-Free Rate"
          value={`${stats.mistakeFreeRate.toFixed(1)}%`}
          positive={
            stats.mistakeFreeRate >= 70
          }
        />

        <StatCard
          label="Most Common"
          value={stats.mostCommonMistake}
          small
        />

      </div>

      {/* PNL IMPACT */}

      <div className="grid grid-cols-2 gap-4 p-6 border-b">

        <div className="rounded-xl bg-red-50 border border-red-100 p-4">

          <p className="text-xs text-red-600">
            P&L From Mistake Trades
          </p>

          <p
            className={`text-xl font-bold mt-1 ${
              stats.mistakeTradePnL >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {stats.mistakeTradePnL >= 0
              ? "+"
              : "-"}
            $
            {Math.abs(
              stats.mistakeTradePnL
            ).toLocaleString()}
          </p>

        </div>

        <div className="rounded-xl bg-green-50 border border-green-100 p-4">

          <p className="text-xs text-green-600">
            P&L From Clean Trades
          </p>

          <p
            className={`text-xl font-bold mt-1 ${
              stats.cleanTradePnL >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {stats.cleanTradePnL >= 0
              ? "+"
              : "-"}
            $
            {Math.abs(
              stats.cleanTradePnL
            ).toLocaleString()}
          </p>

        </div>

      </div>

      {/* BREAKDOWN */}

      <div className="p-6">

        <h3 className="font-semibold text-gray-900 mb-5">
          Mistake Breakdown
        </h3>

        {stats.mistakeRows.length === 0 ? (

          <div className="flex flex-col items-center justify-center py-12 text-center">

            <CheckCircle2
              size={38}
              className="text-green-500 mb-3"
            />

            <p className="font-medium text-gray-800">
              No mistakes recorded
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Great discipline on this plan.
            </p>

          </div>

        ) : (

          <div className="space-y-5">

            {stats.mistakeRows.map(
              ([mistake, count]) => {

                const percent = Math.round(
                  (count / maxCount) * 100
                );

                return (
                  <div key={mistake}>

                    <div className="flex items-center justify-between mb-2">

                      <div className="flex items-center gap-3">

                        <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">

                          <AlertTriangle
                            size={17}
                            className="text-red-500"
                          />

                        </div>

                        <div>

                          <p className="font-medium text-gray-900">
                            {mistake}
                          </p>

                          <p className="text-xs text-gray-500">
                            {count} occurrence
                            {count !== 1
                              ? "s"
                              : ""}
                          </p>

                        </div>

                      </div>

                      <span className="font-semibold text-gray-700">
                        {percent}%
                      </span>

                    </div>

                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden">

                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </div>

    </div>
  );
}


// -----------------------------------------
// STAT CARD
// -----------------------------------------

function StatCard({
  label,
  value,
  positive = false,
  small = false,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">

      <p className="text-xs text-gray-500">
        {label}
      </p>

      <p
        className={`font-bold mt-1 ${
          small
            ? "text-sm"
            : "text-xl"
        } ${
          positive
            ? "text-green-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </p>

    </div>
  );
}