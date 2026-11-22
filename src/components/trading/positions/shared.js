// ============================================================
// SHARED POSITION NORMALIZATION + FORMATTING
// Single source of truth for all Positions tab components.
// Extracted from the proven OpenPositionRow normalization logic.
// ============================================================

// ============================================================
// NUMBER HELPER
// ============================================================

export function getNumber(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return 0;
}

// ============================================================
// FIND VALUE FROM MULTIPLE POSSIBLE STRUCTURES
// ============================================================

function getSources(item) {
  return [
    item,
    item?.position,
    item?.tradeData,
    item?.tradeData?.position,
    item?.data,
    item?.data?.position,
  ];
}

export function getTradeValue(item, keys = []) {
  if (!item) return undefined;

  for (const source of getSources(item)) {
    if (!source) continue;

    for (const key of keys) {
      if (
        source[key] !== undefined &&
        source[key] !== null &&
        source[key] !== ""
      ) {
        return source[key];
      }
    }
  }

  return undefined;
}

// ============================================================
// TIMESTAMPS
// ============================================================

const MILLISECOND_KEYS = [
  "time_msc",
  "timeMsc",
  "openTimeMsc",
  "openedAtMsc",
  "timestampMsc",
  "openTimestampMsc",
  "closedAtMsc",
  "closeTimeMsc",
];

const SECOND_KEYS = [
  "time",
  "openTimestamp",
  "openedAt",
  "openTime",
  "timestamp",
  "createdAt",
  "closedAt",
  "closedAtIso",
  "closeTime",
  "closed_time",
];

