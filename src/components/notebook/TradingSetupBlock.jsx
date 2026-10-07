import { useMemo, useState } from "react";

export default function TradingSetupBlock({
  onInsert,
}) {
  const [setup, setSetup] = useState("");
  const [bias, setBias] = useState("Bullish");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] =
    useState("");
  const [risk, setRisk] = useState("");

  const rewardRisk = useMemo(() => {
    const entryPrice = Number(entry);
    const slPrice = Number(stopLoss);
    const tpPrice = Number(takeProfit);

    if (
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(slPrice) ||
      !Number.isFinite(tpPrice) ||
      entryPrice <= 0
    ) {
      return null;
    }

    const riskAmount = Math.abs(
      entryPrice - slPrice
    );

    const rewardAmount = Math.abs(
      tpPrice - entryPrice
    );

    if (riskAmount <= 0) {
      return null;
    }

    return (
      rewardAmount / riskAmount
    ).toFixed(2);
  }, [entry, stopLoss, takeProfit]);

  const handleInsert = () => {
    const block = {
      type: "trading-setup",
      setup,
      bias,
      entry,
      stopLoss,
      takeProfit,
      risk,
      rewardRisk,
      createdAt:
        new Date().toISOString(),
    };

    onInsert?.(block);
  };

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-gray-900">
          Trading Setup
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Add a structured trade setup to your note.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* SETUP */}

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Setup
          </label>

          <input
            value={setup}
            onChange={(event) =>
              setSetup(event.target.value)
            }
            placeholder="Example: London Breakout"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {/* BIAS */}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Market Bias
          </label>

          <select
            value={bias}
            onChange={(event) =>
              setBias(event.target.value)
            }
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          >
            <option>Bullish</option>
            <option>Bearish</option>
            <option>Neutral</option>
          </select>
        </div>

        {/* RISK */}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Risk %
          </label>

          <input
            type="number"
            min="0"
            step="0.1"
            value={risk}
            onChange={(event) =>
              setRisk(event.target.value)
            }
            placeholder="1"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {/* ENTRY */}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Entry
          </label>

          <input
            type="number"
            step="any"
            value={entry}
            onChange={(event) =>
              setEntry(event.target.value)
            }
            placeholder="1.15350"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {/* STOP LOSS */}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Stop Loss
          </label>

          <input
            type="number"
            step="any"
            value={stopLoss}
            onChange={(event) =>
              setStopLoss(event.target.value)
            }
            placeholder="1.15000"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {/* TAKE PROFIT */}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Take Profit
          </label>

          <input
            type="number"
            step="any"
            value={takeProfit}
            onChange={(event) =>
              setTakeProfit(event.target.value)
            }
            placeholder="1.16000"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {/* R:R */}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Risk / Reward
          </label>

          <div className="flex h-[42px] items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-purple-600">
            {rewardRisk
              ? `1 : ${rewardRisk}`
              : "Enter Entry / SL / TP"}
          </div>
        </div>
      </div>

      {/* INSERT */}

      <button
        type="button"
        onClick={handleInsert}
        className="mt-5 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
      >
        Insert Trading Setup
      </button>
    </div>
  );
}