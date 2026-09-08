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
  // STATUS
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
  // HELPER — NORMALIZE SYMBOL
  // ==========================================================

  function normalizeSymbol(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  }

  // ==========================================================
  // HELPER — UPSERT POSITION
  // ==========================================================

  function upsertPosition(position) {
    if (!position?.positionId) return;

    const positionId = String(position.positionId);

    setPositions((previousPositions) => {
      const existingPosition = previousPositions.find(
        (item) =>
          String(item.positionId) === positionId
      );

      // ======================================================
      // NEW POSITION
      // ======================================================

      if (!existingPosition) {
        console.log(
          "🟢 NEW EDGEFLO POSITION:",
          position
        );

        return [
          ...previousPositions,
          position,
        ];
      }

      // ======================================================
      // UPDATE POSITION
      // ======================================================

      console.log(
        "🔄 UPDATING EDGEFLO POSITION:",
        position
      );

      return previousPositions.map((item) => {
        if (
          String(item.positionId) === positionId
        ) {
          return {
            ...item,
            ...position,
          };
        }

        return item;
      });
    });
  }

  // ==========================================================
  // REMOVE POSITION
  // ==========================================================

  function removePosition(positionId) {
    if (!positionId) return;

    const id = String(positionId);

    console.log(
      "🔴 REMOVING EDGEFLO POSITION:",
      id
    );

    setPositions((previousPositions) =>
      previousPositions.filter(
        (item) =>
          String(item.positionId) !== id
      )
    );
  }

  // ==========================================================
  // HANDLE EXECUTION
  // ==========================================================

  function handleExecution(webSocketMessage) {
    console.log(
      "📈 EDGEFLO EXECUTION RECEIVED:",
      webSocketMessage
    );

    // ========================================================
    // IMPORTANT:
    //
    // Backend may send:
    //
    // { type: "execution", data: {...} }
    //
    // OR:
    //
    // { type: "execution", executionType: 3, position: {...} }
    //
    // This supports BOTH.
    // ========================================================

    const execution =
      webSocketMessage?.data ||
      webSocketMessage;

    setLastExecution(execution);

    const executionType = Number(
      execution?.executionType
    );

    const position = execution?.position;

    if (!position?.positionId) {
      console.log(
        "⚠️ Execution received without valid position:",
        execution
      );

      return;
    }

    console.log(
      "📊 EXECUTION DETAILS:",
      {
        executionType,
        positionId: position.positionId,
        status: position.status,
        symbol: position.symbol,
        side: position.side,
      }
    );

    // ========================================================
    // EXECUTION TYPE 2
    //
    // ORDER ACCEPTED / PENDING
    // DO NOT CREATE POSITION YET
    // ========================================================

    if (executionType === 2) {
      console.log(
        "⏳ ORDER ACCEPTED — WAITING FOR FILL:",
        position.positionId
      );

      return;
    }

    // ========================================================
    // EXECUTION TYPE 3
    //
    // ORDER EXECUTED / POSITION UPDATED
    // ========================================================

    if (executionType === 3) {
      const positionStatus = Number(
        position.status
      );

      // ======================================================
      // STATUS 1 = OPEN / ACTIVE
      // ======================================================

      if (positionStatus === 1) {
        console.log(
          "🟢 POSITION IS NOW OPEN:",
          position.positionId
        );

        upsertPosition(position);

        return;
      }

      // ======================================================
      // OTHER STATUS = REMOVE POSITION
      // ======================================================

      console.log(
        "🔴 POSITION NO LONGER ACTIVE:",
        {
          positionId: position.positionId,
          status: positionStatus,
        }
      );

      removePosition(position.positionId);

      return;
    }

    // ========================================================
    // OTHER EXECUTION TYPES
    // ========================================================

    console.log(
      "ℹ️ Unhandled execution type:",
      executionType
    );
  }

  // ==========================================================
  // HANDLE PRICE
  // ==========================================================

  function handlePrice(data) {
    const receivedSymbol = normalizeSymbol(
      data.symbol
    );

    const currentSymbol = normalizeSymbol(
      symbolRef.current
    );

    // ========================================================
    // SYMBOL VALIDATION
    // ========================================================

    if (
      receivedSymbol &&
      currentSymbol &&
      receivedSymbol !== currentSymbol
    ) {
      console.log(
        "⚠️ Ignoring price for different symbol:",
        {
          receivedSymbol,
          currentSymbol,
        }
      );

      return;
    }

    // ========================================================
    // RAW PRICES
    // ========================================================

    const newBid = Number(data.bid);
    const newAsk = Number(data.ask);

    // ========================================================
    // BID
    // ========================================================

    if (
      Number.isFinite(newBid) &&
      newBid > 0
    ) {
      lastValidBidRef.current = newBid;

      setBid((previousBid) => {
        if (previousBid === newBid) {
          return previousBid;
        }

        return newBid;
      });
    }

    // ========================================================
    // ASK
    // ========================================================

    if (
      Number.isFinite(newAsk) &&
      newAsk > 0
    ) {
      lastValidAskRef.current = newAsk;

      setAsk((previousAsk) => {
        if (previousAsk === newAsk) {
          return previousAsk;
        }

        return newAsk;
      });
    }

    // ========================================================
    // CURRENT VALID PRICES
    // ========================================================

    const currentBid =
      Number.isFinite(newBid) && newBid > 0
        ? newBid
        : lastValidBidRef.current;

    const currentAsk =
      Number.isFinite(newAsk) && newAsk > 0
        ? newAsk
        : lastValidAskRef.current;

    // ========================================================
    // SPREAD
    // ========================================================

    if (
      Number.isFinite(currentBid) &&
      Number.isFinite(currentAsk) &&
      currentBid > 0 &&
      currentAsk > 0
    ) {
      const newSpread =
        currentAsk - currentBid;

      if (newSpread >= 0) {
        setSpread(
          Number(newSpread.toFixed(5))
        );
      }

      setMarketLoading(false);
      setMarketError(null);
    }

    // ========================================================
    // LAST UPDATE
    // ========================================================

    setLastPriceUpdate(
      data.timestamp || Date.now()
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

      setMarketError(null);

      ws = new WebSocket(
        "ws://localhost:4000/ws"
      );

      wsRef.current = ws;

      // ======================================================
      // OPEN
      // ======================================================

      ws.onopen = () => {
        console.log(
          "🟢 EdgeFlo WebSocket connected"
        );

        setMarketError(null);

        const currentSymbol =
          symbolRef.current;

        console.log(
          "📡 Subscribing to:",
          currentSymbol
        );

        ws.send(
          JSON.stringify({
            type: "subscribe",
            symbol: currentSymbol,
          })
        );
      };

      // ======================================================
      // MESSAGE
      // ======================================================

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log(
            "📡 EDGEFLO WEBSOCKET MESSAGE:",
            data
          );

          // ==================================================
          // CONNECTION
          // ==================================================

          if (data.type === "connection") {
            console.log(
              "✅ Connected to EdgeFlo WebSocket"
            );

            return;
          }

          // ==================================================
          // ACK
          // ==================================================

          if (data.type === "ack") {
            console.log(
              "✅ Subscription ACK:",
              data
            );

            return;
          }

          // ==================================================
          // EXECUTION
          // ==================================================

          if (data.type === "execution") {
            handleExecution(data);

            return;
          }

          // ==================================================
          // PRICE
          // ==================================================

          if (data.type === "price") {
            handlePrice(data);

            return;
          }

          // ==================================================
          // UNKNOWN
          // ==================================================

          console.log(
            "ℹ️ Unknown WebSocket event:",
            data.type
          );

        } catch (error) {
          console.error(
            "❌ EdgeFlo WebSocket message error:",
            error
          );
        }
      };

      // ======================================================
      // ERROR
      // ======================================================

      ws.onerror = (error) => {
        console.error(
          "❌ EdgeFlo WebSocket error:",
          error
        );

        setMarketError(
          "Market WebSocket connection failed"
        );
      };

      // ======================================================
      // CLOSE
      // ======================================================

      ws.onclose = () => {
        console.log(
          "🔴 EdgeFlo WebSocket disconnected"
        );

        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        if (shouldReconnectRef.current) {
          console.log(
            "🔄 Reconnecting in 3 seconds..."
          );

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

    // ========================================================
    // START CONNECTION
    // ========================================================

    connectWebSocket();

    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      console.log(
        "🧹 Closing EdgeFlo WebSocket..."
      );

      shouldReconnectRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(
          reconnectTimeoutRef.current
        );
      }

      if (
        ws &&
        (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        )
      ) {
        ws.close();
      }

      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, []);

  // ==========================================================
  // SUBSCRIBE WHEN SYMBOL CHANGES
  // ==========================================================

  useEffect(() => {
    symbolRef.current = symbol;

    // Reset prices for new symbol

    lastValidBidRef.current = null;
    lastValidAskRef.current = null;

    setBid(null);
    setAsk(null);
    setSpread(null);

    setMarketLoading(true);

    const ws = wsRef.current;

    if (
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      console.log(
        "🔄 Changing subscription:",
        symbol
      );

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
    Number.isFinite(Number(bid)) &&
    Number.isFinite(Number(ask)) &&
    Number(bid) > 0 &&
    Number(ask) > 0;

  // ==========================================================
  // MARKET OBJECT
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

  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <MarketContext.Provider value={market}>
      {children}
    </MarketContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useMarket() {
  const context = useContext(MarketContext);

  if (!context) {
    throw new Error(
      "useMarket must be used inside MarketProvider"
    );
  }

  return context;
}