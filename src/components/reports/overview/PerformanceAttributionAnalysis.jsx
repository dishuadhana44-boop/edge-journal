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

function getLabel(trade, keys) {
  for (const key of keys) {
    const value = trade?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return "Unknown";
}

function getGroupStats(trades, keys) {
  const groups = {};

  trades.forEach((trade) => {
    const name = getLabel(trade, keys);
    const pnl = getPnL(trade);

    if (!groups[name]) {
      groups[name] = {
        name,
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
      };
    }

    groups[name].trades += 1;
    groups[name].pnl += pnl;

    if (pnl > 0) groups[name].wins += 1;
    if (pnl < 0) groups[name].losses += 1;
  });

  return Object.values(groups)
    .map((item) => ({
      ...item,
      winRate: item.trades
        ? (item.wins / item.trades) * 100
        : 0,
      avgPnL: item.trades
        ? item.pnl / item.trades
        : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

function formatMoney(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

function AttributionCard({ title, data }) {
  const best = data[0];
  const worst = data[data.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {title}
        </h3>

        <span className="text-xs text-gray-500">
          Performance attribution
        </span>
      </div>

      {!data.length ? (
        <p className="text-sm text-gray-500">
          No data available.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-gray-500">
                Best contributor
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {best.name}
              </p>

              <p className="mt-1 text-xs text-emerald-600">
                {formatMoney(best.pnl)}
              </p>
            </div>

            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs text-gray-500">
                Weakest contributor
              </p>

              <p className="mt-1 text-sm font-semibold text-red-700">
                {worst.name}
              </p>

              <p className="mt-1 text-xs text-red-600">
                {formatMoney(worst.pnl)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.slice(0, 6).map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {item.name}
                    </p>

                    <p className="text-xs text-gray-500">
                      {item.trades} trades ·{" "}
                      {item.winRate.toFixed(1)}% win rate
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        item.pnl >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatMoney(item.pnl)}
                    </p>

                    <p className="text-xs text-gray-500">
                      Avg {formatMoney(item.avgPnL)}
                    </p>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.pnl >= 0
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        Math.abs(item.pnl) /
                          Math.max(
                            ...data.map((x) =>
                              Math.abs(x.pnl)
                            )
                          ) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PerformanceAttributionAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const analysis = useMemo(() => {
    const totalPnL = filteredTrades.reduce(
      (sum, trade) => sum + getPnL(trade),
      0
    );

    const byInstrument = getGroupStats(filteredTrades, [
      "symbol",
      "instrument",
      "ticker",
      "asset",
      "market",
    ]);

    const bySetup = getGroupStats(filteredTrades, [
      "setup",
      "plan",
      "strategy",
      "setupName",
      "planName",
      "playbook",
    ]);

    const bySession = getGroupStats(filteredTrades, [
      "session",
      "tradingSession",
      "marketSession",
      "sessionName",
    ]);

    const bySide = getGroupStats(filteredTrades, [
      "side",
      "direction",
      "positionSide",
    ]);

    const positiveContribution = filteredTrades
      .filter((trade) => getPnL(trade) > 0)
      .reduce((sum, trade) => sum + getPnL(trade), 0);

    const negativeContribution = filteredTrades
      .filter((trade) => getPnL(trade) < 0)
      .reduce((sum, trade) => sum + getPnL(trade), 0);

    return {
      totalPnL,
      positiveContribution,
      negativeContribution,
      byInstrument,
      bySetup,
      bySession,
      bySide,
    };
  }, [filteredTrades]);

  if (!filteredTrades.length) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">
          Performance Attribution Analysis
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
              Performance Attribution Analysis
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Identify which parts of your trading process are
              contributing most to your overall P&L.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500">
                Net P&L
              </p>

              <p
                className={`text-sm font-semibold ${
                  analysis.totalPnL >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {formatMoney(analysis.totalPnL)}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                Gross Profit
              </p>

              <p className="text-sm font-semibold text-emerald-600">
                {formatMoney(
                  analysis.positiveContribution
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                Gross Loss
              </p>

              <p className="text-sm font-semibold text-red-600">
                {formatMoney(
                  analysis.negativeContribution
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttributionCard
          title="By Instrument"
          data={analysis.byInstrument}
        />

        <AttributionCard
          title="By Setup"
          data={analysis.bySetup}
        />

        <AttributionCard
          title="By Session"
          data={analysis.bySession}
        />

        <AttributionCard
          title="By Direction"
          data={analysis.bySide}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Attribution Insight
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Total Trades
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {filteredTrades.length}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Profit Contribution
            </p>

            <p className="mt-1 text-lg font-semibold text-emerald-600">
              {formatMoney(
                analysis.positiveContribution
              )}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Loss Contribution
            </p>

            <p className="mt-1 text-lg font-semibold text-red-600">
              {formatMoney(
                analysis.negativeContribution
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}