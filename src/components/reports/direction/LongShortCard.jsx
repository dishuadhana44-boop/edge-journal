import LongShortChart from "./LongShortChart";
import LongShortComparison from "./LongShortComparison";
import { longShortData } from "./LongShortData";

export default function LongShortCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

      <div className="px-6 py-4 border-b">

        <h2 className="text-xl font-semibold">
          Long vs Short Analysis
        </h2>

        

      </div>

      <div className="grid grid-cols-2 gap-8 p-6">

        <LongShortChart
          data={longShortData}
        />

        <LongShortComparison
          data={longShortData}
        />

      </div>

    </div>
  );
}