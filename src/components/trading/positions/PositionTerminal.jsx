import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTrade } from "../../../context/TradeContext";

import PositionsTabs from "./header/PositionsTabs";
import PositionsStats from "./header/PositionsStats";
import PositionsToolbar from "./header/PositionsToolbar";

import OpenPositionsTable from "./tables/OpenPositionsTable";
import PendingOrdersTable from "./tables/PendingOrdersTable";
import ClosedPositionsTable from "./tables/ClosedPositionsTable";

import ActionConfirmDialog from "./dialogs/ActionConfirmDialog";
import ModifyValueDialog from "./dialogs/ModifyValueDialog";

import {
  TAB_COLUMNS,
  TAB_FILTERS,
  canToggleColumnOff,
  defaultColumnKeys,
  loadVisibleColumns,
  saveVisibleColumns,
} from "./columns";

import {
  applyViewFilters,
  deriveClosedPosition,
  deriveOpenPosition,
  derivePendingOrder,
  formatPrice,
  formatSignedMoney,
} from "./shared";

// ============================================================
// POSITION TERMINAL
// Single state container for the OPEN / PENDING / CLOSED tabs.
// All broker actions are wired here and every dialog only
// reports success after the backend confirms it.
// ============================================================

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function PositionTerminal() {
  const {
    openTrades = [],
    pendingOrders = [],
    closedTrades = [],
    account,
    closeTrade,
    partialCloseTrade,
    modifyStopLoss,
    modifyTakeProfit,
    cancelPendingOrder,
    modifyPendingOrderEntry,
    modifyPendingOrderStopLoss,
    modifyPendingOrderTakeProfit,
    syncMT5Positions,
    getCurrentBrokerTimeMsc,
  } = useTrade();

  // --------------------------------------------------------
  // VIEW STATE
  // --------------------------------------------------------

  const [activeTab, setActiveTab] = useState("open");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [sort, setSort] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [dialog, setDialog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState(() => ({
    open: loadVisibleColumns("open", TAB_COLUMNS.open),
    pending: loadVisibleColumns("pending", TAB_COLUMNS.pending),
    closed: loadVisibleColumns("closed", TAB_COLUMNS.closed),
  }));

  const currency = account?.currency || "USD";
  const brokerLabel = account?.broker || "";

  // Mirrored through a ref so the sync effects stay independent of the
  // account object identity, which changes on every account poll.
  const accountRef = useRef(account);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  // Single clock source for live durations: the existing broker
  // clock estimate (client clock as fallback). Rows refresh with
  // the 2000ms polling that already runs in TradeContext.

  const nowMs =
    (typeof getCurrentBrokerTimeMsc === "function"
      ? getCurrentBrokerTimeMsc()
      : null) ?? Date.now();

  // --------------------------------------------------------
  // INITIAL SYNC STATE (skeleton + error with retry)
  // The 2000ms broker polling already lives in TradeContext,
  // so this is only a one-time sync for honest loading/error
  // states — never a second polling loop.
  // --------------------------------------------------------

  const [syncState, setSyncState] = useState({
    loading: true,
    error: null,
  });

  // TradeContext swallows bridge errors inside syncMT5Positions(): it
  // resolves to [] whether the account is empty or the bridge is down.
  // When it returns nothing, the existing /api/mt5/status endpoint
  // (already used by Settings > Broker Integration) decides between an
  // honest empty state and an error + retry. Checked once per sync
  // attempt, so this is not a second polling loop.

  const isMt5AccountSelected = useCallback(() => {
    const broker = accountRef.current;

    const label = `${broker?.broker || ""} ${broker?.accountType || ""}`.toUpperCase();

    return (
      label.includes("MT5") ||
      broker?.mt5Connected === true ||
      broker?.mt5Login != null ||
      broker?.mt5Server != null
    );
  }, []);

  const assertBridgeOnline = useCallback(async () => {
    let online = false;

    try {
      const response = await fetch(`${API_URL}/api/mt5/status`, {
        method: "GET",
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        online = data?.connected === true;
      }
    } catch {
      online = false;
    }

    if (!online) {
      throw new Error(
        "The MT5 bridge is not reachable, so positions could not be loaded. Check that the bridge and terminal are running."
      );
    }
  }, []);

  const refreshPositions = useCallback(async () => {
    if (typeof syncMT5Positions !== "function") {
      throw new Error("Broker position sync is not available.");
    }

    const result = await syncMT5Positions();

    if (!Array.isArray(result)) {
      throw new Error("The broker did not return a positions list.");
    }

    if (result.length > 0 || !isMt5AccountSelected()) return;

    await assertBridgeOnline();
  }, [assertBridgeOnline, isMt5AccountSelected, syncMT5Positions]);

  const runInitialSync = useCallback(async () => {
    setSyncState({ loading: true, error: null });

    try {
      await refreshPositions();
      setSyncState({ loading: false, error: null });
    } catch (syncError) {
      setSyncState({
        loading: false,
        error:
          syncError?.message ||
          "Failed to sync positions from the broker.",
      });
    }
  }, [refreshPositions]);

  useEffect(() => {
    runInitialSync();
  }, [runInitialSync]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      await refreshPositions();
      setSyncState((prev) => ({ ...prev, error: null }));
    } catch (refreshError) {
      setSyncState((prev) => ({
        ...prev,
        error:
          refreshError?.message ||
          "Failed to sync positions from the broker.",
      }));
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshPositions]);

  // --------------------------------------------------------
  // DERIVED ROW MODELS
  // --------------------------------------------------------

  const openRows = useMemo(
    () => openTrades.map((trade, index) => deriveOpenPosition(trade, index)),
    [openTrades]
  );

  const pendingRows = useMemo(
    () =>
      pendingOrders.map((order, index) => derivePendingOrder(order, index)),
    [pendingOrders]
  );

  const closedRows = useMemo(
    () =>
      closedTrades.map((trade, index) => deriveClosedPosition(trade, index)),
    [closedTrades]
  );

  const currentRows =
    activeTab === "open"
      ? openRows
      : activeTab === "pending"
      ? pendingRows
      : closedRows;

  const visibleRows = useMemo(
    () =>
      applyViewFilters(currentRows, {
        tab: activeTab,
        search,
        filter,
        symbolFilter,
        sort,
      }),
    [currentRows, activeTab, search, filter, symbolFilter, sort]
  );

  const symbols = useMemo(
    () =>
      [...new Set(currentRows.map((row) => row.symbol))].sort((a, b) =>
        String(a).localeCompare(String(b))
      ),
    [currentRows]
  );

  const hasActiveFilters =
    search.trim() !== "" || filter !== "all" || symbolFilter !== "all";

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setFilter("all");
    setSymbolFilter("all");
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setFilter("all");
    setSymbolFilter("all");
    setSort(null);
  }, []);

  // --------------------------------------------------------
  // SORTING + COLUMN VISIBILITY
  // --------------------------------------------------------

  const handleSortChange = useCallback((key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: "asc" };
      }

      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }

      return null;
    });
  }, []);

  const handleToggleColumn = useCallback(
    (key) => {
      setVisibleColumns((prev) => {
        const current = prev[activeTab];

        const next = new Set(current);

        if (next.has(key)) {
          if (
            !canToggleColumnOff(TAB_COLUMNS[activeTab], current, key)
          ) {
            return prev;
          }

          next.delete(key);
        } else {
          next.add(key);
        }

        saveVisibleColumns(activeTab, next);

        return { ...prev, [activeTab]: next };
      });
    },
    [activeTab]
  );

  const handleRestoreColumns = useCallback(() => {
    setVisibleColumns((prev) => {
      const next = defaultColumnKeys(activeTab);

      saveVisibleColumns(activeTab, next);

      return { ...prev, [activeTab]: next };
    });
  }, [activeTab]);

  // --------------------------------------------------------
  // SELECTION (OPEN TAB)
  // --------------------------------------------------------

  useEffect(() => {
    setSelectedKeys((prev) => {
      if (prev.size === 0) return prev;

      const valid = new Set(openRows.map((row) => row.key));

      const next = new Set([...prev].filter((key) => valid.has(key)));

      return next.size === prev.size ? prev : next;
    });
  }, [openRows]);

  const selectedRows = useMemo(
    () => visibleRows.filter((row) => selectedKeys.has(row.key)),
    [visibleRows, selectedKeys]
  );

  const allSelected =
    activeTab === "open" &&
    visibleRows.length > 0 &&
    visibleRows.every((row) => selectedKeys.has(row.key));

  const handleToggleSelectAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);

      if (visibleRows.length > 0 && visibleRows.every((row) => next.has(row.key))) {
        for (const row of visibleRows) {
          next.delete(row.key);
        }
      } else {
        for (const row of visibleRows) {
          next.add(row.key);
        }
      }

      return next;
    });
  }, [visibleRows]);

  const handleToggleSelect = useCallback((key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  // --------------------------------------------------------
  // EXPANDABLE DETAILS
  // --------------------------------------------------------

  const handleToggleExpand = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }, []);

  // --------------------------------------------------------
  // BROKER ACTIONS
  // Every handler THROWS on failure so the dialogs can only
  // reach their success phase after a real backend success.
  // --------------------------------------------------------

  const rowTradeId = (row) => String(row?.raw?.id ?? row?.key);

  const closePositionRow = useCallback(
    async (row) => {
      const ticket = Number(row?.ticket);

      // MT5 — real broker close via the existing bridge endpoint.

      if (row?.broker === "MT5") {
        if (!Number.isInteger(ticket) || ticket <= 0) {
          throw new Error(`Invalid MT5 position ticket: ${row?.ticket}`);
        }

        const response = await fetch(
          `${API_URL}/api/mt5/close-position`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticket,
              volume: row.lots,
            }),
          }
        );

        let data;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok || data?.success !== true) {
          throw new Error(
            data?.message ||
              data?.error ||
              "MT5 rejected the close request."
          );
        }

        // Refresh local state through the existing sync (the
        // 2000ms polling also covers this — fire and forget).

        syncMT5Positions().catch(() => {});

        return data;
      }

      // cTrader / paper — existing context action.
      // closeTrade returns null on ANY failure → must throw.

      const result = await closeTrade(rowTradeId(row));

      if (!result) {
        throw new Error("The broker rejected the close request.");
      }

      return result;
    },
    [closeTrade, syncMT5Positions]
  );

  const partialClosePositionRow = useCallback(
    async (row, closeVolume) => {
      const ticket = Number(row?.ticket);

      // MT5 — real partial close: the bridge closes the given
      // volume against the position ticket.

      if (row?.broker === "MT5") {
        if (!Number.isInteger(ticket) || ticket <= 0) {
          throw new Error(`Invalid MT5 position ticket: ${row?.ticket}`);
        }

        const response = await fetch(
          `${API_URL}/api/mt5/close-position`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticket,
              volume: closeVolume,
            }),
          }
        );

        let data;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok || data?.success !== true) {
          throw new Error(
            data?.message ||
              data?.error ||
              "MT5 rejected the partial close request."
          );
        }

        syncMT5Positions().catch(() => {});

        return data;
      }

      // cTrader / paper — existing context action.
      // Returns null on invalid input / missing trade.

      const result = await partialCloseTrade(
        rowTradeId(row),
        closeVolume
      );

      if (!result) {
        throw new Error(
          "Unable to partially close this position."
        );
      }

      return result;
    },
    [partialCloseTrade, syncMT5Positions]
  );

  const modifyOpenStopLoss = useCallback(
    async (row, price) => {
      // modifyStopLoss THROWS on broker rejection.

      await modifyStopLoss(rowTradeId(row), price);
    },
    [modifyStopLoss]
  );

  const modifyOpenTakeProfit = useCallback(
    async (row, price) => {
      // modifyTakeProfit THROWS on broker rejection.

      await modifyTakeProfit(rowTradeId(row), price);
    },
    [modifyTakeProfit]
  );

  const cancelPendingOrderRow = useCallback(
    async (row) => {
      // cancelPendingOrder returns { success:false, error }
      // instead of throwing → convert to a thrown error.

      const result = await cancelPendingOrder(row?.raw);

      if (!result || result?.success === false) {
        throw new Error(
          result?.error || "Failed to cancel pending order."
        );
      }

      return result;
    },
    [cancelPendingOrder]
  );

  const runPendingModify = useCallback(
    async (modifyFn, row, value, fallbackMessage) => {
      // modifyPendingOrder* return null or { success:false, error }

      const result = await modifyFn(row?.raw, value);

      if (!result || result?.success === false) {
        throw new Error(result?.error || fallbackMessage);
      }

      return result;
    },
    []
  );

  const bulkCloseRows = useCallback(
    async (rows) => {
      // No close-all endpoint exists on either broker, so this is a
      // sequential loop with ticket dedup — never a duplicate close
      // request for the same position.

      const seenTickets = new Set();
      let closed = 0;
      const failures = [];

      for (const row of rows) {
        const dedupeKey = `${row.broker}-${row.ticket}`;

        if (seenTickets.has(dedupeKey)) continue;
        seenTickets.add(dedupeKey);

        try {
          await closePositionRow(row);
          closed += 1;
        } catch (closeError) {
          failures.push({
            symbol: row.symbol,
            error: closeError?.message || "Close failed.",
          });
        }
      }

      if (failures.length > 0) {
        const error = new Error(
          closed === 0
            ? "None of the selected positions could be closed."
            : "Some positions could not be closed."
        );

        error.partial = { succeeded: closed, failures };

        throw error;
      }

      setSelectedKeys(new Set());
    },
    [closePositionRow]
  );

  const bulkCancelRows = useCallback(
    async (rows) => {
      // Same shape as bulkCloseRows: the broker only cancels one order
      // per request, so orders are cancelled one at a time and every
      // failure is collected instead of silently skipped.

      const seenTickets = new Set();
      let cancelled = 0;
      const failures = [];

      for (const row of rows) {
        const dedupeKey = `${row.broker}-${row.ticket}`;

        if (seenTickets.has(dedupeKey)) continue;
        seenTickets.add(dedupeKey);

        try {
          await cancelPendingOrderRow(row);
          cancelled += 1;
        } catch (cancelError) {
          failures.push({
            symbol: row.symbol,
            error: cancelError?.message || "Cancel failed.",
          });
        }
      }

      if (failures.length > 0) {
        const error = new Error(
          cancelled === 0
            ? "None of the selected orders could be cancelled."
            : "Some orders could not be cancelled."
        );

        error.partial = { succeeded: cancelled, failures };

        throw error;
      }
    },
    [cancelPendingOrderRow]
  );

  // --------------------------------------------------------
  // ACTION DISPATCH (rows → dialogs)
  // --------------------------------------------------------

  const handleAction = useCallback((type, row) => {
    setDialog({ type, row });
  }, []);

  const openBulkCloseDialog = useCallback(() => {
    if (selectedRows.length === 0) return;

    setDialog({ type: "bulkClose", rows: selectedRows });
  }, [selectedRows]);

  // The row snapshot is taken when the dialog opens so the confirmed
  // list cannot shift under the user while the broker poll updates.

  const openCloseAllDialog = useCallback(() => {
    if (openRows.length === 0) return;

    setDialog({ type: "closeAll", rows: openRows });
  }, [openRows]);

  const openCancelAllDialog = useCallback(() => {
    if (pendingRows.length === 0) return;

    setDialog({ type: "cancelAll", rows: pendingRows });
  }, [pendingRows]);

  // One bulk action per tab. Closed trades are history, so that tab
  // deliberately gets no broker action at all.

  const bulkAction =
    activeTab === "open"
      ? {
          label: `Close All${
            openRows.length > 0 ? ` (${openRows.length})` : ""
          }`,
          title: "Close every open position at the broker",
          disabled: openRows.length === 0,
          onClick: openCloseAllDialog,
        }
      : activeTab === "pending"
      ? {
          label: `Cancel All${
            pendingRows.length > 0 ? ` (${pendingRows.length})` : ""
          }`,
          title: "Cancel every pending order at the broker",
          disabled: pendingRows.length === 0,
          onClick: openCancelAllDialog,
        }
      : null;

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  // --------------------------------------------------------
  // DIALOG ITEM HELPERS
  // --------------------------------------------------------

  const toItem = (row, withPnl) => {
    const item = {
      side: row.side,
      symbol: row.symbol,
      volume: `${row.lots.toFixed(2)} lots`,
      meta: row.ticket,
    };

    if (withPnl) {
      item.pnl = row.pnl;
      item.pnlLabel = formatSignedMoney(row.pnl, currency);
    }

    return item;
  };

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <PositionsTabs
        activeTab={activeTab}
        onChange={handleTabChange}
        counts={{
          open: openRows.length,
          pending: pendingRows.length,
          closed: closedRows.length,
        }}
      />

      <PositionsStats
        activeTab={activeTab}
        rows={currentRows}
        currency={currency}
        brokerLabel={brokerLabel}
      />

      <PositionsToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={TAB_FILTERS[activeTab] || []}
        symbols={symbols}
        symbolFilter={symbolFilter}
        onSymbolFilterChange={setSymbolFilter}
        columns={TAB_COLUMNS[activeTab] || []}
        visibleKeys={visibleColumns[activeTab] || new Set()}
        onToggleColumn={handleToggleColumn}
        onRestoreColumns={handleRestoreColumns}
        bulkAction={bulkAction}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* SELECTION ACTION BAR (OPEN TAB) */}

      {activeTab === "open" && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50 px-4 py-2 dark:border-violet-500/20 dark:bg-violet-500/10">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
            {selectedRows.length} position
            {selectedRows.length > 1 ? "s" : ""} selected
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearSelection}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={openBulkCloseDialog}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Close Selected ({selectedRows.length})
            </button>
          </div>
        </div>
      )}

      {/* TABLES */}

      {activeTab === "open" && (
        <OpenPositionsTable
          columns={TAB_COLUMNS.open}
          visibleKeys={visibleColumns.open}
          sort={sort}
          onSortChange={handleSortChange}
          rows={visibleRows}
          totalRows={openRows.length}
          loading={syncState.loading}
          error={syncState.error}
          onRetry={runInitialSync}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          allSelected={allSelected}
          someSelected={selectedRows.length > 0}
          onToggleSelectAll={handleToggleSelectAll}
          selectedKeys={selectedKeys}
          onToggleSelect={handleToggleSelect}
          expandedKeys={expandedKeys}
          onToggleExpand={handleToggleExpand}
          onAction={handleAction}
          currency={currency}
          nowMs={nowMs}
        />
      )}

      {activeTab === "pending" && (
        <PendingOrdersTable
          columns={TAB_COLUMNS.pending}
          visibleKeys={visibleColumns.pending}
          sort={sort}
          onSortChange={handleSortChange}
          rows={visibleRows}
          totalRows={pendingRows.length}
          loading={syncState.loading}
          error={syncState.error}
          onRetry={runInitialSync}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          expandedKeys={expandedKeys}
          onToggleExpand={handleToggleExpand}
          onAction={handleAction}
          currency={currency}
          nowMs={nowMs}
        />
      )}

      {activeTab === "closed" && (
        <ClosedPositionsTable
          columns={TAB_COLUMNS.closed}
          visibleKeys={visibleColumns.closed}
          sort={sort}
          onSortChange={handleSortChange}
          rows={visibleRows}
          totalRows={closedRows.length}
          loading={syncState.loading}
          error={syncState.error}
          onRetry={runInitialSync}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          expandedKeys={expandedKeys}
          onToggleExpand={handleToggleExpand}
          currency={currency}
        />
      )}

      {/* ========================================================
          DIALOGS
          ======================================================== */}

      {/* CLOSE SINGLE POSITION */}

      {dialog?.type === "close" && (
        <ActionConfirmDialog
          title="Close Position"
          message="Close this position at the current market price?"
          items={[toItem(dialog.row, true)]}
          itemNote="The final P/L may differ slightly from the current floating P/L."
          confirmLabel="Close Position"
          loadingLabel="Closing position..."
          successLabel="Position closed successfully"
          onConfirm={() => closePositionRow(dialog.row)}
          onClose={closeDialog}
        />
      )}

      {/* BULK CLOSE */}

      {dialog?.type === "bulkClose" && (
        <ActionConfirmDialog
          title="Close Selected Positions"
          message="Close all selected positions at their current market prices?"
          items={dialog.rows.map((row) => toItem(row, true))}
          itemNote="Each position closes individually at its current market price; final P/L may differ slightly."
          confirmLabel={`Close ${dialog.rows.length} Position${
            dialog.rows.length > 1 ? "s" : ""
          }`}
          loadingLabel="Closing positions..."
          successLabel="Selected positions closed"
          onConfirm={() => bulkCloseRows(dialog.rows)}
          onClose={closeDialog}
        />
      )}

      {/* CLOSE ALL OPEN POSITIONS */}

      {dialog?.type === "closeAll" && (
        <ActionConfirmDialog
          title="Close All Open Positions"
          message={`Close all ${dialog.rows.length} open position${
            dialog.rows.length > 1 ? "s" : ""
          } at the broker?`}
          items={dialog.rows.map((row) => toItem(row, true))}
          itemNote="Search and filters do not limit this action — every open position is closed, one at a time. Final P/L may differ slightly from the current floating P/L."
          confirmLabel={`Close All (${dialog.rows.length})`}
          loadingLabel="Closing all positions..."
          successLabel="All open positions closed"
          onConfirm={() => bulkCloseRows(dialog.rows)}
          onClose={closeDialog}
        />
      )}

      {/* CANCEL ALL PENDING ORDERS */}

      {dialog?.type === "cancelAll" && (
        <ActionConfirmDialog
          title="Cancel All Pending Orders"
          message={`Cancel all ${dialog.rows.length} pending order${
            dialog.rows.length > 1 ? "s" : ""
          } at the broker?`}
          items={dialog.rows.map((row) => toItem(row, false))}
          itemNote="Search and filters do not limit this action. Every order is removed from the broker individually; this cannot be undone."
          confirmLabel={`Cancel All (${dialog.rows.length})`}
          loadingLabel="Cancelling all orders..."
          successLabel="All pending orders cancelled"
          onConfirm={() => bulkCancelRows(dialog.rows)}
          onClose={closeDialog}
        />
      )}

      {/* PARTIAL CLOSE */}

      {dialog?.type === "partial" && (
        <ModifyValueDialog
          title="Partial Close"
          message={`${dialog.row.symbol} ${dialog.row.side} — ${dialog.row.lots.toFixed(
            2
          )} lots @ ${formatPrice(dialog.row.entry)}`}
          label="Volume to close (lots)"
          initialValue=""
          inputStep="0.01"
          quickPercents={{ total: dialog.row.lots }}
          max={dialog.row.lots}
          hint={`Enter a volume greater than 0 and less than ${dialog.row.lots.toFixed(
            2
          )} lots. To close the full position, use Close instead.`}
          confirmLabel="Close Partial Volume"
          successLabel="Partial close executed successfully"
          onConfirm={(value) => partialClosePositionRow(dialog.row, value)}
          onClose={closeDialog}
        />
      )}

      {/* MODIFY SL / TP (OPEN POSITION) */}

      {dialog?.type === "modifySl" && (
        <ModifyValueDialog
          title="Modify Stop Loss"
          message={`${dialog.row.symbol} ${dialog.row.side} — current price ${formatPrice(
            dialog.row.current
          )}`}
          label="New stop loss price"
          initialValue={
            dialog.row.stopLoss > 0 ? String(dialog.row.stopLoss) : ""
          }
          inputStep="0.00001"
          hint={
            dialog.row.side === "BUY"
              ? "For a BUY position the stop loss is normally below the current price."
              : "For a SELL position the stop loss is normally above the current price."
          }
          confirmLabel="Save Stop Loss"
          successLabel="Stop loss updated successfully"
          onConfirm={(value) => modifyOpenStopLoss(dialog.row, value)}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === "modifyTp" && (
        <ModifyValueDialog
          title="Modify Take Profit"
          message={`${dialog.row.symbol} ${dialog.row.side} — current price ${formatPrice(
            dialog.row.current
          )}`}
          label="New take profit price"
          initialValue={
            dialog.row.takeProfit > 0 ? String(dialog.row.takeProfit) : ""
          }
          inputStep="0.00001"
          hint={
            dialog.row.side === "BUY"
              ? "For a BUY position the take profit is normally above the current price."
              : "For a SELL position the take profit is normally below the current price."
          }
          confirmLabel="Save Take Profit"
          successLabel="Take profit updated successfully"
          onConfirm={(value) => modifyOpenTakeProfit(dialog.row, value)}
          onClose={closeDialog}
        />
      )}

      {/* CANCEL PENDING ORDER */}

      {dialog?.type === "cancelPending" && (
        <ActionConfirmDialog
          title="Cancel Pending Order"
          message="Permanently cancel this pending order at the broker?"
          items={[toItem(dialog.row, false)]}
          itemNote="The order will be removed from the broker. This action cannot be undone."
          confirmLabel="Cancel Order"
          loadingLabel="Cancelling order..."
          successLabel="Order cancelled successfully"
          onConfirm={() => cancelPendingOrderRow(dialog.row)}
          onClose={closeDialog}
        />
      )}

      {/* MODIFY PENDING ORDER ENTRY / SL / TP */}

      {dialog?.type === "pendingEntry" && (
        <ModifyValueDialog
          title="Modify Entry Price"
          message={`${dialog.row.symbol} ${dialog.row.typeLabel} — ${dialog.row.lots.toFixed(
            2
          )} lots`}
          label="New entry price"
          initialValue={dialog.row.entry > 0 ? String(dialog.row.entry) : ""}
          inputStep="0.00001"
          hint="The pending order will be moved to the new trigger price."
          confirmLabel="Save Entry Price"
          successLabel="Entry price updated successfully"
          onConfirm={(value) =>
            runPendingModify(
              modifyPendingOrderEntry,
              dialog.row,
              value,
              "Failed to modify pending order entry."
            )
          }
          onClose={closeDialog}
        />
      )}

      {dialog?.type === "pendingSl" && (
        <ModifyValueDialog
          title="Modify Pending Stop Loss"
          message={`${dialog.row.symbol} ${dialog.row.typeLabel} — entry ${formatPrice(
            dialog.row.entry
          )}`}
          label="New stop loss price"
          initialValue={
            dialog.row.stopLoss > 0 ? String(dialog.row.stopLoss) : ""
          }
          inputStep="0.00001"
          hint="Applied to the pending order before it fills."
          confirmLabel="Save Stop Loss"
          successLabel="Stop loss updated successfully"
          onConfirm={(value) =>
            runPendingModify(
              modifyPendingOrderStopLoss,
              dialog.row,
              value,
              "Failed to modify pending order stop loss."
            )
          }
          onClose={closeDialog}
        />
      )}

      {dialog?.type === "pendingTp" && (
        <ModifyValueDialog
          title="Modify Pending Take Profit"
          message={`${dialog.row.symbol} ${dialog.row.typeLabel} — entry ${formatPrice(
            dialog.row.entry
          )}`}
          label="New take profit price"
          initialValue={
            dialog.row.takeProfit > 0 ? String(dialog.row.takeProfit) : ""
          }
          inputStep="0.00001"
          hint="Applied to the pending order before it fills."
          confirmLabel="Save Take Profit"
          successLabel="Take profit updated successfully"
          onConfirm={(value) =>
            runPendingModify(
              modifyPendingOrderTakeProfit,
              dialog.row,
              value,
              "Failed to modify pending order take profit."
            )
          }
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
