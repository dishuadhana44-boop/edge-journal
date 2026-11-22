import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";

// ============================================================
// SHARED POSITIONS TABLE SHELL
// Renders the sticky sortable header, select-all checkbox,
// skeleton loading rows, error / empty / no-match states and
// delegates row rendering to the tab-specific tables.
// ============================================================

const SKELETON_ROW_COUNT = 6;

function columnWidthPx(column) {
  const match = String(column.width || "").match(/\d+/);
  return match ? Number(match[0]) : 90;
}

function alignClass(align) {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}

export default function PositionsTableShell({
  columns = [],
  visibleKeys = new Set(),
  sort = null,
  onSortChange,
  rows = [],
  totalRows = 0,
  loading = false,
  error = null,
  onRetry,
  hasActiveFilters = false,
  onClearFilters,
  allSelected = false,
  someSelected = false,
  onToggleSelectAll,
  renderRow,
  emptyLabel = "No data",
  emptyHint = "",
}) {
  const visibleColumns = columns.filter((column) =>
    visibleKeys.has(column.key)
  );

  const minWidth = visibleColumns.reduce(
    (sum, column) => sum + columnWidthPx(column),
    0
  );

  const colSpan = visibleColumns.length || 1;

  const renderHeaderCell = (column) => {
    const alignment = alignClass(column.align);

    const baseClass = `
      px-3
      py-2.5
      text-[11px]
      font-semibold
      uppercase
      tracking-wider
      text-gray-500
      whitespace-nowrap
      dark:text-gray-400
      ${column.width}
      ${alignment}
    `;

    if (column.key === "select" && onToggleSelectAll) {
      return (
        <th key={column.key} className={`${baseClass} px-3`}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(element) => {
              if (element) {
                element.indeterminate = someSelected && !allSelected;
              }
            }}
            onChange={onToggleSelectAll}
            title="Select all visible positions"
            className="h-3.5 w-3.5 accent-violet-600"
          />
        </th>
      );
    }

    if (column.sortable && typeof onSortChange === "function") {
      const isActive = sort?.key === column.key;

      return (
        <th key={column.key} className={baseClass}>
          <button
            type="button"
            onClick={() => onSortChange(column.key)}
            title={`Sort by ${column.label}`}
            className={`
              inline-flex
              items-center
              gap-1
              transition
              hover:text-gray-800
              dark:hover:text-gray-200
              ${isActive ? "text-violet-600 dark:text-violet-400" : ""}
            `}
          >
            {column.label}

            {isActive ? (
              sort.direction === "asc" ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )
            ) : (
              <ArrowUpDown size={11} className="opacity-30" />
            )}
          </button>
        </th>
      );
    }

    return (
      <th key={column.key} className={baseClass}>
        {column.label}
      </th>
    );
  };

  const renderSkeletonBody = () => (
    <tbody className="bg-white dark:bg-gray-900">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
        <tr
          key={`skeleton-${rowIndex}`}
          className="border-b border-gray-100 dark:border-gray-800"
        >
          {visibleColumns.map((column) => (
            <td
              key={column.key}
              className={`px-3 py-3.5 ${alignClass(column.align)}`}
            >
              <div
                className="
                  h-3
                  animate-pulse
                  rounded
                  bg-gray-200
                  dark:bg-gray-700
                "
                style={{ width: "55%", margin: column.align === "right" ? "0 0 0 auto" : undefined }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  const renderEmptyBody = (label, hint, showClear) => (
    <tbody className="bg-white dark:bg-gray-900">
      <tr>
        <td colSpan={colSpan} className="py-14 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}
          </p>

          {hint && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {hint}
            </p>
          )}

          {showClear && typeof onClearFilters === "function" && (
            <button
              type="button"
              onClick={onClearFilters}
              className="
                mt-4
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-gray-200
                px-3
                py-1.5
                text-xs
                font-medium
                text-gray-600
                transition
                hover:bg-gray-50
                dark:border-gray-600
                dark:text-gray-300
                dark:hover:bg-gray-800
              "
            >
              <RotateCcw size={13} />
              Clear Search &amp; Filters
            </button>
          )}
        </td>
      </tr>
    </tbody>
  );

  const showSkeleton = loading && totalRows === 0;
  const showEmpty = !loading && !error && totalRows === 0;
  const showNoMatch =
    !loading && totalRows > 0 && rows.length === 0;

  return (
    <div className="h-[340px] overflow-y-auto overflow-x-auto">
      <table
        className="w-full text-sm"
        style={{ minWidth: `${minWidth}px` }}
      >
        <thead
          className="
            sticky
            top-0
            z-10
            border-b
            border-gray-200
            bg-gray-50
            dark:border-gray-700
            dark:bg-gray-800
          "
        >
          <tr>{visibleColumns.map(renderHeaderCell)}</tr>
        </thead>

        {error ? (
          <>
            {totalRows > 0 ? (
              <tbody className="bg-white dark:bg-gray-900">
                {rows.flatMap((row) => renderRow?.(row) || [])}
              </tbody>
            ) : null}

            <tbody>
              <tr>
                <td colSpan={colSpan} className="p-4">
                  <div
                    className="
                      flex
                      flex-wrap
                      items-center
                      justify-between
                      gap-3
                      rounded-xl
                      border
                      border-red-200
                      bg-red-50
                      px-4
                      py-3
                      dark:border-red-800
                      dark:bg-red-950/40
                    "
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle
                        size={16}
                        className="shrink-0 text-red-600 dark:text-red-400"
                      />

                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    </div>

                    {typeof onRetry === "function" && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="
                          rounded-lg
                          bg-red-600
                          px-3
                          py-1.5
                          text-xs
                          font-semibold
                          text-white
                          transition
                          hover:bg-red-700
                        "
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </>
        ) : showSkeleton ? (
          renderSkeletonBody()
        ) : showEmpty ? (
          renderEmptyBody(emptyLabel, emptyHint, false)
        ) : showNoMatch ? (
          renderEmptyBody(
            "No results match your search or filters",
            "Try a different symbol, ticket or filter.",
            hasActiveFilters
          )
        ) : (
          <tbody className="bg-white dark:bg-gray-900">
            {rows.flatMap((row) => renderRow?.(row) || [])}
          </tbody>
        )}
      </table>
    </div>
  );
}
