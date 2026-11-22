import PositionsTableShell from "./PositionsTableShell";
import OpenPositionRow from "../rows/OpenPositionRow";
import ExpandedDetailsRow from "../rows/ExpandedDetailsRow";

// ============================================================
// OPEN POSITIONS TABLE
// Presentational wrapper around the shared shell. All data,
// filtering and broker actions come from PositionTerminal.
// ============================================================

export default function OpenPositionsTable({
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
  selectedKeys = new Set(),
  onToggleSelect,
  expandedKeys = new Set(),
  onToggleExpand,
  onAction,
  currency = "USD",
  nowMs = null,
}) {
  const columnCount = columns.filter((column) =>
    visibleKeys.has(column.key)
  ).length;

  const renderRow = (row) => {
    const expanded = expandedKeys.has(row.key);

    const nodes = [
      <OpenPositionRow
        key={row.key}
        row={row}
        columns={columns}
        visibleKeys={visibleKeys}
        selected={selectedKeys.has(row.key)}
        onToggleSelect={onToggleSelect}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onAction={onAction}
        currency={currency}
        nowMs={nowMs}
      />,
    ];

    if (expanded) {
      nodes.push(
        <ExpandedDetailsRow
          key={`${row.key}-details`}
          row={row}
          tab="open"
          columnCount={columnCount}
          currency={currency}
          nowMs={nowMs}
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
      allSelected={allSelected}
      someSelected={someSelected}
      onToggleSelectAll={onToggleSelectAll}
      renderRow={renderRow}
      emptyLabel="No open positions"
      emptyHint="Positions from your connected broker account appear here."
    />
  );
}
