import { useMemo } from "react";

import { useTrade } from "../../../../context/TradeContext";

import { formatMoney, formatSignedMoney } from "../shared";

// ============================================================
// PER-TAB SUMMARY BAR
// OPEN:     count, total volume, floating P&L, margin used,
//           free margin, winners, losers
// PENDING:  count, total volume
// CLOSED:   count, total net P&L, winners, losers, win rate
// All money values use the connected account's currency.
// ============================================================

function Metric({ label, value, className = "" }) {
  return (
    <div className="min-w-[86px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 ${className}`}
      >
        {value}
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div className="h-9 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
  );
}

export default function PositionsStats({
  activeTab,
  rows = [],
  currency = "USD",
  brokerLabel = "",
}) {
  const { marginUsed, freeMargin } = useTrade();

  const totals = useMemo(() => {
    let pnlSum = 0;
    let volumeSum = 0;
    let winners = 0;
    let losers = 0;

    for (const row of rows) {
      volumeSum += row.lots || 0;

      if (row.pnl > 0) winners += 1;
      if (row.pnl < 0) losers += 1;
      pnlSum += row.pnl || 0;
    }

    return {
      count: rows.length,
      volumeSum,
      pnlSum,
      winners,
      losers,
      winRate:
        rows.length > 0 ? (winners / rows.length) * 100 : null,
    };
  }, [rows]);

  const pnlClass =
    totals.pnlSum >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gray-200 bg-gray-50/60 px-6 py-3.5 dark:border-gray-700 dark:bg-gray-900/60">
      {activeTab === "open" && (
        <>
          <Metric label="Positions" value={String(totals.count)} />

          <Divider />

          <Metric
            label="Total Volume"
            value={`${totals.volumeSum.toFixed(2)} lots`}
          />

          <Divider />

          <Metric
            label="Floating P/L"
            value={formatSignedMoney(totals.pnlSum, currency)}
            className={pnlClass}
          />

          <Divider />

          <Metric
            label="Margin Used"
            value={formatMoney(marginUsed, currency)}
          />

          <Divider />

          <Metric
            label="Free Margin"
            value={formatMoney(freeMargin, currency)}
          />

          <Divider />

          <Metric
            label="Winners"
            value={String(totals.winners)}
            className="text-emerald-600 dark:text-emerald-400"
          />

          <Metric
            label="Losers"
            value={String(totals.losers)}
            className="text-red-600 dark:text-red-400"
          />
        </>
      )}

      {activeTab === "pending" && (
        <>
          <Metric label="Pending Orders" value={String(totals.count)} />

          <Divider />

          <Metric
            label="Total Volume"
            value={`${totals.volumeSum.toFixed(2)} lots`}
          />
        </>
      )}

      {activeTab === "closed" && (
        <>
          <Metric label="Closed Trades" value={String(totals.count)} />

          <Divider />

          <Metric
            label="Net P/L"
            value={formatSignedMoney(totals.pnlSum, currency)}
            className={pnlClass}
          />

          <Divider />

          <Metric
            label="Winners"
            value={String(totals.winners)}
            className="text-emerald-600 dark:text-emerald-400"
          />

          <Metric
            label="Losers"
            value={String(totals.losers)}
            className="text-red-600 dark:text-red-400"
          />

          <Divider />

          <Metric
            label="Win Rate"
            value={
              totals.winRate === null
                ? "—"
                : `${totals.winRate.toFixed(2)}%`
            }
          />
        </>
      )}

      {/* BROKER / ACCOUNT + CURRENCY CHIP */}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {brokerLabel && (
          <span className="rounded-lg bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            {brokerLabel}
          </span>
        )}

        <span className="rounded-lg bg-gray-200 px-2.5 py-1 text-[11px] font-semibold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {currency}
        </span>
      </div>
    </div>
  );
}
