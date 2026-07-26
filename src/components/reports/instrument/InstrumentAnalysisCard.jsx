import InstrumentTable from "./InstrumentTable";
import { instrumentData } from "./InstrumentData";
import InstrumentSummary from "./InstrumentSummary";
import InstrumentProfitChart from "./InstrumentProfitChart";

export default function InstrumentAnalysisCard(){

return(

<div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

<div className="px-6 py-4 border-b">

<h2 className="text-xl font-semibold">

Instrument Analysis

</h2>



</div>

<div className="grid grid-cols-12 gap-6 p-6">

  <div className="col-span-9 space-y-6">

    <InstrumentTable
      data={instrumentData}
    />

    <InstrumentProfitChart
      data={instrumentData}
    />

  </div>

  <div className="col-span-3">

    <InstrumentSummary
      data={instrumentData}
    />

  </div>

</div>

</div>

)

}