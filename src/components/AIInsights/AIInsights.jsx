import { useMemo } from "react";
import {
  Brain,
  TrendingUp,
  Target,
  Clock,
  AlertTriangle,
  Lightbulb,
  Activity,
  ShieldCheck,
} from "lucide-react";

import { useJournal } from "../../context/JournalContext";
import { generateAIInsights } from "../../utils/aiInsights/aiInsightsEngine";

import PageHeader from "../common/PageHeader";

export default function AIInsights() {
  const { trades = [] } = useJournal();

  const insights = useMemo(() => {
    return generateAIInsights(trades);
  }, [trades]);

  const performance = insights?.performance || {};
  const plans = Array.isArray(insights?.plans)
    ? insights.plans
    : [];

  const sessions = Array.isArray(insights?.sessions)
    ? insights.sessions
    : [];

  const mistakes = Array.isArray(insights?.mistakes)
    ? insights.mistakes
    : [];

  const recommendations = Array.isArray(
    insights?.recommendations
  )
    ? insights.recommendations
    : [];

  const behavior = insights?.behavior || {};
  const psychology = insights?.psychology || {};

  return (
    <div className="space-y-6">

      {/* HEADER */}
 
      <PageHeader
  title="AI Insights"
  subtitle="Intelligent analysis of your trading behavior, performance and decision making."
  icon="ai"
/>
    

      {/* EMPTY STATE */}
      {trades.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Brain
            size={40}
            className="mx-auto text-violet-400 mb-4"
          />

          <h2 className="text-lg font-semibold text-gray-900">
            Not enough trading data
          </h2>

          <p className="text-sm text-gray-500 mt-2">
            Take and journal some trades to unlock AI insights.
          </p>
        </div>
      ) : (
        <>
          {/* EXECUTIVE SUMMARY */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white shadow-sm">

            <div className="flex items-center gap-2 mb-3">
              <Brain size={20} />

              <h2 className="font-semibold">
                AI Trading Summary
              </h2>
            </div>

            <p className="text-sm text-violet-100 leading-6">
              Your journal contains{" "}
              <b className="text-white">
                {trades.length}
              </b>{" "}
              recorded trades. AI analysis is combining
              performance, plans, sessions, mistakes,
              behavior and psychology to identify your
              strongest and weakest trading patterns.
            </p>
          </div>

          {/* TOP METRICS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <Metric
              icon={<TrendingUp size={18} />}
              title="Trades"
              value={trades.length}
            />

            <Metric
              icon={<Target size={18} />}
              title="Best Plan"
              value={
                plans[0]?.plan ||
                plans[0]?.name ||
                "—"
              }
            />

            <Metric
              icon={<Clock size={18} />}
              title="Best Session"
              value={
                sessions[0]?.session ||
                "—"
              }
            />

            <Metric
              icon={<ShieldCheck size={18} />}
              title="Recommendations"
              value={recommendations.length}
            />

          </div>

          {/* RECOMMENDATIONS */}
          <InsightSection
            title="Smart Recommendations"
            icon={
              <Lightbulb
                size={19}
                className="text-yellow-500"
              />
            }
          >
            {recommendations.length === 0 ? (
              <EmptyText text="No recommendations available yet." />
            ) : (
              recommendations.slice(0, 5).map(
                (item, index) => (
                  <InsightItem
                    key={index}
                    type="recommendation"
                    text={
                      typeof item === "string"
                        ? item
                        : item.message ||
                          item.description ||
                          item.title ||
                          "Review this trading pattern."
                    }
                  />
                )
              )
            )}
          </InsightSection>

          {/* PLANS + SESSIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <InsightSection
              title="Plan Intelligence"
              icon={
                <Target
                  size={19}
                  className="text-violet-600"
                />
              }
            >
              {plans.length === 0 ? (
                <EmptyText text="No plan data available." />
              ) : (
                plans.slice(0, 5).map(
                  (plan, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-gray-100 p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {plan.plan ||
                              plan.name ||
                              "Trading Plan"}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            {plan.trades ??
                              plan.tradeCount ??
                              0}{" "}
                            trades
                          </p>
                        </div>

                        {plan.pnl !== undefined ||
                        plan.netPnL !== undefined ? (
                          <span
                            className={
                              Number(
                                plan.netPnL ??
                                plan.pnl ??
                                0
                              ) >= 0
                                ? "text-green-600 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            $
                            {Number(
                              plan.netPnL ??
                              plan.pnl ??
                              0
                            ).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                )
              )}
            </InsightSection>

            <InsightSection
              title="Session Intelligence"
              icon={
                <Activity
                  size={19}
                  className="text-blue-600"
                />
              }
            >
              {sessions.length === 0 ? (
                <EmptyText text="No session data available." />
              ) : (
                sessions.slice(0, 5).map(
                  (session, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-gray-100 p-4"
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">
                            {session.session ||
                              session.name ||
                              "Session"}
                          </p>

                          {session.winRate !==
                            undefined && (
                            <p className="text-xs text-gray-500 mt-1">
                              Win Rate:{" "}
                              {Number(
                                session.winRate
                              ).toFixed(1)}
                              %
                            </p>
                          )}
                        </div>

                        {session.pnl !==
                          undefined ||
                        session.netPnL !==
                          undefined ? (
                          <span
                            className={
                              Number(
                                session.netPnL ??
                                session.pnl ??
                                0
                              ) >= 0
                                ? "text-green-600 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            $
                            {Number(
                              session.netPnL ??
                              session.pnl ??
                              0
                            ).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                )
              )}
            </InsightSection>

          </div>

          {/* MISTAKES */}
          <InsightSection
            title="Mistake Intelligence"
            icon={
              <AlertTriangle
                size={19}
                className="text-red-500"
              />
            }
          >
            {mistakes.length === 0 ? (
              <EmptyText text="No repeated mistakes detected." />
            ) : (
              mistakes.slice(0, 5).map(
                (mistake, index) => (
                  <InsightItem
                    key={index}
                    type="danger"
                    text={
                      typeof mistake === "string"
                        ? mistake
                        : `"${mistake.mistake || mistake.name || "Trading mistake"}" occurred ${
                            mistake.count || 0
                          } times.`
                    }
                  />
                )
              )
            )}
          </InsightSection>

          {/* BEHAVIOR + PSYCHOLOGY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <InsightSection
              title="Behavior Analysis"
              icon={
                <Activity
                  size={19}
                  className="text-orange-500"
                />
              }
            >
              <ObjectInsights data={behavior} />
            </InsightSection>

            <InsightSection
              title="Psychology Analysis"
              icon={
                <Brain
                  size={19}
                  className="text-violet-600"
                />
              }
            >
              <ObjectInsights data={psychology} />
            </InsightSection>

          </div>

          {/* PERFORMANCE */}
          <InsightSection
            title="Performance Intelligence"
            icon={
              <TrendingUp
                size={19}
                className="text-green-600"
              />
            }
          >
            <ObjectInsights data={performance} />
          </InsightSection>

        </>
      )}
    </div>
  );
}


