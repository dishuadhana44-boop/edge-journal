import React from "react";
import { Search } from "lucide-react";

// ============================================================
// STEP 1 - SEARCH THE BROKER
// ============================================================
//
// This app has no broker directory and no endpoint that supplies one, so the
// only honest thing to search is what this device already recorded: the user's
// own saved cTrader accounts. A name that matches nothing is still a name that
// may be carried forward - the list is evidence of what is saved here, not a
// whitelist of what is allowed.
//
// A suggested name is the one thing here the device did not record, so it is
// kept at its actual strength: it appears only once the user has typed toward
// it, it fills the field with that name, and it carries no account and no claim
// that the broker can be connected.

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

export default function SearchBrokerStep({
  query = "",
  matches = [],
  suggestions = [],
  onQuery,
  onPickSaved,
}) {
  const trimmed = typeof query === "string" ? query.trim() : "";

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="wizard-broker-query"
          className="text-xs font-medium text-slate-600"
        >
          Broker or account name
        </label>

        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <Search size={15} />
          </span>

          <input
            id="wizard-broker-query"
            data-wizard-query
            type="text"
            value={query}
            autoComplete="off"
            spellCheck={false}
            placeholder="Start typing"
            onChange={(event) => onQuery?.(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {trimmed === "" ? (
        <p data-search-hint className="text-xs text-slate-500">
          Saved cTrader accounts on this device appear here as you type, along
          with any suggested broker name that matches. Nothing in this list is a
          directory of brokers.
        </p>
      ) : matches.length > 0 ? (
        <ul data-saved-matches className="space-y-2">
          {matches.map((match) => (
            <li key={match.accountId}>
              <button
                type="button"
                data-saved-match
                onClick={() => onPickSaved?.(match)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-violet-300 hover:bg-white"
              >
                <p className="truncate text-sm font-medium text-slate-800">
                  {match.brokerName ?? match.externalId}
                </p>

                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {`cTrader account ${match.externalId}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p data-search-no-match className="text-xs text-slate-500">
          {`No saved account on this device matches "${trimmed}". You can still continue with that name.`}
        </p>
      )}

      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <p data-suggestion-heading className="text-xs font-medium text-slate-600">
            Suggested cTrader name
          </p>

          <ul data-broker-suggestions className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.brokerName}>
                <button
                  type="button"
                  data-broker-suggestion={suggestion.brokerName}
                  onClick={() => onQuery?.(suggestion.brokerName)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
                >
                  <p className="truncate text-sm font-medium text-slate-800">
                    {suggestion.brokerName}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Fills the name in the field; it offers no account of its own.
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
