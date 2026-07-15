import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SquarePen, Share2, Trash2 } from "lucide-react";

function TradeTable({ trades, onDelete, onEdit }) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-x-auto">
      <table className="w-full">

        <thead className="bg-gray-50">
          <tr className="text-left text-sm text-gray-600">
            <th className="px-5 py-4">Pair</th>
            <th className="px-5 py-4">Date</th>
            <th className="px-5 py-4">Session</th>
            <th className="px-5 py-4">Result</th>
            <th className="px-5 py-4">Direction</th>
            <th className="px-5 py-4">P&L</th>
            <th className="px-5 py-4">Day</th>
            <th className="px-5 py-4">RR</th>
            <th className="px-5 py-4 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {(trades || []).map((trade) => (
            <tr key={trade.id} className="border-t">

              <td className="px-5 py-4 font-medium">{trade.pair}</td>

              <td className="px-5 py-4">{trade.date}</td>

              <td className="px-5 py-4">{trade.session}</td>

              <td
                className={`px-5 py-4 font-semibold ${
                  trade.result === "Win"
                    ? "text-green-600"
                    : trade.result === "Loss"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              >
                {trade.result}
              </td>

              <td className="px-5 py-4">{trade.direction}</td>

              <td
  className={`px-5 py-4 font-semibold ${
    trade.pnl.toString().includes("-")
      ? "text-red-600"
      : "text-green-600"
  }`}
>
  {trade.pnl}
</td>

              <td className="px-5 py-4">{trade.day}</td>

              <td className="px-5 py-4">{trade.rr}</td>

              <td className="px-5 py-4">
                <div className="flex justify-center gap-4">


                  
                <div className="relative">

<button
  onClick={() =>
    setOpenMenu(
      openMenu === trade.id ? null : trade.id
    )
  }
  className="hover:text-purple-600 transition"
>
  <SquarePen size={18} />
</button>

{openMenu === trade.id && (
  <div className="absolute right-0 top-7 w-44 bg-white rounded-xl border shadow-lg z-50 overflow-hidden">

<button
 onClick={() => {
  onEdit(trade);
  setOpenMenu(null);
}}
  className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm"
>
  ✏️ Edit Trade
</button>

    <button
  onClick={() => {
    setOpenMenu(null);
    navigate(`/trade/${trade.id}`);
  }}
  className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm"
>
  📖 Open Journal
</button>

  </div>
)}

</div>

                  <Share2
                    size={18}
                    className="cursor-pointer hover:text-blue-600"
                  />


             <Trash2
             size={18}
             onClick={() => onDelete(trade.id)}
              className="cursor-pointer hover:text-red-600 transition"
               />

                </div>
              </td>

            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}

export default TradeTable;