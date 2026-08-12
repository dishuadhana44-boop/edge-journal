// src/components/trading/backtest/ModeToggle.jsx
// Live/Backtest pill switch — sits next to the symbol search bar on the Trading page

import React from "react";

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex items-center bg-black border border-zinc-800 rounded-full p-1">
      <button
        onClick={() => onChange("live")}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          mode === "live"
            ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.6)]"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        Live
      </button>
      <button
        onClick={() => onChange("backtest")}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          mode === "backtest"
            ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.6)]"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        Backtest
      </button>
    </div>
  );
}