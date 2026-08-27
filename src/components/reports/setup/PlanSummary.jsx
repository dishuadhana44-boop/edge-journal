export default function PlanSummary({ data = [] }) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-500">
          No trading plan data available.
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

      <SummaryCard
        icon="🏆"
        title="Best Plan"
        value={bestProfit.plan}
        sub={`$${Number(bestProfit.netPnL || 0).toLocaleString()}`}
        color="text-green-600"
      />

      <SummaryCard
        icon="⚠️"
        title="Worst Plan"
        value={worstProfit.plan}
        sub={`$${Number(worstProfit.netPnL || 0).toLocaleString()}`}
        color="text-red-500"
      />

      <SummaryCard
        icon="📈"
        title="Highest Win Rate"
        value={`${Number(bestWinRate.winRate || 0).toFixed(1)}%`}
        sub={bestWinRate.plan}
        color="text-blue-600"
      />

      <SummaryCard
        icon="⭐"
        title="Best Profit Factor"
        value={Number(bestPF.profitFactor || 0).toFixed(2)}
        sub={bestPF.plan}
        color="text-violet-600"
      />

      <SummaryCard
        icon="🎯"
        title="Best RR"
        value={`${Number(bestRR.averageRR || 0).toFixed(2)}R`}
        sub={bestRR.plan}
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

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">
          {icon}
        </span>

        <p className="text-sm text-gray-500">
          {title}
        </p>
      </div>

      <h2 className={`text-2xl font-bold ${color}`}>
        {value}
      </h2>

      <p className="text-sm text-gray-500 mt-1">
        {sub}
      </p>

    </div>
  );
}