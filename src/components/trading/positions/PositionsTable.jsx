import { useTrade } from "../../../context/TradeContext";
import PositionRow from "./PositionRow";

export default function PositionsTable({ activeTab }) {

  const {

    openTrades,
    closedTrades,

  } = useTrade();

  const rows =
    activeTab === "open"
      ? openTrades
      : activeTab === "closed"
      ? closedTrades
      : [];

  return (

    <table className="w-full text-sm">

      <thead className="bg-gray-50">

        <tr>

          <th className="px-4 py-3 text-left">Instrument</th>

          <th className="text-left">Direction</th>

          <th className="text-left">Size</th>

          <th className="text-left">Entry </th>

          <th className="text-left">Current</th>

          <th className="text-left">SL</th>

          <th className="text-left">TP</th>

          <th className="text-left">P/L</th>
          

          <th className="text-left">Duration</th>

          <th className="text-center">Actions</th>

        </tr>

      </thead>

      <tbody>

        {rows.map((trade)=>(

          <PositionRow

            key={trade.id}

            trade={trade}

          />

        ))}

      </tbody>

    </table>

  );

}