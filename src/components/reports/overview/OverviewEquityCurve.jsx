import ChartHeader from "./ChartHeader";
import ChartStats from "./ChartStats";
import EquityChart from "./EquityChart";

export default function OverviewEquityCurve() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <ChartHeader />

      <ChartStats />

      <EquityChart />

    </div>
  );
}