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

function getSymbol(trade) {
  return (
    trade?.symbol ??
    trade?.instrument ??
    trade?.ticker ??
    "Unknown"
  );
}

function getSide(trade) {
  return (
    trade?.side ??
    trade?.direction ??
    trade?.type ??
    "Unknown"
  );
}

function getDate(trade) {
  return (
    trade?.date ??
    trade?.openedAt ??
    trade?.createdAt ??
    ""
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function TradeRow({ trade, rank, type }) {
  const pnl = getPnL(trade);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
          {rank}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {getSymbol(trade)}
          </p>

          <p className="text-xs text-gray-500">
            {String(getSide(trade)).toUpperCase()} •{" "}
            {formatDate(getDate(trade))}
          </p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-semibold ${
            type === "best"
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {formatMoney(pnl)}
        </p>

        <p className="text-xs text-gray-500">
          {type === "best"
            ? "Best trade"
            : "Worst trade"}
        </p>
      </div>
    </div>
  );
}

export default function BestWorstTrades() {
  const { filteredTrades = [] } = useJournal();

  const trades = useMemo(() => {
    if (!Array.isArray(filteredTrades)) {
      return {
        best: [],
        worst: [],
      };
    }

    const normalized = filteredTrades
      .filter(Boolean)
      .map((trade) => ({
        trade,
        pnl: getPnL(trade),
      }));

    const best = [...normalized]
      .filter((item) => item.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5)
      .map((item) => item.trade);

    const worst = [...normalized]
      .filter((item) => item.pnl < 0)
      .sort((a, b) => a.pnl - b.pnl)
      .slice(0, 5)
      .map((item) => item.trade);

    return {
      best,
      worst,
    };
  }, [filteredTrades]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Best Trades
          </h3>

        
        </div>

        {trades.best.length > 0 ? (
          <div>
            {trades.best.map((trade, index) => (
              <TradeRow
                key={`best-${trade?.id ?? index}`}
                trade={trade}
                rank={index + 1}
                type="best"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            No winning trades available.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Worst Trades
          </h3>

          
        </div>

        {trades.worst.length > 0 ? (
          <div>
            {trades.worst.map((trade, index) => (
              <TradeRow
                key={`worst-${trade?.id ?? index}`}
                trade={trade}
                rank={index + 1}
                type="worst"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            No losing trades available.
          </div>
        )}
      </div>
    </div>
  );
}