import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  // ==========================================================
  // SYMBOL
  // ==========================================================

  const [symbol, setSymbol] = useState("EURUSD");

  // ==========================================================
  // PRICES
  // ==========================================================

  const [bid, setBid] = useState(null);
  const [ask, setAsk] = useState(null);
  const [spread, setSpread] = useState(null);

  // ==========================================================
  // POSITIONS
  // ==========================================================

  const [positions, setPositions] = useState([]);

  // ==========================================================
  // LAST EXECUTION
  // ==========================================================

  const [lastExecution, setLastExecution] = useState(null);

  // ==========================================================
  // MARKET STATUS
  // ==========================================================

  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);

  // ==========================================================
  // WEBSOCKET
  // ==========================================================

  const wsRef = useRef(null);

  // ==========================================================
  // RECONNECT
  // ==========================================================

  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);

  // ==========================================================
  // SYMBOL REF
  // ==========================================================

  const symbolRef = useRef(symbol);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  // ==========================================================
  // LAST VALID PRICES
  // ==========================================================

  const lastValidBidRef = useRef(null);
  const lastValidAskRef = useRef(null);

  // ==========================================================
  // NORMALIZE SYMBOL
  // ==========================================================

  function normalizeSymbol(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  }

  // ==========================================================
  // SAFE NUMBER
  // ==========================================================

  function getNumber(...values) {
    for (const value of values) {
      const number = Number(value);

      if (Number.isFinite(number) && number !== 0) {
        return number;
      }
    }

    return 0;
  }

  // ==========================================================
  // SAFE NUMBER INCLUDING ZERO
  // ==========================================================

  function getValidNumber(...values) {
    for (const value of values) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }

    return 0;
  }

  // ==========================================================
  // SAFE STRING
  // ==========================================================

  function getString(...values) {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return String(value);
      }
    }

    return "";
  }

  // ==========================================================
  // GET POSITION ID
  // ==========================================================

  function getPositionId(position) {
    if (!position) return null;

    return (
      position.positionId ||
      position.id ||
      position.positionID ||
      position.tradeData?.positionId ||
      position.data?.positionId ||
      null
    );
  }

  // ==========================================================
  // GET POSITION STATUS RANK
  // ==========================================================

  function getStatusRank(position) {
    const status = String(
      position?.positionStatus ||
        position?.status ||
        position?.tradeData?.positionStatus ||
        ""
    ).toUpperCase();

    if (status.includes("CLOSED")) {
      return 3;
    }

    if (status.includes("OPEN") || status === "1") {
      return 2;
    }

    if (status.includes("CREATED")) {
      return 1;
    }

    return 0;
  }

  // ==========================================================
  // CHECK IF CLOSED
  // ==========================================================

  function isPositionClosed(position) {
    const status = String(
      position?.positionStatus ||
        position?.status ||
        position?.tradeData?.positionStatus ||
        ""
    ).toUpperCase();

    return (
      status === "CLOSED" ||
      status === "POSITION_STATUS_CLOSED" ||
      position?.isClosed === true
    );
  }

  // ==========================================================
  // CALCULATE LIVE GROSS P&L
  // ==========================================================

  function calculateGrossPnL({
    side,
    entryPrice,
    currentPrice,
    lots,
  }) {
    const entry = Number(entryPrice);
    const current = Number(currentPrice);
    const positionLots = Number(lots);

    if (
      !Number.isFinite(entry) ||
      !Number.isFinite(current) ||
      !Number.isFinite(positionLots) ||
      entry <= 0 ||
      current <= 0 ||
      positionLots <= 0
    ) {
      return 0;
    }

    const CONTRACT_SIZE = 100000;

    let priceDifference = 0;

    if (String(side).toLowerCase() === "buy") {
      priceDifference = current - entry;
    } else if (String(side).toLowerCase() === "sell") {
      priceDifference = entry - current;
    }

    const grossPnL =
      priceDifference *
      positionLots *
      CONTRACT_SIZE;

    return Number(grossPnL.toFixed(2));
  }

  // ==========================================================
  // NORMALIZE CTRADER POSITION
  // ==========================================================

  function normalizePosition(position, execution = null) {
    if (!position) return null;

    const tradeData =
      position.tradeData ||
      position.trade ||
      position.data ||
      {};

    const order =
      execution?.order ||
      position.order ||
      {};

    const deal =
      execution?.deal ||
      position.deal ||
      {};

    const positionId = getPositionId(position);

    if (!positionId) {
      return null;
    }

    // ========================================================
    // SYMBOL
    // ========================================================

    let positionSymbol = getString(
      position.symbol,
      position.symbolName,
      tradeData.symbol,
      tradeData.symbolName,
      order.symbol,
      order.symbolName,
      execution?.symbol,
      execution?.symbolName
    );

    if (!positionSymbol) {
      positionSymbol =
        symbolRef.current || "UNKNOWN";
    }

    // ========================================================
    // SIDE
    // ========================================================

    let side = getString(
      position.side,
      position.tradeSide,
      position.tradeType,
      tradeData.side,
      tradeData.tradeSide,
      tradeData.tradeType,
      order.side,
      order.tradeSide,
      order.tradeType
    ).toUpperCase();

    if (side === "1") {
      side = "BUY";
    }

    if (side === "2") {
      side = "SELL";
    }

    if (side === "BUY") {
      side = "buy";
    } else if (side === "SELL") {
      side = "sell";
    }

    // ========================================================
    // MONEY DIGITS
    // ========================================================

    const moneyDigits = Number(
      position.moneyDigits ??
        tradeData.moneyDigits ??
        execution?.moneyDigits ??
        2
    );

    const moneyDivider =
      Math.pow(10, moneyDigits);

    // ========================================================
    // VOLUME / LOTS
    // ========================================================

    let rawLots = getNumber(
      position.lots,
      tradeData.lots,
      position.volumeInLots,
      tradeData.volumeInLots
    );

    let rawVolume = getNumber(
      position.volume,
      position.volumeInUnits,
      tradeData.volume,
      tradeData.volumeInUnits,
      order.volume,
      order.volumeInUnits,
      deal.volume,
      deal.filledVolume
    );

    const CTRADER_VOLUME_PER_LOT =
      10000000;

    let lots = rawLots;

    if (!lots && rawVolume > 0) {
      lots =
        rawVolume /
        CTRADER_VOLUME_PER_LOT;
    }

    lots = Number(
      Number(lots).toFixed(2)
    );

    // ========================================================
    // ENTRY PRICE
    // ========================================================

    const entryPrice = getNumber(
      position.entryPrice,
      position.price,
      tradeData.entryPrice,
      tradeData.price,
      deal.executionPrice,
      deal.price,
      execution?.price
    );

    // ========================================================
    // CURRENT PRICE
    // ========================================================

    let currentPrice = entryPrice;

    if (side === "buy") {
      currentPrice =
        Number(lastValidBidRef.current) ||
        entryPrice;
    } else if (side === "sell") {
      currentPrice =
        Number(lastValidAskRef.current) ||
        entryPrice;
    }

    // ========================================================
    // TAKE PROFIT
    // ========================================================

    const takeProfit = getNumber(
      position.takeProfit,
      position.takeProfitPrice,
      tradeData.takeProfit,
      tradeData.takeProfitPrice
    );

    // ========================================================
    // STOP LOSS
    // ========================================================

    const stopLoss = getNumber(
      position.stopLoss,
      position.stopLossPrice,
      tradeData.stopLoss,
      tradeData.stopLossPrice
    );

    // ========================================================
    // COMMISSION
    // ========================================================

    const rawCommission = getValidNumber(
      position.commission,
      tradeData.commission,
      deal.commission
    );

    const commission =
      rawCommission !== 0
        ? rawCommission / moneyDivider
        : 0;

    // ========================================================
    // SWAP
    // ========================================================

    const rawSwap = getValidNumber(
      position.swap,
      tradeData.swap
    );

    const swap =
      rawSwap !== 0
        ? rawSwap / moneyDivider
        : 0;

    // ========================================================
    // MARGIN
    // ========================================================

    const rawMargin = getNumber(
      position.margin,
      position.usedMargin,
      tradeData.margin,
      tradeData.usedMargin
    );

    const margin =
      rawMargin > 0
        ? rawMargin / moneyDivider
        : 0;

    // ========================================================
    // LIVE GROSS P&L
    // ========================================================

    const calculatedGrossPnL =
      calculateGrossPnL({
        side,
        entryPrice,
        currentPrice,
        lots,
      });

    // ========================================================
    // BROKER P&L
    // ========================================================

    const brokerGrossProfit =
      getValidNumber(
        position.grossProfit,
        tradeData.grossProfit
      );

    const grossPnL =
      brokerGrossProfit !== 0
        ? brokerGrossProfit / moneyDivider
        : calculatedGrossPnL;

    // ========================================================
    // NET P&L
    // ========================================================

    const netPnL = Number(
      (
        grossPnL +
        commission +
        swap
      ).toFixed(2)
    );

    // ========================================================
    // OPEN TIME
    // ========================================================

    const openTime =
      position.openTime ||
      position.creationTime ||
      position.timestamp ||
      tradeData.openTime ||
      tradeData.creationTime ||
      Date.now();

    // ========================================================
    // STATUS
    // ========================================================

    const positionStatus =
      position.positionStatus ||
      position.status ||
      tradeData.positionStatus ||
      "POSITION_STATUS_OPEN";

    // ========================================================
    // FINAL NORMALIZED POSITION
    // ========================================================

    const normalized = {
      ...position,

      positionId: String(positionId),

      symbol: positionSymbol,
      instrument: positionSymbol,

      side,

      lots,

      entryPrice,
      entry: entryPrice,

      currentPrice,
      current: currentPrice,

      takeProfit,
      stopLoss,

      grossPnL,
      commission,
      swap,
      netPnL,

      profit: netPnL,
      pnl: netPnL,

      margin,

      openTime,

      positionStatus,

      tradeData: {
        ...tradeData,
      },

      rawPosition: position,
    };

    console.log(
      "✅ NORMALIZED POSITION:",
      normalized
    );

    return normalized;
  }

  // ==========================================================
  // MERGE POSITION
  // ==========================================================

  function mergePosition(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    const existingRank =
      getStatusRank(existing);

    const incomingRank =
      getStatusRank(incoming);

    let finalStatus =
      incoming.positionStatus;

    if (existingRank > incomingRank) {
      finalStatus =
        existing.positionStatus;
    }

    return {
      ...existing,
      ...incoming,

      positionStatus:
        finalStatus,

      symbol:
        incoming.symbol ||
        existing.symbol,

      instrument:
        incoming.instrument ||
        existing.instrument,

      side:
        incoming.side ||
        existing.side,

      lots:
        Number(incoming.lots) > 0
          ? incoming.lots
          : existing.lots,

      entryPrice:
        Number(incoming.entryPrice) > 0
          ? incoming.entryPrice
          : existing.entryPrice,

      entry:
        Number(incoming.entry) > 0
          ? incoming.entry
          : existing.entry,

      currentPrice:
        Number(incoming.currentPrice) > 0
          ? incoming.currentPrice
          : existing.currentPrice,

      current:
        Number(incoming.current) > 0
          ? incoming.current
          : existing.current,

      takeProfit:
        Number(incoming.takeProfit) > 0
          ? incoming.takeProfit
          : existing.takeProfit,

      stopLoss:
        Number(incoming.stopLoss) > 0
          ? incoming.stopLoss
          : existing.stopLoss,

      margin:
        Number(incoming.margin) > 0
          ? incoming.margin
          : existing.margin,

      commission:
        incoming.commission !== undefined
          ? incoming.commission
          : existing.commission,

      swap:
        incoming.swap !== undefined
          ? incoming.swap
          : existing.swap,

      grossPnL:
        incoming.grossPnL !== undefined
          ? incoming.grossPnL
          : existing.grossPnL,

      netPnL:
        incoming.netPnL !== undefined
          ? incoming.netPnL
          : existing.netPnL,

      pnl:
        incoming.pnl !== undefined
          ? incoming.pnl
          : existing.pnl,

      profit:
        incoming.profit !== undefined
          ? incoming.profit
          : existing.profit,

      tradeData: {
        ...(existing.tradeData || {}),
        ...(incoming.tradeData || {}),
      },
    };
  }

  // ==========================================================
  // UPSERT POSITION
  // ==========================================================

  function upsertPosition(
    rawPosition,
    execution = null
  ) {
    if (!rawPosition) return;

    const normalizedPosition =
      normalizePosition(
        rawPosition,
        execution
      );

    if (!normalizedPosition) {
      console.log(
        "⚠️ Cannot normalize position:",
        rawPosition
      );
      return;
    }

    const positionId =
      normalizedPosition.positionId;

    setPositions(
      (previousPositions) => {
        const existingIndex =
          previousPositions.findIndex(
            (item) =>
              String(item.positionId) ===
              String(positionId)
          );

        // NEW POSITION
        if (existingIndex === -1) {
          console.log(
            "🟢 NEW POSITION:",
            normalizedPosition
          );

          return [
            ...previousPositions,
            normalizedPosition,
          ];
        }

        // UPDATE POSITION
        return previousPositions.map(
          (item) => {
            if (
              String(item.positionId) ===
              String(positionId)
            ) {
              return mergePosition(
                item,
                normalizedPosition
              );
            }

            return item;
          }
        );
      }
    );
  }

  // ==========================================================
  // REMOVE POSITION
  // ==========================================================

  function removePosition(positionId) {
    if (!positionId) return;

    const id = String(positionId);

    console.log(
      "🔴 REMOVING POSITION:",
      id
    );

    setPositions(
      (previousPositions) =>
        previousPositions.filter(
          (item) =>
            String(item.positionId) !== id
        )
    );
  }

  // ==========================================================
  // RECALCULATE P&L
  // ==========================================================

  function updatePositionPnL(
    position,
    newBid,
    newAsk
  ) {
    let currentPrice =
      position.currentPrice;

    const side =
      String(position.side).toLowerCase();

    if (side === "buy") {
      currentPrice =
        Number(newBid) ||
        currentPrice;
    } else if (side === "sell") {
      currentPrice =
        Number(newAsk) ||
        currentPrice;
    }

    const grossPnL =
      calculateGrossPnL({
        side,
        entryPrice:
          position.entryPrice,
        currentPrice,
        lots:
          position.lots,
      });

    const commission =
      Number(position.commission) || 0;

    const swap =
      Number(position.swap) || 0;

    const netPnL = Number(
      (
        grossPnL +
        commission +
        swap
      ).toFixed(2)
    );

    return {
      ...position,

      currentPrice,
      current: currentPrice,

      grossPnL,
      netPnL,

      profit: netPnL,
      pnl: netPnL,
    };
  }

  // ==========================================================
  // HANDLE EXECUTION
  // ==========================================================

  function handleExecution(webSocketMessage) {
    console.log(
      "📈 EXECUTION RECEIVED:",
      webSocketMessage
    );

    const execution =
      webSocketMessage?.data ||
      webSocketMessage?.execution ||
      webSocketMessage;

    setLastExecution(execution);

    const executionType =
      String(
        execution?.executionType ||
          ""
      ).toUpperCase();

    const position =
      execution?.position ||
      execution?.data?.position ||
      execution?.payload?.position ||
      null;

    if (!position) {
      console.log(
        "ℹ️ Execution has no position"
      );
      return;
    }

    const positionId =
      getPositionId(position);

    if (!positionId) return;

    // CLOSED
    if (isPositionClosed(position)) {
      removePosition(positionId);
      return;
    }

    // Ignore cancelled order if position still exists
    if (
      executionType ===
        "ORDER_CANCELLED" &&
      !isPositionClosed(position)
    ) {
      return;
    }

    upsertPosition(
      position,
      execution
    );
  }

  // ==========================================================
  // HANDLE PRICE
  // ==========================================================

  function handlePrice(data) {
    const receivedSymbol =
      normalizeSymbol(data.symbol);

    const currentSymbol =
      normalizeSymbol(symbolRef.current);

    if (
      receivedSymbol &&
      currentSymbol &&
      receivedSymbol !== currentSymbol
    ) {
      return;
    }

    const newBid = Number(data.bid);
    const newAsk = Number(data.ask);

    // BID
    if (
      Number.isFinite(newBid) &&
      newBid > 0
    ) {
      lastValidBidRef.current =
        newBid;

      setBid(newBid);
    }

    // ASK
    if (
      Number.isFinite(newAsk) &&
      newAsk > 0
    ) {
      lastValidAskRef.current =
        newAsk;

      setAsk(newAsk);
    }

    const validBid =
      newBid > 0
        ? newBid
        : lastValidBidRef.current;

    const validAsk =
      newAsk > 0
        ? newAsk
        : lastValidAskRef.current;

    // SPREAD
    if (
      validBid &&
      validAsk &&
      validAsk >= validBid
    ) {
      setSpread(
        validAsk - validBid
      );

      setMarketLoading(false);
      setMarketError(null);
    }

    setLastPriceUpdate(
      data.timestamp || Date.now()
    );

    // ========================================================
    // UPDATE LIVE PRICE + LIVE P&L
    // ========================================================

    setPositions(
      (previousPositions) =>
        previousPositions.map(
          (position) => {
            const positionSymbol =
              normalizeSymbol(
                position.symbol ||
                  position.instrument
              );

            if (
              positionSymbol !==
              receivedSymbol
            ) {
              return position;
            }

            return updatePositionPnL(
              position,
              validBid,
              validAsk
            );
          }
        )
    );
  }

  // ==========================================================
  // CONNECT WEBSOCKET
  // ==========================================================

  useEffect(() => {
    shouldReconnectRef.current = true;

    let ws = null;

    function connectWebSocket() {
      console.log(
        "🔌 Connecting to EdgeFlo WebSocket..."
      );

      ws = new WebSocket(
        "ws://localhost:4000/ws"
      );

      wsRef.current = ws;

      // OPEN
      ws.onopen = () => {
        console.log(
          "🟢 EdgeFlo WebSocket connected"
        );

        setMarketError(null);

        ws.send(
          JSON.stringify({
            type: "subscribe",
            symbol:
              symbolRef.current,
          })
        );
      };

      // MESSAGE
      ws.onmessage = (event) => {
        try {
          const data =
            JSON.parse(event.data);

          if (
            data.type === "connection" ||
            data.type === "ack"
          ) {
            return;
          }

          // EXECUTION
          if (
            data.type === "execution"
          ) {
            handleExecution(data);
            return;
          }

          // PRICE
          if (
            data.type === "price"
          ) {
            handlePrice(data);
            return;
          }

          // POSITION EVENT
          if (
            data.type === "position" ||
            data.type === "positionUpdate" ||
            data.type === "position_update"
          ) {
            const position =
              data.position ||
              data.data?.position ||
              data.data;

            if (position) {
              if (
                isPositionClosed(position)
              ) {
                removePosition(
                  getPositionId(position)
                );
              } else {
                upsertPosition(
                  position
                );
              }
            }

            return;
          }

          // POSITION CLOSED
          if (
            data.type === "positionClosed" ||
            data.type === "position_closed"
          ) {
            removePosition(
              data.positionId ||
                data.data?.positionId ||
                data.position?.positionId
            );

            return;
          }
        } catch (error) {
          console.error(
            "❌ WebSocket message error:",
            error
          );
        }
      };

      // ERROR
      ws.onerror = (error) => {
        console.error(
          "❌ WebSocket error:",
          error
        );

        // Do NOT immediately destroy MT5 price state.
        // MT5 polling below can still provide prices.
        setMarketError(
          "Market WebSocket connection failed"
        );
      };

      // CLOSE
      ws.onclose = () => {
        console.log(
          "🔴 EdgeFlo WebSocket disconnected"
        );

        if (
          wsRef.current === ws
        ) {
          wsRef.current = null;
        }

        if (
          shouldReconnectRef.current
        ) {
          reconnectTimeoutRef.current =
            setTimeout(() => {
              if (
                shouldReconnectRef.current
              ) {
                connectWebSocket();
              }
            }, 3000);
        }
      };
    }

    connectWebSocket();

    return () => {
      shouldReconnectRef.current = false;

      if (
        reconnectTimeoutRef.current
      ) {
        clearTimeout(
          reconnectTimeoutRef.current
        );
      }

      if (
        ws &&
        (
          ws.readyState ===
            WebSocket.OPEN ||
          ws.readyState ===
            WebSocket.CONNECTING
        )
      ) {
        ws.close();
      }

      if (
        wsRef.current === ws
      ) {
        wsRef.current = null;
      }
    };
  }, []);

  // ==========================================================
  // MT5 LIVE PRICE POLLING
  //
  // Node:
  // GET /api/mt5/price?symbol=EURUSD
  //
  // Python:
  // GET /mt5/price?symbol=EURUSD
  // ==========================================================

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;

    async function fetchMT5Price() {
      try {
        const response =
          await fetch(
            `http://localhost:4000/api/mt5/price?symbol=${encodeURIComponent(
              symbol
            )}`
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data =
          await response.json();

        if (cancelled) return;

        if (
          data?.success &&
          Number(data.bid) > 0 &&
          Number(data.ask) > 0
        ) {
          console.log(
            "💰 MT5 LIVE PRICE:",
            {
              symbol:
                data.symbol ||
                symbol,
              bid: Number(data.bid),
              ask: Number(data.ask),
            }
          );

          handlePrice({
            symbol:
              data.symbol ||
              symbol,

            bid: Number(data.bid),
            ask: Number(data.ask),

            timestamp:
              data.timestamp ||
              Date.now(),
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "❌ MT5 price polling error:",
            error
          );
        }
      }
    }

    // Immediately fetch
    fetchMT5Price();

    // Poll every second
    const interval =
      setInterval(
        fetchMT5Price,
        1000
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  // ==========================================================
  // SYMBOL CHANGE
  // ==========================================================

  useEffect(() => {
    symbolRef.current = symbol;

    lastValidBidRef.current = null;
    lastValidAskRef.current = null;

    setBid(null);
    setAsk(null);
    setSpread(null);
    setMarketLoading(true);
    setMarketError(null);

    const ws =
      wsRef.current;

    if (
      ws &&
      ws.readyState ===
        WebSocket.OPEN
    ) {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          symbol,
        })
      );
    }
  }, [symbol]);

  // ==========================================================
  // MARKET CONNECTED
  // ==========================================================

  const isMarketConnected =
    !marketError &&
    Number(bid) > 0 &&
    Number(ask) > 0;

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const market = {
    // SYMBOL
    symbol,
    setSymbol,

    // PRICES
    bid,
    ask,
    spread,

    // POSITIONS
    positions,
    setPositions,

    // EXECUTION
    lastExecution,

    // STATUS
    marketLoading,
    marketError,
    lastPriceUpdate,
    isMarketConnected,
  };

  return (
    <MarketContext.Provider
      value={market}
    >
      {children}
    </MarketContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useMarket() {
  const context =
    useContext(MarketContext);

  if (!context) {
    throw new Error(
      "useMarket must be used inside MarketProvider"
    );
  }

  return context;
}