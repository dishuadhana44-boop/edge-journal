import { useTrade } from "../../../../context/TradeContext";
import PositionRow from "../PositionRow";

export default function ClosedPositionsTable() {

  const { closedTrades } = useTrade();

  if (closedTrades.length === 0) {

    return (

      <div className="p-16 text-center text-gray-500">

        <h2 className="text-lg font-semibold">

          No Closed Trades

        </h2>

        <p className="mt-2 text-sm">

          Closed trades will appear here.

        </p>

      </div>

    );

  }

  return (

    <div
  className="
    h-[340px]
    overflow-y-auto
    overflow-x-hidden
  "
>

<table className="w-full">

      <thead className="sticky top-0 bg-white border-b">

        <tr>

          <th className="px-6 py-4 text-left">Instrument</th>
          <th>Direction</th>
          <th>Lots</th>
          <th>Entry</th>
          <th>Current</th>
          <th>SL</th>
          <th>TP</th>
          <th>P/L</th>
          <th>Duration</th>
          <th>Actions</th>

        </tr>

      </thead>

      <tbody>

        {closedTrades.map((trade) => (

          <PositionRow
            key={trade.id}
            trade={trade}
          />

        ))}

      </tbody>

    </table>
    </div>
  );

}