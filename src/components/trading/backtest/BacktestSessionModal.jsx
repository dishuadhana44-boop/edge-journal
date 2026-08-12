// src/components/trading/backtest/BacktestSessionModal.jsx
// Animated modal shown when starting a new backtest session.
// Collects: session name, symbol, starting balance, date range, risk per trade.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const DEFAULT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "USDCHF", "AUDUSD"];

export default function BacktestSessionModal({ isOpen, onCreate }) {
  const [sessionName, setSessionName] = useState("");
  const [symbol, setSymbol] = useState("EURUSD");
  const [balance, setBalance] = useState(100000);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [riskPerTrade, setRiskPerTrade] = useState(1);

  const canCreate = sessionName.trim() && symbol.trim() && balance > 0 && startDate && endDate;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate({
      sessionName: sessionName.trim(),
      symbol: symbol.trim().toUpperCase(),
      balance: Number(balance),
      startDate,
      endDate,
      riskPerTrade: Number(riskPerTrade),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
            className="w-200 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-black">New Backtest Session</h2>
            </div>
           
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. EURUSD Breakout Test #1"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Symbol
                  </label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-purple-600"
                  >
                    {DEFAULT_SYMBOLS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Starting Balance
                  </label>
                  <input
                    type="number"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    min={0}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Risk per Trade (%)
                </label>
                <input
                  type="number"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(e.target.value)}
                  min={0}
                  step={0.1}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="w-full mt-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg shadow-[0_0_14px_rgba(147,51,234,0.35)] transition-colors"
            >
              Create Session
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}