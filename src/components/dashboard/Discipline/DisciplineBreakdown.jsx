import { useMemo } from "react";

import { selectRealizedTrades } from "../../../utils/dashboardCurveEngine";

export default function DisciplineBreakdown({
  trades = [],
  startDate = null,
  endDate = null,
}) {

  const stats = useMemo(() => {

    // The same closed-trade slice of the applied period that every other Dashboard
    // widget reads, so the scores cannot describe a different range than the charts.
    const realized = selectRealizedTrades(trades, { startDate, endDate });

    const periodTrades = realized.map((entry) => entry.trade);

    if (periodTrades.length === 0) {
      return {
        performance: 0,
        discipline: 0,
        riskManagement: 0,
        consistency: 0,
        overall: 0,
        streak: 0,
        grade: "—",
      };
    }

    // baaki calculation...

    const totalTrades = periodTrades.length;

    // ==========================================
    // PERFORMANCE
    // ==========================================

    const wins = periodTrades.filter((trade) => {
      const result = String(trade?.result || "").toLowerCase();
      const pnl = Number(trade?.pnl || 0);

      return result === "win" || pnl > 0;
    }).length;

    const winRate = (wins / totalTrades) * 100;

    const performance = Math.min(
      100,
      Math.round(winRate * 1.2)
    );

    // ==========================================
    // DISCIPLINE
    // ==========================================

    const followedPlanTrades = periodTrades.filter((trade) => {
      return (
        trade?.followedPlan === true ||
        trade?.followedPlan === "true" ||
        trade?.followedPlan === "yes" ||
        trade?.followedPlan === "Yes"
      );
    }).length;

    const discipline = Math.min(
      100,
      Math.round(
        (followedPlanTrades / totalTrades) * 100
      )
    );

    // ==========================================
    // RISK MANAGEMENT
    // ==========================================

    const goodRiskTrades = periodTrades.filter((trade) => {
      const rr = Number(trade?.rr || 0);

      const hasStopLoss =
        trade?.stopLoss !== undefined &&
        trade?.stopLoss !== null &&
        trade?.stopLoss !== "";

      return rr >= 1 || hasStopLoss;
    }).length;

    const riskManagement = Math.min(
      100,
      Math.round(
        (goodRiskTrades / totalTrades) * 100
      )
    );

    // ==========================================
    // CONSISTENCY
    // ==========================================

    const dayMap = {};

    // Daily buckets carry the same realised timestamp as the Daily P&L curve.
    realized.forEach(({ trade, closedAt }) => {
      const day = new Date(closedAt).toDateString();

      if (!dayMap[day]) {
        dayMap[day] = 0;
      }

      dayMap[day] += Number(trade?.pnl || 0);
    });

    const days = Object.values(dayMap);

    const profitableDays = days.filter(
      (pnl) => pnl > 0
    ).length;

    const consistency =
      days.length > 0
        ? Math.min(
            100,
            Math.round(
              (profitableDays / days.length) * 100
            )
          )
        : 0;

    // ==========================================
    // OVERALL SCORE
    // ==========================================

    const overall = Math.round(
      performance * 0.3 +
        discipline * 0.25 +
        riskManagement * 0.25 +
        consistency * 0.2
    );

    // ==========================================
    // GRADE
    // ==========================================

    let grade = "F";

    if (overall >= 90) grade = "A+";
    else if (overall >= 85) grade = "A";
    else if (overall >= 80) grade = "B+";
    else if (overall >= 75) grade = "B";
    else if (overall >= 70) grade = "C+";
    else if (overall >= 60) grade = "C";
    else if (overall >= 50) grade = "D";

    // ==========================================
    // CURRENT PROFITABLE DAY STREAK
    // ==========================================

    const sortedDays = Object.entries(dayMap)
      .sort(
        (a, b) =>
          new Date(a[0]) - new Date(b[0])
      );

    let streak = 0;

    for (
      let i = sortedDays.length - 1;
      i >= 0;
      i--
    ) {
      const pnl = sortedDays[i][1];

      if (pnl > 0) {
        streak++;
      } else {
        break;
      }
    }

    return {
      performance,
      discipline,
      riskManagement,
      consistency,
      overall,
      streak,
      grade,
    };
  }, [trades, startDate, endDate]);

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* HEADER */}
      <div className="px-4 py-2.5 border-b border-gray-200 shrink-0">
        <h2 className="text-base font-semibold text-gray-900">
          Discipline Breakdown
        </h2>
      </div>

      {/* CONTENT */}
      <div className="flex-1 min-h-0 px-4 py-3.5 flex flex-col justify-between gap-3">

        <div className="flex flex-col gap-3">
          <ScoreBar
            label="Performance"
            value={stats.performance}
            color="bg-emerald-500"
          />

          <ScoreBar
            label="Discipline"
            value={stats.discipline}
            color="bg-violet-500"
          />

          <ScoreBar
            label="Risk Management"
            value={stats.riskManagement}
            color="bg-sky-500"
          />

          <ScoreBar
            label="Consistency"
            value={stats.consistency}
            color="bg-orange-500"
          />
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-gray-200 pt-3 flex items-center justify-between gap-4">

          <div>
            <p className="text-xs text-gray-500">
              Current Streak
            </p>

            <p className="text-sm font-medium text-gray-900 mt-1">
              🔥 {stats.streak}{" "}
              {stats.streak === 1 ? "Day" : "Days"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">
              Grade
            </p>

            <span
              className={`inline-flex items-center justify-center mt-1 min-w-8 h-8 px-2 rounded-full text-sm font-semibold ${
                stats.grade.startsWith("A")
                  ? "bg-green-100 text-green-700"
                  : stats.grade.startsWith("B")
                  ? "bg-blue-100 text-blue-700"
                  : stats.grade.startsWith("C")
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {stats.grade}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}


// ==========================================
// SCORE BAR
// ==========================================

function ScoreBar({ label, value, color }) {
  return (
    <div>

      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] text-gray-700">
          {label}
        </span>

        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-900">
          {value}/100
        </span>
      </div>

      <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{
            width: `${value}%`,
          }}
        />
      </div>

    </div>
  );
}


// ==========================================
// SCORE CIRCLE
// ==========================================

function ScoreCircle({ score }) {
  const angle = score * 3.6;

  return (
    <div
      className="relative w-36 h-36 rounded-full flex items-center justify-center"
      style={{
        background: `conic-gradient(
          #8B5CF6 ${angle}deg,
          #E5E7EB ${angle}deg
        )`,
      }}
    >
      <div className="w-28 h-28 rounded-full bg-white flex flex-col items-center justify-center">

        <span className="text-3xl font-bold text-gray-900">
          {score}
        </span>

        <span className="text-xs text-gray-500">
          Discipline Score
        </span>

      </div>
    </div>
  );
}