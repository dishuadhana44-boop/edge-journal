import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Landmark,
  Loader2,
} from "lucide-react";

import { UI_STATUS, UI_STATUS_LABEL } from "../lib/brokerIntegrationModel.js";

// ============================================================
// BROKER CARD (Phase 3, Task 7)
// ============================================================
//
// Presentational: every value on this card comes from its props. The pill is
// derived from `uiStatus` — never from a boolean a caller could leave stale —
// and an account id appears only when the snapshot itself named that account.
// The card carries no diagnostic prose: how a broker is reached, where its
// account list came from and what the transport cannot do are facts the account
// workspace and the live session panel state with the numbers they belong to.

const PILL = {
  [UI_STATUS.loading]: {
    tone: "bg-slate-100 text-slate-600",
    Icon: Loader2,
  },
  [UI_STATUS.connected]: {
    tone: "bg-emerald-100 text-emerald-700",
    Icon: CheckCircle2,
  },
  [UI_STATUS.connecting]: {
    tone: "bg-blue-100 text-blue-700",
    Icon: Loader2,
  },
  [UI_STATUS.disconnected]: {
    tone: "bg-slate-100 text-slate-600",
    Icon: CircleSlash,
  },
  [UI_STATUS.unreachable]: {
    tone: "bg-amber-100 text-amber-700",
    Icon: AlertTriangle,
  },
  [UI_STATUS.error]: {
    tone: "bg-red-100 text-red-700",
    Icon: AlertCircle,
  },
};

// ============================================================
// READS
// ============================================================

function readText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const string = String(value).trim();

  return string === "" ? null : string;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// The registry lists markets as an array, so an unjoined value would reach the
// screen as one unseparated word.
function marketsLine(broker) {
  const markets = Array.isArray(broker?.markets)
    ? broker.markets.map(readText).filter(Boolean).join(", ")
    : readText(broker?.markets);

  return markets === null || markets === "" ? null : markets;
}

// ============================================================
// CARD
// ============================================================

export default function BrokerCard({
  broker,
  snapshot,
  uiStatus = UI_STATUS.loading,
  selected = false,
  onSelect,
}) {
  const block = isRecord(snapshot) ? snapshot : null;
  const status = uiStatus;
  const pill = PILL[status] ?? PILL[UI_STATUS.loading];
  const pillLabel = UI_STATUS_LABEL[status] ?? UI_STATUS_LABEL[UI_STATUS.loading];
  const markets = marketsLine(broker);

  const verifiedIdentity =
    status === UI_STATUS.connected ? readText(block?.identity?.externalId) : null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect?.(broker)}
      className={`group w-full overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md ${
        selected ? "border-violet-400 ring-1 ring-violet-200" : "border-slate-200"
      }`}
    >
      {/* =========================================
          TOP SECTION
      ========================================= */}

      <div className="flex items-start justify-between gap-4">
        {/* BROKER ICON */}

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            broker.id === "ctrader"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {broker.shortName}
        </div>

        {/* STATUS */}

        <div className="flex items-center gap-2">
          <span
            data-status={status}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${pill.tone}`}
          >
            <pill.Icon size={12} />
            {pillLabel}
          </span>

          <ChevronRight
            size={19}
            className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600"
          />
        </div>
      </div>

      {/* =========================================
          BROKER DETAILS
      ========================================= */}

      <div className="mt-5">
        <h3 className="text-base font-semibold text-slate-900">
          {broker.name}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {broker.description}
        </p>

        {markets ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Landmark
              size={13}
              className="shrink-0 text-slate-400"
            />

            <span data-markets={markets}>
              {markets}
            </span>
          </p>
        ) : null}

        {verifiedIdentity ? (
          <p
            data-verified-identity={verifiedIdentity}
            className="mt-3 text-xs font-medium text-emerald-700"
          >
            {`Verified account ${verifiedIdentity}`}
          </p>
        ) : null}
      </div>
    </button>
  );
}
