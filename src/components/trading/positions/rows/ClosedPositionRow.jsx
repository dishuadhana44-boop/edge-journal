import { ChevronDown } from "lucide-react";

import {
  formatDateTime,
  formatDurationText,
  formatLots,
  formatMoney,
  formatPercent,
  formatPrice,
  formatSignedMoney,
} from "../shared";

// ============================================================
// CLOSED POSITION ROW
// Pure presentation from the derived row model. Details live
// in the expandable row, so there is no action menu here.
// ============================================================

function alignClass(align) {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right tabular-nums";
  return "text-center";
}

function pnlClass(value) {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-700 dark:text-gray-300";
}

// The chevron owns its own click, so its cell must not double-toggle.
const STOP_PROPAGATION_KEYS = new Set(["expand"]);

function brokerBadge(broker) {
  const upper = String(broker || "").toUpperCase();

  const tone =
    upper === "MT5"
      ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
      : upper === "CTRADER"
      ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
      : upper
      ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      : "";

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
        tone || "text-gray-400 dark:text-gray-500"
      }`}
    >
      {upper || "—"}
    </span>
  );
}

export default function ClosedPositionRow({
  row,
  columns = [],
  visibleKeys = new Set(),
  expanded = false,
  onToggleExpand,
  currency = "USD",
}) {
  const visibleColumns = columns.filter((column) =>
    visibleKeys.has(column.key)
  );

  const durationLabel =
    row.durationLabel ||
    (row.openedAtMs && row.closedAtMs
      ? formatDurationText((row.closedAtMs - row.openedAtMs) / 1000)
      : "—");

  const renderCell = (column) => {
    switch (column.key) {
      case "expand":
        return (
          <button
            type="button"
            onClick={() => onToggleExpand?.(row.key)}
            title={expanded ? "Hide details" : "Show details"}
            className={`
              rounded-md
              p-1
              text-gray-400
              transition
              hover:bg-gray-200
              hover:text-gray-600
              dark:hover:bg-gray-700
              ${
                expanded
                  ? "rotate-180 text-violet-600 dark:text-violet-400"
                  : ""
              }
            `}
          >
            <ChevronDown size={14} />
          </button>
        );

      case "ticket":
        return (
          <span className="font-mono text-[11px] font-medium text-gray-600 dark:text-gray-400">
            {row.ticket || "—"}
          </span>
        );

      case "symbol":
        return (
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {row.symbol}
          </span>
        );

      case "side":
        return (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              row.side === "SELL"
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
            }`}
          >
            {row.side || "—"}
          </span>
        );

      case "lots":
        return formatLots(row.lots);

      case "entry":
        return formatPrice(row.entry);

      case "exit":
        return formatPrice(row.exit);

      case "takeProfit":
        return (
          <span className="text-emerald-600 dark:text-emerald-400">
            {formatPrice(row.takeProfit)}
          </span>
        );

      case "stopLoss":
        return (
          <span className="text-red-600 dark:text-red-400">
            {formatPrice(row.stopLoss)}
          </span>
        );

      case "pnl":
        return (
          <span className={`font-semibold ${pnlClass(row.pnl)}`}>
            {formatSignedMoney(row.pnl, currency)}
          </span>
        );

      case "pnlPercent":
        return (
          <span className={pnlClass(row.pnlPercent)}>
            {row.pnlPercent === null || row.pnlPercent === undefined
              ? "—"
              : formatPercent(row.pnlPercent)}
          </span>
        );

      case "commission":
        return formatMoney(row.commission, currency);

      case "swap":
        return formatMoney(row.swap, currency);

      case "duration":
        return durationLabel;

      case "closedAt":
        return (
          <span className="text-gray-500 dark:text-gray-400">
            {formatDateTime(row.closedAtMs)}
          </span>
        );

      case "broker":
        return brokerBadge(row.broker);

      default:
        return "—";
    }
  };

  return (
    <tr
      onClick={() => onToggleExpand?.(row.key)}
      title={expanded ? "Hide trade details" : "Show trade details"}
      className={`
        cursor-pointer
        border-b
        border-gray-100
        transition
        hover:bg-gray-50
        dark:border-gray-800
        dark:hover:bg-gray-800/50
      `}
    >
      {visibleColumns.map((column) => (
        <td
          key={column.key}
          onClick={
            STOP_PROPAGATION_KEYS.has(column.key)
              ? (event) => event.stopPropagation()
              : undefined
          }
          className={`
            whitespace-nowrap
            px-3
            py-2.5
            text-xs
            text-gray-700
            dark:text-gray-300
            ${column.width}
            ${alignClass(column.align)}
          `}
        >
          {renderCell(column)}
        </td>
      ))}
    </tr>
  );
}
