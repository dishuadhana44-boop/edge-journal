export default function LongShortComparison({ data = [] }) {
  const formatCurrency = (value) => {
    const number = Number(value || 0);

    return `${number < 0 ? "-" : ""}$${Math.abs(
      number
    ).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  };

  const formatPercent = (value) => {
    const number = Number(value || 0);

    return `${number.toFixed(1)}%`;
  };

  const formatRR = (value) => {
    const number = Number(value || 0);

    return `${number.toFixed(2)}R`;
  };

  const formatProfitFactor = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return number > 0 ? "∞" : "0.00";
    }

    return number.toFixed(2);
  };

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">
            No Long / Short data
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Add trades to see the comparison.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.map((item) => {
        const pnl = Number(item?.pnl || 0);
        const winRate = Number(item?.winRate || 0);

        const isLong =
          String(item?.direction).toLowerCase() ===
          "long";

        return (
          <div
            key={item.direction}
            className="
              rounded-2xl
              border
              border-gray-200
              bg-gray-50/70
              p-5
            "
          >
            {/* HEADER */}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    text-sm
                    font-bold
                    ${
                      isLong
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }
                  `}
                >
                  {isLong ? "L" : "S"}
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.direction}
                  </p>

                  <p className="text-xs text-gray-500">
                    {item.trades}{" "}
                    {item.trades === 1
                      ? "trade"
                      : "trades"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-500">
                  Net P&L
                </p>

                <p
                  className={`
                    text-lg
                    font-bold
                    ${
                      pnl > 0
                        ? "text-green-600"
                        : pnl < 0
                          ? "text-red-500"
                          : "text-gray-600"
                    }
                  `}
                >
                  {formatCurrency(pnl)}
                </p>
              </div>
            </div>

            {/* METRICS */}

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
              <Metric
                label="Trades"
                value={item.trades ?? 0}
              />

              <Metric
                label="Win Rate"
                value={formatPercent(
                  item.winRate
                )}
              />

              <Metric
                label="Average RR"
                value={formatRR(item.rr)}
              />

              <Metric
                label="Profit Factor"
                value={formatProfitFactor(
                  item.profitFactor
                )}
              />
            </div>

            {/* WIN RATE */}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Win Rate
                </span>

                <span className="text-xs font-semibold text-gray-700">
                  {formatPercent(winRate)}
                </span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`
                    h-full
                    rounded-full
                    transition-all
                    duration-500
                    ${
                      isLong
                        ? "bg-green-500"
                        : "bg-red-500"
                    }
                  `}
                  style={{
                    width: `${Math.min(
                      Math.max(winRate, 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}