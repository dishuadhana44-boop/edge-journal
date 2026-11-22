// src/components/trading/backtest/workspace/BacktestWorkspace.jsx
// Orchestrates the backtest: history -> replay cursor -> action journal ->
// SimulationEngine -> panels. It holds no broker context, so nothing in here
// can reach MT5, cTrader or a live order endpoint.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import BacktestChart from "../BacktestChart";
import BacktestOrderTicket from "./BacktestOrderTicket";
import BacktestSettingsModal from "./BacktestSettingsModal";
import BacktestToolbar from "./BacktestToolbar";
import {
  AnalyticsPanel,
  ClosedTradesPanel,
  OpenPositionsPanel,
  PendingOrdersPanel,
  RejectionsPanel,
  ResultsPanel,
} from "./BacktestPanels";

import { useBacktest } from "../../../../hooks/useBacktest";
import {
  HistoricalDataError,
  MAX_MT5_CANDLES,
  SOURCES,
  loadHistoricalCandles,
} from "../../../../services/backtest/historicalData";
import {
  DEFAULT_BACKTEST_SETTINGS,
  runBacktest,
  validateLevels,
} from "../../../../services/backtest/simulationEngine";
import { computeBacktestStatistics } from "../../../../services/backtest/backtestStatistics";
import { getSymbolSpec, positionPnl } from "../../../../services/backtest/symbolSpecs";

const STORAGE_KEY = "backtestSessions";

const TABS = [
  { id: "trade", label: "Trade" },
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "trades", label: "Trades" },
  { id: "analytics", label: "Analytics" },
  { id: "results", label: "Results" },
];

