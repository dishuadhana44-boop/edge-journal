import StatisticsColumn from "./StatisticsColumn";
import { leftStats, rightStats } from "./StatisticsData";

console.log(leftStats);
console.log(rightStats);

export default function YourStatistics() {
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