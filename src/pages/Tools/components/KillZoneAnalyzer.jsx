import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Crosshair,
  Gauge,
  ShieldAlert,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

const KILL_ZONES = [
  {
    id: "asian",
    name: "Asian Range",
    session: "Tokyo",
    start: 0,
    end: 4,
    score: 58,
    volatility: 45,
    liquidity: 52,
    pairs: ["USD/JPY", "AUD/JPY", "NZD/USD"],
    setups: ["Range", "Liquidity buildup", "Breakout preparation"],
    behavior:
      "The Asian session often develops the initial daily range and establishes liquidity levels that can become important later.",
    risks: [
      "Range compression",
      "Low momentum",
      "False breakouts",
    ],
  },
  {
    id: "london",
    name: "London Open Kill Zone",
    session: "London",
    start: 7,
    end: 10,
    score: 88,
    volatility: 84,
    liquidity: 94,
    pairs: ["EUR/USD", "GBP/USD", "GBP/JPY"],
    setups: [
      "Liquidity sweep",
      "Breakout",
      "BOS / CHOCH",
    ],
    behavior:
      "London open frequently attacks Asian-session liquidity before expanding into a larger directional move.",
    risks: [
      "Opening volatility",
      "Liquidity sweeps",
      "Fast reversals",
    ],
  },
  {
    id: "newyork",
    name: "New York Open Kill Zone",
    session: "New York",
    start: 13,
    end: 16,
    score: 92,
    volatility: 94,
    liquidity: 97,
    pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD"],
    setups: [
      "Momentum",
      "Continuation",
      "Liquidity expansion",
    ],
    behavior:
      "New York open can create rapid expansion, especially when US economic data enters the market.",
    risks: [
      "News spikes",
      "Slippage",
      "Sharp reversals",
    ],
  },
  {
    id: "overlap",
    name: "London × New York Overlap",
    session: "London + New York",
    start: 13,
    end: 17,
    score: 96,
    volatility: 96,
    liquidity: 99,
    pairs: ["EUR/USD", "GBP/USD", "GBP/JPY", "USD/CAD"],
    setups: [
      "Momentum",
      "Breakout continuation",
      "Institutional expansion",
    ],
    behavior:
      "The London-New York overlap is typically the highest-participation period of the forex trading day.",
    risks: [
      "Extreme volatility",
      "Economic releases",
      "Slippage",
    ],
  },
];

