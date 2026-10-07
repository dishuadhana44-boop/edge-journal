import { useMemo, useState } from "react";

import { useJournal } from "../../../context/JournalContext";
import { calculateReviewStats } from "./reviewStats";

import {
  ArrowLeft,
  CalendarRange,
  Save,
  BarChart3,
  ShieldCheck,
  Brain,
  Target,
} from "lucide-react";

function QuarterlyReview({
  onBack,
  initialData = null,
  reviewKey = null,
}) {
  const {
    filteredTrades,
    selectedAccountId,
  } = useJournal();

  const defaultData = {
    quarter: "",
    year: "",
    startDate: "",
    endDate: "",
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
    bestSetup: "",
    worstSetup: "",
    bestSession: "",
    worstSession: "",
    bestMarketCondition: "",
    worstMarketCondition: "",
    bestInstrument: "",
    worstInstrument: "",
    bestPerformingSetups: "",
    poorPerformingSetups: "",
    suitableConditions: "",
    difficultConditions: "",
    systemConsistency: "",
    strategyImprovement: "",
    riskPerTrade: "",
    dailyLossLimit: "",
    overtrading: "",
    increasedRisk: "",
    movedStops: "",
    profitTaking: "",
    psychologicalWeakness: "",
    emotionalPattern: "",
    disciplineHelper: "",
    disciplineProblem: "",
    psychologicalImprovement: "",
    biggestMistake: "",
    biggestImprovement: "",
    biggestLesson: "",
    comparedPreviousQuarter: "",
    stopDoing: "",
    startDoing: "",
    continueDoing: "",
    tradingSkill: "",
    setupToMaster: "",
    psychologyHabit: "",
    riskRule: "",
    finalRule: "",
  };

  const [formData, setFormData] = useState({
    ...defaultData,
    ...(initialData || {}),
  });

  // ============================================================
  // QUARTER DATE RANGE
  // ============================================================

  const quarterRange = useMemo(() => {
    const year = Number(formData.year);
    const quarter = formData.quarter;

    if (!year || !quarter) {
      return {
        startDate: formData.startDate,
        endDate: formData.endDate,
      };
    }

    const ranges = {
      Q1: [`${year}-01-01`, `${year}-03-31`],
      Q2: [`${year}-04-01`, `${year}-06-30`],
      Q3: [`${year}-07-01`, `${year}-09-30`],
      Q4: [`${year}-10-01`, `${year}-12-31`],
    };

    const range = ranges[quarter];

    if (!range) {
      return {
        startDate: formData.startDate,
        endDate: formData.endDate,
      };
    }

    return {
      startDate: range[0],
      endDate: range[1],
    };
  }, [
    formData.year,
    formData.quarter,
    formData.startDate,
    formData.endDate,
  ]);

  // ============================================================
  // QUARTERLY JOURNAL TRADES
  // ============================================================

  const quarterlyTrades = useMemo(() => {
    const startDate = quarterRange.startDate;
    const endDate = quarterRange.endDate;

    if (!startDate || !endDate) {
      return [];
    }

    return filteredTrades.filter((trade) => {
      if (!trade?.date) {
        return false;
      }

      return (
        trade.date >= startDate &&
        trade.date <= endDate
      );
    });
  }, [
    filteredTrades,
    quarterRange.startDate,
    quarterRange.endDate,
  ]);

  // ============================================================
  // QUARTERLY STATISTICS
  // ============================================================

  const calculatedStats = useMemo(() => {
    return calculateReviewStats(quarterlyTrades);
  }, [quarterlyTrades]);

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
    const accountKey =
    selectedAccountId
      ? String(selectedAccountId).trim()
      : "no-account";
  
  const key =
    reviewKey ||
    `edgefinder-quarterly-review-${accountKey}-${
      formData.year || "unknown"
    }-${
      formData.quarter ||
      Date.now()
    }`;

    const dataToSave = {
      ...formData,
      accountId: selectedAccountId
        ? String(selectedAccountId).trim()
        : null,
      startDate: quarterRange.startDate,
      endDate: quarterRange.endDate,

      totalTrades: calculatedStats.totalTrades,
      wins: calculatedStats.wins,
      losses: calculatedStats.losses,
      breakeven: calculatedStats.breakeven,
      winRate: calculatedStats.winRate,
      netPL: calculatedStats.netPL,
      netR: calculatedStats.netR,
      averageR: calculatedStats.averageR,
      maxDrawdown: calculatedStats.maxDrawdown,
      profitFactor: calculatedStats.profitFactor,
    };

    localStorage.setItem(
      key,
      JSON.stringify(dataToSave)
    );

    setFormData(dataToSave);

    alert(
      reviewKey
        ? "Quarterly review updated successfully."
        : "Quarterly review saved successfully."
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

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-full pb-10">

      {/* HEADER */}

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
              Quarterly Review
            </h1>

            <p className="text-sm text-gray-500">
              Review your quarterly performance,
              strategy, risk and psychology.
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
        {/* QUARTER OVERVIEW */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <CalendarRange
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Quarter Overview
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

            <div>
              <label className={labelClass}>
                Quarter
              </label>

              <select
                value={formData.quarter}
                onChange={(e) =>
                  updateField(
                    "quarter",
                    e.target.value
                  )
                }
                className={inputClass}
              >
                <option value="">
                  Select quarter
                </option>

                <option value="Q1">
                  Q1
                </option>

                <option value="Q2">
                  Q2
                </option>

                <option value="Q3">
                  Q3
                </option>

                <option value="Q4">
                  Q4
                </option>
              </select>
            </div>

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
                Start Date
              </label>

              <input
                type="date"
                value={
                  quarterRange.startDate || ""
                }
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                End Date
              </label>

              <input
                type="date"
                value={
                  quarterRange.endDate || ""
                }
                readOnly
                className={calculatedInputClass}
              />
            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* STATISTICS */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <BarChart3
              size={19}
              className="text-purple-600"
            />

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Quarterly Summary Statistics
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
                    className={calculatedInputClass}
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
                value={formData.ruleBreaks}
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
                value={formData.aPlusSetups}
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

            {quarterlyTrades.length > 0
              ? `${quarterlyTrades.length} journal trade${
                  quarterlyTrades.length === 1
                    ? ""
                    : "s"
                } found for ${
                  formData.quarter ||
                  "this quarter"
                } ${
                  formData.year || ""
                }.`
              : "Select a quarter and year to calculate quarterly statistics."}

          </div>

        </section>

        {/* ================================================== */}
        {/* PERFORMANCE BREAKDOWN */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5">

            <h2 className="text-base font-semibold text-gray-900">
              Quarterly Performance Breakdown
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
              [
                "worstInstrument",
                "Worst Instrument",
              ],
            ].map(
              ([field, label]) => (

                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <input
                    type="text"
                    value={formData[field]}
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
                "bestPerformingSetups",
                "Best Performing Setups",
              ],
              [
                "poorPerformingSetups",
                "Poor Performing Setups",
              ],
              [
                "suitableConditions",
                "Conditions Where Strategy Performed Well",
              ],
              [
                "difficultConditions",
                "Difficult Market Conditions",
              ],
              [
                "systemConsistency",
                "System Consistency",
              ],
              [
                "strategyImprovement",
                "Strategy Improvement",
              ],
            ].map(
              ([field, label]) => (

                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={formData[field]}
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
              Risk Management Review
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {[
              [
                "riskPerTrade",
                "Risk Per Trade",
              ],
              [
                "dailyLossLimit",
                "Daily Loss Limit",
              ],
              [
                "overtrading",
                "Overtrading",
              ],
              [
                "increasedRisk",
                "Increased Risk",
              ],
              [
                "movedStops",
                "Moved Stops",
              ],
              [
                "profitTaking",
                "Profit Taking",
              ],
            ].map(
              ([field, label]) => (

                <div key={field}>

                  <label className={labelClass}>
                    {label}
                  </label>

                  <textarea
                    value={formData[field]}
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
                "disciplineHelper",
                "What Helped Discipline?",
              ],
              [
                "disciplineProblem",
                "What Hurt Discipline?",
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
                    value={formData[field]}
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
        {/* QUARTERLY REFLECTION */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5">

            <h2 className="text-base font-semibold text-gray-900">
              Quarterly Reflection
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "biggestMistake",
                "Biggest Mistake",
              ],
              [
                "biggestImprovement",
                "Biggest Improvement",
              ],
              [
                "biggestLesson",
                "Biggest Lesson",
              ],
              [
                "comparedPreviousQuarter",
                "Compared With Previous Quarter",
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
                    value={formData[field]}
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
        {/* NEXT QUARTER */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Target
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Next Quarter&apos;s Focus
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
                    value={formData[field]}
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
              ? "Update Quarterly Review"
              : "Save Quarterly Review"}
          </button>

        </div>

      </div>
    </div>
  );
}

export default QuarterlyReview;