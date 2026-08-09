import { useState } from "react";
import CalendarHeatmapGrid from "./CalendarHeatmapGrid";

export default function CalendarHeatmapCard() {

  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  return (

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="flex justify-between items-center px-6 py-2 border-b">

        <div>

          <h2 className="text-lg font-semibold">

            Trading Calendar

          </h2>


        </div>

        <select
  value={selectedMonth}
  onChange={(e) => setSelectedMonth(Number(e.target.value))}
  className="border rounded-lg px-3 py-2 text-sm"
>
  {months.map((month, index) => (
    <option key={month} value={index}>
      {month} {selectedYear}
    </option>
  ))}
</select>
      </div>

      <div className="p-6">

      <CalendarHeatmapGrid
  selectedMonth={selectedMonth}
  selectedYear={selectedYear}
/>

      </div>

      <div className="flex justify-center gap-6 border-t p-4 text-xs">

        <div className="flex items-center gap-2">

          <div className="w-4 h-4 rounded bg-green-600"></div>

          Big Win

        </div>

        <div className="flex items-center gap-2">

          <div className="w-4 h-4 rounded bg-green-300"></div>

          Win

        </div>

        <div className="flex items-center gap-2">

          <div className="w-4 h-4 rounded bg-gray-100 border"></div>

          No Trade

        </div>

        <div className="flex items-center gap-2">

          <div className="w-4 h-4 rounded bg-red-300"></div>

          Loss

        </div>

        <div className="flex items-center gap-2">

          <div className="w-4 h-4 rounded bg-red-600"></div>

          Big Loss

        </div>

      </div>

    </div>

  );

}