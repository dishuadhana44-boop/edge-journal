import React from "react";
import { Loader2 } from "lucide-react";

// ============================================================
// STEP 3B - AFTER THE ROUND TRIP
// ============================================================
//
// Reaching this screen means the wizard was resumed, which is a fact about
// where the user was, not about what happened. So the copy separates the two in
// the sentence the test pins: a return is not a connection, and an account is
// only known once the page has read it back from the service.

export default function AuthorizationPendingStep({ brokerName = null }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Loader2 size={15} className="animate-spin text-violet-600" />
          Waiting for you to come back from cTrader
        </p>

        <p data-pending-disclaimer className="mt-2 text-xs leading-relaxed text-slate-600">
          {`Arriving here after the ${brokerName ?? "cTrader"} authorization page is not a connection yet. The wizard verifies the account with the cTrader service before it reports anything as ready.`}
        </p>
      </div>

      <ol data-pending-next className="space-y-2 text-xs text-slate-600">
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-violet-400">
            1
          </span>
          Finish signing in and approve access on cTrader.
        </li>

        <li className="flex gap-2">
          <span aria-hidden="true" className="text-violet-400">
            2
          </span>
          Return to this tab, or continue now if you are already back.
        </li>

        <li className="flex gap-2">
          <span aria-hidden="true" className="text-violet-400">
            3
          </span>
          Choose the account the service reports for this login.
        </li>
      </ol>
    </div>
  );
}
