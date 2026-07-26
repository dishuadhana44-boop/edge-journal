import MonthlyReturnsChart from "./MonthlyReturnsChart";

export default function MonthlyReturnsCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="flex justify-between items-center px-6 py-2 border-b">

        <div>

          <h2 className="text-lg font-semibold">
            Monthly Returns
          </h2>

         

        </div>

        <select className="border rounded-lg px-3 py-2 text-sm">

          <option>2025</option>

          <option>2024</option>

        </select>

      </div>

      <div className="grid grid-cols-4 border-b">

        <Metric
          title="Best"
          value="+14.2%"
          color="text-green-600"
        />

        <Metric
          title="Worst"
          value="-3.4%"
          color="text-red-500"
        />

        <Metric
          title="Positive"
          value="9"
          color="text-green-600"
        />

        <Metric
          title="Negative"
          value="3"
          color="text-red-500"
        />

      </div>

      <div className="p-4">

        <MonthlyReturnsChart />

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

      <p className="text-[10px] uppercase text-gray-500">
        {title}
      </p>

      <h3 className={`mt-2 text-lg font-bold ${color}`}>
        {value}
      </h3>

    </div>
  );
}