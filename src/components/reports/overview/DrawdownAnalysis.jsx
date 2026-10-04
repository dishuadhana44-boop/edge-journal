import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

export default function DrawdownAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const data = useMemo(() => {
    if (!Array.isArray(filteredTrades) || filteredTrades.length === 0) {
      return {
        maxDrawdown: 0,
        currentDrawdown: 0,
        recovery: 0,
      };
    }

    const trades = [...filteredTrades].sort((a, b) => {
      const dateA = new Date(a?.date || a?.openedAt || 0).getTime();
      const dateB = new Date(b?.date || b?.openedAt || 0).getTime();

      return dateA - dateB;
    });

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;

    for (const trade of trades) {
      const pnl = Number(
        trade?.pnl ??
          trade?.profit ??
          trade?.netPL ??
          trade?.netProfit ??
          0
      );

      const safePnL = Number.isFinite(pnl) ? pnl : 0;

      equity += safePnL;

      if (equity > peak) {
        peak = equity;
      }

      const drawdown = peak - equity;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      currentDrawdown = drawdown;
    }

    const recovery =
      maxDrawdown > 0
        ? Math.max(
            0,
            ((maxDrawdown - currentDrawdown) /
              maxDrawdown) *
              100
          )
        : 100;

    return {
      maxDrawdown,
      currentDrawdown,
      recovery,
    };
  }, [filteredTrades]);

  const formatMoney = (value) => {
    return `$${Math.abs(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Drawdown Analysis
        </h3>

      
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Max Drawdown
          </p>

          <p className="mt-2 text-xl font-semibold text-red-600">
            {formatMoney(data.maxDrawdown)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Current Drawdown
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {formatMoney(data.currentDrawdown)}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Recovery
          </p>

          <p className="mt-2 text-xl font-semibold text-gray-900">
            {data.recovery.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}