/* -------------------------------- */
/* METRIC */
/* -------------------------------- */

function Metric({
  icon,
  title,
  value,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">

      <div className="flex items-center gap-2 text-gray-500">
        {icon}

        <span className="text-xs">
          {title}
        </span>
      </div>

      <p className="text-lg font-bold text-gray-900 mt-3 truncate">
        {value}
      </p>

    </div>
  );
}


/* -------------------------------- */
/* SECTION */
/* -------------------------------- */

function InsightSection({
  title,
  icon,
  children,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">

      <div className="flex items-center gap-2 mb-5">

        {icon}

        <h2 className="font-semibold text-gray-900">
          {title}
        </h2>

      </div>

      <div className="space-y-3">
        {children}
      </div>

    </div>
  );
}


/* -------------------------------- */
/* INSIGHT ITEM */
/* -------------------------------- */

function InsightItem({
  text,
  type = "recommendation",
}) {
  const styles = {
    recommendation:
      "bg-violet-50 border-violet-100 text-violet-900",

    danger:
      "bg-red-50 border-red-100 text-red-800",

    success:
      "bg-green-50 border-green-100 text-green-800",
  };

  return (
    <div
      className={`rounded-xl border p-4 text-sm leading-6 ${styles[type]}`}
    >
      {text}
    </div>
  );
}


/* -------------------------------- */
/* OBJECT INSIGHTS */
/* -------------------------------- */

