function getTradePnL(trade) {
    const value = Number(
      trade?.pnl ??
        trade?.profit ??
        trade?.netPL ??
        trade?.netProfit ??
        trade?.netPnL ??
        trade?.PnL ??
        0
    );
  
    return Number.isFinite(value)
      ? value
      : 0;
  }
  
  function getTradeR(trade) {
    const directR = Number(
      trade?.r ??
        trade?.R ??
        trade?.netR ??
        trade?.resultR
    );
  
    if (Number.isFinite(directR)) {
      return directR;
    }
  
    const pnl =
      getTradePnL(trade);
  
    const riskAmount = Number(
      trade?.riskAmount ??
        trade?.risk ??
        trade?.initialRisk ??
        0
    );
  
    if (
      Number.isFinite(pnl) &&
      Number.isFinite(riskAmount) &&
      riskAmount > 0
    ) {
      return pnl / riskAmount;
    }
  
    return 0;
  }
  
  export function calculateReviewStats(
    trades = []
  ) {
    const validTrades =
      Array.isArray(trades)
        ? trades.filter(Boolean)
        : [];
  
    const totalTrades =
      validTrades.length;
  
    const wins =
      validTrades.filter(
        (trade) =>
          getTradePnL(trade) > 0
      ).length;
  
    const losses =
      validTrades.filter(
        (trade) =>
          getTradePnL(trade) < 0
      ).length;
  
    const breakeven =
      validTrades.filter(
        (trade) =>
          getTradePnL(trade) === 0
      ).length;
  
    const netPL =
      validTrades.reduce(
        (sum, trade) =>
          sum + getTradePnL(trade),
        0
      );
  
    const grossProfit =
      validTrades.reduce(
        (sum, trade) => {
          const pnl =
            getTradePnL(trade);
  
          return (
            sum +
            (pnl > 0 ? pnl : 0)
          );
        },
        0
      );
  
    const grossLoss =
      validTrades.reduce(
        (sum, trade) => {
          const pnl =
            getTradePnL(trade);
  
          return (
            sum +
            (pnl < 0
              ? Math.abs(pnl)
              : 0)
          );
        },
        0
      );
  
    const winRate =
      totalTrades > 0
        ? (wins / totalTrades) *
          100
        : 0;
  
    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0;
  
    // ============================================================
    // REALIZED R
    // ============================================================
  
    const rValues =
      validTrades.map(
        getTradeR
      );
  
    const netR =
      rValues.reduce(
        (sum, value) =>
          sum + value,
        0
      );
  
    const averageR =
      rValues.length > 0
        ? netR / rValues.length
        : 0;
  
    // ============================================================
    // MAX DRAWDOWN
    // ============================================================
  
    let equityR = 0;
    let peakR = 0;
    let maxDrawdown = 0;
  
    for (
      const value of rValues
    ) {
      equityR += value;
  
      if (
        equityR > peakR
      ) {
        peakR = equityR;
      }
  
      const drawdown =
        peakR - equityR;
  
      if (
        drawdown >
        maxDrawdown
      ) {
        maxDrawdown =
          drawdown;
      }
    }
  
    return {
      totalTrades,
  
      wins,
  
      losses,
  
      breakeven,
  
      winRate: Number(
        winRate.toFixed(2)
      ),
  
      netPL: Number(
        netPL.toFixed(2)
      ),
  
      netR: Number(
        netR.toFixed(2)
      ),
  
      averageR: Number(
        averageR.toFixed(2)
      ),
  
      maxDrawdown: Number(
        maxDrawdown.toFixed(2)
      ),
  
      profitFactor:
        profitFactor === Infinity
          ? "∞"
          : Number(
              profitFactor.toFixed(2)
            ),
    };
  }
  
  export function getTradeRValue(
    trade
  ) {
    return getTradeR(
      trade
    );
  }
  
  export function getTradePnLValue(
    trade
  ) {
    return getTradePnL(
      trade
    );
  }