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

const TradeContext = createContext();

export function TradeProvider({ children }) {
  const { bid, ask } = useMarket();
  const { addTrade } = useJournal();

  /*
  ============================================================
  TRADE STATE
  ============================================================
  */

  const [openTrades, setOpenTrades] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);

  /*
  ============================================================
  ACCOUNT
  ============================================================

  TEMPORARY ACCOUNT SOURCE

  Later:
  cTrader account balance/equity will come here.

  UI does NOT need to change.
  */

  const [account, setAccount] = useState({
    balance: 100158.75,
    currency: "USD",
    leverage: 100,
  });

  /*
  ============================================================
  ACCOUNT VALUES
  ============================================================
  */

  const balance = Number(account.balance || 0);

  const leverage = Number(account.leverage || 100);


  /*
  ============================================================
  LIVE OPEN TRADE P&L
  ============================================================
  */

  useEffect(() => {
    setOpenTrades((prevTrades) => {
      return prevTrades.map((trade) => {

        const currentPrice =
          String(trade.side).toLowerCase() === "buy"
            ? Number(bid)
            : Number(ask);

        if (!currentPrice) {
          return trade;
        }

        const pnl = calculatePnL(
          String(trade.side).toLowerCase(),
          Number(trade.entry),
          currentPrice,
          Number(trade.quantity)
        );

        return {
          ...trade,

          currentPrice,

          pnl: Number(pnl || 0),
        };
      });
    });
  }, [bid, ask]);


  /*
  ============================================================
  FLOATING P&L
  ============================================================
  */

  const floatingPnL = useMemo(() => {

    return openTrades.reduce(
      (sum, trade) => {
        return (
          sum +
          Number(trade.pnl || 0)
        );
      },
      0
    );

  }, [openTrades]);


  /*
  ============================================================
  EQUITY
  ============================================================
  */

  const equity = useMemo(() => {

    return (
      balance +
      floatingPnL
    );

  }, [
    balance,
    floatingPnL,
  ]);


  /*
  ============================================================
  MARGIN USED
  ============================================================
  */

  const marginUsed = useMemo(() => {

    return openTrades.reduce(
      (sum, trade) => {

        return (
          sum +
          Number(trade.margin || 0)
        );

      },
      0
    );

  }, [openTrades]);


  /*
  ============================================================
  FREE MARGIN
  ============================================================
  */

  const freeMargin =
    equity -
    marginUsed;


  /*
  ============================================================
  TRADE STATISTICS
  ============================================================
  */

  const openTradesCount =
    openTrades.length;

  const closedCount =
    closedTrades.length;


  const winningTrades =
    closedTrades.filter(
      (trade) =>
        Number(trade.pnl || 0) > 0
    ).length;


  const losingTrades =
    closedTrades.filter(
      (trade) =>
        Number(trade.pnl || 0) < 0
    ).length;


  const winRate =
    closedCount === 0
      ? 0
      : (
          winningTrades /
          closedCount
        ) * 100;


  /*
  ============================================================
  ADD PENDING ORDER
  ============================================================
  */

  const addPendingOrder =
    useCallback((order) => {

      const newOrder = {

        id: Date.now(),

        status: "PENDING",

        createdAt:
          new Date().toISOString(),

        symbol:
          order.symbol || "EURUSD",

        side:
          String(
            order.side || "buy"
          ).toLowerCase(),

        orderType:
          order.orderType || "Limit",

        entry:
          Number(order.entry || 0),

        stopLoss:
          Number(
            order.stopLoss || 0
          ),

        takeProfit:
          Number(
            order.takeProfit || 0
          ),

        quantity:
          Number(
            order.quantity || 0
          ),

        risk:
          Number(
            order.risk || 0
          ),
      };


      setPendingOrders(
        (prev) => [
          ...prev,
          newOrder,
        ]
      );

      return newOrder;

    }, []);


  /*
  ============================================================
  EXECUTE MARKET TRADE
  ============================================================

  CURRENTLY:
  Local execution engine.

  LATER:
  This exact function can call cTrader.
  */

  const executeTrade =
    useCallback((trade) => {

      const side =
        String(
          trade.side || "buy"
        ).toLowerCase();


      /*
      BUY executes at ASK.
      SELL executes at BID.
      */

      const executionPrice =
        side === "buy"
          ? Number(ask)
          : Number(bid);


      if (!executionPrice) {

        console.error(
          "Market price unavailable."
        );

        return null;
      }


      /*
      ========================================================
      POSITION SIZE
      ========================================================
      */

      const lots =
        Number(
          trade.quantity || 0
        );


      if (lots <= 0) {

        console.error(
          "Invalid lot size."
        );

        return null;
      }


      /*
      ========================================================
      MARGIN

      Current forex approximation.

      Broker integration later will use
      broker-provided margin requirements.
      ========================================================
      */

      const contractSize =
        100000;


      const margin =
        (
          lots *
          contractSize *
          executionPrice
        ) /
        leverage;


      /*
      ========================================================
      CREATE POSITION
      ========================================================
      */

      const newTrade = {

        id: Date.now(),

        status: "OPEN",

        openedAt:
          new Date().toISOString(),

        symbol:
          trade.symbol || "EURUSD",

        side,

        entry:
          executionPrice,

        currentPrice:
          executionPrice,

        stopLoss:
          Number(
            trade.stopLoss || 0
          ),

        takeProfit:
          Number(
            trade.takeProfit || 0
          ),

        quantity:
          lots,

        margin,

        pnl: 0,

        risk:
          Number(
            trade.risk || 0
          ),

        orderType:
          trade.orderType || "Market",
      };


      console.log(
        "LOCAL TRADE EXECUTED:",
        newTrade
      );


      setOpenTrades(
        (prev) => [
          ...prev,
          newTrade,
        ]
      );


      return newTrade;

    }, [
      bid,
      ask,
      leverage,
    ]);


  /*
  ============================================================
  CLOSE TRADE
  ============================================================
  */

  const closeTrade =
    useCallback((id) => {

      const trade =
        openTrades.find(
          (item) =>
            item.id === id
        );


      if (!trade) {
        return;
      }


      const closedTime =
        new Date();


      const openedTime =
        new Date(
          trade.openedAt
        );


      /*
      ========================================================
      TRADE DURATION
      ========================================================
      */

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


      /*
      ========================================================
      FINAL P&L
      ========================================================
      */

      const pnl =
        Number(
          trade.pnl || 0
        );


      /*
      ========================================================
      CLOSED TRADE
      ========================================================
      */

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
          String(
            trade.side
          ).toLowerCase() === "buy"
            ? "Long"
            : "Short",

        entryPrice:
          Number(
            trade.entry
          ),

        exitPrice:
          Number(
            trade.currentPrice ??
            trade.entry
          ),

        stopLoss:
          Number(
            trade.stopLoss || 0
          ),

        takeProfit:
          Number(
            trade.takeProfit || 0
          ),

        quantity:
          Number(
            trade.quantity || 0
          ),

        pnl,

        result:
          pnl > 0
            ? "Win"
            : pnl < 0
            ? "Loss"
            : "Breakeven",
      };


      /*
      ========================================================
      REMOVE FROM OPEN
      ========================================================
      */

      setOpenTrades(
        (prev) =>
          prev.filter(
            (item) =>
              item.id !== id
          )
      );


      /*
      ========================================================
      ADD TO CLOSED
      ========================================================
      */

      setClosedTrades(
        (prev) => [
          ...prev,
          closedTrade,
        ]
      );


      /*
      ========================================================
      SAVE TO TRADE LOG / JOURNAL
      ========================================================
      */

      addTrade(
        closedTrade
      );


      console.log(
        "TRADE CLOSED:",
        closedTrade
      );


      return closedTrade;

    }, [
      openTrades,
      addTrade,
    ]);


  /*
  ============================================================
  DELETE TRADE
  ============================================================
  */

  const deleteTrade =
    useCallback((id) => {

      setOpenTrades(
        (prev) =>
          prev.filter(
            (trade) =>
              trade.id !== id
          )
      );


      setClosedTrades(
        (prev) =>
          prev.filter(
            (trade) =>
              trade.id !== id
          )
      );


      setPendingOrders(
        (prev) =>
          prev.filter(
            (order) =>
              order.id !== id
          )
      );

    }, []);


  /*
  ============================================================
  UPDATE ACCOUNT

  Broker integration ke time:
  setAccount({
    balance,
    currency,
    leverage
  })
  ============================================================
  */

  const updateAccount =
    useCallback((data) => {

      setAccount(
        (prev) => ({
          ...prev,
          ...data,
        })
      );

    }, []);


  /*
  ============================================================
  PROVIDER
  ============================================================
  */

  return (

    <TradeContext.Provider
      value={{

        /*
        ========================================================
        TRADES
        ========================================================
        */

        openTrades,

        closedTrades,

        pendingOrders,


        /*
        ========================================================
        ACTIONS
        ========================================================
        */

        executeTrade,

        addPendingOrder,

        closeTrade,

        deleteTrade,


        /*
        ========================================================
        ACCOUNT
        ========================================================
        */

        account,

        updateAccount,

        balance,

        equity,

        leverage,


        /*
        ========================================================
        P&L
        ========================================================
        */

        floatingPnL,


        /*
        ========================================================
        MARGIN
        ========================================================
        */

        marginUsed,

        freeMargin,


        /*
        ========================================================
        STATISTICS
        ========================================================
        */

        openTradesCount,

        closedCount,

        winningTrades,

        losingTrades,

        winRate,

      }}
    >

      {children}

    </TradeContext.Provider>

  );
}


export function useTrade() {

  return useContext(
    TradeContext
  );

}