import { useState } from "react";
import {
  MoreVertical,
  X,
  Pencil,
  Copy,
  RotateCw,
  Scissors,
} from "lucide-react";

import { useTrade } from "../../../../context/TradeContext";

export default function PositionActions({ trade }) {

  const [open, setOpen] = useState(false);

  const { closeTrade } = useTrade();

  return (

    <div className="relative">

      <button
        onClick={() => setOpen(!open)}
        className="
          p-2
          rounded-lg
          hover:bg-gray-100
        "
      >
        <MoreVertical size={17} />
      </button>

      {open && (

        <div
          className="
            absolute
            right-0
            mt-2

            w-52

            rounded-xl

            border
            border-gray-200

            bg-white

            shadow-xl

            overflow-hidden

            z-50
          "
        >

          <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50">
            <Pencil size={16}/>
            Modify Trade
          </button>

          <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50">
            <Copy size={16}/>
            Duplicate
          </button>

          <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50">
            <RotateCw size={16}/>
            Reverse Position
          </button>

          <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50">
            <Scissors size={16}/>
            Partial Close
          </button>

          <button
            onClick={() => closeTrade(trade.id)}
            className="
              flex
              items-center
              gap-3

              w-full

              px-4
              py-3

              text-red-600

              hover:bg-red-50
            "
          >
            <X size={16}/>
            Close Trade
          </button>

        </div>

      )}

    </div>

  );

}