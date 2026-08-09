import { useState } from "react";
import MonthlyReturnsChart from "./MonthlyReturnsChart";
import { useJournal } from "../../../context/JournalContext";
import { generateMonthlyReturns } from "../../../utils/monthlyReturnsEngine";

export default function MonthlyReturnsCard() {

const { filteredTrades } = useJournal();

const years = [
  ...new Set(
    filteredTrades
      .filter((t) => t.date)
      .map((t) => new Date(t.date).getFullYear())
  ),
].sort((a, b) => b - a);

const [selectedYear, setSelectedYear] = useState(
  years[0] || new Date().getFullYear()
);

const monthlyData = generateMonthlyReturns(
  filteredTrades,
  selectedYear
);



  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="flex justify-between items-center px-6 py-2 border-b">

        <div>

          <h2 className="text-lg font-semibold">
            Monthly Returns
          </h2>

         

        </div>

        <select
  value={selectedYear}
  onChange={(e) => setSelectedYear(Number(e.target.value))}
  className="border rounded-lg px-3 py-2 text-sm"
>
  {years.map((year) => (
    <option key={year} value={year}>
      {year}
    </option>
  ))}
</select>

      </div>

      <div className="grid grid-cols-4 border-b">

      <Metric
  title="Best"
  value={`${monthlyData.bestMonth >= 0 ? "+" : ""}$${monthlyData.bestMonth.toFixed(2)}`}
  color="text-green-600"
/>

<Metric
  title="Worst"
  value={`${monthlyData.worstMonth >= 0 ? "+" : ""}$${monthlyData.worstMonth.toFixed(2)}`}
  color="text-red-500"
/>

<Metric
  title="Positive"
  value={monthlyData.positiveMonths}
  color="text-green-600"
/>

<Metric
  title="Negative"
  value={monthlyData.negativeMonths}
  color="text-red-500"
/>

      </div>

      <div className="p-4">

      <MonthlyReturnsChart data={monthlyData.data} />

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