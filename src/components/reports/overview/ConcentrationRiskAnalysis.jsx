import { useMemo } from "react";
import { useJournal } from "../../../context/JournalContext";

function getPnL(trade) {
  const value =
    trade?.pnl ??
    trade?.profit ??
    trade?.netPL ??
    trade?.netProfit ??
    trade?.netPnL ??
    trade?.PnL ??
    0;

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getLabel(trade, keys, fallback = "Unknown") {
  for (const key of keys) {
    const value = trade?.[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function getPercentage(value, total) {
  if (!total) return 0;
  return (value / total) * 100;
}

function formatMoney(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

function getRiskLevel(percentage) {
  if (percentage >= 60) return "High";
  if (percentage >= 40) return "Medium";
  return "Low";
}

function ConcentrationGroup({ title, items, totalPnL }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">No data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">Concentration</span>
      </div>

      <div className="space-y-3">
        {items.slice(0, 5).map((item) => {
          const percentage = Math.abs(
            getPercentage(item.pnl, totalPnL)
          );

          return (
            <div key={item.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.trades} trades · {item.winRate.toFixed(1)}% win rate
                  </p>
                </div>

                <div className="text-right ml-3">
                  <p
                    className={`text-sm font-semibold ${
                      item.pnl >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatMoney(item.pnl)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {percentage.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-900"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildGroups(trades, keys) {
  const map = {};

  trades.forEach((trade) => {
    const name = getLabel(trade, keys);
    const pnl = getPnL(trade);

    if (!map[name]) {
      map[name] = {
        name,
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
      };
    }

    map[name].trades += 1;
    map[name].pnl += pnl;

    if (pnl > 0) {
      map[name].wins += 1;
    } else if (pnl < 0) {
      map[name].losses += 1;
    }
  });

  return Object.values(map)
    .map((item) => ({
      ...item,
      winRate: item.trades
        ? (item.wins / item.trades) * 100
        : 0,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

export default function ConcentrationRiskAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const analysis = useMemo(() => {
    if (!filteredTrades.length) {
      return {
        totalPnL: 0,
        instrument: [],
        setup: [],
        session: [],
        side: [],
        highest: null,
      };
    }

    const totalPnL = filteredTrades.reduce(
      (sum, trade) => sum + getPnL(trade),
      0
    );

    const instrument = buildGroups(filteredTrades, [
      "symbol",
      "instrument",
      "ticker",
      "asset",
      "market",
    ]);

    const setup = buildGroups(filteredTrades, [
      "setup",
      "plan",
      "strategy",
      "setupName",
      "planName",
      "playbook",
    ]);

    const session = buildGroups(filteredTrades, [
      "session",
      "tradingSession",
      "marketSession",
      "sessionName",
    ]);

    const side = buildGroups(filteredTrades, [
      "side",
      "direction",
      "positionSide",
    ]);

    const categories = [
      { type: "Instrument", items: instrument },
      { type: "Setup", items: setup },
      { type: "Session", items: session },
      { type: "Side", items: side },
    ];

    let highest = null;

    categories.forEach(({ type, items }) => {
      if (!items.length) return;

      const top = items[0];
      const percentage = Math.abs(
        getPercentage(top.pnl, totalPnL)
      );

      if (!highest || percentage > highest.percentage) {
        highest = {
          type,
          name: top.name,
          pnl: top.pnl,
          percentage,
          riskLevel: getRiskLevel(percentage),
        };
      }
    });

    return {
      totalPnL,
      instrument,
      setup,
      session,
      side,
      highest,
    };
  }, [filteredTrades]);

  if (!filteredTrades.length) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">
          Concentration Risk Analysis
        </h2>
       
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Concentration Risk Analysis
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Identify whether your results depend heavily on one
              instrument, setup, session, or trade direction.
            </p>
          </div>

          {analysis.highest && (
            <div className="rounded-lg border border-gray-200 px-4 py-3 min-w-[220px]">
              <p className="text-xs text-gray-500">
                Highest concentration
              </p>

              <div className="mt-1 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {analysis.highest.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {analysis.highest.type}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    analysis.highest.riskLevel === "High"
                      ? "bg-red-50 text-red-600"
                      : analysis.highest.riskLevel === "Medium"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {analysis.highest.riskLevel}
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                {analysis.highest.percentage.toFixed(1)}% of net P&L
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ConcentrationGroup
          title="Instrument Concentration"
          items={analysis.instrument}
          totalPnL={analysis.totalPnL}
        />

        <ConcentrationGroup
          title="Setup Concentration"
          items={analysis.setup}
          totalPnL={analysis.totalPnL}
        />

        <ConcentrationGroup
          title="Session Concentration"
          items={analysis.session}
          totalPnL={analysis.totalPnL}
        />

        <ConcentrationGroup
          title="Long / Short Concentration"
          items={analysis.side}
          totalPnL={analysis.totalPnL}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Concentration Risk Interpretation
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Low</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              Below 40%
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Performance is relatively diversified.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Medium</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              40% – 60%
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Results have noticeable dependency.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">High</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              Above 60%
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Results are heavily dependent on one category.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}