function formatTime(hour, minute = 0) {
  const h = hour % 24;

  return `${String(h).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function getCurrentHourUTC() {
  return new Date().getUTCHours();
}

function getCurrentMinuteUTC() {
  return new Date().getUTCMinutes();
}

function isZoneActive(zone, hour) {
  if (zone.start < zone.end) {
    return hour >= zone.start && hour < zone.end;
  }

  return hour >= zone.start || hour < zone.end;
}

function MetricBar({ label, value }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {label}
        </span>

        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
          {value}/100
        </span>
      </div>

      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function getCountdown(zone) {
  const now = new Date();

  const currentMinutes =
    now.getUTCHours() * 60 +
    now.getUTCMinutes();

  const startMinutes = zone.start * 60;
  const endMinutes = zone.end * 60;

  let targetMinutes;

  const active = isZoneActive(
    zone,
    now.getUTCHours()
  );

  if (active) {
    targetMinutes = endMinutes;
  } else {
    targetMinutes = startMinutes;

    if (targetMinutes <= currentMinutes) {
      targetMinutes += 24 * 60;
    }
  }

  let diff = targetMinutes - currentMinutes;

  if (diff < 0) {
    diff += 24 * 60;
  }

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  return {
    active,
    hours,
    minutes,
  };
}

export default function KillZoneAnalyzer() {
  const [selectedId, setSelectedId] =
    useState("london");

  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const selectedZone = useMemo(
    () =>
      KILL_ZONES.find(
        (zone) => zone.id === selectedId
      ) || KILL_ZONES[0],
    [selectedId]
  );

  const currentHour = getCurrentHourUTC();
  const currentMinute = getCurrentMinuteUTC();

  const countdown = getCountdown(selectedZone);

  return (
    <section className="mt-6">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
          <Crosshair
            size={19}
            className="text-orange-600"
          />
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Kill Zone Analyzer
          </h2>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Identify high-interest trading windows and
            session-specific market conditions.
          </p>
        </div>
      </div>

      {/* ZONE SELECTOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {KILL_ZONES.map((zone) => {
          const active = isZoneActive(
            zone,
            currentHour
          );

          const selected =
            zone.id === selectedId;

          return (
            <button
              key={zone.id}
              type="button"
              onClick={() =>
                setSelectedId(zone.id)
              }
              className={`text-left rounded-2xl border p-4 transition ${
                selected
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-900/10"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] hover:border-violet-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {zone.name}
                </span>

                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    active
                      ? "bg-green-500"
                      : "bg-gray-300 dark:bg-gray-700"
                  }`}
                />
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {formatTime(zone.start)} –{" "}
                {formatTime(zone.end)} UTC
              </p>

              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs font-bold text-violet-600">
                  Score {zone.score}
                </span>

                {active && (
                  <span className="text-[10px] font-bold text-green-600">
                    ACTIVE
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* SELECTED ZONE */}
      <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <Zap
                size={18}
                className="text-orange-600"
              />

              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                SELECTED KILL ZONE
              </span>
            </div>

            <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
              {selectedZone.name}
            </h3>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatTime(selectedZone.start)} –{" "}
              {formatTime(selectedZone.end)} UTC
            </p>
          </div>

          <div
            className={`rounded-2xl px-5 py-4 ${
              countdown.active
                ? "bg-green-50 dark:bg-green-900/10"
                : "bg-gray-50 dark:bg-gray-900/30"
            }`}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {countdown.active
                ? "ZONE CLOSES IN"
                : "ZONE STARTS IN"}
            </p>

            <p
              className={`mt-1 text-2xl font-bold ${
                countdown.active
                  ? "text-green-600"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {countdown.hours}h{" "}
              {countdown.minutes}m
            </p>
          </div>
        </div>
      </div>

      {/* LIVE UTC CLOCK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Clock3
              size={17}
              className="text-violet-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Current UTC
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatTime(
              currentHour,
              currentMinute
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Gauge
              size={17}
              className="text-violet-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Kill Zone Score
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-violet-600">
            {selectedZone.score}/100
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Activity
              size={17}
              className="text-green-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Zone Status
            </span>
          </div>

          <p
            className={`mt-3 text-2xl font-bold ${
              countdown.active
                ? "text-green-600"
                : "text-gray-500"
            }`}
          >
            {countdown.active
              ? "ACTIVE"
              : "INACTIVE"}
          </p>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3
              size={18}
              className="text-blue-600"
            />

            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Kill Zone Metrics
            </h3>
          </div>

          <div className="space-y-5">
            <MetricBar
              label="Liquidity"
              value={selectedZone.liquidity}
            />

            <MetricBar
              label="Volatility"
              value={selectedZone.volatility}
            />

            <MetricBar
              label="Overall Quality"
              value={selectedZone.score}
            />
          </div>
        </div>

        {/* SETUPS */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2 mb-5">
            <Target
              size={18}
              className="text-violet-600"
            />

            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Preferred Setups
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {selectedZone.setups.map(
              (setup) => (
                <div
                  key={setup}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3"
                >
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {setup}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* PAIRS */}
      <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp
            size={18}
            className="text-green-600"
          />

          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            High-Relevance Instruments
          </h3>
        </div>

        <div className="flex flex-wrap gap-3">
          {selectedZone.pairs.map((pair) => (
            <div
              key={pair}
              className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3"
            >
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {pair}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BEHAVIOR */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity
              size={18}
              className="text-blue-600"
            />

            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Market Behavior
            </h3>
          </div>

          <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
            {selectedZone.behavior}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-violet-50 dark:bg-violet-900/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair
              size={18}
              className="text-violet-600"
            />

            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Session Execution
            </h3>
          </div>

          <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
            Focus on liquidity, structure and confirmation
            rather than entering simply because the kill zone
            is active.
          </p>
        </div>
      </div>

      {/* RISK */}
      <div className="mt-5 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert
            size={18}
            className="text-red-600"
          />

          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Kill Zone Risk Factors
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {selectedZone.risks.map((risk) => (
            <div
              key={risk}
              className="rounded-xl bg-white dark:bg-[#151515] border border-red-100 dark:border-red-900/30 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={14}
                  className="text-red-600 shrink-0"
                />

                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {risk}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}