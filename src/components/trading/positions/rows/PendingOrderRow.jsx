import {
  ChevronDown,
  Move,
  Shield,
  Target,
  XCircle,
} from "lucide-react";

import {
  formatDurationText,
  formatLots,
  formatMoney,
  formatPrice,
} from "../shared";

import RowActionMenu from "./RowActionMenu";

// ============================================================
// PENDING ORDER ROW
// Pure presentation from the derived row model. Editing and
// cancellation are delegated upward through onAction so the
// shared dialogs can verify real broker success.
// ============================================================

function alignClass(align) {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right tabular-nums";
  return "text-center";
}

// Cells that own their own click target must not also toggle the row.
const STOP_PROPAGATION_KEYS = new Set(["expand", "actions"]);

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

export default function PendingOrderRow({
  row,
  columns = [],
  visibleKeys = new Set(),
  expanded = false,
  onToggleExpand,
  onAction,
  currency = "USD",
  nowMs = null,
}) {
  const visibleColumns = columns.filter((column) =>
    visibleKeys.has(column.key)
  );

  const ageLabel =
    row.durationLabel ||
    (row.createdAtMs && nowMs
      ? formatDurationText(Math.max(0, (nowMs - row.createdAtMs) / 1000))
      : "—");

  const typeTone =
    row.typeKind.startsWith("buy")
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
      : row.typeKind.startsWith("sell")
      ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

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

      case "type":
        return (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${typeTone}`}
          >
            {row.typeLabel || "—"}
          </span>
        );

      case "lots":
        return formatLots(row.lots);

      case "entry":
        return formatPrice(row.entry);

      case "current":
        return formatPrice(row.current);

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

      case "margin":
        return row.margin > 0
          ? formatMoney(row.margin, currency)
          : "—";

      case "duration":
        return ageLabel;

      case "broker":
        return brokerBadge(row.broker);

      case "actions":
        return (
          <RowActionMenu
            items={[
              {
                label: "Modify Entry",
                icon: <Move size={14} />,
                onClick: () => onAction?.("pendingEntry", row),
              },
              {
                label: "Modify Stop Loss",
                icon: <Shield size={14} />,
                onClick: () => onAction?.("pendingSl", row),
              },
              {
                label: "Modify Take Profit",
                icon: <Target size={14} />,
                onClick: () => onAction?.("pendingTp", row),
              },
              {
                label: "Cancel Order",
                icon: <XCircle size={14} />,
                danger: true,
                onClick: () => onAction?.("cancelPending", row),
              },
            ]}
          />
        );

      default:
        return "—";
    }
  };

  return (
    <tr
      onClick={() => onToggleExpand?.(row.key)}
      title={expanded ? "Hide order details" : "Show order details"}
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
