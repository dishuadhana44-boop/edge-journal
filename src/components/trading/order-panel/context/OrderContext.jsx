
import {
  createContext,
  useMemo,
  useEffect,
  useState,
} from "react";

import { useMarket } from "../../../../context/MarketContext";
import { calculateLotSize } from "../../../../utils/calculator/lotCalculator";
import { calculatePips } from "../../../../utils/calculator/pipCalculator";
import { calculateRR } from "../../../../utils/calculator/rrCalculator";
import { calculateRiskAmount } from "../../../../utils/calculator/riskCalculator";

export const OrderContext = createContext(null);

// ============================================================
// DEFAULT GUARDRAILS
// ============================================================

const DEFAULT_GUARDRAILS = {
  enabled: true,
  riskPerTrade: 1,
  maxTradesPerDay: 10,
  maxDailyLoss: 3000,
  maxDailyProfit: 10000,
  tradingWindowStart: "11:30",
  tradingWindowEnd: "19:30",
};

// ============================================================
// TIME HELPERS
// ============================================================

function getCurrentTimeInMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time) {
  if (!time || !time.includes(":")) {
    return 0;
  }

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function isWithinTradingWindow(start, end) {
  const currentMinutes = getCurrentTimeInMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  // Same start and end means the window is closed.
  if (startMinutes === endMinutes) {
    return false;
  }

  // Normal window, for example 11:30 to 19:30.
  if (startMinutes < endMinutes) {
    return (
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

  // Overnight window, for example 22:00 to 02:00.
  return (
    currentMinutes >= startMinutes ||
    currentMinutes < endMinutes
  );
}

// ============================================================
// ORDER PROVIDER
// ============================================================

export function OrderProvider({ children }) {
  // ==========================================================
  // MARKET DATA
  // ==========================================================

  const market = useMarket();

  const symbol = String(market?.symbol || "EURUSD")
    .trim()
    .toUpperCase();

  const bid = Number(market?.bid || 0);
  const ask = Number(market?.ask || 0);

  // ==========================================================
  // ACCOUNT
  // ==========================================================

  const balance = 100158.75;

  // ==========================================================
  // ORDER SIDE
  // ==========================================================

  const [side, setSide] = useState("buy");

  // ==========================================================
  // ORDER TYPE
  // ==========================================================

  const [orderType, setOrderType] = useState("Market");

  // ==========================================================
  // PRICES
  // ==========================================================

// ==========================================================
// PERSISTENT ORDER PRICES
// ==========================================================

const [entry, setEntry] = useState(() => {
  try {
    return localStorage.getItem("edgeflo_order_entry") || "";
  } catch (error) {
    console.error("Failed to load entry:", error);
    return "";
  }
});

const [sl, setSL] = useState(() => {
  try {
    return localStorage.getItem("edgeflo_order_sl") || "";
  } catch (error) {
    console.error("Failed to load Stop Loss:", error);
    return "";
  }
});

const [tp, setTP] = useState(() => {
  try {
    return localStorage.getItem("edgeflo_order_tp") || "";
  } catch (error) {
    console.error("Failed to load Take Profit:", error);
    return "";
  }
});

// ==========================================================
// SAVE ORDER PRICES TO LOCALSTORAGE
// ==========================================================

useEffect(() => {
  try {
    localStorage.setItem("edgeflo_order_entry", entry);
    localStorage.setItem("edgeflo_order_sl", sl);
    localStorage.setItem("edgeflo_order_tp", tp);
  } catch (error) {
    console.error("Failed to save order prices:", error);
  }
}, [entry, sl, tp]);

  // ==========================================================
  // LIVE MARKET ENTRY SYNC
  // BUY MARKET  -> ASK
  // SELL MARKET -> BID
  // ==========================================================

  useEffect(() => {
    if (orderType !== "Market") {
      return;
    }

    const marketEntry = side === "buy" ? ask : bid;

    if (Number.isFinite(marketEntry) && marketEntry > 0) {
      const formattedEntry = marketEntry.toFixed(5);

      setEntry((previousEntry) => {
        if (previousEntry === formattedEntry) {
          return previousEntry;
        }

        return formattedEntry;
      });
    }
  }, [orderType, side, bid, ask]);

  // ==========================================================
  // TRADING GUARDRAILS
  // ==========================================================

  const [guardrails, setGuardrails] = useState(() => {
    
    try {
      const saved = localStorage.getItem("tradingGuardrails");

      return saved
        ? {
            ...DEFAULT_GUARDRAILS,
            ...JSON.parse(saved),
          }
        : DEFAULT_GUARDRAILS;
    } catch (error) {
      console.error("Failed to load trading guardrails:", error);

      return DEFAULT_GUARDRAILS;
    }
  });

  // ==========================================================
  // LISTEN FOR GUARDRAIL UPDATES
  // ==========================================================

  useEffect(() => {
    const handleGuardrailsUpdate = () => {
      try {
        const saved = localStorage.getItem("tradingGuardrails");

        if (saved) {
          setGuardrails({
            ...DEFAULT_GUARDRAILS,
            ...JSON.parse(saved),
          });
        }
      } catch (error) {
        console.error(
          "Failed to update trading guardrails:",
          error
        );
      }
    };

    const handleStorageUpdate = (event) => {
      if (event.key === "tradingGuardrails") {
        handleGuardrailsUpdate();
      }
    };

    window.addEventListener(
      "guardrailsUpdated",
      handleGuardrailsUpdate
    );

    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(
        "guardrailsUpdated",
        handleGuardrailsUpdate
      );

      window.removeEventListener(
        "storage",
        handleStorageUpdate
      );
    };
  }, []);

  // ==========================================================
  // TRADING WINDOW
  // ==========================================================

  const tradingWindowStart =
    guardrails?.tradingWindowStart ||
    DEFAULT_GUARDRAILS.tradingWindowStart;

  const tradingWindowEnd =
    guardrails?.tradingWindowEnd ||
    DEFAULT_GUARDRAILS.tradingWindowEnd;

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const tradingWindowOpen = useMemo(() => {
    // currentTime ensures this value refreshes every second.
    void currentTime;

    if (guardrails?.enabled === false) {
      return true;
    }

    return isWithinTradingWindow(
      tradingWindowStart,
      tradingWindowEnd
    );
  }, [
    currentTime,
    guardrails?.enabled,
    tradingWindowStart,
    tradingWindowEnd,
  ]);

  // ==========================================================
  // FIXED RISK FROM GUARDRAILS
  // ==========================================================

  const risk = useMemo(() => {
    const configuredRisk = Number(
      guardrails?.riskPerTrade || 0
    );

    return configuredRisk;
  }, [guardrails?.riskPerTrade]);

  // ==========================================================
  // EFFECTIVE ENTRY
  // ==========================================================

  const effectiveEntry = useMemo(() => {
    if (orderType === "Market") {
      if (side === "buy") {
        return ask > 0 ? ask : 0;
      }

      return bid > 0 ? bid : 0;
    }

    return Number(entry || 0);
  }, [
    orderType,
    side,
    bid,
    ask,
    entry,
  ]);

  // ==========================================================
  // RISK PIPS
  // ==========================================================

  const riskPips = useMemo(() => {
    if (!effectiveEntry || !sl) {
      return 0;
    }

    return calculatePips(
      Number(effectiveEntry),
      Number(sl)
    );
  }, [effectiveEntry, sl]);

  // ==========================================================
  // REWARD PIPS
  // ==========================================================

  const rewardPips = useMemo(() => {
    if (!effectiveEntry || !tp) {
      return 0;
    }

    return calculatePips(
      Number(effectiveEntry),
      Number(tp)
    );
  }, [effectiveEntry, tp]);

  // ==========================================================
  // RISK AMOUNT
  // ==========================================================

  const riskAmount = useMemo(() => {
    return calculateRiskAmount(
      Number(balance),
      Number(risk)
    );
  }, [balance, risk]);

  // ==========================================================
  // R:R CALCULATION
  // ==========================================================

  const rr = useMemo(() => {
    if (!effectiveEntry || !sl || !tp) {
      return 0;
    }

    return calculateRR(
      Number(effectiveEntry),
      Number(sl),
      Number(tp)
    );
  }, [effectiveEntry, sl, tp]);

  // ==========================================================
  // AUTO LOT CALCULATION
  // ==========================================================

  const calculatedLotSize = useMemo(() => {
    if (
      Number(riskAmount) <= 0 ||
      Number(riskPips) <= 0
    ) {
      return 0;
    }

    return calculateLotSize(
      Number(riskAmount),
      Number(riskPips)
    );
  }, [riskAmount, riskPips]);

  // ==========================================================
  // FINAL LOT SIZE
  // ==========================================================

  const lotSize = useMemo(() => {
    return Number(calculatedLotSize || 0);
  }, [calculatedLotSize]);

  // ==========================================================
  // REWARD AMOUNT
  // ==========================================================

  const rewardAmount = useMemo(() => {
    return (
      Number(riskAmount || 0) *
      Number(rr || 0)
    );
  }, [riskAmount, rr]);

  // ==========================================================
  // ORDER VALIDATION
  // ==========================================================

  const validation = useMemo(() => {
    const errors = [];

    const currentBid = Number(bid || 0);
    const currentAsk = Number(ask || 0);
    const entryPrice = Number(effectiveEntry || 0);
    const stopLoss = Number(sl || 0);
    const takeProfit = Number(tp || 0);
    const riskValue = Number(risk || 0);
    const lotsValue = Number(lotSize || 0);

    // ========================================================
    // TRADING WINDOW
    // ========================================================

    if (!tradingWindowOpen) {
      errors.push(
        `Trading window is closed. Trading is allowed from ${tradingWindowStart} to ${tradingWindowEnd}.`
      );
    }

    // ========================================================
    // MARKET DATA
    // ========================================================

    if (orderType === "Market") {
      if (side === "buy" && currentAsk <= 0) {
        errors.push("Live Ask price is not available.");
      }

      if (side === "sell" && currentBid <= 0) {
        errors.push("Live Bid price is not available.");
      }
    }

    // ========================================================
    // ENTRY
    // ========================================================

    if (!entryPrice || entryPrice <= 0) {
      errors.push("Entry price is required.");
    }

    // ========================================================
    // STOP LOSS
    // ========================================================

    if (!stopLoss || stopLoss <= 0) {
      errors.push("Stop Loss is required.");
    }

    // ========================================================
    // TAKE PROFIT
    // ========================================================

    if (!takeProfit || takeProfit <= 0) {
      errors.push("Take Profit is required.");
    }

    // ========================================================
    // GUARDRAILS RISK
    // ========================================================

    if (!riskValue || riskValue <= 0) {
      errors.push(
        "Risk Per Trade is not configured in Guardrails."
      );
    }

    // ========================================================
    // LOT SIZE
    // ========================================================

    if (
      !Number.isFinite(lotsValue) ||
      lotsValue <= 0
    ) {
      errors.push(
        "Lot size cannot be calculated. Add a valid Stop Loss."
      );
    }

    // ========================================================
    // BUY VALIDATION
    // ========================================================

    if (side === "buy") {
      if (
        stopLoss > 0 &&
        entryPrice > 0 &&
        stopLoss >= entryPrice
      ) {
        errors.push(
          "For Buy orders, Stop Loss must be below Entry."
        );
      }

      if (
        takeProfit > 0 &&
        entryPrice > 0 &&
        takeProfit <= entryPrice
      ) {
        errors.push(
          "For Buy orders, Take Profit must be above Entry."
        );
      }
    }

    // ========================================================
    // SELL VALIDATION
    // ========================================================

    if (side === "sell") {
      if (
        stopLoss > 0 &&
        entryPrice > 0 &&
        stopLoss <= entryPrice
      ) {
        errors.push(
          "For Sell orders, Stop Loss must be above Entry."
        );
      }

      if (
        takeProfit > 0 &&
        entryPrice > 0 &&
        takeProfit >= entryPrice
      ) {
        errors.push(
          "For Sell orders, Take Profit must be below Entry."
        );
      }
    }

    // ========================================================
    // BUY LIMIT
    // ========================================================

    if (
      orderType === "Limit" &&
      side === "buy" &&
      currentAsk > 0 &&
      entryPrice >= currentAsk
    ) {
      errors.push(
        "Buy Limit price must be below current Ask."
      );
    }

    // ========================================================
    // SELL LIMIT
    // ========================================================

    if (
      orderType === "Limit" &&
      side === "sell" &&
      currentBid > 0 &&
      entryPrice <= currentBid
    ) {
      errors.push(
        "Sell Limit price must be above current Bid."
      );
    }

    // ========================================================
    // BUY STOP
    // ========================================================

    if (
      orderType === "Stop" &&
      side === "buy" &&
      currentAsk > 0 &&
      entryPrice <= currentAsk
    ) {
      errors.push(
        "Buy Stop price must be above current Ask."
      );
    }

    // ========================================================
    // SELL STOP
    // ========================================================

    if (
      orderType === "Stop" &&
      side === "sell" &&
      currentBid > 0 &&
      entryPrice >= currentBid
    ) {
      errors.push(
        "Sell Stop price must be below current Bid."
      );
    }

    // ========================================================
    // STOP LOSS DISTANCE
    // ========================================================

    if (
      !Number.isFinite(Number(riskPips)) ||
      Number(riskPips) <= 0
    ) {
      errors.push(
        "Stop Loss distance must be greater than zero."
      );
    }

    // ========================================================
    // FINAL RESULT
    // ========================================================

    return {
      valid: errors.length === 0,
      errors,
    };
  }, [
    bid,
    ask,
    side,
    orderType,
    effectiveEntry,
    sl,
    tp,
    risk,
    lotSize,
    riskPips,
    tradingWindowOpen,
    tradingWindowStart,
    tradingWindowEnd,
  ]);

  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <OrderContext.Provider
      value={{
        // ACCOUNT
        balance,

        // MARKET
        symbol,
        bid,
        ask,

        // SIDE
        side,
        setSide,

        // ORDER TYPE
        orderType,
        setOrderType,

        // PRICES
        entry,
        setEntry,
        effectiveEntry,
        sl,
        setSL,
        tp,
        setTP,

        // GUARDRAILS
        guardrails,
        setGuardrails,
        risk,

        // TRADING WINDOW
        tradingWindowOpen,
        tradingWindowStart,
        tradingWindowEnd,

        // CALCULATIONS
        riskAmount,
        rewardAmount,
        riskPips,
        rewardPips,
        rr,
        calculatedLotSize,
        lotSize,

        // VALIDATION
        validation,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}