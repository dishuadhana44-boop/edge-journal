import {
  TrendingUp,
  Target,
  Activity,
  DollarSign,
  BarChart3,
  Award,
} from "lucide-react";
import { useJournal } from "../../../context/JournalContext";
import {
  JOURNAL_PERSISTENCE_STATUS,
  describeJournalPersistence,
} from "../../../lib/journalPersistenceStatus.js";

export default function StatisticsOverview({ plan }) {

  // The journal context already parsed and normalized the stored rows, so a
  // malformed journal can never throw here. These numbers describe only the
  // rows the context could trust.
  const { trades, journalPersistence } = useJournal();

  const allTrades = Array.isArray(trades) ? trades : [];

  const persistenceView =
    describeJournalPersistence(journalPersistence);

const planTrades = allTrades.filter(
  (trade) =>
    trade?.reflection?.selectedPlanId === plan?.id
);

const totalTrades = planTrades.length;

const wins = planTrades.filter(
  (t) => t.result === "Win"
).length;

const losses = planTrades.filter(
  (t) => t.result === "Loss"
).length;

const breakeven = planTrades.filter(
  (t) =>
    t.result === "BE" ||
    t.result === "Break Even"
).length;

const winRate =
  totalTrades === 0
    ? 0
    : Math.round((wins / totalTrades) * 100);

const totalPnL = planTrades.reduce((sum, trade) => {

  const pnl = Number(
    String(trade.pnl)
      .replace(/[₹,$+ ]/g, "")
  );

  return sum + (isNaN(pnl) ? 0 : pnl);

}, 0);

const cards = [
  {
    title: "Win Rate",
    value: `${winRate}%`,
    icon: Target,
    color: "text-green-600",
  },
  {
    title: "Net P&L",
    value: `$${totalPnL.toLocaleString()}`,
    icon: DollarSign,
    color: totalPnL >= 0 ? "text-green-600" : "text-red-600",
  },
  {
    title: "Total Trades",
    value: totalTrades,
    icon: BarChart3,
    color: "text-violet-600",
  },
  {
    title: "Winning Trades",
    value: wins,
    icon: TrendingUp,
    color: "text-green-600",
  },
  {
    title: "Losing Trades",
    value: losses,
    icon: Activity,
    color: "text-red-600",
  },
  {
    title: "Break Even",
    value: breakeven,
    icon: Award,
    color: "text-yellow-600",
  },
];

  // The saved journal could not be read, so these metrics would describe an
  // unknown journal rather than an empty one. Explain instead of counting.
  if (persistenceView.status === JOURNAL_PERSISTENCE_STATUS.UNREADABLE) {
    return (
      <div
        role="status"
        className="bg-white rounded-2xl border border-amber-300 p-5"
      >

        <p className="font-semibold text-amber-900">
          {persistenceView.title}
        </p>

        <p className="text-sm text-gray-600 mt-1">
          {persistenceView.detail}
        </p>

      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">

      {cards.map((card, index) => {

        const Icon = card.icon;

        return (
          <div
            key={index}
            className="bg-white rounded-2xl border border-gray-200 p-5"
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  {card.title}
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  {card.value}
                </h2>

              </div>

              <div
                className={`h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center ${card.color}`}
              >
                <Icon size={22} />
              </div>

            </div>

          </div>
        );

      })}

    </div>
  );
}