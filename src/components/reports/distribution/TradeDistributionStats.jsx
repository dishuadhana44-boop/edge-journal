export default function TradeDistributionStats({
    summary,
  }) {
    return (
      <div className="space-y-4">
  
        <Stat
          label="Total Trades"
          value={summary.totalTrades}
        />
  
        <Stat
          label="Winning Trades"
          value={summary.winningTrades}
          color="text-green-600"
        />
  
        <Stat
          label="Losing Trades"
          value={summary.losingTrades}
          color="text-red-500"
        />
  
        <Stat
          label="Break Even"
          value={summary.breakevenTrades}
          color="text-gray-500"
        />
  
        <div className="pt-4 border-t">
  
          <Progress
            label="Win Rate"
            value={summary.winRate}
            color="bg-green-500"
          />
  
          <Progress
            label="Loss Rate"
            value={summary.lossRate}
            color="bg-red-500"
          />
  
          <Progress
            label="Scratch"
            value={summary.scratchRate}
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
      <div className="flex justify-between">
  
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
    return (
      <div className="mb-4">
  
        <div className="flex justify-between mb-1">
  
          <span className="text-sm">
            {label}
          </span>
  
          <span className="text-sm font-semibold">
            {value}%
          </span>
  
        </div>
  
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
  
          <div
            className={`${color} h-full rounded-full`}
            style={{
              width: `${value}%`,
            }}
          />
  
        </div>
  
      </div>
    );
  }