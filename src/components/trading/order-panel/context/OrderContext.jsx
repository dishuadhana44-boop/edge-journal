import {
  createContext,
  useState,
  useMemo,
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

  const { bid, ask } = useMarket();


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

  const [orderType, setOrderType] =
    useState("Market");


  /*
  ============================================================
  PRICES
  ============================================================
  */

  const [entry, setEntry] =
    useState("1.08250");

  const [sl, setSL] =
    useState("1.08050");

  const [tp, setTP] =
    useState("1.08650");


  /*
  ============================================================
  RISK
  ============================================================
  */

  const [risk, setRisk] =
    useState(1);


  /*
  ============================================================
  LOT SIZE
  ============================================================
  */

  const [lots, setLots] =
    useState(5.00);


  /*
  ============================================================
  EDIT MODE
  ============================================================
  
  risk  -> "risk"
  lots  -> "lots"

  Isse infinite loop avoid hota hai.

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

      return side === "buy"
        ? Number(ask || 0)
        : Number(bid || 0);

    }

    return Number(entry || 0);

  }, [
    orderType,
    side,
    ask,
    bid,
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
      sl
    );


  /*
  ============================================================
  REWARD PIPS
  ============================================================
  */

  const rewardPips =
    calculatePips(
      effectiveEntry,
      tp
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
      sl,
      tp
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
    Lot automatically calculated.

  Lot mode:
    User entered lot is used.
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
  
  Used when user manually changes Lots.

  Approximation based on current
  calculated lot relationship.
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
  RISK / LOT HANDLERS
  ============================================================
  */

  const handleRiskChange = (value) => {

    let newRisk =
      Number(value);

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


  const handleLotsChange = (value) => {

    let newLots =
      Number(value);

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
      Lots manually changed.
      Switch calculation mode to lots.
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
    BASIC VALUES
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


    if (
      !stopLoss ||
      stopLoss <= 0
    ) {

      errors.push(
        "Stop Loss is required."
      );

    }


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
    LIMIT
    ----------------------------------------------------------
    */

    if (orderType === "Limit") {

      if (side === "buy") {

        if (
          entryPrice >= currentAsk
        ) {

          errors.push(
            "Buy Limit price must be below current Ask."
          );

        }

      }


      if (side === "sell") {

        if (
          entryPrice <= currentBid
        ) {

          errors.push(
            "Sell Limit price must be above current Bid."
          );

        }

      }

    }


    /*
    ----------------------------------------------------------
    STOP
    ----------------------------------------------------------
    */

    if (orderType === "Stop") {

      if (side === "buy") {

        if (
          entryPrice <= currentAsk
        ) {

          errors.push(
            "Buy Stop price must be above current Ask."
          );

        }

      }


      if (side === "sell") {

        if (
          entryPrice >= currentBid
        ) {

          errors.push(
            "Sell Stop price must be below current Bid."
          );

        }

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
        ACCOUNT
        */

        balance,


        /*
        MARKET
        */

        bid,
        ask,


        /*
        SIDE
        */

        side,
        setSide,


        /*
        ORDER TYPE
        */

        orderType,
        setOrderType,


        /*
        PRICES
        */

        entry,
        setEntry,

        effectiveEntry,

        sl,
        setSL,

        tp,
        setTP,


        /*
        RISK
        */

        risk,

        setRisk: handleRiskChange,


        /*
        LOTS
        */

        lots,

        setLots: handleLotsChange,


        /*
        CALCULATIONS
        */

        riskAmount,
        rewardAmount,

        riskPips,
        rewardPips,

        rr,

        lotSize,


        /*
        VALIDATION
        */

        validation,

      }}
    >

      {children}

    </OrderContext.Provider>

  );

}