import React from "react";
import { ShieldCheck } from "lucide-react";

// ============================================================
// STEP 3A - BEFORE THE AUTHORIZATION
// ============================================================
//
// The round trip leaves this tab and comes back as a fresh page load, so this
// screen exists to say what is about to happen and what will not. It is written
// as a promise about the next click, never as a report about a connection: no
// word on this screen may be readable as "already done".

export default function AuthorizationIntroStep({ brokerName = null }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
          <ShieldCheck size={15} />
          {`You are about to leave EdgeFinder for ${brokerName ?? "cTrader"}`}
        </p>

        <p className="mt-2 text-xs leading-relaxed text-violet-800">
          EdgeFinder opens the cTrader authorization page in this tab. Sign in
          there and approve access, then return here. Your credentials are
          entered on cTrader and never in this app.
        </p>
      </div>

      <ul data-intro-points className="space-y-2 text-xs text-slate-600">
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-violet-400">
            ·
          </span>
          Approving access on cTrader does not connect an account on its own.
        </li>

        <li className="flex gap-2">
          <span aria-hidden="true" className="text-violet-400">
            ·
          </span>
          After you return, the wizard still has to read and verify the account.
        </li>

        <li className="flex gap-2">
          <span aria-hidden="true" className="text-violet-400">
            ·
          </span>
          You can come back without approving; nothing is saved as connected.
        </li>
      </ul>
    </div>
  );
}
