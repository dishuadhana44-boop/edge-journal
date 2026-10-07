import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock3,
  Flame,
  Gauge,
  Layers3,
  TrendingUp,
  Zap,
} from "lucide-react";

const SESSIONS = [
  {
    name: "Sydney",
    start: 22,
    end: 7,
    liquidity: 38,
    volatility: 32,
  },
  {
    name: "Tokyo",
    start: 0,
    end: 9,
    liquidity: 55,
    volatility: 48,
  },
  {
    name: "London",
    start: 8,
    end: 17,
    liquidity: 94,
    volatility: 82,
  },
  {
    name: "New York",
    start: 13,
    end: 22,
    liquidity: 96,
    volatility: 92,
  },
];

function isActive(hour, start, end) {
  if (start < end) {
    return hour >= start && hour < end;
  }

  return hour >= start || hour < end;
}

function getHourData(hour) {
  const active = SESSIONS.filter((session) =>
    isActive(hour, session.start, session.end)
  );

  if (!active.length) {
    return {
      sessions: [],
      liquidity: 10,
      volatility: 8,
      momentum: 8,
      score: 8,
    };
  }

  const liquidity = Math.round(
    active.reduce(
      (sum, session) => sum + session.liquidity,
      0
    ) / active.length
  );

  const volatility = Math.round(
    active.reduce(
      (sum, session) => sum + session.volatility,
      0
    ) / active.length
  );

  const overlapBonus =
    active.length >= 2 ? 15 : 0;

  const momentum = Math.min(
    100,
    Math.round(
      volatility * 0.55 +
        liquidity * 0.3 +
        overlapBonus
    )
  );

  const score = Math.min(
    100,
    Math.round(
      liquidity * 0.4 +
        volatility * 0.35 +
        momentum * 0.25
    )
  );

  return {
    sessions: active.map(
      (session) => session.name
    ),
    liquidity,
    volatility,
    momentum,
    score,
  };
}

function getIntensity(value) {
  if (value >= 90) return "bg-violet-600";
  if (value >= 75) return "bg-violet-500";
  if (value >= 60) return "bg-violet-400";
  if (value >= 45) return "bg-violet-300";
  if (value >= 25) return "bg-violet-200";
  return "bg-gray-100 dark:bg-gray-800";
}

