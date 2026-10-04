import { useMemo } from "react";
import { useJournal } from "../../context/JournalContext";

function getPnL(trade) {
  const value =
    trade?.pnl ??
    trade?.profit ??
    trade?.netPL ??
    trade?.netProfit ??
    trade?.netPnL ??
    trade?.PnL ??
    0;

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getSymbol(trade) {
  return (
    trade?.symbol ||
    trade?.instrument ||
    trade?.ticker ||
    trade?.asset ||
    "Unknown"
  );
}

function getSide(trade) {
  const side =
    trade?.side ||
    trade?.direction ||
    trade?.positionSide ||
    "";

  const value = String(side).toLowerCase();

  if (value === "buy" || value === "long") return "Long";
  if (value === "sell" || value === "short") return "Short";

  return "Unknown";
}

function formatMoney(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

export default function QuickPerformanceSummary() {
  const { filteredTrades = [] } = useJournal();

  const stats = useMemo(() => {
    if (!filteredTrades.length) {
      return {
        bestSymbol: "—",
        bestSymbolPnL: 0,
        worstSymbol: "—",
        worstSymbolPnL: 0,
        longPnL: 0,
        shortPnL: 0,
        totalTrades: 0,
      };
    }

    const symbols = {};

    let longPnL = 0;
    let shortPnL = 0;

    filteredTrades.forEach((trade) => {
      const pnl = getPnL(trade);
      const symbol = getSymbol(trade);
      const side = getSide(trade);

      if (!symbols[symbol]) {
        symbols[symbol] = 0;
      }

      symbols[symbol] += pnl;

      if (side === "Long") {
        longPnL += pnl;
      }

      if (side === "Short") {
        shortPnL += pnl;
      }
    });

    const symbolEntries = Object.entries(symbols).sort(
      (a, b) => b[1] - a[1]
    );

    return {
      bestSymbol: symbolEntries[0]?.[0] || "—",
      bestSymbolPnL: symbolEntries[0]?.[1] || 0,

      worstSymbol:
        symbolEntries[symbolEntries.length - 1]?.[0] || "—",

      worstSymbolPnL:
        symbolEntries[symbolEntries.length - 1]?.[1] || 0,

      longPnL,
      shortPnL,
      totalTrades: filteredTrades.length,
    };
  }, [filteredTrades]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Quick Performance
        </h3>

      
      </div>

      <div className="space-y-3">

        {/* Best Instrument */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
          <div>
            <p className="text-xs text-gray-500">
              Best Instrument
            </p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {stats.bestSymbol}
            </p>
          </div>

          <p className="text-sm font-semibold text-emerald-600">
            {formatMoney(stats.bestSymbolPnL)}
          </p>
        </div>

        {/* Worst Instrument */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
          <div>
            <p className="text-xs text-gray-500">
              Weakest Instrument
            </p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {stats.worstSymbol}
            </p>
          </div>

          <p
            className={`text-sm font-semibold ${
              stats.worstSymbolPnL >= 0
                ? "text-emerald-600"
                : "text-red-600"
            }`}
          >
            {formatMoney(stats.worstSymbolPnL)}
          </p>
        </div>

        {/* Long / Short */}
        <div className="grid grid-cols-2 gap-3">

          <div className="rounded-lg border border-gray-100 p-3">
            <p className="text-xs text-gray-500">
              Long P&L
            </p>

            <p
              className={`mt-1 text-sm font-semibold ${
                stats.longPnL >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {formatMoney(stats.longPnL)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 p-3">
            <p className="text-xs text-gray-500">
              Short P&L
            </p>

            <p
              className={`mt-1 text-sm font-semibold ${
                stats.shortPnL >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {formatMoney(stats.shortPnL)}
            </p>
          </div>

        </div>

        {/* Total Trades */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-500">
            Total Trades
          </span>

          <span className="text-sm font-semibold text-gray-900">
            {stats.totalTrades}
          </span>
        </div>

      </div>
    </div>
  );
}