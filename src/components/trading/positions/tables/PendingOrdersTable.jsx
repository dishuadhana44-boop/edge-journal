import PositionsTableShell from "./PositionsTableShell";
import PendingOrderRow from "../rows/PendingOrderRow";
import ExpandedDetailsRow from "../rows/ExpandedDetailsRow";

// ============================================================
// PENDING ORDERS TABLE
// Presentational wrapper around the shared shell.
// ============================================================

export default function PendingOrdersTable({
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
      <PendingOrderRow
        key={row.key}
        row={row}
        columns={columns}
        visibleKeys={visibleKeys}
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
          tab="pending"
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
      renderRow={renderRow}
      emptyLabel="No pending orders"
      emptyHint="Pending orders from your connected broker account appear here."
    />
  );
}
