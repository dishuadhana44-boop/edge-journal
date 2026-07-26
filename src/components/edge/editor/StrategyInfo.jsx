function StrategyInfo({ strategy, setStrategy }) {
    return (
      <div className="mb-8">
  
        {/* Strategy Name */}
  
        <input
          type="text"
          placeholder="Enter trade plan name"
          value={strategy.title}
          onChange={(e) =>
            setStrategy({
              ...strategy,
              title: e.target.value,
            })
          }
          className="w-full text-2xl font-bold border-b border-gray-300 pb-4 outline-none focus:border-purple-500 placeholder:text-gray-400"
        />
  
        {/* Plan Type */}
  
        <div className="mt-8">
  
          <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Plan Type
          </p>
  
          <input
            type="text"
            placeholder="e.g. Weekly Range, Liquidity Sweep, Break & Retest"
            value={strategy.type}
            onChange={(e) =>
              setStrategy({
                ...strategy,
                type: e.target.value,
              })
            }
            className="w-full h-12 rounded-xl border border-gray-300 px-4 outline-none focus:ring-2 focus:ring-purple-500"
          />
  
        </div>
  
      </div>
    );
  }
  
  export default StrategyInfo;