import DailyPnLChart from "./DailyPnLChart";
import { useJournal } from "../../../context/JournalContext";
import { generateDailyPnL } from "../../../utils/dailyPnLEngine";

export default function DailyPnLCard() {

  const { filteredTrades } = useJournal();

  const dailyData = generateDailyPnL(filteredTrades);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="flex items-center justify-between px-6 py-2 border-b">

        <div>

          <h2 className="text-lg font-semibold">
            Daily Profit & Loss
          </h2>

          

        </div>

        <div className="text-right">

          <p className="text-xs text-gray-500">
            Today
          </p>

          <h2 className="text-2xl font-bold text-green-600">
          {dailyData.todayPnL >= 0 ? "+" : ""}
          ${dailyData.todayPnL.toFixed(2)}
          </h2>

        </div>

      </div>

      <div className="grid grid-cols-3 border-b">

      <Metric
title="Average"
value={`${dailyData.average >= 0 ? "+" : ""}$${dailyData.average.toFixed(2)}`}
          color="text-green-600"
        />

        <Metric
          title="Best Day"
          value={`${dailyData.bestDay >= 0 ? "+" : ""}$${dailyData.bestDay.toFixed(2)}`}
          color="text-green-600"
        />

           <Metric
             title="Worst Day"
             value={`${dailyData.worstDay >= 0 ? "+" : ""}$${dailyData.worstDay.toFixed(2)}`}
             color="text-red-500"
           />

      </div>

      <div className="p-4">

      <DailyPnLChart
    data={dailyData.data}
/>

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