function parseTimestampFromKeys(item, keys) {
  for (const source of getSources(item)) {
    if (!source) continue;

    for (const key of keys) {
      const value = source[key];

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        continue;
      }

      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        if (number >= 100000000000) {
          return number;
        }

        return number * 1000;
      }

      const parsed = new Date(value).getTime();

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

export function getOpenTimestamp(item) {
  if (!item) return null;

  const fromMsc = parseTimestampFromKeys(item, MILLISECOND_KEYS);
  if (fromMsc !== null) return fromMsc;

  return parseTimestampFromKeys(item, SECOND_KEYS);
}

export function getClosedTimestamp(item) {
  if (!item) return null;

  const closedMscKeys = [
    "closedAtMsc",
    "closeTimeMsc",
    "closed_time_msc",
    "time_msc",
  ];

  const closedSecondKeys = [
    "closedAt",
    "closed_at",
    "closeTime",
    "close_time",
    "closedTime",
    "time",
  ];

  const fromMsc = parseTimestampFromKeys(item, closedMscKeys);
  if (fromMsc !== null) return fromMsc;

  return parseTimestampFromKeys(item, closedSecondKeys);
}

// ============================================================
// SIDE NORMALIZATION
// MT5 numeric position type: 0 = buy, 1 = sell.
// cTrader numeric side: 1 = buy, 2 = sell.
// ============================================================

export function normalizeSide(value, item) {
  const broker = String(
    getTradeValue(item, ["broker", "source"]) || ""
  ).toUpperCase();

  const numericType = Number(
    getTradeValue(item, ["type", "positionType"])
  );

  if (broker === "MT5") {
    if (numericType === 0) return "BUY";
    if (numericType === 1) return "SELL";
  }

  const numericSide = Number(value);

  if (numericSide === 0) return "BUY";
  if (numericSide === 1) return "BUY";
  if (numericSide === 2) return "SELL";

  const normalized = String(value || "").toLowerCase();

  if (
    normalized === "buy" ||
    normalized === "long" ||
    normalized === "1"
  ) {
    return "BUY";
  }

  if (
    normalized === "sell" ||
    normalized === "short" ||
    normalized === "2"
  ) {
    return "SELL";
  }

  if (normalized === "0") return "BUY";

  return normalized ? normalized.toUpperCase() : "";
}

// ============================================================
// REAL NET P/L
// ============================================================

export function getRealNetProfit(item) {
  if (!item) {
    return { pnl: 0, source: "none" };
  }

  const broker = String(
    getTradeValue(item, ["broker", "source"]) || ""
  ).toUpperCase();

  // MT5 — broker profit is already net of commission/swap
  if (broker === "MT5") {
    const mt5Profit = getTradeValue(item, [
      "profit",
      "pnl",
      "netProfit",
      "netPnL",
      "unrealizedPnL",
      "unrealizedPnl",
    ]);

    const value = Number(mt5Profit);

    if (Number.isFinite(value)) {
      return { pnl: value, source: "mt5-broker-profit" };
    }

    return { pnl: 0, source: "mt5-fallback" };
  }

  // Direct net profit (cTrader and closed trades)
  const directNetProfit = getTradeValue(item, [
    "netProfit",
    "netPnL",
    "netPnl",
    "netPL",
  ]);

  if (
    directNetProfit !== undefined &&
    directNetProfit !== null &&
    directNetProfit !== ""
  ) {
    const value = Number(directNetProfit);

    if (Number.isFinite(value)) {
      return { pnl: value, source: "broker-net-profit" };
    }
  }

  // Gross + commission + swap
  const grossValue = getTradeValue(item, [
    "grossProfit",
    "grossPnL",
    "grossPnl",
    "grossPL",
  ]);

  if (
    grossValue !== undefined &&
    grossValue !== null &&
    grossValue !== ""
  ) {
    const grossProfit = getNumber(grossValue);

    const commission = getNumber(
      getTradeValue(item, ["commission", "commissions"])
    );

    const swap = getNumber(
      getTradeValue(item, ["swap", "swapCharge", "swapCost"])
    );

    return {
      pnl: grossProfit + commission + swap,
      source: "gross-plus-commission-plus-swap",
      grossProfit,
      commission,
      swap,
    };
  }

  const fallbackPnl = getNumber(
    getTradeValue(item, [
      "pnl",
      "profit",
      "unrealizedPnL",
      "unrealizedPnl",
      "realizedPnL",
    ])
  );

  return { pnl: fallbackPnl, source: "fallback" };
}

// ============================================================
// ID HELPERS
// ============================================================

export function getBrokerName(item) {
  const broker = String(
    getTradeValue(item, ["broker", "source"]) || ""
  ).toUpperCase();

  return broker || "";
}

export function getTicketId(item) {
  const ticket =
    getTradeValue(item, [
      "brokerPositionId",
      "positionId",
      "brokerOrderId",
      "orderId",
      "ticket",
    ]) ?? item?.id ?? null;

  if (ticket === null || ticket === undefined) return "";

  return String(ticket);
}

export function getRowKey(item, index = 0) {
  const key =
    item?.id ??
    item?.positionId ??
    item?.brokerPositionId ??
    item?.orderId ??
    item?.brokerOrderId ??
    item?.ticket ??
    null;

  return key !== null ? String(key) : `row-${index}`;
}

// ============================================================
// PENDING ORDER TYPE NORMALIZATION
// MT5 order types: 2 = BUY_LIMIT, 3 = SELL_LIMIT,
// 4 = BUY_STOP, 5 = SELL_STOP
// ============================================================

export function normalizeOrderType(item) {
  const rawValue = getTradeValue(item, [
    "orderType",
    "type",
    "order_type",
  ]);

  if (rawValue === undefined || rawValue === null) {
    return { kind: "", label: "" };
  }

  const numeric = Number(rawValue);

  const numericMap = {
    2: "BUY_LIMIT",
    3: "SELL_LIMIT",
    4: "BUY_STOP",
    5: "SELL_STOP",
  };

  const upper = numericMap[numeric]
    ? numericMap[numeric]
    : String(rawValue)
        .toUpperCase()
        .replace(/\s+/g, "_");

  if (upper.includes("BUY") && upper.includes("LIMIT")) {
    return { kind: "buy-limit", label: "Buy Limit" };
  }

  if (upper.includes("SELL") && upper.includes("LIMIT")) {
    return { kind: "sell-limit", label: "Sell Limit" };
  }

  if (upper.includes("BUY") && upper.includes("STOP")) {
    return { kind: "buy-stop", label: "Buy Stop" };
  }

  if (upper.includes("SELL") && upper.includes("STOP")) {
    return { kind: "sell-stop", label: "Sell Stop" };
  }

  if (upper.includes("BUY")) {
    return { kind: "buy", label: "Buy" };
  }

  if (upper.includes("SELL")) {
    return { kind: "sell", label: "Sell" };
  }

  return {
    kind: upper.toLowerCase(),
    label: String(rawValue),
  };
}

// ============================================================
// FORMATTERS
// ============================================================

export function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "—";
  }

  if (number >= 100) {
    return number.toFixed(3);
  }

  return number.toFixed(5);
}

export function formatLots(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "—";
  }

  return number.toFixed(2);
}

