import DateRangePicker from "./DateRangePicker";

import QuickFilters from "./header/QuickFilters";
import SectionFilterMenu from "./header/SectionFilterMenu";

import { useDashboardFilter } from "../../context/DashboardFilterContext";
import { getDateRange } from "../../utils/dateRangeUtils";

import PageHeader from "../common/PageHeader";

function DashboardHeader() {

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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
  
        {/* Left */}
    
        <PageHeader
  title="Dashboard"
  subtitle="Track your trading performance ."
  icon="dashboard"
  spaced={false}
/>

        {/* Right */}
        <div className="flex items-center justify-end flex-wrap gap-3">

          <DateRangePicker />
  
          <QuickFilters
  selectedFilter={selectedFilter}
  onChange={handleQuickFilter}
/>

          <SectionFilterMenu />

        </div>
  
      </div>
  
 
  
    </>
  );
}

export default DashboardHeader;
