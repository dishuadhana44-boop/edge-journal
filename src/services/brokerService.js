const PAPER_PRICES = {
    EURUSD: {
      bid: 1.15350,
      ask: 1.15360,
    },
  
    GBPUSD: {
      bid: 1.34520,
      ask: 1.34535,
    },
  
    USDJPY: {
      bid: 147.250,
      ask: 147.265,
    },
  };
  
  export async function getBrokerPrice(symbol = "EURUSD") {
    const price = PAPER_PRICES[symbol];
  
    if (!price) {
      throw new Error(`Unknown instrument: ${symbol}`);
    }
  
    return {
      symbol,
      bid: price.bid,
      ask: price.ask,
      spread: Number(
        (price.ask - price.bid).toFixed(5)
      ),
      timestamp: new Date().toISOString(),
    };
  }
  
  export async function getBrokerAccount() {
    return {
      id: "PAPER-001",
      currency: "USD",
      balance: 100000,
      equity: 100000,
      marginUsed: 0,
      unrealizedPL: 0,
    };
  }
  
  export async function getOpenPositions() {
    return [];
  }
  
  export async function getPendingOrders() {
    return [];
  }
  
  export async function getClosedTrades() {
    return [];
  }