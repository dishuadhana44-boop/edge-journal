import { createContext, useContext, useEffect, useState } from "react";

const MarketContext = createContext();

export function MarketProvider({ children }) {

  const [bid, setBid] = useState(1.18451);
  const [ask, setAsk] = useState(1.18452);

  useEffect(() => {

    const interval = setInterval(() => {

      const move = (Math.random() - 0.5) * 0.00008;

      setBid(prev => Number((prev + move).toFixed(5)));

      setAsk(prev => Number((prev + move).toFixed(5)));

    }, 700);

    return () => clearInterval(interval);

  }, []);

  return (
    <MarketContext.Provider value={{ bid, ask }}>
      {children}
    </MarketContext.Provider>
  );
}

export const useMarket = () => useContext(MarketContext);