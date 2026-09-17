import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";

import Dashboard from "./pages/Dashboard";
import TradeLog from "./pages/TradeLog";
import Trading from "./pages/Trading";
import Backtesting from "./pages/Backtesting";
import Edge from "./pages/Edge";
import Journal from "./pages/Journal";
import Reports from "./pages/Reports";
import Notebook from "./pages/Notebook";
import EdgeOS from "./pages/EdgeOS/EdgeOS";
import News from "./pages/News";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import TradeJournal from "./pages/TradeJournal";
import NoteEditor from "./pages/NoteEditor";
import BrokerCallback from "./pages/BrokerCallback";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";

import { JournalProvider } from "./context/JournalContext";
import { DashboardFilterProvider } from "./context/DashboardFilterContext";

/* =========================================================
   AUTH CHECK
========================================================= */

function isAuthenticated() {
  try {
    const currentUser = localStorage.getItem(
      "edgeflo_current_user"
    );

    if (!currentUser) {
      return false;
    }

    const user = JSON.parse(currentUser);

    return Boolean(user?.id && user?.email);
  } catch {
    return false;
  }
}

/* =========================================================
   PROTECTED ROUTE
========================================================= */

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <BrowserRouter>
      <JournalProvider>
        <DashboardFilterProvider>

          <Routes>

            {/* =================================================
                PUBLIC WEBSITE
            ================================================= */}

            <Route
              path="/"
              element={<LandingPage />}
            />

            <Route
              path="/login"
              element={<LoginPage />}
            />

            {/* =================================================
                cTrader OAuth CALLBACK
                Must remain public
            ================================================= */}

            <Route
              path="/broker/callback"
              element={<BrokerCallback />}
            />

            {/* =================================================
                PROTECTED MAIN APP
            ================================================= */}

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >

              {/* Dashboard */}
              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              {/* Trade Log */}
              <Route
                path="/tradelog"
                element={<TradeLog />}
              />

              {/* Trading */}
              <Route
                path="/trading"
                element={<Trading />}
              />

              {/* Backtesting */}
              <Route
                path="/backtesting"
                element={<Backtesting />}
              />

              {/* Edge */}
              <Route
                path="/edge"
                element={<Edge />}
              />

              {/* Journal */}
              <Route
                path="/journal"
                element={<Journal />}
              />

              {/* Reports */}
              <Route
                path="/reports"
                element={<Reports />}
              />

              {/* Notebook */}
              <Route
                path="/notebook"
                element={<Notebook />}
              />

              {/* Notebook Editor */}
              <Route
                path="/notebook/editor/:id"
                element={<NoteEditor />}
              />

              {/* EdgeOS */}
              <Route
                path="/edgeos"
                element={<EdgeOS />}
              />

              {/* News */}
              <Route
                path="/news"
                element={<News />}
              />

              {/* AI Insights */}
              <Route
                path="/ai"
                element={<AIInsights />}
              />

              {/* Settings */}
              <Route
                path="/settings"
                element={<Settings />}
              />

              {/* Profile */}
              <Route
                path="/profile"
                element={<Profile />}
              />

              {/* Trade Journal */}
              <Route
                path="/trade/:id"
                element={<TradeJournal />}
              />

            </Route>

            {/* =================================================
                FALLBACK
            ================================================= */}

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />

          </Routes>

        </DashboardFilterProvider>
      </JournalProvider>
    </BrowserRouter>
  );
}

export default App;