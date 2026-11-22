import React from "react";
import { Check } from "lucide-react";

// ============================================================
// STEP 3C - CHOOSE THE ACCOUNT
// ============================================================
//
// The choices arrive already stripped by accountChoices(): id, name and login,
// and nothing else. What this screen adds is provenance in words, because a
// list the service answered with and a list this device remembered are not the
// same evidence and must not read the same way. A row is never labelled from
// the item it carries - only from the source of the collection it came in.

const LIVE_NOTE = "Live account list, read from the cTrader service.";
const CACHE_NOTE = "Cached account list this device recorded earlier, not a read from the service.";
const NONE_NOTE = "The cTrader service returned no accounts, so there is nothing to choose from.";

export default function AccountSelectModal({
  accountSource = "none",
  choices = [],
  accountId = null,
  busy = false,
  onSelectAccount,
}) {
  const isLive = accountSource === "live";

  const note = isLive
    ? LIVE_NOTE
    : accountSource === "cache"
      ? CACHE_NOTE
      : NONE_NOTE;

  return (
    <div data-account-select className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">
          Select cTrader account
        </p>

        <span
          data-account-source={isLive ? "live" : accountSource}
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isLive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {isLive ? "Live read" : accountSource === "cache" ? "Cached" : "Nothing returned"}
        </span>
      </div>

      <p data-account-provenance className="text-xs leading-relaxed text-slate-500">
        {note}
      </p>

      {choices.length > 0 ? (
        <ul data-account-choices className="space-y-2">
          {choices.map((choice) => {
            const isSelected = choice.accountId === accountId;

            return (
              <li key={choice.accountId}>
                <button
                  type="button"
                  data-account-choice
                  data-account-id={choice.accountId}
                  aria-pressed={isSelected}
                  disabled={busy}
                  onClick={() => onSelectAccount?.(choice.accountId)}
                  className={`w-full rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "border-violet-400 bg-violet-50"
                      : "border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {choice.name ?? choice.label}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {`account ${choice.label}`}
                      </p>

                      {choice.traderLogin ? (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {`login ${choice.traderLogin}`}
                        </p>
                      ) : null}
                    </div>

                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-violet-600"
                      >
                        <Check size={16} />
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p
          data-account-empty
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500"
        >
          No cTrader account was returned, so there is nothing to select yet.
          Reconnect the service, or record an account id on the broker page.
        </p>
      )}

      <p data-account-timing className="text-xs text-slate-500">
        Connecting can take a few moments while the selected account is read
        back and verified.
      </p>
    </div>
  );
}
