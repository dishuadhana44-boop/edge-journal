import OverviewKPIs from "./OverviewKPIs";
import OverviewEquityCurve from "./OverviewEquityCurve";
import DailyPnLCard from "./DailyPnLCard";
import WeeklyPnLCard from "./WeeklyPnLCard";
import MonthlyReturnsCard from "./MonthlyReturnsCard";
import CalendarHeatmapCard from "./CalendarHeatmapCard";
import YourStatistics from "../statistics/YourStatistics";
import TradeDistributionCard from "../distribution/TradeDistributionCard";
import LongShortCard from "../direction/LongShortCard";
import InstrumentAnalysisCard from "../instrument/InstrumentAnalysisCard";
import SetupAnalysisCard from "../setup/SetupAnalysisCard";
import SessionAnalysisCard from "../session/SessionAnalysisCard";

export default function OverviewPage() {

  return (

    <div className="space-y-5">

      <OverviewKPIs />

      <OverviewEquityCurve />

      {/* Daily + Weekly */}

      <div className="grid grid-cols-2 gap-3">

        <DailyPnLCard />

        <WeeklyPnLCard />

      </div>

      {/* Monthly + Calendar */}

      <div className="grid grid-cols-2 gap-3">

        <MonthlyReturnsCard />

        <CalendarHeatmapCard />

      </div>

      {/* Full Width Statistics */}

      <YourStatistics />

      <TradeDistributionCard />

      <LongShortCard />

       <InstrumentAnalysisCard />

       <SetupAnalysisCard />

       <SessionAnalysisCard />

    </div>

  );

}