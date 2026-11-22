import React, { useState } from "react";
import {
  KeyRound,
  Plug,
  PlugZap,
  Plus,
} from "lucide-react";

import {
  canonicalBrokerLabel,
  normalizeBrokerKey,
} from "../../../lib/brokerAccountIdentity.js";

// ============================================================
// ACCOUNT WORKSPACE (Phase 3, Task 7)
// ============================================================
//
// The per-broker account list and its connection controls. Presentational: it
// renders the rows the model produced and reports clicks through the handlers
// it was given. It never fetches, never writes storage, and never changes the
// globally selected account on its own — the page owns that.
//
// A row is only ever as strong as the evidence behind it. The live badge is
// reserved for the one row the live session confirmed; every other stored
// record is labelled as what it is, and a record with no local id is listed but
// not selectable, because nothing could be attributed to it. The badge carries
// that provenance without a paragraph explaining the transport behind it.

const LIVE_BADGE = { kind: "live", label: "Live session" };
const CACHED_BADGE = { kind: "cached", label: "Cached record" };

const CT_SETUP_COPY =
  "Add a cTrader account id so you can select it after authorizing.";

// ============================================================
// ROW READS
// ============================================================

function identityLine(row) {
  const parts = [];

  if (row.identity.externalId) {
    parts.push(`account ${row.identity.externalId}`);
  }

  if (row.identity.server) {
    parts.push(`server ${row.identity.server}`);
  }

  return parts.join(" · ");
}

// ============================================================
// WORKSPACE
// ============================================================

export default function AccountWorkspace({
  brokerKey,
  rows = [],
  selectedAccountId = null,
  onSelectAccount,
  onConnect,
  onDisconnect,
  onStartService,
  onAddCtraderAccount,
  busy = false,
  error = null,
}) {
  const [accountIdInput, setAccountIdInput] = useState("");
  const [accountNameInput, setAccountNameInput] = useState("");

  const key = normalizeBrokerKey(brokerKey);
  const isCtrader = key === "ctrader";
  const label = canonicalBrokerLabel(brokerKey) ?? "This broker";

  // cTrader authorises an OAuth account, so the offer names the account count;
  // MT5 attaches to whichever terminal session is logged in.
  const connectLabel = isCtrader
    ? rows.length > 0
      ? "Reauthorize"
      : "Authorize"
    : rows.some((row) => row.isLiveSession)
      ? "Reconnect"
      : "Connect";

  function handleSubmit(event) {
    event.preventDefault();

    const accountId = accountIdInput.trim();

    if (!accountId) return;

    onAddCtraderAccount?.({
      accountId,
      accountName: accountNameInput.trim(),
    });

    setAccountIdInput("");
    setAccountNameInput("");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">
        {`${label} accounts`}
      </h3>

      {/* =========================================
          ACCOUNT ROWS
      ========================================= */}

      {rows.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => {
            const badge = row.isLiveSession ? LIVE_BADGE : CACHED_BADGE;

            const selectable = row.identity.accountId !== null;
            const isSelected =
              selectable && row.identity.accountId === selectedAccountId;

            const details = identityLine(row);

            return (
              <li
                key={row.rowKey}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {row.account?.accountName ?? row.rowKey}
                    </p>

                    {details ? (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {details}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        data-provenance={badge.kind}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          badge.kind === "live"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {badge.label}
                      </span>

                      {row.identity.externalId === null ? (
                        <span
                          data-incomplete
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        >
                          Incomplete
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {selectable ? (
                      <button
                        type="button"
                        data-row-key={row.rowKey}
                        aria-pressed={isSelected}
                        disabled={busy}
                        onClick={() => onSelectAccount?.(row)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          isSelected
                            ? "bg-violet-600 text-white"
                            : "border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    ) : (
                      <div
                        data-row-key={row.rowKey}
                        className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400"
                      >
                        Not selectable
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* =========================================
          CONNECTION ACTIONS
      ========================================= */}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-action="connect"
          disabled={busy}
          onClick={() => onConnect?.()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <KeyRound size={14} />
          {connectLabel}
        </button>

        <button
          type="button"
          data-action="disconnect"
          disabled={busy}
          onClick={() => onDisconnect?.()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plug size={14} />
          Disconnect
        </button>

        {isCtrader ? (
          <button
            type="button"
            data-action="start-service"
            disabled={busy}
            onClick={() => onStartService?.()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlugZap size={14} />
            Start service
          </button>
        ) : null}
      </div>

      {/* =========================================
          cTRADER ACCOUNT SETUP
      ========================================= */}

      {isCtrader ? (
        <form
          data-ctrader-setup
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <p className="text-xs font-medium text-slate-600">
            {CT_SETUP_COPY}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Account id
              <input
                name="accountId"
                value={accountIdInput}
                disabled={busy}
                onChange={(event) => setAccountIdInput(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            <label className="block text-xs font-medium text-slate-600">
              Account name
              <input
                name="accountName"
                value={accountNameInput}
                disabled={busy}
                onChange={(event) => setAccountNameInput(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            Add account
          </button>
        </form>
      ) : null}

      {/* =========================================
          ERROR
      ========================================= */}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
