import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { SECTION_GROUPS, DASHBOARD_SECTIONS } from "../../../utils/dashboardSections";
import { useDashboardFilter } from "../../../context/DashboardFilterContext";

export default function SectionFilterMenu() {
  const { sections, toggleSection, resetSections } = useDashboardFilter();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const visibleCount = DASHBOARD_SECTIONS.filter(
    (section) => sections[section.key]
  ).length;

  const groupCounts = useMemo(() => {
    const counts = {};

    Object.entries(SECTION_GROUPS).forEach(([group, items]) => {
      counts[group] = `${items.filter((section) => sections[section.key]).length}/${
        items.length
      }`;
    });

    return counts;
  }, [sections]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-600 whitespace-nowrap hover:border-violet-300 hover:bg-violet-50 transition"
      >
        <SlidersHorizontal size={15} />

        Filter

        <span className="text-gray-400">
          {visibleCount}/{DASHBOARD_SECTIONS.length}
        </span>

        <span className="text-[10px] leading-none">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] rounded-xl border border-gray-200 bg-white shadow-xl z-[999]">
          <p className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Dashboard Sections
          </p>

          <div className="max-h-[65vh] overflow-y-auto px-2 pb-1">
            {Object.entries(SECTION_GROUPS).map(([group, items]) => (
              <div key={group} className="pb-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                    {group}
                  </p>

                  <p className="text-[10px] text-gray-400">{groupCounts[group]}</p>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50/60 py-1">
                  {items.map((section) => (
                    <label
                      key={section.key}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sections[section.key]}
                        onChange={() => toggleSection(section.key)}
                        className="w-4 h-4 accent-violet-600"
                      />

                      <span className="truncate">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-2">
            <button
              type="button"
              onClick={resetSections}
              className="w-full py-2 rounded-lg text-sm font-medium text-violet-600 hover:bg-violet-50 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
