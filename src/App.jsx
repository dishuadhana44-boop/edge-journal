import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { supabase } from "./lib/supabase";

import AppLayout from "./layouts/AppLayout";

import Dashboard from "./pages/Dashboard";
import TradeLog from "./pages/TradeLog";
import Trading from "./pages/Trading";
import Backtesting from "./pages/Backtesting";
import Edge from "./pages/Edge";
import Journal from "./pages/Journal";
import Reports from "./pages/Reports";
import Notebook from "./pages/Notebook";
import Tools from "./pages/Tools/Tools";
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
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import { JournalProvider } from "./context/JournalContext";
import { DashboardFilterProvider } from "./context/DashboardFilterContext";
import { MarketProvider } from "./context/MarketContext";
import { TradeProvider } from "./context/TradeContext";

import PositionSizeCalculator from "./pages/Tools/components/PositionSizeCalculator";
import RiskRewardCalculator from "./pages/Tools/components/RiskRewardCalculator";
import PnLCalculator from "./pages/Tools/components/PnLCalculator";
import PipCalculator from "./pages/Tools/components/PipCalculator";
import MarginCalculator from "./pages/Tools/components/MarginCalculator";
import CompoundingCalculator from "./pages/Tools/components/CompoundingCalculator";
import TradingSessions from "./pages/Tools/components/TradingSessions";
import CurrencyCorrelation from "./pages/Tools/components/CurrencyCorrelation";
/* =========================================================
   AUTH CHECK
========================================================= */

function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (isMounted) {
          setSession(nextSession);
          setCheckingSession(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data, error }) => {
      if (isMounted) {
        setSession(error ? null : data.session);
        setCheckingSession(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p role="status" className="text-sm text-gray-400">Checking your session…</p>
      </main>
    );
  }

  if (!session?.user) {
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

        <MarketProvider>

          <TradeProvider>

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

                <Route
                  path="/auth/callback"
                  element={<AuthCallbackPage />}
                />

                <Route
                  path="/reset-password"
                  element={<ResetPasswordPage />}
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

                  {/*
  Tools
*/}
<Route
  path="/tools"
  element={<Tools />}
/>

<Route
  path="/tools/position-size"
  element={<PositionSizeCalculator />}
/>

<Route
  path="/tools/risk-reward"
  element={<RiskRewardCalculator />}
/>

<Route
  path="/tools/pnl"
  element={<PnLCalculator />}
/>

<Route
  path="/tools/pip"
  element={<PipCalculator />}
/>

<Route
  path="/tools/margin"
  element={<MarginCalculator />}
/>

<Route
  path="/tools/compounding"
  element={<CompoundingCalculator />}
/>

<Route
  path="/tools/trading-sessions"
  element={<TradingSessions />}
/>

<Route
  path="/tools/currency-correlation"
  element={<CurrencyCorrelation />}
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

          </TradeProvider>

        </MarketProvider>

      </JournalProvider>
    </BrowserRouter>
  );
}

export default App;
