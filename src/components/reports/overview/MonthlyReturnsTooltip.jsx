export default function MonthlyReturnsTooltip({
    active,
    payload,
    label,
  }) {
    if (!active || !payload?.length) return null;
  
    const value = payload[0].value;
  
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
  
        <p className="font-semibold text-gray-700">
          {label}
        </p>
  
        <p
          className={`mt-2 text-lg font-bold ${
            value >= 0
              ? "text-green-600"
              : "text-red-500"
          }`}
        >
          {value > 0 ? "+" : ""}
          ${Number(value).toLocaleString()}
        </p>
  
      </div>
    );
  }