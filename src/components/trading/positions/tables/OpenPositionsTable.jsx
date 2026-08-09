import { useTrade } from "../../../../context/TradeContext";
import OpenPositionRow from "../rows/OpenPositionRow";
import EmptyPositions from "../EmptyPositions";

export default function OpenPositionsTable() {

  const { openTrades } = useTrade();

 // console.log("TABLE OPEN TRADES:", openTrades);

  return (
    <div
      className="
        h-[340px]
        overflow-y-auto
        overflow-x-hidden
      "
    >
      <table className="w-full">

      <thead className="sticky top-0 bg-white  z-20">
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
      Current
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
      Margin
    </th>

    <th className="w-[90px] text-right">
      Duration
    </th>

    <th className="w-[90px] text-center">
      Actions
    </th>

  </tr>
</thead>

        <tbody>

        {openTrades.length === 0 ? (
  <tr>
    <td colSpan={10}>
      <EmptyPositions />
    </td>
  </tr>
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