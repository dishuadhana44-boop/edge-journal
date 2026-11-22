// src/components/trading/backtest/workspace/BacktestToolbar.jsx
// Data-source and account controls for a backtest. The provenance badge states
// plainly whether the candles are real broker history, imported, or unverified.

import { useRef } from "react";
import { PROVENANCE, SOURCES, TIMEFRAMES } from "../../../../services/backtest/historicalData";
import { listSymbols } from "../../../../services/backtest/symbolSpecs";

const selectClass =
  "h-8 rounded-lg border border-[#292c34] bg-[#111318] px-2 text-xs text-white outline-none focus:border-purple-500";

const PROVENANCE_STYLES = {
  [PROVENANCE.REAL]: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  [PROVENANCE.IMPORTED]: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  [PROVENANCE.UNAVAILABLE]: "border-zinc-600 bg-zinc-800/40 text-zinc-400",
};

const PROVENANCE_TEXT = {
  [PROVENANCE.REAL]: "Real historical data",
  [PROVENANCE.IMPORTED]: "Imported data",
  [PROVENANCE.UNAVAILABLE]: "No data loaded",
};

function Chip({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</span>
      <span className="text-xs font-medium text-zinc-200 tabular-nums">{value}</span>
    </div>
  );
}

export default function BacktestToolbar({
  config,
  onConfigChange,
  onLoad,
  isLoading,
  error,
  dataset,
  settings,
  account,
  onOpenSettings,
  onReset,
  onSave,
  saveState,
}) {
  const fileInputRef = useRef(null);

  const update = (patch) => onConfigChange({ ...config, ...patch });

  return (
    <div className="shrink-0 border-b border-[#24262d] bg-[#0c0d12] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={config.source}
          onChange={(event) => update({ source: event.target.value })}
          className={selectClass}
          title="Where the candles come from"
        >
          <option value={SOURCES.MT5}>MT5 bridge (real)</option>
          <option value={SOURCES.TWELVE_DATA}>Twelve Data (real)</option>
          <option value={SOURCES.IMPORT}>Import CSV</option>
        </select>

        <select
          value={config.symbol}
          onChange={(event) => update({ symbol: event.target.value })}
          className={selectClass}
        >
          {listSymbols().map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
          {!listSymbols().includes(config.symbol) && (
            <option value={config.symbol}>{config.symbol}</option>
          )}
        </select>

        <select
          value={config.interval}
          onChange={(event) => update({ interval: event.target.value })}
          className={selectClass}
        >
          {TIMEFRAMES.map((timeframe) => (
            <option key={timeframe} value={timeframe}>
              {timeframe}
            </option>
          ))}
        </select>

        {config.source === SOURCES.IMPORT ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 rounded-lg border border-[#292c34] bg-[#111318] px-3 text-xs text-zinc-200 hover:border-purple-500"
          >
            {config.importedName || "Choose CSV…"}
          </button>
        ) : (
          <>
            <input
              type="date"
              value={config.startDate}
              onChange={(event) => update({ startDate: event.target.value })}
              className={`${selectClass} [color-scheme:dark]`}
            />
            <span className="text-xs text-zinc-600">to</span>
            <input
              type="date"
              value={config.endDate}
              onChange={(event) => update({ endDate: event.target.value })}
              className={`${selectClass} [color-scheme:dark]`}
            />
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            onConfigChange({ ...config, importedText: text, importedName: file.name });
          }}
        />

        <button
          onClick={onLoad}
          disabled={isLoading}
          className="h-8 rounded-lg bg-purple-600 px-3.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {isLoading ? "Loading…" : "Load history"}
        </button>

        <span
          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            PROVENANCE_STYLES[dataset?.provenance] || PROVENANCE_STYLES[PROVENANCE.UNAVAILABLE]
          }`}
        >
          {PROVENANCE_TEXT[dataset?.provenance] || PROVENANCE_TEXT[PROVENANCE.UNAVAILABLE]}
          {dataset ? ` · ${dataset.candles.length.toLocaleString()} candles` : ""}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Chip label="Balance" value={account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Chip label="Equity" value={account.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Chip label="Free" value={account.freeMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Chip label="Ccy" value={settings.accountCurrency} />
          <Chip label="Lev" value={`1:${settings.leverage}`} />
          <Chip label="Risk" value={settings.riskMode === "percent" ? `${settings.riskPercent}%` : `${settings.fixedLots} lots`} />
          <Chip label="Spread" value={`${settings.spreadPips}p`} />

          <button
            onClick={onOpenSettings}
            className="h-8 rounded-lg border border-[#292c34] bg-[#111318] px-3 text-xs text-zinc-200 hover:border-purple-500"
          >
            Settings
          </button>

          <button
            onClick={onSave}
            className="h-8 rounded-lg border border-[#292c34] bg-[#111318] px-3 text-xs text-zinc-200 hover:border-purple-500"
          >
            {saveState || "Save backtest"}
          </button>

          <button
            onClick={onReset}
            className="h-8 rounded-lg border border-red-500/40 px-3 text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            Reset
          </button>
        </div>
      </div>

      {dataset?.label && (
        <p className="mt-1.5 text-[11px] text-zinc-600">
          Source: {dataset.label}
          {dataset.meta?.firstTime
            ? ` · ${new Date(dataset.meta.firstTime).toISOString().slice(0, 10)} → ${new Date(
                dataset.meta.lastTime
              ).toISOString().slice(0, 10)}`
            : ""}
          {dataset.meta?.dropped ? ` · ${dataset.meta.dropped} invalid candles skipped` : ""}
          {dataset.meta?.largestGapCandles
            ? ` · largest gap ${dataset.meta.largestGapCandles} candles`
            : ""}
        </p>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
