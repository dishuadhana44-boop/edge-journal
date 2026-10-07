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
  // SAFE NUMBER HELPER
  // ============================================================

  const toNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  };

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

    const days = Math.floor(
      totalSeconds / 86400
    );

    const hours = Math.floor(
      (totalSeconds % 86400) / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const secs =
      totalSeconds % 60;

    const parts = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (minutes > 0) {
      parts.push(`${minutes}min`);
    }

    if (
      secs > 0 &&
      days === 0 &&
      hours === 0
    ) {
      parts.push(`${secs}s`);
    }

    if (parts.length === 0) {
      return "0s";
    }

    return parts.join(" ");
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
      trade.realizedPnL ??
      0
  );

  // ============================================================
  // LOT SIZE
  // ============================================================

  const lotSize =
    trade.lotSize ??
    trade.quantity ??
    trade.volume ??
    trade.lots ??
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

  const formattedDate =
    trade.date ||
    trade.openedAt ||
    trade.openTime
      ? new Date(
          trade.date ||
            trade.openedAt ||
            trade.openTime
        ).toLocaleDateString(
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          }
        )
      : "-";

  // ============================================================
  // ENTRY / EXIT TIME
  // ============================================================

  const timestampToMs = (value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }

    if (value instanceof Date) {
      const ms = value.getTime();

      return Number.isFinite(ms) &&
        ms > 0
        ? ms
        : null;
    }

    const numeric = Number(value);

    if (
      Number.isFinite(numeric) &&
      numeric > 0
    ) {
      return numeric < 100000000000
        ? numeric * 1000
        : numeric;
    }

    const parsed =
      new Date(value).getTime();

    return Number.isFinite(parsed) &&
      parsed > 0
      ? parsed
      : null;
  };

  const formatTime = (time) => {
    if (!time) {
      return "-";
    }

    const timestamp =
      timestampToMs(time);

    if (
      timestamp === null
    ) {
      return String(time);
    }

    const localTimestamp =
    timestamp - (3 * 60 * 60 * 1000);
  
  return new Date(
    localTimestamp
  ).toLocaleTimeString(
    "en-IN",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );
  };

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
  // PRICE VALUES
  // ============================================================

  const entryPrice = toNumber(
    trade.entryPrice ??
      trade.entry ??
      trade.openPrice
  );

  const stopLoss = toNumber(
    trade.stopLoss ??
      trade.sl
  );

  const takeProfit = toNumber(
    trade.takeProfit ??
      trade.tp
  );

  const exitPrice = toNumber(
    trade.exitPrice ??
      trade.exit ??
      trade.closePrice ??
      trade.close
  );

  // ============================================================
  // DIRECTION
  // ============================================================

  const rawDirection =
    trade.direction ??
    trade.side ??
    trade.type ??
    "";

  const direction =
    String(rawDirection)
      .toLowerCase();

  const isBuy =
    direction === "buy" ||
    direction === "long";

  const isSell =
    direction === "sell" ||
    direction === "short";

  // ============================================================
  // RISK / REWARD CALCULATION
  // ============================================================

  let riskDistance = null;
  let plannedRewardDistance = null;
  let plannedRiskReward = null;

  if (
    entryPrice !== null &&
    stopLoss !== null &&
    takeProfit !== null
  ) {
    riskDistance =
      Math.abs(
        entryPrice -
          stopLoss
      );

    plannedRewardDistance =
      Math.abs(
        takeProfit -
          entryPrice
      );

    if (
      riskDistance > 0 &&
      plannedRewardDistance >= 0
    ) {
      plannedRiskReward =
        plannedRewardDistance /
        riskDistance;
    }
  }

  // ============================================================
  // REALIZED R
  // ============================================================

  let realizedR = null;

  if (
    entryPrice !== null &&
    stopLoss !== null &&
    exitPrice !== null
  ) {
    riskDistance =
      Math.abs(
        entryPrice -
          stopLoss
      );

    if (riskDistance > 0) {
      let realizedMove;

      if (isBuy) {
        realizedMove =
          exitPrice -
          entryPrice;
      } else if (isSell) {
        realizedMove =
          entryPrice -
          exitPrice;
      } else {
        // Fallback based on P&L sign
        realizedMove =
          pnl >= 0
            ? Math.abs(
                exitPrice -
                  entryPrice
              )
            : -Math.abs(
                exitPrice -
                  entryPrice
              );
      }

      realizedR =
        realizedMove /
        riskDistance;
    }
  }

  // ============================================================
  // DISPLAY RISK / REWARD
  // ============================================================

  const savedRiskR =
    toNumber(
      trade.riskR ??
        trade.risk
    );

  const savedReturnR =
    toNumber(
      trade.returnR ??
        trade.realizedR
    );

  const riskRText =
    savedRiskR !== null
      ? `${savedRiskR.toFixed(2)}R`
      : riskDistance !== null
        ? "1.00R"
        : "-";

  const returnRValue =
    realizedR !== null
      ? realizedR
      : savedReturnR !== null
        ? savedReturnR
        : null;

  const returnRText =
    returnRValue !== null
      ? `${returnRValue >= 0 ? "+" : ""}${returnRValue.toFixed(2)}R`
      : "-";

  const riskRewardValue =
    plannedRiskReward !== null
      ? plannedRiskReward
      : toNumber(
          trade.riskRewardRatio ??
            trade.riskReward ??
            trade.rr
        );

  const riskRewardText =
    riskRewardValue !== null
      ? `1:${riskRewardValue.toFixed(2)}`
      : "-";

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
            {pnl < 0
  ? `-$${Math.abs(Number(pnl)).toFixed(0)}`
  : `$${Number(pnl).toFixed(0)}`}
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
            value={
              entryPrice !== null
                ? entryPrice
                : "-"
            }
          />

          <Row
            label="Stop Loss"
            value={
              stopLoss !== null
                ? stopLoss
                : "-"
            }
          />

          <Row
            label="Take Profit"
            value={
              takeProfit !== null
                ? takeProfit
                : "-"
            }
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
            value={riskRText}
          />

          <Row
            label="Return (R)"
            value={returnRText}
          />

          <Row
            label="Risk / Reward"
            value={riskRewardText}
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