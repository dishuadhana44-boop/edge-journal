// src/components/trading/backtest/workspace/BacktestOrderTicket.jsx
// Manual BACKTEST order entry. Nothing here reaches a broker: the ticket only
// appends an action to the replay journal.

import { useMemo, useState } from "react";
import {
  getSymbolSpec,
  pipValuePerLot,
  riskVolume,
  requiredMargin,
  MIN_LOT,
  MAX_LOT,
} from "../../../../services/backtest/symbolSpecs";
import { validateLevels, validatePendingPrice } from "../../../../services/backtest/simulationEngine";

const ORDER_TYPES = ["MARKET", "LIMIT", "STOP"];

const money = (value, currency) =>
  `${value == null || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-zinc-600">{hint}</span>}
    </label>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-[#292c34] bg-[#111318] px-2.5 py-1.5 text-sm text-white outline-none focus:border-purple-500";

export default function BacktestOrderTicket({
  symbol,
  marketPrice,
  settings,
  account,
  disabled,
  onSubmit,
}) {
  const spec = useMemo(() => getSymbolSpec(symbol), [symbol]);
  const digits = spec?.digits ?? 5;

  const [orderType, setOrderType] = useState("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [sizeMode, setSizeMode] = useState(settings.riskMode === "fixed" ? "fixed" : "risk");
  const [lots, setLots] = useState(String(settings.fixedLots));
  const [riskPercent, setRiskPercent] = useState(String(settings.riskPercent));
  const [slMode, setSlMode] = useState("pips");
  const [slValue, setSlValue] = useState("20");
  const [tpMode, setTpMode] = useState("rr");
  const [tpValue, setTpValue] = useState("2");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);

  const preview = useMemo(() => {
    if (!spec || !marketPrice) return null;

    const halfSpread = (settings.spreadPips / 2) * spec.pipSize;
    const requested = orderType === "MARKET" ? marketPrice : Number(limitPrice);
    if (!Number.isFinite(requested) || requested <= 0) return null;

    const entry = orderType === "MARKET" ? requested + halfSpread : requested;

    // Levels are entered as distances, so a SELL mirrors them below/above the
    // entry instead of inheriting the BUY orientation.
    const riskPipsRaw = slMode === "price" ? null : Math.abs(Number(slValue)) || 0;
    const rewardPipsRaw = tpMode === "price" ? null : Math.abs(Number(tpValue)) || 0;

    function resolveLevels(side) {
      const isBuy = side === "BUY";

      let level = null;

      if (slMode === "price") level = Number(slValue);
      else if (slMode === "pips") {
        level = isBuy
          ? entry - riskPipsRaw * spec.pipSize
          : entry + riskPipsRaw * spec.pipSize;
      }

      let target = null;

      if (tpMode === "price") target = Number(tpValue);
      else if (tpMode === "pips") {
        target = isBuy
          ? entry + rewardPipsRaw * spec.pipSize
          : entry - rewardPipsRaw * spec.pipSize;
      } else if (tpMode === "rr" && level != null) {
        const distance = Math.abs(entry - level) * (Number(tpValue) || 0);
        target = isBuy ? entry + distance : entry - distance;
      }

      return { sl: level, tp: target };
    }

    const provisional = resolveLevels("BUY");
    const sl = provisional.sl;
    const tp = provisional.tp;

    const riskDistance = sl != null && Number.isFinite(sl) ? Math.abs(entry - sl) : 0;
    const riskPips = riskDistance / spec.pipSize;

    const pipValue = pipValuePerLot({ symbol, price: entry, accountCurrency: settings.accountCurrency });
    const volume =
      sizeMode === "risk"
        ? riskVolume({
            symbol,
            price: entry,
            accountCurrency: settings.accountCurrency,
            balance: account.balance,
            riskPercent: Number(riskPercent),
            stopDistancePrice: riskDistance,
          })
        : Number(lots);

    const margin =
      Number.isFinite(volume) && volume > 0
        ? requiredMargin({
            symbol,
            price: entry,
            volume,
            accountCurrency: settings.accountCurrency,
            leverage: settings.leverage,
          })
        : null;

    const potentialLoss =
      pipValue != null && Number.isFinite(volume) ? riskPips * pipValue * volume : null;
    const rewardDistance = tp != null ? Math.abs(tp - entry) : 0;
    const potentialProfit =
      pipValue != null && Number.isFinite(volume)
        ? (rewardDistance / spec.pipSize) * pipValue * volume
        : null;

    return {
      entry,
      sl,
      tp,
      resolveLevels,
      riskPips,
      rewardPips: rewardDistance / spec.pipSize,
      pipValue,
      volume,
      margin,
      potentialLoss,
      potentialProfit,
      riskReward:
        riskDistance > 0 && rewardDistance > 0
          ? rewardDistance / riskDistance
          : null,
      riskAmount:
        (Number(account.balance) * Number(riskPercent)) / 100,
    };
  }, [
    spec,
    symbol,
    settings,
    account.balance,
    marketPrice,
    orderType,
    limitPrice,
    slMode,
    slValue,
    tpMode,
    tpValue,
    sizeMode,
    lots,
    riskPercent,
  ]);

  function submit(side) {
    setError(null);

    if (orderType !== "MARKET" && !(Number(limitPrice) > 0)) {
      setError("Set an order price above 0 for a LIMIT or STOP order.");
      return;
    }

    if (!preview) {
      setError("Wait for the replay to show a candle before trading.");
      return;
    }

    const marketForOrder = marketPrice;
    if (orderType !== "MARKET") {
      const pendingError = validatePendingPrice({
        orderType,
        side,
        price: Number(limitPrice),
        marketPrice: marketForOrder,
      });
      if (pendingError) {
        setError(pendingError);
        return;
      }
    }

    const { sl, tp } = preview.resolveLevels(side);

    const levelError = validateLevels({
      side,
      referencePrice: preview.entry,
      sl,
      tp,
      digits,
    });

    if (levelError) {
      setError(levelError);
      return;
    }

    if (!Number.isFinite(preview.volume) || preview.volume < MIN_LOT || preview.volume > MAX_LOT) {
      setError(
        `Position size ${preview.volume ?? "—"} is outside ${MIN_LOT}–${MAX_LOT} lots. ` +
          "Reduce risk %, widen the stop, or set lots manually."
      );
      return;
    }

    if (preview.margin != null && preview.margin > account.freeMargin) {
      setError(
        `Not enough free margin: ${money(preview.margin, settings.accountCurrency)} required, ` +
          `${money(account.freeMargin, settings.accountCurrency)} free.`
      );
      return;
    }

    onSubmit({
      kind: orderType === "MARKET" ? "market" : "pending",
      orderType: orderType === "MARKET" ? undefined : orderType,
      side,
      price: orderType === "MARKET" ? undefined : Number(limitPrice),
      volume: preview.volume,
      sl: sl ?? null,
      tp: tp ?? null,
      notes: notes.trim(),
    });

    setNotes("");
  }

  if (!spec) {
    return (
      <div className="p-4 text-xs text-amber-400">
        No contract specification exists for {symbol}. Import history for it, or pick a supported symbol.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">
          Backtest / Simulation
        </span>
        <span className="text-[10px] text-zinc-400">{symbol}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {ORDER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              setOrderType(type);
              // A pending order needs a price; seed it with the replayed close so
              // the trader edits a real level instead of an empty box.
              if (type !== "MARKET" && !limitPrice && marketPrice) {
                setLimitPrice(marketPrice.toFixed(digits));
              }
            }}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
              orderType === type
                ? "bg-purple-600 text-white"
                : "bg-[#111318] text-zinc-400 hover:text-white"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {orderType !== "MARKET" && (
        <Field label="Order price">
          <input
            type="number"
            step={spec.pipSize}
            value={limitPrice}
            onChange={(event) => setLimitPrice(event.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Size mode">
          <div className="mt-1 flex rounded-lg border border-[#292c34] overflow-hidden">
            {[
              ["risk", "Risk %"],
              ["fixed", "Lots"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSizeMode(value)}
                className={`flex-1 py-1.5 text-[11px] ${
                  sizeMode === value ? "bg-[#2a2140] text-purple-300" : "bg-[#111318] text-zinc-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        {sizeMode === "risk" ? (
          <Field label="Risk % of balance">
            <input
              type="number"
              step="0.1"
              min="0.01"
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label="Volume (lots)">
            <input
              type="number"
              step="0.01"
              min={MIN_LOT}
              max={MAX_LOT}
              value={lots}
              onChange={(event) => setLots(event.target.value)}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      <Field label="Stop loss">
        <div className="mt-1 flex gap-1.5">
          <select
            value={slMode}
            onChange={(event) => setSlMode(event.target.value)}
            className="rounded-lg border border-[#292c34] bg-[#111318] px-2 py-1.5 text-xs text-white"
          >
            <option value="pips">pips</option>
            <option value="price">price</option>
            <option value="none">none</option>
          </select>
          {slMode !== "none" && (
            <input
              type="number"
              step={slMode === "price" ? spec.pipSize : 1}
              value={slValue}
              onChange={(event) => setSlValue(event.target.value)}
              className="mt-0 flex-1 rounded-lg border border-[#292c34] bg-[#111318] px-2.5 py-1.5 text-sm text-white outline-none focus:border-purple-500"
            />
          )}
        </div>
      </Field>

      <Field label="Take profit">
        <div className="mt-1 flex gap-1.5">
          <select
            value={tpMode}
            onChange={(event) => setTpMode(event.target.value)}
            className="rounded-lg border border-[#292c34] bg-[#111318] px-2 py-1.5 text-xs text-white"
          >
            <option value="rr">R:R</option>
            <option value="pips">pips</option>
            <option value="price">price</option>
            <option value="none">none</option>
          </select>
          {tpMode !== "none" && (
            <input
              type="number"
              step={tpMode === "price" ? spec.pipSize : tpMode === "rr" ? 0.5 : 1}
              value={tpValue}
              onChange={(event) => setTpValue(event.target.value)}
              className="mt-0 flex-1 rounded-lg border border-[#292c34] bg-[#111318] px-2.5 py-1.5 text-sm text-white outline-none focus:border-purple-500"
            />
          )}
        </div>
      </Field>

      <Field label="Note (optional)">
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Entered after liquidity sweep"
          className={inputClass}
        />
      </Field>

      <div className="rounded-xl border border-[#24262d] bg-[#0e1015] p-3">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">Risk calculator</div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {[
            ["Balance", money(account.balance, settings.accountCurrency)],
            ["Free margin", money(account.freeMargin, settings.accountCurrency)],
            ["Equity", money(account.equity, settings.accountCurrency)],
            ["Entry (incl. spread)", preview ? preview.entry.toFixed(digits) : "—"],
            ["Stop loss", slMode === "none" ? "none" : slMode === "price" ? Number(slValue).toFixed(digits) : `${Math.abs(Number(slValue) || 0)} pips`],
            ["Take profit", tpMode === "none" ? "none" : tpMode === "price" ? Number(tpValue).toFixed(digits) : tpMode === "rr" ? `${tpValue}R` : `${Math.abs(Number(tpValue) || 0)} pips`],
            ["Stop distance", preview ? `${preview.riskPips.toFixed(1)} pips` : "—"],
            ["R:R", preview?.riskReward ? `1 : ${preview.riskReward.toFixed(2)}` : "—"],
            ["Position size", preview?.volume ? `${preview.volume} lots` : "—"],
            ["Pip value / lot", preview?.pipValue != null ? money(Number(preview.pipValue.toFixed(2)), settings.accountCurrency) : "—"],
            ["Potential loss", preview?.potentialLoss != null ? money(-Math.abs(preview.potentialLoss), settings.accountCurrency) : "—"],
            ["Potential profit", preview?.potentialProfit != null ? money(preview.potentialProfit, settings.accountCurrency) : "—"],
            ["Margin required", preview?.margin != null ? money(preview.margin, settings.accountCurrency) : "—"],
            ["Risk amount", sizeMode === "risk" ? money(preview?.riskAmount, settings.accountCurrency) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-200 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={disabled || !preview || settings.allowShort === false}
          onClick={() => submit("SELL")}
          className="rounded-xl bg-[#ef4444] py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
        >
          SELL
        </button>
        <button
          disabled={disabled || !preview || settings.allowLong === false}
          onClick={() => submit("BUY")}
          className="rounded-xl bg-[#16c784] py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          BUY
        </button>
      </div>

      {disabled && (
        <p className="text-[11px] text-zinc-500">
          Orders are blocked until the replay cursor sits on a candle.
        </p>
      )}
    </div>
  );
}
