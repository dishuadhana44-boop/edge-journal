import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({
  title,
  value,
  change,
  positive = true,
  color = "text-gray-900",
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">

      <p className="text-[11px] uppercase tracking-wide text-gray-500">
        {title}
      </p>

      <h2 className={`mt-3 text-3xl font-bold ${color}`}>
        {value}
      </h2>

      {change && (
        <div
          className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${
            positive ? "text-green-600" : "text-red-500"
          }`}
        >
          {positive ? (
            <TrendingUp size={15} />
          ) : (
            <TrendingDown size={15} />
          )}

          {change}
        </div>
      )}
    </div>
  );
}