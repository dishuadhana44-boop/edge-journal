import {
  formatDateTime,
  formatDurationText,
  formatMoney,
  formatPercent,
  formatPrice,
  formatSignedMoney,
  getTradeValue,
} from "../shared";

// ============================================================
// EXPANDED DETAILS ROW
// Full detail grid rendered under an expanded row.
// Shows only fields the data actually provides — missing
// values render as "—", never as broken/undefined text.
// ============================================================

function Field({ label, value, className = "" }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>

      <p
        className={`mt-0.5 break-words text-xs font-medium tabular-nums text-gray-800 dark:text-gray-200 ${className}`}
      >
        {value}
      </p>
    </div>
  );
}

function liveDurationFrom(ms, nowMs) {
  if (!ms || !nowMs) return "—";

  const seconds = Math.max(0, (nowMs - ms) / 1000);

  return formatDurationText(seconds);
}

function pnlClass(value) {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export default function ExpandedDetailsRow({
  row,
  tab,
  columnCount = 1,
  currency = "USD",
  nowMs = null,
}) {
  const accountLabel =
    getTradeValue(row.raw, [
      "accountName",
      "account",
      "accountId",
      "login",
      "brokerAccountId",
    ]) || "—";

  const common = [
    <Field key="ticket" label="Ticket" value={row.ticket || "—"} />,
    <Field key="broker" label="Broker" value={row.broker || "—"} />,
    <Field key="account" label="Account" value={accountLabel} />,
  ];

  let fields;

  if (tab === "open") {
    fields = [
      ...common,

      <Field key="symbol" label="Symbol" value={row.symbol} />,
      <Field key="side" label="Side" value={row.side || "—"} />,
      <Field
        key="volume"
        label="Volume"
        value={`${row.lots.toFixed(2)} lots`}
      />,
      <Field key="entry" label="Entry" value={formatPrice(row.entry)} />,
      <Field
        key="current"
        label="Current"
        value={formatPrice(row.current)}
      />,
      <Field
        key="stopLoss"
        label="Stop Loss"
        value={formatPrice(row.stopLoss)}
      />,
      <Field
        key="takeProfit"
        label="Take Profit"
        value={formatPrice(row.takeProfit)}
      />,
      <Field
        key="pnl"
        label="Net P/L"
        value={formatSignedMoney(row.pnl, currency)}
        className={pnlClass(row.pnl)}
      />,
      <Field
        key="pnlPercent"
        label="P/L %"
        value={
          row.pnlPercent === null || row.pnlPercent === undefined
            ? "—"
            : formatPercent(row.pnlPercent)
        }
        className={pnlClass(row.pnlPercent)}
      />,
      <Field
        key="commission"
        label="Commission"
        value={formatMoney(row.commission, currency)}
      />,
      <Field key="swap" label="Swap" value={formatMoney(row.swap, currency)} />,
      <Field
        key="margin"
        label="Margin"
        value={formatMoney(row.margin, currency)}
      />,
      <Field
        key="openedAt"
        label="Open Time"
        value={formatDateTime(row.openedAtMs)}
      />,
      <Field
        key="duration"
        label="Duration"
        value={liveDurationFrom(row.openedAtMs, nowMs)}
      />,
      <Field key="orderType" label="Order Type" value={row.orderType || "—"} />,
      <Field key="status" label="Status" value={row.status || "—"} />,
    ];
  } else if (tab === "pending") {
    fields = [
      ...common,

      <Field key="symbol" label="Symbol" value={row.symbol} />,
      <Field key="type" label="Order Type" value={row.typeLabel || "—"} />,
      <Field key="status" label="Status" value={row.status || "—"} />,
      <Field
        key="volume"
        label="Volume"
        value={`${row.lots.toFixed(2)} lots`}
      />,
      <Field key="entry" label="Entry" value={formatPrice(row.entry)} />,
      <Field
        key="current"
        label="Current"
        value={formatPrice(row.current)}
      />,
      <Field
        key="stopLoss"
        label="Stop Loss"
        value={formatPrice(row.stopLoss)}
      />,
      <Field
        key="takeProfit"
        label="Take Profit"
        value={formatPrice(row.takeProfit)}
      />,
      <Field
        key="margin"
        label="Margin"
        value={formatMoney(row.margin, currency)}
      />,
      <Field
        key="createdAt"
        label="Created"
        value={
          formatDateTime(row.createdAtMs) !== "—"
            ? formatDateTime(row.createdAtMs)
            : row.createdAtLabel || "—"
        }
      />,
      <Field
        key="age"
        label="Age"
        value={row.durationLabel || liveDurationFrom(row.createdAtMs, nowMs)}
      />,
    ];
  } else {
    fields = [
      ...common,

      <Field key="symbol" label="Symbol" value={row.symbol} />,
      <Field key="side" label="Side" value={row.side || "—"} />,
      <Field
        key="volume"
        label="Volume"
        value={`${row.lots.toFixed(2)} lots`}
      />,
      <Field key="entry" label="Entry" value={formatPrice(row.entry)} />,
      <Field key="exit" label="Exit" value={formatPrice(row.exit)} />,
      <Field
        key="stopLoss"
        label="Stop Loss"
        value={formatPrice(row.stopLoss)}
      />,
      <Field
        key="takeProfit"
        label="Take Profit"
        value={formatPrice(row.takeProfit)}
      />,
      <Field
        key="pnl"
        label="Net P/L"
        value={formatSignedMoney(row.pnl, currency)}
        className={pnlClass(row.pnl)}
      />,
      <Field
        key="pnlPercent"
        label="P/L %"
        value={
          row.pnlPercent === null || row.pnlPercent === undefined
            ? "—"
            : formatPercent(row.pnlPercent)
        }
        className={pnlClass(row.pnlPercent)}
      />,
      <Field
        key="commission"
        label="Commission"
        value={formatMoney(row.commission, currency)}
      />,
      <Field key="swap" label="Swap" value={formatMoney(row.swap, currency)} />,
      <Field
        key="margin"
        label="Margin"
        value={formatMoney(row.margin, currency)}
      />,
      <Field
        key="openedAt"
        label="Open Time"
        value={formatDateTime(row.openedAtMs)}
      />,
      <Field
        key="closedAt"
        label="Close Time"
        value={formatDateTime(row.closedAtMs)}
      />,
      <Field
        key="duration"
        label="Duration"
        value={
          row.durationLabel ||
          (row.openedAtMs && row.closedAtMs
            ? formatDurationText((row.closedAtMs - row.openedAtMs) / 1000)
            : "—")
        }
      />,
      <Field key="orderType" label="Order Type" value={row.orderType || "—"} />,
      <Field
        key="status"
        label="Result"
        value={row.result || row.status || "—"}
      />,
    ];
  }

  return (
    <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/40">
      <td colSpan={columnCount} className="px-4 py-3.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          {fields}
        </div>

        <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500">
          P/L source: {row.pnlSource || "n/a"} · Currency: {currency}
        </p>
      </td>
    </tr>
  );
}
