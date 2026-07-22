import { createContext, useState } from "react";
import { calculateLotSize } from "../../../../utils/calculator/lotCalculator";
import { calculatePips } from "../../../../utils/calculator/pipCalculator";
import { calculateRR } from "../../../../utils/calculator/rrCalculator";
import { calculateRiskAmount } from "../../../../utils/calculator/riskCalculator";



export const OrderContext = createContext();

export function OrderProvider({ children }) {

  const balance = 100158.75;

  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("Market");

  const [entry, setEntry] = useState("1.08250");
  const [sl, setSL] = useState("1.08050");
  const [tp, setTP] = useState("1.08650");

  const [risk, setRisk] = useState(1);

  const [lots, setLots] = useState(5.00);
  // Auto Calculations

const riskAmount = calculateRiskAmount(
  balance,
  risk
);

const riskPips = calculatePips(
  entry,
  sl
);

const rewardPips = calculatePips(
  entry,
  tp
);

const rr = calculateRR(
  entry,
  sl,
  tp
);

const rewardAmount =
  riskAmount * rr;

  const lotSize = calculateLotSize(
    riskAmount,
    riskPips
  );

  return (
    <OrderContext.Provider
      value={{
        balance,

        side,
        setSide,

        orderType,
        setOrderType,

        entry,
        setEntry,

        sl,
        setSL,

        tp,
        setTP,

        risk,
        setRisk,

        riskAmount,
        rewardAmount,
        riskPips,
        rewardPips,
        rr,
        lotSize,

        lots,
setLots,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}