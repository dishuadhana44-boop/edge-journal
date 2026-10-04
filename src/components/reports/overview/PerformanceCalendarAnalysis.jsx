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

export default function PerformanceCalendarAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const data = useMemo(() => {
    const map = {};

    filteredTrades.forEach((trade) => {
      if (!trade) return;

      const date = getDate(trade);

      if (!date) return;

      const pnl = getPnL(trade);

      if (!map[date]) {
        map[date] = {
          date,
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };
      }

      map[date].pnl += pnl;
      map[date].trades += 1;

      if (pnl > 0) {
        map[date].wins += 1;
      } else if (pnl < 0) {
        map[date].losses += 1;
      }
    });

    return Object.values(map).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [filteredTrades]);

  const statistics = useMemo(() => {
    if (data.length === 0) {
      return {
        winningDays: 0,
        losingDays: 0,
        breakevenDays: 0,
        bestDay: null,
        worstDay: null,
        averageDailyPnL: 0,
        consistency: 0,
      };
    }

    const winningDays = data.filter(
      (day) => day.pnl > 0
    ).length;

    const losingDays = data.filter(
      (day) => day.pnl < 0
    ).length;

    const breakevenDays = data.filter(
      (day) => day.pnl === 0
    ).length;

    const bestDay = [...data].sort(
      (a, b) => b.pnl - a.pnl
    )[0];

    const worstDay = [...data].sort(
      (a, b) => a.pnl - b.pnl
    )[0];

    const totalPnL = data.reduce(
      (sum, day) => sum + day.pnl,
      0
    );

    const averageDailyPnL =
      totalPnL / data.length;

    const consistency =
      data.length > 0
        ? (winningDays / data.length) * 100
        : 0;

    return {
      winningDays,
      losingDays,
      breakevenDays,
      bestDay,
      worstDay,
      averageDailyPnL,
      consistency,
    };
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Performance Calendar
        </h2>

       
      </div>

      {data.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No daily performance data available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Winning Days
              </div>

              <div className="mt-1 text-xl font-semibold text-green-600">
                {statistics.winningDays}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Losing Days
              </div>

              <div className="mt-1 text-xl font-semibold text-red-600">
                {statistics.losingDays}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Best Day
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {statistics.bestDay?.date}
              </div>

              <div className="text-sm text-green-600">
                +${statistics.bestDay?.pnl.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Worst Day
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {statistics.worstDay?.date}
              </div>

              <div
                className={`text-sm ${
                  statistics.worstDay?.pnl < 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {statistics.worstDay?.pnl >= 0 ? "+" : ""}
                ${statistics.worstDay?.pnl.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">
                  Daily Consistency
                </div>

                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {statistics.consistency.toFixed(1)}%
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">
                  Avg Daily P&L
                </div>

                <div
                  className={`mt-1 text-lg font-semibold ${
                    statistics.averageDailyPnL > 0
                      ? "text-green-600"
                      : statistics.averageDailyPnL < 0
                        ? "text-red-600"
                        : "text-gray-600"
                  }`}
                >
                  {statistics.averageDailyPnL >= 0
                    ? "+"
                    : ""}
                  $
                  {statistics.averageDailyPnL.toFixed(
                    2
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full"
                style={{
                  width: `${Math.min(
                    statistics.consistency,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {data.map((day) => {
              const positive = day.pnl > 0;
              const negative = day.pnl < 0;

              return (
                <div
                  key={day.date}
                  className={`rounded-lg border p-3 ${
                    positive
                      ? "border-green-200 bg-green-50"
                      : negative
                        ? "border-red-200 bg-red-50"
                        : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="text-xs text-gray-500">
                    {day.date}
                  </div>

                  <div
                    className={`mt-2 text-sm font-semibold ${
                      positive
                        ? "text-green-700"
                        : negative
                          ? "text-red-700"
                          : "text-gray-700"
                    }`}
                  >
                    {day.pnl >= 0 ? "+" : ""}
                    ${day.pnl.toFixed(2)}
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    {day.trades} trade
                    {day.trades !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}