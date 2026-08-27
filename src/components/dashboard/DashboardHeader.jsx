import { useState } from "react";


import DateRangePicker from "./DateRangePicker";

import QuickFilters from "./header/QuickFilters";

import { useDashboardFilter } from "../../context/DashboardFilterContext";
import { getDateRange } from "../../utils/dateRangeUtils";

import { useJournal } from "../../context/JournalContext";

import PageHeader from "../common/PageHeader";

function DashboardHeader({
  accounts,
  selectedAccount,
  setSelectedAccount,
  onSaveAccount,
}) {
  

  const {
    selectedFilter,
    setSelectedFilter,
    setStartDate,
    setEndDate,
  } = useDashboardFilter();

  const handleQuickFilter = (filter) => {

    const range = getDateRange(filter);
  
    setSelectedFilter(filter);
  
    setStartDate(range.startDate);
  
    setEndDate(range.endDate);
  
  };

  const {
    selectedAccountId,
    setSelectedAccountId,
  } = useJournal();
  
  const tradingAccounts =
    JSON.parse(localStorage.getItem("tradingAccounts")) || [];
  
  const selected =
    tradingAccounts.find(
      (a) => Number(a.id) === Number(selectedAccountId)
    ) ||
    tradingAccounts.find((a) => a.isDefault) ||
    tradingAccounts[0];

  return (
    <>
      <div className="flex items-center justify-between ">
  
        {/* Left */}
    
        <PageHeader
  title="Dashboard"
  subtitle="Track your trading performance ."
  icon="dashboard"
/>

        {/* Right */}
        <div className="flex items-center gap-3">

        <select
  value={selected?.id || ""}
  onChange={(e) =>
    setSelectedAccountId(Number(e.target.value))
  }
  className="
    h-10
    rounded-xl
    border
    border-gray-300
    px-4
    text-sm
    font-medium
    bg-white
    hover:border-violet-500
    focus:outline-none
    focus:ring-2
    focus:ring-violet-500
  "
>
  {tradingAccounts.map((account) => (
    <option
      key={account.id}
      value={account.id}
    >
      {account.accountName}
    </option>
  ))}
</select>
  
          <DateRangePicker />
  
          <QuickFilters
  selectedFilter={selectedFilter}
  onChange={handleQuickFilter}
/>

  
        </div>
  
      </div>
  
 
  
    </>
  );
}

export default DashboardHeader;