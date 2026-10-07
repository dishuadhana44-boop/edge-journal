import {
    Activity,
    AlertTriangle,
    BarChart3,
    Brain,
    CheckCircle2,
    Clock3,
    Gauge,
    Layers3,
    ShieldAlert,
    Target,
    TrendingUp,
    Zap,
  } from "lucide-react";
  
  const SESSION_INTELLIGENCE = {
    Sydney: {
      regime: "Low Liquidity",
      score: 42,
      volatility: 32,
      liquidity: 38,
      momentum: 35,
      participation: 34,
      breakoutPotential: 31,
      trendPotential: 28,
  
      bestFor: ["AUD/USD", "NZD/USD", "AUD/JPY"],
  
      overlaps: ["Tokyo"],
  
      killZone: "Sydney Open",
      bestWindow: "22:00 – 02:00 UTC",
      avoidWindow: "05:00 – 07:00 UTC",
  
      behavior:
        "Usually slower price development with lower participation compared with London and New York. Range formation and early Asian positioning are common.",
  
      strategy:
        "Range trading, support/resistance reactions and Asian-session range setups can work better when volatility remains compressed.",
  
      playbook: [
        "Mark previous day high and low",
        "Track Asian range formation",
        "Watch AUD and NZD pairs",
        "Avoid chasing low-volume breakouts",
      ],
  
      risks: [
        "Lower liquidity",
        "Wider spreads on some pairs",
        "False breakouts",
        "Reduced momentum",
      ],
  
      characteristics: [
        "Range formation",
        "Lower volatility",
        "AUD/NZD focus",
        "Early Asian positioning",
      ],
    },
  
    Tokyo: {
      regime: "Asian Range",
      score: 58,
      volatility: 48,
      liquidity: 55,
      momentum: 50,
      participation: 58,
      breakoutPotential: 46,
      trendPotential: 42,
  
      bestFor: ["USD/JPY", "EUR/JPY", "AUD/JPY"],
  
      overlaps: ["Sydney"],
  
      killZone: "Tokyo Open",
      bestWindow: "00:00 – 04:00 UTC",
      avoidWindow: "07:00 – 09:00 UTC",
  
      behavior:
        "JPY-related instruments generally receive stronger participation during the Tokyo session. The session frequently establishes an Asian range that later becomes important for London volatility.",
  
      strategy:
        "Monitor the Asian range, previous-day levels and JPY strength. Prepare for potential expansion when London liquidity enters the market.",
  
      playbook: [
        "Mark Asian high and low",
        "Monitor USD/JPY strength",
        "Track range expansion attempts",
        "Use Asian range for London breakout planning",
      ],
  
      risks: [
        "Asian range compression",
        "Breakout traps",
        "Lower European participation",
        "Slow directional movement",
      ],
  
      characteristics: [
        "Asian range",
        "JPY liquidity",
        "Range expansion",
        "Lower European participation",
      ],
    },
  
    London: {
      regime: "High Liquidity",
      score: 88,
      volatility: 82,
      liquidity: 94,
      momentum: 86,
      participation: 96,
      breakoutPotential: 91,
      trendPotential: 88,
  
      bestFor: [
        "EUR/USD",
        "GBP/USD",
        "EUR/GBP",
        "GBP/JPY",
      ],
  
      overlaps: ["Tokyo", "New York"],
  
      killZone: "London Open Kill Zone",
      bestWindow: "08:00 – 11:00 UTC",
      avoidWindow: "16:00 – 17:00 UTC",
  
      behavior:
        "Large European participation typically creates strong liquidity and increased directional movement. London often expands or sweeps the Asian range.",
  
      strategy:
        "Excellent environment for breakout, continuation, liquidity-sweep and market-structure setups.",
  
      playbook: [
        "Mark Asian high and low",
        "Watch London liquidity sweep",
        "Wait for BOS/CHOCH confirmation",
        "Target expansion toward major liquidity",
      ],
  
      risks: [
        "Opening volatility",
        "Liquidity sweeps",
        "Fast reversals",
        "False London breakouts",
      ],
  
      characteristics: [
        "High liquidity",
        "Strong momentum",
        "Asian range sweeps",
        "European institutional participation",
      ],
    },
  
    "New York": {
      regime: "High Volatility",
      score: 91,
      volatility: 92,
      liquidity: 96,
      momentum: 90,
      participation: 98,
      breakoutPotential: 94,
      trendPotential: 92,
  
      bestFor: [
        "EUR/USD",
        "GBP/USD",
        "USD/JPY",
        "USD/CAD",
      ],
  
      overlaps: ["London"],
  
      killZone: "New York Open Kill Zone",
      bestWindow: "13:00 – 16:00 UTC",
      avoidWindow: "20:00 – 22:00 UTC",
  
      behavior:
        "US participation can produce significant volatility, particularly around major economic releases. The London-New York overlap is usually one of the most liquid periods of the forex day.",
  
      strategy:
        "Strong environment for momentum, continuation, breakout and liquidity-based setups, with strict awareness of economic news.",
  
      playbook: [
        "Check high-impact US news",
        "Mark London high and low",
        "Watch NY liquidity sweep",
        "Look for continuation after confirmation",
      ],
  
      risks: [
        "News spikes",
        "Fast reversals",
        "Slippage",
        "High-impact economic releases",
      ],
  
      characteristics: [
        "Extreme liquidity",
        "High volatility",
        "London/NY overlap",
        "US news sensitivity",
      ],
    },
  };
  
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
  
  function ScoreBadge({ value }) {
    let label = "Weak";
  
    if (value >= 80) {
      label = "Excellent";
    } else if (value >= 65) {
      label = "Strong";
    } else if (value >= 50) {
      label = "Moderate";
    }
  
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5">
        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          {label}
        </span>
  
        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
          {value}/100
        </span>
      </div>
    );
  }
  
  export default function SessionIntelligence({
    session,
    isOpen = false,
  }) {
    if (!session) return null;
  
    const data = SESSION_INTELLIGENCE[session.name];
  
    if (!data) return null;
  
    return (
      <section className="mt-6">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
              <Brain
                size={19}
                className="text-violet-600"
              />
            </div>
  
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Session Intelligence
              </h2>
  
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Advanced market behavior, liquidity and trading conditions.
              </p>
            </div>
          </div>
  
          <ScoreBadge value={data.score} />
        </div>
  
        {/* TOP STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* REGIME */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2">
              <Gauge
                size={17}
                className="text-violet-600"
              />
  
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Market Regime
              </span>
            </div>
  
            <p className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
              {data.regime}
            </p>
  
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Overall quality {data.score}/100
            </p>
          </div>
  
          {/* CURRENT STATE */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2">
              <Activity
                size={17}
                className="text-green-600"
              />
  
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Current State
              </span>
            </div>
  
            <p
              className={`mt-3 text-lg font-bold ${
                isOpen
                  ? "text-green-600"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {isOpen ? "ACTIVE" : "CLOSED"}
            </p>
  
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Based on current session hours
            </p>
          </div>
  
          {/* LIQUIDITY */}
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
  
            <p className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
              {data.liquidity}/100
            </p>
  
            <MetricBar
              label="Liquidity Score"
              value={data.liquidity}
            />
          </div>
  
          {/* VOLATILITY */}
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
  
            <p className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
              {data.volatility}/100
            </p>
  
            <MetricBar
              label="Volatility Score"
              value={data.volatility}
            />
          </div>
        </div>
  
        {/* ADVANCED METRICS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp
                size={18}
                className="text-violet-600"
              />
  
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Advanced Session Metrics
              </h3>
            </div>
  
            <div className="space-y-5">
              <MetricBar
                label="Liquidity"
                value={data.liquidity}
              />
  
              <MetricBar
                label="Volatility"
                value={data.volatility}
              />
  
              <MetricBar
                label="Momentum Potential"
                value={data.momentum}
              />
  
              <MetricBar
                label="Market Participation"
                value={data.participation}
              />
  
              <MetricBar
                label="Breakout Potential"
                value={data.breakoutPotential}
              />
  
              <MetricBar
                label="Trend Potential"
                value={data.trendPotential}
              />
            </div>
          </div>
  
          {/* INSTRUMENTS */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2 mb-5">
              <Target
                size={18}
                className="text-green-600"
              />
  
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Preferred Instruments
              </h3>
            </div>
  
            <div className="grid grid-cols-2 gap-3">
              {data.bestFor.map((pair) => (
                <div
                  key={pair}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 hover:border-violet-300 dark:hover:border-violet-700 transition"
                >
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {pair}
                  </p>
  
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    High session relevance
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
  
        {/* TIMING INTELLIGENCE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2">
              <Clock3
                size={17}
                className="text-violet-600"
              />
  
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Best Trading Window
              </span>
            </div>
  
            <p className="mt-3 text-base font-bold text-gray-900 dark:text-white">
              {data.bestWindow}
            </p>
          </div>
  
          <div className="rounded-2xl border border-violet-100 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 p-5">
            <div className="flex items-center gap-2">
              <Zap
                size={17}
                className="text-violet-600"
              />
  
              <span className="text-xs text-violet-600 dark:text-violet-300">
                Kill Zone
              </span>
            </div>
  
            <p className="mt-3 text-base font-bold text-gray-900 dark:text-white">
              {data.killZone}
            </p>
          </div>
  
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert
                size={17}
                className="text-red-600"
              />
  
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Lower Quality Window
              </span>
            </div>
  
            <p className="mt-3 text-base font-bold text-gray-900 dark:text-white">
              {data.avoidWindow}
            </p>
          </div>
        </div>
  
        {/* OVERLAPS + CHARACTERISTICS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers3
                size={18}
                className="text-blue-600"
              />
  
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Session Overlaps
              </h3>
            </div>
  
            <div className="flex flex-wrap gap-2">
              {data.overlaps.map((overlap) => (
                <span
                  key={overlap}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  {session.name} × {overlap}
                </span>
              ))}
            </div>
  
            <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
              Overlapping sessions generally increase market participation
              and can create stronger price expansion.
            </p>
          </div>
  
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity
                size={18}
                className="text-green-600"
              />
  
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Session Characteristics
              </h3>
            </div>
  
            <div className="grid grid-cols-2 gap-3">
              {data.characteristics.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-3"
                >
                  <CheckCircle2
                    size={14}
                    className="text-green-600 shrink-0"
                  />
  
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
  
        {/* BEHAVIOR + STRATEGY */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers3
                size={18}
                className="text-blue-600"
              />
  
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Market Behavior
              </h3>
            </div>
  
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              {data.behavior}
            </p>
          </div>
  
          <div className="rounded-2xl border border-violet-100 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain
                size={18}
                className="text-violet-600"
              />
  
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Trading Approach
              </h3>
            </div>
  
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              {data.strategy}
            </p>
          </div>
        </div>
  
        {/* PLAYBOOK */}
        <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target
              size={18}
              className="text-violet-600"
            />
  
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Session Playbook
            </h3>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.playbook.map((step, index) => (
              <div
                key={step}
                className="rounded-xl border border-gray-200 dark:border-gray-800 p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-violet-600">
                      {index + 1}
                    </span>
                  </div>
  
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Step {index + 1}
                  </span>
                </div>
  
                <p className="mt-3 text-xs leading-5 text-gray-600 dark:text-gray-400">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
  
        {/* RISK */}
        <div className="mt-5 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle
              size={18}
              className="text-red-600"
            />
  
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Session Risk Factors
            </h3>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.risks.map((risk) => (
              <div
                key={risk}
                className="rounded-xl bg-white dark:bg-[#151515] border border-red-100 dark:border-red-900/30 px-4 py-3"
              >
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {risk}
                </p>
              </div>
            ))}
          </div>
        </div>
  
        {/* SESSION TIME */}
        <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151515] p-5">
          <div className="flex items-center gap-2">
            <Clock3
              size={18}
              className="text-violet-600"
            />
  
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Current Session Timing
            </h3>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Local Time
              </p>
  
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {session.localTime || "--:--"}
              </p>
            </div>
  
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Local Date
              </p>
  
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {session.localDate || "—"}
              </p>
            </div>
  
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Status
              </p>
  
              <p
                className={`mt-1 text-lg font-bold ${
                  isOpen
                    ? "text-green-600"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {isOpen ? "Market Open" : "Market Closed"}
              </p>
            </div>
  
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Session Quality
              </p>
  
              <p className="mt-1 text-lg font-bold text-violet-600">
                {data.score}/100
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }