import React from "react";
import { Loader2 } from "lucide-react";

import {
  UNAVAILABLE,
  formatMetric,
} from "../../../lib/brokerIntegrationModel.js";
import {
  canonicalBrokerLabel,
  normalizeBrokerKey,
} from "../../../lib/brokerAccountIdentity.js";

// ============================================================
// LIVE SESSION PANEL (Phase 3, Task 7)
// ============================================================
//
// Read-only. Every value below was already attributed to the selected account
// by the model's validator, so this panel takes no handlers at all: nothing on
// this screen can place, change or end an order. A collection the validator
// could not confirm is Unavailable — never zero, never an empty book, and never
// the balance stored locally.

const METRICS = [
  ["balance", "Balance"],
  ["equity", "Equity"],
  ["marginUsed", "Margin used"],
  ["freeMargin", "Free margin"],
  ["currency", "Currency"],
  ["leverage", "Leverage"],
  ["lastSuccessfulSync", "Last successful sync"],
];

// The columns are the fields this broker's own backend reported, per broker, so
// a table never implies a field the source did not send.
const POSITION_COLUMNS = {
  mt5: [
    ["Ticket", (position) => position.ticket],
    ["Symbol", (position) => position.symbol],
    ["Type", (position) => position.type],
    ["Volume", (position) => position.volume],
    ["Open price", (position) => position.price_open],
    ["Current price", (position) => position.price_current],
    ["Stop loss", (position) => position.sl],
    ["Take profit", (position) => position.tp],
    ["Profit", (position) => position.profit],
  ],
  ctrader: [
    ["Position id", (position) => position.positionId],
    ["Symbol", (position) => position.symbol],
    ["Side", (position) => position.side],
    ["Lots", (position) => position.lots],
    ["Entry price", (position) => position.entryPrice],
    ["Stop loss", (position) => position.stopLoss],
    ["Take profit", (position) => position.takeProfit],
    ["Used margin", (position) => position.usedMargin],
  ],
};

const PENDING_ORDER_COLUMNS = {
  mt5: [
    ["Ticket", (order) => order.ticket],
    ["Symbol", (order) => order.symbol],
    ["Type", (order) => order.type],
    ["Volume", (order) => order.volume],
    ["Price", (order) => order.price],
    ["Stop loss", (order) => order.sl],
    ["Take profit", (order) => order.tp],
    ["State", (order) => order.state],
  ],
  ctrader: [],
};

const TABLE_MARKERS = {
  positions: "data-positions-table",
  pendingOrders: "data-pending-orders-table",
};

const MISSING_CELL = "—";

// ============================================================
// READS
// ============================================================

function cellText(value) {
  if (value === null || value === undefined || value === "") {
    return MISSING_CELL;
  }

  return String(value);
}

function metricValue(session, key) {
  if (key === "lastSuccessfulSync") {
    return session.lastSuccessfulSync ?? UNAVAILABLE;
  }

  const metrics = session.metrics;

  if (key === "currency") {
    return metrics.currency ?? UNAVAILABLE;
  }

  if (key === "leverage") {
    return formatMetric(metrics.leverage, { suffix: "x" });
  }

  return formatMetric(metrics[key], { currency: metrics.currency });
}

function columnsFor(spec, brokerKey) {
  return spec[normalizeBrokerKey(brokerKey)] ?? [];
}

function CollectionTable({ kind, columns, items }) {
  return (
    <table
      {...{ [TABLE_MARKERS[kind]]: "" }}
      className="mt-2 w-full min-w-max text-left text-xs"
    >
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          {columns.map(([heading]) => (
            <th
              key={heading}
              className="whitespace-nowrap px-3 py-2 font-medium"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {items.map((item, index) => (
          <tr key={index} className="border-b border-slate-100">
            {columns.map(([heading, read]) => (
              <td
                key={heading}
                className="whitespace-nowrap px-3 py-2 text-slate-700"
              >
                {cellText(read(item))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// COLLECTION STATES
//
// null, empty and populated are three different facts and stay three different
// screens: null means nothing confirmed the collection at all.
// ============================================================

function positionsView(positions) {
  const count = positions?.length ?? 0;

  if (positions === null) {
    return { kind: "unavailable", items: [] };
  }

  if (count === 0) {
    return { kind: "empty", items: [] };
  }

  return { kind: "table", items: positions };
}

function pendingOrdersView(session) {
  const count = session.pendingOrders?.length ?? 0;

  if (session.pendingOrders === null) {
    return { kind: "unavailable", items: [] };
  }

  if (count === 0) {
    return { kind: "empty", items: [] };
  }

  return { kind: "table", items: session.pendingOrders };
}

// ============================================================
// PANEL
// ============================================================

export default function LiveSessionPanel({
  brokerKey,
  session,
  loading = false,
}) {
  const label = canonicalBrokerLabel(brokerKey) ?? "Broker";

  const positions = positionsView(session.positions);
  const pending = pendingOrdersView(session);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {`${label} live session`}
        </h3>

        {loading ? (
          <span
            data-loading
            role="status"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
          >
            <Loader2 size={12} />
            Loading
          </span>
        ) : null}
      </div>

      {session.validationError ? (
        <p
          data-validation-error
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {session.validationError}
        </p>
      ) : null}

      {/* =========================================
          METRICS
      ========================================= */}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {METRICS.map(([key, heading]) => (
          <div key={key}>
            <p className="text-xs text-slate-400">
              {heading}
            </p>

            <p
              data-metric={key}
              className="mt-1 text-sm font-semibold text-slate-800"
            >
              {metricValue(session, key)}
            </p>
          </div>
        ))}
      </div>

      {/* =========================================
          OPEN POSITIONS
      ========================================= */}

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Open positions
        </h4>

        <div data-positions={positions.kind} className="overflow-x-auto">
          {positions.kind === "unavailable" ? (
            <p className="mt-1 text-xs text-slate-500">
              {UNAVAILABLE}
            </p>
          ) : null}

          {positions.kind === "empty" ? (
            <p className="mt-1 text-xs text-slate-500">
              No open positions
            </p>
          ) : null}

          {positions.kind === "table" ? (
            <CollectionTable
              kind="positions"
              columns={columnsFor(POSITION_COLUMNS, brokerKey)}
              items={positions.items}
            />
          ) : null}
        </div>
      </div>

      {/* =========================================
          PENDING ORDERS
      ========================================= */}

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Pending orders
        </h4>

        <div data-pending-orders={pending.kind} className="overflow-x-auto">
          {pending.kind === "unavailable" ? (
            <p className="mt-1 text-xs text-slate-500">
              {UNAVAILABLE}
            </p>
          ) : null}

          {pending.kind === "empty" ? (
            <p className="mt-1 text-xs text-slate-500">
              No pending orders
            </p>
          ) : null}

          {pending.kind === "table" ? (
            <CollectionTable
              kind="pendingOrders"
              columns={columnsFor(PENDING_ORDER_COLUMNS, brokerKey)}
              items={pending.items}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
