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

<thead className="sticky top-0 bg-white border-b z-20">
  <tr className="text-xs uppercase text-gray-500">

    <th className="w-[90px] px-6 py-4 text-left">
      Instrument
    </th>

    <th className="w-[90px] text-center">
      Side
    </th>

    <th className="w-[90px] text-center">
      Lots
    </th>

    <th className="w-[90px] text-right">
      Entry
    </th>

 

    <th className="w-[90px] text-right">
      TakeProfit
    </th>

    <th className="w-[90px] text-right">
      StopLoss
    </th>

    <th className="w-[90px] text-right">
      P/L
    </th>

    <th className="w-[90px] text-right">
      Duration
    </th>

    <th className="w-[90px] text-right">
      Margin
    </th>

    <th className="w-[90px] text-center">
      Actions
    </th>

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