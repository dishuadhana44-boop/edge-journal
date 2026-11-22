import {
    TrendingUp,
    Target,
    DollarSign,
    Activity,
  } from "lucide-react";
import { useJournal } from "../../../context/JournalContext";
import {
  JOURNAL_PERSISTENCE_STATUS,
  describeJournalPersistence,
} from "../../../lib/journalPersistenceStatus.js";
  

  
  export default function PerformanceTable({ plan }) {

    // Read the journal through the context, which already parsed and
    // normalized the trusted rows, so a malformed journal cannot throw here.
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
  );
  
  const losses = planTrades.filter(
    (t) => t.result === "Loss"
  );
  
  const beTrades = planTrades.filter(
    (t) =>
      t.result === "BE" ||
      t.result === "Break Even"
  );
  
  const totalWin = wins.reduce((sum, t) => {
  
    const pnl = Number(
      String(t.pnl).replace(/[₹,$+ ]/g, "")
    );
  
    return sum + (isNaN(pnl) ? 0 : pnl);
  
  }, 0);
  
  const totalLoss = losses.reduce((sum, t) => {
  
    const pnl = Number(
      String(t.pnl).replace(/[₹,$+ ]/g, "")
    );
  
    return sum + Math.abs(isNaN(pnl) ? 0 : pnl);
  
  }, 0);
  
  const netProfit = totalWin - totalLoss;
  
  const profitFactor =
    totalLoss === 0
      ? "∞"
      : (totalWin / totalLoss).toFixed(2);
  
  const expectancy =
    totalTrades === 0
      ? 0
      : (netProfit / totalTrades).toFixed(2);
  
  const averageRR =
    totalTrades === 0
      ? 0
      : (
          planTrades.reduce((sum, t) => {
  
            const rr = Number(
              String(t.rr).replace(/[^\d.]/g, "")
            );
  
            return sum + (isNaN(rr) ? 0 : rr);
  
          }, 0) / totalTrades
        ).toFixed(2);
  
  const averageWin =
    wins.length === 0
      ? 0
      : (totalWin / wins.length).toFixed(0);
  
  const averageLoss =
    losses.length === 0
      ? 0
      : (totalLoss / losses.length).toFixed(0);
  
  const maxWin =
    wins.length === 0
      ? 0
      : Math.max(
          ...wins.map((t) =>
            Number(
              String(t.pnl).replace(/[₹,$+ ]/g, "")
            )
          )
        );
  
  const maxLoss =
    losses.length === 0
      ? 0
      : Math.min(
          ...losses.map((t) =>
            Number(
              String(t.pnl).replace(/[₹,$+ ]/g, "")
            )
          )
        );
  
  const winRate =
    totalTrades === 0
      ? 0
      : ((wins.length / totalTrades) * 100).toFixed(1);

      const sections = [

        {
          title: "Performance",
          rows: [
            ["Net Profit", `$${netProfit.toLocaleString()}`],
            ["Gross Profit", `₹${totalWin.toLocaleString()}`],
            ["Gross Loss", `$${totalLoss.toLocaleString()}`],
            ["Profit Factor", profitFactor],
            ["Expectancy", `$${expectancy}`],
          ],
        },
      
        {
          title: "Trades",
          rows: [
            ["Total Trades", totalTrades],
            ["Winning Trades", wins.length],
            ["Losing Trades", losses.length],
            ["Break Even", beTrades.length],
            ["Win Rate", `${winRate}%`],
            ["Average RR", `${averageRR}R`],
          ],
        },
      
        {
          title: "Risk",
          rows: [
            ["Average Win", `$${averageWin}`],
            ["Average Loss", `₹${averageLoss}`],
            ["Largest Win", `$${maxWin}`],
            ["Largest Loss", `₹${maxLoss}`],
            ["Max Drawdown", "Coming Soon"],
          ],
        },
      
      ];

    // An unreadable saved journal has unknown contents, not empty ones, so
    // explaining it beats printing zeros as if they were measured.
    if (persistenceView.status === JOURNAL_PERSISTENCE_STATUS.UNREADABLE) {
      return (
        <div className="bg-white rounded-2xl border border-amber-300 shadow-sm p-6">
  
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
  
        {/* Header */}
  
        <div className="flex items-center gap-3 p-6 border-b">
  
          <TrendingUp
            size={22}
            className="text-violet-600"
          />
  
          <div>
  
            <h2 className="text-xl font-bold">
              Performance Table
            </h2>
  
           
  
          </div>
  
        </div>
  
        <div className="p-6 space-y-8">
  
          {sections.map((section) => (
  
            <div key={section.title}>
  
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                {section.title}
              </h3>
  
              <div className="space-y-2">
  
                {section.rows.map(([label, value]) => (
  
                  <div
                    key={label}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none"
                  >
  
                    <span className="text-gray-600">
                      {label}
                    </span>
  
                    <span className="font-semibold text-gray-900">
                      {value}
                    </span>
  
                  </div>
  
                ))}
  
              </div>
  
            </div>
  
          ))}
  
        </div>
  
      </div>
    );
  }