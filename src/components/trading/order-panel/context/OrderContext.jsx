import {
  createContext,
  useState,
  useMemo,
  useEffect,
} from "react";

import { useMarket } from "../../../../context/MarketContext";

import { calculateLotSize } from "../../../../utils/calculator/lotCalculator";
import { calculatePips } from "../../../../utils/calculator/pipCalculator";
import { calculateRR } from "../../../../utils/calculator/rrCalculator";
import { calculateRiskAmount } from "../../../../utils/calculator/riskCalculator";

export const OrderContext = createContext();

export function OrderProvider({ children }) {

  /*
  ============================================================
  MARKET DATA
  ============================================================
  */

  const market = useMarket();

  const bid = Number(market?.bid || 0);
  const ask = Number(market?.ask || 0);

  /*
  ============================================================
  ACCOUNT
  ============================================================
  */

  const balance = 100158.75;

  /*
  ============================================================
  ORDER SIDE
  ============================================================
  */

  const [side, setSide] = useState("buy");

  /*
  ============================================================
  ORDER TYPE
  ============================================================
  */

  const [orderType, setOrderType] = useState("Market");

  /*
  ============================================================
  PRICES
  ============================================================
  */

  /*
    IMPORTANT:

    Market order entry is controlled by live Bid / Ask.

    We keep entry as state because Limit / Stop orders
    need a manually entered price.
  */

  const [entry, setEntry] = useState("");

  const [sl, setSL] = useState("");

  const [tp, setTP] = useState("");

  /*
  ============================================================
  LIVE MARKET ENTRY SYNC
  ============================================================
  
  BUY MARKET:
      Entry = ASK

  SELL MARKET:
      Entry = BID

  Limit / Stop:
      Entry remains manually controlled.
  ============================================================
  */

  useEffect(() => {

    if (orderType !== "Market") {
      return;
    }

    let marketEntry = 0;

    if (side === "buy") {
      marketEntry = ask;
    } else {
      marketEntry = bid;
    }

    /*
      Do not put zero into entry.

      cTrader spot events can contain only BID or ASK.
      Therefore, if the required side is temporarily
      unavailable, keep the previous valid entry.
    */

    if (
      Number.isFinite(marketEntry) &&
      marketEntry > 0
    ) {

      setEntry(
        marketEntry.toFixed(5)
      );

    }

  }, [
    orderType,
    side,
    bid,
    ask,
  ]);

  /*
  ============================================================
  RISK
  ============================================================
  */

  const [risk, setRisk] = useState(1);

  /*
  ============================================================
  LOT SIZE
  ============================================================
  */

  const [lots, setLots] = useState(0.01);

  /*
  ============================================================
  EDIT MODE
  ============================================================
  
  "risk":
      Lot size is calculated automatically.

  "lots":
      User manually controls lot size.
  ============================================================
  */

  const [lotEditMode, setLotEditMode] =
    useState("risk");

  /*
  ============================================================
  EFFECTIVE ENTRY
  ============================================================
  
  MARKET:
      BUY  -> ASK
      SELL -> BID

  LIMIT / STOP:
      User entered price
  ============================================================
  */

  const effectiveEntry = useMemo(() => {

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

    return Number(entry || 0);

  }, [
    orderType,
    side,
    bid,
    ask,
    entry,
  ]);

  /*
  ============================================================
  RISK PIPS
  ============================================================
  */

  const riskPips =
    calculatePips(
      effectiveEntry,
      Number(sl || 0)
    );

  /*
  ============================================================
  REWARD PIPS
  ============================================================
  */

  const rewardPips =
    calculatePips(
      effectiveEntry,
      Number(tp || 0)
    );

  /*
  ============================================================
  RISK AMOUNT
  ============================================================
  */

  const riskAmount =
    calculateRiskAmount(
      Number(balance),
      Number(risk)
    );

  /*
  ============================================================
  R:R
  ============================================================
  */

  const rr =
    calculateRR(
      effectiveEntry,
      Number(sl || 0),
      Number(tp || 0)
    );

  /*
  ============================================================
  AUTO LOT CALCULATION
  ============================================================
  */

  const calculatedLotSize =
    calculateLotSize(
      Number(riskAmount || 0),
      Number(riskPips || 0)
    );

  /*
  ============================================================
  FINAL LOT SIZE
  ============================================================
  
  Risk mode:
      Automatically calculated.

  Lot mode:
      User entered lots.
  ============================================================
  */

  const lotSize =
    lotEditMode === "risk"
      ? Number(calculatedLotSize || 0)
      : Number(lots || 0);

  /*
  ============================================================
  RISK FROM LOTS
  ============================================================
  */

  const riskFromLots = useMemo(() => {

    const calculatedLots =
      Number(calculatedLotSize || 0);

    const enteredLots =
      Number(lots || 0);

    if (
      calculatedLots <= 0 ||
      enteredLots <= 0
    ) {

      return Number(risk || 0);

    }

    const currentRisk =
      Number(risk || 0);

    const calculatedRiskAmount =
      Number(riskAmount || 0);

    if (
      calculatedRiskAmount <= 0
    ) {

      return currentRisk;

    }

    const newRiskAmount =
      calculatedRiskAmount *
      (
        enteredLots /
        calculatedLots
      );

    const newRisk =
      (
        newRiskAmount /
        Number(balance)
      ) * 100;

    return Math.min(
      10,
      Math.max(
        0.25,
        Number(newRisk)
      )
    );

  }, [
    calculatedLotSize,
    lots,
    risk,
    riskAmount,
    balance,
  ]);

  /*
  ============================================================
  RISK HANDLER
  ============================================================
  */

  const handleRiskChange = (value) => {

    let newRisk = Number(value);

    if (!Number.isFinite(newRisk)) {
      newRisk = 0;
    }

    newRisk =
      Math.min(
        10,
        Math.max(
          0,
          newRisk
        )
      );

    setLotEditMode("risk");

    setRisk(newRisk);

  };

  /*
  ============================================================
  LOT HANDLER
  ============================================================
  */

  const handleLotsChange = (value) => {

    let newLots = Number(value);

    if (!Number.isFinite(newLots)) {
      newLots = 0;
    }

    newLots =
      Math.max(
        0,
        newLots
      );

    setLots(newLots);

    /*
      Manual lot mode.
    */

    setLotEditMode("lots");

    /*
      Calculate matching risk.
    */

    const calculatedLots =
      Number(calculatedLotSize || 0);

    if (
      calculatedLots > 0 &&
      newLots > 0
    ) {

      const currentRiskAmount =
        Number(riskAmount || 0);

      const newRiskAmount =
        currentRiskAmount *
        (
          newLots /
          calculatedLots
        );

      const newRisk =
        (
          newRiskAmount /
          Number(balance)
        ) * 100;

      const clampedRisk =
        Math.min(
          10,
          Math.max(
            0.25,
            newRisk
          )
        );

      setRisk(
        Number(
          clampedRisk.toFixed(2)
        )
      );

    }

  };

  /*
  ============================================================
  REWARD AMOUNT
  ============================================================
  */

  const rewardAmount =
    Number(riskAmount || 0) *
    Number(rr || 0);

  /*
  ============================================================
  ORDER VALIDATION
  ============================================================
  */

  const validation = useMemo(() => {

    const errors = [];

    const currentBid =
      Number(bid || 0);

    const currentAsk =
      Number(ask || 0);

    const entryPrice =
      Number(effectiveEntry || 0);

    const stopLoss =
      Number(sl || 0);

    const takeProfit =
      Number(tp || 0);

    const riskValue =
      Number(risk || 0);

    const lotsValue =
      Number(lotSize || 0);

    /*
    ----------------------------------------------------------
    MARKET DATA
    ----------------------------------------------------------
    */

    if (orderType === "Market") {

      if (side === "buy" && currentAsk <= 0) {

        errors.push(
          "Live Ask price is not available."
        );

      }

      if (side === "sell" && currentBid <= 0) {

        errors.push(
          "Live Bid price is not available."
        );

      }

    }

    /*
    ----------------------------------------------------------
    ENTRY
    ----------------------------------------------------------
    */

    if (
      !entryPrice ||
      entryPrice <= 0
    ) {

      errors.push(
        "Entry price is required."
      );

    }

    /*
    ----------------------------------------------------------
    STOP LOSS
    ----------------------------------------------------------
    */

    if (
      !stopLoss ||
      stopLoss <= 0
    ) {

      errors.push(
        "Stop Loss is required."
      );

    }

    /*
    ----------------------------------------------------------
    TAKE PROFIT
    ----------------------------------------------------------
    */

    if (
      !takeProfit ||
      takeProfit <= 0
    ) {

      errors.push(
        "Take Profit is required."
      );

    }

    /*
    ----------------------------------------------------------
    RISK
    ----------------------------------------------------------
    */

    if (
      !riskValue ||
      riskValue < 0.25 ||
      riskValue > 10
    ) {

      errors.push(
        "Risk must be between 0.25% and 10%."
      );

    }

    /*
    ----------------------------------------------------------
    LOT SIZE
    ----------------------------------------------------------
    */

    if (
      !Number.isFinite(lotsValue) ||
      lotsValue <= 0
    ) {

      errors.push(
        "Invalid lot size."
      );

    }

    /*
    ----------------------------------------------------------
    BUY
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    SELL
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    BUY LIMIT
    ----------------------------------------------------------
    */

    if (
      orderType === "Limit" &&
      side === "buy"
    ) {

      if (
        currentAsk > 0 &&
        entryPrice >= currentAsk
      ) {

        errors.push(
          "Buy Limit price must be below current Ask."
        );

      }

    }

    /*
    ----------------------------------------------------------
    SELL LIMIT
    ----------------------------------------------------------
    */

    if (
      orderType === "Limit" &&
      side === "sell"
    ) {

      if (
        currentBid > 0 &&
        entryPrice <= currentBid
      ) {

        errors.push(
          "Sell Limit price must be above current Bid."
        );

      }

    }

    /*
    ----------------------------------------------------------
    BUY STOP
    ----------------------------------------------------------
    */

    if (
      orderType === "Stop" &&
      side === "buy"
    ) {

      if (
        currentAsk > 0 &&
        entryPrice <= currentAsk
      ) {

        errors.push(
          "Buy Stop price must be above current Ask."
        );

      }

    }

    /*
    ----------------------------------------------------------
    SELL STOP
    ----------------------------------------------------------
    */

    if (
      orderType === "Stop" &&
      side === "sell"
    ) {

      if (
        currentBid > 0 &&
        entryPrice >= currentBid
      ) {

        errors.push(
          "Sell Stop price must be below current Bid."
        );

      }

    }

    /*
    ----------------------------------------------------------
    PIPS
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    FINAL
    ----------------------------------------------------------
    */

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

  ]);

  /*
  ============================================================
  PROVIDER
  ============================================================
  */

  return (

    <OrderContext.Provider
      value={{

        /*
        ========================================================
        ACCOUNT
        ========================================================
        */

        balance,

        /*
        ========================================================
        MARKET
        ========================================================
        */

        bid,
        ask,

        /*
        ========================================================
        SIDE
        ========================================================
        */

        side,
        setSide,

        /*
        ========================================================
        ORDER TYPE
        ========================================================
        */

        orderType,
        setOrderType,

        /*
        ========================================================
        PRICES
        ========================================================
        */

        entry,
        setEntry,

        effectiveEntry,

        sl,
        setSL,

        tp,
        setTP,

        /*
        ========================================================
        RISK
        ========================================================
        */

        risk,

        setRisk:
          handleRiskChange,

        /*
        ========================================================
        LOTS
        ========================================================
        */

        lots,

        setLots:
          handleLotsChange,

        /*
        ========================================================
        CALCULATIONS
        ========================================================
        */

        riskAmount,
        rewardAmount,

        riskPips,
        rewardPips,

        rr,

        lotSize,

        /*
        ========================================================
        EXTRA
        ========================================================
        */

        riskFromLots,

        calculatedLotSize,

        /*
        ========================================================
        VALIDATION
        ========================================================
        */

        validation,

      }}
    >

      {children}

    </OrderContext.Provider>

  );

}