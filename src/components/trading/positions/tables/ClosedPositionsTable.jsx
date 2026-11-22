import PositionsTableShell from "./PositionsTableShell";
import ClosedPositionRow from "../rows/ClosedPositionRow";
import ExpandedDetailsRow from "../rows/ExpandedDetailsRow";

// ============================================================
// CLOSED POSITIONS TABLE
// Presentational wrapper around the shared shell. Details are
// shown by expanding a row — closed trades have no actions.
// ============================================================

export default function ClosedPositionsTable({
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
  expandedKeys = new Set(),
  onToggleExpand,
  currency = "USD",
}) {
  const columnCount = columns.filter((column) =>
    visibleKeys.has(column.key)
  ).length;

  const renderRow = (row) => {
    const expanded = expandedKeys.has(row.key);

    const nodes = [
      <ClosedPositionRow
        key={row.key}
        row={row}
        columns={columns}
        visibleKeys={visibleKeys}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        currency={currency}
      />,
    ];

    if (expanded) {
      nodes.push(
        <ExpandedDetailsRow
          key={`${row.key}-details`}
          row={row}
          tab="closed"
          columnCount={columnCount}
          currency={currency}
        />
      );
    }

    return nodes;
  };

  return (
    <PositionsTableShell
      columns={columns}
      visibleKeys={visibleKeys}
      sort={sort}
      onSortChange={onSortChange}
      rows={rows}
      totalRows={totalRows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      renderRow={renderRow}
      emptyLabel="No closed positions"
      emptyHint="Closed trades appear here once they are settled by the broker."
    />
  );
}
