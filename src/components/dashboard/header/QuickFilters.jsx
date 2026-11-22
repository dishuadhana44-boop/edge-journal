import {
    CalendarDays,
  } from "lucide-react";
  
  import { DATE_FILTERS } from "../../../utils/dateRangeUtils";

  const filters = [
    DATE_FILTERS.TODAY,
    DATE_FILTERS.ONE_WEEK,
    DATE_FILTERS.ONE_MONTH,
    DATE_FILTERS.ALL,
  ];
  export default function QuickFilters({
  
      selectedFilter,
  
      onChange,
  
  }) {
  
      return (
  
          <div className="flex items-center gap-1.5 flex-wrap">
  
              {filters.map((filter) => (
  
                  <button
                      key={filter}
                      onClick={() => onChange(filter)}
                      className={`
                          flex
                          items-center
                          h-9
                          px-3
                          rounded-xl
                          text-[13px]
                          font-medium
                          whitespace-nowrap
                          transition-all
                          duration-200
  
                          ${
                              selectedFilter === filter
                                  ? "bg-violet-600 text-white shadow-lg border border-violet-600"
                                  : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50"
                          }
                      `}
                  >
  
                      {filter}
  
                  </button>
  
              ))}
  
          </div>
  
      );
  
  }