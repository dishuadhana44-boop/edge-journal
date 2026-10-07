import { useMemo, useState } from "react";

import { useJournal } from "../../../context/JournalContext";
import { calculateReviewStats } from "./reviewStats";

import {
  ArrowLeft,
  CalendarDays,
  Save,
  CheckCircle2,
  Brain,
  Target,
  BarChart3,
} from "lucide-react";

function DailyReview({
  onBack,
  initialData = null,
  reviewKey = null,
}) {
  const {
    filteredTrades,
    selectedAccountId,
  } = useJournal();

  const defaultData = {
    date: new Date().toISOString().split("T")[0],
    session: "",
    market: "",
    wins: "",
    losses: "",
    breakeven: "",
    totalTrades: "",
    winRate: "",
    netPL: "",
    netR: "",
    maxDrawdown: "",
    ruleBreaks: "",
    followedPlan: "",
    aPlusSetups: "",
    impulseTrades: "",
    missedSetups: "",
    bestTrade: "",
    worstTrade: "",
    mainMistake: "",
    didWell: "",
    emotion: "",
    lesson: "",
    repeat: "",
    stop: "",
    rule: "",
  };

  const [formData, setFormData] = useState({
    ...defaultData,
    ...(initialData || {}),
  });

  const dailyTrades = useMemo(() => {
    if (!formData.date) {
      return [];
    }

    return filteredTrades.filter(
      (trade) => trade?.date === formData.date
    );
  }, [filteredTrades, formData.date]);

  const calculatedStats = useMemo(() => {
    return calculateReviewStats(dailyTrades);
  }, [dailyTrades]);

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const accountKey =
    selectedAccountId
      ? String(selectedAccountId).trim()
      : "no-account";
  
  const key =
    reviewKey ||
    `edgefinder-daily-review-${accountKey}-${formData.date || Date.now()}`;

    const dataToSave = {
      ...formData,
      accountId: selectedAccountId
        ? String(selectedAccountId).trim()
        : null,
      wins: calculatedStats.wins,
      losses: calculatedStats.losses,
      breakeven: calculatedStats.breakeven,
      totalTrades: calculatedStats.totalTrades,
      winRate: calculatedStats.winRate,
      netPL: calculatedStats.netPL,
      netR: calculatedStats.netR,
      maxDrawdown: calculatedStats.maxDrawdown,
    };

    localStorage.setItem(key, JSON.stringify(dataToSave));

    setFormData(dataToSave);

    alert(
      reviewKey
        ? "Daily review updated successfully."
        : "Daily review saved successfully."
    );
  };

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
              Daily Review
            </h1>

            <p className="text-sm text-gray-500">
              Review your trading performance,
              execution and psychology.
            </p>
          </div>

        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700"
        >
          <Save size={16} />
          {reviewKey ? "Update Review" : "Save Review"}
        </button>
      </div>

      <div className="space-y-5">

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">
            <CalendarDays
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Daily Overview
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <div>
              <label className={labelClass}>
                Date
              </label>

              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  updateField("date", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Session
              </label>

              <select
                value={formData.session}
                onChange={(e) =>
                  updateField("session", e.target.value)
                }
                className={inputClass}
              >
                <option value="">Select session</option>
                <option value="Asia">Asia</option>
                <option value="London">London</option>
                <option value="New York">New York</option>
                <option value="Multiple">Multiple</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Market
              </label>

              <select
                value={formData.market}
                onChange={(e) =>
                  updateField("market", e.target.value)
                }
                className={inputClass}
              >
                <option value="">
                  Select market condition
                </option>
                <option value="Trending">Trending</option>
                <option value="Ranging">Ranging</option>
                <option value="Choppy">Choppy</option>
                <option value="News-driven">
                  News-driven
                </option>
              </select>
            </div>

          </div>
        </section>

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <BarChart3
              size={19}
              className="text-purple-600"
            />

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Summary Statistics
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                Automatically calculated from Journal trades
              </p>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

            <div>
              <label className={labelClass}>Wins</label>
              <input
                type="text"
                value={calculatedStats.wins}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Losses</label>
              <input
                type="text"
                value={calculatedStats.losses}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Breakeven</label>
              <input
                type="text"
                value={calculatedStats.breakeven}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Total Trades
              </label>
              <input
                type="text"
                value={calculatedStats.totalTrades}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Win Rate (%)
              </label>
              <input
                type="text"
                value={`${calculatedStats.winRate}%`}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Net P/L
              </label>
              <input
                type="text"
                value={calculatedStats.netPL}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Net (R)
              </label>
              <input
                type="text"
                value={calculatedStats.netR}
                readOnly
                className={calculatedInputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Max Drawdown (R)
              </label>
              <input
                type="text"
                value={calculatedStats.maxDrawdown}
                readOnly
                className={calculatedInputClass}
              />
            </div>

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

          </div>

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
            {dailyTrades.length > 0
              ? `${dailyTrades.length} journal trade${
                  dailyTrades.length === 1 ? "" : "s"
                } found for ${formData.date}.`
              : `No journal trades found for ${formData.date}.`}
          </div>

        </section>

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
                Did I follow my plan today?
              </label>

              <div className="flex gap-3">

                {["Yes", "Partially", "No"].map(
                  (option) => (
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
                  )
                )}

              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

              <div>
                <label className={labelClass}>
                  A+ Setups Taken
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

              <div>
                <label className={labelClass}>
                  Missed Valid Setups
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

            </div>

            <div>
              <label className={labelClass}>
                Best Trade Today
              </label>

              <textarea
                value={formData.bestTrade}
                onChange={(e) =>
                  updateField(
                    "bestTrade",
                    e.target.value
                  )
                }
                className={textareaClass}
                placeholder="What made this trade good?"
              />
            </div>

            <div>
              <label className={labelClass}>
                Worst Trade Today
              </label>

              <textarea
                value={formData.worstTrade}
                onChange={(e) =>
                  updateField(
                    "worstTrade",
                    e.target.value
                  )
                }
                className={textareaClass}
                placeholder="What went wrong?"
              />
            </div>

          </div>
        </section>

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Brain
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Daily Reflection
            </h2>

          </div>

          <div className="space-y-4">

            {[
              [
                "mainMistake",
                "What was the main mistake I made today?",
              ],
              [
                "didWell",
                "What did I do well today?",
              ],
              [
                "emotion",
                "What emotion affected my trading the most?",
              ],
              [
                "lesson",
                "What is the one lesson from today?",
              ],
            ].map(([field, label]) => (
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
            ))}

          </div>
        </section>

        <section className={sectionClass}>

          <div className="mb-5 flex items-center gap-2">

            <Target
              size={19}
              className="text-purple-600"
            />

            <h2 className="text-base font-semibold text-gray-900">
              Tomorrow&apos;s Focus
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
                "rule",
                "One rule I will follow no matter what",
              ],
            ].map(([field, label]) => (
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
            ))}

          </div>
        </section>

        <div className="flex justify-end">

          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700"
          >
            <Save size={16} />

            {reviewKey
              ? "Update Daily Review"
              : "Save Daily Review"}
          </button>

        </div>

      </div>
    </div>
  );
}

export default DailyReview;