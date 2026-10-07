// src/pages/Tools/components/TradingSessions.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Gauge,
  Layers3,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import SessionTimeline from "./SessionTimeline";
import SessionIntelligence from "./SessionIntelligence";
import SessionOverlapAnalyzer from "./SessionOverlapAnalyzer";
import KillZoneAnalyzer from "./KillZoneAnalyzer";
import SessionHeatmap from "./SessionHeatmap";

const SESSIONS = [
  {
    name: "Sydney",
    city: "Sydney",
    start: 22,
    end: 7,
    timezone: "Australia/Sydney",
  },
  {
    name: "Tokyo",
    city: "Tokyo",
    start: 0,
    end: 9,
    timezone: "Asia/Tokyo",
  },
  {
    name: "London",
    city: "London",
    start: 8,
    end: 17,
    timezone: "Europe/London",
  },
  {
    name: "New York",
    city: "New York",
    start: 13,
    end: 22,
    timezone: "America/New_York",
  },
];

function isSessionOpen(hour, start, end) {
  if (start < end) {
    return hour >= start && hour < end;
  }

  return hour >= start || hour < end;
}

function getTimeParts(timezone) {
  try {
    const now = new Date();

    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);

    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now);

    return {
      time,
      date,
    };
  } catch {
    return {
      time: "--:--:--",
      date: "--",
    };
  }
}

function getUTCDateTime() {
  const now = new Date();

  return {
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
    second: now.getUTCSeconds(),
  };
}