// A restored journal already owns ids like bt-7, so new clicks have to continue
// the sequence or two actions would share one position id.
function seedActionId(actions) {
  return actions.reduce((next, action) => {
    const match = /^bt-(\d+)$/.exec(String(action?.id ?? ""));
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

function storedSeries(session) {
  const candles = session?.series?.candles;
  return Array.isArray(candles) && candles.length > 1 ? session.series : null;
}

export default function BacktestWorkspace({ session, initialTab, onBack }) {
  const [config, setConfig] = useState(() => ({
    source: session?.source || SOURCES.MT5,
    symbol: session?.symbol || "EURUSD",
    interval: session?.interval || "15m",
    startDate: session?.startDate || "",
    endDate: session?.endDate || "",
    count: session?.count || MAX_MT5_CANDLES,
    importedText: session?.importedText || "",
    importedName: session?.importedName || "",
  }));

  const [dataset, setDataset] = useState(() => storedSeries(session));
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(() =>
    (session?.source || SOURCES.MT5) === SOURCES.IMPORT && !session?.importedText
      ? "This session imports candles from a CSV file. Choose the file, then load history."
      : null
  );

  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_BACKTEST_SETTINGS,
    ...(session?.settings || {}),
    initialBalance: Number(session?.balance || session?.settings?.initialBalance || 100000),
  }));

  const [actions, setActions] = useState(() =>
    Array.isArray(session?.actions) ? session.actions : []
  );
  const [sessionNotes, setSessionNotes] = useState(session?.notes || "");
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab || "trade");
  const [showSettings, setShowSettings] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [modifyTarget, setModifyTarget] = useState(null);
  const [saveState, setSaveState] = useState(null);
  const [notice, setNotice] = useState(null);

  const nextIdRef = useRef(seedActionId(actions));

  const candles = useMemo(() => dataset?.candles || [], [dataset]);

  const replay = useBacktest(candles, Number.isFinite(session?.replayIndex) ? session.replayIndex : null);

  const spec = getSymbolSpec(config.symbol);

  const sim = useMemo(
    () =>
      runBacktest({
        candles,
        actions,
        settings,
        symbol: config.symbol,
        visibleCount: replay.currentIndex,
      }),
    [candles, actions, settings, config.symbol, replay.currentIndex]
  );

  const stats = useMemo(
    () =>
      computeBacktestStatistics({
        trades: sim.trades,
        equityCurve: sim.equityCurve,
        startingBalance: settings.initialBalance,
      }),
    [sim.trades, sim.equityCurve, settings.initialBalance]
  );

  const account = {
    balance: sim.balance,
    equity: sim.equity,
    usedMargin: sim.usedMargin,
    freeMargin: sim.freeMargin,
  };

  const resumeCursorRef = useRef(Number.isFinite(session?.replayIndex) ? session.replayIndex : null);

  // The journal stores candle indices, so any fresh series invalidates it. This
  // runs from the load handler rather than an effect: StrictMode mounts effects
  // twice, which would otherwise discard a restored journal on the second pass.
  const loadHistory = useCallback(async ({ userInitiated = false } = {}) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await loadHistoricalCandles(config);

      if (actions.length > 0) {
        setNotice(
          userInitiated
            ? "Simulated orders were cleared because the history changed."
            : "This saved backtest did not store its candles, so the saved orders were dropped when the history was re-fetched. Save it again to keep the exact series."
        );
      }

      setActions([]);
      setSelectedPositionId(null);
      setDataset(result);

      const resumeAt = resumeCursorRef.current;
      resumeCursorRef.current = null;
      replay.applyDataset(result.candles.length, resumeAt ?? undefined);
    } catch (error) {
      setLoadError(
        error instanceof HistoricalDataError || error?.code
          ? error.message
          : `Could not load history: ${error.message}`
      );
      setDataset(null);
    } finally {
      setIsLoading(false);
    }
  }, [actions.length, config, replay]);

  // Load once when the workspace opens (or when a saved session is restored).
  useEffect(() => {
    if (!dataset) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAction = useCallback(
    (draft) => {
      if (!replay.currentCandle) return;

      setActions((previous) => [
        ...previous,
        { ...draft, id: `bt-${nextIdRef.current++}`, at: replay.currentIndex },
      ]);
    },
    [replay.currentIndex, replay.currentCandle]
  );

  const closePosition = useCallback(
    (positionId, volume) => {
      setActions((previous) => [
        ...previous,
        { kind: "close", id: `bt-${nextIdRef.current++}`, at: replay.currentIndex, positionId, volume },
      ]);
      setSelectedPositionId(null);
    },
    [replay.currentIndex]
  );

  const cancelOrder = useCallback(
    (orderId) => {
      setActions((previous) => [
        ...previous,
        { kind: "cancel", id: `bt-${nextIdRef.current++}`, at: replay.currentIndex, orderId },
      ]);
    },
    [replay.currentIndex]
  );

  const saveBacktest = () => {
    const id = session?.id ?? Date.now();

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

      const record = {
        id,
        sessionName: session?.sessionName,
        createdAt: session?.createdAt,
        source: config.source,
        symbol: config.symbol,
        interval: config.interval,
        startDate: config.startDate,
        endDate: config.endDate,
        count: config.count,
        importedName: config.importedName,
        balance: settings.initialBalance,
        settings,
        actions,
        notes: sessionNotes,
        savedAt: new Date().toISOString(),
        replayIndex: replay.currentIndex,
        // Re-fetching the source returns the *latest* candles, which shifts every
        // journal index, so the exact series is stored alongside the journal.
        series: dataset
          ? {
              candles: dataset.candles,
              provenance: dataset.provenance,
              source: dataset.source,
              label: dataset.label,
              meta: dataset.meta,
            }
          : null,
        results: {
          netProfit: stats.netProfit,
          totalTrades: stats.totalTrades,
          winRate: stats.winRate,
          profitFactor: stats.profitFactor,
          maxDrawdownPct: stats.maxDrawdownPct,
          endingBalance: stats.endingBalance,
        },
        trades: sim.trades.slice(0, 400),
      };

      const index = stored.findIndex((item) => item.id === id);
      if (index === -1) stored.unshift(record);
      else stored[index] = { ...stored[index], ...record };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setSaveState("Saved");
    } catch (error) {
      setSaveState("Save failed");
      setNotice(`Could not save this backtest: ${error.message}`);
    }

    setTimeout(() => setSaveState(null), 2500);
  };

  const tabCounts = {
    open: sim.positions.length,
    pending: sim.orders.length,
    trades: sim.trades.length,
  };

  const dock = (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[#24262d] bg-[#0c0d12]">
      <div className="flex shrink-0 overflow-x-auto border-b border-[#24262d]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-3 py-2.5 text-xs font-medium ${
              activeTab === tab.id
                ? "border-b-2 border-purple-500 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {tabCounts[tab.id] ? (
              <span className="ml-1 rounded-full bg-purple-600/30 px-1.5 text-[10px] text-purple-300">
                {tabCounts[tab.id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {sim.fatalError && (
          <div className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {sim.fatalError}
          </div>
        )}

        {activeTab === "trade" && (
          <BacktestOrderTicket
            symbol={config.symbol}
            marketPrice={replay.currentCandle?.close ?? null}
            settings={settings}
            account={account}
            disabled={!replay.currentCandle || Boolean(sim.fatalError)}
            onSubmit={submitAction}
          />
        )}

        {activeTab === "open" && (
          <OpenPositionsPanel
            positions={sim.positions}
            price={sim.currentPrice}
            spec={spec}
            accountCurrency={settings.accountCurrency}
            selectedId={selectedPositionId}
            onSelect={setSelectedPositionId}
            onClose={(id) => closePosition(id)}
            onModify={(id) => setModifyTarget({ type: "position", id })}
            unrealizedFor={(position) =>
              positionPnl({
                symbol: config.symbol,
                side: position.side,
                entry: position.entryPrice,
                price: sim.currentPrice,
                volume: position.volume,
                accountCurrency: settings.accountCurrency,
              }) || 0
            }
          />
        )}

        {activeTab === "pending" && (
          <PendingOrdersPanel
            orders={sim.orders}
            spec={spec}
            onCancel={cancelOrder}
            onModify={(id) => setModifyTarget({ type: "order", id })}
          />
        )}

        {activeTab === "trades" && (
          <ClosedTradesPanel
            trades={sim.trades}
            spec={spec}
            accountCurrency={settings.accountCurrency}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsPanel
            stats={stats}
            equityCurve={sim.equityCurve}
            accountCurrency={settings.accountCurrency}
          />
        )}

        {activeTab === "results" && (
          <div>
            <ResultsPanel
              stats={stats}
              sim={sim}
              startingBalance={settings.initialBalance}
              accountCurrency={settings.accountCurrency}
            />

            <div className="px-3 pb-3">
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
                Session notes
              </label>
              <textarea
                value={sessionNotes}
                onChange={(event) => setSessionNotes(event.target.value)}
                rows={3}
                placeholder="Waited for BOS + FVG before entering…"
                className="mt-1 w-full rounded-lg border border-[#292c34] bg-[#111318] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}
      </div>

      <RejectionsPanel rejections={sim.rejections} />

      <div className="shrink-0 border-t border-[#24262d] p-2">
        <button
          onClick={() =>
            setActions((previous) => [
              ...previous,
              { kind: "closeAll", id: `bt-${nextIdRef.current++}`, at: replay.currentIndex },
            ])
          }
          disabled={sim.positions.length === 0 && sim.orders.length === 0}
          className="w-full rounded-lg border border-[#292c34] py-2 text-xs text-zinc-300 hover:border-purple-500 disabled:opacity-40"
        >
          Finish test — close all simulated positions
        </button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen w-full overflow-hidden bg-[#0c0d12]">
      <BacktestChart
        candles={candles}
        backtest={replay}
        session={{ ...session, symbol: config.symbol, interval: config.interval }}
        sim={sim}
        selectedPositionId={selectedPositionId}
        onSelectInterval={(interval) => setConfig((prev) => ({ ...prev, interval }))}
        onOpenSettings={() => setShowSettings(true)}
        toolbar={
          <div className="flex items-start">
            <button
              onClick={onBack}
              title="Back to sessions"
              className="mt-2 ml-3 flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#292c34] bg-[#111318] px-2.5 text-xs text-zinc-300 hover:border-purple-500"
            >
              <ArrowLeft size={14} />
              Sessions
            </button>

            <div className="min-w-0 flex-1">
              <BacktestToolbar
                config={config}
                onConfigChange={setConfig}
                onLoad={() => loadHistory({ userInitiated: true })}
                isLoading={isLoading}
                error={loadError}
                dataset={dataset}
                settings={settings}
                account={account}
                onOpenSettings={() => setShowSettings(true)}
                onReset={() => setShowReset(true)}
                onSave={saveBacktest}
                saveState={saveState}
              />
            </div>
          </div>
        }
        sidePanel={dock}
      />

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[130] -translate-x-1/2 rounded-xl border border-[#292c34] bg-[#15171d] px-4 py-2 text-xs text-zinc-300 shadow-xl">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-3 text-purple-400">
            dismiss
          </button>
        </div>
      )}

      <BacktestSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onChange={setSettings}
        symbol={config.symbol}
        onApplyStartFrom={(timestamp) => replay.seekToTimestamp(timestamp)}
      />

      {modifyTarget && (
        <ModifyDialog
          target={modifyTarget}
          sim={sim}
          spec={spec}
          currency={settings.accountCurrency}
          onClose={() => setModifyTarget(null)}
          onSubmit={(patch) => {
            setActions((previous) => [
              ...previous,
              {
                kind: "modify",
                id: `bt-${nextIdRef.current++}`,
                at: replay.currentIndex,
                ...(modifyTarget.type === "position"
                  ? { positionId: modifyTarget.id }
                  : { orderId: modifyTarget.id }),
                ...patch,
              },
            ]);
            setModifyTarget(null);
          }}
          onPartialClose={(lots) => closePosition(modifyTarget.id, lots)}
        />
      )}

      {showReset && (
        <ConfirmReset
          onCancel={() => setShowReset(false)}
          onConfirm={() => {
            setActions([]);
            setSelectedPositionId(null);
            replay.reset();
            setShowReset(false);
            setNotice("Backtest reset — only simulated data was cleared. No broker account was touched.");
          }}
          counts={{
            positions: sim.positions.length,
            orders: sim.orders.length,
            trades: sim.trades.length,
          }}
        />
      )}
    </div>
  );
}

function ModifyDialog({ target, sim, spec, currency, onClose, onSubmit, onPartialClose }) {
  const entity =
    target.type === "position"
      ? sim.positions.find((position) => position.id === target.id)
      : sim.orders.find((order) => order.id === target.id);

  const digits = spec?.digits ?? 5;
  const [sl, setSl] = useState(entity?.sl != null ? entity.sl.toFixed(digits) : "");
  const [tp, setTp] = useState(entity?.tp != null ? entity.tp.toFixed(digits) : "");
  const [volume, setVolume] = useState("");
  const [error, setError] = useState(null);

  if (!entity) {
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative rounded-2xl border border-[#24262d] bg-[#0c0d12] p-5 text-sm text-zinc-300">
          That {target.type === "position" ? "position" : "order"} no longer exists at this replay point.
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={(event) => {
          event.preventDefault();

          const patch = {
            sl: sl.trim() === "" ? null : Number(sl),
            tp: tp.trim() === "" ? null : Number(tp),
          };

          if (Number.isNaN(patch.sl) || Number.isNaN(patch.tp)) {
            setError("Stop and target must be prices or left blank.");
            return;
          }

          const levelError = validateLevels({
            side: entity.side,
            referencePrice: target.type === "position" ? entity.entryPrice : entity.price,
            sl: patch.sl,
            tp: patch.tp,
            digits,
          });

          if (levelError) {
            setError(levelError);
            return;
          }

          const partial = volume.trim() === "" ? null : Number(volume);

          if (partial != null && (Number.isNaN(partial) || partial <= 0)) {
            setError("A partial close must be a positive lot size, or left blank.");
            return;
          }

          if (partial != null && target.type === "position" && partial >= entity.volume) {
            setError(`Closing ${partial} lots must be below the ${entity.volume} lots open. Use Close to exit the whole position.`);
            return;
          }

          onSubmit(patch);
          if (partial != null && target.type === "position") onPartialClose(partial);
        }}
        className="relative w-full max-w-sm rounded-2xl border border-[#24262d] bg-[#0c0d12] p-5 text-white shadow-2xl"
      >
        <h3 className="text-sm font-semibold">
          Modify {target.type === "position" ? "position" : "pending order"} · {entity.side}{" "}
          {entity.volume}
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Entry {entity.entryPrice?.toFixed?.(digits) ?? entity.price?.toFixed(digits)} · simulated only
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-400">
            Stop loss ({currency})
            <input
              type="number"
              step={spec?.pipSize ?? 0.00001}
              value={sl}
              onChange={(event) => setSl(event.target.value)}
              placeholder="none"
              className="mt-1 w-full rounded-lg border border-[#292c34] bg-[#111318] px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            Take profit
            <input
              type="number"
              step={spec?.pipSize ?? 0.00001}
              value={tp}
              onChange={(event) => setTp(event.target.value)}
              placeholder="none"
              className="mt-1 w-full rounded-lg border border-[#292c34] bg-[#111318] px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            />
          </label>

          {target.type === "position" && (
            <label className="block text-xs text-zinc-400">
              Close part of the position (lots to close)
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={volume}
                onChange={(event) => setVolume(event.target.value)}
                placeholder={`keep all ${entity.volume} lots`}
                className="mt-1 w-full rounded-lg border border-[#292c34] bg-[#111318] px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </label>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#292c34] px-4 py-2 text-xs text-zinc-300">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white">
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmReset({ counts, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-md rounded-2xl border border-[#24262d] bg-[#0c0d12] p-6 text-white shadow-2xl">
        <h2 className="text-base font-semibold">Reset this backtest?</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Clears {counts.trades} closed simulated trade{counts.trades === 1 ? "" : "s"}, {counts.positions} open
          position{counts.positions === 1 ? "" : "s"} and {counts.orders} pending order
          {counts.orders === 1 ? "" : "s"}, then rewinds the replay cursor.
        </p>
        <p className="mt-3 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
          Simulated data only. Real MT5 / cTrader accounts, live positions and broker history are never touched.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-[#292c34] px-4 py-2 text-sm text-zinc-300">
            Keep testing
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            Reset backtest
          </button>
        </div>
      </div>
    </div>
  );
}
