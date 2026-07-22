export default function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
  
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-4 min-w-[180px]">
  
        <p className="text-xs text-gray-500 mb-2">
          {label}
        </p>
  
        <div className="space-y-2">
  
          <div className="flex justify-between">
  
            <span className="text-gray-500">
              Balance
            </span>
  
            <span className="font-semibold text-green-600">
              ${payload[0].value.toLocaleString()}
            </span>
  
          </div>
  
          <div className="flex justify-between">
  
            <span className="text-gray-500">
              Equity
            </span>
  
            <span className="font-semibold text-blue-600">
              ${payload[1].value.toLocaleString()}
            </span>
  
          </div>
  
        </div>
  
      </div>
    );
  }