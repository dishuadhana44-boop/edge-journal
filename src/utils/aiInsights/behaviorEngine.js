export function analyzeBehavior(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      disciplineScore: 0,
      planFollowingRate: 0,
      riskManagementRate: 0,
      consistencyScore: 0,
      tradingDays: 0,
      averageTradesPerDay: 0,

      revengeTrading: {
        detected: false,
        count: 0,
        severity: "none",
        scoreImpact: 0,
        message: "No revenge trading detected.",
        recommendation: "Continue maintaining discipline after losses.",
      },

      overtrading: {
        detected: false,
        count: 0,
        averageTradesPerDay: 0,
        threshold: 0,
        severity: "none",
        scoreImpact: 0,
        message: "No overtrading pattern detected.",
        recommendation: "Maintain a controlled trading frequency.",
      },

      emotionalTrading: {
        detected: false,
        count: 0,
        severity: "none",
        scoreImpact: 0,
        message: "No emotional trading pattern detected.",
        recommendation: "Continue tracking emotions consistently.",
      },

      summary: "Not enough trade data to analyze behavior.",
      alerts: [],
    };
  }

  const totalTrades = trades.length;

  // -----------------------------
  // HELPERS
  // -----------------------------

  const getPnL = (trade) => {
    const value = String(trade?.pnl ?? 0)
      .replace(/[₹,$+ ]/g, "");

    return Number(value) || 0;
  };

  const getDate = (trade) =>
    trade?.date ||
    trade?.createdAt ||
    trade?.timestamp ||
    null;

  const getEmotion = (trade) => {
    return String(
      [
        trade?.entryEmotion,
        trade?.exitEmotion,
        trade?.emotion,
        trade?.mood,
        trade?.reflection?.entryEmotion,
        trade?.reflection?.exitEmotion,
        trade?.reflection?.emotion,
      ]
        .filter(Boolean)
        .join(" ")
    ).toLowerCase();
  };

  const getSeverity = (count, total) => {
    if (count === 0) return "none";

    const rate = (count / total) * 100;

    if (rate >= 40) return "critical";
    if (rate >= 20) return "high";
    if (rate >= 10) return "medium";

    return "low";
  };

  // -----------------------------
  // PLAN FOLLOWING
  // -----------------------------

  const followedPlan = trades.filter((trade) => {
    return (
      trade?.followedPlan === true ||
      trade?.followedPlan === "true" ||
      trade?.followedPlan === "yes" ||
      trade?.reflection?.followedPlan === true ||
      trade?.reflection?.followedPlan === "true"
    );
  }).length;

  const planFollowingRate =
    (followedPlan / totalTrades) * 100;

  // -----------------------------
  // RISK MANAGEMENT
  // -----------------------------

  const riskManagedTrades = trades.filter((trade) => {
    const hasSL =
      trade?.stopLoss !== undefined &&
      trade?.stopLoss !== null &&
      trade?.stopLoss !== "";

    const rr = Number(
      trade?.rr ??
      trade?.riskReward ??
      0
    );

    return hasSL || rr >= 1;
  }).length;

  const riskManagementRate =
    (riskManagedTrades / totalTrades) * 100;

  // -----------------------------
  // EMOTIONAL TRADING
  // -----------------------------

  const emotionalKeywords = [
    "fear",
    "fearful",
    "fomo",
    "greed",
    "angry",
    "anger",
    "frustrated",
    "frustration",
    "impulsive",
    "emotion",
    "emotional",
    "panic",
    "revenge",
  ];

  const emotionalTrades = trades.filter((trade) => {
    const emotion = getEmotion(trade);

    return emotionalKeywords.some((keyword) =>
      emotion.includes(keyword)
    );
  });

  const emotionalCount = emotionalTrades.length;

  // -----------------------------
  // REVENGE TRADING
  // -----------------------------

  let revengeCount = 0;

  for (let i = 1; i < trades.length; i++) {
    const previousPnL = getPnL(trades[i - 1]);
    const emotion = getEmotion(trades[i]);

    if (
      previousPnL < 0 &&
      (
        emotion.includes("revenge") ||
        emotion.includes("angry") ||
        emotion.includes("frustrated") ||
        emotion.includes("fomo")
      )
    ) {
      revengeCount++;
    }
  }

  // -----------------------------
  // TRADES PER DAY
  // -----------------------------

  const tradesPerDay = {};

  trades.forEach((trade) => {
    const date = getDate(trade);

    if (!date) return;

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return;

    const day = parsedDate.toDateString();

    tradesPerDay[day] =
      (tradesPerDay[day] || 0) + 1;
  });

  const dailyTradeCounts =
    Object.values(tradesPerDay);

  const tradingDays =
    dailyTradeCounts.length;

  const averageTradesPerDay =
    tradingDays > 0
      ? totalTrades / tradingDays
      : 0;

  const overtradingThreshold =
    Math.max(
      5,
      averageTradesPerDay * 1.75
    );

  const overtradingDays =
    dailyTradeCounts.filter(
      (count) => count > overtradingThreshold
    );

  // -----------------------------
  // CONSISTENCY
  // -----------------------------

  const profitableTrades = trades.filter(
    (trade) => getPnL(trade) > 0
  ).length;

  const consistencyScore = Math.min(
    100,
    Math.round(
      (profitableTrades / totalTrades) * 100
    )
  );

  // -----------------------------
  // PENALTIES
  // -----------------------------

  const revengePenalty = Math.min(
    25,
    revengeCount * 8
  );

  const emotionalPenalty = Math.min(
    20,
    emotionalCount * 4
  );

  const overtradingPenalty = Math.min(
    20,
    overtradingDays.length * 5
  );

  // -----------------------------
  // DISCIPLINE SCORE
  // -----------------------------

  const disciplineScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        planFollowingRate * 0.4 +
        riskManagementRate * 0.3 +
        consistencyScore * 0.3 -
        revengePenalty -
        emotionalPenalty -
        overtradingPenalty
      )
    )
  );

  // -----------------------------
  // SEVERITY
  // -----------------------------

  const revengeSeverity =
    getSeverity(revengeCount, totalTrades);

  const emotionalSeverity =
    getSeverity(emotionalCount, totalTrades);

  const overtradingSeverity =
    getSeverity(
      overtradingDays.length,
      Math.max(1, tradingDays)
    );

  // -----------------------------
  // MESSAGES
  // -----------------------------

  const revengeMessage =
    revengeCount > 0
      ? `${revengeCount} trade${
          revengeCount > 1 ? "s" : ""
        } showed possible revenge behavior after a loss.`
      : "No revenge trading detected.";

  const emotionalMessage =
    emotionalCount > 0
      ? `${emotionalCount} trade${
          emotionalCount > 1 ? "s" : ""
        } contained emotional decision-making signals.`
      : "No emotional trading pattern detected.";

  const overtradingMessage =
    overtradingDays.length > 0
      ? `${overtradingDays.length} trading day${
          overtradingDays.length > 1 ? "s" : ""
        } had unusually high trade activity.`
      : "Trading frequency appears controlled.";

  // -----------------------------
  // ALERTS
  // -----------------------------

  const alerts = [];

  if (revengeCount > 0) {
    alerts.push({
      type: "revenge",
      priority: "high",
      title: "Revenge Trading",
      message:
        "Avoid entering a new trade immediately after a loss.",
    });
  }

  if (overtradingDays.length > 0) {
    alerts.push({
      type: "overtrading",
      priority: "medium",
      title: "Overtrading",
      message:
        "Consider setting a maximum number of trades per session.",
    });
  }

  if (emotionalCount > 0) {
    alerts.push({
      type: "emotion",
      priority: "medium",
      title: "Emotional Trading",
      message:
        "Record your emotional state before entering a trade.",
    });
  }

  if (planFollowingRate < 60) {
    alerts.push({
      type: "discipline",
      priority: "high",
      title: "Low Plan Adherence",
      message:
        "Focus on following your trading plan consistently.",
    });
  }

  if (riskManagementRate < 60) {
    alerts.push({
      type: "risk",
      priority: "high",
      title: "Risk Management",
      message:
        "Improve stop-loss and risk/reward consistency.",
    });
  }

  // -----------------------------
  // SUMMARY
  // -----------------------------

  let summary = "Trading behavior looks stable.";

  if (revengeCount > 0) {
    summary =
      "Revenge trading behavior detected after losing trades.";
  } else if (overtradingDays.length > 0) {
    summary =
      "Possible overtrading detected on high-volume trading days.";
  } else if (emotionalCount > 0) {
    summary =
      "Some trades show signs of emotional decision-making.";
  } else if (planFollowingRate < 60) {
    summary =
      "Plan adherence is low. Focus on following your trading plan.";
  } else if (riskManagementRate < 60) {
    summary =
      "Risk management needs improvement.";
  }

  return {
    disciplineScore,

    planFollowingRate: Number(
      planFollowingRate.toFixed(1)
    ),

    riskManagementRate: Number(
      riskManagementRate.toFixed(1)
    ),

    consistencyScore,

    tradingDays,

    averageTradesPerDay: Number(
      averageTradesPerDay.toFixed(1)
    ),

    revengeTrading: {
      detected: revengeCount > 0,
      count: revengeCount,
      severity: revengeSeverity,
      scoreImpact: revengePenalty,
      message: revengeMessage,
      recommendation:
        revengeCount > 0
          ? "Pause after losses and review your setup before taking another trade."
          : "Continue maintaining discipline after losing trades.",
    },

    overtrading: {
      detected: overtradingDays.length > 0,
      count: overtradingDays.length,
      averageTradesPerDay: Number(
        averageTradesPerDay.toFixed(1)
      ),
      threshold: Number(
        overtradingThreshold.toFixed(1)
      ),
      severity: overtradingSeverity,
      scoreImpact: overtradingPenalty,
      message: overtradingMessage,
      recommendation:
        overtradingDays.length > 0
          ? "Set a daily/session trade limit."
          : "Maintain your current trading frequency.",
    },

    emotionalTrading: {
      detected: emotionalCount > 0,
      count: emotionalCount,
      severity: emotionalSeverity,
      scoreImpact: emotionalPenalty,
      message: emotionalMessage,
      recommendation:
        emotionalCount > 0
          ? "Record your emotional state before and after each trade."
          : "Continue tracking emotions consistently.",
    },

    summary,
    alerts,
  };
}