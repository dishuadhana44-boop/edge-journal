import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { DATE_FILTERS, getDateRange } from "../utils/dateRangeUtils";
import {
  DASHBOARD_SECTIONS,
  DEFAULT_SECTIONS,
} from "../utils/dashboardSections";

const DashboardFilterContext = createContext();

const STORAGE_KEY = "dashboard_filters";

const SECTION_STORAGE_KEY = "dashboard_sections";

function readSavedSections() {
  try {
    const saved = JSON.parse(localStorage.getItem(SECTION_STORAGE_KEY));

    if (!saved) return DEFAULT_SECTIONS;

    return DASHBOARD_SECTIONS.reduce(
      (acc, section) => {
        acc[section.key] =
          typeof saved[section.key] === "boolean"
            ? saved[section.key]
            : section.default ?? true;

        return acc;
      },
      {}
    );
  } catch {
    return DEFAULT_SECTIONS;
  }
}

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

  const [sections, setSections] = useState(readSavedSections);

  useEffect(() => {
    localStorage.setItem(
      SECTION_STORAGE_KEY,
      JSON.stringify(sections)
    );
  }, [sections]);

  const toggleSection = (key) => {
    setSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const resetSections = () => {
    setSections(DEFAULT_SECTIONS);
  };

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

      sections,
      toggleSection,
      resetSections,
    }),
    [selectedFilter, startDate, endDate, sections]
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