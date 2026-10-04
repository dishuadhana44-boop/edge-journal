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
import PlanAnalysisCard from "../setup/PlanAnalysisCard";
import SessionAnalysisCard from "../session/SessionAnalysisCard";
import DrawdownAnalysis from "./DrawdownAnalysis";
import ExpectancyAnalysis from "./ExpectancyAnalysis";
import StreakAnalysis from "./StreakAnalysis";
import RMultipleAnalysis from "./RMultipleAnalysis";
import BestWorstTrades from "./BestWorstTrades";
import DayOfWeekAnalysis from "./DayOfWeekAnalysis";
import TimeOfDayAnalysis from "./TimeOfDayAnalysis";
import MonthlyPerformance from "./MonthlyPerformance";
import TradeDistributionAnalysis from "./TradeDistributionAnalysis";
import LongShortAnalysis from "./LongShortAnalysis";
import RiskPerformanceAnalysis from "./RiskPerformanceAnalysis";
import SetupPerformanceAnalysis from "./SetupPerformanceAnalysis";
import InstrumentPerformanceAnalysis from "./InstrumentPerformanceAnalysis";
import SessionPerformanceAnalysis from "./SessionPerformanceAnalysis";
import PerformanceCalendarAnalysis from "./PerformanceCalendarAnalysis";
import ProfitFactorExpectancyMatrix from "./ProfitFactorExpectancyMatrix";
import RiskOfRuinAnalysis from "./RiskOfRuinAnalysis";
import TradeQualityAnalysis from "./TradeQualityAnalysis";
import ConsistencyDisciplineAnalysis from "./ConsistencyDisciplineAnalysis";
import ConcentrationRiskAnalysis from "./ConcentrationRiskAnalysis";
import TradeCorrelationAnalysis from "./TradeCorrelationAnalysis";
import PerformanceAttributionAnalysis from "./PerformanceAttributionAnalysis";

export default function OverviewPage() {

  return (

    <div className="space-y-5">

      <OverviewKPIs />

      <OverviewEquityCurve />

      <DrawdownAnalysis />

      <ExpectancyAnalysis />

      <StreakAnalysis />

      <RMultipleAnalysis />

      <BestWorstTrades />

      <DayOfWeekAnalysis />

      <TimeOfDayAnalysis />

      <MonthlyPerformance />

      <TradeDistributionAnalysis />

      <LongShortAnalysis />

      <RiskPerformanceAnalysis />

      <SetupPerformanceAnalysis />

      <InstrumentPerformanceAnalysis />

      <SessionPerformanceAnalysis />

      <PerformanceCalendarAnalysis />

      <ProfitFactorExpectancyMatrix />

      <RiskOfRuinAnalysis />

      <TradeQualityAnalysis />

      <ConsistencyDisciplineAnalysis />

      <ConcentrationRiskAnalysis />

      <TradeCorrelationAnalysis />

      <PerformanceAttributionAnalysis />

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

       <PlanAnalysisCard />

       <SessionAnalysisCard />

    </div>

  );

}