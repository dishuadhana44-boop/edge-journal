/* ==========================================================
   EDGEFLO BROKER REGISTRY
========================================================== */

export const brokerRegistry = [
    {
      id: "ctrader",
  
      name: "cTrader",
  
      shortName: "cT",
  
      description:
        "Professional forex and CFD trading platform with automated trade synchronization.",
  
      markets: [
        "Forex",
        "CFDs",
        "Indices",
        "Commodities",
      ],
  
      connectionType: "OAuth",
  
      status: "available",
  
      category: "Forex & CFDs",
  
      icon: "cT",
  
      color: "dark",
    },
  
    {
      id: "mt5",
  
      name: "MetaTrader 5",
  
      shortName: "MT5",
  
      description:
        "Connect your MetaTrader 5 account and automatically synchronize trades, positions and account activity.",
  
      markets: [
        "Forex",
        "CFDs",
        "Commodities",
        "Indices",
        "Stocks",
      ],
  
      connectionType: "Desktop Terminal",
  
      status: "available",
  
      category: "Multi-Asset",
  
      icon: "MT5",
  
      color: "blue",
    },
  
    {
      id: "interactive-brokers",
  
      name: "Interactive Brokers",
  
      shortName: "IB",
  
      description:
        "Global multi-asset broker supporting stocks, options, futures and international markets.",
  
      markets: [
        "Stocks",
        "Options",
        "Futures",
        "Forex",
        "Bonds",
      ],
  
      connectionType: "API",
  
      status: "coming-soon",
  
      category: "Multi-Asset",
  
      icon: "IB",
  
      color: "red",
    },
  
    {
      id: "binance",
  
      name: "Binance",
  
      shortName: "BN",
  
      description:
        "Cryptocurrency exchange supporting spot and futures trading.",
  
      markets: [
        "Crypto Spot",
        "Crypto Futures",
      ],
  
      connectionType: "API",
  
      status: "coming-soon",
  
      category: "Crypto",
  
      icon: "BN",
  
      color: "yellow",
    },
  
    {
      id: "oanda",
  
      name: "OANDA",
  
      shortName: "OA",
  
      description:
        "Global forex and CFD trading platform with access to major currency markets.",
  
      markets: [
        "Forex",
        "CFDs",
      ],
  
      connectionType: "API",
  
      status: "coming-soon",
  
      category: "Forex & CFDs",
  
      icon: "OA",
  
      color: "blue",
    },
  
    {
      id: "bybit",
  
      name: "Bybit",
  
      shortName: "BY",
  
      description:
        "Cryptocurrency platform supporting spot, futures and derivatives trading.",
  
      markets: [
        "Crypto Spot",
        "Crypto Futures",
        "Derivatives",
      ],
  
      connectionType: "API",
  
      status: "coming-soon",
  
      category: "Crypto",
  
      icon: "BY",
  
      color: "orange",
    },
  ];
  
  /* ==========================================================
     HELPER FUNCTIONS
  ========================================================== */
  
  /**
   * Get broker using broker ID.
   *
   * Example:
   * getBrokerById("ctrader")
   */
  export const getBrokerById = (brokerId) => {
    return brokerRegistry.find(
      (broker) => broker.id === brokerId
    );
  };
  
  /**
   * Get all currently available brokers.
   *
   * Currently:
   * - cTrader
   * - MetaTrader 5
   */
  export const getAvailableBrokers = () => {
    return brokerRegistry.filter(
      (broker) => broker.status === "available"
    );
  };
  
  /**
   * Get brokers that are coming soon.
   */
  export const getComingSoonBrokers = () => {
    return brokerRegistry.filter(
      (broker) => broker.status === "coming-soon"
    );
  };
  
  /**
   * Check whether a broker is available.
   */
  export const isBrokerAvailable = (brokerId) => {
    const broker = getBrokerById(brokerId);
  
    return broker?.status === "available";
  };