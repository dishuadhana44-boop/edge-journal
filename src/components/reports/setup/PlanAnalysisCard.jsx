import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

import PlanTable from "./PlanTable";
import PlanSummary from "./PlanSummary";
import PlanProfitChart from "./PlanProfitChart";

export default function PlanAnalysisCard() {
  const { trades = [] } = useJournal();

  const planData = useMemo(() => {
    const plans = {};
  
    trades.forEach((trade) => {
      const planTitle =
        trade?.reflection?.selectedPlanTitle;
  
      const planId =
        trade?.reflection?.selectedPlanId;
  
      if (!planTitle && !planId) return;
  
      const planName =
        planTitle || `Plan ${planId}`;
  
      if (!plans[planName]) {
        plans[planName] = {
          id: planId || planName,
          plan: planName,
          trades: 0,
          winningTrades: 0,
          netPnL: 0,
          rrValues: [],
          grossProfit: 0,
          grossLoss: 0,
        };
      }
  
      const item = plans[planName];
  
      const pnl = Number(trade?.pnl || 0);
  
      const result = String(
        trade?.result || ""
      ).toLowerCase();
  
      item.trades += 1;
  
      if (
        result === "win" ||
        (result !== "loss" && pnl > 0)
      ) {
        item.winningTrades += 1;
      }
  
      item.netPnL += pnl;
  
      if (pnl > 0) {
        item.grossProfit += pnl;
      }
  
      if (pnl < 0) {
        item.grossLoss += Math.abs(pnl);
      }
  
      const rr = Number(trade?.rr);
  
      if (Number.isFinite(rr)) {
        item.rrValues.push(rr);
      }
    });
  
    return Object.values(plans).map((item) => {
      const winRate =
        item.trades > 0
          ? (item.winningTrades / item.trades) * 100
          : 0;
  
      const averageRR =
        item.rrValues.length > 0
          ? item.rrValues.reduce(
              (sum, value) => sum + value,
              0
            ) / item.rrValues.length
          : 0;
  
      const profitFactor =
        item.grossLoss > 0
          ? item.grossProfit / item.grossLoss
          : item.grossProfit > 0
            ? Infinity
            : 0;
  
      return {
        id: item.id,
        plan: item.plan,
        trades: item.trades,
        winRate,
        netPnL: item.netPnL,
        averageRR,
        profitFactor,
      };
    });
  }, [trades]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Plan Analysis
        </h2>
      </div>

      <div className="grid grid-cols-12 gap-6 p-6">

        <div className="col-span-9 space-y-6">

          <PlanTable
            data={planData}
          />

          <PlanProfitChart
            data={planData}
          />

        </div>

        <div className="col-span-3">

          <PlanSummary
            data={planData}
          />

        </div>

      </div>

    </div>
  );
}