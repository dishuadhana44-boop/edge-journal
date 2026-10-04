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

function getSession(trade) {
  const session =
    trade?.session ??
    trade?.tradingSession ??
    trade?.marketSession ??
    trade?.sessionName;

  if (session) {
    return String(session);
  }

  const rawTime =
    trade?.openedAt ??
    trade?.openTime ??
    trade?.entryTime ??
    trade?.date;

  if (!rawTime) return "Unknown";

  const date = new Date(rawTime);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const hour = date.getHours();

  if (hour >= 0 && hour < 8) {
    return "Asian";
  }

  if (hour >= 8 && hour < 13) {
    return "London";
  }

  if (hour >= 13 && hour < 17) {
    return "New York";
  }

  return "New York";
}

export default function SessionPerformanceAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const sessions = useMemo(() => {
    const map = {};

    filteredTrades.forEach((trade) => {
      if (!trade) return;

      const session = getSession(trade);
      const pnl = getPnL(trade);

      if (!map[session]) {
        map[session] = {
          session,
          trades: 0,
          wins: 0,
          losses: 0,
          breakeven: 0,
          grossProfit: 0,
          grossLoss: 0,
          netPnL: 0,
        };
      }

      const item = map[session];

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

        expectancy:
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

  const bestSession =
    sessions.length > 0 ? sessions[0] : null;

  const worstSession =
    sessions.length > 0
      ? sessions[sessions.length - 1]
      : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Session Performance
        </h2>

      </div>

      {sessions.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No session data available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Best Session
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {bestSession?.session}
              </div>

              <div className="mt-1 text-sm font-medium text-green-600">
                +${bestSession?.netPnL.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500">
                Worst Session
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-900">
                {worstSession?.session}
              </div>

              <div
                className={`mt-1 text-sm font-medium ${
                  worstSession?.netPnL < 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {worstSession?.netPnL >= 0 ? "+" : ""}
                ${worstSession?.netPnL.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-3 pr-4 font-medium">
                    Session
                  </th>

                  <th className="py-3 px-4 font-medium">
                    Trades
                  </th>

                  <th className="py-3 px-4 font-medium">
                    Win Rate
                  </th>

                  <th className="py-3 px-4 font-medium">
                    Expectancy
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
                {sessions.map((item) => (
                  <tr
                    key={item.session}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-gray-900">
                        {item.session}
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
                        item.expectancy > 0
                          ? "text-green-600"
                          : item.expectancy < 0
                            ? "text-red-600"
                            : "text-gray-600"
                      }`}
                    >
                      {item.expectancy >= 0 ? "+" : ""}
                      ${item.expectancy.toFixed(2)}
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
        </>
      )}
    </div>
  );
}