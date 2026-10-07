import { useMemo, useState } from "react";
import {
    Activity,
    BarChart3,
    CheckCircle2,
    Clock3,
    Gauge,
    Layers3,
    Target,
    TrendingUp,
    Zap,
  } from "lucide-react";

const SESSIONS = {
  Sydney: {
    open: 22,
    close: 7,
    liquidity: 38,
    volatility: 32,
  },
  Tokyo: {
    open: 0,
    close: 9,
    liquidity: 55,
    volatility: 48,
  },
  London: {
    open: 8,
    close: 17,
    liquidity: 94,
    volatility: 82,
  },
  "New York": {
    open: 13,
    close: 22,
    liquidity: 96,
    volatility: 92,
  },
};

const OVERLAP_DATA = {
  "Sydney-Tokyo": {
    pairs: ["AUD/JPY", "AUD/USD", "NZD/JPY"],
    style: "Range & Asian breakout",
    risk: "Low–Moderate",
    use: "Asian range development",
  },
  "Tokyo-London": {
    pairs: ["USD/JPY", "EUR/JPY", "GBP/JPY"],
    style: "Breakout preparation",
    risk: "Moderate",
    use: "Asian range → London expansion",
  },
  "London-New York": {
    pairs: ["EUR/USD", "GBP/USD", "GBP/JPY", "USD/CAD"],
    style: "Momentum & breakout",
    risk: "High",
    use: "Liquidity expansion and directional moves",
  },
};

function getHours(open, close) {
  const hours = [];

  if (close > open) {
    for (let h = open; h < close; h++) {
      hours.push(h);
    }
  } else {
    for (let h = open; h < 24; h++) {
      hours.push(h);
    }

    for (let h = 0; h < close; h++) {
      hours.push(h);
    }
  }

  return hours;
}

function getOverlapHours(first, second) {
  const firstHours = getHours(
    SESSIONS[first].open,
    SESSIONS[first].close
  );

  const secondHours = getHours(
    SESSIONS[second].open,
    SESSIONS[second].close
  );

  return firstHours.filter((hour) =>
    secondHours.includes(hour)
  );
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
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

export default function SessionOverlapAnalyzer() {
  const [firstSession, setFirstSession] = useState("London");
  const [secondSession, setSecondSession] =
    useState("New York");

  const analysis = useMemo(() => {
    const first = SESSIONS[firstSession];
    const second = SESSIONS[secondSession];

    const hours = getOverlapHours(
      firstSession,
      secondSession
    );

    const liquidity = Math.round(
      (first.liquidity + second.liquidity) / 2
    );

    const volatility = Math.round(
      (first.volatility + second.volatility) / 2
    );

    const quality = Math.round(
      liquidity * 0.5 +
        volatility * 0.35 +
        Math.min(hours.length * 5, 15)
    );

    const key = [
      firstSession,
      secondSession,
    ].sort().join("-");

    const data =
      OVERLAP_DATA[key] || {
        pairs: ["Major FX pairs"],
        style: "General session overlap",
        risk: "Moderate",
        use: "Increased market participation",
      };

    return {
      hours,
      liquidity,
      volatility,
      quality: Math.min(quality, 100),
      data,
    };
  }, [firstSession, secondSession]);

  const isSameSession =
    firstSession === secondSession;

  return (
    <section className="mt-6">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
          <Layers3
            size={19}
            className="text-violet-600"
          />
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Session Overlap Analyzer
          </h2>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Analyze liquidity, volatility and trading conditions
            when global sessions overlap.
          </p>
        </div>
      </div>

      {/* SESSION SELECTOR */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              First Session
            </label>

            <select
              value={firstSession}
              onChange={(e) =>
                setFirstSession(e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111] px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
            >
              {Object.keys(SESSIONS).map((session) => (
                <option key={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Second Session
            </label>

            <select
              value={secondSession}
              onChange={(e) =>
                setSecondSession(e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111] px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
            >
              {Object.keys(SESSIONS).map((session) => (
                <option key={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isSameSession ? (
          <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Select two different sessions to calculate
              an overlap.
            </p>
          </div>
        ) : (
          <>
            {/* OVERLAP STATUS */}
            <div className="mt-5 rounded-2xl border border-violet-100 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-violet-600 dark:text-violet-300 font-semibold">
                    SELECTED OVERLAP
                  </p>

                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {firstSession} × {secondSession}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Duration
                  </p>

                  <p className="text-xl font-bold text-violet-600">
                    {analysis.hours.length}h
                  </p>
                </div>
              </div>
            </div>

            {/* METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
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
                  {analysis.liquidity}
                </p>

                <div className="mt-3">
                  <MetricBar
                    label="Overlap liquidity"
                    value={analysis.liquidity}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
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
                  {analysis.volatility}
                </p>

                <div className="mt-3">
                  <MetricBar
                    label="Overlap volatility"
                    value={analysis.volatility}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <div className="flex items-center gap-2">
                  <Gauge
                    size={17}
                    className="text-violet-600"
                  />

                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Trading Quality
                  </span>
                </div>

                <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                  {analysis.quality}
                </p>

                <div className="mt-3">
                  <MetricBar
                    label="Overlap quality"
                    value={analysis.quality}
                  />
                </div>
              </div>
            </div>

            {/* HOURS */}
            <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock3
                  size={18}
                  className="text-violet-600"
                />

                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Overlap Hours — UTC
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {analysis.hours.map((hour) => (
                  <div
                    key={hour}
                    className="rounded-xl border border-violet-200 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 px-3 py-2"
                  >
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                      {formatHour(hour)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* BEST PAIRS + STYLE */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target
                    size={18}
                    className="text-green-600"
                  />

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Best Instruments
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {analysis.data.pairs.map((pair) => (
                    <div
                      key={pair}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3"
                    >
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {pair}
                      </p>

                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        Overlap candidate
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp
                    size={18}
                    className="text-violet-600"
                  />

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Trading Profile
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Preferred Style
                    </span>

                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {analysis.data.style}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Risk Environment
                    </span>

                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {analysis.data.risk}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Best Use
                    </span>

                    <span className="text-xs font-bold text-gray-900 dark:text-white text-right max-w-[60%]">
                      {analysis.data.use}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MARKET INTERPRETATION */}
            <div className="mt-5 rounded-2xl border border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity
                  size={18}
                  className="text-green-600"
                />

                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Overlap Interpretation
                </h3>
              </div>

              <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                This overlap combines the participation of{" "}
                <strong>
                  {firstSession}
                </strong>{" "}
                and{" "}
                <strong>
                  {secondSession}
                </strong>
                . Higher participation can create stronger
                liquidity and more meaningful price expansion,
                but it can also increase execution risk.
              </p>
            </div>

            {/* QUICK CHECKLIST */}
            <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2
                  size={18}
                  className="text-green-600"
                />

                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Overlap Trading Checklist
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Check high-impact economic news",
                  "Mark previous session high and low",
                  "Identify liquidity pools",
                  "Wait for market-structure confirmation",
                  "Avoid chasing the first impulse",
                  "Respect spread and slippage conditions",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3"
                  >
                    <CheckCircle2
                      size={15}
                      className="text-green-600 shrink-0"
                    />

                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}