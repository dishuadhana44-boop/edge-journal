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

function DateRangePicker() {
  const popupRef = useRef(null);

  const [open, setOpen] = useState(false);

  const [tempStart, setTempStart] = useState(new Date(2025, 4, 1));
  const [tempEnd, setTempEnd] = useState(new Date(2025, 4, 29));

  const [startDate, setStartDate] = useState(new Date(2025, 4, 1));
  const [endDate, setEndDate] = useState(new Date(2025, 4, 29));

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
    setOpen(false);
  };

  const cancelDates = () => {
    setTempStart(startDate);
    setTempEnd(endDate);
    setOpen(false);
  };

  const presetButtonClass = (preset) =>
    activePreset === preset
      ? "px-5 py-2.5 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 font-semibold transition"
      : "px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition";

      const selectToday = () => {
        const today = new Date();
      
        setTempStart(today);
        setTempEnd(today);
      
        setActivePreset("today");
      };
  
  const select1Week = () => {
    const end = new Date();
    const start = subDays(end, 6);
  
    setTempStart(start);
    setTempEnd(end);

    setActivePreset("1w");
  };
  
  const select2Weeks = () => {
    const end = new Date();
    const start = subDays(end, 13);
  
    setTempStart(start);
    setTempEnd(end);

    setActivePreset("2w");
  };
  
  const select1Month = () => {
    const today = new Date();
  
    setTempStart(startOfMonth(today));
    setTempEnd(endOfMonth(today));

    setActivePreset("1m");
  };
  
  const selectAll = () => {
    setTempStart(new Date(2020, 0, 1));
    setTempEnd(new Date());

    setActivePreset("all");
  };

  
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

<div className="flex items-center gap-3">

  <button
  onClick={selectToday}
  className={presetButtonClass("today")}
>
  Today
</button>

<button
  onClick={select1Week}
  className={presetButtonClass("1w")}
  >
  1W
</button>

<button
  onClick={select2Weeks}
  className={presetButtonClass("2w")}
  >
  2W
</button>

<button
  onClick={select1Month}
  className={presetButtonClass("1m")}
  >
  1M
</button>

<button
  onClick={selectAll}
  className={presetButtonClass("all")}
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