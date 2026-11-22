import { AlertTriangle, Brain, RefreshCw } from "lucide-react";
import { format } from "date-fns";

import MarkdownLite from "./MarkdownLite";

export default function MessageBubble({ message, onRetry }) {
  const isUser = message.role === "user";
  const isError = message.kind === "error";

  const time = format(message.createdAt, "HH:mm");

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-2xl rounded-br-md bg-violet-600 px-4 py-3 text-sm leading-6 text-white shadow-sm whitespace-pre-wrap">
            {message.text}
          </div>
          <p className="mt-1 text-right text-[11px] text-gray-400">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          isError ? "bg-red-50 text-red-500" : "bg-violet-50 text-violet-600"
        }`}
      >
        {isError ? <AlertTriangle size={16} /> : <Brain size={16} />}
      </div>

      <div className="min-w-0 max-w-[calc(100%-2.75rem)]">
        <div
          className={`rounded-2xl rounded-tl-md border px-4 py-3 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-gray-200 bg-white text-gray-800 shadow-sm"
          }`}
        >
          {isError ? (
            <div className="space-y-3">
              <p className="text-sm leading-6">{message.text}</p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <RefreshCw size={13} />
                  Try again
                </button>

                {message.code && (
                  <span className="text-[11px] uppercase tracking-wide text-red-400">
                    {message.code}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <MarkdownLite text={message.text} />
          )}
        </div>

        <p className="mt-1 text-[11px] text-gray-400">
          {isError ? "Assistant unavailable" : "EdgeFlo Assistant"} · {time}
        </p>
      </div>
    </div>
  );
}
