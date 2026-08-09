export default function EquityTooltip({
    active,
    payload,
    label,
  }) {
    if (!active || !payload?.length) return null;
  
    const point = payload[0].payload;
  
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-3">
  
        <p className="text-xs text-gray-500">
          {label}
        </p>
  
        <h2 className="text-lg font-bold text-gray-900">
        ${Number(point.value || 0).toLocaleString()}
        </h2>
  
        {point.pnl !== undefined && (
          <p
            className={`text-sm font-semibold ${
              point.pnl >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            Trade :
            {point.pnl >= 0 ? "+" : ""}
            ${point.pnl}
          </p>
        )}
  
      </div>
    );
  }