const currencyFormatters = new Map();

export function isValidCurrency(code) {
  if (!code || typeof code !== "string") return false;

  try {
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    });

    return true;
  } catch {
    return false;
  }
}

function getCurrencyFormatter(currency) {
  const code = isValidCurrency(currency) ? currency : "USD";

  if (!currencyFormatters.has(code)) {
    currencyFormatters.set(
      code,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  return currencyFormatters.get(code);
}

export function formatMoney(value, currency = "USD") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return getCurrencyFormatter(currency).format(number);
}

export function formatSignedMoney(value, currency = "USD") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  const formatted = getCurrencyFormatter(currency).format(
    Math.abs(number)
  );

  return `${number >= 0 ? "+" : "-"}${formatted}`;
}

export function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export function formatDateTime(timestamp) {
  if (timestamp === null || timestamp === undefined) {
    return "—";
  }

  const number = Number(timestamp);
  const ms = Number.isFinite(number)
    ? number < 100000000000
      ? number * 1000
      : number
    : new Date(timestamp).getTime();

  if (!Number.isFinite(ms) || ms <= 0) {
    return "—";
  }

  const date = new Date(ms);

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDurationText(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  // "HH:MM:SS" live duration strings
  const match = String(value).match(/^(\d+):(\d{2}):(\d{2})$/);

  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  }

  // durationSeconds numbers
  const number = Number(value);

  if (Number.isFinite(number) && number >= 0) {
    const total = Math.floor(number);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  }

  return String(value);
}

// ============================================================
// P/L PERCENT
// Return on margin when margin is known,
// otherwise the directional price move.
// ============================================================

export function computePnlPercent(item, exitPrice = null) {
  const pnl = getRealNetProfit(item).pnl;

  const margin = getNumber(
    getTradeValue(item, ["margin", "usedMargin"])
  );

  if (margin > 0 && Number.isFinite(pnl)) {
    return (pnl / margin) * 100;
  }

  const entry = getNumber(
    getTradeValue(item, [
      "entry",
      "entryPrice",
      "priceOpen",
      "price_open",
      "openPrice",
      "price",
    ])
  );

  const exit = Number(exitPrice) ||
    getNumber(
      getTradeValue(item, [
        "exitPrice",
        "exit",
        "closePrice",
        "priceClose",
        "price_close",
        "currentPrice",
        "current",
        "priceCurrent",
        "price_current",
        "markPrice",
        "bid",
        "ask",
      ])
    );

  if (entry > 0 && exit > 0) {
    const side = normalizeSide(
      getTradeValue(item, [
        "side",
        "direction",
        "tradeSide",
        "type",
        "positionType",
      ]),
      item
    );

    const direction = side === "SELL" ? -1 : 1;

    return ((exit - entry) / entry) * 100 * direction;
  }

  return null;
}

// ============================================================
// SEARCH TEXT
// symbol / ticket / order id / broker / side
// ============================================================

export function buildSearchText(item) {
  const parts = [
    getTradeValue(item, ["symbol", "instrument", "symbolName"]),
    getTradeValue(item, [
      "brokerPositionId",
      "positionId",
      "brokerOrderId",
      "orderId",
      "ticket",
    ]),
    item?.id,
    getBrokerName(item),
    normalizeSide(
      getTradeValue(item, [
        "side",
        "direction",
        "tradeSide",
        "type",
        "positionType",
      ]),
      item
    ),
    normalizeOrderType(item).label,
    getTradeValue(item, ["status"]),
  ];

  return parts
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(" ")
    .toLowerCase();
}

// ============================================================
// DERIVED ROW MODELS
// ============================================================

