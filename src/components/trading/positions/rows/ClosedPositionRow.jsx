import { MoreVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function ClosedPositionRow({
  trade,
  demo = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  if (!trade) return null;

  // ==========================================================
  // BASIC VALUES
  // ==========================================================

  const symbol =
    trade.symbol ||
    trade.instrument ||
    trade.symbolName ||
    "UNKNOWN";

  const rawSide =
    trade.side ??
    trade.direction ??
    trade.tradeSide ??
    trade.type ??
    trade.positionType ??
    "";

  const normalizeSide = (value) => {
    const numericValue = Number(value);

    if (numericValue === 0) return "BUY";
    if (numericValue === 1) return "SELL";

    const normalized = String(value).toLowerCase();

    if (
      normalized === "buy" ||
      normalized === "long"
    ) {
      return "BUY";
    }

    if (
      normalized === "sell" ||
      normalized === "short"
    ) {
      return "SELL";
    }

    return String(value || "-").toUpperCase();
  };

  const side = normalizeSide(rawSide);

  const quantity = Number(
    trade.quantity ??
    trade.lots ??
    trade.volumeLots ??
    trade.volume ??
    0
  );

  const entry = Number(
    trade.entry ??
    trade.entryPrice ??
    trade.priceOpen ??
    trade.price_open ??
    trade.openPrice ??
    0
  );

  const exit = Number(
    trade.exit ??
    trade.exitPrice ??
    trade.closePrice ??
    trade.priceClose ??
    trade.price_close ??
    0
  );

  const takeProfit = Number(
    trade.takeProfit ??
    trade.tp ??
    0
  );

  const stopLoss = Number(
    trade.stopLoss ??
    trade.sl ??
    0
  );

  const pnl = Number(
    trade.netProfit ??
    trade.netPnL ??
    trade.netPnl ??
    trade.profit ??
    trade.pnl ??
    trade.grossProfit ??
    0
  );

  const commission = Number(
    trade.commission ??
    trade.commissions ??
    0
  );

  const tradeId =
    trade.positionId ??
    trade.brokerPositionId ??
    trade.ticket ??
    trade.orderId ??
    trade.id ??
    "-";

  // ==========================================================
  // DURATION
  // ==========================================================

  const duration =
    trade.duration ||
    trade.tradeDuration ||
    "-";

  // ==========================================================
  // FORMAT PRICE
  // ==========================================================

  const formatPrice = (value) => {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return "-";
    }

    return value.toFixed(5);
  };

  // ==========================================================
  // FORMAT MONEY
  // ==========================================================

  const formatMoney = (value) => {
    if (!Number.isFinite(value)) {
      return "$0.00";
    }

    return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <tr
      className="
        border-t
        border-gray-100
        hover:bg-gray-50
        transition
      "
    >

      {/* ====================================================
          INSTRUMENT
      ==================================================== */}

      <td className="w-[110px] px-6 py-4 text-left whitespace-nowrap">

        <span className="font-semibold text-gray-900">
          {symbol}
        </span>

      </td>

      {/* ====================================================
          SIDE
      ==================================================== */}

      <td className="w-[90px] text-center whitespace-nowrap">

        <span
          className={`
            px-2
            py-1
            rounded-lg
            text-xs
            font-semibold
            ${
              side === "BUY"
                ? "bg-emerald-100 text-emerald-700"
                : side === "SELL"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }
          `}
        >
          {side}
        </span>

      </td>

      {/* ====================================================
          LOTS
      ==================================================== */}

      <td className="w-[90px] text-center whitespace-nowrap">

        {Number.isFinite(quantity)
          ? quantity.toFixed(2)
          : "0.00"}

      </td>

      {/* ====================================================
          ENTRY
      ==================================================== */}

      <td className="w-[100px] text-right whitespace-nowrap">

        {formatPrice(entry)}

      </td>

      {/* ====================================================
          EXIT
      ==================================================== */}

      <td className="w-[100px] text-right whitespace-nowrap">

        {formatPrice(exit)}

      </td>

      {/* ====================================================
          TAKE PROFIT
      ==================================================== */}

      <td className="w-[110px] text-right text-emerald-600 whitespace-nowrap">

        {formatPrice(takeProfit)}

      </td>

      {/* ====================================================
          STOP LOSS
      ==================================================== */}

      <td className="w-[110px] text-right text-red-600 whitespace-nowrap">

        {formatPrice(stopLoss)}

      </td>

      {/* ====================================================
          P/L
      ==================================================== */}

      <td className="w-[100px] text-right whitespace-nowrap">

        <span
          className={`
            font-semibold
            ${
              pnl >= 0
                ? "text-emerald-600"
                : "text-red-600"
            }
          `}
        >
          {formatMoney(pnl)}
        </span>

      </td>

      {/* ====================================================
          COMMISSION
      ==================================================== */}

      <td className="w-[110px] text-right whitespace-nowrap">

        <span className="font-medium text-gray-700">
          $
          {Number.isFinite(commission)
            ? commission.toFixed(2)
            : "0.00"}
        </span>

      </td>

      {/* ====================================================
          DURATION
      ==================================================== */}

      <td className="w-[100px] text-right whitespace-nowrap">

        <span className="font-medium text-gray-700">
          {duration}
        </span>

      </td>

      {/* ====================================================
          ACTIONS
      ==================================================== */}

      <td className="w-[100px] text-center relative">

        <div
          ref={menuRef}
          className="relative inline-block"
        >

          {/* THREE DOT BUTTON */}

          <button
            type="button"
            onClick={() =>
              setMenuOpen(
                (prev) => !prev
              )
            }
            className="
              w-9
              h-9
              rounded-lg
              border
              border-gray-300
              bg-white
              hover:bg-gray-100
              flex
              items-center
              justify-center
              transition
            "
          >
            <MoreVertical
              size={18}
              className="text-gray-700"
            />
          </button>

          {/* DROPDOWN */}

          {menuOpen && (

            <div
              className="
                absolute
                right-0
                top-11
                z-[100]
                w-[180px]
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-white
                shadow-xl
              "
            >

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);

                  console.log(
                    "📕 CLOSED TRADE DETAILS:",
                    {
                      tradeId,
                      trade,
                    }
                  );
                }}
                className="
                  w-full
                  px-4
                  py-3
                  text-left
                  text-sm
                  text-gray-700
                  hover:bg-gray-50
                  transition
                "
              >
                View Details
              </button>

            </div>

          )}

        </div>

      </td>

    </tr>
  );
}