import { useState, useRef, useEffect } from "react";
import { Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, differenceInCalendarDays } from "date-fns";

import "react-day-picker/dist/style.css";
import "./DateRangePicker.css";

import { useDashboardFilter } from "../../context/DashboardFilterContext";
import { getDateRange, DATE_FILTERS } from "../../utils/dateRangeUtils";

// react-day-picker v10 bounds the month navigation and the year dropdown with
// startMonth/endMonth — fromYear/toYear are no longer read by the library.
const MIN_MONTH = new Date(2000, 0, 1);
const MAX_MONTH = new Date(2035, 11, 1);

const RANGE_PRESETS = [
  DATE_FILTERS.TODAY,
  DATE_FILTERS.ONE_WEEK,
  DATE_FILTERS.TWO_WEEKS,
  DATE_FILTERS.ONE_MONTH,
  DATE_FILTERS.ALL,
];

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

// The dashboard can be re-ranged from the header quick filters while this popup
// is closed, so re-sync the draft dates from the applied range on every open.
useEffect(() => {
  if (!open) return;

  setTempStart(startDate);
  setTempEnd(endDate);
}, [open, startDate, endDate]);

const applyQuickFilter = (filter) => {

  const range = getDateRange(filter);

  setSelectedFilter(filter);

  setStartDate(range.startDate);

  setEndDate(range.endDate);

  setTempStart(range.startDate);

  setTempEnd(range.endDate);

};


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

  const rangeDays = differenceInCalendarDays(tempEnd, tempStart) + 1;
  const rangeSummary = `${format(tempStart, "dd MMM yyyy")} → ${format(
    tempEnd,
    "dd MMM yyyy"
  )} · ${rangeDays} day${rangeDays === 1 ? "" : "s"}`;

  // Visual-only: shades the days between the two draft endpoints.
  const rangeModifiers = { range: [{ after: tempStart, before: tempEnd }] };
  const rangeClassNames = { range: "dp-range" };

  
  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-purple-500 transition"
      >
        <Calendar size={15} className="text-purple-600 shrink-0" />

        <span className="text-[13px] font-medium whitespace-nowrap text-gray-700">
          {format(startDate, "dd MMM yyyy")}
          {" — "}
          {format(endDate, "dd MMM yyyy")}
        </span>
      </button>

      {open && (
        <div className="date-popup absolute right-0 mt-3 w-[650px] max-w-[92vw] z-[9999]">

          <div className="dp-head">

            <div>
              <h2 className="dp-title">Select Date Range</h2>
              <p className="dp-meta" title={rangeSummary}>{rangeSummary}</p>
            </div>

            <div className="dp-presets">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-active={selectedFilter === preset}
                  className="dp-preset"
                  onClick={() => applyQuickFilter(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

          </div>

          <div className="dp-calendars">

            <div className="dp-calendar">
              <div className="dp-calendar-head">
                <span className="dp-calendar-label">Start Date</span>
                <span className="dp-calendar-value">
                  {format(tempStart, "dd MMM yyyy")}
                </span>
              </div>

              <DayPicker
                key={`start-${format(tempStart, "yyyy-MM")}`}
                mode="single"
                selected={tempStart}
                onSelect={(day) => day && setTempStart(day)}
                defaultMonth={tempStart}
                captionLayout="dropdown"
                navLayout="around"
                startMonth={MIN_MONTH}
                endMonth={MAX_MONTH}
                disabled={[{ after: tempEnd }]}
                modifiers={rangeModifiers}
                modifiersClassNames={rangeClassNames}
              />
            </div>

            <div className="dp-calendar dp-calendar--end">
              <div className="dp-calendar-head">
                <span className="dp-calendar-label">End Date</span>
                <span className="dp-calendar-value">
                  {format(tempEnd, "dd MMM yyyy")}
                </span>
              </div>

              <DayPicker
                key={`end-${format(tempEnd, "yyyy-MM")}`}
                mode="single"
                selected={tempEnd}
                onSelect={(day) => day && setTempEnd(day)}
                defaultMonth={tempEnd}
                captionLayout="dropdown"
                navLayout="around"
                startMonth={MIN_MONTH}
                endMonth={MAX_MONTH}
                disabled={[{ before: tempStart }]}
                modifiers={rangeModifiers}
                modifiersClassNames={rangeClassNames}
              />
            </div>

          </div>

          <div className="dp-foot">

            <div className="dp-legend">
              <span className="dp-legend-item">
                <span className="dp-swatch dp-swatch--today" />
                Today
              </span>
              <span className="dp-legend-item">
                <span className="dp-swatch dp-swatch--selected" />
                Selected
              </span>
              <span className="dp-legend-item">
                <span className="dp-swatch dp-swatch--range" />
                In range
              </span>
            </div>

            <div className="dp-actions">

              <button
                type="button"
                onClick={cancelDates}
                className="dp-btn dp-btn--ghost"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={applyDates}
                className="dp-btn dp-btn--primary"
              >
                Apply
              </button>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}

export default DateRangePicker;