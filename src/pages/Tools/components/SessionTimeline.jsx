import { useMemo, useState } from "react";
import {
  Clock3,
  Globe2,
  Zap,
  Activity,
  ArrowRight,
} from "lucide-react";

const SESSIONS = [
  {
    name: "Sydney",
    open: 22,
    close: 7,
    color: "bg-orange-400",
    light: "bg-orange-50 dark:bg-orange-900/10",
    text: "text-orange-600",
  },
  {
    name: "Tokyo",
    open: 0,
    close: 9,
    color: "bg-blue-400",
    light: "bg-blue-50 dark:bg-blue-900/10",
    text: "text-blue-600",
  },
  {
    name: "London",
    open: 8,
    close: 17,
    color: "bg-purple-500",
    light: "bg-purple-50 dark:bg-purple-900/10",
    text: "text-purple-600",
  },
  {
    name: "New York",
    open: 13,
    close: 22,
    color: "bg-green-500",
    light: "bg-green-50 dark:bg-green-900/10",
    text: "text-green-600",
  },
];

function isOpen(hour, open, close) {
  if (open < close) {
    return hour >= open && hour < close;
  }

  return hour >= open || hour < close;
}

function formatHour(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 || 12;

  return `${display}:00 ${suffix}`;
}

function formatIndiaTime(hour) {
  const indiaHour = (hour + 5.5) % 24;

  return formatHour(indiaHour);
}

