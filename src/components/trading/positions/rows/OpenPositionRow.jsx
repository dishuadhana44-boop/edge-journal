import { useEffect, useRef, useState } from "react";
import { MoreVertical, Loader2 } from "lucide-react";
import { useTrade } from "../../../../context/TradeContext";

// ============================================================
// NUMBER HELPER
// ============================================================

function getNumber(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return 0;
}

// ============================================================
// FIND VALUE FROM MULTIPLE POSSIBLE STRUCTURES
// ============================================================

function getTradeValue(trade, keys = []) {
  if (!trade) return undefined;

  const sources = [
    trade,
    trade.position,
    trade.tradeData,
    trade.tradeData?.position,
    trade.data,
    trade.data?.position,
  ];

  for (const source of sources) {
    if (!source) continue;

    for (const key of keys) {
      if (
        source[key] !== undefined &&
        source[key] !== null &&
        source[key] !== ""
      ) {
        return source[key];
      }
    }
  }

  return undefined;
}

// ============================================================
// OPEN TIMESTAMP
// ============================================================

function getOpenTimestamp(trade) {
  if (!trade) return null;

  const sources = [
    trade,
    trade.position,
    trade.tradeData,
    trade.tradeData?.position,
    trade.data,
    trade.data?.position,
  ];

  const millisecondKeys = [
    "time_msc",
    "timeMsc",
    "openTimeMsc",
    "openedAtMsc",
    "timestampMsc",
    "openTimestampMsc",
  ];

  const secondKeys = [
    "time",
    "openTimestamp",
    "openedAt",
    "openTime",
    "timestamp",
    "createdAt",
  ];

  // First: milliseconds
  for (const source of sources) {
    if (!source) continue;

    for (const key of millisecondKeys) {
      const value = source[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        const number = Number(value);

        if (Number.isFinite(number) && number > 0) {
          if (number >= 100000000000) {
            return number;
          }

          return number * 1000;
        }
      }
    }
  }

  // Second: seconds / ISO date
  for (const source of sources) {
    if (!source) continue;

    for (const key of secondKeys) {
      const value = source[key];

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        continue;
      }

      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        if (number < 100000000000) {
          return number * 1000;
        }

        return number;
      }

      const parsed = new Date(value).getTime();

      if (
        Number.isFinite(parsed) &&
        parsed > 0
      ) {
        return parsed;
      }
    }
  }

  return null;
}

// ============================================================
// NORMALIZE SIDE
// ============================================================

function normalizeSide(value, trade) {
  if (
    trade?.broker === "MT5" ||
    trade?.broker === "mt5" ||
    trade?.source === "MT5"
  ) {
    const numericType = Number(
      getTradeValue(trade, [
        "type",
        "positionType",
      ])
    );

    if (numericType === 0) return "buy";
    if (numericType === 1) return "sell";
  }

  const numericSide = Number(value);

  if (numericSide === 1) return "buy";
  if (numericSide === 2) return "sell";

  const normalized = String(
    value || ""
  ).toLowerCase();

  if (
    normalized === "buy" ||
    normalized === "long" ||
    normalized === "1"
  ) {
    return "buy";
  }

  if (
    normalized === "sell" ||
    normalized === "short" ||
    normalized === "2"
  ) {
    return "sell";
  }

  return normalized;
}

// ============================================================
// REAL NET P/L
// ============================================================

