import { useMemo } from "react";

import CurveCard from "./CurveCard";
import PerformanceTableCard from "./PerformanceTableCard";
import RecentClosedTrades from "./RecentClosedTrades";

import DrawdownCurve from "../DrawdownCurve";

import {
  buildPeriodPnlSeries,
  buildCumulativePnlSeries,
  buildDirectionPerformance,
  buildSymbolPerformance,
  buildWeekdayPerformance,
  buildRecentClosedTrades,
} from "../../../utils/dashboardCurveEngine";

const NO_TRADES =
  "Not enough closed-trade history for this period.";

// Curves carry a title, subtitle and a row of metrics, so they need two columns
// before their plot area stays readable. Tables stack short cells, but five
// columns only stay legible once each card is ~390px wide, i.e. from xl up.
const CURVE_SPAN = "col-span-12 lg:col-span-6";
const TABLE_SPAN = "col-span-12 md:col-span-6 lg:col-span-6 xl:col-span-4";
const WIDE_TABLE_SPAN = "col-span-12 lg:col-span-6";

const CARD_HEIGHT = "h-[300px]";

function signedMoney(value) {
  const amount = Number(value) || 0;

  return `${amount >= 0 ? "+" : "-"}$${Math.abs(amount).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function compactMoney(value) {
  const amount = Math.abs(Number(value) || 0);

  return `${Number(value) < 0 ? "-" : ""}$${
    amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0)
  }`;
}

function PnlCurve({ title, granularity, scope }) {
  const data = useMemo(
    () =>
      buildPeriodPnlSeries(scope.trades, {
        granularity,
        startDate: scope.startDate,
        endDate: scope.endDate,
      }),
    [granularity, scope.trades, scope.startDate, scope.endDate]
  );

  return (
    <CurveCard
      title={title}
      subtitle="Realised P&L per trading period"
      unit="Net P&L"
      data={data.points}
      dataKeys={[
        {
          key: "pnl",
          label: "Net P&L",
          color: "#6366F1",
          metaKeys: [
            { key: "trades", label: "Trades" },
            { key: "wins", label: "Wins" },
            { key: "losses", label: "Losses" },
          ],
        },
      ]}
      type="bar"
      signed
      formatter={signedMoney}
      axisFormatter={compactMoney}
      emptyMessage={NO_TRADES}
      stats={[
        {
          label: "Total",
          value: signedMoney(data.totalPnl),
          tone: data.totalPnl >= 0 ? "text-green-600" : "text-red-600",
        },
        {
          label: "Best",
          value: data.best ? signedMoney(data.best.pnl) : "—",
          tone: "text-green-600",
        },
        {
          label: "Worst",
          value: data.worst ? signedMoney(data.worst.pnl) : "—",
          tone: "text-red-600",
        },
        { label: "Closed", value: `${data.closedTrades}` },
      ]}
    />
  );
}

function CumulativePnlCurve({ scope }) {
  const data = useMemo(
    () =>
      buildCumulativePnlSeries(scope.trades, {
        startDate: scope.startDate,
        endDate: scope.endDate,
      }),
    [scope.trades, scope.startDate, scope.endDate]
  );

  return (
    <CurveCard
      title="Cumulative P&L Curve"
      subtitle="Running total of realised results, in close order"
      unit="Net P&L"
      data={data.points}
      dataKeys={[
        {
          key: "cumulative",
          label: "Cumulative P&L",
          color: "#8B5CF6",
          baseline: true,
          metaKeys: [
            { key: "pnl", label: "This trade", format: (v) => signedMoney(v) },
            { key: "trades", label: "Closed trades" },
          ],
        },
      ]}
      type="area"
      formatter={signedMoney}
      axisFormatter={compactMoney}
      emptyMessage={NO_TRADES}
      stats={[
        {
          label: "Net",
          value: signedMoney(data.totalPnl),
          tone: data.totalPnl >= 0 ? "text-green-600" : "text-red-600",
        },
        { label: "Closed", value: `${data.closedTrades}` },
      ]}
    />
  );
}

function DirectionPerformance({ scope }) {
  const data = useMemo(
    () =>
      buildDirectionPerformance(scope.trades, {
        startDate: scope.startDate,
        endDate: scope.endDate,
      }),
    [scope.trades, scope.startDate, scope.endDate]
  );

  const rows = data.closedTrades
    ? data.expectedKeys.map((key) => {
        const match = data.rows.find((row) => row.key === key);

        return (
          match ?? {
            key,
            label: key === "long" ? "Long (Buy)" : "Short (Sell)",
            trades: 0,
            netPnl: 0,
            winRate: 0,
            avgR: null,
            share: 0,
          }
        );
      })
    : [];

  return (
    <PerformanceTableCard
      title="Long vs Short Performance"
      subtitle="Closed trades grouped by direction"
      labelHeader="Direction"
      rows={rows}
      emptyMessage={NO_TRADES}
      note={
        data.closedTrades
          ? `${data.closedTrades} closed trade${data.closedTrades === 1 ? "" : "s"} in range`
          : undefined
      }
    />
  );
}

function SymbolPerformance({ scope }) {
  const data = useMemo(
    () =>
      buildSymbolPerformance(scope.trades, {
        startDate: scope.startDate,
        endDate: scope.endDate,
      }),
    [scope.trades, scope.startDate, scope.endDate]
  );

  return (
    <PerformanceTableCard
      title="Performance by Symbol"
      subtitle="Closed trades grouped by instrument"
      labelHeader="Symbol"
      rows={data.rows}
      emptyMessage={NO_TRADES}
      note={
        data.hiddenRows
          ? `${data.hiddenRows} more symbol${data.hiddenRows === 1 ? "" : "s"} not shown`
          : undefined
      }
    />
  );
}

function WeekdayPerformance({ scope }) {
  const data = useMemo(
    () =>
      buildWeekdayPerformance(scope.trades, {
        startDate: scope.startDate,
        endDate: scope.endDate,
      }),
    [scope.trades, scope.startDate, scope.endDate]
  );

  return (
    <PerformanceTableCard
      title="Performance by Weekday"
      subtitle="Realised P&L on the weekday each position closed"
      labelHeader="Weekday"
      rows={data.rows}
      emptyMessage={NO_TRADES}
    />
  );
}

function RecentTradesWidget({ scope }) {
  const rows = useMemo(
    () =>
      buildRecentClosedTrades(scope.trades, {
        startDate: scope.startDate,
        endDate: scope.endDate,
        limit: 20,
      }),
    [scope.trades, scope.startDate, scope.endDate]
  );

  return (
    <RecentClosedTrades
      title="Recent Trades"
      subtitle="Latest closed trades from the journal"
      trades={rows}
      emptyMessage={NO_TRADES}
    />
  );
}

export default function DashboardAnalytics({
  account,
  trades = [],
  startDate,
  endDate,
  sections,
}) {
  const scope = useMemo(
    () => ({ trades, startDate, endDate }),
    [trades, startDate, endDate]
  );

  const startingBalance = Number(account?.startingBalance) || 0;

  const widgets = [
    sections.dailyPnlCurve && {
      key: "dailyPnlCurve",
      span: CURVE_SPAN,
      node: <PnlCurve title="Daily P&L Curve" granularity="day" scope={scope} />,
    },
    sections.weeklyPnlCurve && {
      key: "weeklyPnlCurve",
      span: CURVE_SPAN,
      node: <PnlCurve title="Weekly P&L Curve" granularity="week" scope={scope} />,
    },
    sections.monthlyPnlCurve && {
      key: "monthlyPnlCurve",
      span: CURVE_SPAN,
      node: <PnlCurve title="Monthly P&L Curve" granularity="month" scope={scope} />,
    },
    sections.cumulativePnlCurve && {
      key: "cumulativePnlCurve",
      span: CURVE_SPAN,
      node: <CumulativePnlCurve scope={scope} />,
    },
    sections.drawdownCurve && {
      key: "drawdownCurve",
      span: CURVE_SPAN,
      node: (
        <DrawdownCurve
          trades={trades}
          startingBalance={startingBalance}
          startDate={startDate}
          endDate={endDate}
          mode="amount"
        />
      ),
    },
    sections.drawdownPercent && {
      key: "drawdownPercent",
      span: CURVE_SPAN,
      node: (
        <DrawdownCurve
          trades={trades}
          startingBalance={startingBalance}
          startDate={startDate}
          endDate={endDate}
          mode="percent"
        />
      ),
    },
    sections.longShortPerformance && {
      key: "longShortPerformance",
      span: TABLE_SPAN,
      node: <DirectionPerformance scope={scope} />,
    },
    sections.symbolPerformance && {
      key: "symbolPerformance",
      span: TABLE_SPAN,
      node: <SymbolPerformance scope={scope} />,
    },
    sections.weekdayPerformance && {
      key: "weekdayPerformance",
      span: TABLE_SPAN,
      node: <WeekdayPerformance scope={scope} />,
    },
    sections.recentTrades && {
      key: "recentTrades",
      span: WIDE_TABLE_SPAN,
      node: <RecentTradesWidget scope={scope} />,
    },
  ].filter(Boolean);

  if (widgets.length === 0) return null;

  return (
    <div className="grid shrink-0 grid-cols-12 gap-3">
      {widgets.map((widget) => (
        <div key={widget.key} className={`${widget.span} ${CARD_HEIGHT} min-w-0`}>
          {widget.node}
        </div>
      ))}
    </div>
  );
}
