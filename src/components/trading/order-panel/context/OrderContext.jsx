import {
  createContext,
  useMemo,
  useEffect,
  useState,
} from "react";

import { useMarket } from "../../../../context/MarketContext";
import { useTrade } from "../../../../context/TradeContext";
import { calculateRR } from "../../../../utils/calculator/rrCalculator";
import {
  BALANCE_MAX_AGE_MS,
  riskAmountForAccount,
} from "../../../../utils/trading/accountBalance";
import {
  SIZING_CODES,
  distanceInPips,
  sizePosition,
} from "../../../../utils/trading/positionSizing";
import {
  DEFAULT_GUARDRAILS,
  GUARDRAIL_STORAGE_KEY,
  readStoredGuardrails,
} from "../../../../utils/trading/tradingGuardrails";

export const OrderContext = createContext(null);

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

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return (
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

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

  // Pip value is quoted in the symbol's quote currency, so sizing needs the
  // account currency to convert it. Sizing refuses to run when it is unknown.
  const { account, selectedAccountId } = useTrade();

  const accountCurrency = String(
    account?.currency || ""
  )
    .trim()
    .toUpperCase();

  // The balance the account actually holds. This panel once hardcoded
  // 100158.75, which made every risk percentage mean something the account never
  // held; risk maths now run only on a loaded, positive balance.
  const rawAccountBalance = account?.balance;

  // When this balance last came from the broker, and which account it came
  // from. A remembered balance without a believable stamp is not evidence of
  // what the account holds right now, so it may not drive automatic sizing.
  const balanceRefreshedAt =
    account?.balanceRefreshedAt;

  const balanceOwnerAccountId =
    account?.balanceRefreshedAccountId;

  const balance = Number.isFinite(
    Number(rawAccountBalance)
  )
    ? Number(rawAccountBalance)
    : 0;

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
  // MANUAL LOT SIZE
  //
  // Empty string = AUTO LOT
  // Value entered = MANUAL LOT
  // ==========================================================

  const [manualLotSize, setManualLotSize] = useState("");

  // ==========================================================
  // SAVE ORDER PRICES
  // ==========================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "edgeflo_order_entry",
        entry
      );

      localStorage.setItem(
        "edgeflo_order_sl",
        sl
      );

      localStorage.setItem(
        "edgeflo_order_tp",
        tp
      );
    } catch (error) {
      console.error(
        "Failed to save order prices:",
        error
      );
    }
  }, [entry, sl, tp]);

  // ==========================================================
  // LIVE MARKET ENTRY SYNC
  //
  // BUY MARKET  -> ASK
  // SELL MARKET -> BID
  // ==========================================================

  useEffect(() => {
    if (orderType !== "Market") {
      return;
    }

    const marketEntry =
      side === "buy"
        ? ask
        : bid;

    if (
      Number.isFinite(marketEntry) &&
      marketEntry > 0
    ) {
      const formattedEntry =
        marketEntry.toFixed(5);

      setEntry((previousEntry) => {
        if (
          previousEntry ===
          formattedEntry
        ) {
          return previousEntry;
        }

        return formattedEntry;
      });
    }
  }, [
    orderType,
    side,
    bid,
    ask,
  ]);

  // ==========================================================
  // TRADING GUARDRAILS
  // ==========================================================

  const [guardrails, setGuardrails] =
    useState(() => readStoredGuardrails().guardrails);

  // ==========================================================
  // LISTEN FOR GUARDRAIL UPDATES
  // ==========================================================

  useEffect(() => {
    const handleGuardrailsUpdate = () => {
      setGuardrails(readStoredGuardrails().guardrails);
    };

    const handleStorageUpdate = (event) => {
      if (
        event.key ===
        GUARDRAIL_STORAGE_KEY
      ) {
        handleGuardrailsUpdate();
      }
    };

    window.addEventListener(
      "guardrailsUpdated",
      handleGuardrailsUpdate
    );

    window.addEventListener(
      "storage",
      handleStorageUpdate
    );

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

  const [currentTime, setCurrentTime] =
    useState(Date.now());

  useEffect(() => {
    const interval =
      setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);

    return () =>
      clearInterval(interval);
  }, []);

  const tradingWindowOpen =
    useMemo(() => {
      void currentTime;

      if (
        guardrails?.enabled === false
      ) {
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
    return Number(
      guardrails?.riskPerTrade || 0
    );
  }, [
    guardrails?.riskPerTrade,
  ]);

  // ==========================================================
  // EFFECTIVE ENTRY
  // ==========================================================

  const effectiveEntry =
    useMemo(() => {
      if (orderType === "Market") {
        if (side === "buy") {
          return ask > 0
            ? ask
            : 0;
        }

        return bid > 0
          ? bid
          : 0;
      }

      return Number(
        entry || 0
      );
    }, [
      orderType,
      side,
      bid,
      ask,
      entry,
    ]);

  // ==========================================================
  // RISK PIPS
  //
  // Measured with the symbol's own pip size. JPY pairs, metals and crypto are
  // not 0.0001, so a fixed 4-decimal pip counted a 50-point JPY stop as 500.
  // ==========================================================

  const riskPips = useMemo(() => {
    if (
      !effectiveEntry ||
      !sl
    ) {
      return 0;
    }

    return distanceInPips({
      symbol,
      from: Number(effectiveEntry),
      to: Number(sl),
    }).pips;
  }, [
    symbol,
    effectiveEntry,
    sl,
  ]);

  // ==========================================================
  // REWARD PIPS
  // ==========================================================

  const rewardPips =
    useMemo(() => {
      if (
        !effectiveEntry ||
        !tp
      ) {
        return 0;
      }

      return distanceInPips({
        symbol,
        from: Number(effectiveEntry),
        to: Number(tp),
      }).pips;
    }, [
      symbol,
      effectiveEntry,
      tp,
    ]);

  // ==========================================================
  // RISK AMOUNT
  //
  // A missing, unreadable or non-positive balance produces a risk amount of
  // zero, which stops automatic sizing with the account error below instead of
  // silently sizing against a made-up balance. The same holds for a balance
  // whose last broker refresh is older than the approved window, unknown, or
  // recorded against a different account; the one-second trading-window clock
  // re-runs this check, so auto sizing stops on its own once a sync stalls.
  // ==========================================================

  const accountRisk =
    useMemo(() => {
      return riskAmountForAccount({
        balance: rawAccountBalance,
        riskPercent: risk,
        freshness: {
          refreshedAt: balanceRefreshedAt,
          ownerAccountId: balanceOwnerAccountId,
          expectedAccountId: selectedAccountId,
          maxAgeMs: BALANCE_MAX_AGE_MS,
          now: currentTime,
        },
      });
    }, [
      rawAccountBalance,
      risk,
      balanceRefreshedAt,
      balanceOwnerAccountId,
      selectedAccountId,
      currentTime,
    ]);

  const riskAmount =
    accountRisk.riskAmount;

  // ==========================================================
  // R:R CALCULATION
  // ==========================================================

  const rr = useMemo(() => {
    if (
      !effectiveEntry ||
      !sl ||
      !tp
    ) {
      return 0;
    }

    return calculateRR(
      Number(effectiveEntry),
      Number(sl),
      Number(tp)
    );
  }, [
    effectiveEntry,
    sl,
    tp,
  ]);

  // ==========================================================
  // AUTO LOT CALCULATION
  //
  // Instrument-aware sizing: pip size, contract size and the quote -> account
  // currency conversion come from the app's symbol specification table, volume is
  // floored to the lot step (never rounded up through the risk budget), and a
  // symbol without a usable specification blocks with a reason instead of
  // guessing. These are app-level assumptions, not confirmed broker metadata.
  // ==========================================================

  const sizing =
    useMemo(() => {
      return sizePosition({
        symbol,
        entryPrice: effectiveEntry,
        stopLoss: sl,
        riskAmount,
        accountCurrency,
      });
    }, [
      symbol,
      effectiveEntry,
      sl,
      riskAmount,
      accountCurrency,
    ]);

  const calculatedLotSize =
    Number(sizing.lots || 0);

  // ==========================================================
  // FINAL LOT SIZE
  //
  // If user entered a manual lot -> use it.
  // Otherwise -> use automatic lot calculation.
  // ==========================================================

  const hasManualLot =
    manualLotSize !== "" &&
    Number.isFinite(
      Number(manualLotSize)
    );

  const lotSize = useMemo(() => {
    if (hasManualLot) {
      return Math.max(
        0,
        Number(manualLotSize)
      );
    }

    return calculatedLotSize;
  }, [
    hasManualLot,
    manualLotSize,
    calculatedLotSize,
  ]);

  // ==========================================================
  // REWARD AMOUNT
  // ==========================================================

  const rewardAmount =
    useMemo(() => {
      return (
        Number(riskAmount || 0) *
        Number(rr || 0)
      );
    }, [
      riskAmount,
      rr,
    ]);

  // ==========================================================
  // ORDER VALIDATION
  // ==========================================================

  const validation =
    useMemo(() => {
      const errors = [];

      const currentBid =
        Number(bid || 0);

      const currentAsk =
        Number(ask || 0);

      const entryPrice =
        Number(
          effectiveEntry || 0
        );

      const stopLoss =
        Number(sl || 0);

      const takeProfit =
        Number(tp || 0);

      const riskValue =
        Number(risk || 0);

      const lotsValue =
        Number(lotSize || 0);

      // ======================================================
      // TRADING WINDOW
      // ======================================================

      if (!tradingWindowOpen) {
        errors.push(
          `Trading window is closed. Trading is allowed from ${tradingWindowStart} to ${tradingWindowEnd}.`
        );
      }

      // ======================================================
      // MARKET DATA
      // ======================================================

      if (
        orderType === "Market"
      ) {
        if (
          side === "buy" &&
          currentAsk <= 0
        ) {
          errors.push(
            "Live Ask price is not available."
          );
        }

        if (
          side === "sell" &&
          currentBid <= 0
        ) {
          errors.push(
            "Live Bid price is not available."
          );
        }
      }

      // ======================================================
      // ENTRY
      // ======================================================

      if (
        !entryPrice ||
        entryPrice <= 0
      ) {
        errors.push(
          "Entry price is required."
        );
      }

      // ======================================================
      // STOP LOSS
      // ======================================================

      if (
        !stopLoss ||
        stopLoss <= 0
      ) {
        errors.push(
          "Stop Loss is required."
        );
      }

      // ======================================================
      // TAKE PROFIT
      // ======================================================

      if (
        !takeProfit ||
        takeProfit <= 0
      ) {
        errors.push(
          "Take Profit is required."
        );
      }

      // ======================================================
      // GUARDRAILS RISK
      // ======================================================

      if (
        !riskValue ||
        riskValue <= 0
      ) {
        errors.push(
          "Risk Per Trade is not configured in Guardrails."
        );
      }

      // ======================================================
      // ACCOUNT BALANCE
      //
      // Only automatic, risk-based sizing depends on the balance, so a manually
      // entered volume keeps working while the account is not loaded. The same
      // gate covers a balance that is stale, untimestamped, or recorded for a
      // different account: those all leave accountRisk unavailable.
      // ======================================================

      if (
        !hasManualLot &&
        accountRisk.available === false
      ) {
        errors.push(
          accountRisk.message
        );
      }

      // ======================================================
      // LOT SIZE
      // ======================================================

      // A manual volume is the trader's own decision, so a blocked automatic
      // calculation is only reported when the panel is actually using it. The
      // generic missing-input cases keep their existing messages above.
      const sizingBlocked =
        !sizing.ok &&
        !hasManualLot &&
        sizing.code !== SIZING_CODES.INVALID_INPUT;

      if (sizingBlocked) {
        errors.push(
          sizing.message
        );
      } else if (
        !Number.isFinite(
          lotsValue
        ) ||
        lotsValue <= 0
      ) {
        errors.push(
          "Lot size must be greater than zero."
        );
      }

      // ======================================================
      // BUY VALIDATION
      // ======================================================

      if (side === "buy") {
        if (
          stopLoss > 0 &&
          entryPrice > 0 &&
          stopLoss >=
            entryPrice
        ) {
          errors.push(
            "For Buy orders, Stop Loss must be below Entry."
          );
        }

        if (
          takeProfit > 0 &&
          entryPrice > 0 &&
          takeProfit <=
            entryPrice
        ) {
          errors.push(
            "For Buy orders, Take Profit must be above Entry."
          );
        }
      }

      // ======================================================
      // SELL VALIDATION
      // ======================================================

      if (side === "sell") {
        if (
          stopLoss > 0 &&
          entryPrice > 0 &&
          stopLoss <=
            entryPrice
        ) {
          errors.push(
            "For Sell orders, Stop Loss must be above Entry."
          );
        }

        if (
          takeProfit > 0 &&
          entryPrice > 0 &&
          takeProfit >=
            entryPrice
        ) {
          errors.push(
            "For Sell orders, Take Profit must be below Entry."
          );
        }
      }

      // ======================================================
      // BUY LIMIT
      // ======================================================

      if (
        orderType === "Limit" &&
        side === "buy" &&
        currentAsk > 0 &&
        entryPrice >=
          currentAsk
      ) {
        errors.push(
          "Buy Limit price must be below current Ask."
        );
      }

      // ======================================================
      // SELL LIMIT
      // ======================================================

      if (
        orderType === "Limit" &&
        side === "sell" &&
        currentBid > 0 &&
        entryPrice <=
          currentBid
      ) {
        errors.push(
          "Sell Limit price must be above current Bid."
        );
      }

      // ======================================================
      // BUY STOP
      // ======================================================

      if (
        orderType === "Stop" &&
        side === "buy" &&
        currentAsk > 0 &&
        entryPrice <=
          currentAsk
      ) {
        errors.push(
          "Buy Stop price must be above current Ask."
        );
      }

      // ======================================================
      // SELL STOP
      // ======================================================

      if (
        orderType === "Stop" &&
        side === "sell" &&
        currentBid > 0 &&
        entryPrice >=
          currentBid
      ) {
        errors.push(
          "Sell Stop price must be below current Bid."
        );
      }

      // ======================================================
      // STOP LOSS DISTANCE
      // ======================================================

      if (
        !Number.isFinite(
          Number(riskPips)
        ) ||
        Number(riskPips) <= 0
      ) {
        errors.push(
          "Stop Loss distance must be greater than zero."
        );
      }

      return {
        valid:
          errors.length === 0,
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
      sizing,
      accountRisk,
      hasManualLot,
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
        accountCurrency,
        accountRisk,
        balanceAvailable: accountRisk.available,

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

        // LOTS
        manualLotSize,
        setManualLotSize,

        // CALCULATIONS
        riskAmount,
        rewardAmount,
        riskPips,
        rewardPips,
        rr,
        sizing,
        hasManualLot,
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