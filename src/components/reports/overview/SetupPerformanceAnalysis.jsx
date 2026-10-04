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

function getSetup(trade) {
  return (
    trade?.setup ??
    trade?.plan ??
    trade?.strategy ??
    trade?.setupName ??
    trade?.planName ??
    trade?.playbook ??
    "Uncategorized"
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

export default function SetupPerformanceAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const setups = useMemo(() => {
    const map = new Map();

    if (!Array.isArray(filteredTrades)) {
      return [];
    }

    filteredTrades.forEach((trade) => {
      const setup = String(getSetup(trade)).trim() || "Uncategorized";
      const pnl = getPnL(trade);

      if (!map.has(setup)) {
        map.set(setup, {
          setup,
          trades: 0,
          wins: 0,
          losses: 0,
          pnl: 0,
          grossProfit: 0,
          grossLoss: 0,
        });
      }

      const item = map.get(setup);

      item.trades += 1;
      item.pnl += pnl;

      if (pnl > 0) {
        item.wins += 1;
        item.grossProfit += pnl;
      } else if (pnl < 0) {
        item.losses += 1;
        item.grossLoss += Math.abs(pnl);
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        winRate:
          item.trades > 0
            ? (item.wins / item.trades) * 100
            : 0,
        averagePnL:
          item.trades > 0
            ? item.pnl / item.trades
            : 0,
        profitFactor:
          item.grossLoss > 0
            ? item.grossProfit / item.grossLoss
            : item.grossProfit > 0
              ? Infinity
              : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  const maxAbsPnL = Math.max(
    ...setups.map((item) => Math.abs(item.pnl)),
    1
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Setup / Plan Performance
        </h3>

       
      </div>

      {setups.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Setup
                </th>

                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Trades
                </th>

                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Win Rate
                </th>

                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Avg P&L
                </th>

                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Profit Factor
                </th>

                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Net P&L
                </th>
              </tr>
            </thead>

            <tbody>
              {setups.map((item) => {
                const width =
                  (Math.abs(item.pnl) / maxAbsPnL) * 100;

                return (
                  <tr
                    key={item.setup}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="py-3">
                      <div className="min-w-[180px]">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.setup}
                        </p>

                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          {item.pnl !== 0 && (
                            <div
                              className={`h-full rounded-full ${
                                item.pnl > 0
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                              style={{
                                width: `${width}%`,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 text-right text-sm text-gray-700">
                      {item.trades}
                    </td>

                    <td className="py-3 text-right text-sm font-medium text-gray-700">
                      {item.winRate.toFixed(1)}%
                    </td>

                    <td
                      className={`py-3 text-right text-sm font-medium ${
                        item.averagePnL > 0
                          ? "text-green-600"
                          : item.averagePnL < 0
                            ? "text-red-600"
                            : "text-gray-700"
                      }`}
                    >
                      {formatMoney(item.averagePnL)}
                    </td>

                    <td className="py-3 text-right text-sm font-medium text-gray-700">
                      {item.profitFactor === Infinity
                        ? "∞"
                        : item.profitFactor.toFixed(2)}
                    </td>

                    <td
                      className={`py-3 text-right text-sm font-semibold ${
                        item.pnl > 0
                          ? "text-green-600"
                          : item.pnl < 0
                            ? "text-red-600"
                            : "text-gray-700"
                      }`}
                    >
                      {formatMoney(item.pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No setup or plan performance data available.
        </div>
      )}
    </div>
  );
}