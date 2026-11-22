// ============================================================
// POSITION TABLE COLUMN DEFINITIONS
// Per-tab columns + visibility persistence (localStorage).
// ============================================================

function col(key, label, align, width, options = {}) {
  return {
    key,
    label,
    align,
    width,
    sortable: options.sortable ?? false,
    hideable: options.hideable ?? true,
    defaultVisible: options.defaultVisible ?? true,
  };
}

// ============================================================
// OPEN POSITIONS
// ============================================================

export const OPEN_COLUMNS = [
  col("select", "", "center", "w-[44px]", { hideable: false }),
  col("expand", "", "center", "w-[36px]", { hideable: false }),
  col("ticket", "Ticket", "left", "w-[92px]", { sortable: true }),
  col("symbol", "Instrument", "left", "w-[110px]", { sortable: true }),
  col("side", "Side", "center", "w-[76px]", { sortable: true }),
  col("lots", "Lots", "center", "w-[64px]", { sortable: true }),
  col("entry", "Entry", "right", "w-[96px]", { sortable: true }),
  col("current", "Current", "right", "w-[96px]", { sortable: true }),
  col("takeProfit", "TP", "right", "w-[96px]", { sortable: true }),
  col("stopLoss", "SL", "right", "w-[96px]", { sortable: true }),
  col("pnl", "P/L", "right", "w-[104px]", { sortable: true }),
  col("pnlPercent", "P/L %", "right", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("commission", "Comm.", "right", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("swap", "Swap", "right", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("margin", "Margin", "right", "w-[88px]", { sortable: true }),
  col("duration", "Duration", "right", "w-[104px]", { sortable: true }),
  col("openedAt", "Open Time", "right", "w-[132px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("broker", "Broker", "center", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("actions", "", "center", "w-[60px]", { hideable: false }),
];

// ============================================================
// PENDING ORDERS
// ============================================================

export const PENDING_COLUMNS = [
  col("expand", "", "center", "w-[36px]", { hideable: false }),
  col("ticket", "Ticket", "left", "w-[92px]", { sortable: true }),
  col("symbol", "Instrument", "left", "w-[110px]", { sortable: true }),
  col("type", "Type", "center", "w-[96px]", { sortable: true }),
  col("lots", "Lots", "center", "w-[64px]", { sortable: true }),
  col("entry", "Entry", "right", "w-[96px]", { sortable: true }),
  col("current", "Current", "right", "w-[96px]", { sortable: true }),
  col("takeProfit", "TP", "right", "w-[96px]", { sortable: true }),
  col("stopLoss", "SL", "right", "w-[96px]", { sortable: true }),
  col("margin", "Margin", "right", "w-[88px]", { sortable: true }),
  col("duration", "Age", "right", "w-[104px]", { sortable: true }),
  col("broker", "Broker", "center", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("actions", "", "center", "w-[60px]", { hideable: false }),
];

// ============================================================
// CLOSED POSITIONS
// ============================================================

export const CLOSED_COLUMNS = [
  col("expand", "", "center", "w-[36px]", { hideable: false }),
  col("ticket", "Ticket", "left", "w-[92px]", { sortable: true }),
  col("symbol", "Instrument", "left", "w-[110px]", { sortable: true }),
  col("side", "Side", "center", "w-[76px]", { sortable: true }),
  col("lots", "Lots", "center", "w-[64px]", { sortable: true }),
  col("entry", "Entry", "right", "w-[96px]", { sortable: true }),
  col("exit", "Exit", "right", "w-[96px]", { sortable: true }),
  col("takeProfit", "TP", "right", "w-[96px]", { sortable: true }),
  col("stopLoss", "SL", "right", "w-[96px]", { sortable: true }),
  col("pnl", "P/L", "right", "w-[104px]", { sortable: true }),
  col("pnlPercent", "P/L %", "right", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("commission", "Comm.", "right", "w-[76px]", { sortable: true }),
  col("swap", "Swap", "right", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("duration", "Duration", "right", "w-[104px]", { sortable: true }),
  col("closedAt", "Close Time", "right", "w-[132px]", {
    sortable: true,
    defaultVisible: false,
  }),
  col("broker", "Broker", "center", "w-[76px]", {
    sortable: true,
    defaultVisible: false,
  }),
];

export const TAB_COLUMNS = {
  open: OPEN_COLUMNS,
  pending: PENDING_COLUMNS,
  closed: CLOSED_COLUMNS,
};

// ============================================================
// FILTER OPTIONS PER TAB
// ============================================================

export const TAB_FILTERS = {
  open: [
    { value: "all", label: "All Positions" },
    { value: "buy", label: "Buy" },
    { value: "sell", label: "Sell" },
    { value: "profit", label: "Profit" },
    { value: "loss", label: "Loss" },
  ],
  pending: [
    { value: "all", label: "All Orders" },
    { value: "buy-limit", label: "Buy Limit" },
    { value: "sell-limit", label: "Sell Limit" },
    { value: "buy-stop", label: "Buy Stop" },
    { value: "sell-stop", label: "Sell Stop" },
  ],
  closed: [
    { value: "all", label: "All Trades" },
    { value: "buy", label: "Buy" },
    { value: "sell", label: "Sell" },
    { value: "profit", label: "Profit" },
    { value: "loss", label: "Loss" },
  ],
};

// ============================================================
// VISIBILITY PERSISTENCE
// ============================================================

const STORAGE_PREFIX = "edgeflo-positions-columns-";

function storageKey(tab) {
  return `${STORAGE_PREFIX}${tab}`;
}

function defaultVisibleKeys(columns) {
  return columns
    .filter((column) => column.defaultVisible)
    .map((column) => column.key);
}

export function loadVisibleColumns(tab, columns) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(storageKey(tab)) || "null"
    );

    if (Array.isArray(saved) && saved.length > 0) {
      const known = new Set(columns.map((column) => column.key));

      const merged = saved.filter((key) => known.has(key));

      for (const column of columns) {
        if (
          !column.hideable &&
          !merged.includes(column.key)
        ) {
          merged.push(column.key);
        }
      }

      if (merged.length > 0) {
        return new Set(merged);
      }
    }
  } catch {
    // corrupted or unavailable storage — fall back to defaults
  }

  return new Set(defaultVisibleKeys(columns));
}

export function saveVisibleColumns(tab, keys) {
  try {
    localStorage.setItem(
      storageKey(tab),
      JSON.stringify([...keys])
    );
  } catch {
    // storage unavailable — preferences simply won't persist
  }
}

export function defaultColumnKeys(tab) {
  return new Set(defaultVisibleKeys(TAB_COLUMNS[tab]));
}

// Guard: never allow hiding every hideable data column
export function canToggleColumnOff(columns, visibleKeys, key) {
  const hideableVisible = columns.filter(
    (column) =>
      column.hideable &&
      column.key !== key &&
      visibleKeys.has(column.key)
  );

  return hideableVisible.length > 0;
}
