import { useState, useRef, useEffect } from "react";
import { Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import {
  subDays,
  startOfMonth,
  endOfMonth
} from "date-fns";

import "react-day-picker/dist/style.css";
import "./DateRangePicker.css";

import { useDashboardFilter } from "../../context/DashboardFilterContext";
import { getDateRange, DATE_FILTERS } from "../../utils/dateRangeUtils";

function DateRangePicker() {
  const popupRef = useRef(null);

  const [open, setOpen] = useState(false);

  const {

    selectedFilter,
    setSelectedFilter,

    startDate,
    setStartDate,

    endDate,
    setEndDate,

} = useDashboardFilter();

const [tempStart, setTempStart] = useState(startDate);

const [tempEnd, setTempEnd] = useState(endDate);

const applyQuickFilter = (filter) => {

  const range = getDateRange(filter);

  setSelectedFilter(filter);

  setStartDate(range.startDate);

  setEndDate(range.endDate);

  setTempStart(range.startDate);

  setTempEnd(range.endDate);

};


  const [activePreset, setActivePreset] = useState("today");
  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () =>
      document.removeEventListener("mousedown", handleClick);
  }, []);

  const applyDates = () => {

    setStartDate(tempStart);

    setEndDate(tempEnd);

    setSelectedFilter("Custom");

    setOpen(false);

};

  const cancelDates = () => {
    setTempStart(startDate);
    setTempEnd(endDate);
    setOpen(false);
  };

  const presetButtonClass = (preset) =>
    selectedFilter === preset
      ? "px-5 py-2.5 rounded-xl bg-purple-600 text-white border border-purple-600 shadow-md transition-all duration-300 hover:bg-purple-700 hover:scale-105"
      : "px-5 py-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 transition-all duration-300 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 hover:scale-105";
 
  
  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-11 px-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-purple-500 transition"
      >
        <Calendar size={18} className="text-purple-600" />

        <span className="text-sm font-medium whitespace-nowrap">
          {format(startDate, "dd MMM yyyy")}
          {" — "}
          {format(endDate, "dd MMM yyyy")}
        </span>
      </button>

      {open && (
        <div className="date-popup absolute right-0 mt-3 w-[650px] rounded-2xl border border-gray-200 bg-white shadow-2xl p-6 z-[9999]">

<div className="flex items-center justify-between mb-8">

<h2 className="text-1xl font-bold text-gray-900">
  Select Date Range
</h2>

<div className="flex items-center gap-1">

<button
    onClick={() => applyQuickFilter(DATE_FILTERS.TODAY)}
    className={presetButtonClass(DATE_FILTERS.TODAY)}
>
    Today
</button>

<button
  onClick={() => applyQuickFilter(DATE_FILTERS.ONE_WEEK)}
  className={presetButtonClass(DATE_FILTERS.ONE_WEEK)}
>
  1W
</button>

<button
    onClick={() => applyQuickFilter(DATE_FILTERS.TWO_WEEKS)}
    className={presetButtonClass(DATE_FILTERS.TWO_WEEKS)}
>
    2W
</button>

<button
    onClick={() => applyQuickFilter(DATE_FILTERS.ONE_MONTH)}
    className={presetButtonClass(DATE_FILTERS.ONE_MONTH)}
>
    1M
</button>

<button
    onClick={() => applyQuickFilter(DATE_FILTERS.ALL)}
    className={presetButtonClass(DATE_FILTERS.ALL)}
>
    ALL
</button>

</div>

</div>

<div className="grid grid-cols-2 gap-10">

            <div>
              <p className="text-sm font-medium mb-3">
                Start Date
              </p>

              <DayPicker
                mode="single"
                selected={tempStart}
                onSelect={setTempStart}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2035}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-3">
                End Date
              </p>

              <DayPicker
                mode="single"
                selected={tempEnd}
                onSelect={setTempEnd}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2035}
              />
            </div>

          </div>

          <div className="flex justify-end gap-3 mt-6">

            <button
              onClick={cancelDates}
              className="px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              onClick={applyDates}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
            >
              Apply
            </button>

          </div>

        </div>
      )}
    </div>
  );
}

export default DateRangePicker;