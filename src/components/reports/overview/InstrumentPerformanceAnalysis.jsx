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

function getInstrument(trade) {
  return (
    trade?.symbol ??
    trade?.instrument ??
    trade?.ticker ??
    trade?.asset ??
    trade?.market ??
    "Unknown"
  );
}

export default function InstrumentPerformanceAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const instruments = useMemo(() => {
    const map = {};

    filteredTrades.forEach((trade) => {
      if (!trade) return;

      const instrument = getInstrument(trade);
      const pnl = getPnL(trade);

      if (!map[instrument]) {
        map[instrument] = {
          instrument,
          trades: 0,
          wins: 0,
          losses: 0,
          breakeven: 0,
          grossProfit: 0,
          grossLoss: 0,
          netPnL: 0,
        };
      }

      const item = map[instrument];

      item.trades += 1;
      item.netPnL += pnl;

      if (pnl > 0) {
        item.wins += 1;
        item.grossProfit += pnl;
      } else if (pnl < 0) {
        item.losses += 1;
        item.grossLoss += Math.abs(pnl);
      } else {
        item.breakeven += 1;
      }
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        winRate:
          item.trades > 0
            ? (item.wins / item.trades) * 100
            : 0,

        avgPnL:
          item.trades > 0
            ? item.netPnL / item.trades
            : 0,

        profitFactor:
          item.grossLoss > 0
            ? item.grossProfit / item.grossLoss
            : item.grossProfit > 0
              ? Infinity
              : 0,
      }))
      .sort((a, b) => b.netPnL - a.netPnL);
  }, [filteredTrades]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Instrument Performance
        </h2>

      
      </div>

      {instruments.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No instrument data available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-3 pr-4 font-medium">
                  Instrument
                </th>

                <th className="py-3 px-4 font-medium">
                  Trades
                </th>

                <th className="py-3 px-4 font-medium">
                  Win Rate
                </th>

                <th className="py-3 px-4 font-medium">
                  Avg P&L
                </th>

                <th className="py-3 px-4 font-medium">
                  Profit Factor
                </th>

                <th className="py-3 pl-4 font-medium text-right">
                  Net P&L
                </th>
              </tr>
            </thead>

            <tbody>
              {instruments.map((item) => (
                <tr
                  key={item.instrument}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-gray-900">
                      {item.instrument}
                    </div>

                    <div className="text-xs text-gray-400 mt-1">
                      {item.wins}W / {item.losses}L /{" "}
                      {item.breakeven}BE
                    </div>
                  </td>

                  <td className="py-3 px-4 text-gray-700">
                    {item.trades}
                  </td>

                  <td className="py-3 px-4 text-gray-700">
                    {item.winRate.toFixed(1)}%
                  </td>

                  <td
                    className={`py-3 px-4 font-medium ${
                      item.avgPnL > 0
                        ? "text-green-600"
                        : item.avgPnL < 0
                          ? "text-red-600"
                          : "text-gray-600"
                    }`}
                  >
                    {item.avgPnL >= 0 ? "+" : ""}
                    ${item.avgPnL.toFixed(2)}
                  </td>

                  <td className="py-3 px-4 text-gray-700">
                    {item.profitFactor === Infinity
                      ? "∞"
                      : item.profitFactor.toFixed(2)}
                  </td>

                  <td
                    className={`py-3 pl-4 text-right font-semibold ${
                      item.netPnL > 0
                        ? "text-green-600"
                        : item.netPnL < 0
                          ? "text-red-600"
                          : "text-gray-600"
                    }`}
                  >
                    {item.netPnL >= 0 ? "+" : ""}
                    ${item.netPnL.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}