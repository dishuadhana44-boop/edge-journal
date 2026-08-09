import StatisticsColumn from "./StatisticsColumn";
import { useJournal } from "../../../context/JournalContext";
import { generateTradingStatistics } from "../../../utils/statisticsCalculator";



export default function YourStatistics() {

  const { filteredTrades } = useJournal();

  const { leftStats, rightStats } =
  generateTradingStatistics(filteredTrades);
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-semibold">
          Your Trading Statistics
        </h2>
      </div>

      <div className="grid grid-cols-2 divide-x min-h-[900px]">

        <StatisticsColumn
          title="Performance"
          data={leftStats}
        />

        <StatisticsColumn
          title="Trading Activity"
          data={rightStats}
        />

      </div>

    </div>
  );
}
