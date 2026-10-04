import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

function getDate(trade) {
  return (
    trade?.date ??
    trade?.openedAt ??
    trade?.openTime ??
    trade?.createdAt ??
    trade?.timestamp ??
    null
  );
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

export default function DayOfWeekAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const data = useMemo(() => {
    const result = DAYS.map((day) => ({
      day,
      trades: 0,
      wins: 0,
      pnl: 0,
    }));

    if (!Array.isArray(filteredTrades)) {
      return result;
    }

    filteredTrades.forEach((trade) => {
      const dateValue = getDate(trade);

      if (!dateValue) return;

      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) return;

      const dayIndex = date.getDay();
      const pnl = getPnL(trade);

      result[dayIndex].trades += 1;
      result[dayIndex].pnl += pnl;

      if (pnl > 0) {
        result[dayIndex].wins += 1;
      }
    });

    return result;
  }, [filteredTrades]);

  const maxAbsPnL = Math.max(
    ...data.map((item) => Math.abs(item.pnl)),
    1
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Day-of-Week Performance
        </h3>

      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const winRate =
            item.trades > 0
              ? (item.wins / item.trades) * 100
              : 0;

          const width =
            item.pnl === 0
              ? 0
              : (Math.abs(item.pnl) / maxAbsPnL) * 100;

          return (
            <div
              key={item.day}
              className="grid grid-cols-[100px_1fr_110px] items-center gap-4"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.day}
                </p>

                <p className="text-xs text-gray-500">
                  {item.trades} trades
                </p>
              </div>

              <div className="relative h-8 overflow-hidden rounded-md bg-gray-100">
                {item.pnl !== 0 && (
                  <div
                    className={`absolute left-0 top-0 h-full rounded-md ${
                      item.pnl > 0
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${width}%`,
                    }}
                  />
                )}

                <div className="relative z-10 flex h-full items-center px-3">
                  <span className="text-xs font-medium text-gray-700">
                    {winRate.toFixed(1)}% win rate
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    item.pnl > 0
                      ? "text-green-600"
                      : item.pnl < 0
                        ? "text-red-600"
                        : "text-gray-900"
                  }`}
                >
                  {formatMoney(item.pnl)}
                </p>

                <p className="text-xs text-gray-500">
                  Net P&L
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}