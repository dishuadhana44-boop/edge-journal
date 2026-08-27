export default function SessionSummary({ data = [] }) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-500">
          No session data available.
        </p>
      </div>
    );
  }

  const bestProfit = [...data].sort(
    (a, b) => b.netPnL - a.netPnL
  )[0];

  const worstProfit = [...data].sort(
    (a, b) => a.netPnL - b.netPnL
  )[0];

  const bestWinRate = [...data].sort(
    (a, b) => b.winRate - a.winRate
  )[0];

  const bestPF = [...data].sort(
    (a, b) => b.profitFactor - a.profitFactor
  )[0];

  const bestRR = [...data].sort(
    (a, b) => b.averageRR - a.averageRR
  )[0];

  return (
    <div className="space-y-4">

      {/* BEST SESSION */}
      <SummaryCard
        icon="🏆"
        title="Best Session"
        value={`${bestProfit.icon || ""} ${bestProfit.session}`}
        sub={`$${Number(bestProfit.netPnL || 0).toLocaleString()}`}
        color="text-green-600"
      />

      {/* WORST SESSION */}
      <SummaryCard
        icon="⚠️"
        title="Worst Session"
        value={`${worstProfit.icon || ""} ${worstProfit.session}`}
        sub={`$${Number(worstProfit.netPnL || 0).toLocaleString()}`}
        color="text-red-500"
      />

      {/* HIGHEST WIN RATE */}
      <SummaryCard
        icon="📈"
        title="Highest Win Rate"
        value={`${Number(bestWinRate.winRate || 0).toFixed(1)}%`}
        sub={bestWinRate.session}
        color="text-blue-600"
      />

      {/* BEST PROFIT FACTOR */}
      <SummaryCard
        icon="⭐"
        title="Best Profit Factor"
        value={Number(bestPF.profitFactor || 0).toFixed(2)}
        sub={bestPF.session}
        color="text-violet-600"
      />

      {/* BEST RR */}
      <SummaryCard
        icon="🎯"
        title="Best RR"
        value={`${Number(bestRR.averageRR || 0).toFixed(2)}R`}
        sub={bestRR.session}
        color="text-orange-500"
      />

    </div>
  );
}


function SummaryCard({
  icon,
  title,
  value,
  sub,
  color,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition">

      <div className="flex items-center gap-2">

        <span className="text-xl">
          {icon}
        </span>

        <span className="text-sm text-gray-500">
          {title}
        </span>

      </div>

      <h2
        className={`text-2xl font-bold mt-3 ${color}`}
      >
        {value}
      </h2>

      <p className="text-sm text-gray-500 mt-1">
        {sub}
      </p>

    </div>
  );
}