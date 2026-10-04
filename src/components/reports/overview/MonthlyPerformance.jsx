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

function formatMonth(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function MonthlyPerformance() {
  const { filteredTrades = [] } = useJournal();

  const months = useMemo(() => {
    const monthMap = new Map();

    if (!Array.isArray(filteredTrades)) {
      return [];
    }

    filteredTrades.forEach((trade) => {
      const dateValue = getDate(trade);

      if (!dateValue) return;

      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = date.getMonth();

      const key = `${year}-${String(month + 1).padStart(
        2,
        "0"
      )}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          date: new Date(year, month, 1),
          trades: 0,
          wins: 0,
          pnl: 0,
        });
      }

      const item = monthMap.get(key);
      const pnl = getPnL(trade);

      item.trades += 1;
      item.pnl += pnl;

      if (pnl > 0) {
        item.wins += 1;
      }
    });

    return Array.from(monthMap.values())
      .sort((a, b) => b.date - a.date)
      .slice(0, 12);
  }, [filteredTrades]);

  const maxAbsPnL = Math.max(
    ...months.map((item) => Math.abs(item.pnl)),
    1
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Monthly Performance
        </h3>

       
      </div>

      {months.length > 0 ? (
        <div className="space-y-3">
          {months.map((item) => {
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
                key={item.key}
                className="grid grid-cols-[100px_1fr_120px] items-center gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatMonth(item.date)}
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
      ) : (
        <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No monthly performance data available.
        </div>
      )}
    </div>
  );
}