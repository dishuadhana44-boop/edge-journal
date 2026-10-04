import { useMemo, useState } from "react";

import { useJournal } from "../../../context/JournalContext";
import { calculateReviewStats } from "./reviewStats";

import {
  ArrowLeft,
  CalendarDays,
  Save,
  BarChart3,
  ShieldCheck,
  Brain,
  Target,
} from "lucide-react";

function YearlyReview({
  onBack,
  initialData = null,
  reviewKey = null,
}) {
  const { filteredTrades } = useJournal();

  const defaultData = {
    year: "",
    tradingPeriod: "",
    marketsTraded: "",
    totalTrades: "",
    wins: "",
    losses: "",
    breakeven: "",
    winRate: "",
    netPL: "",
    netR: "",
    averageR: "",
    maxDrawdown: "",
    profitFactor: "",
    ruleBreaks: "",
    aPlusSetups: "",
    bestMonth: "",
    worstMonth: "",
    bestQuarter: "",
    worstQuarter: "",
    bestSetup: "",
    worstSetup: "",
    bestSession: "",
    worstSession: "",
    bestMarketCondition: "",
    worstMarketCondition: "",
    bestInstrument: "",
    profitableSetup: "",
    leastProfitableSetup: "",
    bestConditions: "",
    difficultConditions: "",
    strategyEvolution: "",
    riskLimits: "",
    drawdownControl: "",
    revengeTrading: "",
    overtrading: "",
    positionSizing: "",
    biggestRiskMistake: "",
    biggestRiskImprovement: "",
    psychologicalWeakness: "",
    emotionalPattern: "",
    disciplineChange: "",
    ruleBreakingSituations: "",
    psychologicalImprovement: "",
    biggestMistake: "",
    biggestAchievement: "",
    biggestLesson: "",
    biggestChange: "",
    selfLearning: "",
    stopDoing: "",
    startDoing: "",
    continueDoing: "",
    tradingSkill: "",
    setupToMaster: "",
    psychologyHabit: "",
    riskRule: "",
    majorGoal: "",
    finalRule: "",
  };

  const [formData, setFormData] = useState({
    ...defaultData,
    ...(initialData || {}),
  });

  // ============================================================
  // YEAR RANGE
  // ============================================================

  const yearRange = useMemo(() => {
    const year = Number(formData.year);

    if (!year) {
      return {
        startDate: "",
        endDate: "",
      };
    }

    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }, [formData.year]);

  // ============================================================
  // YEARLY JOURNAL TRADES
  // ============================================================

  const yearlyTrades = useMemo(() => {
    if (
      !yearRange.startDate ||
      !yearRange.endDate
    ) {
      return [];
    }

    return filteredTrades.filter((trade) => {
      if (!trade?.date) {
        return false;
      }

      return (
        trade.date >= yearRange.startDate &&
        trade.date <= yearRange.endDate
      );
    });
  }, [
    filteredTrades,
    yearRange.startDate,
    yearRange.endDate,
  ]);

  // ============================================================
  // YEARLY STATISTICS
  // ============================================================

  const calculatedStats = useMemo(() => {
    return calculateReviewStats(yearlyTrades);
  }, [yearlyTrades]);

  // ============================================================
  // UPDATE FIELD
  // ============================================================

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ============================================================
  // SAVE
  // ============================================================

  const handleSave = () => {
    const key =
      reviewKey ||
      `edgefinder-yearly-review-${
        formData.year || Date.now()
      }`;

    const dataToSave = {
      ...formData,

      totalTrades:
        calculatedStats.totalTrades,

      wins:
        calculatedStats.wins,

      losses:
        calculatedStats.losses,

      breakeven:
        calculatedStats.breakeven,

      winRate:
        calculatedStats.winRate,

      netPL:
        calculatedStats.netPL,

      netR:
        calculatedStats.netR,

      averageR:
        calculatedStats.averageR,

      maxDrawdown:
        calculatedStats.maxDrawdown,

      profitFactor:
        calculatedStats.profitFactor,

      startDate:
        yearRange.startDate,

      endDate:
        yearRange.endDate,
    };

    localStorage.setItem(
      key,
      JSON.stringify(dataToSave)
    );

    setFormData(dataToSave);

    alert(
      reviewKey
        ? "Yearly review updated successfully."
        : "Yearly review saved successfully."
    );
  };

  // ============================================================
  // STYLES
  // ============================================================

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100";

  const calculatedInputClass =
    "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-800 outline-none";

  const textareaClass =
    "w-full min-h-[90px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100";

  const labelClass =
    "mb-1.5 block text-sm font-medium text-gray-700";

  const sectionClass =
    "rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

  return (
    <div className="min-h-full pb-10">

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="mb-5 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Yearly Review
            </h1>

            <p className="text-sm text-gray-500">
              Review your complete yearly
              trading performance and development.
            </p>
          </div>

        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700"
        >
          <Save size={16} />

          {reviewKey
            ? "Update Review"
            : "Save Review"}
        </button>

      </div>

      <div className="space-y-5">

        {/* ================================================== */}
        {/* YEAR OVERVIEW */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <CalendarDays
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Year Overview
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <div>

              <label className={labelClass}>
                Year
              </label>

              <input
                type="number"
                value={formData.year}
                onChange={(e) =>
                  updateField(
                    "year",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="2026"
              />

            </div>

            <div>

              <label className={labelClass}>
                Trading Period
              </label>

              <input
                type="text"
                value={
                  formData.tradingPeriod
                }
                onChange={(e) =>
                  updateField(
                    "tradingPeriod",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="January - December"
              />

            </div>

            <div>

              <label className={labelClass}>
                Markets Traded
              </label>

              <input
                type="text"
                value={
                  formData.marketsTraded
                }
                onChange={(e) =>
                  updateField(
                    "marketsTraded",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="Forex, Gold, Indices..."
              />

            </div>

          </div>

          {yearRange.startDate && (
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
              Trading period automatically tracked:{" "}
              {yearRange.startDate}
              {" → "}
              {yearRange.endDate}
            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* ANNUAL STATISTICS */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <BarChart3
              size={19}
              className="text-purple-600"
            />

            <div>

              <h2 className="text-base font-semibold text-gray-900">
                Annual Statistics
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                Automatically calculated from Journal trades
              </p>

            </div>

          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

            {[
              [
                "wins",
                "Wins",
                calculatedStats.wins,
              ],
              [
                "losses",
                "Losses",
                calculatedStats.losses,
              ],
              [
                "breakeven",
                "Breakeven",
                calculatedStats.breakeven,
              ],
              [
                "totalTrades",
                "Total Trades",
                calculatedStats.totalTrades,
              ],
              [
                "winRate",
                "Win Rate (%)",
                `${calculatedStats.winRate}%`,
              ],
              [
                "netPL",
                "Net P/L",
                calculatedStats.netPL,
              ],
              [
                "netR",
                "Net (R)",
                calculatedStats.netR,
              ],
              [
                "averageR",
                "Average R",
                calculatedStats.averageR,
              ],
              [
                "maxDrawdown",
                "Max Drawdown (R)",
                calculatedStats.maxDrawdown,
              ],
              [
                "profitFactor",
                "Profit Factor",
                calculatedStats.profitFactor,
              ],
            ].map(
              ([field, label, value]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <input
                    type="text"
                    value={value}
                    readOnly
                    className={
                      calculatedInputClass
                    }
                  />

                </div>
              )
            )}

            <div>

              <label className={labelClass}>
                Rule Breaks (#)
              </label>

              <input
                type="text"
                value={
                  formData.ruleBreaks
                }
                onChange={(e) =>
                  updateField(
                    "ruleBreaks",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="Enter number"
              />

            </div>

            <div>

              <label className={labelClass}>
                A+ Setups
              </label>

              <input
                type="text"
                value={
                  formData.aPlusSetups
                }
                onChange={(e) =>
                  updateField(
                    "aPlusSetups",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="Enter number"
              />

            </div>

          </div>

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">

            {yearlyTrades.length > 0
              ? `${yearlyTrades.length} journal trade${
                  yearlyTrades.length === 1
                    ? ""
                    : "s"
                } found for ${
                  formData.year
                }.`
              : "Enter a year to calculate annual statistics."}

          </div>

        </section>

        {/* ================================================== */}
        {/* YEARLY PERFORMANCE */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5">

            <h2 className="text-base font-semibold text-gray-900">
              Yearly Performance Breakdown
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {[
              [
                "bestMonth",
                "Best Month",
              ],
              [
                "worstMonth",
                "Worst Month",
              ],
              [
                "bestQuarter",
                "Best Quarter",
              ],
              [
                "worstQuarter",
                "Worst Quarter",
              ],
              [
                "bestSetup",
                "Best Setup",
              ],
              [
                "worstSetup",
                "Worst Setup",
              ],
              [
                "bestSession",
                "Best Session",
              ],
              [
                "worstSession",
                "Worst Session",
              ],
              [
                "bestMarketCondition",
                "Best Market Condition",
              ],
              [
                "worstMarketCondition",
                "Worst Market Condition",
              ],
              [
                "bestInstrument",
                "Best Instrument",
              ],
            ].map(
              ([field, label]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <input
                    type="text"
                    value={
                      formData[field]
                    }
                    onChange={(e) =>
                      updateField(
                        field,
                        e.target.value
                      )
                    }
                    className={inputClass}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* STRATEGY REVIEW */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Target
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Strategy Review
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "profitableSetup",
                "Most Profitable Setup",
              ],
              [
                "leastProfitableSetup",
                "Least Profitable Setup",
              ],
              [
                "bestConditions",
                "Best Trading Conditions",
              ],
              [
                "difficultConditions",
                "Difficult Conditions",
              ],
              [
                "strategyEvolution",
                "How Did My Strategy Evolve?",
              ],
            ].map(
              ([field, label]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={
                      formData[field]
                    }
                    onChange={(e) =>
                      updateField(
                        field,
                        e.target.value
                      )
                    }
                    className={textareaClass}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* RISK MANAGEMENT */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <ShieldCheck
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Risk Management
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "riskLimits",
                "Risk Limits",
              ],
              [
                "drawdownControl",
                "Drawdown Control",
              ],
              [
                "revengeTrading",
                "Revenge Trading",
              ],
              [
                "overtrading",
                "Overtrading",
              ],
              [
                "positionSizing",
                "Position Sizing",
              ],
              [
                "biggestRiskMistake",
                "Biggest Risk Mistake",
              ],
              [
                "biggestRiskImprovement",
                "Biggest Risk Improvement",
              ],
            ].map(
              ([field, label]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={
                      formData[field]
                    }
                    onChange={(e) =>
                      updateField(
                        field,
                        e.target.value
                      )
                    }
                    className={textareaClass}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* PSYCHOLOGY */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Brain
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Psychology Review
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "psychologicalWeakness",
                "Biggest Psychological Weakness",
              ],
              [
                "emotionalPattern",
                "Emotional Pattern",
              ],
              [
                "disciplineChange",
                "How Did Discipline Change?",
              ],
              [
                "ruleBreakingSituations",
                "Rule-Breaking Situations",
              ],
              [
                "psychologicalImprovement",
                "Psychological Improvement",
              ],
            ].map(
              ([field, label]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={
                      formData[field]
                    }
                    onChange={(e) =>
                      updateField(
                        field,
                        e.target.value
                      )
                    }
                    className={textareaClass}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* YEARLY REFLECTION */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5">

            <h2 className="text-base font-semibold text-gray-900">
              Yearly Reflection
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "biggestMistake",
                "Biggest Mistake",
              ],
              [
                "biggestAchievement",
                "Biggest Achievement",
              ],
              [
                "biggestLesson",
                "Biggest Lesson",
              ],
              [
                "biggestChange",
                "Biggest Change",
              ],
              [
                "selfLearning",
                "What Did I Learn About Myself?",
              ],
              [
                "stopDoing",
                "What Should I Stop Doing?",
              ],
              [
                "startDoing",
                "What Should I Start Doing?",
              ],
              [
                "continueDoing",
                "What Should I Continue Doing?",
              ],
            ].map(
              ([field, label]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={
                      formData[field]
                    }
                    onChange={(e) =>
                      updateField(
                        field,
                        e.target.value
                      )
                    }
                    className={textareaClass}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* NEXT YEAR */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Target
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Next Year Focus
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "tradingSkill",
                "Trading Skill to Improve",
              ],
              [
                "setupToMaster",
                "Setup to Master",
              ],
              [
                "psychologyHabit",
                "Psychology Habit",
              ],
              [
                "riskRule",
                "Risk Rule",
              ],
              [
                "majorGoal",
                "Major Trading Goal",
              ],
              [
                "finalRule",
                "One Rule I Will Follow",
              ],
            ].map(
              ([field, label]) => (
                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={
                      formData[field]
                    }
                    onChange={(e) =>
                      updateField(
                        field,
                        e.target.value
                      )
                    }
                    className={textareaClass}
                  />

                </div>
              )
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* BOTTOM SAVE */}
        {/* ================================================== */}

        <div className="flex justify-end">

          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700"
          >

            <Save size={16} />

            {reviewKey
              ? "Update Yearly Review"
              : "Save Yearly Review"}

          </button>

        </div>

      </div>

    </div>
  );
}

export default YearlyReview;