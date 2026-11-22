import {
  Check,
  ChevronDown,
  Columns3,
  Filter,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

import { canToggleColumnOff } from "../columns";

// ============================================================
// POSITIONS TOOLBAR
// Instant search + per-tab filter + symbol filter +
// column show/hide (persisted) + per-tab bulk action
// (close all / cancel all) + manual refresh.
// ============================================================

const MENU_CLASS = `
  absolute
  right-0
  top-full
  z-50
  mt-2
  w-56
  overflow-hidden
  rounded-xl
  border
  border-gray-200
  bg-white
  shadow-xl
  dark:border-gray-700
  dark:bg-gray-800
`;

const MENU_BUTTON_CLASS = `
  flex
  w-full
  items-center
  justify-between
  gap-2
  px-3.5
  py-2.5
  text-left
  text-sm
  text-gray-700
  transition
  hover:bg-gray-50
  dark:text-gray-300
  dark:hover:bg-gray-700/60
`;

export default function PositionsToolbar({
  search = "",
  onSearchChange,
  filter = "all",
  onFilterChange,
  filterOptions = [],
  symbols = [],
  symbolFilter = "all",
  onSymbolFilterChange,
  columns = [],
  visibleKeys = new Set(),
  onToggleColumn,
  onRestoreColumns,
  bulkAction = null,
  onRefresh,
  refreshing = false,
}) {
  const [openMenu, setOpenMenu] = useState(null);

  const filterRef = useRef(null);
  const symbolRef = useRef(null);
  const columnsRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;

    const handleOutsideClick = (event) => {
      const refs = [filterRef, symbolRef, columnsRef];

      const clickedInside = refs.some(
        (ref) => ref.current && ref.current.contains(event.target)
      );

      if (!clickedInside) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openMenu]);

  const activeFilterLabel =
    filterOptions.find((option) => option.value === filter)
      ?.label || "All";

  const toggleMenu = (menu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const renderMenuButton = (icon, label) => (
    <>
      {icon}

      <span className="hidden whitespace-nowrap lg:inline">{label}</span>

      <ChevronDown size={14} className="shrink-0 opacity-60" />
    </>
  );

  const toolButtonClass = (active) => `
    flex
    items-center
    gap-1.5
    rounded-xl
    border
    px-2.5
    py-2
    text-xs
    font-medium
    transition
    ${
      active
        ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300"
        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    }
  `;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      {/* SEARCH */}

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />

        <input
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Search symbol, ticket, broker…"
          className="
            w-72
            rounded-xl
            border
            border-gray-200
            bg-white
            py-2
            pl-9
            pr-8
            text-sm
            text-gray-900
            outline-none
            transition
            placeholder:text-gray-400
            focus:border-violet-500
            dark:border-gray-600
            dark:bg-gray-800
            dark:text-gray-100
            dark:placeholder:text-gray-500
          "
        />

        {search && (
          <button
            type="button"
            onClick={() => onSearchChange?.("")}
            title="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* TOOL BUTTONS */}

      <div className="flex flex-wrap items-center gap-2">
        {/* FILTER DROPDOWN */}

        {filterOptions.length > 0 && (
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => toggleMenu("filter")}
              className={toolButtonClass(filter !== "all" || openMenu === "filter")}
            >
              {renderMenuButton(<Filter size={15} />, activeFilterLabel)}
            </button>

            {openMenu === "filter" && (
              <div className={MENU_CLASS}>
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onFilterChange?.(option.value);
                      setOpenMenu(null);
                    }}
                    className={MENU_BUTTON_CLASS}
                  >
                    <span>{option.label}</span>

                    {filter === option.value && (
                      <Check size={14} className="text-violet-600 dark:text-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SYMBOL DROPDOWN */}

        {symbols.length > 1 && (
          <div ref={symbolRef} className="relative">
            <button
              type="button"
              onClick={() => toggleMenu("symbol")}
              className={toolButtonClass(
                symbolFilter !== "all" || openMenu === "symbol"
              )}
            >
              {renderMenuButton(
                <span className="font-semibold">Σ</span>,
                symbolFilter === "all" ? "All Symbols" : symbolFilter
              )}
            </button>

            {openMenu === "symbol" && (
              <div className={`${MENU_CLASS} max-h-72 overflow-y-auto`}>
                <button
                  type="button"
                  onClick={() => {
                    onSymbolFilterChange?.("all");
                    setOpenMenu(null);
                  }}
                  className={MENU_BUTTON_CLASS}
                >
                  <span>All Symbols</span>

                  {symbolFilter === "all" && (
                    <Check size={14} className="text-violet-600 dark:text-violet-400" />
                  )}
                </button>

                {symbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => {
                      onSymbolFilterChange?.(symbol);
                      setOpenMenu(null);
                    }}
                    className={MENU_BUTTON_CLASS}
                  >
                    <span>{symbol}</span>

                    {symbolFilter === symbol && (
                      <Check size={14} className="text-violet-600 dark:text-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COLUMNS DROPDOWN */}

        <div ref={columnsRef} className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("columns")}
            className={toolButtonClass(openMenu === "columns")}
            title="Show / hide columns"
          >
            {renderMenuButton(<Columns3 size={15} />, "Columns")}
          </button>

          {openMenu === "columns" && (
            <div className={`${MENU_CLASS} w-64`}>
              <div className="max-h-72 overflow-y-auto py-1">
                {columns.map((column) => {
                  if (!column.label) return null;

                  const isVisible = visibleKeys.has(column.key);

                  const disableHide =
                    isVisible &&
                    column.hideable &&
                    !canToggleColumnOff(columns, visibleKeys, column.key);

                  return (
                    <label
                      key={column.key}
                      className={`
                        flex
                        cursor-pointer
                        items-center
                        gap-2.5
                        px-3.5
                        py-2
                        text-sm
                        transition
                        ${
                          column.hideable
                            ? "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60"
                            : "cursor-not-allowed text-gray-400 dark:text-gray-500"
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={!column.hideable || disableHide}
                        onChange={() => onToggleColumn?.(column.key)}
                        className="h-3.5 w-3.5 accent-violet-600"
                      />

                      <span className="flex-1">{column.label}</span>

                      {column.sortable && (
                        <span className="text-[10px] uppercase text-gray-400 dark:text-gray-500">
                          sortable
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    onRestoreColumns?.();
                    setOpenMenu(null);
                  }}
                  className="
                    w-full
                    px-3.5
                    py-2.5
                    text-left
                    text-xs
                    font-semibold
                    text-violet-600
                    transition
                    hover:bg-violet-50
                    dark:text-violet-400
                    dark:hover:bg-violet-500/10
                  "
                >
                  Restore Default Columns
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BULK ACTION — close all (open tab) / cancel all (pending tab) */}

        {bulkAction && (
          <button
            type="button"
            onClick={bulkAction.onClick}
            disabled={bulkAction.disabled}
            title={bulkAction.title || bulkAction.label}
            className={`
              flex
              items-center
              gap-1.5
              whitespace-nowrap
              rounded-xl
              border
              border-red-200
              bg-white
              px-2.5
              py-2
              text-xs
              font-semibold
              text-red-600
              transition
              hover:bg-red-50
              disabled:cursor-not-allowed
              disabled:border-gray-200
              disabled:bg-gray-50
              disabled:text-gray-400
              disabled:hover:bg-gray-50
              dark:border-red-900
              dark:bg-gray-800
              dark:text-red-400
              dark:hover:bg-red-950/40
              dark:disabled:border-gray-600
              dark:disabled:bg-gray-800
              dark:disabled:text-gray-500
              dark:disabled:hover:bg-gray-800
            `}
          >
            <Trash2 size={15} />
            {bulkAction.label}
          </button>
        )}

        {/* REFRESH */}

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh positions from broker"
          className={`
            ${toolButtonClass(false)}
            disabled:cursor-not-allowed
            disabled:opacity-60
          `}
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