export function deriveOpenPosition(trade, index = 0) {
  const pnlResult = getRealNetProfit(trade);

  const side = normalizeSide(
    getTradeValue(trade, [
      "side",
      "direction",
      "tradeSide",
      "type",
      "positionType",
    ]),
    trade
  );

  const entry = getNumber(
    getTradeValue(trade, [
      "entry",
      "entryPrice",
      "priceOpen",
      "price_open",
      "price",
      "openPrice",
    ])
  );

  const current =
    getNumber(
      getTradeValue(trade, [
        "currentPrice",
        "current",
        "priceCurrent",
        "price_current",
        "markPrice",
        "bid",
        "ask",
      ])
    ) || entry;

  const lots = getNumber(
    getTradeValue(trade, [
      "quantity",
      "lots",
      "volumeLots",
      "volume",
    ])
  );

  const openedAtMs = getOpenTimestamp(trade);

  const row = {
    key: getRowKey(trade, index),
    raw: trade,
    ticket: getTicketId(trade),
    symbol:
      getTradeValue(trade, [
        "symbol",
        "instrument",
        "symbolName",
      ]) || "UNKNOWN",
    side,
    lots,
    entry,
    current,
    takeProfit: getNumber(getTradeValue(trade, ["takeProfit", "tp"])),
    stopLoss: getNumber(getTradeValue(trade, ["stopLoss", "sl"])),
    pnl: pnlResult.pnl,
    pnlSource: pnlResult.source,
    pnlPercent: computePnlPercent(trade, current),
    commission: getNumber(
      getTradeValue(trade, ["commission", "commissions"])
    ),
    swap: getNumber(
      getTradeValue(trade, ["swap", "swapCharge", "swapCost"])
    ),
    grossProfit: getNumber(
      getTradeValue(trade, ["grossProfit", "grossPnL", "grossPnl"])
    ),
    margin: getNumber(
      getTradeValue(trade, ["margin", "usedMargin"])
    ),
    openedAtMs,
    broker: getBrokerName(trade),
    orderType:
      getTradeValue(trade, ["orderType"]) || "Market",
    status: getTradeValue(trade, ["status"]) || "OPEN",
    searchText: buildSearchText(trade),
  };

  row.sortValues = {
    ticket: Number(row.ticket) || null,
    symbol: String(row.symbol),
    side: row.side,
    lots: row.lots,
    entry: row.entry,
    current: row.current,
    takeProfit: row.takeProfit,
    stopLoss: row.stopLoss,
    pnl: row.pnl,
    pnlPercent: row.pnlPercent,
    commission: row.commission,
    swap: row.swap,
    margin: row.margin,
    duration: row.openedAtMs,
    openedAt: row.openedAtMs,
    broker: row.broker,
  };

  return row;
}

export function derivePendingOrder(order, index = 0) {
  const type = normalizeOrderType(order);

  const entry = getNumber(
    getTradeValue(order, [
      "entry",
      "entryPrice",
      "price",
      "priceOpen",
      "price_open",
      "openPrice",
    ])
  );

  const createdAtMs =
    getOpenTimestamp(order) ??
    (order?.createdAt
      ? new Date(order.createdAt).getTime() || null
      : null);

  const row = {
    key: getRowKey(order, index),
    raw: order,
    ticket: getTicketId(order),
    symbol:
      getTradeValue(order, [
        "symbol",
        "instrument",
        "symbolName",
      ]) || "UNKNOWN",
    typeKind: type.kind,
    typeLabel: type.label || "Limit",
    side: type.kind.startsWith("buy")
      ? "BUY"
      : type.kind.startsWith("sell")
      ? "SELL"
      : "",
    lots: getNumber(
      getTradeValue(order, [
        "quantity",
        "lots",
        "volumeLots",
        "volume",
      ])
    ),
    entry,
    current: getNumber(
      getTradeValue(order, [
        "currentPrice",
        "current",
        "markPrice",
        "priceCurrent",
        "price_current",
      ])
    ),
    takeProfit: getNumber(getTradeValue(order, ["takeProfit", "tp"])),
    stopLoss: getNumber(getTradeValue(order, ["stopLoss", "sl"])),
    margin: getNumber(
      getTradeValue(order, ["margin", "usedMargin"])
    ),
    createdAtMs,
    createdAtLabel: order?.createdAt
      ? String(order.createdAt)
      : null,
    durationLabel: order?.duration || null,
    broker: getBrokerName(order),
    status: getTradeValue(order, ["status"]) || "PENDING",
    searchText: buildSearchText(order),
  };

  row.sortValues = {
    ticket: Number(row.ticket) || null,
    symbol: String(row.symbol),
    type: row.typeLabel,
    lots: row.lots,
    entry: row.entry,
    current: row.current,
    takeProfit: row.takeProfit,
    stopLoss: row.stopLoss,
    margin: row.margin,
    duration: row.createdAtMs,
    broker: row.broker,
  };

  return row;
}