function ObjectInsights({ data }) {
  if (!data || typeof data !== "object") {
    return (
      <EmptyText text="No analysis available yet." />
    );
  }

  return (
    <div className="space-y-4">

      {Object.entries(data).map(([key, value]) => {

        // -----------------------------
        // ARRAY
        // -----------------------------
        if (Array.isArray(value)) {
          return (
            <div
              key={key}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
                {formatInsightKey(key)}
              </p>

              {value.length === 0 ? (
                <p className="text-sm text-gray-400">
                  None detected
                </p>
              ) : (
                <div className="space-y-2">
                  {value.slice(0, 6).map((item, index) => (
                    <div
                      key={index}
                      className="rounded-lg bg-white border border-gray-100 px-3 py-2 text-sm text-gray-700"
                    >
                      {typeof item === "object"
                        ? renderObject(item)
                        : String(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        // -----------------------------
        // NESTED OBJECT
        // -----------------------------
        if (
          value &&
          typeof value === "object"
        ) {
          return (
            <div
              key={key}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {formatInsightKey(key)}
                </p>

                {value.detected !== undefined && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      value.detected
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {value.detected
                      ? "Detected"
                      : "Clear"}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {Object.entries(value).map(
                  ([nestedKey, nestedValue]) => {

                    if (
                      nestedKey === "message" ||
                      nestedKey === "recommendation"
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={nestedKey}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-gray-500">
                          {formatInsightKey(nestedKey)}
                        </span>

                        <span className="text-sm font-semibold text-gray-900 text-right">
                          {formatInsightValue(
                            nestedValue
                          )}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>

              {value.message && (
                <div className="mt-3 rounded-lg bg-white border border-gray-100 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    AI Observation
                  </p>

                  <p className="text-sm text-gray-700">
                    {value.message}
                  </p>
                </div>
              )}

              {value.recommendation && (
                <div className="mt-3 rounded-lg bg-violet-50 border border-violet-100 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-violet-500 mb-1">
                    Recommendation
                  </p>

                  <p className="text-sm text-violet-900">
                    {value.recommendation}
                  </p>
                </div>
              )}
            </div>
          );
        }

        // -----------------------------
        // NORMAL VALUE
        // -----------------------------
        return (
          <div
            key={key}
            className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3"
          >
            <span className="text-sm text-gray-500">
              {formatInsightKey(key)}
            </span>

            <span className="text-sm font-semibold text-gray-900 text-right">
              {formatInsightValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatInsightKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}


function formatInsightValue(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toFixed(1);
  }

  if (typeof value === "object") {
    return renderObject(value);
  }

  return String(value);
}


function renderObject(object) {
  if (!object || typeof object !== "object") {
    return String(object);
  }

  return Object.entries(object)
    .map(
      ([key, value]) =>
        `${formatInsightKey(key)}: ${formatInsightValue(value)}`
    )
    .join(" • ");
}

/* -------------------------------- */
/* EMPTY */
/* -------------------------------- */

function EmptyText({ text }) {
  return (
    <p className="text-sm text-gray-400 py-3">
      {text}
    </p>
  );
}

function NestedInsight({ title, data }) {
  const detected = data?.detected;

  const severity = data?.severity;
  const count = data?.count;
  const message = data?.message;
  const recommendation = data?.recommendation;
  const scoreImpact = data?.scoreImpact;

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">
            {title}
          </span>

          {severity && (
            <SeverityBadge severity={severity} />
          )}
        </div>

        {detected !== undefined && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              detected
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {detected ? "Detected" : "Clear"}
          </span>
        )}
      </div>

      {/* BODY */}
      <div className="p-4 space-y-3">

        {count !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Occurrences
            </span>

            <span className="font-semibold text-gray-900">
              {count}
            </span>
          </div>
        )}

        {scoreImpact !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Score Impact
            </span>

            <span
              className={`font-semibold ${
                Number(scoreImpact) > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {Number(scoreImpact) > 0
                ? `-${scoreImpact}`
                : "0"}
            </span>
          </div>
        )}

        {data?.averageTradesPerDay !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Avg Trades / Day
            </span>

            <span className="font-semibold">
              {data.averageTradesPerDay}
            </span>
          </div>
        )}

        {data?.threshold !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Threshold
            </span>

            <span className="font-semibold">
              {data.threshold}
            </span>
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-white border border-gray-100 p-3">
            <p className="text-xs text-gray-500 mb-1">
              AI Observation
            </p>

            <p className="text-sm text-gray-700 leading-5">
              {message}
            </p>
          </div>
        )}

        {recommendation && (
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb
                size={14}
                className="text-violet-600"
              />

              <span className="text-xs font-semibold text-violet-700">
                Recommendation
              </span>
            </div>

            <p className="text-sm text-violet-900 leading-5">
              {recommendation}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const styles = {
    none:
      "bg-gray-100 text-gray-600",

    low:
      "bg-yellow-100 text-yellow-700",

    medium:
      "bg-orange-100 text-orange-700",

    high:
      "bg-red-100 text-red-700",

    critical:
      "bg-red-200 text-red-800",
  };

  return (
    <span
      className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
        styles[severity] ||
        styles.none
      }`}
    >
      {severity}
    </span>
  );
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatValue(key, value) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (
    key.toLowerCase().includes("rate") ||
    key.toLowerCase().includes("score")
  ) {
    return `${value}`;
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value
      : value.toFixed(1);
  }

  return String(value);
}

