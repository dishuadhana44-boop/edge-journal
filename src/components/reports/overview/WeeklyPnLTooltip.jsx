export default function WeeklyPnLTooltip({
    active,
    payload,
    label,
  }) {
    if (!active || !payload?.length) return null;
  
    const value = payload[0].value;
  
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
  
        <p className="text-sm font-semibold text-gray-700">
          {label}
        </p>
  
        <p
          className={`mt-2 text-lg font-bold ${
            value >= 0
              ? "text-green-600"
              : "text-red-500"
          }`}
        >
          {value >= 0 ? "+" : ""}
          ${value}
        </p>
  
      </div>
    );
  }