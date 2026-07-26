import TradeDistributionChart from "./TradeDistributionChart";
import TradeDistributionStats from "./TradeDistributionStats";

import {
  tradeDistribution,
  tradeSummary,
} from "./TradeDistributionData";

export default function TradeDistributionCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

      <div className="px-6 py-4 border-b">

        <h2 className="text-xl font-semibold">
          Trade Distribution
        </h2>

       

      </div>

      <div className="grid grid-cols-2 gap-6 p-6">

        <TradeDistributionChart
          data={tradeDistribution}
        />

        <TradeDistributionStats
          summary={tradeSummary}
        />

      </div>

    </div>
  );
}