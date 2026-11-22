import React from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { VERIFICATION } from "../../../../lib/brokerWizardModel.js";

// ============================================================
// STEP 3/4 - VERIFICATION
// ============================================================
//
// This screen reports what the page's verification pass said, and nothing the
// page did not say. `connected` is handed in rather than computed here: the
// overlay is the only place that may join a screen to a validated session, so
// a component further down the tree cannot decide for itself that a
// connection happened. Every other state is a state of reading - working,
// unavailable, failed - and no number the service did not answer with is
// rendered in any of them.

export default function VerificationStep({
  connected = false,
  verification = VERIFICATION.verifying,
  accountId = null,
  session = null,
  onRetry,
  busy = false,
}) {
  if (connected) {
    return (
      <div
        data-wizard-connected
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <ShieldCheck size={15} />
          Connected account confirmed
        </p>

        <p className="mt-2 text-xs text-emerald-800">
          {`Account ${accountId ?? "reported by the validated session"}`}
        </p>

        <p data-verified-stamp className="mt-1 text-xs text-emerald-700">
          {`Verified by the session validation completed at ${session?.lastSuccessfulSync ?? "an unstated time"}.`}
        </p>
      </div>
    );
  }

  if (verification === VERIFICATION.error) {
    return (
      <div
        data-verification="error"
        className="rounded-2xl border border-red-200 bg-red-50 p-4"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
          <TriangleAlert size={15} />
          The last step did not complete
        </p>

        <p className="mt-2 text-xs leading-relaxed text-red-700">
          Nothing was connected. The page reported the failure above; try the
          same step again.
        </p>

        <button
          type="button"
          data-wizard-retry
          disabled={busy}
          onClick={() => onRetry?.()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Try again
        </button>
      </div>
    );
  }

  if (verification === VERIFICATION.unavailable) {
    return (
      <div
        data-verification="unavailable"
        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <TriangleAlert size={15} className="text-amber-600" />
          Unavailable
        </p>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          The account could not be verified, so this wizard will not call it
          connected. Pick another account or reconnect.
        </p>
      </div>
    );
  }

  return (
    <div
      data-verification="checking"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Loader2 size={15} className="animate-spin text-violet-600" />
        Verifying the cTrader session
      </p>

      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Reading the account back from the service. Nothing is reported until a
        check has answered.
      </p>
    </div>
  );
}
