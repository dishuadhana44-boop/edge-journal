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

function getDate(trade) {
  const value =
    trade?.date ??
    trade?.openedAt ??
    trade?.openTime ??
    trade?.entryTime ??
    trade?.createdAt;

  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export default function ConsistencyDisciplineAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const analysis = useMemo(() => {
    const trades = filteredTrades.filter(Boolean);

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        tradingDays: 0,
        averageTradesPerDay: 0,
        maxTradesDay: 0,
        profitableDays: 0,
        losingDays: 0,
        consistency: 0,
        disciplineScore: 0,
        longestTradingStreak: 0,
        longestNoTradeGap: 0,
      };
    }

    const dailyMap = {};

    trades.forEach((trade) => {
      const date = getDate(trade);

      if (!date) return;

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          trades: 0,
          pnl: 0,
        };
      }

      dailyMap[date].trades += 1;
      dailyMap[date].pnl += getPnL(trade);
    });

    const days = Object.values(dailyMap).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    const tradingDays = days.length;

    const totalTrades = trades.length;

    const averageTradesPerDay =
      tradingDays > 0
        ? totalTrades / tradingDays
        : 0;

    const maxTradesDay =
      days.length > 0
        ? Math.max(
            ...days.map((day) => day.trades)
          )
        : 0;

    const profitableDays = days.filter(
      (day) => day.pnl > 0
    ).length;

    const losingDays = days.filter(
      (day) => day.pnl < 0
    ).length;

    const consistency =
      tradingDays > 0
        ? (profitableDays / tradingDays) * 100
        : 0;

    let longestTradingStreak = 0;
    let currentStreak = 0;

    days.forEach((day, index) => {
      if (index === 0) {
        currentStreak = 1;
      } else {
        const previous = new Date(
          days[index - 1].date
        );

        const current = new Date(day.date);

        const difference =
          (current - previous) /
          (1000 * 60 * 60 * 24);

        if (difference === 1) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }

      longestTradingStreak = Math.max(
        longestTradingStreak,
        currentStreak
      );
    });

    let longestNoTradeGap = 0;

    for (let index = 1; index < days.length; index += 1) {
      const previous = new Date(
        days[index - 1].date
      );

      const current = new Date(
        days[index].date
      );

      const difference =
        (current - previous) /
        (1000 * 60 * 60 * 24);

      if (difference > longestNoTradeGap) {
        longestNoTradeGap = difference;
      }
    }

    /*
      Discipline score:
      Lower trade frequency = better control.
      Consistent profitable days = better consistency.
      Extremely high trades/day reduces score.
    */

    let frequencyScore = 100;

    if (averageTradesPerDay > 10) {
      frequencyScore = 35;
    } else if (averageTradesPerDay > 7) {
      frequencyScore = 50;
    } else if (averageTradesPerDay > 5) {
      frequencyScore = 65;
    } else if (averageTradesPerDay > 3) {
      frequencyScore = 80;
    }

    const disciplineScore =
      frequencyScore * 0.4 +
      consistency * 0.6;

    return {
      totalTrades,
      tradingDays,
      averageTradesPerDay,
      maxTradesDay,
      profitableDays,
      losingDays,
      consistency,
      disciplineScore,
      longestTradingStreak,
      longestNoTradeGap,
    };
  }, [filteredTrades]);

  const getStatus = () => {
    if (analysis.disciplineScore >= 80) {
      return {
        label: "Excellent Discipline",
        className:
          "text-green-700 bg-green-50 border-green-200",
      };
    }

    if (analysis.disciplineScore >= 60) {
      return {
        label: "Good Discipline",
        className:
          "text-gray-700 bg-gray-50 border-gray-200",
      };
    }

    if (analysis.disciplineScore >= 40) {
      return {
        label: "Needs Improvement",
        className:
          "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    }

    return {
      label: "High Overtrading Risk",
      className:
        "text-red-700 bg-red-50 border-red-200",
    };
  };

  const status = getStatus();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Consistency & Discipline
          </h2>

         
        </div>

        <div
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </div>
      </div>

      {analysis.totalTrades === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No trade data available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Trading Days
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {analysis.tradingDays}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Trades / Day
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {analysis.averageTradesPerDay.toFixed(
                  1
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Profitable Days
              </div>

              <div className="mt-1 text-xl font-semibold text-green-600">
                {analysis.profitableDays}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Losing Days
              </div>

              <div className="mt-1 text-xl font-semibold text-red-600">
                {analysis.losingDays}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Consistency
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {analysis.consistency.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Discipline Score
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {analysis.disciplineScore.toFixed(0)}
                /100
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Max Trades / Day
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {analysis.maxTradesDay}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Trading Streak
              </div>

              <div className="mt-1 text-xl font-semibold text-gray-900">
                {analysis.longestTradingStreak}
                <span className="text-sm text-gray-400">
                  {" "}days
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Discipline Score
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Based on trading frequency and profitable-day consistency.
                </div>
              </div>

              <div className="text-sm font-semibold text-gray-900">
                {analysis.disciplineScore.toFixed(0)}/100
              </div>
            </div>

            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full"
                style={{
                  width: `${Math.min(
                    Math.max(
                      analysis.disciplineScore,
                      0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Overtrading Check
              </div>

              <div
                className={`mt-2 text-sm font-semibold ${
                  analysis.averageTradesPerDay <= 5
                    ? "text-green-600"
                    : analysis.averageTradesPerDay <= 7
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {analysis.averageTradesPerDay <= 5
                  ? "Trading frequency looks controlled."
                  : analysis.averageTradesPerDay <= 7
                    ? "Trading frequency is elevated."
                    : "Potential overtrading detected."}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Trading Routine
              </div>

              <div className="mt-2 text-sm font-semibold text-gray-900">
                {analysis.longestNoTradeGap > 5
                  ? `Longest gap: ${Math.round(
                      analysis.longestNoTradeGap
                    )} days`
                  : "Trading activity is relatively consistent."}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}