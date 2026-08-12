import { useEffect, useState } from "react";
import { Plus, Play, BarChart3, CalendarDays, Clock3 } from "lucide-react";

const STORAGE_KEY = "backtestSessions";

export default function BacktestingOverview({
    onNewSession,
    onOpenSession,
    onAnalytics,
    onDeleteSession,
    refreshKey,
  }) {

    const [sessions, setSessions] = useState([]);
    const [deleteSession, setDeleteSession] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      setSessions(Array.isArray(saved) ? saved : []);
    } catch (error) {
      console.error("Failed to load backtest sessions:", error);
      setSessions([]);
    }
  }, [refreshKey]);

  const handleDeleteSession = (session) => {
    setDeleteSession(session);
  };
  
  const confirmDeleteSession = () => {
    if (!deleteSession) return;
  
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );
  
      const updated = saved.filter(
        (item) => item.id !== deleteSession.id
      );
  
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );
  
      setSessions(updated);
      setDeleteSession(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6">

      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
          Backtesting
          </h1>
  
          <p className="text-gray-500">
          Replay historical price data and simulate your trading strategies.
          </p>
        </div>

        <button
          onClick={onNewSession}
          className="
            inline-flex
            items-center
            gap-2
            rounded-xl
            bg-purple-600
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-purple-700
            active:scale-[0.98]
          "
        >
          <Plus size={17} />
          New Session
        </button>

      </div>

      {/* SESSION COUNT */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Your Sessions
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            {sessions.length === 0
              ? "No backtesting sessions yet"
              : `${sessions.length} session${
                  sessions.length === 1 ? "" : "s"
                }`}
          </p>
        </div>
      </div>

      {/* EMPTY STATE */}
      {sessions.length === 0 && (
        <div
          className="
            rounded-2xl
            border
            border-dashed
            border-gray-300
            bg-white
            px-6
            py-20
            text-center
          "
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
            <Play size={21} className="text-purple-600" />
          </div>

          <h3 className="text-sm font-semibold text-gray-900">
            No backtesting sessions
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Create your first session to start replaying historical data.
          </p>

          <button
            onClick={onNewSession}
            className="
              mt-5
              rounded-lg
              bg-purple-600
              px-4
              py-2
              text-sm
              font-medium
              text-white
              hover:bg-purple-700
            "
          >
            Create Session
          </button>
        </div>
      )}

      {/* SESSIONS */}
      <div className="space-y-4">

        {sessions.map((session) => {

          const balance = Number(session.balance || 0);

          const risk =
            session.riskPerTrade !== undefined &&
            session.riskPerTrade !== null
              ? `${session.riskPerTrade}%`
              : "—";

          return (
            <div
              key={session.id}
              className="
                rounded-2xl
                border
                border-gray-200
                bg-white
                p-5
                shadow-[0_4px_20px_rgba(0,0,0,0.03)]
                transition
                hover:border-purple-200
                hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]
              "
            >

              {/* TOP */}
              <div className="flex items-start justify-between">

                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {session.sessionName || "Untitled Session"}
                  </h3>

                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">
                      {session.symbol || "EURUSD"}
                    </span>

                    <span>•</span>

                    <span>
                      {session.interval || "15m"}
                    </span>
                  </div>
                </div>

                {/* SYMBOL BADGE */}
                <div className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
                  {session.symbol || "EURUSD"}
                </div>

              </div>

              {/* DETAILS */}
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">

                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-400">
                    Balance
                  </div>

                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    ${balance.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-400">
                    Risk / Trade
                  </div>

                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {risk}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <CalendarDays size={12} />
                    Start
                  </div>

                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {session.startDate || "—"}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock3 size={12} />
                    End
                  </div>

                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {session.endDate || "—"}
                  </div>
                </div>

              </div>

              {/* ACTIONS */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">

                <button
                  onClick={() => onAnalytics(session)}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-gray-200
                    bg-white
                    px-3.5
                    py-2
                    text-sm
                    font-medium
                    text-gray-700
                    transition
                    hover:border-purple-200
                    hover:bg-purple-50
                    hover:text-purple-700
                  "
                >
                  <BarChart3 size={16} />
                  Analytics
                </button>

                <button
                  onClick={() => onOpenSession(session)}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-purple-600
                    px-4
                    py-2
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-purple-700
                  "
                >
                  <Play size={16} />
                  Open
                </button>

                <button
  onClick={() => handleDeleteSession(session)}
  className="
    px-3 py-1.5
    rounded-lg
    border border-red-200
    text-red-600
    text-sm font-medium
    hover:bg-red-50
    transition
  "
>
  Delete
</button>

              </div>

            </div>
          );
        })}

      </div>

      {deleteSession && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center">
    
    {/* Overlay */}
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={() => setDeleteSession(null)}
    />

    {/* Modal */}
    <div className="
      relative
      w-[420px]
      rounded-2xl
      bg-white
      p-6
      shadow-2xl
      border
      border-gray-200
    ">
      
      <div className="flex items-start gap-4">
        
        <div className="
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-red-50
          text-red-600
        ">
          ⚠
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Delete Backtesting Session?
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-800">
              {deleteSession.sessionName}
            </span>
            ?
          </p>
        </div>

      </div>

      <div className="
        mt-5
        rounded-xl
        bg-red-50
        px-4
        py-3
        text-sm
        text-red-700
      ">
        This action cannot be undone. All data associated
        with this backtesting session will be removed.
      </div>

      <div className="mt-6 flex justify-end gap-3">

        <button
          onClick={() => setDeleteSession(null)}
          className="
            rounded-xl
            border
            border-gray-200
            bg-white
            px-4
            py-2.5
            text-sm
            font-medium
            text-gray-700
            hover:bg-gray-50
          "
        >
          Cancel
        </button>

        <button
  onClick={confirmDeleteSession}
  className="
    rounded-xl
    bg-red-600
    px-4
    py-2.5
    text-sm
    font-semibold
    text-white
    hover:bg-red-700
    transition
  "
>
  Delete Session
</button>

      </div>

    </div>
  </div>
)}

    </div>
  );
}