import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useJournal } from "./JournalContext";
import { useMarket } from "./MarketContext";
import { calculatePnL } from "../utils/trading/calculatePnL";

const TradeContext = createContext();

export function TradeProvider({ children }) {
  const { bid, ask } = useMarket();

  const [openTrades, setOpenTrades] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const { addTrade } = useJournal();

  const initialBalance = 100000;

const balance = initialBalance;

const floatingPnL = openTrades.reduce(
  (sum, trade) => sum + Number(trade.pnl || 0),
  0
);

const openTradesCount = openTrades.length;

const marginUsed = openTrades.reduce(
  (sum, trade) => sum + Number(trade.margin || 0),
  0
);

const closedCount = closedTrades.length;

const winningTrades = closedTrades.filter(
  (trade) => Number(trade.pnl) > 0
).length;

const winRate =
  closedCount === 0
    ? 0
    : (winningTrades / closedCount) * 100;

    useEffect(() => {
      setOpenTrades((prevTrades) =>
        prevTrades.map((trade) => {
    
          const currentPrice =
            trade.side === "buy"
              ? bid
              : ask;
    
          const pnl = calculatePnL(
            trade.side,
            trade.entry,
            currentPrice,
            trade.quantity
          );
    
          return {
            ...trade,
            currentPrice,
            pnl,
          };
        })
      );
    }, [bid, ask]);

  const addPendingOrder = (order) => {

    const newOrder = {
  
      id: Date.now(),
  
      status: "PENDING",
  
      createdAt: new Date(),
  
      ...order,
  
    };
  
    setPendingOrders(prev => [
  
      ...prev,
  
      newOrder,
  
    ]);
  
  };


  const executeTrade = (trade) => {

    const side =
      String(trade.side).toLowerCase();
  
    // BUY executes at ASK
    // SELL executes at BID
    const executionPrice =
    side === "buy"
      ? ask
      : bid;
  
  // Margin calculation
  const lots = Number(trade.quantity || 0);
  
  const leverage = 100;
  const contractSize = 100000;
  
  const margin =
    (lots * contractSize * Number(executionPrice)) /
    leverage;
  
  const newTrade = {
      id: Date.now(),
  
      status: "OPEN",
  
      openedAt: new Date().toISOString(),
  
      symbol: trade.symbol,
  
      side,
  
      entry: Number(executionPrice),
  
      currentPrice: Number(executionPrice),
  
      stopLoss: Number(trade.stopLoss || 0),
  
      takeProfit: Number(trade.takeProfit || 0),
  
      quantity: Number(trade.quantity || 0),

margin,

pnl: 0,
    };
  
    console.log("PAPER TRADE EXECUTED:", newTrade);
  
    setOpenTrades((prev) => [
      ...prev,
      newTrade,
    ]);
  };



  const closeTrade = (id) => {
    const trade = openTrades.find(
      (t) => t.id === id
    );
  
    if (!trade) return;
  
    // Exact close time
    const closedTime = new Date();
  
    // Calculate how long the trade was actually open
    const openedTime = new Date(
      trade.openedAt
    );
  
    const durationSeconds = Math.max(
      0,
      Math.floor(
        (closedTime - openedTime) / 1000
      )
    );
  
    const closedTrade = {
      ...trade,
  
      status: "CLOSED",
  
      closedAt: closedTime.toISOString(),
  
      // Fixed duration — timer will NOT continue
      durationSeconds,
  
      date: closedTime
        .toISOString()
        .split("T")[0],
  
      // TradeLog fields
      pair: trade.symbol,
  
      direction:
        String(trade.side).toLowerCase() === "buy"
          ? "Long"
          : "Short",
  
      entryPrice: Number(trade.entry),
  
      exitPrice: Number(
        trade.currentPrice ?? trade.entry
      ),
  
      stopLoss: Number(
        trade.stopLoss ?? 0
      ),
  
      takeProfit: Number(
        trade.takeProfit ?? 0
      ),
  
      quantity: Number(
        trade.quantity ?? 0
      ),
  
      pnl: Number(
        trade.pnl ?? 0
      ),
  
      result:
        Number(trade.pnl ?? 0) > 0
          ? "Win"
          : Number(trade.pnl ?? 0) < 0
          ? "Loss"
          : "Breakeven",
    };
  
    console.log(
      "CLOSING TRADE:",
      closedTrade
    );
  
    // Remove from Open Positions
    setOpenTrades((prev) =>
      prev.filter(
        (t) => t.id !== id
      )
    );
  
    // Add to Closed Positions
    setClosedTrades((prev) => [
      ...prev,
      closedTrade,
    ]);
  
    // Save to TradeLog / Journal
    addTrade(closedTrade);
  };

  const deleteTrade = (id) => {
    // Open trade se delete
    setOpenTrades((prev) =>
      prev.filter((trade) => trade.id !== id)
    );
  
    // Closed trade se delete
    setClosedTrades((prev) =>
      prev.filter((trade) => trade.id !== id)
    );
  
    // Pending order se delete
    setPendingOrders((prev) =>
      prev.filter((order) => order.id !== id)
    );
  };

  return (
    <TradeContext.Provider
    value={{
      openTrades,
      closedTrades,
      pendingOrders,
    
      executeTrade,
      addPendingOrder,
      closeTrade,
      deleteTrade,

      balance,
    floatingPnL,
    openTradesCount,
    marginUsed,
    winRate,
    
    }}
    >
      {children}
    </TradeContext.Provider>
  );
}

export function useTrade() {
  return useContext(TradeContext);
}