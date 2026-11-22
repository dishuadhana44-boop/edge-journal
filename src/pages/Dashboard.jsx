import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatCards from "../components/dashboard/StatCards";
import EquityCurve from "../components/dashboard/EquityCurve";
import RecentTradesCard from "../components/dashboard/RecentTrades/RecentTradesCard";
import DisciplineCard from "../components/dashboard/Discipline/DisciplineCard";
import DashboardAnalytics from "../components/dashboard/analytics/DashboardAnalytics";

import { useJournal } from "../context/JournalContext";

import {
  DashboardFilterProvider,
  useDashboardFilter,
} from "../context/DashboardFilterContext";

import { DASHBOARD_SECTIONS } from "../utils/dashboardSections";

import { EquityCurveFilterProvider } from "../context/EquityCurveFilterContext";

// ============================================================
// DASHBOARD CONTENT
// ============================================================

function DashboardContent() {
  const {
    filteredTrades: accountTrades,
    selectedAccountId,
  } = useJournal();

  const {
    sections,
    resetSections,
    startDate,
    endDate,
  } = useDashboardFilter();

  // ==========================================================
  // ACCOUNT-SCOPED TRADES
  // ==========================================================
  // The full closed-and-journalled history of the selected account is passed down
  // unfiltered: each widget applies the shared period filter from
  // utils/dashboardCurveEngine itself, because equity and drawdown need the results
  // realised *before* the range in order to open at the correct baseline.

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

  const visibleSectionCount = DASHBOARD_SECTIONS.filter(
    (section) => sections[section.key]
  ).length;

  const showChartsRow =
    sections.equityCurve || sections.discipline;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="w-full min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden bg-gray-50 px-3 py-3 flex flex-col gap-3">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="shrink-0">
        <DashboardHeader />
      </div>

      {/* ======================================================
          STAT CARDS
      ====================================================== */}

      <div className="shrink-0">
        <StatCards
          account={currentAccount}
          trades={accountTrades}
        />
      </div>

      {visibleSectionCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white">
          <p className="text-sm text-gray-600">
            Every dashboard section is hidden.
          </p>

          <button
            type="button"
            onClick={resetSections}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-3 lg:overflow-y-auto">
          {/* ====================================================
              EQUITY CURVE + DISCIPLINE
          ==================================================== */}

          {showChartsRow && (
            <div className="lg:flex-1 lg:min-h-[300px] min-h-[300px] grid grid-cols-12 gap-3">
              {/* ==================================================
                  EQUITY CURVE
              ================================================== */}

              {sections.equityCurve && (
                <div
                  className={`col-span-12 min-w-0 ${
                    sections.discipline
                      ? "lg:col-span-8"
                      : "lg:col-span-12"
                  }`}
                >
                  <EquityCurveFilterProvider>
                    <EquityCurve
                      account={currentAccount}
                      trades={accountTrades}
                    />
                  </EquityCurveFilterProvider>
                </div>
              )}

              {/* ==================================================
                  DISCIPLINE
              ================================================== */}

              {sections.discipline && (
                <div
                  className={`col-span-12 min-w-0 ${
                    sections.equityCurve
                      ? "lg:col-span-4"
                      : "lg:col-span-12"
                  }`}
                >
                  <DisciplineCard
                    trades={accountTrades}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </div>
              )}
            </div>
          )}

          {/* ======================================================
              ADDITIONAL CURVES + TRADE ANALYTICS
          ====================================================== */}

          <DashboardAnalytics
            account={currentAccount}
            trades={accountTrades}
            startDate={startDate}
            endDate={endDate}
            sections={sections}
          />

          {/* ======================================================
              RECENT OPEN POSITIONS — live broker snapshot, deliberately
              never range-filtered: open positions are not closed-trade
              performance.
          ====================================================== */}

          {sections.openPositions && (
            <div className="grid lg:flex-1 lg:min-h-[200px] min-h-[260px]">
              <RecentTradesCard />
            </div>
          )}
        </div>
      )}
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
