export default function StatisticsRow({
    label,
    value,
    valueColor = "text-gray-900",
  }) {
    return (
      <div className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition">
  
        <span className="text-sm text-gray-800">
          {label}
        </span>
  
        <span className={`text-sm font-semibold ${valueColor}`}>
          {value}
        </span>
  
      </div>
    );
  }