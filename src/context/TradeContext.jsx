import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import { useJournal } from "./JournalContext";
import { useMarket } from "./MarketContext";
import { calculatePnL } from "../utils/trading/calculatePnL";

const TradeContext = createContext(null);

/* ============================================================
   HELPERS
============================================================ */

function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeSymbol(symbol) {
  return String(symbol || "EURUSD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeSide(side) {
  const value = String(side || "buy")
    .trim()
    .toLowerCase();

  if (value === "buy" || value === "long") {
    return "buy";
  }

  if (value === "sell" || value === "short") {
    return "sell";
  }

  return "buy";
}

/* ============================================================
   NORMALIZE BROKER POSITION
============================================================ */

function normalizeBrokerPosition(position) {
  if (!position || typeof position !== "object") {
    return null;
  }

  const positionId =
    position.id ??
    position.positionId ??
    position.brokerPositionId;

  if (
    positionId === undefined ||
    positionId === null ||
    String(positionId).trim() === ""
  ) {
    console.error("❌ Broker position has no ID:", position);
    return null;
  }

  const status = String(
    position.status || "OPEN"
  ).toUpperCase();

  const symbol = normalizeSymbol(
    position.symbol ||
      position.symbolName ||
      "EURUSD"
  );

  return {
    /* IDENTITY */

    id: String(positionId),

    brokerPositionId: String(
      position.positionId ??
        position.brokerPositionId ??
        positionId
    ),

    /* STATUS */

    status,

    /* TIME */

    openedAt:
      position.openedAt ||
      position.openTime ||
      position.createdAt ||
      new Date().toISOString(),

    closedAt:
      position.closedAt ||
      position.closeTime ||
      null,

    /* SYMBOL */

    symbol,

    /* SIDE */

    side: normalizeSide(
      position.side ||
        position.tradeSide ||
        position.direction
    ),

    /* PRICES */

    entry: normalizeNumber(
      position.entry ??
        position.entryPrice ??
        position.price
    ),

    currentPrice: normalizeNumber(
      position.currentPrice ??
        position.markPrice ??
        position.entry ??
        position.entryPrice ??
        position.price
    ),

    stopLoss: normalizeNumber(
      position.stopLoss ??
        position.sl
    ),

    takeProfit: normalizeNumber(
      position.takeProfit ??
        position.tp
    ),

    /* QUANTITY */

    quantity: normalizeNumber(
      position.quantity ??
        position.lots ??
        position.volume
    ),

    /* FINANCIAL DATA */

    margin: normalizeNumber(position.margin),

    pnl: normalizeNumber(
      position.pnl ??
        position.netProfit ??
        position.grossProfit
    ),

    risk: normalizeNumber(position.risk),

    /* META */

    orderType:
      position.orderType || "Market",

    broker: "cTrader",

    accountId:
      position.accountId ||
      position.ctidTraderAccountId ||
      null,
  };
}

/* ============================================================
   PROVIDER
============================================================ */

export function TradeProvider({ children }) {
  const {
    bid,
    ask,
    symbol: activeSymbol,
  } = useMarket();

  const { addTrade } = useJournal();

  /* ==========================================================
     TRADE STATE
  ========================================================== */

  const [openTrades, setOpenTrades] = useState([]);

  const [pendingOrders, setPendingOrders] = useState([]);

  const [closedTrades, setClosedTrades] = useState([]);

  /* ==========================================================
     ACCOUNT
  ========================================================== */

  const [account, setAccount] = useState({
    balance: 100158.75,
    currency: "USD",
    leverage: 100,
  });

  const balance = normalizeNumber(account.balance);

  const leverage =
    normalizeNumber(account.leverage, 100) || 100;

  const currentSymbol = normalizeSymbol(activeSymbol);

  /* ==========================================================
     LIVE P&L UPDATE

     IMPORTANT:
     Only update trades of currently active symbol.
  ========================================================== */

  useEffect(() => {
    const currentBid = Number(bid);
    const currentAsk = Number(ask);

    if (
      !Number.isFinite(currentBid) ||
      !Number.isFinite(currentAsk) ||
      currentBid <= 0 ||
      currentAsk <= 0
    ) {
      return;
    }

    setOpenTrades((prevTrades) => {
      return prevTrades.map((trade) => {
        const tradeSymbol = normalizeSymbol(trade.symbol);

        /*
          Don't use EURUSD price
          for GBPUSD / XAUUSD etc.
        */

        if (tradeSymbol !== currentSymbol) {
          return trade;
        }

        const side = normalizeSide(trade.side);

        /*
          BUY closes at BID
          SELL closes at ASK
        */

        const currentPrice =
          side === "buy"
            ? currentBid
            : currentAsk;

        const pnl = calculatePnL(
          side,
          Number(trade.entry),
          currentPrice,
          Number(trade.quantity)
        );

        return {
          ...trade,
          currentPrice,
          pnl: normalizeNumber(pnl),
        };
      });
    });
  }, [bid, ask, currentSymbol]);

  /* ==========================================================
     FLOATING P&L
  ========================================================== */

  const floatingPnL = useMemo(() => {
    return openTrades.reduce(
      (sum, trade) =>
        sum + normalizeNumber(trade.pnl),
      0
    );
  }, [openTrades]);

  /* ==========================================================
     EQUITY
  ========================================================== */

  const equity = useMemo(() => {
    return balance + floatingPnL;
  }, [balance, floatingPnL]);

  /* ==========================================================
     MARGIN USED
  ========================================================== */

  const marginUsed = useMemo(() => {
    return openTrades.reduce(
      (sum, trade) =>
        sum + normalizeNumber(trade.margin),
      0
    );
  }, [openTrades]);

  /* ==========================================================
     FREE MARGIN
  ========================================================== */

  const freeMargin = useMemo(() => {
    return equity - marginUsed;
  }, [equity, marginUsed]);

  /* ==========================================================
     TRADE STATISTICS
  ========================================================== */

  const openTradesCount = openTrades.length;

  const closedCount = closedTrades.length;

  const winningTrades = useMemo(() => {
    return closedTrades.filter(
      (trade) => normalizeNumber(trade.pnl) > 0
    ).length;
  }, [closedTrades]);

  const losingTrades = useMemo(() => {
    return closedTrades.filter(
      (trade) => normalizeNumber(trade.pnl) < 0
    ).length;
  }, [closedTrades]);

  const winRate = useMemo(() => {
    if (closedCount === 0) {
      return 0;
    }

    return (
      (winningTrades / closedCount) * 100
    );
  }, [winningTrades, closedCount]);

  /* ==========================================================
     ADD / UPDATE BROKER POSITION
  ========================================================== */

  const addBrokerPosition = useCallback(
    (position) => {
      const normalizedPosition =
        normalizeBrokerPosition(position);

      if (!normalizedPosition) {
        console.error(
          "❌ Invalid broker position:",
          position
        );

        return null;
      }

      /*
        CLOSED POSITION
      */

      if (
        normalizedPosition.status === "CLOSED"
      ) {
        setOpenTrades((prev) =>
          prev.filter(
            (trade) =>
              String(trade.id) !==
              String(normalizedPosition.id)
          )
        );

        return normalizedPosition;
      }

      /*
        ADD / UPDATE POSITION
      */

      setOpenTrades((prev) => {
        const existingIndex =
          prev.findIndex(
            (trade) =>
              String(trade.id) ===
              String(normalizedPosition.id)
          );

        if (existingIndex !== -1) {
          console.log(
            "🔄 Updating broker position:",
            normalizedPosition
          );

          return prev.map((trade) =>
            String(trade.id) ===
            String(normalizedPosition.id)
              ? {
                  ...trade,
                  ...normalizedPosition,
                }
              : trade
          );
        }

        console.log(
          "✅ Adding broker position:",
          normalizedPosition
        );

        return [
          ...prev,
          normalizedPosition,
        ];
      });

      return normalizedPosition;
    },
    []
  );

  /* ==========================================================
     UPDATE BROKER POSITION
  ========================================================== */

  const updateBrokerPosition = useCallback(
    (positionId, updates = {}) => {
      if (
        positionId === undefined ||
        positionId === null
      ) {
        return;
      }

      setOpenTrades((prev) =>
        prev.map((trade) =>
          String(trade.id) ===
          String(positionId)
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

  /* ==========================================================
     REMOVE BROKER POSITION
  ========================================================== */

  const removeBrokerPosition = useCallback(
    (positionId) => {
      if (
        positionId === undefined ||
        positionId === null
      ) {
        return;
      }

      setOpenTrades((prev) =>
        prev.filter(
          (trade) =>
            String(trade.id) !==
            String(positionId)
        )
      );
    },
    []
  );

  /* ==========================================================
     SYNC BROKER POSITIONS
  ========================================================== */

  const syncBrokerPositions = useCallback(
    (positions = []) => {
      if (!Array.isArray(positions)) {
        console.error(
          "❌ Broker positions must be an array:",
          positions
        );

        return;
      }

      const normalizedPositions =
        positions
          .map(normalizeBrokerPosition)
          .filter(Boolean);

      const brokerOpenPositions =
        normalizedPositions.filter(
          (position) =>
            position.status !== "CLOSED"
        );

      console.log(
        "🔄 SYNCING BROKER POSITIONS:",
        brokerOpenPositions
      );

      setOpenTrades((prevTrades) => {
        /*
          Keep local trades.
          Replace only cTrader trades.
        */

        const localTrades =
          prevTrades.filter(
            (trade) =>
              trade.broker !== "cTrader"
          );

        return [
          ...localTrades,
          ...brokerOpenPositions,
        ];
      });
    },
    []
  );

  /* ==========================================================
     ADD PENDING ORDER
  ========================================================== */

  const addPendingOrder = useCallback(
    (order) => {
      const newOrder = {
        id: `pending-${Date.now()}`,

        status: "PENDING",

        createdAt:
          new Date().toISOString(),

        symbol: normalizeSymbol(
          order.symbol || currentSymbol
        ),

        side: normalizeSide(order.side),

        orderType:
          order.orderType || "Limit",

        entry: normalizeNumber(order.entry),

        stopLoss: normalizeNumber(
          order.stopLoss
        ),

        takeProfit: normalizeNumber(
          order.takeProfit
        ),

        quantity: normalizeNumber(
          order.quantity
        ),

        risk: normalizeNumber(order.risk),
      };

      setPendingOrders((prev) => [
        ...prev,
        newOrder,
      ]);

      return newOrder;
    },
    [currentSymbol]
  );

  /* ==========================================================
     EXECUTE LOCAL MARKET TRADE
  ========================================================== */

  const executeTrade = useCallback(
    (trade) => {
      const side = normalizeSide(trade.side);

      /*
        BUY ENTRY = ASK
        SELL ENTRY = BID
      */

      const executionPrice =
        side === "buy"
          ? Number(ask)
          : Number(bid);

      if (
        !Number.isFinite(executionPrice) ||
        executionPrice <= 0
      ) {
        console.error(
          "❌ Market price unavailable."
        );

        return null;
      }

      const lots = normalizeNumber(
        trade.quantity
      );

      if (lots <= 0) {
        console.error(
          "❌ Invalid lot size."
        );

        return null;
      }

      const contractSize =
        normalizeSymbol(
          trade.symbol || currentSymbol
        ) === "XAUUSD"
          ? 100
          : 100000;

      const margin =
        (lots *
          contractSize *
          executionPrice) /
        leverage;

      const newTrade = {
        id: `local-${Date.now()}`,

        status: "OPEN",

        openedAt:
          new Date().toISOString(),

        symbol: normalizeSymbol(
          trade.symbol || currentSymbol
        ),

        side,

        entry: executionPrice,

        currentPrice: executionPrice,

        stopLoss: normalizeNumber(
          trade.stopLoss
        ),

        takeProfit: normalizeNumber(
          trade.takeProfit
        ),

        quantity: lots,

        margin,

        pnl: 0,

        risk: normalizeNumber(trade.risk),

        orderType:
          trade.orderType || "Market",

        broker: "Local",
      };

      console.log(
        "✅ LOCAL TRADE EXECUTED:",
        newTrade
      );

      setOpenTrades((prev) => [
        ...prev,
        newTrade,
      ]);

      return newTrade;
    },
    [
      bid,
      ask,
      leverage,
      currentSymbol,
    ]
  );

  /* ==========================================================
     CLOSE TRADE
  ========================================================== */

  const closeTrade = useCallback(
    (id) => {
      const trade = openTrades.find(
        (item) =>
          String(item.id) === String(id)
      );

      if (!trade) {
        console.error(
          "❌ Trade not found:",
          id
        );

        return null;
      }

      const closedTime = new Date();

      const openedTime = new Date(
        trade.openedAt
      );

      const durationSeconds = Math.max(
        0,
        Math.floor(
          (closedTime - openedTime) / 1000
        )
      );

      const pnl = normalizeNumber(
        trade.pnl
      );

      const closedTrade = {
        ...trade,

        status: "CLOSED",

        closedAt:
          closedTime.toISOString(),

        durationSeconds,

        date: closedTime
          .toISOString()
          .split("T")[0],

        pair: trade.symbol,

        direction:
          normalizeSide(trade.side) === "buy"
            ? "Long"
            : "Short",

        entryPrice:
          normalizeNumber(trade.entry),

        exitPrice: normalizeNumber(
          trade.currentPrice ?? trade.entry
        ),

        result:
          pnl > 0
            ? "Win"
            : pnl < 0
            ? "Loss"
            : "Breakeven",
      };

      setOpenTrades((prev) =>
        prev.filter(
          (item) =>
            String(item.id) !== String(id)
        )
      );

      setClosedTrades((prev) => [
        ...prev,
        closedTrade,
      ]);

      addTrade?.(closedTrade);

      console.log(
        "✅ TRADE CLOSED:",
        closedTrade
      );

      return closedTrade;
    },
    [openTrades, addTrade]
  );

  /* ==========================================================
     DELETE TRADE
  ========================================================== */

  const deleteTrade = useCallback(
    (id) => {
      const targetId = String(id);

      setOpenTrades((prev) =>
        prev.filter(
          (trade) =>
            String(trade.id) !== targetId
        )
      );

      setClosedTrades((prev) =>
        prev.filter(
          (trade) =>
            String(trade.id) !== targetId
        )
      );

      setPendingOrders((prev) =>
        prev.filter(
          (order) =>
            String(order.id) !== targetId
        )
      );
    },
    []
  );

  /* ==========================================================
     UPDATE ACCOUNT
  ========================================================== */

  const updateAccount = useCallback(
    (data = {}) => {
      setAccount((prev) => ({
        ...prev,
        ...data,
      }));
    },
    []
  );

  /* ==========================================================
     CONTEXT VALUE
  ========================================================== */

  const value = {
    /* TRADES */

    openTrades,
    closedTrades,
    pendingOrders,

    /* TRADE ACTIONS */

    executeTrade,
    addPendingOrder,
    closeTrade,
    deleteTrade,

    /* BROKER ACTIONS */

    addBrokerPosition,
    updateBrokerPosition,
    removeBrokerPosition,
    syncBrokerPositions,

    /* ACCOUNT */

    account,
    updateAccount,

    balance,
    equity,
    leverage,

    /* P&L */

    floatingPnL,

    /* MARGIN */

    marginUsed,
    freeMargin,

    /* STATISTICS */

    openTradesCount,
    closedCount,
    winningTrades,
    losingTrades,
    winRate,
  };

  return (
    <TradeContext.Provider value={value}>
      {children}
    </TradeContext.Provider>
  );
}

/* ============================================================
   HOOK
============================================================ */

export function useTrade() {
  const context = useContext(TradeContext);

  if (!context) {
    throw new Error(
      "useTrade must be used inside TradeProvider"
    );
  }

  return context;
}