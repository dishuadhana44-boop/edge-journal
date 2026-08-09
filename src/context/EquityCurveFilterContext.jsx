import { createContext, useContext, useState } from "react";
import { DATE_FILTERS } from "../utils/dateRangeUtils";

const EquityCurveFilterContext = createContext();

export function EquityCurveFilterProvider({ children }) {

  const [selectedFilter, setSelectedFilter] =
    useState(DATE_FILTERS.ALL);

  return (
    <EquityCurveFilterContext.Provider
      value={{
        selectedFilter,
        setSelectedFilter,
      }}
    >
      {children}
    </EquityCurveFilterContext.Provider>
  );
}

export function useEquityCurveFilter() {
  return useContext(EquityCurveFilterContext);
}