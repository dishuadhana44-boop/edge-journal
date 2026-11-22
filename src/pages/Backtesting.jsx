// src/pages/Backtesting.jsx

import { useState } from "react";

import BacktestWorkspace from "../components/trading/backtest/workspace/BacktestWorkspace";
import CreateBacktestSession from "../components/trading/backtest/CreateBacktestSession";
import BacktestingOverview from "../components/trading/backtest/BacktestingOverview";

const STORAGE_KEY = "backtestSessions";

function Backtesting() {
  const [view, setView] = useState("overview");

  const [showSessionModal, setShowSessionModal] = useState(false);

  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);

  const [session, setSession] = useState(null);

  const handleNewSession = () => {
    setShowSessionModal(true);
  };

  const handleCreateSession = (config) => {
    const newSession = {
      ...config,
      id: config.id || Date.now(),
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([newSession, ...existing])
      );

      setSessionRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to save backtest session:", error);
    }

    setSession(newSession);

    setShowSessionModal(false);

    // New session is created, but user stays on overview.
    setView("overview");
  };

  // The overview keeps its own copy of the list, which goes stale as soon as a
  // backtest is saved from the workspace, so the record is re-read on open.
  const freshestRecord = (selectedSession) => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const match = Array.isArray(stored)
        ? stored.find((item) => item?.id === selectedSession?.id)
        : null;
      return match || selectedSession;
    } catch {
      return selectedSession;
    }
  };

  const handleOpenSession = (selectedSession) => {
    setSession(freshestRecord(selectedSession));
    setView("workspace");
  };

  const handleAnalytics = (selectedSession) => {
    setSession(freshestRecord(selectedSession));
    setView("analytics");
  };

  // -----------------------------------------
  // OVERVIEW
  // -----------------------------------------

  if (view === "overview") {
    return (
      <>
        <BacktestingOverview
          onNewSession={handleNewSession}
          onOpenSession={handleOpenSession}
          onAnalytics={handleAnalytics}
          refreshKey={sessionRefreshKey}
        />

        <CreateBacktestSession
          open={showSessionModal}
          onClose={() => setShowSessionModal(false)}
          onCreate={handleCreateSession}
        />
      </>
    );
  }

  // -----------------------------------------
  // BACKTEST WORKSPACE (also opened on the analytics tab)
  // -----------------------------------------

  return (
    <>
      <BacktestWorkspace
        key={`${session?.id ?? "adhoc"}-${view}`}
        session={session}
        initialTab={view === "analytics" ? "analytics" : "trade"}
        onBack={() => setView("overview")}
      />

      <CreateBacktestSession
        open={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        onCreate={handleCreateSession}
      />
    </>
  );
}

export default Backtesting;
