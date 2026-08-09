import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { DATE_FILTERS, getDateRange } from "../utils/dateRangeUtils";

const DashboardFilterContext = createContext();

const STORAGE_KEY = "dashboard_filters";

export function DashboardFilterProvider({ children }) {

  const savedFilters = (() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);

      if (!data) return null;

      const parsed = JSON.parse(data);

      return {
        selectedFilter: parsed.selectedFilter,
        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      };
    } catch {
      return null;
    }
  })();

  const defaultRange = getDateRange(DATE_FILTERS.ONE_MONTH);

  const [selectedFilter, setSelectedFilter] = useState(
    savedFilters?.selectedFilter || DATE_FILTERS.ONE_MONTH
  );

  const [startDate, setStartDate] = useState(
    savedFilters?.startDate || defaultRange.startDate
  );

  const [endDate, setEndDate] = useState(
    savedFilters?.endDate || defaultRange.endDate
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedFilter,
        startDate,
        endDate,
      })
    );
  }, [selectedFilter, startDate, endDate]);

  const resetFilters = () => {

    const range = getDateRange(DATE_FILTERS.ONE_MONTH);

    setSelectedFilter(DATE_FILTERS.ONE_MONTH);

    setStartDate(range.startDate);

    setEndDate(range.endDate);

  };

  const value = useMemo(
    () => ({
      selectedFilter,
      setSelectedFilter,

      startDate,
      setStartDate,

      endDate,
      setEndDate,

      resetFilters,
    }),
    [selectedFilter, startDate, endDate]
  );

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {

  const context = useContext(DashboardFilterContext);

  if (!context) {
    throw new Error(
      "useDashboardFilter must be used inside DashboardFilterProvider"
    );
  }

  return context;
}