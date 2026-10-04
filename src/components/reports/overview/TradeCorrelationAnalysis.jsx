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

function getValue(trade, keys, fallback = "Unknown") {
  for (const key of keys) {
    const value = trade?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return fallback;
}

function getCorrelation(valuesA, valuesB) {
  if (valuesA.length < 2 || valuesB.length < 2) return 0;

  const meanA =
    valuesA.reduce((sum, value) => sum + value, 0) /
    valuesA.length;

  const meanB =
    valuesB.reduce((sum, value) => sum + value, 0) /
    valuesB.length;

  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;

  for (let i = 0; i < valuesA.length; i++) {
    const diffA = valuesA[i] - meanA;
    const diffB = valuesB[i] - meanB;

    numerator += diffA * diffB;
    denominatorA += diffA * diffA;
    denominatorB += diffB * diffB;
  }

  if (!denominatorA || !denominatorB) return 0;

  return (
    numerator /
    Math.sqrt(denominatorA * denominatorB)
  );
}

function correlationLabel(value) {
  const absolute = Math.abs(value);

  if (absolute >= 0.8) return "Very Strong";
  if (absolute >= 0.6) return "Strong";
  if (absolute >= 0.4) return "Moderate";
  if (absolute >= 0.2) return "Weak";

  return "Very Weak";
}

function formatCorrelation(value) {
  return value.toFixed(2);
}

export default function TradeCorrelationAnalysis() {
  const { filteredTrades = [] } = useJournal();

  const analysis = useMemo(() => {
    const groups = {};

    filteredTrades.forEach((trade) => {
      const symbol = getValue(trade, [
        "symbol",
        "instrument",
        "ticker",
        "asset",
        "market",
      ]);

      const side = getValue(trade, [
        "side",
        "direction",
        "positionSide",
      ]);

      const setup = getValue(trade, [
        "setup",
        "plan",
        "strategy",
        "setupName",
        "planName",
        "playbook",
      ]);

      const session = getValue(trade, [
        "session",
        "tradingSession",
        "marketSession",
        "sessionName",
      ]);

      const pnl = getPnL(trade);

      if (!groups[symbol]) {
        groups[symbol] = {
          name: symbol,
          values: [],
          long: [],
          short: [],
          pnl: 0,
          trades: 0,
        };
      }

      groups[symbol].values.push(pnl);
      groups[symbol].pnl += pnl;
      groups[symbol].trades += 1;

      if (side.toLowerCase() === "long" || side.toLowerCase() === "buy") {
        groups[symbol].long.push(pnl);
      }

      if (
        side.toLowerCase() === "short" ||
        side.toLowerCase() === "sell"
      ) {
        groups[symbol].short.push(pnl);
      }

      if (!groups[setup]) {
        groups[setup] = {
          name: setup,
          values: [],
          long: [],
          short: [],
          pnl: 0,
          trades: 0,
        };
      }

      groups[setup].values.push(pnl);
      groups[setup].pnl += pnl;
      groups[setup].trades += 1;

      if (!groups[session]) {
        groups[session] = {
          name: session,
          values: [],
          long: [],
          short: [],
          pnl: 0,
          trades: 0,
        };
      }

      groups[session].values.push(pnl);
      groups[session].pnl += pnl;
      groups[session].trades += 1;
    });

    const symbols = [
      ...new Set(
        filteredTrades.map((trade) =>
          getValue(trade, [
            "symbol",
            "instrument",
            "ticker",
            "asset",
            "market",
          ])
        )
      ),
    ];

    const correlations = [];

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbolA = symbols[i];
        const symbolB = symbols[j];

        const tradesA = filteredTrades.filter(
          (trade) =>
            getValue(trade, [
              "symbol",
              "instrument",
              "ticker",
              "asset",
              "market",
            ]) === symbolA
        );

        const tradesB = filteredTrades.filter(
          (trade) =>
            getValue(trade, [
              "symbol",
              "instrument",
              "ticker",
              "asset",
              "market",
            ]) === symbolB
        );

        const length = Math.min(
          tradesA.length,
          tradesB.length
        );

        if (length < 2) continue;

        const valuesA = tradesA
          .slice(0, length)
          .map(getPnL);

        const valuesB = tradesB
          .slice(0, length)
          .map(getPnL);

        const correlation = getCorrelation(
          valuesA,
          valuesB
        );

        correlations.push({
          pair: `${symbolA} / ${symbolB}`,
          value: correlation,
          strength: correlationLabel(correlation),
        });
      }
    }

    correlations.sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value)
    );

    return {
      correlations: correlations.slice(0, 8),
      instruments: Object.values(groups)
        .filter((item) => item.name !== "Unknown")
        .sort((a, b) => b.trades - a.trades)
        .slice(0, 8),
    };
  }, [filteredTrades]);

  if (!filteredTrades.length) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">
          Trade Correlation Analysis
        </h2>

        
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Trade Correlation Analysis
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Analyze how trading results move together across
            different instruments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Instrument Correlations
            </h3>

            <span className="text-xs text-gray-500">
              P&L relationship
            </span>
          </div>

          {analysis.correlations.length === 0 ? (
            <p className="text-sm text-gray-500">
              Not enough overlapping instrument data.
            </p>
          ) : (
            <div className="space-y-3">
              {analysis.correlations.map((item) => (
                <div
                  key={item.pair}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {item.pair}
                    </p>

                    <p className="text-xs text-gray-500">
                      {item.strength} correlation
                    </p>
                  </div>

                  <span
                    className={`text-sm font-semibold ${
                      item.value >= 0
                        ? "text-blue-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCorrelation(item.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Instrument Exposure
            </h3>

            <span className="text-xs text-gray-500">
              Trade concentration
            </span>
          </div>

          <div className="space-y-3">
            {analysis.instruments.map((item) => {
              const percentage =
                (item.trades / filteredTrades.length) * 100;

              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {item.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {item.trades} trades
                      </p>
                    </div>

                    <span className="text-xs font-medium text-gray-600">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{
                        width: `${Math.min(
                          percentage,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Correlation Interpretation
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ["Very Weak", "< 0.20", "Little measurable relationship."],
            ["Weak", "0.20 – 0.40", "Limited relationship."],
            ["Moderate", "0.40 – 0.60", "Meaningful relationship."],
            ["Strong", "> 0.60", "Results may move together."],
          ].map(([title, range, description]) => (
            <div
              key={title}
              className="rounded-lg bg-gray-50 p-3"
            >
              <p className="text-xs text-gray-500">
                {title}
              </p>

              <p className="mt-1 text-sm font-medium text-gray-800">
                {range}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}