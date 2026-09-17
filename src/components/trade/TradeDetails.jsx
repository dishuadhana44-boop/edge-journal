import { useParams } from "react-router-dom";
import { useJournal } from "../../context/JournalContext";

function TradeDetails() {
  const { id } = useParams();

  const { trades } = useJournal();

  const trade = trades.find(
    (t) => String(t.id) === String(id)
  );

  if (!trade) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-2xl font-bold">
          Trade Not Found
        </h2>
      </div>
    );
  }

  // ============================================================
  // DURATION
  // ============================================================

  const getDurationSeconds = () => {
    // 1. Prefer saved durationSeconds
    const savedDuration = Number(
      trade.durationSeconds
    );

    if (
      Number.isFinite(savedDuration) &&
      savedDuration >= 0
    ) {
      return Math.floor(savedDuration);
    }

    // 2. Fallback: calculate from openedAt -> closedAt
    if (
      trade.openedAt &&
      trade.closedAt
    ) {
      const openedTime = new Date(
        trade.openedAt
      ).getTime();

      const closedTime = new Date(
        trade.closedAt
      ).getTime();

      if (
        Number.isFinite(openedTime) &&
        Number.isFinite(closedTime) &&
        closedTime >= openedTime
      ) {
        return Math.floor(
          (closedTime - openedTime) / 1000
        );
      }
    }

    // 3. Fallback for old journal data
    if (
      typeof trade.duration === "number" &&
      Number.isFinite(trade.duration) &&
      trade.duration >= 0
    ) {
      return Math.floor(trade.duration);
    }

    return 0;
  };

  const durationSeconds =
    getDurationSeconds();

  // ============================================================
  // FORMAT DURATION
  // ============================================================

  const formatDuration = (seconds) => {
    if (
      !Number.isFinite(seconds) ||
      seconds < 0
    ) {
      return "-";
    }

    const totalSeconds =
      Math.floor(seconds);

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const secs =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}min ${secs}s`;
    }

    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }

    return `${secs}s`;
  };

  const durationText =
    formatDuration(
      durationSeconds
    );

  // ============================================================
  // P&L
  // ============================================================

  const pnl = Number(
    trade.pnl ??
      trade.netProfit ??
      trade.netPnL ??
      0
  );

  // ============================================================
  // LOT SIZE
  // ============================================================

  const lotSize =
    trade.lotSize ??
    trade.quantity ??
    trade.volume ??
    "-";

  // ============================================================
  // ACCOUNT
  // ============================================================

  const account =
    trade.account ??
    trade.accountId ??
    "-";

  // ============================================================
  // DATE
  // ============================================================

  const formattedDate = trade.date
    ? new Date(
        trade.date
      ).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      )
    : "-";

  // ============================================================
  // ENTRY / EXIT TIME
  // ============================================================

  const formatTime = (time) => {
    if (!time) {
      return "-";
    }

    let timestamp;

    // Numeric timestamp
    const numericTime = Number(time);

    if (
      Number.isFinite(numericTime) &&
      numericTime > 0
    ) {
      timestamp =
        numericTime < 100000000000
          ? numericTime * 1000
          : numericTime;
    } else {
      // ISO / date string
      timestamp =
        new Date(time).getTime();
    }

    if (
      !Number.isFinite(timestamp) ||
      timestamp <= 0
    ) {
      return String(time);
    }

    return new Date(
      timestamp
    ).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      }
    );
  };

  // Prefer actual saved entry/exit timestamps.
  // openedAt/closedAt are fallback values.

  const entryTime =
    trade.entryTime ||
    trade.openedAt ||
    trade.openTime ||
    trade.time;

  const exitTime =
    trade.exitTime ||
    trade.closedAt ||
    trade.closeTime;

  // ============================================================
  // RISK / RETURN
  // ============================================================

  const riskR =
    trade.riskR ??
    trade.risk ??
    "-";

  const returnR =
    trade.returnR ??
    trade.realizedR ??
    trade.rr ??
    trade.riskReward ??
    "-";

  // ============================================================
  // PRICE VALUES
  // ============================================================

  const entryPrice =
    trade.entryPrice ??
    trade.entry ??
    "-";

  const stopLoss =
    trade.stopLoss ??
    "-";

  const takeProfit =
    trade.takeProfit ??
    "-";

  // ============================================================
  // TRADE TYPE / TIMEFRAME
  // ============================================================

  const tradeType =
    trade.tradeType ??
    trade.orderType ??
    "Market";

  const timeframe =
    trade.timeframe ??
    "-";

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="w-[300px] h-[1040px] bg-white border border-gray-200 rounded-2xl overflow-hidden">

      {/* =====================================================
          TRADE DETAILS
      ===================================================== */}

      <div className="px-5 py-5 border-b border-gray-200">
        <h2 className="text-lg font-semibold">
          Trade Details
        </h2>

        <div className="mt-5">
          <h1
            className={`text-4xl font-bold ${
              pnl < 0
                ? "text-red-500"
                : "text-green-500"
            }`}
          >
            {pnl}
          </h1>

          <p className="text-xs text-gray-400 mt-1">
            NET P&L
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-7">

          <div>
            <p className="text-[10px] uppercase text-gray-400">
              Instrument
            </p>

            <p className="font-semibold mt-1">
              {trade.pair ||
                trade.symbol ||
                "-"}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase text-gray-400">
              Direction
            </p>

            <p className="font-semibold mt-1">
              {trade.direction ||
                "-"}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase text-gray-400">
              Lot Size
            </p>

            <p className="font-semibold mt-1">
              {lotSize}
            </p>
          </div>

        </div>
      </div>

      {/* =====================================================
          EXECUTION
      ===================================================== */}

      <div className="px-5 py-5 border-b border-gray-200">

        <h3 className="font-semibold text-sm mb-4">
          Execution
        </h3>

        <div className="space-y-3">

          <Row
            label="Date"
            value={formattedDate}
          />

          <Row
            label="Session"
            value={
              trade.session || "-"
            }
          />

          <Row
            label="Entry Time"
            value={formatTime(
              entryTime
            )}
          />

          <Row
            label="Exit Time"
            value={formatTime(
              exitTime
            )}
          />

          <Row
            label="Duration"
            value={durationText}
          />

          <Row
            label="Entry Price"
            value={entryPrice}
          />

          <Row
            label="Stop Loss"
            value={stopLoss}
          />

          <Row
            label="Take Profit"
            value={takeProfit}
          />

        </div>
      </div>

      {/* =====================================================
          POSITION
      ===================================================== */}

      <div className="px-5 py-5">

        <h3 className="font-semibold text-sm mb-4">
          Position
        </h3>

        <div className="space-y-3">

          <Row
            label="Lot Size"
            value={lotSize}
          />

          <Row
            label="Account"
            value={account}
          />

        </div>
      </div>

      {/* =====================================================
          PERFORMANCE
      ===================================================== */}

      <div className="px-5 py-5">

        <h3 className="font-semibold text-sm mb-4">
          Performance
        </h3>

        <div className="space-y-3">

          <Row
            label="Risk (R)"
            value={riskR}
          />

          <Row
            label="Return (R)"
            value={returnR}
          />

        </div>
      </div>

      {/* =====================================================
          EXTRA
      ===================================================== */}

      <div className="px-5 py-5">

        <h3 className="font-semibold text-sm mb-4">
          Extra
        </h3>

        <div className="space-y-3">

          <Row
            label="Trade Type"
            value={tradeType}
          />

          <Row
            label="Timeframe"
            value={timeframe}
          />

        </div>
      </div>

    </div>
  );
}

// ============================================================
// ROW
// ============================================================

function Row({
  label,
  value,
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">
        {label}
      </span>

      <span className="font-medium text-gray-900 text-right">
        {value}
      </span>
    </div>
  );
}

export default TradeDetails;