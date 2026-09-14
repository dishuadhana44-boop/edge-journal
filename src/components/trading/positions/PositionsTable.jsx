import { useTrade } from "../../../context/TradeContext";

import OpenPositionRow from "./rows/OpenPositionRow";
import PositionRow from "./PositionRow";

export default function PositionsTable({ activeTab }) {
  const {
    openTrades = [],
    closedTrades = [],
  } = useTrade();

  const isOpenTab = activeTab === "open";

  const rows = isOpenTab
    ? openTrades
    : activeTab === "closed"
    ? closedTrades
    : [];

  const emptyMessage = isOpenTab
    ? {
        title: "No open positions",
        description: "Your open positions will appear here",
      }
    : {
        title: "No closed positions",
        description: "Your closed positions will appear here",
      };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-[110px] px-6 py-3 text-left">
              Instrument
            </th>

            <th className="w-[80px] py-3 text-center">
              Side
            </th>

            <th className="w-[80px] py-3 text-center">
              Lots
            </th>

            <th className="w-[100px] py-3 text-right">
              Entry
            </th>

            <th className="w-[100px] py-3 text-right">
              Current
            </th>

            <th className="w-[110px] py-3 text-right">
              Take Profit
            </th>

            <th className="w-[100px] py-3 text-right">
              Stop Loss
            </th>

            <th className="w-[110px] py-3 text-right">
              P/L
            </th>

            <th className="w-[110px] py-3 text-right">
              Margin
            </th>

            <th className="w-[110px] py-3 text-right">
              Duration
            </th>

            <th className="w-[100px] py-3 text-center">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.length > 0 ? (
            rows.map((trade, index) => {
              const tradeKey =
                trade.positionId ||
                trade.brokerPositionId ||
                trade.id ||
                index;

              // OPEN POSITIONS
              if (isOpenTab) {
                return (
                  <OpenPositionRow
                    key={tradeKey}
                    trade={trade}
                  />
                );
              }

              // CLOSED POSITIONS
              return (
                <PositionRow
                  key={tradeKey}
                  trade={trade}
                />
              );
            })
          ) : (
            <tr>
              <td
                colSpan={11}
                className="px-4 py-16 text-center"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="mb-3 text-3xl">
                    📊
                  </div>

                  <p className="text-base font-semibold text-gray-700">
                    {emptyMessage.title}
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    {emptyMessage.description}
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}