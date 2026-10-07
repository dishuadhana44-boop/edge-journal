import { useNavigate } from "react-router-dom";
import {
  Calculator,
  Percent,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Clock3,
  Activity,
  Target,
  Scale,
} from "lucide-react";
import PageHeader from "../../components/common/PageHeader";

const tools = [
  {
    title: "Position Size Calculator",
    description:
      "Calculate the correct position size based on account risk, entry and stop loss.",
    icon: Calculator,
    category: "Risk Management",
    path: "/tools/position-size",
  },

  {
    title: "Trading Sessions",
    description:
      "View major global trading sessions and their overlapping market hours.",
    icon: Clock3,
    category: "Market",
    path: "/tools/trading-sessions",
  },

  {
    title: "Currency Correlation",
    description:
      "Analyze relationships between currency pairs, identify correlated exposure, and spot hedging opportunities.",
    icon: Scale,
    category: "Analysis",
    path: "/tools/currency-correlation",
  },

  {
    title: "Expectancy Calculator",
    description:
      "Calculate expected profit per trade using win rate, average win and average loss.",
    icon: Target,
    category: "Performance",
  },

  {
    title: "Risk of Ruin",
    description:
      "Estimate the probability of losing a significant portion of trading capital.",
    icon: ShieldCheck,
    category: "Risk Analysis",
  },

  {
    title: "Drawdown Calculator",
    description:
      "Measure account drawdown and determine the recovery required after losses.",
    icon: TrendingUp,
    category: "Risk Analysis",
  },

  {
    title: "Compounding Calculator",
    description:
      "Project account growth using recurring returns and additional contributions.",
    icon: TrendingUp,
    category: "Portfolio",
    path: "/tools/compounding",
  },

  {
    title: "Margin Calculator",
    description:
      "Estimate the margin required to open a leveraged trading position.",
    icon: ShieldCheck,
    category: "Risk Management",
    path: "/tools/margin",
  },

  {
    title: "Risk / Reward Calculator",
    description:
      "Measure potential reward against the amount you are risking on a trade.",
    icon: Scale,
    category: "Risk Management",
    path: "/tools/risk-reward",
  },
  {
    title: "P&L Calculator",
    description:
      "Calculate potential profit or loss from entry, exit and position size.",
    icon: DollarSign,
    category: "Trade Analysis",
    path: "/tools/pnl",
  },
  {
    title: "Pip Calculator",
    description:
      "Calculate pip distance, pip value and estimated trade impact.",
    icon: Activity,
    category: "Forex",
    path: "/tools/pip",
  },

];

export default function Tools() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b0b] px-6 py-3">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Trading Tools"
          subtitle="Professional tools for better trading decisions."
          icon="tools"
        />
      </div>

      {/* TOOLS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tools.map((tool) => {
          const Icon = tool.icon;

          return (
            <button
              key={tool.title}
              type="button"
              onClick={() => {
                if (tool.path) {
                  navigate(tool.path);
                }
              }}
              className="
                group
                text-left
                bg-white
                dark:bg-[#151515]
                border
                border-gray-200
                dark:border-gray-800
                rounded-2xl
                p-5
                transition-all
                duration-200
                hover:-translate-y-1
                hover:shadow-xl
                hover:border-purple-300
                dark:hover:border-purple-700
              "
            >
              {/* TOP */}
              <div className="flex items-start justify-between">
                <div
                  className="
                    w-11 h-11
                    rounded-xl
                    bg-purple-50
                    dark:bg-purple-900/20
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Icon
                    size={21}
                    className="text-purple-600"
                  />
                </div>

                <span
                  className="
                    text-[11px]
                    font-medium
                    px-2.5
                    py-1
                    rounded-full
                    bg-gray-100
                    dark:bg-gray-800
                    text-gray-500
                    dark:text-gray-400
                  "
                >
                  {tool.category}
                </span>
              </div>

              {/* TITLE */}
              <h2
                className="
                  mt-5
                  text-base
                  font-semibold
                  text-gray-900
                  dark:text-white
                "
              >
                {tool.title}
              </h2>

              {/* DESCRIPTION */}
              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-gray-500
                  dark:text-gray-400
                "
              >
                {tool.description}
              </p>

              {/* ACTION */}
              <div
                className={`
                  mt-5
                  text-sm
                  font-semibold
                  ${
                    tool.path
                      ? "text-purple-600"
                      : "text-gray-400 dark:text-gray-600"
                  }
                `}
              >
                {tool.path
                  ? "Open Tool →"
                  : "Coming Soon"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}