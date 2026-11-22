import React from "react";
import { Check } from "lucide-react";

// ============================================================
// WIZARD STEPPER
// ============================================================
//
// The progress indicator only ever reports the step number it was handed. That
// number comes from currentStep(), which promotes the wizard to the final step
// only when a session validator already accepted the round - so a screen name
// can never, on its own, light up the last step.

export default function WizardStepper({ steps = [], currentIndex = 1 }) {
  return (
    <ol
      data-stepper
      aria-label="Connection progress"
      className="flex flex-wrap items-center gap-1.5"
    >
      {steps.map((step, index) => {
        const position = index + 1;

        const state =
          position < currentIndex
            ? "completed"
            : position === currentIndex
              ? "current"
              : "upcoming";

        return (
          <li
            key={step.id}
            data-stepper-item
            data-stepper-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              state === "current"
                ? "bg-violet-600 text-white"
                : state === "completed"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            <span aria-hidden="true" className="inline-flex w-3.5 items-center justify-center">
              {state === "completed" ? <Check size={12} /> : position}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
