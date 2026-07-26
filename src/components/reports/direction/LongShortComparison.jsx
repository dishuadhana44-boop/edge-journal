export default function LongShortComparison({ data }) {
    return (
      <div className="space-y-5">
  
        {data.map((item) => (
          <div key={item.direction}>
  
            <div className="flex justify-between mb-2">
  
              <span className="font-semibold">
                {item.direction}
              </span>
  
              <span className="font-bold">
                ${item.pnl.toLocaleString()}
              </span>
  
            </div>
  
            <div className="grid grid-cols-2 gap-4 text-sm">
  
              <Metric
                label="Trades"
                value={item.trades}
              />
  
              <Metric
                label="Win Rate"
                value={`${item.winRate}%`}
              />
  
              <Metric
                label="Average RR"
                value={`${item.rr}R`}
              />
  
              <Metric
                label="Profit Factor"
                value={item.profitFactor}
              />
  
            </div>
  
            <div className="mt-3 h-3 bg-gray-200 rounded-full overflow-hidden">
  
              <div
                className="h-full bg-violet-600 rounded-full"
                style={{
                  width: `${item.winRate}%`,
                }}
              />
  
            </div>
  
          </div>
        ))}
  
      </div>
    );
  }
  
  function Metric({
    label,
    value,
  }) {
    return (
      <div>
  
        <p className="text-xs text-gray-500">
          {label}
        </p>
  
        <p className="font-semibold mt-1">
          {value}
        </p>
  
      </div>
    );
  }