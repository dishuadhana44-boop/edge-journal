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

export default function TradeDistributionAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const data = useMemo(() => {
    const trades = Array.isArray(filteredTrades)
      ? filteredTrades.filter(Boolean)
      : [];

    const buckets = [
      {
        label: "Large Loss",
        min: -Infinity,
        max: -500,
        count: 0,
        pnl: 0,
      },
      {
        label: "Medium Loss",
        min: -500,
        max: -100,
        count: 0,
        pnl: 0,
      },
      {
        label: "Small Loss",
        min: -100,
        max: 0,
        count: 0,
        pnl: 0,
      },
      {
        label: "Breakeven",
        min: 0,
        max: 0,
        count: 0,
        pnl: 0,
      },
      {
        label: "Small Win",
        min: 0,
        max: 100,
        count: 0,
        pnl: 0,
      },
      {
        label: "Medium Win",
        min: 100,
        max: 500,
        count: 0,
        pnl: 0,
      },
      {
        label: "Large Win",
        min: 500,
        max: Infinity,
        count: 0,
        pnl: 0,
      },
    ];

    trades.forEach((trade) => {
      const pnl = getPnL(trade);

      if (pnl === 0) {
        buckets[3].count += 1;
        return;
      }

      let bucket;

      if (pnl < -500) {
        bucket = buckets[0];
      } else if (pnl < -100) {
        bucket = buckets[1];
      } else if (pnl < 0) {
        bucket = buckets[2];
      } else if (pnl < 100) {
        bucket = buckets[4];
      } else if (pnl < 500) {
        bucket = buckets[5];
      } else {
        bucket = buckets[6];
      }

      bucket.count += 1;
      bucket.pnl += pnl;
    });

    return buckets;
  }, [filteredTrades]);

  const totalTrades = data.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const maxCount = Math.max(
    ...data.map((item) => item.count),
    1
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Trade Distribution
        </h3>

      
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const percentage =
            totalTrades > 0
              ? (item.count / totalTrades) * 100
              : 0;

          const width =
            (item.count / maxCount) * 100;

          const isLoss =
            item.label.includes("Loss");

          const isWin =
            item.label.includes("Win");

          return (
            <div
              key={item.label}
              className="grid grid-cols-[120px_1fr_80px_110px] items-center gap-4"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.label}
                </p>

                <p className="text-xs text-gray-500">
                  {percentage.toFixed(1)}%
                </p>
              </div>

              <div className="h-7 overflow-hidden rounded-md bg-gray-100">
                {item.count > 0 && (
                  <div
                    className={`h-full rounded-md ${
                      isLoss
                        ? "bg-red-400"
                        : isWin
                          ? "bg-green-400"
                          : "bg-gray-400"
                    }`}
                    style={{
                      width: `${width}%`,
                    }}
                  />
                )}
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {item.count}
                </p>

                <p className="text-xs text-gray-500">
                  trades
                </p>
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