// src/pages/Backtesting.jsx

import { useState } from "react";

import { useBacktest } from "../hooks/useBacktest";
import { fetchHistoricalCandlesCached } from "../services/twelveData";


import BacktestChart from "../components/trading/backtest/BacktestChart";
import CreateBacktestSession from "../components/trading/backtest/CreateBacktestSession";
import BacktestingOverview from "../components/trading/backtest/BacktestingOverview";

const STORAGE_KEY = "backtestSessions";

function Backtesting() {

  // -----------------------------------------
  // PAGE MODE
  // -----------------------------------------

  const [view, setView] = useState("overview");

const [showSessionModal, setShowSessionModal] =
useState(false);

const [sessionRefreshKey, setSessionRefreshKey] = useState(0);

const [deleteSession, setDeleteSession] = useState(null);

  const [session, setSession] = useState(null);

  // -----------------------------------------
  // BACKTEST WORKSPACE STATE
  // -----------------------------------------

  const [symbol, setSymbol] = useState("EURUSD");

  const [interval, setIntervalValue] =
    useState("15m");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [candles, setCandles] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const backtest = useBacktest(candles);

  // -----------------------------------------
  // NEW SESSION
  // -----------------------------------------

  const handleNewSession = () => {
    setShowSessionModal(true);
  };

  // -----------------------------------------
  // CREATE SESSION
  // -----------------------------------------

  const handleCreateSession = (config) => {

    const newSession = {
      ...config,

      id:
        config.id ||
        Date.now(),

      createdAt:
        new Date().toISOString(),
    };

    // Save session
    try {

      const existing =
        JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]"
        );

      const updated = [
        newSession,
        ...existing,
      ];

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );

      setSessionRefreshKey((prev) => prev + 1);

    } catch (error) {

      console.error(
        "Failed to save backtest session:",
        error
      );

    }

    setSession(newSession);

    setSymbol(
      newSession.symbol || "EURUSD"
    );

    setStartDate(
      newSession.startDate || ""
    );

    setEndDate(
      newSession.endDate || ""
    );

    setShowSessionModal(false);

    // New session is created,
    // but user stays on overview.
    setView("overview");
  };

  const handleDeleteSession = (selectedSession) => {
    setDeleteSession(selectedSession);
  };

  const confirmDeleteSession = () => {
    if (!deleteSession) return;
  
    try {
      const existing = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );
  
      const updated = existing.filter(
        (item) => item.id !== deleteSession.id
      );
  
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );
  
      setSessionRefreshKey((prev) => prev + 1);
  
      setDeleteSession(null);
    } catch (error) {
      console.error(
        "Failed to delete backtest session:",
        error
      );
    }
  };

  // -----------------------------------------
  // OPEN SESSION
  // -----------------------------------------

  const handleOpenSession = (selectedSession) => {

    setSession(selectedSession);

    setSymbol(
      selectedSession.symbol || "EURUSD"
    );

    setIntervalValue(
      selectedSession.interval || "15m"
    );

    setStartDate(
      selectedSession.startDate || ""
    );

    setEndDate(
      selectedSession.endDate || ""
    );

    setCandles([]);

    setView("workspace");

    // Automatically load historical data
    handleLoadData(
      selectedSession.symbol,
      selectedSession.startDate,
      selectedSession.endDate,
      selectedSession.interval
    );
  };

  // -----------------------------------------
  // ANALYTICS
  // -----------------------------------------

  const handleAnalytics = (selectedSession) => {

    setSession(selectedSession);

    setView("analytics");

  };

  // -----------------------------------------
  // LOAD DATA
  // -----------------------------------------

  const handleLoadData = async (
    overrideSymbol,
    overrideStart,
    overrideEnd,
    overrideInterval
  ) => {

    setIsLoading(true);

    try {

      const data =
        await fetchHistoricalCandlesCached({

          symbol:
            overrideSymbol ||
            symbol,

          interval:
            overrideInterval ||
            interval,

          startDate:
            overrideStart ||
            startDate,

          endDate:
            overrideEnd ||
            endDate,

        });

      setCandles(data);

    } catch (err) {

      console.error(err);

      alert(err.message);

    } finally {

      setIsLoading(false);

    }
  };

  // =========================================
  // OVERVIEW
  // =========================================

  if (view === "overview") {

    return (
      <>
       <BacktestingOverview
  onNewSession={handleNewSession}
  onOpenSession={handleOpenSession}
  onAnalytics={handleAnalytics}
  onDeleteSession={handleDeleteSession}
  refreshKey={sessionRefreshKey}
/>

        <CreateBacktestSession
          open={showSessionModal}
          onClose={() =>
            setShowSessionModal(false)
          }
          onCreate={handleCreateSession}
        />
      </>
    );
  }

  // =========================================
  // ANALYTICS PLACEHOLDER
  // =========================================

  if (view === "analytics") {

    return (
      <div className="min-h-full bg-gray-50 px-6 py-6">

        <button
          onClick={() => setView("overview")}
          className="mb-5 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          ← Back to Sessions
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-8">

          <h1 className="text-xl font-bold text-gray-900">
            {session?.sessionName || "Backtest"} Analytics
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Analytics for this backtesting session will be built here.
          </p>

        </div>

      </div>
    );
  }

  // =========================================
  // BACKTEST WORKSPACE
  // =========================================

// =========================================
// BACKTEST WORKSPACE
// =========================================

return (
  <div className="h-screen w-full overflow-hidden bg-[#0c0d12]">

    {/* FULL SCREEN BACKTEST TERMINAL */}
    <BacktestChart
      candles={candles}
      backtest={backtest}
      session={session}
    />

    {/* SESSION MODAL */}
    <CreateBacktestSession
      open={showSessionModal}
      onClose={() => setShowSessionModal(false)}
      onCreate={handleCreateSession}
    />

    {/* DELETE CONFIRMATION MODAL */}
    {deleteSession && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">

        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteSession(null)}
        />

        {/* Modal */}
        <div className="relative w-[420px] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">

          <div className="flex items-start gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
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

          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            This action cannot be undone. All data associated
            with this backtesting session will be removed.
          </div>

          <div className="mt-6 flex justify-end gap-3">

            <button
              onClick={() => setDeleteSession(null)}
              className="
                rounded-xl
                border border-gray-200
                bg-white
                px-4 py-2.5
                text-sm font-medium
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
                px-4 py-2.5
                text-sm font-semibold
                text-white
                hover:bg-red-700
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

export default Backtesting;