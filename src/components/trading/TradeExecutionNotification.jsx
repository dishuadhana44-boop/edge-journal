
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useTrade } from "../../context/TradeContext";

const emotions = [
  { emoji: "😎", label: "Confident" },
  { emoji: "🧘", label: "Calm" },
  { emoji: "🔥", label: "Excited" },
  { emoji: "😨", label: "Fearful" },
  { emoji: "😤", label: "Frustrated" },
  { emoji: "🤔", label: "Unsure" },
];

// ==========================================================
// PROFESSIONAL TRADING NOTIFICATION SOUND
// ==========================================================

const playNotificationSound = (type = "entry") => {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    if (type === "entry") {
      // Soft ascending entry sound
      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        780,
        now + 0.16
      );

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(
        0.12,
        now + 0.02
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.28
      );

      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } else {
      // Soft descending exit sound
      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(620, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        360,
        now + 0.18
      );

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(
        0.09,
        now + 0.02
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.24
      );

      oscillator.start(now);
      oscillator.stop(now + 0.26);
    }

    oscillator.addEventListener("ended", () => {
      audioContext.close().catch(() => {});
    });
  } catch (error) {
    console.log("🔇 Notification sound unavailable");
  }
};

// ==========================================================
// COMPONENT
// ==========================================================

export default function TradeExecutionNotification() {
  const navigate = useNavigate();

  const {
    tradeNotification,
    hideTradeNotification,
    updateBrokerPosition,
  } = useTrade();

  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const closeTimerRef = useRef(null);
  const soundPlayedRef = useRef(false);

  const trade = tradeNotification?.trade;

  const notificationType =
    tradeNotification?.type || "entry";

  const isExit = notificationType === "exit";

  // ========================================================
  // RESET AND PLAY SOUND
  // ========================================================

  useEffect(() => {
    if (!trade) {
      setSelectedEmotion(null);
      setIsClosing(false);
      soundPlayedRef.current = false;
      return;
    }

    setSelectedEmotion(null);
    setIsClosing(false);
    soundPlayedRef.current = false;

    if (!soundPlayedRef.current) {
      playNotificationSound(notificationType);
      soundPlayedRef.current = true;
    }

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [tradeNotification, notificationType, trade]);

  // ========================================================
  // CLOSE NOTIFICATION
  // ========================================================

  const handleClose = () => {
    if (isClosing) return;

    setIsClosing(true);

    closeTimerRef.current = setTimeout(() => {
      hideTradeNotification();
      setIsClosing(false);
    }, 220);
  };

  // ========================================================
  // OPEN ADVANCED JOURNAL
  // ========================================================

  const handleOpenJournal = () => {
    if (!trade?.id) {
      console.warn(
        "⚠️ Cannot open journal: Trade ID is missing",
        trade
      );
      return;
    }

    // Close notification first
    hideTradeNotification();

    // Open exact Advanced Trade Detail page
    navigate(`/trade/${trade.id}`);
  };

  // ========================================================
  // AUTO CLOSE AFTER 20 SECONDS
  // ========================================================

  useEffect(() => {
    if (!trade) return;

    const timer = setTimeout(() => {
      handleClose();
    }, 20000);

    return () => clearTimeout(timer);
  }, [tradeNotification]);

  // ========================================================
  // ESCAPE KEY
  // ========================================================

  useEffect(() => {
    if (!trade) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [tradeNotification, isClosing]);

  if (!trade) {
    return null;
  }

  // ========================================================
  // HELPERS
  // ========================================================

  const isBuy =
    String(trade.side || trade.direction || "").toLowerCase() ===
      "buy" ||
    String(trade.direction || "").toLowerCase() === "long";

  const symbol = trade.symbol || trade.pair || "—";

  const entryPrice =
    trade.entry ??
    trade.entryPrice ??
    trade.openPrice;

  const exitPrice =
    trade.exit ??
    trade.exitPrice ??
    trade.closePrice;

  const formatPrice = (price) => {
    const value = Number(price);

    if (!Number.isFinite(value) || value === 0) {
      return "—";
    }

    if (symbol.toUpperCase().includes("XAU")) {
      return value.toFixed(2);
    }

    return value.toFixed(5);
  };

  const formatQuantity = () => {
    const quantity = trade.quantity ?? trade.lots;

    if (
      quantity === undefined ||
      quantity === null ||
      quantity === ""
    ) {
      return "—";
    }

    const value = Number(quantity);

    if (!Number.isFinite(value)) {
      return "—";
    }

    return `${value.toFixed(2)} Lots`;
  };

  const getPnLValue = () => {
    return Number(
      trade.netProfit ??
        trade.netPnL ??
        trade.pnl ??
        trade.profit ??
        trade.grossProfit
    );
  };

  const formatPnL = () => {
    const value = getPnLValue();

    if (!Number.isFinite(value)) {
      return "—";
    }

    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  };

  const getResult = () => {
    const pnl = getPnLValue();

    if (!Number.isFinite(pnl)) {
      return trade.result || "Closed";
    }

    if (pnl > 0) return "Win";
    if (pnl < 0) return "Loss";

    return "Break-even";
  };

  const pnlValue = getPnLValue();

  const pnlColor =
    Number.isFinite(pnlValue) && pnlValue > 0
      ? "text-green-600"
      : Number.isFinite(pnlValue) && pnlValue < 0
        ? "text-red-600"
        : "text-gray-900";

  // ========================================================
  // ENTRY EMOTION
  // ========================================================

  const handleEmotionSelect = (emotion) => {
    if (isExit) return;

    setSelectedEmotion(emotion.emoji);

    updateBrokerPosition(trade.id, {
      entryEmotion: emotion.emoji,
      entryEmotionLabel: emotion.label,
    });
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div
      className={`
        fixed
        inset-0
        z-[99999]
        flex
        items-center
        justify-center
        bg-black/25
        p-4
        backdrop-blur-sm
        ${
          isClosing
            ? "animate-trade-backdrop-out"
            : "animate-trade-backdrop-in"
        }
      `}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-notification-title"
        className={`
          w-full
          max-w-[430px]
          overflow-hidden
          rounded-3xl
          border
          border-gray-200
          bg-white
          shadow-[0_25px_80px_rgba(0,0,0,0.20)]
          ${
            isClosing
              ? "animate-trade-popup-out"
              : "animate-trade-popup-in"
          }
        `}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div
              className={`
                flex h-12 w-12 shrink-0 items-center justify-center
                rounded-2xl
                ${
                  isExit
                    ? "bg-blue-100"
                    : isBuy
                      ? "bg-green-100"
                      : "bg-red-100"
                }
              `}
            >
              <CheckCircle2
                size={26}
                className={
                  isExit
                    ? "text-blue-600"
                    : isBuy
                      ? "text-green-600"
                      : "text-red-600"
                }
              />
            </div>

            <div>
              <h2
                id="trade-notification-title"
                className="text-lg font-bold text-gray-900"
              >
                {isExit ? "Trade Closed" : "Trade Executed"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {isExit
                  ? "Position closed successfully"
                  : "Position opened successfully"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close notification"
            className="
              rounded-xl p-2 text-gray-400
              transition-all duration-200
              hover:bg-gray-100 hover:text-gray-700
              active:scale-90
            "
          >
            <X size={20} />
          </button>
        </div>

        {/* ==================================================
            TRADE DETAILS
        ================================================== */}

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Instrument
              </p>

              <p className="mt-1 text-lg font-bold text-gray-900">
                {symbol}
              </p>
            </div>

            <div
              className={`
                flex items-center gap-1.5 rounded-xl px-3 py-2
                text-sm font-bold
                ${
                  isBuy
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }
              `}
            >
              {isBuy ? (
                <TrendingUp size={17} />
              ) : (
                <TrendingDown size={17} />
              )}

              {isBuy ? "BUY" : "SELL"}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* ENTRY PRICE */}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Entry Price
            </span>

            <span className="font-semibold text-gray-900">
              {formatPrice(entryPrice)}
            </span>
          </div>

          {/* EXIT PRICE - EXIT ONLY */}

          {isExit && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Exit Price
              </span>

              <span className="font-semibold text-gray-900">
                {formatPrice(exitPrice)}
              </span>
            </div>
          )}

          {/* QUANTITY */}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Quantity
            </span>

            <span className="font-semibold text-gray-900">
              {formatQuantity()}
            </span>
          </div>

          {/* STOP LOSS */}

          {!isExit && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Stop Loss
              </span>

              <span className="font-semibold text-gray-900">
                {formatPrice(trade.stopLoss ?? trade.sl)}
              </span>
            </div>
          )}

          {/* TAKE PROFIT */}

          {!isExit && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Take Profit
              </span>

              <span className="font-semibold text-gray-900">
                {formatPrice(trade.takeProfit ?? trade.tp)}
              </span>
            </div>
          )}

          {/* P&L - EXIT ONLY */}

          {isExit && (
            <>
              <div className="h-px bg-gray-100" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Net P&L
                </span>

                <span className={`text-lg font-bold ${pnlColor}`}>
                  {formatPnL()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Result
                </span>

                <span className={`font-bold ${pnlColor}`}>
                  {getResult()}
                </span>
              </div>
            </>
          )}

          {/* BROKER */}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Broker
            </span>

            <span className="font-semibold text-gray-900">
              {trade.broker || "MT5"}
            </span>
          </div>
        </div>

        {/* ==================================================
            ENTRY EMOTION
        ================================================== */}

        {!isExit && (
          <div className="border-t border-gray-100 bg-gray-50 p-5">
            <h3 className="font-semibold text-gray-900">
              How did you feel entering?
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Select your entry emotion for your trading journal.
            </p>

            <div className="mt-4 grid grid-cols-6 gap-2">
              {emotions.map((emotion) => {
                const isSelected =
                  selectedEmotion === emotion.emoji;

                return (
                  <button
                    key={emotion.emoji}
                    type="button"
                    title={emotion.label}
                    onClick={() => handleEmotionSelect(emotion)}
                    className={`
                      flex h-11 w-11 items-center justify-center
                      rounded-xl text-xl
                      transition-all duration-200
                      hover:scale-105 active:scale-95
                      ${
                        isSelected
                          ? "bg-black shadow-md ring-2 ring-gray-300"
                          : "bg-white hover:bg-gray-100"
                      }
                    `}
                  >
                    {emotion.emoji}
                  </button>
                );
              })}
            </div>

            {selectedEmotion && (
              <p className="mt-3 text-center text-xs font-medium text-green-600">
                ✓ Entry emotion saved
              </p>
            )}
          </div>
        )}

        {/* ==================================================
            EXIT SUMMARY + ADVANCED JOURNAL BUTTON
        ================================================== */}

        {isExit && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
            <p className="text-center text-xs text-gray-500">
              This trade has been saved to your trading journal.
            </p>

            <button
              type="button"
              onClick={handleOpenJournal}
              className="
                mt-3 w-full rounded-xl
                border border-gray-300
                bg-white px-4 py-2.5
                text-sm font-semibold text-gray-900
                transition-all duration-200
                hover:bg-gray-100
                active:scale-95
              "
            >
              Open Trade Details
            </button>
          </div>
        )}

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="flex justify-end border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={handleClose}
            className="
              rounded-xl bg-black px-6 py-2.5
              text-sm font-semibold text-white
              transition-all duration-200
              hover:bg-gray-800 active:scale-95
            "
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}