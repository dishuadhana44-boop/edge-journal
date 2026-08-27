export default function InstrumentSummary({ data = [] }) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-medium text-gray-600">
          No instrument data available
        </p>

        <p className="mt-1 text-xs text-gray-400">
          Add trades to see instrument performance.
        </p>
      </div>
    );
  }

  const bestProfit = [...data].sort(
    (a, b) =>
      Number(b?.pnl || 0) -
      Number(a?.pnl || 0)
  )[0];

  const bestWinRate = [...data].sort(
    (a, b) =>
      Number(b?.winRate || 0) -
      Number(a?.winRate || 0)
  )[0];

  const bestPF = [...data].sort(
    (a, b) =>
      Number(b?.profitFactor || 0) -
      Number(a?.profitFactor || 0)
  )[0];

  // ⭐ BEST AVERAGE RR
  const bestRR = [...data].sort(
    (a, b) =>
      Number(b?.rr || 0) -
      Number(a?.rr || 0)
  )[0];

  const formatCurrency = (value) => {
    const number = Number(value || 0);

    return `${number < 0 ? "-" : ""}$${Math.abs(
      number
    ).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  };

  const formatPF = (value) => {
    const number = Number(value || 0);

    if (!Number.isFinite(number)) {
      return "∞";
    }

    return number.toFixed(2);
  };

  const formatRR = (value) => {
    const number = Number(value || 0);

    return `${number.toFixed(2)}R`;
  };

  return (
    <div className="space-y-4">

      {/* BEST INSTRUMENT */}
      <SummaryCard
        title="🏆 Best Instrument"
        value={
          bestProfit?.instrument || "—"
        }
        sub={formatCurrency(
          bestProfit?.pnl
        )}
        color="text-green-600"
      />

      {/* HIGHEST WIN RATE */}
      <SummaryCard
        title="📈 Highest Win Rate"
        value={`${Number(
          bestWinRate?.winRate || 0
        ).toFixed(0)}%`}
        sub={
          bestWinRate?.instrument || "—"
        }
        color="text-blue-600"
      />

      {/* BEST PROFIT FACTOR */}
      <SummaryCard
        title="⭐ Best Profit Factor"
        value={formatPF(
          bestPF?.profitFactor
        )}
        sub={
          bestPF?.instrument || "—"
        }
        color="text-violet-600"
      />

      {/* BEST AVERAGE RR */}
      <SummaryCard
        title="🎯 Best Average RR"
        value={formatRR(
          bestRR?.rr
        )}
        sub={
          bestRR?.instrument || "—"
        }
        color="text-orange-500"
      />

    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  color,
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-gray-200
        bg-white
        p-5
        shadow-sm
        transition
        hover:shadow-md
      "
    >
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <h2
        className={`
          mt-3
          text-2xl
          font-bold
          ${color}
        `}
      >
        {value}
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        {sub}
      </p>
    </div>
  );
}