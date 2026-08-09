import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { useMemo } from "react";

const JournalContext = createContext();

export function JournalProvider({ children }) {

  const [trades, setTrades] = useState(() => {
    const saved = localStorage.getItem("trades");
    return saved ? JSON.parse(saved) : [];
  });

  const reloadTrades = useCallback(() => {
    const saved = localStorage.getItem("trades");
    setTrades(saved ? JSON.parse(saved) : []);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "trades",
      JSON.stringify(trades)
    );
  }, [trades]);

  useEffect(() => {
    window.addEventListener("storage", reloadTrades);
  
    return () =>
      window.removeEventListener("storage", reloadTrades);
  }, [reloadTrades]);

  const addTrade = (trade) => {
    setTrades((prev) => {
  
      // Agar same trade already Journal me hai
      const exists = prev.some(
        (existingTrade) =>
          String(existingTrade.id) === String(trade.id)
      );
  
      // Duplicate nahi banana
      if (exists) {
        return prev.map((existingTrade) =>
          String(existingTrade.id) === String(trade.id)
            ? {
                ...existingTrade,
                ...trade,
              }
            : existingTrade
        );
      }
  
      // Same ID preserve karo
      return [
        ...prev,
        {
          ...trade,
          id: trade.id,
        },
      ];
    });
  };

  const updateTrade = (updatedTrade) => {
    setTrades((prev) =>
      prev.map((trade) =>
        trade.id === updatedTrade.id
          ? updatedTrade
          : trade
      )
    );
  };

  const deleteTrade = (id) => {
    setTrades((prev) =>
      prev.filter((trade) => trade.id !== id)
    );
  };

  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    const saved = localStorage.getItem("selectedAccountId");
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    if (selectedAccountId !== null) {
      localStorage.setItem(
        "selectedAccountId",
        selectedAccountId
      );
    }
  }, [selectedAccountId]);

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
  
      // Purane trades temporarily dikhte rahenge
      if (!trade.accountId) return true;
  
      return Number(trade.accountId) === Number(selectedAccountId);
  
    });
  }, [trades, selectedAccountId]);
  

  return (
    <JournalContext.Provider
    value={{
      trades,
      filteredTrades,
    
      setTrades,
      addTrade,
      updateTrade,
      deleteTrade,
      reloadTrades,
    
      selectedAccountId,
      setSelectedAccountId,
    }}
  >
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const context = useContext(JournalContext);

  if (!context) {
    throw new Error(
      "useJournal must be used inside JournalProvider"
    );
  }

  return context;
}