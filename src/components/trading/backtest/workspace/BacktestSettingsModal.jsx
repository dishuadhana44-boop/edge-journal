// src/components/trading/backtest/workspace/BacktestSettingsModal.jsx
// Only settings the engine actually consumes are exposed here.

import { useState } from "react";
import { X } from "lucide-react";
import { SAME_CANDLE_RULES } from "../../../../services/backtest/simulationEngine";
import {
  SUPPORTED_ACCOUNT_CURRENCIES,
  getSymbolSpec,
  MIN_LOT,
  MAX_LOT,
} from "../../../../services/backtest/symbolSpecs";

const inputClass =
  "mt-1 w-full rounded-lg border border-[#292c34] bg-[#111318] px-3 py-2 text-sm text-white outline-none focus:border-purple-500";

function Row({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-zinc-600">{hint}</span>}
    </label>
  );
}

export default function BacktestSettingsModal({ open, onClose, settings, onChange, symbol, onApplyStartFrom }) {
  const [startFrom, setStartFrom] = useState("");
  const [startError, setStartError] = useState(null);

  if (!open) return null;

  const spec = getSymbolSpec(symbol);

  const update = (patch) => onChange({ ...settings, ...patch });

  const numberField = (key, { label, hint, step = 1, min, max, prefix }) => (
    <Row key={key} label={label} hint={hint}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={settings[key]}
          onChange={(event) => update({ [key]: Number(event.target.value) })}
          className={`${inputClass} ${prefix ? "pl-7" : ""}`}
        />
      </div>
    </Row>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#24262d] bg-[#0c0d12] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#24262d] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Backtest settings</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Simulation assumptions. None of these touch a live account.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-auto p-5">
          {numberField("initialBalance", {
            label: "Initial balance",
            hint: "Reset restores this balance; changing it mid-test rewrites every equity figure.",
          })}

          <Row label="Account currency" hint="P&L is converted using the traded symbol's own price, so the currency must be one of its legs.">
            <select
              value={settings.accountCurrency}
              onChange={(event) => update({ accountCurrency: event.target.value })}
              className={inputClass}
            >
              {SUPPORTED_ACCOUNT_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </Row>

          {numberField("leverage", {
            label: "Leverage (1 : N)",
            hint: `Margin required = lot value ÷ leverage. Orders are refused when free margin runs out.`,
          })}

          {numberField("stopOutLevelPct", {
            label: "Stop out (% margin level)",
            hint: "When equity falls to this percentage of used margin the positions are force-closed at the candle price, as a broker would. Set 0 to disable.",
          })}

          {numberField("spreadPips", {
            label: `Fixed spread (pips)`,
            step: 0.1,
            min: 0,
            hint: spec
              ? `Historical feeds carry no bid/ask, so half of this is charged on each leg: a round turn costs ${settings.spreadPips} pips. Typical ${symbol} value is ${spec.spreadPips} pips.`
              : "Historical feeds carry no bid/ask, so half of this is charged on each leg.",
          })}

          {numberField("slippagePips", {
            label: "Slippage (pips)",
            step: 0.1,
            min: 0,
            hint: "Applied adversely to every fill, market or pending.",
          })}

          {numberField("commissionPerLot", {
            label: "Commission per lot (account ccy)",
            step: 0.5,
            min: 0,
            hint: "Charged on open and on close, and included in net P&L.",
          })}

          {numberField("swapPerLotPerNight", {
            label: "Swap per lot per night",
            step: 0.1,
            hint: "Signed, applied for each whole night a position is held from candle timestamps. Negative costs the account, positive credits it.",
          })}

          <Row label="Risk model">
            <div className="mt-1 flex overflow-hidden rounded-lg border border-[#292c34]">
              {[
                ["percent", "Risk %"],
                ["fixed", "Fixed lots"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => update({ riskMode: value })}
                  className={`flex-1 py-2 text-xs ${
                    settings.riskMode === value ? "bg-purple-600 text-white" : "bg-[#111318] text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>

          {settings.riskMode === "percent"
            ? numberField("riskPercent", { label: "Risk % per trade", step: 0.1, min: 0.01 })
            : numberField("fixedLots", { label: "Fixed lots", step: 0.01, min: MIN_LOT, max: MAX_LOT })}

          <Row label="Same-candle SL/TP conflict" hint="One candle can breach both levels. Without tick data the order is unknowable, so a deterministic rule is applied and flagged on the trade.">
            <select
              value={settings.sameCandleRule}
              onChange={(event) => update({ sameCandleRule: event.target.value })}
              className={inputClass}
            >
              <option value={SAME_CANDLE_RULES.SL_FIRST}>Stop loss first (conservative)</option>
              <option value={SAME_CANDLE_RULES.TP_FIRST}>Take profit first</option>
              <option value={SAME_CANDLE_RULES.NEAREST_TO_OPEN}>Nearest level to candle open</option>
            </select>
          </Row>

          <Row label="Direction">
            <div className="mt-1 flex gap-2">
              {[
                ["allowLong", "Allow long"],
                ["allowShort", "Allow short"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex flex-1 items-center gap-2 rounded-lg border border-[#292c34] bg-[#111318] px-3 py-2 text-xs text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key])}
                    onChange={(event) => update({ [key]: event.target.checked })}
                    className="h-3.5 w-3.5 accent-purple-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Row>

          <div className="col-span-2 rounded-xl border border-[#24262d] bg-[#0e1015] p-4">
            <Row label="Start replay from" hint="Jumps the cursor to the nearest candle at or around this UTC date/time. Future candles stay hidden.">
              <div className="mt-1 flex gap-2">
                <input
                  type="datetime-local"
                  value={startFrom}
                  onChange={(event) => setStartFrom(event.target.value)}
                  className={`${inputClass} mt-0 [color-scheme:dark]`}
                />
                <button
                  onClick={() => {
                    if (!startFrom) {
                      setStartError("Pick a date and time first.");
                      return;
                    }
                    const timestamp = Date.parse(
                      startFrom.endsWith("Z") || startFrom.includes("+") ? startFrom : `${startFrom}:00Z`
                    );
                    if (!Number.isFinite(timestamp)) {
                      setStartError("That date could not be read.");
                      return;
                    }
                    const result = onApplyStartFrom(timestamp);
                    setStartError(result ? null : "The loaded history has no candle near that time.");
                  }}
                  className="shrink-0 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-500"
                >
                  Jump
                </button>
              </div>
            </Row>
            {startError && <p className="mt-2 text-xs text-red-400">{startError}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#24262d] px-5 py-4">
          <p className="text-[11px] text-zinc-600">
            Orders stay inside the simulation engine and are tagged mode: "BACKTEST".
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
