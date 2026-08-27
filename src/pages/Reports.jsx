import OverviewPage from "../components/reports/overview/OverviewPage";
import PageHeader from "../components/common/PageHeader";

export default function Reports() {
  return (
    <div className="w-full min-h-screen bg-gray-50 px-1 py-4">

<div className="flex items-center justify-between ">

<PageHeader
  title="Reports"
  subtitle="Analyze your trading performance with detailed statistics."
  icon="reports"
/>
</div>
      <OverviewPage />

    </div>
  );
}