function getQualityLabel(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Low";
  return "Very Low";
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function SessionHeatmap() {
  const [selectedHour, setSelectedHour] =
    useState(new Date().getUTCHours());

  const hours = Array.from(
    { length: 24 },
    (_, index) => index
  );

  const selected = useMemo(
    () => getHourData(selectedHour),
    [selectedHour]
  );

  const bestHours = useMemo(() => {
    return hours
      .map((hour) => ({
        hour,
        ...getHourData(hour),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, []);

  return (
    <section className="mt-6">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
          <Flame
            size={19}
            className="text-orange-600"
          />
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Session Heatmap
          </h2>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            24-hour liquidity, volatility and market-activity map.
          </p>
        </div>
      </div>

      {/* SELECTED HOUR */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock3
                size={17}
                className="text-violet-600"
              />

              <span className="text-xs text-gray-500 dark:text-gray-400">
                Selected UTC Hour
              </span>
            </div>

            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatHour(selectedHour)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selected.sessions.length ? (
              selected.sessions.map((session) => (
                <span
                  key={session}
                  className="rounded-full bg-green-50 dark:bg-green-900/10 px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-400"
                >
                  {session}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-500">
                No major session
              </span>
            )}
          </div>
        </div>

        {/* SLIDER */}
        <div className="mt-6">
          <input
            type="range"
            min="0"
            max="23"
            value={selectedHour}
            onChange={(event) =>
              setSelectedHour(
                Number(event.target.value)
              )
            }
            className="w-full accent-violet-600 cursor-pointer"
          />

          <div className="flex justify-between mt-2">
            {hours.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() =>
                  setSelectedHour(hour)
                }
                className={`text-[9px] ${
                  hour === selectedHour
                    ? "font-bold text-violet-600"
                    : "text-gray-400"
                }`}
              >
                {hour}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SELECTED METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <BarChart3
              size={17}
              className="text-blue-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Liquidity
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {selected.liquidity}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Zap
              size={17}
              className="text-orange-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Volatility
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {selected.volatility}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <TrendingUp
              size={17}
              className="text-green-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Momentum
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {selected.momentum}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 p-5">
          <div className="flex items-center gap-2">
            <Gauge
              size={17}
              className="text-violet-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Trading Quality
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-violet-600">
            {selected.score}
          </p>

          <p className="mt-1 text-xs font-semibold text-violet-600">
            {getQualityLabel(selected.score)}
          </p>
        </div>
      </div>

      {/* HEATMAP */}
      <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5 overflow-x-auto">
        <div className="flex items-center gap-2 mb-5">
          <Activity
            size={18}
            className="text-violet-600"
          />

          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            24-Hour Market Activity
          </h3>
        </div>

        <div className="min-w-[850px]">
          {/* HOURS */}
          <div className="grid grid-cols-[160px_repeat(24,minmax(25px,1fr))] gap-1">
            <div />

            {hours.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() =>
                  setSelectedHour(hour)
                }
                className={`text-[9px] font-semibold pb-2 ${
                  hour === selectedHour
                    ? "text-violet-600"
                    : "text-gray-400"
                }`}
              >
                {hour}
              </button>
            ))}

            {/* LIQUIDITY */}
            <div className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
              Liquidity
            </div>

            {hours.map((hour) => {
              const data = getHourData(hour);

              return (
                <button
                  key={`liquidity-${hour}`}
                  type="button"
                  onClick={() =>
                    setSelectedHour(hour)
                  }
                  title={`${formatHour(hour)} — Liquidity ${data.liquidity}`}
                  className={`h-7 rounded-md ${getIntensity(
                    data.liquidity
                  )} ${
                    hour === selectedHour
                      ? "ring-2 ring-violet-600 ring-offset-1 dark:ring-offset-[#151515]"
                      : ""
                  }`}
                />
              );
            })}

            {/* VOLATILITY */}
            <div className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
              Volatility
            </div>

            {hours.map((hour) => {
              const data = getHourData(hour);

              return (
                <button
                  key={`volatility-${hour}`}
                  type="button"
                  onClick={() =>
                    setSelectedHour(hour)
                  }
                  title={`${formatHour(hour)} — Volatility ${data.volatility}`}
                  className={`h-7 rounded-md ${getIntensity(
                    data.volatility
                  )} ${
                    hour === selectedHour
                      ? "ring-2 ring-violet-600 ring-offset-1 dark:ring-offset-[#151515]"
                      : ""
                  }`}
                />
              );
            })}

            {/* MOMENTUM */}
            <div className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
              Momentum
            </div>

            {hours.map((hour) => {
              const data = getHourData(hour);

              return (
                <button
                  key={`momentum-${hour}`}
                  type="button"
                  onClick={() =>
                    setSelectedHour(hour)
                  }
                  title={`${formatHour(hour)} — Momentum ${data.momentum}`}
                  className={`h-7 rounded-md ${getIntensity(
                    data.momentum
                  )} ${
                    hour === selectedHour
                      ? "ring-2 ring-violet-600 ring-offset-1 dark:ring-offset-[#151515]"
                      : ""
                  }`}
                />
              );
            })}

            {/* QUALITY */}
            <div className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
              Trading Quality
            </div>

            {hours.map((hour) => {
              const data = getHourData(hour);

              return (
                <button
                  key={`quality-${hour}`}
                  type="button"
                  onClick={() =>
                    setSelectedHour(hour)
                  }
                  title={`${formatHour(hour)} — Quality ${data.score}`}
                  className={`h-7 rounded-md ${getIntensity(
                    data.score
                  )} ${
                    hour === selectedHour
                      ? "ring-2 ring-violet-600 ring-offset-1 dark:ring-offset-[#151515]"
                      : ""
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* LEGEND */}
        <div className="flex items-center gap-2 mt-5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Low
          </span>

          {[10, 30, 50, 70, 90].map(
            (value) => (
              <div
                key={value}
                className={`w-6 h-3 rounded-sm ${getIntensity(
                  value
                )}`}
              />
            )
          )}

          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            High
          </span>
        </div>
      </div>

      {/* BEST HOURS */}
      <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame
            size={18}
            className="text-orange-600"
          />

          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Highest Quality Trading Hours
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {bestHours.map((item, index) => (
            <button
              key={item.hour}
              type="button"
              onClick={() =>
                setSelectedHour(item.hour)
              }
              className="text-left rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-violet-300 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-violet-600">
                  #{index + 1}
                </span>

                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {item.score}/100
                </span>
              </div>

              <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
                {formatHour(item.hour)} UTC
              </p>

              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {getQualityLabel(item.score)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* SESSION MATRIX */}
      <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers3
            size={18}
            className="text-blue-600"
          />

          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Session Activity at {formatHour(selectedHour)} UTC
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {SESSIONS.map((session) => {
            const active = isActive(
              selectedHour,
              session.start,
              session.end
            );

            return (
              <div
                key={session.name}
                className={`rounded-xl border p-4 ${
                  active
                    ? "border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {session.name}
                  </span>

                  <span
                    className={`text-[10px] font-bold ${
                      active
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  >
                    {active ? "ACTIVE" : "CLOSED"}
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  Liquidity: {session.liquidity}
                </p>

                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Volatility: {session.volatility}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}