import { useState } from "react";
import ChartHeader from "./ChartHeader";
import ChartStats from "./ChartStats";
import EquityChart from "./EquityChart";

import { useJournal } from "../../../context/JournalContext";

import { generateBalanceCurve } from "../../../utils/balanceCurveEngine";

import { filterTradesByPeriod }
from "../../../utils/reportPeriodFilter";

export default function OverviewEquityCurve() {

  const { trades } = useJournal();

  const [period, setPeriod] = useState("ALL");

  const [mode, setMode] = useState("Balance");
  console.log("Overview Mode =", mode);
  const startingBalance = 10000;

  const filteredTrades =
  filterTradesByPeriod(
  trades,
  period
  );
  
  const equityData =
  generateBalanceCurve(
  startingBalance,
  filteredTrades
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

<ChartHeader
  period={period}
  setPeriod={setPeriod}
  mode={mode}
  setMode={setMode}
/>

      <ChartStats
        trades={filteredTrades}
        startingBalance={startingBalance}
        equityData={equityData}
      />

<EquityChart
  equityData={equityData}
  mode={mode}
/>

    </div>
  );
}