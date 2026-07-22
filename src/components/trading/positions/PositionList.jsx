import { useTrade } from "../../../context/TradeContext";
import PositionCard from "./PositionCard";

export default function PositionList() {

  const { openTrades } = useTrade();

  return (

    <div className="mt-4 space-y-3">

      <h2 className="font-semibold text-lg">

        Open Positions ({openTrades.length})

      </h2>

      {openTrades.map((trade) => (

        <PositionCard

          key={trade.id}

          trade={trade}

        />

      ))}

    </div>

  );

}