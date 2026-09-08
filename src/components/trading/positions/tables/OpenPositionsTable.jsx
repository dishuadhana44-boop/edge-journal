import { useMarket } from "../../../../context/MarketContext";

import OpenPositionRow from "../rows/OpenPositionRow";
import EmptyPositions from "../EmptyPositions";

export default function OpenPositionsTable() {
  // ==========================================================
  // REAL cTRADER DATA
  // ==========================================================

  const {
    positions,
    bid,
    ask,
  } = useMarket();

  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    "📊 OPEN POSITIONS FROM cTRADER:",
    positions
  );

  // ==========================================================
  // CONVERT cTRADER POSITION TO UI TRADE FORMAT
  // ==========================================================

  const openTrades = positions.map((position) => {
    const side = String(
      position.side || ""
    ).toLowerCase();

    // ========================================================
    // CURRENT PRICE
    //
    // BUY closes at BID
    // SELL closes at ASK
    // ========================================================

    const currentPrice =
      side === "buy"
        ? bid
        : ask;

    // ========================================================
    // cTRADER VOLUME → LOTS
    //
    // Example:
    // 156400000 protocol volume
    // = 15.64 lots
    // ========================================================

    const protocolVolume = Number(
      position.protocolVolume || 0
    );

    const lots =
      protocolVolume > 0
        ? protocolVolume / 10000000
        : 0;

    // ========================================================
    // UI TRADE OBJECT
    // ========================================================

    return {
      // ID

      id: String(position.positionId),
      positionId: String(position.positionId),

      // INSTRUMENT

      symbol:
        position.symbol || "UNKNOWN",

      instrument:
        position.symbol || "UNKNOWN",

      // SIDE

      side:
        side === "buy"
          ? "BUY"
          : "SELL",

      // LOTS

      lots: Number(
        lots.toFixed(2)
      ),

      // PRICES

      entry:
        Number(position.entryPrice || 0),

      entryPrice:
        Number(position.entryPrice || 0),

      current:
        Number(currentPrice || 0),

      currentPrice:
        Number(currentPrice || 0),

      // TAKE PROFIT

      takeProfit:
        position.takeProfit ||
        position.tp ||
        null,

      // STOP LOSS

      stopLoss:
        position.stopLoss ||
        position.sl ||
        null,

      // MARGIN

      margin:
        Number(
          position.usedMargin || 0
        ),

      // COMMISSION

      commission:
        Number(
          position.commission || 0
        ),

      // SWAP

      swap:
        Number(
          position.swap || 0
        ),

      // TIME

      openTimestamp:
        position.openTimestamp || null,

      // ORIGINAL DATA

      rawPosition: position,
    };
  });

  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    "📋 TABLE OPEN TRADES:",
    openTrades
  );

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div
      className="
        h-[340px]
        overflow-y-auto
        overflow-x-auto
      "
    >
      <table className="w-full">
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <thead className="sticky top-0 bg-white z-20">
          <tr className="text-xs uppercase text-gray-500">

            <th className="w-[90px] px-6 py-4 text-left">
              Instrument
            </th>

            <th className="w-[90px] text-center">
              Side
            </th>

            <th className="w-[90px] text-center">
              Lots
            </th>

            <th className="w-[90px] text-right">
              Entry
            </th>

            <th className="w-[90px] text-right">
              Current
            </th>

            <th className="w-[90px] text-right">
              Take Profit
            </th>

            <th className="w-[90px] text-right">
              Stop Loss
            </th>

            <th className="w-[90px] text-right">
              P/L
            </th>

            <th className="w-[90px] text-right">
              Margin
            </th>

            <th className="w-[90px] text-right">
              Duration
            </th>

            <th className="w-[90px] text-center">
              Actions
            </th>

          </tr>
        </thead>

        {/* ================================================== */}
        {/* BODY */}
        {/* ================================================== */}

        <tbody>
          {openTrades.length === 0 ? (
            <tr>
              <td colSpan={11}>
                <EmptyPositions />
              </td>
            </tr>
          ) : (
            openTrades.map((trade) => (
              <OpenPositionRow
                key={trade.id}
                trade={trade}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}