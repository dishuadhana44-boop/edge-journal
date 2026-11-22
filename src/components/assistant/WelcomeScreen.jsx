import { ArrowUpRight, Brain } from "lucide-react";

export default function WelcomeScreen({
  suggestions = [],
  onAsk,
  disabled = false,
  dataNote,
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center py-6">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
          <Brain size={26} className="text-violet-600" />
        </div>

        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          Your Personal Trading Assistant
        </h2>

        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">
          Ask about your journal and EdgeFlo computes the numbers from your own
          closed trades before the AI explains them. Pick a starting point below
          or type your own question.
        </p>

        {dataNote && (
          <p className="mx-auto mt-3 inline-block rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-500">
            {dataNote}
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(suggestion)}
            className="group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
              <ArrowUpRight size={16} />
            </span>

            <span className="text-sm font-medium leading-6 text-gray-800">
              {suggestion}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
