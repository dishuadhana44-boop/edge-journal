// src/utils/aiInsights/psychologyEngine.js

export function analyzePsychology(trades = []) {
  // =====================================================
  // EMPTY STATE
  // =====================================================

  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      score: 0,

      grade: "—",

      trend: "insufficient-data",

      confidence: 0,

      sampleSize: 0,

      emotionalTrades: 0,
      revengeTrades: 0,
      impulsiveTrades: 0,
      disciplinedTrades: 0,

      emotionalRate: 0,
      revengeRate: 0,
      impulsiveRate: 0,
      disciplineRate: 0,

      emotionBreakdown: [],

      bestMentalState: null,

      worstMentalState: null,

      emotionalStreak: {
        state: null,
        count: 0,
      },

      riskFlags: [],

      insights: [
        "Not enough trade data to analyze psychology.",
      ],

      recommendations: [
        "Continue journaling your emotions before and after every trade.",
      ],

      verdict:
        "More trading data is required before making a reliable psychological assessment.",
    };
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const getPnL = (trade) => {
    const value = String(
      trade?.pnl ??
        trade?.profit ??
        trade?.netPnL ??
        0
    )
      .replace(/[₹,$+ ]/g, "")
      .replace(/,/g, "");

    return Number(value) || 0;
  };

  const getText = (trade) => {
    return String(
      [
        trade?.emotion,
        trade?.mood,
        trade?.entryEmotion,
        trade?.exitEmotion,
        trade?.reason,
        trade?.notes,

        trade?.reflection?.emotion,
        trade?.reflection?.mood,
        trade?.reflection?.entryEmotion,
        trade?.reflection?.exitEmotion,
        trade?.reflection?.notes,

        trade?.psychology,
        trade?.mentalState,
      ]
        .filter(Boolean)
        .join(" ")
    ).toLowerCase();
  };

  const getEmotion = (trade) => {
    const text = getText(trade);

    if (
      text.includes("fomo") ||
      text.includes("chasing") ||
      text.includes("chased")
    ) {
      return "FOMO";
    }

    if (
      text.includes("fear") ||
      text.includes("fearful") ||
      text.includes("anxiety") ||
      text.includes("anxious") ||
      text.includes("panic")
    ) {
      return "Fear";
    }

    if (
      text.includes("greed") ||
      text.includes("greedy")
    ) {
      return "Greed";
    }

    if (
      text.includes("angry") ||
      text.includes("anger") ||
      text.includes("frustrated") ||
      text.includes("frustration")
    ) {
      return "Frustration";
    }

    if (
      text.includes("confident") ||
      text.includes("confidence")
    ) {
      return "Confident";
    }

    if (
      text.includes("calm") ||
      text.includes("focused") ||
      text.includes("patient")
    ) {
      return "Calm";
    }

    if (
      text.includes("impulsive") ||
      text.includes("impulse")
    ) {
      return "Impulsive";
    }

    return "Neutral";
  };

  const followedPlan = (trade) => {
    return (
      trade?.followedPlan === true ||
      trade?.followedPlan === "true" ||
      trade?.followedPlan === "yes" ||
      trade?.reflection?.followedPlan === true ||
      trade?.reflection?.followedPlan === "true" ||
      trade?.reflection?.followedPlan === "yes"
    );
  };

  // =====================================================
  // SORT TRADES
  // =====================================================

  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = new Date(
      a?.date ||
        a?.createdAt ||
        a?.timestamp ||
        0
    ).getTime();

    const dateB = new Date(
      b?.date ||
        b?.createdAt ||
        b?.timestamp ||
        0
    ).getTime();

    return dateA - dateB;
  });

  const totalTrades = sortedTrades.length;

  // =====================================================
  // BASIC COUNTS
  // =====================================================

  let emotionalTrades = 0;
  let revengeTrades = 0;
  let impulsiveTrades = 0;
  let disciplinedTrades = 0;

  sortedTrades.forEach((trade, index) => {
    const text = getText(trade);

    // Emotional
    const emotional =
      text.includes("fear") ||
      text.includes("greed") ||
      text.includes("angry") ||
      text.includes("anger") ||
      text.includes("fomo") ||
      text.includes("anxiety") ||
      text.includes("stress") ||
      text.includes("frustrated") ||
      text.includes("panic");

    if (emotional) {
      emotionalTrades++;
    }

    // Revenge
    if (
      text.includes("revenge") ||
      text.includes("recover loss") ||
      text.includes("recover losses")
    ) {
      revengeTrades++;
    }

    // Impulsive
    if (
      text.includes("impulsive") ||
      text.includes("impulse") ||
      text.includes("chased") ||
      text.includes("chasing") ||
      text.includes("fomo")
    ) {
      impulsiveTrades++;
    }

    // Discipline
    if (followedPlan(trade)) {
      disciplinedTrades++;
    }

    // Additional revenge detection:
    // loss followed by emotional/revenge language
    if (index > 0) {
      const previousPnL = getPnL(
        sortedTrades[index - 1]
      );

      if (
        previousPnL < 0 &&
        (
          text.includes("revenge") ||
          text.includes("fomo") ||
          text.includes("angry") ||
          text.includes("frustrated") ||
          text.includes("recover loss")
        )
      ) {
        if (
          !text.includes("revenge") &&
          !text.includes("recover loss")
        ) {
          revengeTrades++;
        }
      }
    }
  });

  // =====================================================
  // RATES
  // =====================================================

  const emotionalRate =
    (emotionalTrades / totalTrades) * 100;

  const revengeRate =
    (revengeTrades / totalTrades) * 100;

  const impulsiveRate =
    (impulsiveTrades / totalTrades) * 100;

  const disciplineRate =
    (disciplinedTrades / totalTrades) * 100;

  // =====================================================
  // EMOTION BREAKDOWN
  // =====================================================

  const emotionMap = {};

  sortedTrades.forEach((trade) => {
    const emotion = getEmotion(trade);
    const pnl = getPnL(trade);

    if (!emotionMap[emotion]) {
      emotionMap[emotion] = {
        emotion,
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
      };
    }

    emotionMap[emotion].trades++;
    emotionMap[emotion].pnl += pnl;

    if (pnl > 0) {
      emotionMap[emotion].wins++;
    } else if (pnl < 0) {
      emotionMap[emotion].losses++;
    }
  });

  const emotionBreakdown = Object.values(
    emotionMap
  )
    .map((item) => ({
      ...item,

      pnl: Number(item.pnl.toFixed(2)),

      winRate:
        item.trades > 0
          ? Number(
              (
                (item.wins / item.trades) *
                100
              ).toFixed(1)
            )
          : 0,

      averagePnL:
        item.trades > 0
          ? Number(
              (
                item.pnl / item.trades
              ).toFixed(2)
            )
          : 0,
    }))
    .sort((a, b) => b.trades - a.trades);

  // =====================================================
  // BEST / WORST MENTAL STATE
  // =====================================================

  const statesWithEnoughData =
    emotionBreakdown.filter(
      (item) => item.trades >= 1
    );

  let bestMentalState = null;
  let worstMentalState = null;

  if (statesWithEnoughData.length > 0) {
    bestMentalState = [...statesWithEnoughData]
      .sort(
        (a, b) =>
          b.averagePnL - a.averagePnL
      )[0];

    worstMentalState = [...statesWithEnoughData]
      .sort(
        (a, b) =>
          a.averagePnL - b.averagePnL
      )[0];
  }

  // =====================================================
  // EMOTIONAL STREAK
  // =====================================================

  let emotionalStreak = {
    state: null,
    count: 0,
  };

  if (sortedTrades.length > 0) {
    const lastEmotion =
      getEmotion(
        sortedTrades[
          sortedTrades.length - 1
        ]
      );

    let count = 0;

    for (
      let i = sortedTrades.length - 1;
      i >= 0;
      i--
    ) {
      const emotion = getEmotion(
        sortedTrades[i]
      );

      if (emotion === lastEmotion) {
        count++;
      } else {
        break;
      }
    }

    emotionalStreak = {
      state: lastEmotion,
      count,
    };
  }

  // =====================================================
  // SCORE
  // =====================================================

  let score =
    100 -

    emotionalRate * 0.20 -

    revengeRate * 0.35 -

    impulsiveRate * 0.20 +

    disciplineRate * 0.15;

  // Strong positive mental states
  const calmTrades =
    emotionMap.Calm?.trades || 0;

  const confidentTrades =
    emotionMap.Confident?.trades || 0;

  if (
    totalTrades > 0 &&
    (calmTrades + confidentTrades) /
      totalTrades >= 0.5
  ) {
    score += 5;
  }

  score = Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );

  // =====================================================
  // GRADE
  // =====================================================

  let grade = "F";

  if (score >= 90) grade = "A+";
  else if (score >= 80) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 50) grade = "D";

  // =====================================================
  // TREND
  // =====================================================

  let trend = "stable";

  if (totalTrades >= 6) {
    const midpoint = Math.floor(
      totalTrades / 2
    );

    const firstHalf =
      sortedTrades.slice(
        0,
        midpoint
      );

    const secondHalf =
      sortedTrades.slice(midpoint);

    const emotionalRateFirst =
      firstHalf.filter((trade) => {
        const emotion = getEmotion(trade);

        return [
          "Fear",
          "FOMO",
          "Greed",
          "Frustration",
          "Impulsive",
        ].includes(emotion);
      }).length /
      Math.max(1, firstHalf.length);

    const emotionalRateSecond =
      secondHalf.filter((trade) => {
        const emotion = getEmotion(trade);

        return [
          "Fear",
          "FOMO",
          "Greed",
          "Frustration",
          "Impulsive",
        ].includes(emotion);
      }).length /
      Math.max(1, secondHalf.length);

    if (
      emotionalRateSecond <
      emotionalRateFirst - 0.15
    ) {
      trend = "improving";
    } else if (
      emotionalRateSecond >
      emotionalRateFirst + 0.15
    ) {
      trend = "declining";
    }
  }

  // =====================================================
  // CONFIDENCE
  // =====================================================

  let confidence = Math.min(
    100,
    Math.round(
      (totalTrades / 30) * 100
    )
  );

  // Minimum confidence for tiny sample
  if (totalTrades < 3) {
    confidence = Math.min(
      confidence,
      25
    );
  }

  // =====================================================
  // RISK FLAGS
  // =====================================================

  const riskFlags = [];

  if (revengeRate >= 20) {
    riskFlags.push({
      type: "revenge",
      severity: "high",
      title: "Revenge Trading",
      message:
        "Losses may be influencing subsequent trade decisions.",
    });
  }

  if (impulsiveRate >= 20) {
    riskFlags.push({
      type: "impulsive",
      severity: "high",
      title: "Impulsive Decisions",
      message:
        "A noticeable portion of trades show impulsive decision-making.",
    });
  }

  if (emotionalRate >= 25) {
    riskFlags.push({
      type: "emotion",
      severity: "medium",
      title: "Emotional Trading",
      message:
        "Emotional states appear frequently in your trade records.",
    });
  }

  if (disciplineRate < 60) {
    riskFlags.push({
      type: "discipline",
      severity: "medium",
      title: "Low Plan Discipline",
      message:
        "Trade execution is not consistently aligned with the recorded plan.",
    });
  }

  if (
    worstMentalState &&
    worstMentalState.averagePnL < 0
  ) {
    riskFlags.push({
      type: "mental-state",
      severity: "medium",
      title:
        `${worstMentalState.emotion} Performance`,
      message:
        `${worstMentalState.emotion} trades have produced negative average P&L.`,
    });
  }

  // =====================================================
  // INSIGHTS
  // =====================================================

  const insights = [];

  if (
    bestMentalState &&
    bestMentalState.averagePnL > 0
  ) {
    insights.push(
      `Your strongest recorded mental state is ${bestMentalState.emotion}, with an average P&L of ${bestMentalState.averagePnL}.`
    );
  }

  if (
    worstMentalState &&
    worstMentalState.averagePnL < 0
  ) {
    insights.push(
      `${worstMentalState.emotion} is currently your weakest mental state based on average P&L.`
    );
  }

  if (disciplineRate >= 80) {
    insights.push(
      "Strong plan-following behavior is visible in your journal."
    );
  }

  if (emotionalRate < 15) {
    insights.push(
      "Most recorded trades do not show strong emotional decision-making signals."
    );
  }

  if (trend === "improving") {
    insights.push(
      "Your emotional behavior appears to be improving across the recent sample."
    );
  }

  if (trend === "declining") {
    insights.push(
      "Recent trades show more emotional pressure than earlier trades."
    );
  }

  if (insights.length === 0) {
    insights.push(
      "No major psychological pattern has been identified yet."
    );
  }

  // =====================================================
  // RECOMMENDATIONS
  // =====================================================

  const recommendations = [];

  if (revengeRate >= 20) {
    recommendations.push(
      "After a losing trade, pause and wait for your next valid setup instead of trying to recover the loss immediately."
    );
  }

  if (impulsiveRate >= 20) {
    recommendations.push(
      "Use a pre-trade checklist and confirm your setup before entering."
    );
  }

  if (emotionalRate >= 25) {
    recommendations.push(
      "Record your emotional state before entering and immediately after exiting each trade."
    );
  }

  if (disciplineRate < 60) {
    recommendations.push(
      "Review your trading plan before every entry and mark whether the setup satisfies your rules."
    );
  }

  if (
    worstMentalState &&
    worstMentalState.averagePnL < 0
  ) {
    recommendations.push(
      `Review your ${worstMentalState.emotion} trades separately and identify what changed in your decision-making.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue tracking emotions consistently so stronger psychological patterns can be identified."
    );
  }

  // =====================================================
  // VERDICT
  // =====================================================

  let verdict =
    "Your current psychological profile appears stable.";

  if (score >= 80) {
    verdict =
      "Your psychological discipline is currently strong. Continue protecting the mental process that supports your best trades.";
  } else if (score >= 65) {
    verdict =
      "Your psychology is developing well, but some behavioral patterns still have room for improvement.";
  } else if (score >= 50) {
    verdict =
      "Your trading psychology shows several areas that could negatively affect decision quality.";
  } else {
    verdict =
      "Your current psychological patterns indicate that emotional discipline should become a major focus.";
  }

  // =====================================================
  // SMALL SAMPLE WARNING
  // =====================================================

  if (totalTrades < 5) {
    verdict =
      "The current sample is small. Early psychological signals are visible, but more trades are needed before drawing strong conclusions.";

    insights.unshift(
      "Small sample size: psychological conclusions should be treated as preliminary."
    );
  }

  // =====================================================
  // RETURN
  // =====================================================

  return {
    score,

    grade,

    trend,

    confidence,

    sampleSize: totalTrades,

    emotionalTrades,
    revengeTrades,
    impulsiveTrades,
    disciplinedTrades,

    emotionalRate: Number(
      emotionalRate.toFixed(1)
    ),

    revengeRate: Number(
      revengeRate.toFixed(1)
    ),

    impulsiveRate: Number(
      impulsiveRate.toFixed(1)
    ),

    disciplineRate: Number(
      disciplineRate.toFixed(1)
    ),

    emotionBreakdown,

    bestMentalState,

    worstMentalState,

    emotionalStreak,

    riskFlags,

    insights,

    recommendations,

    verdict,
  };
}