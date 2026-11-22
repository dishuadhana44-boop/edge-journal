// src/components/trading/backtest/workspace/BacktestPanels.jsx
// Tabs for the backtest dock. Every row is rendered from SimulationEngine
// output — nothing here can fabricate a position, fill or statistic.

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const UP = "#16c784";
const DOWN = "#ef4444";

function money(value, currency, signed = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();
}

function duration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function utcClock(ms) {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

function Table({ columns, rows, empty, emptyHint, onRowClick, selectedId }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-zinc-400">{empty}</p>
        <p className="mt-1 text-xs text-zinc-600">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-[#0e1015] text-[10px] uppercase tracking-wide text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-2.5 py-2 text-left font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.id)}
              className={`border-t border-[#1b1d24] ${
                onRowClick ? "cursor-pointer hover:bg-[#12141a]" : "hover:bg-[#12141a]"
              } ${row.id === selectedId ? "bg-purple-500/10" : ""}`}
            >
              {row.cells.map((cell, index) => (
                <td key={index} className="whitespace-nowrap px-2.5 py-2 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pnlCell = (value, currency) => (
  <span style={{ color: value > 0 ? UP : value < 0 ? DOWN : "#a1a1aa" }}>{money(value, currency, true)}</span>
);

export function OpenPositionsPanel({
  positions,
  price,
  spec,
  accountCurrency,
  selectedId,
  onSelect,
  onClose,
  onModify,
  unrealizedFor,
}) {
  const digits = spec?.digits ?? 5;

  const rows = positions.map((position) => {
    const unrealized = unrealizedFor?.(position) ?? 0;
    const r =
      position.riskAmount > 0 ? unrealized / position.riskAmount : null;

    return {
      id: position.id,
      cells: [
        <span key="side" style={{ color: position.side === "BUY" ? UP : DOWN }}>
          {position.side}
        </span>,
        `${position.volume}`,
        position.entryPrice.toFixed(digits),
        price != null ? price.toFixed(digits) : "—",
        position.sl != null ? position.sl.toFixed(digits) : "—",
        position.tp != null ? position.tp.toFixed(digits) : "—",
        pnlCell(unrealized, accountCurrency),
        r == null ? "—" : `${r.toFixed(2)}R`,
        <button
          key="actions"
          onClick={(event) => {
            event.stopPropagation();
            onClose(position.id);
          }}
          className="rounded-md border border-[#292c34] px-2 py-1 text-[10px] text-zinc-300 hover:border-purple-500 hover:text-white"
        >
          Close
        </button>,
        <button
          key="modify"
          onClick={(event) => {
            event.stopPropagation();
            onModify(position.id);
          }}
          className="ml-1 rounded-md border border-[#292c34] px-2 py-1 text-[10px] text-zinc-300 hover:border-purple-500 hover:text-white"
        >
          SL/TP
        </button>,
      ],
    };
  });

  return (
    <>
      <Table
        columns={["Side", "Lots", "Entry", "Current", "SL", "TP", "P&L", "R", "Actions"]}
        rows={rows}
        selectedId={selectedId}
        onRowClick={onSelect}
        empty="No simulated positions"
        emptyHint="Use the Trade tab to place a backtest order."
      />
      {positions.length > 0 && (
        <div className="px-3 py-2 text-[11px] text-zinc-500">
          Used margin{" "}
          {money(
            positions.reduce((sum, p) => sum + p.margin, 0),
            accountCurrency
          )}
        </div>
      )}
    </>
  );
}

export function PendingOrdersPanel({ orders, spec, onCancel, onModify }) {
  const digits = spec?.digits ?? 5;

  const rows = orders.map((order) => ({
    id: order.id,
    cells: [
      <span key="side" style={{ color: order.side === "BUY" ? UP : DOWN }}>
        {order.side} {order.orderType}
      </span>,
      `${order.volume}`,
      order.price.toFixed(digits),
      order.sl != null ? order.sl.toFixed(digits) : "—",
      order.tp != null ? order.tp.toFixed(digits) : "—",
      utcClock(order.createdAt),
      <button
        key="modify"
        onClick={(event) => {
          event.stopPropagation();
          onModify(order.id);
        }}
        className="rounded-md border border-[#292c34] px-2 py-1 text-[10px] text-zinc-300 hover:border-purple-500 hover:text-white"
      >
        SL/TP
      </button>,
      <button
        key="cancel"
        onClick={(event) => {
          event.stopPropagation();
          onCancel(order.id);
        }}
        className="ml-1 rounded-md border border-red-500/40 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10"
      >
        Cancel
      </button>,
    ],
  }));

  return (
    <Table
      columns={["Order", "Lots", "Price", "SL", "TP", "Created", "", ""]}
      rows={rows}
      empty="No pending orders"
      emptyHint="Pending orders only trigger on candles the replay has revealed."
    />
  );
}

export function ClosedTradesPanel({ trades, spec, accountCurrency, onSelect }) {
  const digits = spec?.digits ?? 5;

  const rows = trades.map((trade) => ({
    id: trade.id,
    cells: [
      <span key="side" style={{ color: trade.side === "BUY" ? UP : DOWN }}>
        {trade.side}
      </span>,
      `${trade.volume}`,
      trade.entryPrice.toFixed(digits),
      trade.exitPrice.toFixed(digits),
      `${trade.pips}p`,
      pnlCell(trade.netPnl, accountCurrency),
      trade.rMultiple == null ? "—" : `${trade.rMultiple}R`,
      duration(trade.durationMs),
      trade.exitReason,
    ],
  }));

  return (
    <Table
      columns={["Side", "Lots", "Entry", "Exit", "Pips", "Net P&L", "R", "Duration", "Exit"]}
      rows={rows}
      onSelect={onSelect}
      empty="No closed simulated trades yet"
      emptyHint="Close a position or let a stop/target trigger during replay."
    />
  );
}

export function RejectionsPanel({ rejections }) {
  if (rejections.length === 0) return null;

  return (
    <div className="border-t border-[#24262d] bg-[#0e1015] px-3 py-2">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-amber-400">
        Engine rejections ({rejections.length})
      </p>
      <ul className="max-h-24 space-y-1 overflow-auto text-[11px] text-zinc-400">
        {rejections.slice(-8).map((rejection, index) => (
          <li key={`${rejection.atIndex}-${index}`}>
            <span className="text-zinc-600">#{rejection.atIndex}</span> {rejection.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function downsample(points, limit = 260) {
  if (points.length <= limit) return points;
  const step = Math.ceil(points.length / limit);
  const sampled = points.filter((_, index) => index % step === 0);
  return [...sampled, points[points.length - 1]];
}

export function EquityCurvePanel({ equityCurve }) {
  const data = useMemo(
    () =>
      downsample(equityCurve).map((point) => ({
        ...point,
        date: new Date(point.time).toISOString().slice(5, 10),
      })),
    [equityCurve]
  );

  if (data.length < 2) {
    return (
      <div className="px-4 py-10 text-center text-xs text-zinc-500">
        The equity curve appears once the replay has advanced past a few candles.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Balance &amp; equity</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#1b1d24" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} minTickGap={24} />
              <YAxis stroke="#52525b" fontSize={10} domain={["auto", "auto"]} width={58} />
              <Tooltip
                contentStyle={{ background: "#0e1015", border: "1px solid #292c34", fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Line type="monotone" dataKey="balance" stroke="#a1a1aa" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="equity" stroke="#a855f7" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Drawdown from peak equity</p>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid stroke="#1b1d24" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} minTickGap={24} />
              <YAxis stroke="#52525b" fontSize={10} width={58} />
              <Tooltip
                contentStyle={{ background: "#0e1015", border: "1px solid #292c34", fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Area type="monotone" dataKey="drawdownPct" stroke={DOWN} fill="rgba(239,68,68,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-[#1b1d24] bg-[#0e1015] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className="mt-0.5 text-sm font-semibold tabular-nums"
        style={{ color: tone || "#e4e4e7" }}
      >
        {value}
      </p>
    </div>
  );
}

const tone = (value) => (value > 0 ? UP : value < 0 ? DOWN : undefined);

export function ResultsPanel({ stats, sim, startingBalance, accountCurrency }) {
  const rows = [
    ["Starting balance", money(startingBalance, accountCurrency)],
    ["Ending balance", money(stats.endingBalance, accountCurrency)],
    ["Equity now", money(sim.equity, accountCurrency)],
    ["Net profit", money(stats.netProfit, accountCurrency, true), tone(stats.netProfit)],
    ["Return", `${stats.returnPct}%`, tone(stats.returnPct)],
    ["Max drawdown", `${stats.maxDrawdownPct}% (${money(stats.maxDrawdown, accountCurrency)})`, DOWN],
    ["Win rate", `${stats.winRate}%`],
    ["Profit factor", stats.profitFactor == null ? (stats.grossProfit > 0 ? "∞" : "—") : stats.profitFactor],
    ["Expectancy", stats.expectancy == null ? "—" : `${stats.expectancy}R`, tone(stats.expectancy)],
    ["Avg R", stats.averageR == null ? "—" : `${stats.averageR}R`, tone(stats.averageR)],
    ["Total trades", stats.totalTrades],
    ["Winners / losers", `${stats.winningTrades} / ${stats.losingTrades}`],
    ["Gross profit", money(stats.grossProfit, accountCurrency, true), UP],
    ["Gross loss", money(stats.grossLoss, accountCurrency, true), DOWN],
    ["Avg win", money(stats.averageWin, accountCurrency), UP],
    ["Avg loss", money(-Math.abs(stats.averageLoss), accountCurrency), DOWN],
    ["Largest win", money(stats.largestWin, accountCurrency, true), tone(stats.largestWin)],
    ["Largest loss", money(stats.largestLoss, accountCurrency, true), tone(stats.largestLoss)],
    ["Risk / reward", stats.riskRewardRatio == null ? "—" : stats.riskRewardRatio],
    ["Recovery factor", stats.recoveryFactor == null ? "—" : stats.recoveryFactor, tone(stats.recoveryFactor)],
    ["Consecutive wins", stats.consecutiveWins],
    ["Consecutive losses", stats.consecutiveLosses],
    ["Avg trade duration", duration(stats.avgDurationMs)],
    ["Total pips", stats.totalPips],
    ["Open positions", sim.positions.length],
    ["Pending orders", sim.orders.length],
    ["Realized P&L", money(sim.realizedPnl, accountCurrency, true), tone(sim.realizedPnl)],
    ["Floating P&L", money(sim.unrealizedPnl, accountCurrency, true), tone(sim.unrealizedPnl)],
  ];

  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map(([label, value, color]) => (
          <Stat key={label} label={label} value={value} tone={color} />
        ))}
      </div>
      {sim.fatalError && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {sim.fatalError}
        </p>
      )}
    </div>
  );
}

export function AnalyticsPanel({ stats, equityCurve, accountCurrency }) {
  const hasTrades = stats.totalTrades > 0;

  return (
    <div className="space-y-4 p-3">
      <EquityCurvePanel equityCurve={equityCurve} />

      {!hasTrades ? (
        <p className="text-xs text-zinc-500">
          Analytics fill in from the first closed simulated trade. Nothing is projected or estimated.
        </p>
      ) : (
        <>
          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Long vs short</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Stat label="Long" value={`${stats.longPerformance.net >= 0 ? "+" : ""}${money(stats.longPerformance.net, accountCurrency)}`} tone={tone(stats.longPerformance.net)} />
              <Stat label="Long win rate" value={`${stats.longPerformance.winRate}% (${stats.longPerformance.trades})`} />
              <Stat label="Short" value={`${stats.shortPerformance.net >= 0 ? "+" : ""}${money(stats.shortPerformance.net, accountCurrency)}`} tone={tone(stats.shortPerformance.net)} />
              <Stat label="Short win rate" value={`${stats.shortPerformance.winRate}% (${stats.shortPerformance.trades})`} />
            </div>
          </section>

          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">R distribution</p>
            <div className="space-y-1">
              {stats.rDistribution.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-2">
                  <span className="w-20 text-[11px] text-zinc-500">{bucket.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1b1d24]">
                    <div
                      className="h-full bg-purple-500"
                      style={{ width: `${(bucket.count / stats.totalTrades) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] text-zinc-400">{bucket.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Exit reasons</p>
            <div className="grid grid-cols-2 gap-1.5">
              {stats.exitReasons.map((exit) => (
                <Stat
                  key={exit.reason}
                  label={exit.reason}
                  value={`${exit.trades} · ${money(exit.net, accountCurrency, true)}`}
                  tone={tone(exit.net)}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Performance by session (UTC)</p>
            <div className="grid grid-cols-3 gap-1.5">
              {stats.sessions.map((session) => (
                <Stat
                  key={session.id}
                  label={`${session.label} ${session.window}`}
                  value={`${session.trades} · ${money(session.net, accountCurrency, true)}`}
                  tone={tone(session.net)}
                />
              ))}
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              Sessions use the UTC timestamps on the history feed — they are only as accurate as that feed.
            </p>
          </section>

          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Monthly P&amp;L</p>
            <div className="grid grid-cols-3 gap-1.5">
              {stats.monthly.map((month) => (
                <Stat key={month.key} label={month.key} value={money(month.net, accountCurrency, true)} tone={tone(month.net)} />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Daily P&amp;L</p>
            <div className="max-h-40 overflow-auto rounded-lg border border-[#1b1d24]">
              <table className="w-full text-[11px]">
                <tbody>
                  {stats.daily.map((day) => (
                    <tr key={day.key} className="border-t border-[#1b1d24]">
                      <td className="px-2 py-1 text-zinc-400">{day.key}</td>
                      <td className="px-2 py-1 text-right text-zinc-500">{day.trades}</td>
                      <td className="px-2 py-1 text-right tabular-nums" style={{ color: tone(day.net) }}>
                        {money(day.net, accountCurrency, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
