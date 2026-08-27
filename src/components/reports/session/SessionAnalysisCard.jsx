import { useMemo } from "react";

import SessionTable from "./SessionTable";
import SessionSummary from "./SessionSummary";
import SessionProfitChart from "./SessionProfitChart";

import { useJournal } from "../../../context/JournalContext";

export default function SessionAnalysisCard() {
  const { trades = [] } = useJournal();

  const sessionData = useMemo(() => {
    const sessions = [
      {
        key: "london",
        name: "London",
      },
      {
        key: "asia",
        name: "Asia",
      },
      {
        key: "new york",
        name: "New York",
      },
      {
        key: "us new york",
        name: "New York",
      },
    ];

    const normalizeSession = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const calculateSession = (sessionName) => {
      const filteredTrades = trades.filter((trade) => {
        const session = normalizeSession(trade?.session);

        if (sessionName === "London") {
          return session === "london";
        }

        if (sessionName === "Asia") {
          return session === "asia";
        }

        if (sessionName === "New York") {
          return (
            session === "new york" ||
            session === "us new york"
          );
        }

        return false;
      });

      const totalTrades = filteredTrades.length;

      const winningTrades = filteredTrades.filter((trade) => {
        const result = String(
          trade?.result || ""
        ).toLowerCase();

        if (result === "win") {
          return true;
        }

        if (result === "loss") {
          return false;
        }

        return Number(trade?.pnl || 0) > 0;
      }).length;

      const winRate =
        totalTrades > 0
          ? (winningTrades / totalTrades) * 100
          : 0;

      const netPnL = filteredTrades.reduce(
        (sum, trade) =>
          sum + Number(trade?.pnl || 0),
        0
      );

      const rrValues = filteredTrades
        .map((trade) => Number(trade?.rr))
        .filter((value) => Number.isFinite(value));

      const averageRR =
        rrValues.length > 0
          ? rrValues.reduce(
              (sum, value) => sum + value,
              0
            ) / rrValues.length
          : 0;

      const grossProfit = filteredTrades
        .filter(
          (trade) =>
            Number(trade?.pnl || 0) > 0
        )
        .reduce(
          (sum, trade) =>
            sum + Number(trade?.pnl || 0),
          0
        );

      const grossLoss = Math.abs(
        filteredTrades
          .filter(
            (trade) =>
              Number(trade?.pnl || 0) < 0
          )
          .reduce(
            (sum, trade) =>
              sum + Number(trade?.pnl || 0),
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
        id: sessionName.toLowerCase().replace(/\s/g, "-"),
        session: sessionName,
        trades: totalTrades,
        winRate,
        netPnL,
        averageRR,
        profitFactor,
      };
    };

    return [
      calculateSession("London"),
      calculateSession("Asia"),
      calculateSession("New York"),
    ];
  }, [trades]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* HEADER */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Session Analysis
        </h2>
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">

        {/* LEFT */}
        <div className="lg:col-span-9 space-y-6">

          <SessionTable
            data={sessionData}
          />

          <SessionProfitChart
            data={sessionData}
          />

        </div>

        {/* RIGHT */}
        <div className="lg:col-span-3">

          <SessionSummary
            data={sessionData}
          />

        </div>

      </div>
    </div>
  );
}