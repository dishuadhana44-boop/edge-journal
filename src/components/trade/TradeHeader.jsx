import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Save,
  } from "lucide-react";
import { useNavigate } from "react-router-dom";

function TradeHeader({
  trade,
  previousTrade,
  nextTrade,
  onSave,
}) {
  const navigate = useNavigate();

  if (!trade) {
    return (
      <div className="h-12 flex items-center px-4 text-gray-500">
        Loading trade...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between h-[10px]">

      {/* Left */}
      <div className="flex items-center gap-4">

        <button
          onClick={() => navigate("/tradelog")}
          className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Symbol + Info */}
        <div className="flex items-center gap-3">

        <h1 className="text-[20px] font-bold text-gray-900">
  {trade?.pair || "Unknown Pair"}
</h1>

<span className="text-gray-500 text-[15px] font-medium">
  {trade?.direction || "-"} • {trade?.day || "-"} •{" "}
  {trade?.date
    ? new Date(trade.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-"}
</span>

        </div>

      </div>

      {/* Right */}
      <div className="flex items-center gap-2">

      <button
    disabled={!previousTrade}
    onClick={() =>
        previousTrade &&
        navigate(`/trade/${String(previousTrade.id)}`)
    }
    className="flex items-center gap-2 h-9 px-4 rounded-xl border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
>
    <ChevronLeft size={16} />
    Previous
</button>

<button
    disabled={!nextTrade}
    onClick={() =>
        nextTrade &&
        navigate(`/trade/${String(nextTrade.id)}`)
    }
    className="flex items-center gap-2 h-9 px-4 rounded-xl border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
>
    Next
    <ChevronRight size={16} />
</button>
<button
  onClick={onSave}
  className="flex items-center gap-2 h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
>
  <Save size={17} />
  Save
</button>

      </div>

    </div>
  );
}

export default TradeHeader;