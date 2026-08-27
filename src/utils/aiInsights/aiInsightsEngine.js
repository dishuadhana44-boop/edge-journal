import { analyzePlans } from "./planEngine";
import { analyzeSessions } from "./sessionEngine";
import { analyzePerformance } from "./performanceEngine";
import { analyzeMistakes } from "./mistakeEngine";
import { analyzeBehavior } from "./behaviorEngine";
import { analyzePsychology } from "./psychologyEngine";
import { generateRecommendations } from "./recommendationEngine";

export function generateAIInsights(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      plans: [],
      sessions: [],
      performance: {},
      mistakes: [],
      behavior: {},
      psychology: {},
      recommendations: [],
    };
  }

  const plans = analyzePlans(trades);
  const sessions = analyzeSessions(trades);
  const performance = analyzePerformance(trades);
  const mistakes = analyzeMistakes(trades);
  const behavior = analyzeBehavior(trades);
  const psychology = analyzePsychology(trades);

  const recommendations = generateRecommendations({
    trades,
    plans,
    sessions,
    performance,
    mistakes,
    behavior,
    psychology,
  });

  return {
    plans,
    sessions,
    performance,
    mistakes,
    behavior,
    psychology,
    recommendations,
  };
}