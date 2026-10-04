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

function getSide(trade) {
  const value = String(
    trade?.side ??
      trade?.direction ??
      trade?.type ??
      ""
  ).toLowerCase();

  if (
    value === "buy" ||
    value === "long"
  ) {
    return "long";
  }

  if (
    value === "sell" ||
    value === "short"
  ) {
    return "short";
  }

  return null;
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

function DirectionCard({ title, data }) {
  const winRate =
    data.trades > 0
      ? (data.wins / data.trades) * 100
      : 0;

  const averagePnL =
    data.trades > 0
      ? data.pnl / data.trades
      : 0;

  const profitFactor =
    data.grossLoss > 0
      ? data.grossProfit / data.grossLoss
      : data.grossProfit > 0
        ? Infinity
        : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          {title}
        </h4>

        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
          {data.trades} trades
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500">
            Net P&L
          </p>

          <p
            className={`mt-1 text-lg font-semibold ${
              data.pnl > 0
                ? "text-green-600"
                : data.pnl < 0
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {formatMoney(data.pnl)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Win Rate
          </p>

          <p className="mt-1 text-lg font-semibold text-gray-900">
            {winRate.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Avg P&L
          </p>

          <p
            className={`mt-1 text-sm font-semibold ${
              averagePnL > 0
                ? "text-green-600"
                : averagePnL < 0
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {formatMoney(averagePnL)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Profit Factor
          </p>

          <p className="mt-1 text-sm font-semibold text-gray-900">
            {profitFactor === Infinity
              ? "∞"
              : profitFactor.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs">
        <span className="text-green-600">
          {data.wins} Wins
        </span>

        <span className="text-red-600">
          {data.losses} Losses
        </span>

        <span className="text-gray-500">
          {data.breakeven} BE
        </span>
      </div>
    </div>
  );
}

export default function LongShortAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const data = useMemo(() => {
    const createStats = () => ({
      trades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      pnl: 0,
      grossProfit: 0,
      grossLoss: 0,
    });

    const result = {
      long: createStats(),
      short: createStats(),
    };

    if (!Array.isArray(filteredTrades)) {
      return result;
    }

    filteredTrades.forEach((trade) => {
      const side = getSide(trade);

      if (!side) return;

      const pnl = getPnL(trade);
      const stats = result[side];

      stats.trades += 1;
      stats.pnl += pnl;

      if (pnl > 0) {
        stats.wins += 1;
        stats.grossProfit += pnl;
      } else if (pnl < 0) {
        stats.losses += 1;
        stats.grossLoss += Math.abs(pnl);
      } else {
        stats.breakeven += 1;
      }
    });

    return result;
  }, [filteredTrades]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Long vs Short Analysis
        </h3>

       
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DirectionCard
          title="Long Positions"
          data={data.long}
        />

        <DirectionCard
          title="Short Positions"
          data={data.short}
        />
      </div>
    </div>
  );
}