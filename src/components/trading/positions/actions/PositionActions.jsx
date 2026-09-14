import { useEffect, useRef, useState } from "react";
import {
  MoreVertical,
  X,
  Pencil,
  Copy,
  RotateCw,
  Scissors,
} from "lucide-react";

import { useTrade } from "../../../../context/TradeContext";

export default function PositionActions({ trade }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const menuRef = useRef(null);

  const { closeTrade } = useTrade();

  // ==========================================================
  // CLOSE MENU WHEN CLICKING OUTSIDE
  // ==========================================================

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  // ==========================================================
  // CLOSE TRADE
  // ==========================================================

  const handleCloseTrade = async () => {
    if (closing) return;

    const ticket =
      trade?.ticket ??
      trade?.brokerPositionId ??
      trade?.positionId;

    const tradeId =
      trade?.id ??
      trade?.positionId ??
      trade?.brokerPositionId ??
      trade?.ticket;

    if (!ticket) {
      console.warn(
        "⚠️ Cannot close position: missing MT5 ticket",
        trade
      );
      return;
    }

    // --------------------------------------------------------
    // cTrader / other broker
    // --------------------------------------------------------

    if (trade?.broker !== "MT5") {
      console.log("🔵 NON-MT5 CLOSE:", trade);

      closeTrade(tradeId);
      setOpen(false);

      return;
    }

    // --------------------------------------------------------
    // MT5 REAL CLOSE
    // --------------------------------------------------------

    try {
      setClosing(true);

      console.log("🔴 MT5 CLOSE REQUEST:", {
        ticket,
        symbol: trade?.symbol,
        volume: trade?.quantity ?? trade?.volume,
      });

      const response = await fetch(
        "http://localhost:4000/api/mt5/close-position",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticket,
            volume:
              trade?.quantity ??
              trade?.volume ??
              undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to close MT5 position."
        );
      }

      console.log("✅ MT5 CLOSE SUCCESS:", data);

      setOpen(false);

      // ------------------------------------------------------
      // Do NOT manually remove the position here.
      //
      // TradeContext MT5 polling will detect that the
      // broker position disappeared and update openTrades.
      // ------------------------------------------------------

    } catch (error) {
      console.error("❌ MT5 CLOSE FAILED:", error);

      alert(
        error?.message ||
          "Unable to close the MT5 position."
      );
    } finally {
      setClosing(false);
    }
  };

  // ==========================================================
  // PLACEHOLDER ACTIONS
  // ==========================================================

  const handleModify = () => {
    console.log("✏️ MODIFY TRADE:", trade);
    setOpen(false);
  };

  const handleDuplicate = () => {
    console.log("📋 DUPLICATE TRADE:", trade);
    setOpen(false);
  };

  const handleReverse = () => {
    console.log("🔄 REVERSE POSITION:", trade);
    setOpen(false);
  };

  const handlePartialClose = () => {
    console.log("✂️ PARTIAL CLOSE:", trade);
    setOpen(false);
  };

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      {/* ======================================================
          ACTION BUTTON
      ====================================================== */}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="
          p-2
          rounded-lg
          hover:bg-gray-100
          transition-colors
        "
        aria-label="Position actions"
        aria-expanded={open}
        disabled={closing}
      >
        <MoreVertical size={17} />
      </button>

      {/* ======================================================
          ACTION MENU
      ====================================================== */}

      {open && (
        <div
          className="
            absolute
            right-0
            mt-2
            w-52
            rounded-xl
            border
            border-gray-200
            bg-white
            shadow-xl
            overflow-hidden
            z-50
          "
        >
          {/* MODIFY */}

          <button
            type="button"
            onClick={handleModify}
            disabled={closing}
            className="
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-left
              hover:bg-gray-50
              transition-colors
              disabled:opacity-50
            "
          >
            <Pencil size={16} />
            Modify Trade
          </button>

          {/* DUPLICATE */}

          <button
            type="button"
            onClick={handleDuplicate}
            disabled={closing}
            className="
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-left
              hover:bg-gray-50
              transition-colors
              disabled:opacity-50
            "
          >
            <Copy size={16} />
            Duplicate
          </button>

          {/* REVERSE */}

          <button
            type="button"
            onClick={handleReverse}
            disabled={closing}
            className="
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-left
              hover:bg-gray-50
              transition-colors
              disabled:opacity-50
            "
          >
            <RotateCw size={16} />
            Reverse Position
          </button>

          {/* PARTIAL CLOSE */}

          <button
            type="button"
            onClick={handlePartialClose}
            disabled={closing}
            className="
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-left
              hover:bg-gray-50
              transition-colors
              disabled:opacity-50
            "
          >
            <Scissors size={16} />
            Partial Close
          </button>

          {/* DIVIDER */}

          <div className="border-t border-gray-100" />

          {/* CLOSE */}

          <button
            type="button"
            onClick={handleCloseTrade}
            disabled={closing}
            className="
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-left
              text-red-600
              hover:bg-red-50
              transition-colors
              disabled:opacity-50
            "
          >
            <X size={16} />

            {closing ? "Closing..." : "Close Trade"}
          </button>
        </div>
      )}
    </div>
  );
}