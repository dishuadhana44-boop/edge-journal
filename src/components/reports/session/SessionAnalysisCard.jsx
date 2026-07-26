
import { sessionData } from "./SessionData";
import SessionTable from "./SessionTable";
import SessionSummary from "./SessionSummary";
import SessionProfitChart from "./SessionProfitChart";

export default function SessionAnalysisCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

      <div className="px-6 py-4 border-b">

        <h2 className="text-xl font-semibold">
          Session Analysis
        </h2>

        

      </div>

      <div className="grid grid-cols-12 gap-6 p-6">

        {/* Left */}

        <div className="col-span-9 space-y-6">

          <SessionTable
            data={sessionData}
          />

          <SessionProfitChart
            data={sessionData}
          />

        </div>

        {/* Right */}

        <div className="col-span-3">

          <SessionSummary
            data={sessionData}
          />

        </div>

      </div>

    </div>
  );
}