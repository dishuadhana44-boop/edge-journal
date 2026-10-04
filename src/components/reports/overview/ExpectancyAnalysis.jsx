import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

export default function ExpectancyAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const stats = useMemo(() => {
    const trades = Array.isArray(filteredTrades)
      ? filteredTrades.filter(Boolean)
      : [];

    if (trades.length === 0) {
      return {
        expectancy: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        winRate: 0,
      };
    }

    const pnls = trades.map((trade) => {
      const pnl = Number(
        trade?.pnl ??
          trade?.profit ??
          trade?.netPL ??
          trade?.netProfit ??
          trade?.netPnL ??
          0
      );

      return Number.isFinite(pnl) ? pnl : 0;
    });

    const wins = pnls.filter((pnl) => pnl > 0);
    const losses = pnls.filter((pnl) => pnl < 0);

    const winRate = (wins.length / pnls.length) * 100;

    const averageWin =
      wins.length > 0
        ? wins.reduce((sum, pnl) => sum + pnl, 0) / wins.length
        : 0;

    const averageLoss =
      losses.length > 0
        ? Math.abs(
            losses.reduce((sum, pnl) => sum + pnl, 0) /
              losses.length
          )
        : 0;

    const grossProfit = wins.reduce(
      (sum, pnl) => sum + pnl,
      0
    );

    const grossLoss = Math.abs(
      losses.reduce((sum, pnl) => sum + pnl, 0)
    );

    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0;

    const expectancy =
      pnls.length > 0
        ? pnls.reduce((sum, pnl) => sum + pnl, 0) /
          pnls.length
        : 0;

    return {
      expectancy,
      profitFactor,
      averageWin,
      averageLoss,
      winRate,
    };
  }, [filteredTrades]);

  const formatMoney = (value) => {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";

    return `${sign}$${Math.abs(value).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Expectancy & Profitability
        </h3>

      
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Expectancy
          </p>

          <p
            className={`mt-2 text-xl font-semibold ${
              stats.expectancy > 0
                ? "text-green-600"
                : stats.expectancy < 0
                  ? "text-red-600"
                  : "text-gray-900"
            }`}
          >
            {formatMoney(stats.expectancy)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Profit Factor
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {stats.profitFactor === Infinity
              ? "∞"
              : stats.profitFactor.toFixed(2)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Average Win
          </p>

          <p className="mt-2 text-xl font-semibold text-green-600">
            {formatMoney(stats.averageWin)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Average Loss
          </p>

          <p className="mt-2 text-xl font-semibold text-red-600">
            {formatMoney(stats.averageLoss)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Win Rate
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {stats.winRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}