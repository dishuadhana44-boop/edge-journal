import { useMemo } from "react";

import LongShortChart from "./LongShortChart";
import LongShortComparison from "./LongShortComparison";

import { useJournal } from "../../../context/JournalContext";

export default function LongShortCard() {
  const { trades = [] } = useJournal();

  const longShortData = useMemo(() => {
    const calculateStats = (direction) => {
      const filteredTrades = trades.filter((trade) => {
        const value = String(
          trade?.direction || ""
        ).toLowerCase();

        if (direction === "Long") {
          return (
            value === "long" ||
            value === "buy"
          );
        }

        return (
          value === "short" ||
          value === "sell"
        );
      });

      const totalTrades =
        filteredTrades.length;

      const winningTrades =
        filteredTrades.filter((trade) => {
          const result = String(
            trade?.result || ""
          ).toLowerCase();

          if (result === "win") return true;
          if (result === "loss") return false;

          return Number(trade?.pnl || 0) > 0;
        }).length;

      const winRate =
        totalTrades > 0
          ? (winningTrades / totalTrades) * 100
          : 0;

      const totalPnL =
        filteredTrades.reduce(
          (sum, trade) =>
            sum + Number(trade?.pnl || 0),
          0
        );

      const rrValues =
        filteredTrades
          .map((trade) =>
            Number(trade?.rr)
          )
          .filter(
            (value) =>
              Number.isFinite(value)
          );

      const averageRR =
        rrValues.length > 0
          ? rrValues.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / rrValues.length
          : 0;

      // -----------------------------------------
      // PROFIT FACTOR
      // Gross Profit / Gross Loss
      // -----------------------------------------

      const grossProfit =
        filteredTrades
          .filter(
            (trade) =>
              Number(trade?.pnl || 0) > 0
          )
          .reduce(
            (sum, trade) =>
              sum +
              Number(trade?.pnl || 0),
            0
          );

      const grossLoss =
        Math.abs(
          filteredTrades
            .filter(
              (trade) =>
                Number(trade?.pnl || 0) < 0
            )
            .reduce(
              (sum, trade) =>
                sum +
                Number(trade?.pnl || 0),
              0
            )
        );

      const profitFactor =
        grossLoss > 0
          ? grossProfit / grossLoss
          : grossProfit > 0
            ? Infinity
            : 0;

      return {
        direction,
        trades: totalTrades,
        winRate,
        pnl: totalPnL,
        rr: averageRR,
        profitFactor,
      };
    };

    return [
      calculateStats("Long"),
      calculateStats("Short"),
    ];
  }, [trades]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* HEADER */}

      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Long vs Short Analysis
        </h2>
      </div>

      {/* CONTENT */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">

        <LongShortChart
          data={longShortData}
        />

        <LongShortComparison
          data={longShortData}
        />

      </div>

    </div>
  );
}