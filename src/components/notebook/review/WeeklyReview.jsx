import { useMemo, useState } from "react";

import { useJournal } from "../../../context/JournalContext";
import { calculateReviewStats } from "./reviewStats";

import {
  ArrowLeft,
  CalendarRange,
  Save,
  CheckCircle2,
  Brain,
  Target,
  BarChart3,
} from "lucide-react";

function WeeklyReview({
  onBack,
  initialData = null,
  reviewKey = null,
}) {
  const {
    filteredTrades,
    selectedAccountId,
  } = useJournal();

  const defaultData = {
    week: "",
    startDate: "",
    endDate: "",
    sessions: "",
    marketCondition: "",
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
    bestDay: "",
    worstDay: "",
    bestSetup: "",
    worstSetup: "",
    bestSession: "",
    worstSession: "",
    commonTradeType: "",
    commonMistake: "",
    followedPlan: "",
    correctAPlus: "",
    missedSetups: "",
    impulseTrades: "",
    riskRules: "",
    executionImprovement: "",
    biggestMistake: "",
    didWell: "",
    tradingPattern: "",
    emotionalPattern: "",
    biggestLesson: "",
    differently: "",
    repeat: "",
    stop: "",
    skill: "",
    setup: "",
    rule: "",
  };

  const [formData, setFormData] = useState({
    ...defaultData,
    ...(initialData || {}),
  });

  // ============================================================
  // WEEKLY JOURNAL TRADES
  // ============================================================

  const weeklyTrades = useMemo(() => {
    if (!formData.startDate || !formData.endDate) {
      return [];
    }

    return filteredTrades.filter((trade) => {
      if (!trade?.date) {
        return false;
      }

      return (
        trade.date >= formData.startDate &&
        trade.date <= formData.endDate
      );
    });
  }, [
    filteredTrades,
    formData.startDate,
    formData.endDate,
  ]);

  // ============================================================
  // WEEKLY STATISTICS
  // ============================================================

  const calculatedStats = useMemo(() => {
    return calculateReviewStats(weeklyTrades);
  }, [weeklyTrades]);

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
  `edgefinder-weekly-review-${accountKey}-${
    formData.startDate || Date.now()
  }`;

  const dataToSave = {
    ...formData,
    accountId: selectedAccountId
      ? String(selectedAccountId).trim()
      : null,
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
        ? "Weekly review updated successfully."
        : "Weekly review saved successfully."
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
              Weekly Review
            </h1>

            <p className="text-sm text-gray-500">
              Review your weekly trading performance,
              execution and psychology.
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
        {/* WEEKLY OVERVIEW */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <CalendarRange
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Weekly Overview
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">

            <div>
              <label className={labelClass}>
                Week
              </label>

              <input
                type="text"
                value={formData.week}
                onChange={(e) =>
                  updateField(
                    "week",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="Week 1"
              />
            </div>

            <div>
              <label className={labelClass}>
                Start Date
              </label>

              <input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  updateField(
                    "startDate",
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                End Date
              </label>

              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  updateField(
                    "endDate",
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Sessions
              </label>

              <input
                type="text"
                value={formData.sessions}
                onChange={(e) =>
                  updateField(
                    "sessions",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="London, NY"
              />
            </div>

            <div>
              <label className={labelClass}>
                Market Condition
              </label>

              <select
                value={formData.marketCondition}
                onChange={(e) =>
                  updateField(
                    "marketCondition",
                    e.target.value
                  )
                }
                className={inputClass}
              >
                <option value="">
                  Select condition
                </option>

                <option value="Trending">
                  Trending
                </option>

                <option value="Ranging">
                  Ranging
                </option>

                <option value="Choppy">
                  Choppy
                </option>

                <option value="News-driven">
                  News-driven
                </option>
              </select>
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
                Weekly Summary Statistics
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

            {weeklyTrades.length > 0
              ? `${weeklyTrades.length} journal trade${
                  weeklyTrades.length === 1
                    ? ""
                    : "s"
                } found between ${
                  formData.startDate
                } and ${
                  formData.endDate
                }.`
              : "Select a valid start and end date to calculate weekly statistics."}

          </div>

        </section>

        {/* ================================================== */}
        {/* PERFORMANCE BREAKDOWN */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5">

            <h2 className="text-base font-semibold text-gray-900">
              Performance Breakdown
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {[
              ["bestDay", "Best Day"],
              ["worstDay", "Worst Day"],
              ["bestSetup", "Best Setup"],
              ["worstSetup", "Worst Setup"],
              ["bestSession", "Best Session"],
              ["worstSession", "Worst Session"],
              [
                "commonTradeType",
                "Most Common Trade Type",
              ],
              [
                "commonMistake",
                "Most Common Mistake",
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
        {/* EXECUTION */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <CheckCircle2
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Execution Check
            </h2>

          </div>

          <div className="space-y-4">

            <div>

              <label className={labelClass}>
                Did I follow my trading plan?
              </label>

              <div className="flex gap-3">

                {[
                  "Yes",
                  "Partially",
                  "No",
                ].map((option) => (

                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      updateField(
                        "followedPlan",
                        option
                      )
                    }
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      formData.followedPlan === option
                        ? "border-purple-600 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {option}
                  </button>

                ))}

              </div>

            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

              <div>

                <label className={labelClass}>
                  A+ Setups Executed
                </label>

                <input
                  type="text"
                  value={formData.correctAPlus}
                  onChange={(e) =>
                    updateField(
                      "correctAPlus",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />

              </div>

              <div>

                <label className={labelClass}>
                  Missed Setups
                </label>

                <input
                  type="text"
                  value={formData.missedSetups}
                  onChange={(e) =>
                    updateField(
                      "missedSetups",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />

              </div>

              <div>

                <label className={labelClass}>
                  Impulse / FOMO Trades
                </label>

                <input
                  type="text"
                  value={formData.impulseTrades}
                  onChange={(e) =>
                    updateField(
                      "impulseTrades",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />

              </div>

            </div>

            <div>

              <label className={labelClass}>
                Risk Rules Followed
              </label>

              <textarea
                value={formData.riskRules}
                onChange={(e) =>
                  updateField(
                    "riskRules",
                    e.target.value
                  )
                }
                className={textareaClass}
              />

            </div>

            <div>

              <label className={labelClass}>
                Execution Improvement
              </label>

              <textarea
                value={formData.executionImprovement}
                onChange={(e) =>
                  updateField(
                    "executionImprovement",
                    e.target.value
                  )
                }
                className={textareaClass}
              />

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* REFLECTION */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Brain
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Weekly Reflection
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "biggestMistake",
                "Biggest mistake this week",
              ],
              [
                "didWell",
                "What did I do well?",
              ],
              [
                "tradingPattern",
                "Trading pattern I noticed",
              ],
              [
                "emotionalPattern",
                "Emotional pattern I noticed",
              ],
              [
                "biggestLesson",
                "Biggest lesson",
              ],
              [
                "differently",
                "What would I do differently?",
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
        {/* NEXT WEEK */}
        {/* ================================================== */}

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Target
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Next Week&apos;s Focus
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "repeat",
                "One thing I will repeat",
              ],
              [
                "stop",
                "One thing I will stop doing",
              ],
              [
                "skill",
                "Skill I will improve",
              ],
              [
                "setup",
                "Setup I will focus on",
              ],
              [
                "rule",
                "One rule I will follow",
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
              ? "Update Weekly Review"
              : "Save Weekly Review"}
          </button>

        </div>

      </div>
    </div>
  );
}

export default WeeklyReview;