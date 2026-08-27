export default function TradeDistributionStats({
  summary = {},
}) {
  return (
    <div className="space-y-4">

      <Stat
        label="Total Trades"
        value={summary.totalTrades ?? 0}
      />

      <Stat
        label="Winning Trades"
        value={summary.winningTrades ?? 0}
        color="text-green-600"
      />

      <Stat
        label="Losing Trades"
        value={summary.losingTrades ?? 0}
        color="text-red-500"
      />

      <Stat
        label="Break Even"
        value={summary.breakevenTrades ?? 0}
        color="text-gray-500"
      />

      <div className="pt-4 border-t border-gray-200">

        <Progress
          label="Win Rate"
          value={summary.winRate ?? 0}
          color="bg-green-500"
        />

        <Progress
          label="Loss Rate"
          value={summary.lossRate ?? 0}
          color="bg-red-500"
        />

        <Progress
          label="Scratch"
          value={summary.scratchRate ?? 0}
          color="bg-gray-400"
        />

      </div>

    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-gray-900",
}) {
  return (
    <div className="flex items-center justify-between">

      <span className="text-sm text-gray-600">
        {label}
      </span>

      <span className={`font-semibold ${color}`}>
        {value}
      </span>

    </div>
  );
}

function Progress({
  label,
  value,
  color,
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div className="mb-4">

      <div className="flex items-center justify-between mb-1">

        <span className="text-sm text-gray-600">
          {label}
        </span>

        <span className="text-sm font-semibold text-gray-800">
          {safeValue.toFixed(1)}%
        </span>

      </div>

      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">

        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{
            width: `${safeValue}%`,
          }}
        />

      </div>

    </div>
  );
}