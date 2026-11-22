import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

// ============================================================
// MODIFY VALUE DIALOG
// Used for: modify SL / TP / pending entry / partial close.
// Numeric input with validation + confirm → loading →
// success/error phases. Never reports success until
// onConfirm resolves.
// ============================================================

const AUTO_CLOSE_MS = 1400;

export default function ModifyValueDialog({
  title,
  message,
  label,
  initialValue = "",
  inputStep = "0.00001",
  quickPercents = null,
  max = null,
  hint = null,
  confirmLabel = "Save",
  successLabel = "Updated successfully",
  onConfirm,
  onClose,
}) {
  const [value, setValue] = useState(
    initialValue !== null && initialValue !== undefined
      ? String(initialValue)
      : ""
  );

  const [validationError, setValidationError] = useState(null);
  const [phase, setPhase] = useState("input");
  const [error, setError] = useState(null);

  const submittedRef = useRef(false);
  const autoCloseTimerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

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

  const parsedValue = Number(value);

  const isValid =
    Number.isFinite(parsedValue) &&
    parsedValue > 0 &&
    (max === null || parsedValue < max);

  const applyPercent = (percent) => {
    if (!quickPercents || !Number.isFinite(Number(quickPercents.total))) {
      return;
    }

    const computed =
      Math.round(Number(quickPercents.total) * percent) / 100;

    const rounded = Math.max(
      0.01,
      Number(computed.toFixed(2))
    );

    setValue(String(rounded));
    setValidationError(null);
  };

  const submit = async () => {
    if (submittedRef.current) return;

    if (!isValid) {
      setValidationError(
        max !== null
          ? `Enter a valid number greater than 0 and less than ${max}.`
          : "Enter a valid number greater than 0."
      );

      return;
    }

    submittedRef.current = true;
    setPhase("loading");
    setError(null);

    try {
      await onConfirm?.(parsedValue);

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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
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

        {/* INPUT PHASE */}

        {phase === "input" && (
          <>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </label>

            <input
              ref={inputRef}
              type="number"
              step={inputStep}
              min="0"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setValidationError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submit();
                }

                if (event.key === "Escape") {
                  close();
                }
              }}
              className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-right text-sm font-medium text-gray-900 outline-none transition dark:bg-gray-900 dark:text-gray-100 ${
                validationError
                  ? "border-red-400 focus:border-red-500"
                  : "border-gray-300 focus:border-violet-500 dark:border-gray-600"
              }`}
            />

            {quickPercents && (
              <div className="mt-2.5 flex gap-2">
                {[25, 50, 75].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => applyPercent(percent)}
                    className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-violet-300"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            )}

            {hint && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {hint}
              </p>
            )}

            {validationError && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                {validationError}
              </p>
            )}
          </>
        )}

        {/* LOADING */}

        {phase === "loading" && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60">
            <Loader2
              size={18}
              className="animate-spin text-violet-600"
            />

            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sending to broker...
            </span>
          </div>
        )}

        {/* SUCCESS */}

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

        {/* ERROR */}

        {phase === "error" && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
            />

            <div className="min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Modification failed
              </p>

              <p className="mt-0.5 break-words text-xs text-red-600 dark:text-red-400">
                {error?.message ||
                  "The broker rejected the request."}
              </p>
            </div>
          </div>
        )}

        {/* ACTIONS */}

        <div className="mt-5 flex items-center justify-end gap-2">
          {(phase === "input" || phase === "error") && (
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
                onClick={submit}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
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
        </div>
      </div>
    </div>
  );
}
