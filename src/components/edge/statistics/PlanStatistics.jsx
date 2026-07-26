import StatisticsHeader from "./StatisticsHeader";
import StatisticsOverview from "./StatisticsOverview";
import EquityCurve from "./EquityCurve";
import PerformanceTable from "./PerformanceTable";
import MistakeAnalysis from "./MistakeAnalysis";

export default function PlanStatistics({ onBack }) {
  return (
    <div className="h-full flex flex-col bg-[#fafafa] rounded-2xl overflow-hidden">

      <StatisticsHeader onBack={onBack} />

      <div className="flex-1 overflow-y-auto">

        <div className="max-w-[1700px] mx-auto p-8 space-y-8">

        <StatisticsOverview />

          {/* Equity Curve */}

          <EquityCurve />

          {/* Bottom */}

          <div className="grid grid-cols-2 gap-6">

            <PerformanceTable />

            <MistakeAnalysis />

          </div>

        </div>

      </div>

    </div>
  );
}