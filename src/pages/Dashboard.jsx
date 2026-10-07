import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatCards from "../components/dashboard/StatCards";
import EquityCurve from "../components/dashboard/EquityCurve";
import RecentTradesCard from "../components/dashboard/RecentTrades/RecentTradesCard";
import DisciplineCard from "../components/dashboard/Discipline/DisciplineCard";

import { useJournal } from "../context/JournalContext";

import {
  DashboardFilterProvider,
  useDashboardFilter,
} from "../context/DashboardFilterContext";

import { EquityCurveFilterProvider } from "../context/EquityCurveFilterContext";

// ============================================================
// DASHBOARD CONTENT
// ============================================================

function DashboardContent() {
  const {
    filteredTrades: accountTrades,
    selectedAccountId,
  } = useJournal();

  useDashboardFilter();

  // ==========================================================
  // ACCOUNT-SCOPED TRADES
  // ==========================================================

  const filteredTrades = accountTrades;

  // ==========================================================
  // LOAD TRADING ACCOUNTS
  // ==========================================================

  let accounts = [];

  try {
    const savedAccounts =
      localStorage.getItem("tradingAccounts");

    const parsedAccounts =
      savedAccounts
        ? JSON.parse(savedAccounts)
        : [];

    accounts = Array.isArray(parsedAccounts)
      ? parsedAccounts
      : [];
  } catch (error) {
    console.error(
      "❌ Failed to load trading accounts:",
      error
    );

    accounts = [];
  }

  // ==========================================================
  // CURRENT SELECTED ACCOUNT
  // ==========================================================

  const currentAccount =
    accounts.find(
      (account) =>
        String(
          account?.id ??
            account?.accountId
        ) ===
        String(selectedAccountId)
    ) ?? null;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="w-full min-h-screen bg-gray-50 px-1 py-2">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="mb-1">
        <DashboardHeader />
      </div>

      {/* ======================================================
          STAT CARDS
      ====================================================== */}

      <div className="mb-1">
        <StatCards
          account={currentAccount}
          trades={filteredTrades}
        />
      </div>

      {/* ======================================================
          TOP SECTION
      ====================================================== */}

      <div className="grid grid-cols-12 gap-x-2">
        {/* ====================================================
            EQUITY CURVE
        ==================================================== */}

        <div className="col-span-12 xl:col-span-8 min-w-0">
          <EquityCurveFilterProvider>
            <EquityCurve
              account={currentAccount}
              trades={filteredTrades}
            />
          </EquityCurveFilterProvider>
        </div>

        {/* ====================================================
            DISCIPLINE
        ==================================================== */}

        <div className="col-span-12 xl:col-span-4 min-w-0">
          <DisciplineCard
            trades={filteredTrades}
          />
        </div>
      </div>

      {/* ======================================================
          RECENT TRADES
      ====================================================== */}

      <div className="mt-2 w-full">
        <RecentTradesCard
          trades={filteredTrades}
        />
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================

export default function Dashboard() {
  return (
    <DashboardFilterProvider>
      <DashboardContent />
    </DashboardFilterProvider>
  );
}