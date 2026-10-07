import OverviewPage from "../components/reports/overview/OverviewPage";
import PageHeader from "../components/common/PageHeader";
import { useJournal } from "../context/JournalContext";

export default function Reports() {
  const {
    filteredTrades: accountTrades,
    selectedAccountId,
  } = useJournal();

  /*
   * filteredTrades is already scoped to the currently
   * selected trading account by JournalContext.
   */
  return (
    <div className="w-full min-h-screen bg-gray-50 px-1 py-4">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Reports"
          subtitle="Analyze your trading performance with detailed statistics."
          icon="reports"
        />
      </div>

      <OverviewPage
        trades={accountTrades}
        selectedAccountId={selectedAccountId}
      />
    </div>
  );
}