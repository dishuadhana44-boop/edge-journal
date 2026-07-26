import OverviewPage from "../components/reports/overview/OverviewPage";

export default function Reports() {
  return (
    <div className="w-full min-h-screen bg-gray-50 px-1 py-4">

<div className="flex items-center justify-between mb-2">

<div className="flex items-center gap-2">

  <h1 className="text-2xl font-bold text-gray-900">
    Reports
  </h1>

  <p className="text-gray-500">
    View Your Reports For Better Data.
  </p>

</div>
</div>
      <OverviewPage />

    </div>
  );
}