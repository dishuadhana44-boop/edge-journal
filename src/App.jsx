import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

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
import AuthCallback from "./pages/AuthCallback";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";

import { JournalProvider } from "./context/JournalContext";
import { DashboardFilterProvider } from "./context/DashboardFilterContext";
import { MarketProvider } from "./context/MarketContext";
import { TradeProvider } from "./context/TradeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import PositionSizeCalculator from "./pages/Tools/components/PositionSizeCalculator";
import RiskRewardCalculator from "./pages/Tools/components/RiskRewardCalculator";
import PnLCalculator from "./pages/Tools/components/PnLCalculator";
import PipCalculator from "./pages/Tools/components/PipCalculator";
import MarginCalculator from "./pages/Tools/components/MarginCalculator";
import CompoundingCalculator from "./pages/Tools/components/CompoundingCalculator";
import TradingSessions from "./pages/Tools/components/TradingSessions";
import CurrencyCorrelation from "./pages/Tools/components/CurrencyCorrelation";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <JournalProvider>
          <MarketProvider>
            <TradeProvider>
              <DashboardFilterProvider>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/broker/callback" element={<BrokerCallback />} />

                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/tradelog" element={<TradeLog />} />
                    <Route path="/trading" element={<Trading />} />
                    <Route path="/backtesting" element={<Backtesting />} />
                    <Route path="/edge" element={<Edge />} />
                    <Route path="/journal" element={<Journal />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/notebook" element={<Notebook />} />

                    <Route path="/tools" element={<Tools />} />
                    <Route
                      path="/tools/position-size"
                      element={<PositionSizeCalculator />}
                    />
                    <Route
                      path="/tools/risk-reward"
                      element={<RiskRewardCalculator />}
                    />
                    <Route path="/tools/pnl" element={<PnLCalculator />} />
                    <Route path="/tools/pip" element={<PipCalculator />} />
                    <Route path="/tools/margin" element={<MarginCalculator />} />
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

                    <Route path="/notebook/editor/:id" element={<NoteEditor />} />
                    <Route path="/edgeos" element={<EdgeOS />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/ai" element={<AIInsights />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/trade/:id" element={<TradeJournal />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </DashboardFilterProvider>
            </TradeProvider>
          </MarketProvider>
        </JournalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
