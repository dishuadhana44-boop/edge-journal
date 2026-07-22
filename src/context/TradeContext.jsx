import { createContext, useContext, useState } from "react";

const TradeContext = createContext();

export function TradeProvider({ children }) {

  const [openTrades, setOpenTrades] = useState([]);

  const [closedTrades, setClosedTrades] = useState([]);

  const executeTrade = (trade) => {
    console.log("NEW TRADE", trade);
    const newTrade = {

      id: Date.now(),

      status: "OPEN",

      openedAt: new Date(),

      pnl: 0,

      ...trade,

    };

    setOpenTrades((prev) => [...prev, newTrade]);

  };

  const closeTrade = (id) => {

    const trade = openTrades.find(t => t.id === id);

    if (!trade) return;

    setOpenTrades(prev =>
      prev.filter(t => t.id !== id)
    );

    setClosedTrades(prev => [
      ...prev,
      {
        ...trade,
        status: "CLOSED",
        closedAt: new Date(),
      },
    ]);

  };

  return (

    <TradeContext.Provider
      value={{
        openTrades,
        closedTrades,
        executeTrade,
        closeTrade,
      }}
    >
      {children}
    </TradeContext.Provider>

  );

}

export function useTrade() {
  return useContext(TradeContext);
}