function getCountdown(targetHour) {
  const now = new Date();
  const target = new Date(now);

  target.setUTCHours(targetHour, 0, 0, 0);

  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const diff = target.getTime() - now.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));

  const minutes = Math.floor(
    (diff / (1000 * 60)) % 60
  );

  const seconds = Math.floor(
    (diff / 1000) % 60
  );

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getSessionStatus(hour) {
  const active = SESSIONS.filter((session) =>
    isSessionOpen(
      hour,
      session.start,
      session.end
    )
  );

  if (active.length >= 2) {
    return {
      label: "SESSION OVERLAP",
      description:
        "Multiple major sessions are active.",
      icon: Layers3,
      className:
        "text-violet-600 bg-violet-50 dark:bg-violet-900/10",
    };
  }

  if (active.length === 1) {
    return {
      label: "ACTIVE SESSION",
      description:
        "A major global session is currently active.",
      icon: Activity,
      className:
        "text-green-600 bg-green-50 dark:bg-green-900/10",
    };
  }

  return {
    label: "LOW ACTIVITY",
    description:
      "No major session is currently active.",
    icon: Clock3,
    className:
      "text-gray-500 bg-gray-100 dark:bg-gray-800",
  };
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function TradingSessions() {
  const navigate = useNavigate();

  const [now, setNow] = useState(new Date());
  const [selectedSession, setSelectedSession] =
    useState("London");
  const [selectedHour, setSelectedHour] =
    useState(new Date().getUTCHours());
  const [refreshing, setRefreshing] =
    useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setSelectedHour(new Date().getUTCHours());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const utc = useMemo(
    () => getUTCDateTime(),
    [now]
  );

  const activeSessions = useMemo(
    () =>
      SESSIONS.filter((session) =>
        isSessionOpen(
          utc.hour,
          session.start,
          session.end
        )
      ),
    [utc.hour]
  );

  const status = useMemo(
    () => getSessionStatus(utc.hour),
    [utc.hour]
  );

  const StatusIcon = status.icon;

  const selected = useMemo(
    () =>
      SESSIONS.find(
        (session) =>
          session.name === selectedSession
      ),
    [selectedSession]
  );

  const selectedTime = useMemo(
    () =>
      selected
        ? getTimeParts(selected.timezone)
        : {
            time: "--:--:--",
            date: "--",
          },
    [selected, now]
  );

  const nextSession = useMemo(() => {
    const candidates = SESSIONS.map(
      (session) => {
        let diff =
          session.start - utc.hour;

        if (diff < 0) {
          diff += 24;
        }

        if (
          diff === 0 &&
          utc.minute > 0
        ) {
          diff = 24;
        }

        return {
          ...session,
          diff,
        };
      }
    );

    return candidates.sort(
      (a, b) => a.diff - b.diff
    )[0];
  }, [utc.hour, utc.minute]);

  const handleRefresh = () => {
    setRefreshing(true);

    setTimeout(() => {
      setNow(new Date());
      setSelectedHour(new Date().getUTCHours());
      setRefreshing(false);
    }, 500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">

      {/* BACK BUTTON */}
      <button
        type="button"
        onClick={() => navigate("/tools")}
        className="inline-flex items-center gap-2 mb-5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-violet-300 hover:text-violet-600 transition"
      >
        ← Back to Tools
      </button>

      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
            <Clock3
              size={21}
              className="text-violet-600"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Trading Sessions
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Global market timing, liquidity,
              volatility and session intelligence.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-violet-300 transition"
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* LIVE MARKET STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Clock3
              size={17}
              className="text-violet-600"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              UTC Time
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {String(utc.hour).padStart(2, "0")}:
            {String(utc.minute).padStart(2, "0")}:
            {String(utc.second).padStart(2, "0")}
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Live global market clock
          </p>
        </div>

        <div
          className={`rounded-2xl border border-gray-200 dark:border-gray-800 p-5 ${status.className}`}
        >
          <div className="flex items-center gap-2">
            <StatusIcon size={17} />
            <span className="text-xs font-semibold">
              Market Activity
            </span>
          </div>

          <p className="mt-3 text-lg font-bold">
            {status.label}
          </p>

          <p className="mt-1 text-xs opacity-80">
            {status.description}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Activity
              size={17}
              className="text-green-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Active Sessions
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {activeSessions.length}
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {activeSessions.length
              ? activeSessions
                  .map(
                    (session) =>
                      session.name
                  )
                  .join(" × ")
              : "No major session"}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 p-5">
          <div className="flex items-center gap-2">
            <Target
              size={17}
              className="text-violet-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Next Session
            </span>
          </div>

          <p className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
            {nextSession.name}
          </p>

          <p className="mt-1 text-xs text-violet-600 font-semibold">
            Opens in{" "}
            {getCountdown(
              nextSession.start
            )}
          </p>
        </div>
      </div>

      {/* SESSION SELECTOR */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {SESSIONS.map((session) => {
          const open = isSessionOpen(
            utc.hour,
            session.start,
            session.end
          );

          const time = getTimeParts(
            session.timezone
          );

          const selectedCard =
            selectedSession ===
            session.name;

          return (
            <button
              key={session.name}
              type="button"
              onClick={() =>
                setSelectedSession(
                  session.name
                )
              }
              className={`text-left rounded-2xl border p-5 transition ${
                selectedCard
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-900/10"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] hover:border-violet-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {session.name}
                </span>

                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    open
                      ? "bg-green-500"
                      : "bg-gray-300 dark:bg-gray-700"
                  }`}
                />
              </div>

              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {time.time}
              </p>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {time.date}
              </p>

              <div className="flex items-center justify-between mt-4">
                <span
                  className={`text-[11px] font-bold ${
                    open
                      ? "text-green-600"
                      : "text-gray-400"
                  }`}
                >
                  {open
                    ? "OPEN"
                    : "CLOSED"}
                </span>

                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formatHour(
                    session.start
                  )}{" "}
                  →{" "}
                  {formatHour(session.end)}{" "}
                  UTC
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* SELECTED SESSION LIVE PANEL */}
      {selected && (
        <div className="mt-6 rounded-2xl border border-violet-200 dark:border-violet-900/30 bg-white dark:bg-[#151515] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles
                  size={18}
                  className="text-violet-600"
                />

                <span className="text-xs font-semibold text-violet-600">
                  SELECTED SESSION
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {selected.name}
              </h2>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {selected.city} local time
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Local Time
                </p>

                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                  {selectedTime.time}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Session Window
                </p>

                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                  {formatHour(
                    selected.start
                  )}{" "}
                  -{" "}
                  {formatHour(selected.end)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 24H TIMELINE */}
      <SessionTimeline />

      {/* HEATMAP */}
      <SessionHeatmap />

      {/* SESSION INTELLIGENCE */}
      <SessionIntelligence
        session={selected}
        isOpen={
          selected
            ? isSessionOpen(
                utc.hour,
                selected.start,
                selected.end
              )
            : false
        }
      />

      {/* OVERLAP ANALYZER */}
      <SessionOverlapAnalyzer />

      {/* KILL ZONE ANALYZER */}
      <KillZoneAnalyzer />

      {/* CURRENT MARKET SNAPSHOT */}
      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="flex items-center gap-2 mb-5">
          <Gauge
            size={18}
            className="text-violet-600"
          />

          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Current Market Snapshot
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2">
              <BarChart3
                size={16}
                className="text-blue-600"
              />

              <span className="text-xs text-gray-500 dark:text-gray-400">
                Liquidity Environment
              </span>
            </div>

            <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">
              {activeSessions.length >= 2
                ? "High"
                : activeSessions.length === 1
                ? "Moderate"
                : "Low"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2">
              <Zap
                size={16}
                className="text-orange-600"
              />

              <span className="text-xs text-gray-500 dark:text-gray-400">
                Volatility Environment
              </span>
            </div>

            <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">
              {activeSessions.length >= 2
                ? "High"
                : activeSessions.length === 1
                ? "Moderate"
                : "Low"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp
                size={16}
                className="text-green-600"
              />

              <span className="text-xs text-gray-500 dark:text-gray-400">
                Trading Environment
              </span>
            </div>

            <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">
              {activeSessions.length >= 2
                ? "Prime Window"
                : activeSessions.length === 1
                ? "Active Window"
                : "Wait / Prepare"}
            </p>
          </div>

        </div>
      </div>

      {/* FOOTER NOTE */}
      <div className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={17}
            className="text-amber-600 mt-0.5 shrink-0"
          />

          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
              Session timing note
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-500">
              Session windows shown here are baseline
              UTC estimates. Actual broker hours and
              daylight-saving changes can shift session
              times. We will make the timing engine
              DST-aware in the next upgrade.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}