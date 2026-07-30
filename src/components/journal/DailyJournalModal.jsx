import { X } from "lucide-react";

export default function DailyJournalModal({
  trade,
  onClose,
}) {
  if (!trade) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-white rounded-3xl w-[620px] p-8 shadow-2xl">

        <div className="flex justify-between items-center mb-6">

          <div>

            <h2 className="text-2xl font-bold">
              Daily Journal
            </h2>

            <p className="text-gray-500">
              {trade.date}
            </p>

          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100"
          >
            <X size={22}/>
          </button>

        </div>

        <div className="grid grid-cols-3 gap-5 mb-8">

          <div className="border rounded-2xl p-4">

            <p className="text-xs text-gray-500">
              Total P&L
            </p>

            <h3
              className={`text-2xl font-bold mt-2 ${
                trade.pnl >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              ${trade.pnl}
            </h3>

          </div>

          <div className="border rounded-2xl p-4">

            <p className="text-xs text-gray-500">
              Trades
            </p>

            <h3 className="text-2xl font-bold mt-2">
              {trade.trades}
            </h3>

          </div>

          <div className="border rounded-2xl p-4">

            <p className="text-xs text-gray-500">
              Win Rate
            </p>

            <h3 className="text-2xl font-bold mt-2">
              75%
            </h3>

          </div>

        </div>

        <div className="border rounded-2xl p-5">

          <p className="text-sm text-gray-500 mb-2">
            Notes
          </p>

          <p className="text-gray-700">
            No journal written for this day.
          </p>

        </div>

        <button
          className="
          mt-8
          w-full
          bg-violet-600
          hover:bg-violet-700
          text-white
          py-3
          rounded-2xl
          font-semibold
          "
        >
          Open Full Journal
        </button>

      </div>

    </div>
  );
}