function getRealNetProfit(trade) {
  if (!trade) {
    return {
      pnl: 0,
      source: "none",
    };
  }

  // MT5
  if (
    trade.broker === "MT5" ||
    trade.broker === "mt5" ||
    trade.source === "MT5"
  ) {
    const mt5Profit = getTradeValue(trade, [
      "profit",
      "pnl",
      "netProfit",
      "netPnL",
      "unrealizedPnL",
      "unrealizedPnl",
    ]);

    const value = Number(mt5Profit);

    if (Number.isFinite(value)) {
      return {
        pnl: value,
        source: "mt5-broker-profit",
      };
    }

    return {
      pnl: 0,
      source: "mt5-fallback",
    };
  }

  // cTrader — direct net profit
  const directNetProfit = getTradeValue(trade, [
    "netProfit",
    "netPnL",
    "netPnl",
    "netPL",
  ]);

  if (
    directNetProfit !== undefined &&
    directNetProfit !== null &&
    directNetProfit !== ""
  ) {
    const value = Number(directNetProfit);

    if (Number.isFinite(value)) {
      return {
        pnl: value,
        source: "broker-net-profit",
      };
    }
  }

  // cTrader — gross + commission + swap
  const grossValue = getTradeValue(trade, [
    "grossProfit",
    "grossPnL",
    "grossPnl",
    "grossPL",
  ]);

  const hasGrossData =
    grossValue !== undefined &&
    grossValue !== null &&
    grossValue !== "";

  if (hasGrossData) {
    const grossProfit = getNumber(grossValue);

    const commission = getNumber(
      getTradeValue(trade, [
        "commission",
        "commissions",
      ])
    );

    const swap = getNumber(
      getTradeValue(trade, [
        "swap",
        "swapCharge",
        "swapCost",
      ])
    );

    return {
      pnl:
        grossProfit +
        commission +
        swap,
      source:
        "gross-plus-commission-plus-swap",
      grossProfit,
      commission,
      swap,
    };
  }

  // Fallback
  const fallbackPnl = getNumber(
    getTradeValue(trade, [
      "pnl",
      "profit",
      "unrealizedPnL",
      "unrealizedPnl",
    ])
  );

  return {
    pnl: fallbackPnl,
    source: "fallback",
  };
}

// ============================================================
// COMPONENT
// ============================================================

