import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";

import {
  MAX_MT5_CANDLES,
  SOURCES,
  TIMEFRAMES,
} from "../../../services/backtest/historicalData";
import { listSymbols } from "../../../services/backtest/symbolSpecs";

export default function CreateBacktestSession({
  open,
  onClose,
  onCreate,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const source = form.get("source");
    const balance = Number(form.get("balance"));
    const riskPercent = Number(form.get("riskPercent"));

    const session = {
      sessionName: form.get("name"),
      symbol: form.get("symbol"),
      balance,
      startDate: form.get("startDate") || "",
      endDate: form.get("endDate") || "",
      interval: form.get("interval"),
      source,
      count: Math.min(MAX_MT5_CANDLES, Math.max(50, Number(form.get("count")) || MAX_MT5_CANDLES)),
      settings: {
        initialBalance: balance,
        riskMode: "percent",
        riskPercent,
      },
    };

    onCreate(session);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.94,
              y: 20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: 20,
            }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
            className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Create Backtesting Session
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Configure your historical market replay.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">

                {/* SESSION NAME */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Name
                  </label>

                  <input
                    name="name"
                    required
                    placeholder="EURUSD London Strategy Test"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                {/* DATA SOURCE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Source
                  </label>

                  <select
                    name="source"
                    defaultValue={SOURCES.MT5}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white outline-none focus:border-violet-500"
                  >
                    <option value={SOURCES.MT5}>MT5 bridge — real broker history</option>
                    <option value={SOURCES.TWELVE_DATA}>Twelve Data — real history by date range</option>
                    <option value={SOURCES.IMPORT}>Import CSV — your own real candles</option>
                  </select>

                  <p className="mt-2 text-xs text-gray-500">
                    Backtesting only replays candles from the selected source. No price data is
                    generated, and orders never reach a live account.
                  </p>
                </div>

                {/* SYMBOL + TIMEFRAME */}
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instrument
                    </label>

                    <select
                      name="symbol"
                      defaultValue="EURUSD"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white outline-none focus:border-violet-500"
                    >
                      {listSymbols().map((symbol) => (
                        <option key={symbol} value={symbol}>
                          {symbol}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeframe
                    </label>

                    <select
                      name="interval"
                      defaultValue="15m"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white outline-none focus:border-violet-500"
                    >
                      {TIMEFRAMES.map((timeframe) => (
                        <option key={timeframe} value={timeframe}>
                          {timeframe}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* BALANCE + RISK */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Starting Balance
                    </label>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>

                      <input
                        name="balance"
                        type="number"
                        min="1"
                        step="0.01"
                        defaultValue="100000"
                        required
                        className="w-full rounded-xl border border-gray-200 pl-8 pr-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Per Trade (%)
                    </label>

                    <input
                      name="riskPercent"
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      defaultValue="1"
                      required
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                </div>

                {/* DATES */}
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>

                    <input
                      name="startDate"
                      type="date"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>

                    <input
                      name="endDate"
                      type="date"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                    />
                  </div>

                </div>

                {/* CANDLE COUNT */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Candles To Replay
                  </label>

                  <input
                    name="count"
                    type="number"
                    min="50"
                    max={MAX_MT5_CANDLES}
                    step="50"
                    defaultValue={MAX_MT5_CANDLES}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    The MT5 bridge serves at most {MAX_MT5_CANDLES} of the most recent candles for a
                    timeframe. Dates narrow whatever history is loaded.
                  </p>
                </div>

              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50">

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition"
                >
                  <Play size={16} />
                  Create Session
                </button>

              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}