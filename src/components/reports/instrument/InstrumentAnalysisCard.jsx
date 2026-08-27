import { useMemo } from "react";

import { useJournal } from "../../../context/JournalContext";

import InstrumentTable from "./InstrumentTable";
import InstrumentSummary from "./InstrumentSummary";
import InstrumentProfitChart from "./InstrumentProfitChart";

export default function InstrumentAnalysisCard() {
  const { trades = [] } = useJournal();

  const instrumentData = useMemo(() => {
    const grouped = {};

    trades.forEach((trade) => {
      const instrument =
        trade?.pair ||
        trade?.symbol ||
        trade?.instrument ||
        "Unknown";

      if (!grouped[instrument]) {
        grouped[instrument] = {
          instrument,
          trades: 0,
          winningTrades: 0,
          pnl: 0,
          rrValues: [],
        };
      }

      const item = grouped[instrument];

      item.trades += 1;

      const pnl = Number(trade?.pnl || 0);

      item.pnl += pnl;

      const result = String(
        trade?.result || ""
      ).toLowerCase();

      if (
        result === "win" ||
        pnl > 0
      ) {
        item.winningTrades += 1;
      }

      const rr = Number(trade?.rr);

      if (Number.isFinite(rr)) {
        item.rrValues.push(rr);
      }
    });

    return Object.values(grouped)
      .map((item) => {
        const winRate =
          item.trades > 0
            ? (item.winningTrades / item.trades) *
              100
            : 0;

        const avgRR =
          item.rrValues.length > 0
            ? item.rrValues.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) / item.rrValues.length
            : 0;

        const grossProfit = trades
          .filter((trade) => {
            const instrument =
              trade?.pair ||
              trade?.symbol ||
              trade?.instrument ||
              "Unknown";

            return (
              instrument ===
              item.instrument
            );
          })
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

        const grossLoss = Math.abs(
          trades
            .filter((trade) => {
              const instrument =
                trade?.pair ||
                trade?.symbol ||
                trade?.instrument ||
                "Unknown";

              return (
                instrument ===
                item.instrument
              );
            })
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
          instrument: item.instrument,

          market: getMarket(
            item.instrument
          ),

          trades: item.trades,

          winRate,

          pnl: item.pnl,

          rr: avgRR,

          profitFactor,
        };
      })
      .sort(
        (a, b) =>
          b.pnl - a.pnl
      );
  }, [trades]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* HEADER */}

      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Instrument Analysis
        </h2>
      </div>

      {/* CONTENT */}

      <div className="grid grid-cols-12 gap-6 p-6">

        {/* LEFT */}

        <div className="col-span-9 space-y-6">

          <InstrumentTable
            data={instrumentData}
          />

          <InstrumentProfitChart
            data={instrumentData}
          />

        </div>

        {/* RIGHT */}

        <div className="col-span-3">

          <InstrumentSummary
            data={instrumentData}
          />

        </div>

      </div>

    </div>
  );
}


/* =================================================
   MARKET CLASSIFICATION
================================================= */

function getMarket(instrument) {
  const value = String(
    instrument || ""
  ).toUpperCase();

  if (
    value.includes("NIFTY") ||
    value.includes("SENSEX") ||
    value.includes("BANKNIFTY")
  ) {
    return "Index";
  }

  if (
    value.includes("BTC") ||
    value.includes("ETH") ||
    value.includes("SOL") ||
    value.includes("XRP")
  ) {
    return "Crypto";
  }

  if (
    value.includes("GOLD") ||
    value.includes("XAU") ||
    value.includes("SILVER") ||
    value.includes("XAG")
  ) {
    return "Commodity";
  }

  if (
    value.includes("EUR") ||
    value.includes("USD") ||
    value.includes("GBP") ||
    value.includes("JPY") ||
    value.includes("AUD") ||
    value.includes("CAD") ||
    value.includes("CHF")
  ) {
    return "Forex";
  }

  return "Other";
}