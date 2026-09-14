import { useState, useEffect } from "react";

import {
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { useTrade } from "../../context/TradeContext";

const emotions = [
  {
    emoji: "😎",
    label: "Confident",
  },
  {
    emoji: "🧘",
    label: "Calm",
  },
  {
    emoji: "🔥",
    label: "Excited",
  },
  {
    emoji: "😨",
    label: "Fearful",
  },
  {
    emoji: "😤",
    label: "Frustrated",
  },
  {
    emoji: "🤔",
    label: "Unsure",
  },
];

export default function TradeExecutionNotification() {
  const {
    tradeNotification,
    hideTradeNotification,
    updateBrokerPosition,
  } = useTrade();

  const [selectedEmotion, setSelectedEmotion] =
    useState(null);

  /* ==========================================================
     RESET EMOTION WHEN NEW NOTIFICATION COMES
  ========================================================== */

  useEffect(() => {
    if (!tradeNotification) {
      setSelectedEmotion(null);
      return;
    }

    setSelectedEmotion(null);

    console.log(
      "🔔 TRADE NOTIFICATION RECEIVED:",
      tradeNotification
    );

    /* OPTIONAL SOUND */

    const audio = new Audio(
      "/sounds/trade-executed.mp3"
    );

    audio.volume = 0.5;

    audio.play().catch(() => {
      console.log(
        "🔇 Trade sound could not play"
      );
    });
  }, [tradeNotification]);

  /* ==========================================================
     AUTO CLOSE AFTER 20 SECONDS
  ========================================================== */

  useEffect(() => {
    if (!tradeNotification) return;

    const timer = setTimeout(() => {
      hideTradeNotification();
    }, 20000);

    return () => {
      clearTimeout(timer);
    };
  }, [tradeNotification, hideTradeNotification]);

  if (!tradeNotification?.trade) {
    return null;
  }

  const trade = tradeNotification.trade;

  const isBuy =
    String(trade.side).toLowerCase() === "buy";

  /* ==========================================================
     SAVE EMOTION
  ========================================================== */

  const handleEmotionSelect = (emotion) => {
    setSelectedEmotion(emotion);

    const emotionData = emotions.find(
      (item) => item.emoji === emotion
    );

    updateBrokerPosition(trade.id, {
      entryEmotion: emotion,
      entryEmotionLabel:
        emotionData?.label || "",
    });

    console.log(
      "😊 Entry emotion saved:",
      emotionData
    );
  };

  /* ==========================================================
     CLOSE NOTIFICATION
  ========================================================== */

  const handleClose = () => {
    hideTradeNotification();
  };

  /* ==========================================================
     PRICE FORMAT
  ========================================================== */

  const formatPrice = (price) => {
    const value = Number(price);

    if (!Number.isFinite(value)) {
      return "—";
    }

    if (
      String(trade.symbol)
        .toUpperCase()
        .includes("XAU")
    ) {
      return value.toFixed(2);
    }

    return value.toFixed(5);
  };

  return (
    <div
      className="
        fixed
        top-20
        right-5
        z-[99999]
        w-[360px]
        overflow-hidden
        rounded-2xl
        border
        border-gray-200
        bg-white
        shadow-2xl
      "
    >
      {/* HEADER */}

      <div className="flex items-start justify-between border-b p-5">
        <div className="flex gap-3">
          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-green-100
            "
          >
            <CheckCircle2
              size={24}
              className="text-green-600"
            />
          </div>

          <div>
            <h2 className="font-bold text-gray-900">
              Trade Executed
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Your position has been opened successfully
            </p>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="
            rounded-lg
            p-1
            text-gray-400
            transition
            hover:bg-gray-100
            hover:text-gray-700
          "
        >
          <X size={20} />
        </button>
      </div>

      {/* TRADE DETAILS */}

      <div className="space-y-4 p-5">
        {/* SYMBOL */}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Symbol
          </span>

          <span className="font-bold text-gray-900">
            {trade.symbol}
          </span>
        </div>

        {/* DIRECTION */}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Direction
          </span>

          <div
            className={`
              flex
              items-center
              gap-1
              rounded-lg
              px-3
              py-1.5
              text-sm
              font-bold
              ${
                isBuy
                  ? "bg-green-100 text-green-700"
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

        {/* ENTRY */}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Entry Price
          </span>

          <span className="font-semibold text-gray-900">
            {formatPrice(trade.entry)}
          </span>
        </div>

        {/* QUANTITY */}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Quantity
          </span>

          <span className="font-semibold text-gray-900">
            {trade.quantity} Lots
          </span>
        </div>

        {/* BROKER */}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Broker
          </span>

          <span className="font-semibold text-gray-900">
            {trade.broker || "Local"}
          </span>
        </div>
      </div>

      {/* EMOTION */}

      <div className="border-t bg-gray-50 p-5">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900">
            How did you feel entering?
          </h3>

          <p className="mt-1 text-xs text-gray-500">
            Select your entry emotion for your trading journal
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {emotions.map((emotion) => (
            <button
              key={emotion.emoji}
              onClick={() =>
                handleEmotionSelect(emotion.emoji)
              }
              title={emotion.label}
              className={`
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                text-xl
                transition-all
                hover:scale-110
                ${
                  selectedEmotion === emotion.emoji
                    ? "bg-black ring-2 ring-gray-300"
                    : "bg-white hover:bg-gray-100"
                }
              `}
            >
              {emotion.emoji}
            </button>
          ))}
        </div>

        {selectedEmotion && (
          <p
            className="
              mt-3
              text-center
              text-xs
              font-medium
              text-green-600
            "
          >
            ✓ Entry emotion saved to your trade
          </p>
        )}
      </div>

      {/* FOOTER */}

      <div className="flex justify-end border-t p-4">
        <button
          onClick={handleClose}
          className="
            rounded-lg
            bg-black
            px-5
            py-2
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-gray-800
          "
        >
          Done
        </button>
      </div>
    </div>
  );
}