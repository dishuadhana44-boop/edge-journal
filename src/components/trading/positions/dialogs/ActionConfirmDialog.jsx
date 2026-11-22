import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

// ============================================================
// GENERIC ACTION CONFIRMATION DIALOG
// Used for: close position, bulk close, cancel pending order,
// bulk cancel. Manages confirm → loading → success/error
// phases. Never reports success until onConfirm resolves.
// ============================================================

const AUTO_CLOSE_MS = 1600;

export default function ActionConfirmDialog({
  title,
  message,
  items = [],
  itemNote = null,
  confirmLabel = "Confirm",
  loadingLabel = "Processing...",
  successLabel = "Completed successfully",
  danger = true,
  onConfirm,
  onClose,
}) {
  const [phase, setPhase] = useState("confirm");
  const [error, setError] = useState(null);

  const submittedRef = useRef(false);
  const autoCloseTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  const close = () => {
    if (phase === "loading") return;
    onClose?.();
  };

  const run = async () => {
    if (submittedRef.current) return;

    submittedRef.current = true;
    setPhase("loading");
    setError(null);

    try {
      await onConfirm?.();

      setPhase("success");

      autoCloseTimerRef.current = setTimeout(() => {
        onClose?.();
      }, AUTO_CLOSE_MS);
    } catch (confirmError) {
      submittedRef.current = false;
      setError(confirmError);
      setPhase("error");
    }
  };

  const renderItems = () => {
    if (!items.length) return null;

    return (
      <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/60">
        {items.map((item, index) => (
          <div
            key={`${item.symbol}-${item.meta}-${index}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm dark:bg-gray-800"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  item.side === "SELL"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                }`}
              >
                {item.side || "—"}
              </span>

              <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
                {item.symbol}
              </span>

              <span className="shrink-0 text-gray-500 dark:text-gray-400">
                {item.volume}
              </span>
            </div>

            {item.pnl !== undefined && item.pnl !== null && (
              <span
                className={`shrink-0 font-semibold ${
                  item.pnl >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {item.pnlLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        {/* HEADER */}

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>

            {message && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {message}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={close}
            disabled={phase === "loading"}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* ITEM LIST */}

        {phase === "confirm" && renderItems()}

        {itemNote && phase !== "success" && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {itemNote}
          </p>
        )}

        {/* BODY PHASES */}

        {phase === "loading" && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60">
            <Loader2
              size={18}
              className="animate-spin text-violet-600"
            />

            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {loadingLabel}
            </span>
          </div>
        )}

        {phase === "success" && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
            <CheckCircle2
              size={18}
              className="text-emerald-600 dark:text-emerald-400"
            />

            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {successLabel}
            </span>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
              />

              <div className="min-w-0">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Action failed
                </p>

                <p className="mt-0.5 break-words text-xs text-red-600 dark:text-red-400">
                  {error?.message ||
                    "The broker rejected the request. No changes were reported as successful."}
                </p>

                {error?.partial?.failures?.length > 0 && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {error.partial.succeeded} succeeded,{" "}
                    {error.partial.failures.length} failed. First
                    failure: {error.partial.failures[0].symbol} —{" "}
                    {error.partial.failures[0].error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ACTIONS */}

        <div className="mt-5 flex items-center justify-end gap-2">
          {phase === "confirm" && (
            <>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={run}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                  danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-violet-600 hover:bg-violet-700"
                }`}
              >
                {confirmLabel}
              </button>
            </>
          )}

          {phase === "loading" && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Please wait — do not close this window
            </span>
          )}

          {phase === "error" && (
            <>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Close
              </button>

              <button
                type="button"
                onClick={run}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
