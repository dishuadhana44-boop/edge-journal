// src/utils/recommendationEngine.js

export function generateRecommendations({
    planStats = [],
    sessionStats = [],
    trades = [],
  } = {}) {
    const recommendations = [];
  
    if (!trades.length) {
      return [
        {
          type: "info",
          priority: "low",
          title: "Not enough trading data",
          message:
            "Take more trades and journal them properly before making performance recommendations.",
        },
      ];
    }
  
    // -----------------------------------------
    // BEST PLAN
    // -----------------------------------------
  
    const activePlans = planStats.filter(
      (plan) => plan.trades >= 3
    );
  
    if (activePlans.length) {
      const bestPlan = [...activePlans].sort(
        (a, b) => b.netPnL - a.netPnL
      )[0];
  
      if (bestPlan.netPnL > 0) {
        recommendations.push({
          type: "positive",
          priority: "high",
          title: "Your strongest plan",
          message:
            `${bestPlan.planName} is currently your strongest plan with ` +
            `${bestPlan.trades} trades, ` +
            `${bestPlan.winRate}% win rate and ` +
            `${bestPlan.averageRR}R average RR.`,
        });
      }
    }
  
    // -----------------------------------------
    // WEAK PLAN
    // -----------------------------------------
  
    const weakPlans = activePlans.filter(
      (plan) => plan.netPnL < 0
    );
  
    if (weakPlans.length) {
      const weakPlan = [...weakPlans].sort(
        (a, b) => a.netPnL - b.netPnL
      )[0];
  
      recommendations.push({
        type: "warning",
        priority: "high",
        title: "Review losing plan",
        message:
          `${weakPlan.planName} is currently negative. ` +
          `Review its entry conditions, mistakes and execution before increasing its frequency.`,
      });
    }
  
    // -----------------------------------------
    // BEST SESSION
    // -----------------------------------------
  
    const activeSessions = sessionStats.filter(
      (session) => session.trades >= 3
    );
  
    if (activeSessions.length) {
      const bestSession = [...activeSessions].sort(
        (a, b) => b.netPnL - a.netPnL
      )[0];
  
      recommendations.push({
        type: "positive",
        priority: "medium",
        title: "Strongest trading session",
        message:
          `${bestSession.session} is your strongest session with ` +
          `${bestSession.winRate}% win rate and ` +
          `${bestSession.averageRR}R average RR.`,
      });
    }
  
    // -----------------------------------------
    // LOW WIN RATE
    // -----------------------------------------
  
    activePlans.forEach((plan) => {
      if (
        plan.trades >= 5 &&
        plan.winRate < 40
      ) {
        recommendations.push({
          type: "warning",
          priority: "medium",
          title: "Low win rate detected",
          message:
            `${plan.planName} has a ${plan.winRate}% win rate ` +
            `over ${plan.trades} trades. Review whether the setup conditions are being followed consistently.`,
        });
      }
    });
  
    // -----------------------------------------
    // LOW RR
    // -----------------------------------------
  
    activePlans.forEach((plan) => {
      if (
        plan.trades >= 5 &&
        plan.averageRR < 1
      ) {
        recommendations.push({
          type: "warning",
          priority: "medium",
          title: "Low reward-to-risk",
          message:
            `${plan.planName} has an average RR of ${plan.averageRR}R. ` +
            `Review whether entries are being taken too late or targets are being reduced.`,
        });
      }
    });
  
    // -----------------------------------------
    // PROFIT FACTOR
    // -----------------------------------------
  
    activePlans.forEach((plan) => {
      const pf = Number(plan.profitFactor);
  
      if (
        plan.trades >= 5 &&
        Number.isFinite(pf) &&
        pf < 1
      ) {
        recommendations.push({
          type: "warning",
          priority: "high",
          title: "Negative expectancy profile",
          message:
            `${plan.planName} has a profit factor below 1. ` +
            `Your losses are currently outweighing your profits.`,
        });
      }
    });
  
    // -----------------------------------------
    // MISTAKES
    // -----------------------------------------
  
    activePlans.forEach((plan) => {
      if (!plan.mistakeRows?.length) return;
  
      const topMistake =
        plan.mistakeRows[0];
  
      if (topMistake.count >= 2) {
        recommendations.push({
          type: "mistake",
          priority: "high",
          title: "Repeated mistake",
          message:
            `"${topMistake.mistake}" has appeared ` +
            `${topMistake.count} times in ${plan.planName}. ` +
            `This should be one of your main execution priorities.`,
        });
      }
    });
  
    // -----------------------------------------
    // TRADE FREQUENCY
    // -----------------------------------------
  
    const recentTrades = trades
      .filter((trade) => trade?.date)
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );
  
    if (recentTrades.length >= 10) {
      const recent10 =
        recentTrades.slice(0, 10);
  
      const wins = recent10.filter(
        (trade) =>
          Number(trade?.pnl || 0) > 0
      ).length;
  
      const recentWinRate =
        (wins / recent10.length) * 100;
  
      if (recentWinRate < 30) {
        recommendations.push({
          type: "warning",
          priority: "high",
          title: "Recent performance deterioration",
          message:
            `Your last 10 trades have a ${recentWinRate.toFixed(
              0
            )}% win rate. Consider reducing trade frequency and reviewing recent execution.`,
        });
      }
    }
  
    // -----------------------------------------
    // LIMIT
    // -----------------------------------------
  
    const priorityOrder = {
      high: 1,
      medium: 2,
      low: 3,
    };
  
    return recommendations
      .sort(
        (a, b) =>
          priorityOrder[a.priority] -
          priorityOrder[b.priority]
      )
      .slice(0, 12);
  }