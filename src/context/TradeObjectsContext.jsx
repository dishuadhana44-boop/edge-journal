import {
    createContext,
    useContext,
    useState,
  } from "react";
  
  const TradeObjectsContext = createContext();
  
  export function TradeObjectsProvider({ children }) {
  
    const [tradeObjects, setTradeObjects] = useState([]);
  
    const addTradeObject = (trade) => {
      setTradeObjects((prev) => [
        ...prev,
        trade,
      ]);
    };
  
    const updateTradeObject = (id, updates) => {
      setTradeObjects((prev) =>
        prev.map((trade) =>
          trade.id === id
            ? { ...trade, ...updates }
            : trade
        )
      );
    };
  
    const removeTradeObject = (id) => {
      setTradeObjects((prev) =>
        prev.filter((trade) => trade.id !== id)
      );
    };
  
    return (
      <TradeObjectsContext.Provider
        value={{
          tradeObjects,
          addTradeObject,
          updateTradeObject,
          removeTradeObject,
        }}
      >
        {children}
      </TradeObjectsContext.Provider>
    );
  }
  
  export function useTradeObjects() {
  
    return useContext(
      TradeObjectsContext
    );
  
  }