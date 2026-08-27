import { useState } from "react";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatCards from "../components/dashboard/StatCards";
import EquityCurve from "../components/dashboard/EquityCurve";
import RecentTradesCard from "../components/dashboard/RecentTrades/RecentTradesCard";
import DisciplineCard from "../components/dashboard/Discipline/DisciplineCard";
import { DashboardFilterProvider } from "../context/DashboardFilterContext";

import { useJournal } from "../context/JournalContext";
import { useDashboardFilter } from "../context/DashboardFilterContext";

import {
  EquityCurveFilterProvider,
} from "../context/EquityCurveFilterContext";

function Dashboard() {

  const {
    filteredTrades: accountTrades,
  } = useJournal();

  const {
    startDate,
    endDate,
  } = useDashboardFilter();
  
  const filteredTrades = accountTrades;

  const {
    selectedAccountId,
  } = useJournal();

  const accounts =
  JSON.parse(localStorage.getItem("tradingAccounts")) || [];


const currentAccount =
  accounts.find(
    (account) => Number(account.id) === Number(selectedAccountId)
  ) ||
  accounts.find((account) => account.isDefault) ||
  accounts[0];

  return (

      <div className="w-full h-[calc(100vh-78px)] px-1 py-2">
    
    <DashboardHeader />
    
        <div className="-mt-1">
        <StatCards
    account={currentAccount}
    trades={filteredTrades}
/>
        </div>
    
        <div className="grid grid-cols-12 gap-x-3">
    
          <div className="col-span-8">
            
          <EquityCurveFilterProvider>
          <EquityCurve
  account={currentAccount}
  trades={filteredTrades}
/>
</EquityCurveFilterProvider>

          </div>
    
          <div className="col-span-4">
  <DisciplineCard trades={filteredTrades} />
</div>
    
          <div className="col-span-8 -mt-40">
          <RecentTradesCard
    trades={filteredTrades}
/>
          </div>
    
        </div>
    
      </div>
    
    
    
    );
}

export default Dashboard;