import { useEffect, useState } from "react";

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

  const [selectedEmotion, setSelectedEmotion] =
    useState(null);

  useEffect(() => {
    setSelectedEmotion(null);
  }, [tradeNotification?.id]);

  if (!tradeNotification?.trade) {
    return null;
  }

  const trade = tradeNotification.trade;

  const isBuy =
    String(trade.side).toLowerCase() === "buy";

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

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden">
      
      {/* POPUP */}

      <div
        className="
          pointer-events-auto
          fixed
          right-6
          top-20
          w-[380px]
          overflow-hidden
          rounded-2xl
          border
          border-gray-200
          bg-white
          shadow-[0_25px_80px_rgba(0,0,0,0.18)]
          animate-[slideIn_0.35s_ease-out]
        "
      >

        {/* HEADER */}

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-full
                bg-emerald-50
              "
            >
              <CheckCircle2
                size={23}
                className="text-emerald-500"
              />
            </div>

            <div>
              <div className="text-sm font-bold text-gray-900">
                Position Opened
              </div>

              <div className="mt-0.5 text-xs text-gray-500">
                Your trade was executed successfully
              </div>
            </div>

          </div>

          <button
            onClick={handleSkip}
            className="
              rounded-lg
              p-2
              text-gray-400
              transition
              hover:bg-gray-100
              hover:text-gray-700
            "
          >
            <X size={18} />
          </button>

        </div>


        {/* TRADE CARD */}

        <div className="p-5">

          <div
            className="
              rounded-xl
              border
              border-gray-100
              bg-gray-50
              p-4
            "
          >

            {/* SYMBOL */}

            <div className="flex items-center justify-between">

              <div>

                <div className="text-xs text-gray-400">
                  Instrument
                </div>

                <div className="mt-1 text-lg font-bold text-gray-900">
                  {trade.symbol}
                </div>

              </div>


              {/* SIDE */}

              <div
                className={`
                  flex
                  items-center
                  gap-1.5
                  rounded-lg
                  px-3
                  py-2
                  text-xs
                  font-bold
                  ${
                    isBuy
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }
                `}
              >

                {isBuy ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}

                {isBuy ? "BUY" : "SELL"}

              </div>

            </div>


            {/* DETAILS */}

            <div className="mt-4 grid grid-cols-2 gap-3">

              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  Entry
                </div>

                <div className="mt-1 font-semibold text-gray-900">
                  {Number(trade.entry || 0).toFixed(5)}
                </div>
              </div>


              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  Volume
                </div>

                <div className="mt-1 font-semibold text-gray-900">
                  {trade.quantity} Lots
                </div>
              </div>

            </div>

          </div>


          {/* JOURNAL QUESTION */}

          <div className="mt-5">

            <div className="text-sm font-bold text-gray-900">
              Trading Psychology
            </div>

            <div className="mt-1 text-xs text-gray-500">
              How did you feel when entering this trade?
            </div>


            {/* EMOTIONS */}

            <div className="mt-4 grid grid-cols-4 gap-2">

              {EMOTIONS.map((emotion) => {

                const selected =
                  selectedEmotion?.label === emotion.label;

                return (
                  <button
                    key={emotion.label}
                    type="button"
                    onClick={() =>
                      setSelectedEmotion(emotion)
                    }
                    className={`
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-1
                      rounded-xl
                      border
                      px-2
                      py-3
                      transition-all
                      duration-200
                      ${
                        selected
                          ? "border-violet-500 bg-violet-50 shadow-sm scale-[1.03]"
                          : "border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }
                    `}
                  >

                    <span className="text-xl">
                      {emotion.emoji}
                    </span>

                    <span className="text-[9px] font-medium text-gray-600">
                      {emotion.label}
                    </span>

                  </button>
                );
              })}

            </div>

          </div>

        </div>


        {/* FOOTER */}

        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">

          <button
            onClick={handleSkip}
            className="
              flex-1
              rounded-xl
              border
              border-gray-200
              bg-white
              py-2.5
              text-xs
              font-semibold
              text-gray-600
              transition
              hover:bg-gray-100
            "
          >
            Skip
          </button>


          <button
            onClick={handleSave}
            disabled={!selectedEmotion}
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-violet-600
              py-2.5
              text-xs
              font-semibold
              text-white
              transition
              hover:bg-violet-700
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <Save size={15} />

            Save Emotion

          </button>

        </div>

      </div>


      {/* CUSTOM ANIMATION */}

      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(120%);
            }

            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>

    </div>
  );
}