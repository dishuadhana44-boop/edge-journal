export default function InstrumentSummary({ data }) {

    const bestProfit = [...data].sort((a, b) => b.pnl - a.pnl)[0];
  
    const bestWinRate = [...data].sort((a, b) => b.winRate - a.winRate)[0];
  
    const bestPF = [...data].sort((a, b) => b.profitFactor - a.profitFactor)[0];
  
    return (
  
      <div className="space-y-4">
  
        <Card
          title="🏆 Best Instrument"
          value={bestProfit.instrument}
          sub={`$${bestProfit.pnl.toLocaleString()}`}
          color="text-green-600"
        />
  
        <Card
          title="📈 Highest Win Rate"
          value={`${bestWinRate.winRate}%`}
          sub={bestWinRate.instrument}
          color="text-blue-600"
        />
  
        <Card
          title="⭐ Best Profit Factor"
          value={bestPF.profitFactor}
          sub={bestPF.instrument}
          color="text-violet-600"
        />
  
      </div>
  
    );
  
  }
  
  function Card({
    title,
    value,
    sub,
    color,
  }) {
  
    return (
  
      <div className="rounded-xl border p-5">
  
        <p className="text-sm text-gray-500">
  
          {title}
  
        </p>
  
        <h2 className={`mt-3 text-2xl font-bold ${color}`}>
  
          {value}
  
        </h2>
  
        <p className="mt-1 text-sm text-gray-500">
  
          {sub}
  
        </p>
  
      </div>
  
    );
  
  }