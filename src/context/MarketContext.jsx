import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getBrokerPrice,
} from "../services/brokerService";

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const [symbol, setSymbol] = useState("EURUSD");

  const [bid, setBid] = useState(null);
  const [ask, setAsk] = useState(null);
  const [spread, setSpread] = useState(null);

  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      try {
        setMarketError(null);

        const price = await getBrokerPrice(symbol);

        if (cancelled) return;

        setBid(price.bid);
        setAsk(price.ask);
        setSpread(price.spread);
        setLastPriceUpdate(price.timestamp);
      } catch (error) {
        if (cancelled) return;

        console.error("Market price error:", error);

        setMarketError(
          error?.message || "Unable to load market price"
        );
      } finally {
        if (!cancelled) {
          setMarketLoading(false);
        }
      }
    }

    loadPrice();

    // Demo broker price refresh
    const interval = setInterval(loadPrice, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  const market = {
    symbol,

    bid,
    ask,
    spread,

    marketLoading,
    marketError,

    lastPriceUpdate,

    setSymbol,

    isMarketConnected:
      !marketLoading && !marketError && bid !== null,
  };

  return (
    <MarketContext.Provider value={market}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);

  if (!context) {
    throw new Error(
      "useMarket must be used inside MarketProvider"
    );
  }

  return context;
}