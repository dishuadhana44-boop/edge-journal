import OpenPositionRow from "../rows/OpenPositionRow";
import { useTrade } from "../../../../context/TradeContext";

export default function OpenPositionsTable({ demo = false }) {
  // ==========================================================
  // GET REAL POSITIONS FROM TRADE CONTEXT
  // ==========================================================

  const { openTrades = [] } = useTrade();

  // Debug
  console.log("📊 OPEN POSITIONS TABLE:", openTrades);

  return (
    <div className="h-[340px] overflow-y-auto overflow-x-hidden">
      <table className="w-full min-w-[1100px] text-sm">
        {/* ==================================================
            TABLE HEADER
        ================================================== */}

        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="w-[110px] px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Instrument
            </th>

            <th className="w-[80px] py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Side
            </th>

            <th className="w-[80px] py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Lots
            </th>

            <th className="w-[100px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Entry
            </th>

            <th className="w-[100px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Current
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Take Profit
            </th>

            <th className="w-[100px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Stop Loss
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              P/L
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Margin
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Duration
            </th>

            <th className="w-[100px] py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>

        {/* ==================================================
            TABLE BODY
        ================================================== */}

        <tbody className="bg-white">
          {openTrades.length > 0 ? (
            openTrades.map((trade, index) => (
              <OpenPositionRow
                key={
                  trade.positionId ??
                  trade.brokerPositionId ??
                  trade.ticket ??
                  trade.id ??
                  index
                }
                trade={trade}
                demo={demo}
              />
            ))
          ) : (
            <tr>
              <td
                colSpan={11}
                className="py-12 text-center text-gray-500"
              >
                No open positions
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}