import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { useJournal } from "./JournalContext";
import { useMarket } from "./MarketContext";

const TradeContext = createContext(null);

// ============================================================
// HELPERS
// ============================================================

function normalizeNumber(value, fallback = 0) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeSymbol(symbol) {
  return String(symbol || "EURUSD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeSide(side) {
  const value = String(side ?? "")
    .trim()
    .toLowerCase();

  if (
    value === "buy" ||
    value === "long" ||
    value === "1"
  ) {
    return "buy";
  }

  if (
    value === "sell" ||
    value === "short" ||
    value === "2"
  ) {
    return "sell";
  }

  return "buy";
}

function normalizeMT5Side(type) {
  const value = String(type ?? "")
    .trim()
    .toLowerCase();

  // MT5:
  // 0 = BUY
  // 1 = SELL

  if (
    value === "0" ||
    value === "buy"
  ) {
    return "buy";
  }

  if (
    value === "1" ||
    value === "sell"
  ) {
    return "sell";
  }

  return "buy";
}

function normalizeStatus(status) {
  if (typeof status === "number") {
    if (status === 2) {
      return "CLOSED";
    }

    if (status === 3) {
      return "PENDING";
    }

    return "OPEN";
  }

  const value = String(status || "OPEN")
    .trim()
    .toUpperCase();

  if (
    value.includes("CLOSE") ||
    value === "CLOSED"
  ) {
    return "CLOSED";
  }

  if (
    value.includes("PENDING") ||
    value === "CREATED"
  ) {
    return "PENDING";
  }

  return "OPEN";
}

function getBrokerNumber(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return 0;
}

// ============================================================
// NORMALIZE OPEN TIMESTAMP
// ============================================================

function normalizeOpenedAt(position) {
  if (
    !position ||
    typeof position !== "object"
  ) {
    return null;
  }

  // ----------------------------------------------------------
  // Prefer millisecond timestamps
  // ----------------------------------------------------------

  const rawTimeMsc =
    position.time_msc ??
    position.timeMsc ??
    position.openTimeMsc ??
    position.openedAtMsc ??
    null;

  if (
    rawTimeMsc !== null &&
    rawTimeMsc !== undefined &&
    rawTimeMsc !== ""
  ) {
    const timeMsc = Number(rawTimeMsc);

    if (
      Number.isFinite(timeMsc) &&
      timeMsc > 0
    ) {
      const date = new Date(timeMsc);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  // ----------------------------------------------------------
  // Fallback timestamp
  // ----------------------------------------------------------

  const rawTime =
    position.time ??
    position.openTime ??
    position.openedAt ??
    position.createdAt ??
    position.timestamp ??
    null;

  if (
    rawTime === null ||
    rawTime === undefined ||
    rawTime === ""
  ) {
    return null;
  }

  const numericTime = Number(rawTime);

  if (
    Number.isFinite(numericTime) &&
    numericTime > 0
  ) {
    const milliseconds =
      numericTime < 100000000000
        ? numericTime * 1000
        : numericTime;

    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  const parsed = new Date(rawTime);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

// ============================================================
// POSITION KEY
// ============================================================

function getPositionKey(position) {
  return [
    String(position.accountId || ""),
    normalizeSymbol(position.symbol),
    normalizeSide(position.side),
  ].join("|");
}

// ============================================================
// NORMALIZE cTRADER POSITION
// ============================================================

function normalizeBrokerPosition(position) {
  if (
    !position ||
    typeof position !== "object"
  ) {
    return null;
  }

  const positionId =
    position.id ??
    position.positionId ??
    position.position_id ??
    position.brokerPositionId ??
    position.tradeId;

  if (
    positionId === undefined ||
    positionId === null ||
    String(positionId).trim() === ""
  ) {
    return null;
  }

  const symbol = normalizeSymbol(
    position.symbol ??
      position.symbolName ??
      position.instrument ??
      "EURUSD"
  );

  const side = normalizeSide(
    position.side ??
      position.tradeSide ??
      position.direction ??
      position.tradeDirection
  );

  const grossProfit = getBrokerNumber(
    position.grossProfit,
    position.grossPnL,
    position.grossPnl,
    position.unrealizedGrossProfit,
    position.tradeData?.grossProfit,
    position.tradeData?.grossPnL,
    position.data?.grossProfit
  );

  const commission = getBrokerNumber(
    position.commission,
    position.commissions,
    position.tradeData?.commission,
    position.tradeData?.commissions,
    position.data?.commission
  );

  const swap = getBrokerNumber(
    position.swap,
    position.swapCharge,
    position.swapCommission,
    position.tradeData?.swap,
    position.tradeData?.swapCharge,
    position.data?.swap
  );

  const netProfit = getBrokerNumber(
    position.netProfit,
    position.netPnL,
    position.netPnl,
    position.unrealizedNetProfit,
    position.unrealizedPnL,
    position.pnl,
    position.tradeData?.netProfit,
    position.tradeData?.netPnL,
    position.tradeData?.pnl,
    position.data?.netProfit,
    position.data?.pnl,
    grossProfit
  );

  const openedAt =
    position.openedAt ??
    position.openTime ??
    position.createdAt ??
    position.executionTimestamp ??
    position.tradeData?.openedAt ??
    null;

  return {
    id: String(positionId),

    brokerPositionId: String(
      position.positionId ??
        position.brokerPositionId ??
        positionId
    ),

    status: normalizeStatus(
      position.status ??
        position.positionStatus ??
        "OPEN"
    ),

    openedAt,

    closedAt:
      position.closedAt ??
      position.closeTime ??
      position.tradeData?.closedAt ??
      null,

    symbol,

    side,

    entry: getBrokerNumber(
      position.entry,
      position.entryPrice,
      position.openPrice,
      position.tradeData?.entry,
      position.tradeData?.entryPrice,
      position.price
    ),

    currentPrice: getBrokerNumber(
      position.currentPrice,
      position.markPrice,
      position.tradeData?.currentPrice,
      position.tradeData?.markPrice,
      position.price,
      position.entryPrice,
      position.entry
    ),

    stopLoss: getBrokerNumber(
      position.stopLoss,
      position.stopLossPrice,
      position.sl,
      position.tradeData?.stopLoss,
      position.tradeData?.stopLossPrice
    ),

    takeProfit: getBrokerNumber(
      position.takeProfit,
      position.takeProfitPrice,
      position.tp,
      position.tradeData?.takeProfit,
      position.tradeData?.takeProfitPrice
    ),

    quantity: getBrokerNumber(
      position.lots,
      position.quantity,
      position.volumeLots,
      position.volume,
      position.tradeVolume,
      position.tradeData?.quantity,
      position.tradeData?.lots
    ),

    margin: getBrokerNumber(
      position.margin,
      position.usedMargin,
      position.marginUsed,
      position.tradeData?.margin,
      position.data?.margin
    ),

    grossProfit,
    grossPnL: grossProfit,

    commission,

    swap,

    netProfit,
    netPnL: netProfit,
    pnl: netProfit,

    risk: getBrokerNumber(
      position.risk,
      position.tradeData?.risk
    ),

    orderType:
      position.orderType ??
      position.type ??
      position.tradeData?.orderType ??
      "Market",

    broker: "cTrader",

    accountId:
      position.accountId ??
      position.ctidTraderAccountId ??
      position.traderAccountId ??
      position.tradeData?.accountId ??
      null,

    rawBrokerPosition: position,
  };
}

// ============================================================
// NORMALIZE MT5 POSITION
// ============================================================

function normalizeMT5Position(
  position,
  brokerTimeMsc = null
) {
  if (
    !position ||
    typeof position !== "object"
  ) {
    return null;
  }

  const ticket =
    position.ticket ??
    position.positionId ??
    position.id;

  if (
    ticket === undefined ||
    ticket === null
  ) {
    console.error(
      "❌ MT5 position has no ticket:",
      position
    );

    return null;
  }

  const symbol = normalizeSymbol(
    position.symbol ??
      position.symbolName ??
      "EURUSD"
  );

  const side = normalizeMT5Side(
    position.type
  );

  const quantity = getBrokerNumber(
    position.volume,
    position.volumeLots,
    position.lots,
    position.quantity
  );

  const entry = getBrokerNumber(
    position.price_open,
    position.priceOpen,
    position.openPrice,
    position.entry,
    position.entryPrice
  );

  const currentPrice = getBrokerNumber(
    position.price_current,
    position.priceCurrent,
    position.currentPrice,
    position.markPrice,
    entry
  );

  const pnl = getBrokerNumber(
    position.profit,
    position.pnl,
    position.netProfit
  );

  const swap = getBrokerNumber(
    position.swap
  );

  const commission = getBrokerNumber(
    position.commission
  );

  // ==========================================================
  // MT5 OPEN TIME
  // ==========================================================

  const openedAt =
    normalizeOpenedAt(position);

  const openedAtMsc =
    getBrokerNumber(
      position.time_msc,
      position.timeMsc,
      position.openTimeMsc,
      position.openedAtMsc
    );

  // ==========================================================
  // MT5 BROKER TIME
  // ==========================================================

  const positionBrokerTimeMsc =
    getBrokerNumber(
      position.broker_time_msc,
      position.brokerTimeMsc,
      brokerTimeMsc
    );

  console.log(
    "🕒 MT5 POSITION TIME:",
    {
      ticket,
      time: position.time,
      time_msc: position.time_msc,
      broker_time_msc:
        position.broker_time_msc,
      receivedBrokerTimeMsc:
        brokerTimeMsc,
      openedAt,
      openedAtMsc,
      browserNow: Date.now(),
      browserISO:
        new Date().toISOString(),
    }
  );

  const margin = getBrokerNumber(
    position.margin,
    position.usedMargin,
    position.marginUsed,
    position.tradeData?.margin
  );

  // ==========================================================
  // NORMALIZED MT5 POSITION
  // ==========================================================

  const normalizedPosition = {
    id: `mt5-${String(ticket)}`,

    brokerPositionId:
      String(ticket),

    status: "OPEN",

    openedAt,

    openedAtMsc,

    brokerTimeMsc:
      positionBrokerTimeMsc,

    broker_time_msc:
      positionBrokerTimeMsc,

    time_msc:
      openedAtMsc,

    timeMsc:
      openedAtMsc,

    openTimeMsc:
      openedAtMsc,

    closedAt: null,

    symbol,

    side,

    entry,

    currentPrice,

    stopLoss:
      getBrokerNumber(
        position.sl,
        position.stopLoss,
        position.stopLossPrice
      ),

    takeProfit:
      getBrokerNumber(
        position.tp,
        position.takeProfit,
        position.takeProfitPrice
      ),

    quantity,

    margin,

    grossProfit: pnl,
    grossPnL: pnl,

    netProfit: pnl,
    netPnL: pnl,

    pnl,

    commission,

    swap,

    risk: 0,

    orderType: "Market",

    broker: "MT5",

    accountId:
      position.accountId ??
      position.login ??
      null,

    rawBrokerPosition:
      position,
  };

  console.log(
    "✅ NORMALIZED MT5 POSITION:",
    normalizedPosition
  );

  return normalizedPosition;
}

// ============================================================
// MERGE BROKER POSITIONS
// ============================================================

function mergeBrokerPositions(
  positions = []
) {
  const groups = new Map();

  positions.forEach((position) => {
    const key =
      getPositionKey(position);

    if (!groups.has(key)) {
      groups.set(key, {
        ...position,

        mergedPositionIds: [
          String(position.id),
        ],

        quantity:
          normalizeNumber(
            position.quantity
          ),

        pnl:
          normalizeNumber(
            position.pnl
          ),

        grossProfit:
          normalizeNumber(
            position.grossProfit
          ),

        netProfit:
          normalizeNumber(
            position.netProfit
          ),

        commission:
          normalizeNumber(
            position.commission
          ),

        swap:
          normalizeNumber(
            position.swap
          ),

        margin:
          normalizeNumber(
            position.margin
          ),

        weightedEntryTotal:
          normalizeNumber(
            position.entry
          ) *
          normalizeNumber(
            position.quantity
          ),
      });

      return;
    }

    const existing =
      groups.get(key);

    const newQuantity =
      normalizeNumber(
        position.quantity
      );

    existing.mergedPositionIds.push(
      String(position.id)
    );

    existing.quantity +=
      newQuantity;

    existing.pnl +=
      normalizeNumber(
        position.pnl
      );

    existing.grossProfit +=
      normalizeNumber(
        position.grossProfit
      );

    existing.netProfit +=
      normalizeNumber(
        position.netProfit
      );

    existing.commission +=
      normalizeNumber(
        position.commission
      );

    existing.swap +=
      normalizeNumber(
        position.swap
      );

    existing.margin +=
      normalizeNumber(
        position.margin
      );

    existing.weightedEntryTotal +=
      normalizeNumber(
        position.entry
      ) *
      newQuantity;

    if (
      normalizeNumber(
        position.currentPrice
      ) > 0
    ) {
      existing.currentPrice =
        normalizeNumber(
          position.currentPrice
        );
    }

    existing.status =
      position.status;
  });

  return Array.from(
    groups.values()
  ).map((position) => {
    const quantity =
      normalizeNumber(
        position.quantity
      );

    return {
      ...position,

      entry:
        quantity > 0
          ? position.weightedEntryTotal /
            quantity
          : position.entry,

      weightedEntryTotal:
        undefined,
    };
  });
}

// ============================================================
// TRADE PROVIDER
// ============================================================

export function TradeProvider({
  children,
}) {
  const {
    bid,
    ask,
    symbol: activeSymbol,
  } = useMarket();

  const { addTrade } =
    useJournal();

  const [
    openTrades,
    setOpenTrades,
  ] = useState([]);

  const [
    pendingOrders,
    setPendingOrders,
  ] = useState([]);

  const [
    closedTrades,
    setClosedTrades,
  ] = useState([]);

  const [
    tradeNotification,
    setTradeNotification,
  ] = useState(null);

  // ==========================================================
  // MT5 CLOSED POSITION TRACKING
  // ==========================================================

  const previousMT5PositionsRef =
    useRef(new Map());

  // ==========================================================
  // BROKER TIME SYNC
  // ==========================================================

  const brokerClockRef =
    useRef({
      brokerTimeMsc: null,
      clientTimeMsc: null,
    });

  const [
    brokerTimeMsc,
    setBrokerTimeMsc,
  ] = useState(null);

  // ==========================================================
  // STORE FRESH BROKER/CLIENT TIME SAMPLE
  // ==========================================================

  const updateBrokerClock =
    useCallback(
      (newBrokerTimeMsc) => {
        const brokerTime =
          Number(
            newBrokerTimeMsc
          );

        if (
          !Number.isFinite(
            brokerTime
          ) ||
          brokerTime <= 0
        ) {
          return;
        }

        const clientTime =
          Date.now();

        brokerClockRef.current = {
          brokerTimeMsc:
            brokerTime,

          clientTimeMsc:
            clientTime,
        };

        setBrokerTimeMsc(
          brokerTime
        );
      },
      []
    );

  // ==========================================================
  // ESTIMATE CURRENT BROKER TIME
  // ==========================================================

  const getCurrentBrokerTimeMsc =
    useCallback(() => {
      const {
        brokerTimeMsc:
          sampledBrokerTime,
        clientTimeMsc,
      } =
        brokerClockRef.current;

      if (
        !Number.isFinite(
          sampledBrokerTime
        ) ||
        !Number.isFinite(
          clientTimeMsc
        )
      ) {
        return null;
      }

      const elapsed =
        Date.now() -
        clientTimeMsc;

      return (
        sampledBrokerTime +
        Math.max(
          0,
          elapsed
        )
      );
    }, []);

  // ==========================================================
  // TRADE NOTIFICATION
  // ==========================================================

  const showTradeNotification =
    useCallback((trade) => {
      if (!trade) {
        return;
      }

      setTradeNotification({
        id: trade.id,
        trade,
        createdAt: Date.now(),
      });
    }, []);

  const hideTradeNotification =
    useCallback(() => {
      setTradeNotification(null);
    }, []);

  // ==========================================================
  // ACCOUNT
  // ==========================================================

  const [
    account,
    setAccount,
  ] = useState({
    balance: 100158.75,
    currency: "USD",
    leverage: 100,
  });

  const balance =
    normalizeNumber(
      account.balance
    );

  const leverage =
    normalizeNumber(
      account.leverage,
      100
    ) || 100;

  const currentSymbol =
    normalizeSymbol(
      activeSymbol
    );

  // ==========================================================
  // MT5 SYNC
  // ==========================================================

  const syncMT5Positions =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "http://localhost:4000/api/mt5/positions",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            `MT5 positions request failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        if (
          !data ||
          data.success !== true
        ) {
          console.warn(
            "⚠️ MT5 positions response was not successful:",
            data
          );

          return [];
        }

        // ======================================================
        // BROKER CLOCK SAMPLE
        // ======================================================

        const responseBrokerTimeMsc =
          getBrokerNumber(
            data.broker_time_msc,
            data.brokerTimeMsc
          );

        if (
          responseBrokerTimeMsc > 0
        ) {
          updateBrokerClock(
            responseBrokerTimeMsc
          );
        }

        // ======================================================
        // MT5 POSITIONS
        // ======================================================

        const mt5Positions =
          Array.isArray(
            data.positions
          )
            ? data.positions
            : [];

        const normalizedMT5Positions =
          mt5Positions
            .map(
              (position) =>
                normalizeMT5Position(
                  position,
                  responseBrokerTimeMsc
                )
            )
            .filter(Boolean);

        // ======================================================
        // DETECT CLOSED MT5 POSITIONS
        // ======================================================

        const currentMT5PositionsMap =
          new Map();

        normalizedMT5Positions.forEach(
          (position) => {
            currentMT5PositionsMap.set(
              String(
                position.brokerPositionId
              ),
              position
            );
          }
        );

        const previousMT5Positions =
          previousMT5PositionsRef.current;

        previousMT5Positions.forEach(
          (
            previousPosition,
            positionId
          ) => {
            if (
              currentMT5PositionsMap.has(
                positionId
              )
            ) {
              return;
            }

            const closedTime =
              new Date();

            const openedTime =
              previousPosition.openedAt
                ? new Date(
                    previousPosition.openedAt
                  )
                : closedTime;

            const durationSeconds =
              Math.max(
                0,
                Math.floor(
                  (
                    closedTime -
                    openedTime
                  ) / 1000
                )
              );

            const finalPnL =
              normalizeNumber(
                previousPosition.pnl ??
                  previousPosition.netProfit
              );

            const closedTrade = {
              ...previousPosition,

              status: "CLOSED",

              closedAt:
                closedTime.toISOString(),

              durationSeconds,

              date:
                closedTime
                  .toISOString()
                  .split("T")[0],

              pair:
                previousPosition.symbol,

              direction:
                previousPosition.side ===
                "buy"
                  ? "Long"
                  : "Short",

              entryPrice:
                normalizeNumber(
                  previousPosition.entry
                ),

              exitPrice:
                normalizeNumber(
                  previousPosition.currentPrice ??
                    previousPosition.entry
                ),

              pnl: finalPnL,

              netProfit: finalPnL,

              netPnL: finalPnL,

              result:
                finalPnL > 0
                  ? "Win"
                  : finalPnL < 0
                  ? "Loss"
                  : "Breakeven",
            };

            console.log(
              "📕 MT5 POSITION CLOSED:",
              closedTrade
            );

            setClosedTrades(
              (prev) => {
                const alreadyExists =
                  prev.some(
                    (trade) =>
                      String(
                        trade.brokerPositionId
                      ) ===
                      String(
                        positionId
                      )
                  );

                if (
                  alreadyExists
                ) {
                  return prev;
                }

                return [
                  ...prev,
                  closedTrade,
                ];
              }
            );

            addTrade?.(
              closedTrade
            );
          }
        );

        // ======================================================
        // SAVE CURRENT MT5 POSITIONS
        // ======================================================

        previousMT5PositionsRef.current =
          currentMT5PositionsMap;

        // ======================================================
        // DEBUG
        // ======================================================

        console.log(
          "🔄 MT5 POSITIONS SYNC:",
          {
            brokerTimeMsc:
              responseBrokerTimeMsc,

            currentBrokerTimeMsc:
              getCurrentBrokerTimeMsc(),

            positions:
              normalizedMT5Positions,
          }
        );

        // ======================================================
        // UPDATE OPEN TRADES
        // ======================================================

        setOpenTrades(
          (prevTrades) => {
            const nonMT5Trades =
              prevTrades.filter(
                (trade) =>
                  String(
                    trade.broker || ""
                  ).toLowerCase() !==
                  "mt5"
              );

            const finalTrades = [
              ...nonMT5Trades,
              ...normalizedMT5Positions,
            ];

            console.log(
              "🔥 FINAL POSITIONS AFTER MT5 SYNC:",
              finalTrades
            );

            return finalTrades;
          }
        );

        return normalizedMT5Positions;
      } catch (error) {
        console.error(
          "❌ MT5 POSITION SYNC ERROR:",
          error
        );

        return [];
      }
    }, [
      getCurrentBrokerTimeMsc,
      updateBrokerClock,
      addTrade,
    ]);

  // ==========================================================
  // MT5 POLLING
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    const initialSync =
      async () => {
        if (!cancelled) {
          await syncMT5Positions();
        }
      };

    initialSync();

    const interval =
      setInterval(() => {
        if (!cancelled) {
          syncMT5Positions();
        }
      }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    syncMT5Positions,
  ]);

  // ==========================================================
  // FLOATING P&L
  // ==========================================================

  const floatingPnL =
    useMemo(() => {
      return openTrades.reduce(
        (sum, trade) => {
          const broker =
            String(
              trade.broker || ""
            ).toLowerCase();

          if (
            broker === "ctrader"
          ) {
            return (
              sum +
              normalizeNumber(
                trade.grossProfit ??
                  trade.grossPnL
              )
            );
          }

          if (
            broker === "mt5"
          ) {
            return (
              sum +
              normalizeNumber(
                trade.pnl ??
                  trade.netProfit
              )
            );
          }

          return (
            sum +
            normalizeNumber(
              trade.pnl
            )
          );
        },
        0
      );
    }, [
      openTrades,
    ]);

  // ==========================================================
  // TOTAL NET P&L
  // ==========================================================

  const totalNetPnL =
    useMemo(() => {
      return openTrades.reduce(
        (sum, trade) =>
          sum +
          normalizeNumber(
            trade.netProfit ??
              trade.netPnL ??
              trade.pnl
          ),
        0
      );
    }, [
      openTrades,
    ]);

  // ==========================================================
  // COMMISSION
  // ==========================================================

  const totalCommission =
    useMemo(() => {
      return openTrades.reduce(
        (sum, trade) =>
          sum +
          normalizeNumber(
            trade.commission
          ),
        0
      );
    }, [
      openTrades,
    ]);

  // ==========================================================
  // SWAP
  // ==========================================================

  const totalSwap =
    useMemo(() => {
      return openTrades.reduce(
        (sum, trade) =>
          sum +
          normalizeNumber(
            trade.swap
          ),
        0
      );
    }, [
      openTrades,
    ]);

  // ==========================================================
  // EQUITY
  // ==========================================================

  const equity =
    useMemo(() => {
      return (
        balance +
        totalNetPnL
      );
    }, [
      balance,
      totalNetPnL,
    ]);

  // ==========================================================
  // MARGIN USED
  // ==========================================================

  const marginUsed =
    useMemo(() => {
      return openTrades.reduce(
        (sum, trade) =>
          sum +
          normalizeNumber(
            trade.margin
          ),
        0
      );
    }, [
      openTrades,
    ]);

  // ==========================================================
  // FREE MARGIN
  // ==========================================================

  const freeMargin =
    useMemo(() => {
      return (
        equity -
        marginUsed
      );
    }, [
      equity,
      marginUsed,
    ]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const openTradesCount =
    openTrades.length;

  const closedCount =
    closedTrades.length;

  const winningTrades =
    useMemo(() => {
      return closedTrades.filter(
        (trade) =>
          normalizeNumber(
            trade.netProfit ??
              trade.pnl
          ) > 0
      ).length;
    }, [
      closedTrades,
    ]);

  const losingTrades =
    useMemo(() => {
      return closedTrades.filter(
        (trade) =>
          normalizeNumber(
            trade.netProfit ??
              trade.pnl
          ) < 0
      ).length;
    }, [
      closedTrades,
    ]);

  const winRate =
    useMemo(() => {
      if (
        closedCount === 0
      ) {
        return 0;
      }

      return (
        (winningTrades /
          closedCount) *
        100
      );
    }, [
      winningTrades,
      closedCount,
    ]);

  // ==========================================================
  // ADD BROKER POSITION
  // ==========================================================

  const addBrokerPosition =
    useCallback(
      (position) => {
        const normalizedPosition =
          normalizeBrokerPosition(
            position
          );

        if (
          !normalizedPosition
        ) {
          return null;
        }

        if (
          normalizedPosition.status ===
          "CLOSED"
        ) {
          setOpenTrades(
            (prev) =>
              prev.filter(
                (trade) =>
                  String(
                    trade.id
                  ) !==
                  String(
                    normalizedPosition.id
                  )
              )
          );

          setClosedTrades(
            (prev) => {
              const exists =
                prev.some(
                  (trade) =>
                    String(
                      trade.id
                    ) ===
                    String(
                      normalizedPosition.id
                    )
                );

              return exists
                ? prev
                : [
                    ...prev,
                    normalizedPosition,
                  ];
            }
          );

          return normalizedPosition;
        }

        let isNew = false;

        setOpenTrades(
          (prev) => {
            const exists =
              prev.some(
                (trade) =>
                  String(
                    trade.id
                  ) ===
                  String(
                    normalizedPosition.id
                  )
              );

            if (exists) {
              return prev.map(
                (trade) =>
                  String(
                    trade.id
                  ) ===
                  String(
                    normalizedPosition.id
                  )
                    ? {
                        ...trade,
                        ...normalizedPosition,
                      }
                    : trade
              );
            }

            isNew = true;

            return [
              ...prev,
              normalizedPosition,
            ];
          }
        );

        setTimeout(() => {
          if (isNew) {
            showTradeNotification(
              normalizedPosition
            );
          }
        }, 0);

        return normalizedPosition;
      },
      [
        showTradeNotification,
      ]
    );

  // ==========================================================
  // UPDATE BROKER POSITION
  // ==========================================================

  const updateBrokerPosition =
    useCallback(
      (
        positionId,
        updates = {}
      ) => {
        if (
          positionId ===
            undefined ||
          positionId === null
        ) {
          return;
        }

        setOpenTrades(
          (prev) =>
            prev.map(
              (trade) =>
                String(
                  trade.id
                ) ===
                String(
                  positionId
                )
                  ? {
                      ...trade,
                      ...updates,
                    }
                  : trade
            )
        );
      },
      []
    );

  // ==========================================================
  // REMOVE BROKER POSITION
  // ==========================================================

  const removeBrokerPosition =
    useCallback(
      (positionId) => {
        if (
          positionId ===
            undefined ||
          positionId === null
        ) {
          return;
        }

        setOpenTrades(
          (prev) =>
            prev.filter(
              (trade) =>
                String(
                  trade.id
                ) !==
                String(
                  positionId
                )
            )
        );
      },
      []
    );

  // ==========================================================
  // SYNC cTRADER POSITIONS
  // ==========================================================

  const syncBrokerPositions =
    useCallback(
      (positions = []) => {
        if (
          !Array.isArray(
            positions
          )
        ) {
          return [];
        }

        const normalizedPositions =
          positions
            .map(
              normalizeBrokerPosition
            )
            .filter(Boolean);

        const brokerOpenPositions =
          normalizedPositions.filter(
            (position) =>
              position.status ===
              "OPEN"
          );

        setOpenTrades(
          (prevTrades) => {
            const nonCTraderTrades =
              prevTrades.filter(
                (trade) =>
                  String(
                    trade.broker || ""
                  ).toLowerCase() !==
                  "ctrader"
              );

            return [
              ...nonCTraderTrades,
              ...brokerOpenPositions,
            ];
          }
        );

        // Also capture broker-reported closed positions.

        const brokerClosedPositions =
          normalizedPositions.filter(
            (position) =>
              position.status ===
              "CLOSED"
          );

        if (
          brokerClosedPositions.length >
          0
        ) {
          setClosedTrades(
            (prev) => {
              const merged = [
                ...prev,
              ];

              brokerClosedPositions.forEach(
                (closedPosition) => {
                  const exists =
                    merged.some(
                      (trade) =>
                        String(
                          trade.id
                        ) ===
                        String(
                          closedPosition.id
                        )
                    );

                  if (!exists) {
                    merged.push(
                      closedPosition
                    );
                  }
                }
              );

              return merged;
            }
          );
        }

        return brokerOpenPositions;
      },
      []
    );

  // ============================================================
// ADD PENDING ORDER
// ============================================================

const addPendingOrder =
useCallback(
  (order) => {
    if (!order || typeof order !== "object") {
      console.error(
        "❌ Cannot add pending order: invalid order",
        order
      );
      return null;
    }

    // --------------------------------------------------------
    // BROKER RESPONSE CAN BE NESTED
    // --------------------------------------------------------

    const brokerOrder =
      order.pendingOrder ??
      order.order ??
      order.data?.pendingOrder ??
      order.data?.order ??
      order.result?.pendingOrder ??
      order.result?.order ??
      order;

    // --------------------------------------------------------
    // RESOLVE REAL MT5 ORDER TICKET
    // --------------------------------------------------------

    const resolvedTicket =
      order.ticket ??
      order.orderId ??
      order.brokerOrderId ??
      order.order_id ??
      order.orderTicket ??
      order.broker_order_id ??
      brokerOrder.ticket ??
      brokerOrder.orderId ??
      brokerOrder.brokerOrderId ??
      brokerOrder.order_id ??
      brokerOrder.orderTicket ??
      brokerOrder.broker_order_id ??
      null;

    // --------------------------------------------------------
    // KEEP UI ID SEPARATE FROM BROKER TICKET
    // --------------------------------------------------------

    const uiId =
      order.id ??
      `pending-${Date.now()}`;

    const newOrder = {
      id: uiId,

      // REAL MT5 TICKET
      orderId: resolvedTicket,
      brokerOrderId: resolvedTicket,
      ticket: resolvedTicket,

      status: "PENDING",

      createdAt:
        order.createdAt ??
        brokerOrder.createdAt ??
        new Date().toISOString(),

      symbol: normalizeSymbol(
        order.symbol ??
        brokerOrder.symbol ??
        currentSymbol
      ),

      side: normalizeSide(
        order.side ??
        brokerOrder.side
      ),

      orderType:
        order.orderType ??
        order.type ??
        brokerOrder.orderType ??
        brokerOrder.type ??
        "Limit",

      entry: normalizeNumber(
        order.entry ??
        order.price ??
        brokerOrder.entry ??
        brokerOrder.price ??
        brokerOrder.price_open
      ),

      currentPrice: normalizeNumber(
        order.currentPrice ??
        brokerOrder.currentPrice ??
        brokerOrder.price_current
      ),

      stopLoss: normalizeNumber(
        order.stopLoss ??
        order.sl ??
        brokerOrder.stopLoss ??
        brokerOrder.sl
      ),

      takeProfit: normalizeNumber(
        order.takeProfit ??
        order.tp ??
        brokerOrder.takeProfit ??
        brokerOrder.tp
      ),

      quantity: normalizeNumber(
        order.quantity ??
        order.lots ??
        order.volume ??
        brokerOrder.quantity ??
        brokerOrder.lots ??
        brokerOrder.volume
      ),

      margin: normalizeNumber(
        order.margin ??
        brokerOrder.margin ??
        brokerOrder.usedMargin
      ),

      risk: normalizeNumber(
        order.risk ??
        brokerOrder.risk
      ),

      broker:
        order.broker ??
        "MT5",

      rawBrokerOrder:
        brokerOrder,
    };

    console.log(
      "✅ MT5 PENDING ORDER STORED:",
      {
        uiId: newOrder.id,
        ticket: newOrder.ticket,
        orderId: newOrder.orderId,
        brokerOrderId: newOrder.brokerOrderId,
        symbol: newOrder.symbol,
        orderType: newOrder.orderType,
        entry: newOrder.entry,
      }
    );

    // --------------------------------------------------------
    // SAVE ORDER
    // --------------------------------------------------------

    setPendingOrders(
      (prev) => {
        const identifier =
          String(
            newOrder.orderId ??
            newOrder.ticket ??
            newOrder.id
          );

        const exists =
          prev.some(
            (existing) =>
              String(
                existing.orderId ??
                existing.ticket ??
                existing.id
              ) === identifier
          );

        if (exists) {
          return prev.map(
            (existing) =>
              String(
                existing.orderId ??
                existing.ticket ??
                existing.id
              ) === identifier
                ? {
                    ...existing,
                    ...newOrder,
                  }
                : existing
          );
        }

        return [
          ...prev,
          newOrder,
        ];
      }
    );

    return newOrder;
  },
  [currentSymbol]
);

  // ============================================================
  // CANCEL PENDING ORDER
  // ============================================================

  const cancelPendingOrder =
    useCallback(
      async (order) => {
        if (!order) {
          return null;
        }

        const orderId =
          order.orderId ??
          order.brokerOrderId ??
          order.ticket ??
          order.id;

        if (
          orderId ===
            undefined ||
          orderId === null ||
          String(orderId).trim() === ""
        ) {
          console.error(
            "❌ Cannot cancel pending order: missing order ID",
            order
          );

          return null;
        }

        console.log(
          "🟠 CANCEL MT5 PENDING ORDER:",
          {
            orderId,
            order,
          }
        );

        try {
          const response =
            await fetch(
              "http://localhost:4000/api/mt5/cancel-order",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  ticket:
                    Number(orderId),
                }),
              }
            );

          const data =
            await response.json();

          console.log(
            "🟠 MT5 CANCEL RESPONSE:",
            data
          );

          if (
            !response.ok ||
            data.success !== true
          ) {
            throw new Error(
              data.error ||
                data.message ||
                "Failed to cancel pending order"
            );
          }

          setPendingOrders(
            (prev) =>
              prev.filter(
                (item) => {
                  const itemId =
                    item.orderId ??
                    item.brokerOrderId ??
                    item.ticket ??
                    item.id;

                  return (
                    String(itemId) !==
                    String(orderId)
                  );
                }
              )
          );

          console.log(
            "✅ MT5 PENDING ORDER CANCELLED:",
            orderId
          );

          return data;
        } catch (error) {
          console.error(
            "❌ MT5 PENDING ORDER CANCEL ERROR:",
            error
          );

          return {
            success: false,
            error:
              error.message,
          };
        }
      },
      []
    );

  // ============================================================
  // MODIFY PENDING ORDER HELPER
  // ============================================================

  const updatePendingOrder =
    useCallback(
      async (
        order,
        updates = {}
      ) => {
        if (!order) {
          return {
            success: false,
            error: "Pending order is required",
          };
        }

        const orderId =
          order.orderId ??
          order.brokerOrderId ??
          order.ticket ??
          order.id;

        const ticket = Number(orderId);

        if (
          !Number.isFinite(ticket) ||
          ticket <= 0
        ) {
          console.error(
            "❌ Cannot modify pending order: invalid order ID",
            order
          );

          return {
            success: false,
            error: "Invalid pending order ticket",
          };
        }

        // Keep the existing broker values when only one field is modified.
        const currentEntry = normalizeNumber(
          order.entry ??
            order.price ??
            order.priceOpen
        );

        const currentStopLoss = normalizeNumber(
          order.stopLoss ??
            order.sl
        );

        const currentTakeProfit = normalizeNumber(
          order.takeProfit ??
            order.tp
        );

        const price = normalizeNumber(
          updates.entry ??
            updates.price ??
            currentEntry
        );

        const stopLoss = normalizeNumber(
          updates.stopLoss ??
            updates.sl ??
            currentStopLoss
        );

        const takeProfit = normalizeNumber(
          updates.takeProfit ??
            updates.tp ??
            currentTakeProfit
        );

        if (!Number.isFinite(price) || price <= 0) {
          console.error(
            "❌ Cannot modify pending order: invalid entry price",
            {
              ticket,
              price,
              updates,
            }
          );

          return {
            success: false,
            error: "Invalid entry price",
          };
        }

        console.log(
          "🔵 MODIFYING MT5 PENDING ORDER:",
          {
            ticket,
            price,
            stopLoss,
            takeProfit,
            updates,
          }
        );

        try {
          const response =
            await fetch(
              "http://localhost:4000/api/mt5/modify-order",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  ticket,
                  price,
                  stopLoss,
                  takeProfit,
                }),
              }
            );

          const data =
            await response.json();

          console.log(
            "📩 MT5 MODIFY RESPONSE:",
            data
          );

          if (
            !response.ok ||
            data.success !== true
          ) {
            throw new Error(
              data.error ||
                data.message ||
                "Failed to modify pending order"
            );
          }

          let updatedOrder = null;

          setPendingOrders(
            (prev) =>
              prev.map(
                (item) => {
                  const itemId =
                    item.orderId ??
                    item.brokerOrderId ??
                    item.ticket ??
                    item.id;

                  if (
                    String(itemId) !==
                    String(ticket)
                  ) {
                    return item;
                  }

                  updatedOrder = {
                    ...item,
                    entry: price,
                    price,
                    stopLoss,
                    sl: stopLoss,
                    takeProfit,
                    tp: takeProfit,
                    updatedAt:
                      new Date().toISOString(),
                    rawBrokerOrder:
                      data.pendingOrder ??
                      data.order ??
                      item.rawBrokerOrder,
                  };

                  return updatedOrder;
                }
              )
          );

          console.log(
            "✅ MT5 PENDING ORDER MODIFIED:",
            {
              ticket,
              price,
              stopLoss,
              takeProfit,
            }
          );

          return {
            ...data,
            success: true,
            orderId: ticket,
            ticket,
            order: updatedOrder,
          };
        } catch (error) {
          console.error(
            "❌ MT5 PENDING ORDER MODIFY ERROR:",
            error
          );

          return {
            success: false,
            error:
              error?.message ||
              "Failed to modify pending order",
          };
        }
      },
      []
    );

  // ============================================================
  // MODIFY PENDING ENTRY
  // ============================================================

  const modifyPendingOrderEntry =
    useCallback(
      (
        order,
        newEntry
      ) => {
        if (!order) {
          return null;
        }

        const entry =
          normalizeNumber(
            newEntry
          );

        if (
          entry <= 0
        ) {
          console.error(
            "❌ Invalid pending order entry:",
            newEntry
          );

          return null;
        }

        return updatePendingOrder(
          order,
          {
            entry,
          }
        );
      },
      [
        updatePendingOrder,
      ]
    );

  // ============================================================
  // MODIFY PENDING STOP LOSS
  // ============================================================

  const modifyPendingOrderStopLoss =
    useCallback(
      (
        order,
        newStopLoss
      ) => {
        if (!order) {
          return null;
        }

        const stopLoss =
          normalizeNumber(
            newStopLoss
          );

        if (
          stopLoss <= 0
        ) {
          console.error(
            "❌ Invalid pending order stop loss:",
            newStopLoss
          );

          return null;
        }

        return updatePendingOrder(
          order,
          {
            stopLoss,
          }
        );
      },
      [
        updatePendingOrder,
      ]
    );

  // ============================================================
  // MODIFY PENDING TAKE PROFIT
  // ============================================================

  const modifyPendingOrderTakeProfit =
    useCallback(
      (
        order,
        newTakeProfit
      ) => {
        if (!order) {
          return null;
        }

        const takeProfit =
          normalizeNumber(
            newTakeProfit
          );

        if (
          takeProfit <= 0
        ) {
          console.error(
            "❌ Invalid pending order take profit:",
            newTakeProfit
          );

          return null;
        }

        return updatePendingOrder(
          order,
          {
            takeProfit,
          }
        );
      },
      [
        updatePendingOrder,
      ]
    );

  // ==========================================================
  // EXECUTE LOCAL TRADE
  // ==========================================================

  const executeTrade =
    useCallback(
      (trade) => {
        const side =
          normalizeSide(
            trade.side
          );

        const executionPrice =
          side === "buy"
            ? Number(ask)
            : Number(bid);

        if (
          !Number.isFinite(
            executionPrice
          ) ||
          executionPrice <= 0
        ) {
          return null;
        }

        const lots =
          normalizeNumber(
            trade.quantity
          );

        if (
          lots <= 0
        ) {
          return null;
        }

        const symbol =
          normalizeSymbol(
            trade.symbol ||
              currentSymbol
          );

        const contractSize =
          symbol === "XAUUSD"
            ? 100
            : 100000;

        const margin =
          (
            lots *
            contractSize *
            executionPrice
          ) /
          leverage;

        const newTrade = {
          id:
            `local-${Date.now()}`,

          status: "OPEN",

          openedAt:
            new Date().toISOString(),

          openedAtMsc:
            Date.now(),

          symbol,

          side,

          entry:
            executionPrice,

          currentPrice:
            executionPrice,

          stopLoss:
            normalizeNumber(
              trade.stopLoss
            ),

          takeProfit:
            normalizeNumber(
              trade.takeProfit
            ),

          quantity:
            lots,

          margin,

          grossProfit: 0,

          netProfit: 0,

          commission: 0,

          swap: 0,

          pnl: 0,

          risk:
            normalizeNumber(
              trade.risk
            ),

          orderType:
            trade.orderType ||
            "Market",

          broker: "Local",
        };

        setOpenTrades(
          (prev) => [
            ...prev,
            newTrade,
          ]
        );

        showTradeNotification(
          newTrade
        );

        return newTrade;
      },
      [
        bid,
        ask,
        leverage,
        currentSymbol,
        showTradeNotification,
      ]
    );

  // ============================================================
  // CLOSE TRADE
  // ============================================================

  const closeTrade =
    useCallback(
      (id) => {
        const trade =
          openTrades.find(
            (item) =>
              String(
                item.id
              ) ===
              String(id)
          );

        if (!trade) {
          return null;
        }

        const closedTime =
          new Date();

        const openedTime =
          trade.openedAt
            ? new Date(
                trade.openedAt
              )
            : closedTime;

        const durationSeconds =
          Math.max(
            0,
            Math.floor(
              (
                closedTime -
                openedTime
              ) / 1000
            )
          );

        const netProfit =
          normalizeNumber(
            trade.netProfit ??
              trade.pnl
          );

        const closedTrade = {
          ...trade,

          status: "CLOSED",

          closedAt:
            closedTime.toISOString(),

          durationSeconds,

          date:
            closedTime
              .toISOString()
              .split("T")[0],

          pair:
            trade.symbol,

          direction:
            normalizeSide(
              trade.side
            ) === "buy"
              ? "Long"
              : "Short",

          entryPrice:
            normalizeNumber(
              trade.entry
            ),

          exitPrice:
            normalizeNumber(
              trade.currentPrice ??
                trade.entry
            ),

          pnl:
            netProfit,

          netProfit:
            netProfit,

          result:
            netProfit > 0
              ? "Win"
              : netProfit < 0
              ? "Loss"
              : "Breakeven",
        };

        setOpenTrades(
          (prev) =>
            prev.filter(
              (item) =>
                String(
                  item.id
                ) !==
                String(id)
            )
        );

        setClosedTrades(
          (prev) => [
            ...prev,
            closedTrade,
          ]
        );

        addTrade?.(
          closedTrade
        );

        return closedTrade;
      },
      [
        openTrades,
        addTrade,
      ]
    );

  // ============================================================
  // PARTIAL CLOSE
  // ============================================================

  const partialCloseTrade =
    useCallback(
      (
        id,
        closeQuantity
      ) => {
        const trade =
          openTrades.find(
            (item) =>
              String(
                item.id
              ) ===
              String(id)
          );

        if (!trade) {
          return null;
        }

        const currentQuantity =
          normalizeNumber(
            trade.quantity
          );

        const quantityToClose =
          normalizeNumber(
            closeQuantity
          );

        if (
          currentQuantity <= 0 ||
          quantityToClose <= 0
        ) {
          return null;
        }

        if (
          quantityToClose >=
          currentQuantity
        ) {
          return closeTrade(id);
        }

        const remainingQuantity =
          currentQuantity -
          quantityToClose;

        setOpenTrades(
          (prev) =>
            prev.map(
              (item) =>
                String(
                  item.id
                ) ===
                String(id)
                  ? {
                      ...item,

                      quantity:
                        Number(
                          remainingQuantity.toFixed(
                            4
                          )
                        ),
                    }
                  : item
            )
        );

        return {
          positionId: id,

          closedQuantity:
            quantityToClose,

          remainingQuantity,
        };
      },
      [
        openTrades,
        closeTrade,
      ]
    );

// ============================================================
// MODIFY STOP LOSS — REAL MT5 POSITION
// ============================================================

const modifyStopLoss = useCallback(
  async (id, newStopLoss) => {
    const stopLoss = normalizeNumber(newStopLoss);

    if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
      throw new Error("Invalid Stop Loss price.");
    }

    const trade = openTrades.find(
      (item) => String(item.id) === String(id)
    );

    if (!trade) {
      throw new Error(
        `Open position not found for ID: ${id}`
      );
    }

    const broker = String(
      trade.broker || trade.source || ""
    ).toUpperCase();

    console.log(
      "🔎 MODIFY SL — TARGET TRADE:",
      {
        id,
        broker,
        tradeId: trade.id,
        brokerPositionId: trade.brokerPositionId,
        positionId: trade.positionId,
        ticket: trade.ticket,
        rawBrokerTicket:
          trade.rawBrokerPosition?.ticket,
        stopLoss,
        trade,
      }
    );

    if (broker === "MT5") {
      const rawTicket =
        trade.brokerPositionId ??
        trade.positionId ??
        trade.ticket ??
        trade.rawBrokerPosition?.ticket ??
        String(trade.id).replace(/^mt5-/, "");

      const ticket = Number(rawTicket);

      if (
        !Number.isInteger(ticket) ||
        ticket <= 0
      ) {
        throw new Error(
          `Invalid MT5 position ticket: ${rawTicket}`
        );
      }

      console.log(
        "✏️ SENDING REAL MT5 STOP LOSS MODIFY:",
        {
          ticket,
          stopLoss,
        }
      );

      const response = await fetch(
        "http://localhost:4000/api/mt5/modify-position",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticket,
            stopLoss,
          }),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      console.log(
        "📩 MT5 MODIFY SL RESPONSE:",
        {
          status: response.status,
          ok: response.ok,
          data,
        }
      );

      if (
        !response.ok ||
        data?.success !== true
      ) {
        throw new Error(
          data?.message ||
          data?.error ||
          "MT5 rejected Stop Loss modification."
        );
      }

      setOpenTrades((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? {
                ...item,
                stopLoss,
              }
            : item
        )
      );

      console.log(
        "✅ REAL MT5 STOP LOSS MODIFIED:",
        {
          ticket,
          stopLoss,
        }
      );

      return data;
    }

    // NON-MT5 FALLBACK

    setOpenTrades((prev) =>
      prev.map((item) =>
        String(item.id) === String(id)
          ? {
              ...item,
              stopLoss,
            }
          : item
      )
    );

    return {
      success: true,
      positionId: id,
      stopLoss,
    };
  },
  [openTrades]
);

// ============================================================
// MODIFY TAKE PROFIT — REAL MT5 POSITION
// ============================================================

const modifyTakeProfit = useCallback(
  async (id, newTakeProfit) => {
    const takeProfit =
      normalizeNumber(newTakeProfit);

    if (
      !Number.isFinite(takeProfit) ||
      takeProfit <= 0
    ) {
      throw new Error(
        "Invalid Take Profit price."
      );
    }

    const trade = openTrades.find(
      (item) => String(item.id) === String(id)
    );

    if (!trade) {
      throw new Error(
        `Open position not found for ID: ${id}`
      );
    }

    const broker = String(
      trade.broker || trade.source || ""
    ).toUpperCase();

    console.log(
      "🔎 MODIFY TP — TARGET TRADE:",
      {
        id,
        broker,
        tradeId: trade.id,
        brokerPositionId:
          trade.brokerPositionId,
        positionId: trade.positionId,
        ticket: trade.ticket,
        rawBrokerTicket:
          trade.rawBrokerPosition?.ticket,
        takeProfit,
        trade,
      }
    );

    if (broker === "MT5") {
      const rawTicket =
        trade.brokerPositionId ??
        trade.positionId ??
        trade.ticket ??
        trade.rawBrokerPosition?.ticket ??
        String(trade.id).replace(/^mt5-/, "");

      const ticket = Number(rawTicket);

      if (
        !Number.isInteger(ticket) ||
        ticket <= 0
      ) {
        throw new Error(
          `Invalid MT5 position ticket: ${rawTicket}`
        );
      }

      console.log(
        "✏️ SENDING REAL MT5 TAKE PROFIT MODIFY:",
        {
          ticket,
          takeProfit,
        }
      );

      const response = await fetch(
        "http://localhost:4000/api/mt5/modify-position",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticket,
            takeProfit,
          }),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      console.log(
        "📩 MT5 MODIFY TP RESPONSE:",
        {
          status: response.status,
          ok: response.ok,
          data,
        }
      );

      if (
        !response.ok ||
        data?.success !== true
      ) {
        throw new Error(
          data?.message ||
          data?.error ||
          "MT5 rejected Take Profit modification."
        );
      }

      setOpenTrades((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? {
                ...item,
                takeProfit,
              }
            : item
        )
      );

      console.log(
        "✅ REAL MT5 TAKE PROFIT MODIFIED:",
        {
          ticket,
          takeProfit,
        }
      );

      return data;
    }

    // NON-MT5 FALLBACK

    setOpenTrades((prev) =>
      prev.map((item) =>
        String(item.id) === String(id)
          ? {
              ...item,
              takeProfit,
            }
          : item
      )
    );

    return {
      success: true,
      positionId: id,
      takeProfit,
    };
  },
  [openTrades]
);

  // ============================================================
  // DELETE TRADE
  // ============================================================

  const deleteTrade =
    useCallback(
      (id) => {
        const targetId =
          String(id);

        setOpenTrades(
          (prev) =>
            prev.filter(
              (trade) =>
                String(
                  trade.id
                ) !==
                targetId
            )
        );

        setClosedTrades(
          (prev) =>
            prev.filter(
              (trade) =>
                String(
                  trade.id
                ) !==
                targetId
            )
        );

        setPendingOrders(
          (prev) =>
            prev.filter(
              (order) =>
                String(
                  order.id
                ) !==
                targetId
            )
        );
      },
      []
    );

  // ============================================================
  // UPDATE ACCOUNT
  // ============================================================

  const updateAccount =
    useCallback(
      (data = {}) => {
        setAccount(
          (prev) => ({
            ...prev,
            ...data,
          })
        );
      },
      []
    );

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value = {
    // Trades
    openTrades,
    closedTrades,
    pendingOrders,

    // Trade actions
    executeTrade,
    addPendingOrder,
    closeTrade,
    partialCloseTrade,
    modifyStopLoss,
    modifyTakeProfit,

    // Pending order actions
    cancelPendingOrder,
    modifyPendingOrderEntry,
    modifyPendingOrderStopLoss,
    modifyPendingOrderTakeProfit,

    // General
    deleteTrade,

    // Notifications
    tradeNotification,
    showTradeNotification,
    hideTradeNotification,

    // Broker
    addBrokerPosition,
    updateBrokerPosition,
    removeBrokerPosition,
    syncBrokerPositions,
    syncMT5Positions,

    // Broker clock
    brokerTimeMsc,
    getCurrentBrokerTimeMsc,

    // Account
    account,
    updateAccount,
    balance,
    equity,
    leverage,

    // P&L
    floatingPnL,
    totalNetPnL,
    totalCommission,
    totalSwap,

    // Margin
    marginUsed,
    freeMargin,

    // Statistics
    openTradesCount,
    closedCount,
    winningTrades,
    losingTrades,
    winRate,
  };

  return (
    <TradeContext.Provider
      value={value}
    >
      {children}
    </TradeContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useTrade() {
  const context =
    useContext(
      TradeContext
    );

  if (!context) {
    throw new Error(
      "useTrade must be used inside TradeProvider"
    );
  }

  return context;
}