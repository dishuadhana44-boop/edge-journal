import SetupTable from "./SetupTable";
import SetupSummary from "./SetupSummary";
import { setupData } from "./SetupData";
import SetupProfitChart from "./SetupProfitChart";


export default function SetupAnalysisCard() {

  return (

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

      <div className="px-6 py-4 border-b">

        <h2 className="text-xl font-semibold">

          Setup Analysis

        </h2>

        

      </div>

      <div className="grid grid-cols-12 gap-6 p-6">

<div className="col-span-9 space-y-6">

  <SetupTable
    data={setupData}
  />

  <SetupProfitChart
    data={setupData}
  />

</div>

<div className="col-span-3">

  <SetupSummary
    data={setupData}
  />

</div>

</div>

    </div>

  );

}