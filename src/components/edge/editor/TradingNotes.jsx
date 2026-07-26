export default function TradingNotes({
    strategy,
    setStrategy,
  }) {
    return (
      <div className="mb-2">
  
        <div className="mb-3">
  
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
            Trading Notes
          </h3>
  
        </div>
  
        <div className="rounded-2xl border border-gray-300 overflow-hidden">
  
          {/* Toolbar */}
  
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
  
            <button className="font-bold hover:text-purple-600">
              B
            </button>
  
            <button className="italic hover:text-purple-600">
              I
            </button>
  
            <button className="underline hover:text-purple-600">
              U
            </button>
  
            <div className="w-px h-5 bg-gray-300" />
  
            <button className="hover:text-purple-600">
              • List
            </button>
  
            <button className="hover:text-purple-600">
              1. List
            </button>
  
          </div>
  
          {/* Editor */}
  
          <textarea
            value={strategy.notes}
            onChange={(e)=>
              setStrategy({
                ...strategy,
                notes:e.target.value,
              })
            }
            placeholder="Write important strategy notes here...
  
  Examples:
  
  • Avoid trading during CPI
  
  • Wait for HTF confirmation
  
  • Don't enter before BOS
  
 "
            className="w-full h-59 p-5 outline-none resize-none"
          />
  
        </div>
  
      </div>
    );
  }