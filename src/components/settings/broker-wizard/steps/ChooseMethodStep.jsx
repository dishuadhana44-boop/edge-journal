import React from "react";
import { Check, Link2 } from "lucide-react";

// ============================================================
// STEP 2 - CHOOSE THE CONNECTION METHOD
// ============================================================
//
// One method, because one method exists. The list is a list rather than a
// constant so the card renders from the same shape every other option would
// use - and so a second method has to be *added to this data*, where the tests
// can see it, instead of appearing by accident in markup.

const METHODS = [
  {
    id: "ctrader",
    title: "cTrader",
    note: "Authorize EdgeFinder on the cTrader website, then pick the account to connect.",
    recommended: true,
    selected: true,
  },
];

export default function ChooseMethodStep({
  brokerName = null,
  onPickMethod,
  onSearchAgain,
}) {
  return (
    <div className="space-y-4">
      <p data-method-heading className="text-sm font-medium text-slate-800">
        {`Connection method for ${brokerName ?? "your broker"}`}
      </p>

      <div className="space-y-2">
        {METHODS.map((method) => (
          <button
            key={method.id}
            type="button"
            data-method-card={method.id}
            data-method-selected={method.selected ? "true" : "false"}
            onClick={() => onPickMethod?.(method)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              method.selected
                ? "border-violet-300 bg-violet-50"
                : "border-slate-200 bg-white hover:border-violet-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Link2 size={15} className="shrink-0 text-violet-600" />
                  {method.title}
                </p>

                <p className="mt-1 text-xs text-slate-500">{method.note}</p>
              </div>

              {method.recommended ? (
                <span
                  data-method-recommended={method.id}
                  className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white"
                >
                  Recommended
                </span>
              ) : null}
            </div>

            {method.selected ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
                <Check size={12} />
                Selected
              </p>
            ) : null}
          </button>
        ))}
      </div>

      <button
        type="button"
        data-search-again
        onClick={() => onSearchAgain?.()}
        className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-violet-700 hover:underline"
      >
        Search for a different broker
      </button>
    </div>
  );
}
