import { useTrade } from "../../../../context/TradeContext";
import OpenPositionRow from "../rows/OpenPositionRow";

export default function OpenPositionsTable() {

  const { openTrades } = useTrade();

  return (

    <div
  className="
    h-[340px]
    overflow-y-auto
    overflow-x-hidden
  "
>

<table className="w-full">

      <thead className="sticky top-0 bg-white z-20 border-b">

        <tr className="text-xs uppercase text-gray-500">

          <th className="px-6 py-4 text-left">Instrument</th>

          <th className="px-4 text-left">Direction</th>

          <th className="px-4 text-left">Lots</th>

          <th className="px-4 text-left">Entry</th>

          <th className="px-4 text-left">Current</th>

          <th className="px-4 text-left">SL</th>

          <th className="px-4 text-left">TP</th>

          <th className="px-4 text-left">P/L</th>

          <th className="px-4 text-left">Duration</th>

          <th className="px-4 text-center">Actions</th>

        </tr>

      </thead>

      <tbody>

        {openTrades.length === 0 ? (

          <>
            <OpenPositionRow demo />
            <OpenPositionRow demo />
            <OpenPositionRow demo />
            <OpenPositionRow demo />
            <OpenPositionRow demo />
          </>

        ) : (

          openTrades.map((trade) => (

            <OpenPositionRow
              key={trade.id}
              trade={trade}
            />

          ))

        )}

      </tbody>

    </table>
    </div>
  );

}