export function deriveClosedPosition(trade, index = 0) {
  const pnlResult = getRealNetProfit(trade);

  const side = normalizeSide(
    getTradeValue(trade, [
      "side",
      "direction",
      "tradeSide",
      "type",
      "positionType",
    ]),
    trade
  );

  const entry = getNumber(
    getTradeValue(trade, [
      "entry",
      "entryPrice",
      "priceOpen",
      "price_open",
      "price",
      "openPrice",
    ])
  );

  const exit = getNumber(
    getTradeValue(trade, [
      "exitPrice",
      "exit",
      "closePrice",
      "priceClose",
      "price_close",
    ])
  );

  const closedAtMs = getClosedTimestamp(trade);

  const durationSeconds = getNumber(
    getTradeValue(trade, ["durationSeconds", "duration_seconds"])
  );

  const row = {
    key: getRowKey(trade, index),
    raw: trade,
    ticket: getTicketId(trade),
    symbol:
      getTradeValue(trade, [
        "symbol",
        "instrument",
        "symbolName",
      ]) || "UNKNOWN",
    side,
    lots: getNumber(
      getTradeValue(trade, [
        "quantity",
        "lots",
        "volumeLots",
        "volume",
      ])
    ),
    entry,
    exit,
    takeProfit: getNumber(getTradeValue(trade, ["takeProfit", "tp"])),
    stopLoss: getNumber(getTradeValue(trade, ["stopLoss", "sl"])),
    pnl: pnlResult.pnl,
    pnlSource: pnlResult.source,
    pnlPercent: computePnlPercent(trade, exit),
    commission: getNumber(
      getTradeValue(trade, ["commission", "commissions"])
    ),
    swap: getNumber(
      getTradeValue(trade, ["swap", "swapCharge", "swapCost"])
    ),
    margin: getNumber(
      getTradeValue(trade, ["margin", "usedMargin"])
    ),
    openedAtMs: getOpenTimestamp(trade),
    closedAtMs,
    durationSeconds,
    durationLabel:
      trade?.duration ||
      trade?.tradeDuration ||
      (durationSeconds > 0 ? formatDurationText(durationSeconds) : null),
    result: getTradeValue(trade, ["result"]) || null,
    broker: getBrokerName(trade),
    orderType: getTradeValue(trade, ["orderType"]) || "Market",
    status: getTradeValue(trade, ["status"]) || "CLOSED",
    searchText: buildSearchText(trade),
  };

  row.sortValues = {
    ticket: Number(row.ticket) || null,
    symbol: String(row.symbol),
    side: row.side,
    lots: row.lots,
    entry: row.entry,
    exit: row.exit,
    takeProfit: row.takeProfit,
    stopLoss: row.stopLoss,
    pnl: row.pnl,
    pnlPercent: row.pnlPercent,
    commission: row.commission,
    swap: row.swap,
    duration:
      durationSeconds > 0
        ? durationSeconds
        : row.openedAtMs && closedAtMs
        ? (closedAtMs - row.openedAtMs) / 1000
        : null,
    closedAt: closedAtMs,
    broker: row.broker,
  };

  return row;
}

// ============================================================
// FILTERING + SORTING
// ============================================================

export function matchesTabFilter(row, tab, filter) {
  if (!filter || filter === "all") return true;

  if (tab === "pending") {
    return row.typeKind === filter;
  }

  if (filter === "buy") return row.side === "BUY";
  if (filter === "sell") return row.side === "SELL";
  if (filter === "profit") return row.pnl > 0;
  if (filter === "loss") return row.pnl < 0;

  return true;
}

export function compareSortValues(a, b) {
  const isEmpty = (value) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "number" && !Number.isFinite(value));

  if (isEmpty(a) && isEmpty(b)) return 0;
  if (isEmpty(a)) return 1;
  if (isEmpty(b)) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b));
}

export function applyViewFilters(
  rows,
  {
    tab,
    search = "",
    filter = "all",
    symbolFilter = "all",
    sort = null,
  } = {}
) {
  let result = rows;

  const query = String(search || "").trim().toLowerCase();

  if (query) {
    result = result.filter((row) =>
      row.searchText.includes(query)
    );
  }

  if (filter && filter !== "all") {
    result = result.filter((row) =>
      matchesTabFilter(row, tab, filter)
    );
  }

  if (symbolFilter && symbolFilter !== "all") {
    result = result.filter((row) => row.symbol === symbolFilter);
  }

  if (sort && sort.key) {
    const direction = sort.direction === "desc" ? -1 : 1;

    result = [...result].sort((a, b) =>
      direction *
      compareSortValues(a.sortValues?.[sort.key], b.sortValues?.[sort.key])
    );
  }

  return result;
}
