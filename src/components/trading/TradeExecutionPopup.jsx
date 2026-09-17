
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
  Save,
} from "lucide-react";
import { useTrade } from "../../context/TradeContext";

const EMOTIONS = [
  { emoji: "😎", label: "Confident" },
  { emoji: "🧘", label: "Calm" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "🤔", label: "Hesitant" },
  { emoji: "🤩", label: "Excited" },
  { emoji: "😨", label: "Fearful" },
  { emoji: "🔥", label: "FOMO" },
  { emoji: "😤", label: "Revenge" },
];

export default function TradeExecutionPopup() {
  const {
    tradeNotification,
    hideTradeNotification,
    updateBrokerPosition,
  } = useTrade();

  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const popupRef = useRef(null);

  const trade = tradeNotification?.trade;

  const isBuy =
    String(trade?.side || "").toLowerCase() === "buy";

  // Reset emotion and focus popup
  useEffect(() => {
    if (!tradeNotification?.id) return;

    setSelectedEmotion(null);

    const frame = requestAnimationFrame(() => {
      popupRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [tradeNotification?.id]);

  // ESC key support
  useEffect(() => {
    if (!tradeNotification?.trade) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        hideTradeNotification();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [tradeNotification?.trade, hideTradeNotification]);

  // Prevent background page scrolling
  useEffect(() => {
    if (!tradeNotification?.trade) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [tradeNotification?.trade]);

  if (!trade) {
    return null;
  }

  const handleSave = () => {
    if (selectedEmotion) {
      updateBrokerPosition(trade.id, {
        entryEmotion: selectedEmotion.emoji,
        entryEmotionLabel: selectedEmotion.label,
      });
    }

    hideTradeNotification();
  };

  const handleSkip = () => {
    hideTradeNotification();
  };

  const formatPrice = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return "—";
    }

    return number.toFixed(5);
  };

  const formatLots = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0.00";
    }

    return number.toFixed(2);
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden p-4"
      role="presentation"
    >
      {/* Soft backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/20 backdrop-blur-[3px] animate-popup-backdrop"
        onClick={handleSkip}
      />

      {/* Main popup */}
      <div
        ref={popupRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-execution-title"
        className="
          relative z-10 flex max-h-[calc(100vh-32px)] w-full
          max-w-[430px] flex-col overflow-hidden rounded-[24px]
          border border-gray-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.20)]
          outline-none animate-popup-enter
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2
                size={24}
                strokeWidth={2.3}
                className="text-emerald-500"
              />
            </div>

            <div>
              <h2
                id="trade-execution-title"
                className="text-[15px] font-bold tracking-tight text-gray-950"
              >
                Trade Executed
              </h2>

              <p className="mt-0.5 text-[11px] text-gray-500">
                Your order was placed successfully
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            aria-label="Close popup"
            className="
              rounded-full p-2 text-gray-400 transition-all duration-200
              hover:bg-gray-100 hover:text-gray-800 active:scale-95
            "
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 py-5">
          {/* Trade summary */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  Instrument
                </p>

                <h3 className="mt-1 text-[25px] font-bold tracking-tight text-gray-950">
                  {trade.symbol || "EURUSD"}
                </h3>

                <p className="mt-0.5 text-xs text-gray-500">
                  Market Order
                </p>
              </div>

              <div
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
                  isBuy
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {isBuy ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}

                {isBuy ? "BUY" : "SELL"}
              </div>
            </div>

            <div className="my-4 h-px bg-gray-200/80" />

            {/* Trade details */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Entry Price
                </p>

                <p className="mt-1 text-sm font-bold tabular-nums text-gray-900">
                  {formatPrice(
                    trade.entry ?? trade.entryPrice ?? trade.price
                  )}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Volume
                </p>

                <p className="mt-1 text-sm font-bold tabular-nums text-gray-900">
                  {formatLots(
                    trade.quantity ?? trade.lots ?? trade.volume
                  )}{" "}
                  Lots
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Stop Loss
                </p>

                <p className="mt-1 text-sm font-semibold tabular-nums text-red-600">
                  {formatPrice(trade.stopLoss ?? trade.sl)}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Take Profit
                </p>

                <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-600">
                  {formatPrice(trade.takeProfit ?? trade.tp)}
                </p>
              </div>
            </div>
          </div>

          {/* Psychology section */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold tracking-tight text-gray-950">
                Trading Psychology
              </h3>

              <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-600">
                JOURNAL
              </span>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              How did you feel when entering this trade?
            </p>

            {/* Emotion grid */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              {EMOTIONS.map((emotion) => {
                const selected =
                  selectedEmotion?.label === emotion.label;

                return (
                  <button
                    key={emotion.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedEmotion(emotion)}
                    className={`
                      group flex min-h-[76px] flex-col items-center
                      justify-center gap-1.5 rounded-xl border
                      transition-all duration-200 active:scale-95
                      ${
                        selected
                          ? "border-violet-500 bg-violet-50 shadow-[0_0_0_2px_rgba(139,92,246,0.10)]"
                          : "border-gray-100 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50"
                      }
                    `}
                  >
                    <span
                      className={`
                        text-[23px] transition-transform duration-200
                        ${
                          selected
                            ? "scale-110"
                            : "group-hover:scale-105"
                        }
                      `}
                    >
                      {emotion.emoji}
                    </span>

                    <span
                      className={`text-[10px] font-medium ${
                        selected
                          ? "text-violet-700"
                          : "text-gray-500"
                      }`}
                    >
                      {emotion.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {!selectedEmotion && (
              <p className="mt-3 text-center text-[10px] text-gray-400">
                Select an emotion to save it with your trade
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-4">
          <button
            type="button"
            onClick={handleSkip}
            className="
              flex-1 rounded-xl border border-gray-200 bg-white py-3
              text-xs font-semibold text-gray-600 transition-all duration-200
              hover:bg-gray-100 active:scale-[0.98]
            "
          >
            Skip
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedEmotion}
            className="
              flex flex-1 items-center justify-center gap-2 rounded-xl
              bg-violet-600 py-3 text-xs font-semibold text-white shadow-sm
              transition-all duration-200 hover:bg-violet-700
              active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            <Save size={15} />
            Save Emotion
          </button>
        </div>
      </div>

      {/* Popup animation */}
      <style>{`
        @keyframes popupEnter {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes popupBackdrop {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        .animate-popup-enter {
          animation: popupEnter 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .animate-popup-backdrop {
          animation: popupBackdrop 0.2s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-popup-enter,
          .animate-popup-backdrop {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}