import WeeklyPnLChart from "./WeeklyPnLChart";

export default function WeeklyPnLCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="flex items-center justify-between px-6 py-2 border-b">

        <div>

          <h2 className="text-lg font-semibold">
            Weekly Profit & Loss
          </h2>

       

        </div>

        <div className="text-right">

          <p className="text-xs text-gray-500">
            This Week
          </p>

          <h2 className="text-2xl font-bold text-green-600">
            +$1,264
          </h2>

        </div>

      </div>

      <div className="grid grid-cols-3 border-b">

        <Metric
          title="Average"
          value="+$784"
          color="text-green-600"
        />

        <Metric
          title="Best Week"
          value="+$2,485"
          color="text-green-600"
        />

        <Metric
          title="Worst Week"
          value="-$820"
          color="text-red-500"
        />

      </div>

      <div className="p-4">

        <WeeklyPnLChart />

      </div>

    </div>
  );
}

function Metric({
  title,
  value,
  color,
}) {
  return (
    <div className="p-4 border-r last:border-r-0">

      <p className="text-[10px] uppercase tracking-wide text-gray-500">
        {title}
      </p>

      <h3 className={`mt-2 text-lg font-bold ${color}`}>
        {value}
      </h3>

    </div>
  );
}