export default function OpenPositionRow({
  trade,
  demo = false,
}) {
  const {
    closeTrade,
    partialCloseTrade,
    modifyStopLoss,
    modifyTakeProfit,
  } = useTrade();

  // ==========================================================
  // MENU STATE
  // ==========================================================

  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const menuRef = useRef(null);

  // ==========================================================
  // LIVE DURATION — MT5 BROKER CLOCK
  // ==========================================================

  const [duration, setDuration] = useState("00:00:00");

  const brokerClockRef = useRef(null);
  const clientClockRef = useRef(null);

  useEffect(() => {
    if (!trade) {
      setDuration("00:00:00");
      brokerClockRef.current = null;
      clientClockRef.current = null;
      return;
    }

    const getBrokerTime = () => {
      const brokerTime = Number(
        getTradeValue(trade, [
          "broker_time_msc",
          "brokerTimeMsc",
          "brokerTimestamp",
          "serverTimeMsc",
          "server_time_msc",
        ])
      );

      if (
        Number.isFinite(brokerTime) &&
        brokerTime > 0
      ) {
        return brokerTime;
      }

      return null;
    };

    const formatLiveDuration = (
      openedTimestamp,
      nowTimestamp
    ) => {
      const difference = Math.max(
        0,
        nowTimestamp - openedTimestamp
      );

      const totalSeconds = Math.floor(
        difference / 1000
      );

      const hours = Math.floor(
        totalSeconds / 3600
      );

      const minutes = Math.floor(
        (totalSeconds % 3600) / 60
      );

      const seconds = totalSeconds % 60;

      return (
        `${String(hours).padStart(2, "0")}:` +
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`
      );
    };

    const updateDuration = () => {
      const openedTimestamp =
        getOpenTimestamp(trade);

      if (
        openedTimestamp === null ||
        !Number.isFinite(openedTimestamp) ||
        openedTimestamp <= 0
      ) {
        setDuration("00:00:00");

        console.warn(
          "⚠️ EDGEFLO DURATION: OPEN TIMESTAMP NOT FOUND",
          {
            rawTimeMsc: trade?.time_msc,
            rawTime: trade?.time,
            nestedTimeMsc:
              trade?.position?.time_msc,
            nestedTime:
              trade?.position?.time,
            trade,
          }
        );

        return;
      }

      const currentBrokerTime =
        getBrokerTime();

      const nowClient = Date.now();

      // ------------------------------------------------------
      // FIRST BROKER CLOCK SAMPLE
      // OR NEWER BROKER CLOCK SAMPLE
      // ------------------------------------------------------

      if (currentBrokerTime !== null) {
        const previousBrokerTime =
          brokerClockRef.current;

        if (
          previousBrokerTime === null ||
          currentBrokerTime > previousBrokerTime
        ) {
          brokerClockRef.current =
            currentBrokerTime;

          clientClockRef.current =
            nowClient;
        }
      }

      // ------------------------------------------------------
      // ESTIMATE CURRENT BROKER TIME
      // ------------------------------------------------------

      let nowBroker;

      if (
        brokerClockRef.current !== null &&
        clientClockRef.current !== null
      ) {
        nowBroker =
          brokerClockRef.current +
          (
            nowClient -
            clientClockRef.current
          );
      } else {
        nowBroker = nowClient;
      }

      const formatted =
        formatLiveDuration(
          openedTimestamp,
          nowBroker
        );

      setDuration(formatted);

      console.log(
        "⏱️ EDGEFLO BROKER DURATION:",
        {
          openedTimestamp,
          brokerTime: currentBrokerTime,
          brokerClockSample:
            brokerClockRef.current,
          clientClockSample:
            clientClockRef.current,
          estimatedBrokerNow:
            nowBroker,
          difference:
            nowBroker - openedTimestamp,
          duration: formatted,
        }
      );
    };

    updateDuration();

    const interval = setInterval(
      updateDuration,
      1000
    );

    return () => {
      clearInterval(interval);
    };
  }, [trade]);

  // ==========================================================
  // CLOSE MENU ON OUTSIDE CLICK
  // ==========================================================

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target
        )
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

  // ==========================================================
  // SAFETY
  // ==========================================================

  if (!trade) return null;

  // ==========================================================
  // BROKER
  // ==========================================================

  const broker = String(
    trade.broker ||
      trade.source ||
      ""
  ).toUpperCase();

  const isMT5 = broker === "MT5";

  // ==========================================================
  // POSITION ID
  // ==========================================================

  const tradeId = trade?.id ?? null;

  // ==========================================================
  // SYMBOL
  // ==========================================================

  const symbol =
    getTradeValue(trade, [
      "symbol",
      "instrument",
      "symbolName",
    ]) || "UNKNOWN";

  // ==========================================================
  // SIDE
  // ==========================================================

  const rawSide = getTradeValue(trade, [
    "side",
    "direction",
    "tradeSide",
    "type",
    "positionType",
  ]);

  const side = normalizeSide(
    rawSide,
    trade
  );

  // ==========================================================
  // LOTS
  // ==========================================================

  const quantity = getNumber(
    getTradeValue(trade, [
      "quantity",
      "lots",
      "volumeLots",
      "volume",
    ])
  );

  // ==========================================================
  // ENTRY PRICE
  // ==========================================================

  const entry = getNumber(
    getTradeValue(trade, [
      "entry",
      "entryPrice",
      "priceOpen",
      "price_open",
      "price",
      "openPrice",
    ])
  );

  // ==========================================================
  // CURRENT PRICE
  // ==========================================================

  const currentPrice =
    getNumber(
      getTradeValue(trade, [
        "currentPrice",
        "current",
        "priceCurrent",
        "price_current",
        "markPrice",
        "bid",
        "ask",
      ])
    ) || entry;

  // ==========================================================
  // TAKE PROFIT
  // ==========================================================

  const takeProfit = getNumber(
    getTradeValue(trade, [
      "takeProfit",
      "tp",
    ])
  );

  // ==========================================================
  // STOP LOSS
  // ==========================================================

  const stopLoss = getNumber(
    getTradeValue(trade, [
      "stopLoss",
      "sl",
    ])
  );

  // ==========================================================
  // REAL P/L
  // ==========================================================

  const pnlResult =
    getRealNetProfit(trade);

  const pnl = pnlResult.pnl;

  // ==========================================================
  // COMMISSION
  // ==========================================================

  const commission = getNumber(
    getTradeValue(trade, [
      "commission",
      "commissions",
    ])
  );

  // ==========================================================
  // SWAP
  // ==========================================================

  const swap = getNumber(
    getTradeValue(trade, [
      "swap",
      "swapCharge",
      "swapCost",
    ])
  );

  // ==========================================================
  // GROSS PROFIT
  // ==========================================================

  const grossProfit = getNumber(
    getTradeValue(trade, [
      "grossProfit",
      "grossPnL",
      "grossPnl",
    ])
  );

  // ==========================================================
  // MARGIN
  // ==========================================================

  const margin = getNumber(
    getTradeValue(trade, [
      "margin",
      "usedMargin",
    ])
  );

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
  // FORMAT DURATION
  // ==========================================================

  const formatDuration = (value) => {
    if (!value) return "0s";

    const parts =
      String(value).split(":");

    if (parts.length !== 3) {
      return value;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  };

  // ==========================================================
  // PARTIAL CLOSE
  // ==========================================================

  const handlePartialClose = async (
    percentage = null
  ) => {
    let closePercentage = percentage;

    if (percentage === null) {
      const input = window.prompt(
        "Enter percentage to close (1-99):",
        "25"
      );

      if (
        input === null ||
        input === ""
      ) {
        return;
      }

      closePercentage = Number(input);
    }

    if (
      !Number.isFinite(closePercentage) ||
      closePercentage <= 0 ||
      closePercentage >= 100
    ) {
      alert(
        "Please enter a valid percentage between 1 and 99."
      );
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      alert("Invalid position quantity.");
      return;
    }

    if (!tradeId) {
      alert("Position ID not found.");
      return;
    }

    setMenuOpen(false);

    const quantityToClose =
      quantity *
      (closePercentage / 100);

    try {
      if (
        typeof partialCloseTrade !==
        "function"
      ) {
        throw new Error(
          "Partial close function is not available."
        );
      }

      await partialCloseTrade(
        tradeId,
        quantityToClose
      );
    } catch (error) {
      console.error(
        "❌ PARTIAL CLOSE ERROR:",
        error
      );

      alert(
        error?.message ||
          "Failed to partially close position."
      );
    }
  };

  // ==========================================================
  // MODIFY STOP LOSS
  // ==========================================================

  const handleModifyStopLoss = async () => {
    const input = window.prompt(
      "Enter new Stop Loss price:",
      stopLoss > 0
        ? stopLoss
        : ""
    );

    if (
      input === null ||
      input === ""
    ) {
      return;
    }

    const newStopLoss =
      Number(input);

    if (
      !Number.isFinite(newStopLoss) ||
      newStopLoss <= 0
    ) {
      alert(
        "Please enter a valid Stop Loss price."
      );
      return;
    }

    if (!tradeId) {
      alert("Position ID not found.");
      return;
    }

    setMenuOpen(false);

    try {
      if (
        typeof modifyStopLoss !==
        "function"
      ) {
        throw new Error(
          "Modify Stop Loss function is not available."
        );
      }

      await modifyStopLoss(
        tradeId,
        newStopLoss
      );
    } catch (error) {
      console.error(
        "❌ MODIFY STOP LOSS ERROR:",
        error
      );

      alert(
        error?.message ||
          "Failed to modify Stop Loss."
      );
    }
  };

  // ==========================================================
  // MODIFY TAKE PROFIT
  // ==========================================================

  const handleModifyTakeProfit =
    async () => {
      const input = window.prompt(
        "Enter new Take Profit price:",
        takeProfit > 0
          ? takeProfit
          : ""
      );

      if (
        input === null ||
        input === ""
      ) {
        return;
      }

      const newTakeProfit =
        Number(input);

      if (
        !Number.isFinite(
          newTakeProfit
        ) ||
        newTakeProfit <= 0
      ) {
        alert(
          "Please enter a valid Take Profit price."
        );
        return;
      }

      if (!tradeId) {
        alert("Position ID not found.");
        return;
      }

      setMenuOpen(false);

      try {
        if (
          typeof modifyTakeProfit !==
          "function"
        ) {
          throw new Error(
            "Modify Take Profit function is not available."
          );
        }

        await modifyTakeProfit(
          tradeId,
          newTakeProfit
        );
      } catch (error) {
        console.error(
          "❌ MODIFY TAKE PROFIT ERROR:",
          error
        );

        alert(
          error?.message ||
            "Failed to modify Take Profit."
        );
      }
    };

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  const handleClosePosition =
    async () => {
      setMenuOpen(false);

      if (isClosing) return;

      if (!tradeId) {
        console.error(
          "❌ CLOSE ERROR: Position ID not found",
          trade
        );

        alert(
          "Unable to close position. Position ID not found."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Are you sure you want to close this position?\n\n` +
            `Instrument: ${symbol}\n` +
            `Position ID: ${tradeId}`
        );

      if (!confirmed) return;

      try {
        setIsClosing(true);

        console.log(
          `🔴 CLOSING REAL ${
            isMT5 ? "MT5" : "cTRADER"
          } POSITION:`,
          {
            positionId: tradeId,
            brokerPositionId:
              trade?.brokerPositionId,
            ticket: trade?.ticket,
            symbol,
            broker,
            trade,
          }
        );

        // ======================================================
        // MT5
        // ======================================================

        if (isMT5) {
          const mt5Ticket =
            trade?.brokerPositionId ??
            trade?.positionId ??
            trade?.ticket;

          if (!mt5Ticket) {
            throw new Error(
              "MT5 position ticket not found."
            );
          }

          const response =
            await fetch(
              "http://localhost:4000/api/mt5/close-position",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  ticket:
                    Number(mt5Ticket),
                  volume: quantity,
                }),
              }
            );

          const data =
            await response.json();

          console.log(
            "📡 MT5 CLOSE API RESPONSE:",
            data
          );

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                data?.error ||
                "MT5 rejected the close request."
            );
          }

          console.log(
            "✅ REAL MT5 POSITION CLOSED:",
            data
          );

          return;
        }

        // ======================================================
        // cTRADER / OTHER BROKER
        // ======================================================

        if (
          typeof closeTrade !==
          "function"
        ) {
          throw new Error(
            "closeTrade function is not available."
          );
        }

        const result =
          await closeTrade(
            String(tradeId)
          );

        console.log(
          "✅ cTRADER CLOSE RESPONSE:",
          result
        );
      } catch (error) {
        console.error(
          "❌ REAL POSITION CLOSE ERROR:",
          error
        );

        alert(
          error?.message ||
            "Failed to close the position."
        );
      } finally {
        setIsClosing(false);
      }
    };

  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    "📊 EDGEFLO POSITION ROW:",
    {
      broker,
      positionId: tradeId,
      symbol,
      side,
      quantity,
      entry,
      currentPrice,
      pnl,
      margin,
      duration,

      durationTimestamp:
        getOpenTimestamp(trade),

      brokerTimeMsc:
        getTradeValue(trade, [
          "broker_time_msc",
          "brokerTimeMsc",
          "brokerTimestamp",
          "serverTimeMsc",
          "server_time_msc",
        ]),

      rawTimeMsc:
        trade?.time_msc,

      rawTime:
        trade?.time,

      nestedTimeMsc:
        trade?.position?.time_msc,

      nestedTime:
        trade?.position?.time,

      rawTrade: trade,
    }
  );

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
      {/* INSTRUMENT */}

      <td className="w-[110px] px-6 py-4 text-left whitespace-nowrap">
        <span className="font-semibold text-gray-900">
          {symbol}
        </span>
      </td>

      {/* SIDE */}

      <td className="w-[90px] text-center">
        <span
          className={`
            px-2
            py-1
            rounded-lg
            text-xs
            font-semibold
            ${
              side === "buy"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }
          `}
        >
          {side
            ? side.toUpperCase()
            : "-"}
        </span>
      </td>

      {/* LOTS */}

      <td className="w-[90px] text-center whitespace-nowrap">
        {Number.isFinite(quantity)
          ? quantity.toFixed(2)
          : "0.00"}
      </td>

      {/* ENTRY */}

      <td className="w-[100px] text-right whitespace-nowrap">
        {formatPrice(entry)}
      </td>

      {/* CURRENT */}

      <td className="w-[100px] text-right whitespace-nowrap">
        {formatPrice(currentPrice)}
      </td>

      {/* TAKE PROFIT */}

      <td className="w-[110px] text-right text-emerald-600 whitespace-nowrap">
        {formatPrice(takeProfit)}
      </td>

      {/* STOP LOSS */}

      <td className="w-[110px] text-right text-red-600 whitespace-nowrap">
        {formatPrice(stopLoss)}
      </td>

      {/* P/L */}

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
          {pnl >= 0 ? "+" : ""}
          ${pnl.toFixed(2)}
        </span>
      </td>

      {/* MARGIN */}

      <td className="w-[110px] text-right whitespace-nowrap">
        <span className="font-medium text-gray-700">
          $
          {Number.isFinite(margin)
            ? margin.toFixed(2)
            : "0.00"}
        </span>
      </td>

      {/* DURATION */}

      <td className="w-[100px] text-right whitespace-nowrap">
        <span className="font-medium text-gray-700">
          {formatDuration(duration)}
        </span>
      </td>

      {/* ACTIONS */}

      <td className="w-[100px] text-center relative">
        <div
          ref={menuRef}
          className="relative inline-block"
        >
          {/* THREE DOT BUTTON */}

          <button
            type="button"
            disabled={isClosing}
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
              disabled:opacity-50
              disabled:cursor-not-allowed
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
                w-[210px]
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-white
                shadow-xl
              "
            >
              {/* PARTIAL CLOSE */}

              <button
                type="button"
                disabled={isClosing}
                onClick={() =>
                  handlePartialClose()
                }
                className="
                  w-full
                  px-4
                  py-3
                  text-left
                  text-sm
                  text-gray-700
                  hover:bg-gray-50
                  disabled:opacity-50
                  transition
                "
              >
                Partial Close
              </button>

              <div className="border-t border-gray-100" />

              {/* MODIFY STOP LOSS */}

              <button
                type="button"
                disabled={isClosing}
                onClick={
                  handleModifyStopLoss
                }
                className="
                  w-full
                  px-4
                  py-3
                  text-left
                  text-sm
                  text-gray-700
                  hover:bg-gray-50
                  disabled:opacity-50
                  transition
                "
              >
                Modify Stop Loss
              </button>

              {/* MODIFY TAKE PROFIT */}

              <button
                type="button"
                disabled={isClosing}
                onClick={
                  handleModifyTakeProfit
                }
                className="
                  w-full
                  px-4
                  py-3
                  text-left
                  text-sm
                  text-gray-700
                  hover:bg-gray-50
                  disabled:opacity-50
                  transition
                "
              >
                Modify Take Profit
              </button>

              <div className="border-t border-gray-100" />

              {/* CLOSE POSITION */}

              <button
                type="button"
                disabled={isClosing}
                onClick={
                  handleClosePosition
                }
                className="
                  w-full
                  px-4
                  py-3
                  text-left
                  text-sm
                  font-medium
                  text-red-600
                  hover:bg-red-50
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                  transition
                  flex
                  items-center
                  gap-2
                "
              >
                {isClosing ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Closing Position...
                  </>
                ) : (
                  <>
                    🔴 Close Position
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}