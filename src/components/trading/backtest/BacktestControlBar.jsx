// src/components/trading/backtest/BacktestControlBar.jsx
// Top bar: symbol / interval / date range / load button only.
// Playback controls now live in the chart's own bottom Replay bar.

import React from "react";

const INTERVALS = ["1m", "15m", "30m", "1h", "4h", "1d"];

export default function BacktestControlBar({
  symbol,
  setSymbol,
  interval,
  setInterval: setIntervalValue,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onLoadData,
  isLoading,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-4">
      <input
        type="text"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        placeholder="EURUSD"
        className="w-24 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black focus:outline-none focus:border-purple-600"
      />

      <select
        value={interval}
        onChange={(e) => setIntervalValue(e.target.value)}
        className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black focus:outline-none focus:border-purple-600"
      >
        {INTERVALS.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>

      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black focus:outline-none focus:border-purple-600"
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black focus:outline-none focus:border-purple-600"
      />

      <button
        onClick={onLoadData}
        disabled={isLoading}
        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-md shadow-[0_0_10px_rgba(147,51,234,0.3)] transition-colors"
      >
        {isLoading ? "Loading..." : "Load Data"}
      </button>
    </div>
  );
}