export default function SessionTimeline() {
  const [selectedHour, setSelectedHour] = useState(13);

  const activeSessions = useMemo(() => {
    return SESSIONS.filter((session) =>
      isOpen(
        selectedHour,
        session.open,
        session.close
      )
    );
  }, [selectedHour]);

  const marketState = useMemo(() => {
    if (activeSessions.length >= 3) {
      return {
        label: "EXTREME OVERLAP",
        description:
          "Multiple major sessions are active simultaneously.",
        level: "Very High",
      };
    }

    if (activeSessions.length === 2) {
      return {
        label: "SESSION OVERLAP",
        description:
          "Two major financial centers are active.",
        level: "High",
      };
    }

    if (activeSessions.length === 1) {
      return {
        label: "ACTIVE SESSION",
        description:
          "One major trading session is currently active.",
        level: "Medium",
      };
    }

    return {
      label: "LOW ACTIVITY",
      description:
        "No major session overlap is active.",
      level: "Low",
    };
  }, [activeSessions]);

  return (
    <section
      className="
        mt-6
        bg-white
        dark:bg-[#151515]
        border
        border-gray-200
        dark:border-gray-800
        rounded-2xl
        p-5
      "
    >
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="
              w-10 h-10
              rounded-xl
              bg-violet-100
              dark:bg-violet-900/20
              flex items-center justify-center
            "
          >
            <Clock3
              size={19}
              className="text-violet-600"
            />
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Interactive Market Hours
            </h2>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Drag the timeline to explore every hour of the trading day.
            </p>
          </div>
        </div>

        <div
          className="
            px-3 py-2
            rounded-xl
            bg-gray-50
            dark:bg-gray-900
            text-sm
            font-bold
            text-gray-900
            dark:text-white
          "
        >
          {formatHour(selectedHour)} UTC
        </div>
      </div>

      {/* TIME SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2">
            <Globe2
              size={16}
              className="text-violet-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              UTC
            </span>
          </div>

          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {formatHour(selectedHour)}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2">
            <Clock3
              size={16}
              className="text-blue-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              India
            </span>
          </div>

          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {formatIndiaTime(selectedHour)}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2">
            <Activity
              size={16}
              className="text-green-600"
            />

            <span className="text-xs text-gray-500 dark:text-gray-400">
              Market Activity
            </span>
          </div>

          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {marketState.level}
          </p>
        </div>
      </div>

      {/* TIMELINE */}
      <div className="mt-7 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* HOUR SCALE */}
          <div className="relative ml-28 h-7">
            {Array.from(
              { length: 25 },
              (_, hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() =>
                    setSelectedHour(hour % 24)
                  }
                  className="
                    absolute
                    -translate-x-1/2
                    text-[10px]
                    text-gray-400
                    hover:text-purple-600
                  "
                  style={{
                    left: `${(hour / 24) * 100}%`,
                  }}
                >
                  {String(hour % 24).padStart(2, "0")}
                </button>
              )
            )}
          </div>

          {/* SESSION ROWS */}
          <div className="space-y-3">
            {SESSIONS.map((session) => (
              <div
                key={session.name}
                className="flex items-center gap-3"
              >
                <div className="w-25 shrink-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {session.name}
                  </p>

                  <p className="text-[10px] text-gray-400">
                    {formatHour(session.open)}–
                    {formatHour(session.close)}
                  </p>
                </div>

                <div className="relative h-10 flex-1 rounded-lg bg-gray-100 dark:bg-gray-900 overflow-hidden">
                  {/* SESSION SEGMENTS */}
                  {session.open < session.close ? (
                    <div
                      className={`
                        absolute
                        top-1
                        bottom-1
                        rounded-md
                        ${session.color}
                      `}
                      style={{
                        left: `${
                          (session.open / 24) *
                          100
                        }%`,
                        width: `${
                          ((session.close -
                            session.open) /
                            24) *
                          100
                        }%`,
                      }}
                    />
                  ) : (
                    <>
                      <div
                        className={`
                          absolute
                          top-1
                          bottom-1
                          rounded-md
                          ${session.color}
                        `}
                        style={{
                          left: `${
                            (session.open / 24) *
                            100
                          }%`,
                          width: `${
                            ((24 -
                              session.open) /
                              24) *
                            100
                          }%`,
                        }}
                      />

                      <div
                        className={`
                          absolute
                          top-1
                          bottom-1
                          rounded-md
                          ${session.color}
                        `}
                        style={{
                          left: "0%",
                          width: `${
                            (session.close / 24) *
                            100
                          }%`,
                        }}
                      />
                    </>
                  )}

                  {/* SELECTED HOUR */}
                  <div
                    className="
                      absolute
                      top-0
                      bottom-0
                      w-0.5
                      bg-gray-900
                      dark:bg-white
                      z-20
                    "
                    style={{
                      left: `${
                        (selectedHour / 24) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* SLIDER */}
          <div className="ml-28 mt-6">
            <input
              type="range"
              min="0"
              max="23"
              step="1"
              value={selectedHour}
              onChange={(event) =>
                setSelectedHour(
                  Number(event.target.value)
                )
              }
              className="
                w-full
                accent-violet-600
                cursor-pointer
              "
              aria-label="Select UTC trading hour"
            />

            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE SESSION RESULT */}
      <div
        className={`
          mt-6
          rounded-2xl
          p-5
          ${marketState.level === "High"
            ? "bg-purple-50 dark:bg-purple-900/10"
            : "bg-gray-50 dark:bg-gray-900"
          }
        `}
      >
        <div className="flex items-start gap-3">
          <Zap
            size={19}
            className="text-violet-600 mt-0.5"
          />

          <div className="flex-1">
            <p className="text-xs font-semibold text-violet-600">
              {marketState.label}
            </p>

            <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
              {activeSessions.length > 0
                ? activeSessions
                    .map(
                      (session) =>
                        session.name
                    )
                    .join(" + ")
                : "No major session"}
            </p>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {marketState.description}
            </p>
          </div>
        </div>

        {/* ACTIVE SESSION CHIPS */}
        <div className="flex flex-wrap gap-2 mt-4">
          {activeSessions.length > 0 ? (
            activeSessions.map((session) => (
              <div
                key={session.name}
                className={`
                  flex items-center gap-2
                  px-3 py-2
                  rounded-xl
                  ${session.light}
                  ${session.text}
                `}
              >
                <span
                  className={`w-2 h-2 rounded-full ${session.color}`}
                />

                <span className="text-xs font-semibold">
                  {session.name}
                </span>
              </div>
            ))
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Move the slider to explore another market hour.
            </span>
          )}
        </div>
      </div>

      {/* QUICK TIME BUTTONS */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
          QUICK JUMP
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            {
              label: "Sydney Open",
              hour: 22,
            },
            {
              label: "Tokyo Open",
              hour: 0,
            },
            {
              label: "London Open",
              hour: 8,
            },
            {
              label: "New York Open",
              hour: 13,
            },
            {
              label: "London / NY",
              hour: 13,
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                setSelectedHour(item.hour)
              }
              className="
                flex items-center gap-2
                px-3 py-2
                rounded-xl
                border
                border-gray-200
                dark:border-gray-800
                text-xs
                font-semibold
                text-gray-700
                dark:text-gray-300
                hover:border-purple-300
                hover:text-purple-600
                transition
              "
            >
              {item.label}
              <ArrowRight size={13} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}