import { useEffect, useState } from "react";
import { getSetupAnalytics } from "../utils/setupAnalytics";

export default function useWeeklyReview() {

  const [review, setReview] = useState({

    trades: 0,

    winRate: 0,

    pnl: 0,

    rr: 0,

    bestSetup: "",

    sessions: [],

    violations: [],

  });

  useEffect(() => {

    const tradeLog =
      JSON.parse(localStorage.getItem("tradeLog")) || [];

      const setups = getSetupAnalytics(tradeLog);

    if (!tradeLog.length) return;

    const wins =
      tradeLog.filter(t => t.result === "Win").length;

    const total = tradeLog.length;

    const pnl =
      tradeLog.reduce(
        (sum, t) => sum + Number(t.pnl || 0),
        0
      );

    const rr =
      tradeLog.reduce(
        (sum, t) => sum + Number(t.rr || 0),
        0
      ) / total;

      setReview({

        trades: total,
      
        winRate: Math.round((wins / total) * 100),
      
        pnl,
      
        rr: rr.toFixed(2),
      
        setups,
      
        bestSetup:
          setups.length > 0
            ? setups.sort((a, b) => b.winRate - a.winRate)[0]
            : null,
      
        sessions: [],
      
        violations: [],
      
      });

  }, []);

  return review;

}