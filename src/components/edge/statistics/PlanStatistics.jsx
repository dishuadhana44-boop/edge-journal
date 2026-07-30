import StatisticsHeader from "./StatisticsHeader";
import StatisticsOverview from "./StatisticsOverview";
import EquityCurve from "./EquityCurve";
import PerformanceTable from "./PerformanceTable";
import MistakeAnalysis from "./MistakeAnalysis";

export default function PlanStatistics({
  plan,
  onBack,
}) {
  return (
    <div className="h-full flex flex-col bg-[#fafafa] rounded-2xl overflow-hidden">

<StatisticsHeader
  plan={plan}
  onBack={onBack}
/>

      <div className="flex-1 overflow-y-auto">

        <div className="max-w-[1700px] mx-auto p-8 space-y-4">

        <StatisticsOverview
    plan={plan}
/>

          {/* Equity Curve */}

          <EquityCurve plan={plan} />

          {/* Bottom */}

          <div className="grid grid-cols-2 gap-3">

          <PerformanceTable plan={plan} />

          <MistakeAnalysis plan={plan} />

          </div>

        </div>

      </div>

    </div>
  );
}