import {
    CalendarDays,
  } from "lucide-react";
  
  import { DATE_FILTERS } from "../../../utils/dateRangeUtils";

  const filters = [
    DATE_FILTERS.TODAY,
    DATE_FILTERS.ONE_WEEK,
    
    DATE_FILTERS.ONE_MONTH,
   
    
    DATE_FILTERS.ONE_YEAR,
    DATE_FILTERS.ALL,
  ];
  export default function QuickFilters({
  
      selectedFilter,
  
      onChange,
  
  }) {
  
      return (
  
          <div className="flex items-center  flex-wrap">
  
              {filters.map((filter) => (
  
                  <button
                      key={filter}
                      onClick={() => onChange(filter)}
                      className={`
                          px-4
                          py-2
                          rounded-xl
                          text-sm
                          font-medium
                          transition-all
                          duration-200
  
                          ${
                              selectedFilter === filter
                                  ? "bg-violet-600 text-white shadow-lg"
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