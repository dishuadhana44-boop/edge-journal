import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";

export default function CreateBacktestSession({
  open,
  onClose,
  onCreate,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const session = {
      name: form.get("name"),
      symbol: form.get("symbol"),
      balance: Number(form.get("balance")),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
      interval: form.get("interval"),
      randomize: form.get("randomize") === "on",
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
                      <option value="EURUSD">EURUSD</option>
                      <option value="GBPUSD">GBPUSD</option>
                      <option value="USDJPY">USDJPY</option>
                      <option value="GBPJPY">GBPJPY</option>
                      <option value="XAUUSD">XAUUSD</option>
                      <option value="BTCUSD">BTCUSD</option>
                      <option value="ETHUSD">ETHUSD</option>
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
                      <option value="1m">1 Minute</option>
                      <option value="5m">5 Minutes</option>
                      <option value="15m">15 Minutes</option>
                      <option value="30m">30 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="4h">4 Hours</option>
                      <option value="1day">1 Day</option>
                    </select>
                  </div>

                </div>

                {/* BALANCE */}
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

                {/* DATES */}
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>

                    <input
                      name="startDate"
                      type="date"
                      required
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
                      required
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                    />
                  </div>

                </div>

                {/* RANDOMIZE */}
                <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition">

                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      Randomize Historical Data
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                      Randomly select the starting point for practice.
                    </div>
                  </div>

                  <input
                    name="randomize"
                    type="checkbox"
                    className="h-4 w-4 accent-violet-600"
                  />

                </label>

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