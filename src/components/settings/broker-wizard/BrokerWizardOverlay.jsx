import React, { useEffect } from "react";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";

import { STEPS, VERIFICATION } from "../../../lib/brokerWizardModel.js";
import WizardStepper from "./WizardStepper.jsx";
import SearchBrokerStep from "./steps/SearchBrokerStep.jsx";
import ChooseMethodStep from "./steps/ChooseMethodStep.jsx";
import AuthorizationIntroStep from "./steps/AuthorizationIntroStep.jsx";
import AuthorizationPendingStep from "./steps/AuthorizationPendingStep.jsx";
import AccountSelectModal from "./steps/AccountSelectModal.jsx";
import VerificationStep from "./steps/VerificationStep.jsx";

// ============================================================
// BROKER CONNECTION WIZARD - SHELL
// ============================================================
//
// The shell owns layout, the step rail, the footer actions and nothing else.
// Every value it renders arrives as a prop the page derived from
// brokerWizardModel.js, and every click reports upward, so this file can be
// read without the page beside it - and cannot reach a transport, a store, or
// a broker by itself.
//
// The one decision this shell does make is stated twice on purpose, in the two
// guards below: a step may not advance while the model says it is blocked, and
// the final confirmation may not render unless the screen is the account
// screen *and* the session was validated. Those two conditions are the whole
// difference between a wizard that describes a connection and one that claims
// it.

export default function BrokerWizardOverlay({
  screen = "search",
  brokerName = null,
  query = "",
  stepIndex = 1,
  matches = [],
  suggestions = [],
  choices = [],
  accountSource = "none",
  accountId = null,
  verification = VERIFICATION.verifying,
  session = null,
  busy = false,
  error = null,
  canAdvance = true,
  blockReason = null,
  onQuery,
  onPickSaved,
  onContinue,
  onBack,
  onClose,
  onAuthorize,
  onSelectAccount,
  onConnectAccount,
  onRetry,
}) {
  const isConnected =
    screen === "accounts" && verification === VERIFICATION.connected;

  const isBlocked = canAdvance === false || busy === true;

  // Escape is a request to the page, not a local unmount: the page owns whether
  // progress survives the close.
  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  function handlePrimary() {
    if (isConnected) {
      onClose?.();
      return;
    }

    if (isBlocked) {
      return;
    }

    if (screen === "accounts") {
      onConnectAccount?.(accountId);
      return;
    }

    // The introduction has no next screen of its own - the round trip leaves the
    // tab, so only the page can start it.
    if (screen === "intro") {
      onAuthorize?.();
      return;
    }

    onContinue?.();
  }

  function handleBack() {
    if (isBlocked) {
      return;
    }

    onBack?.();
  }

  const body = (() => {
    if (screen === "method") {
      return (
        <ChooseMethodStep
          brokerName={brokerName}
          onSearchAgain={handleBack}
        />
      );
    }

    if (screen === "intro") {
      return <AuthorizationIntroStep brokerName={brokerName} />;
    }

    if (screen === "pending") {
      return <AuthorizationPendingStep brokerName={brokerName} />;
    }

    if (screen === "accounts") {
      return (
        <div className="space-y-4">
          <VerificationStep
            connected={isConnected}
            verification={verification}
            accountId={accountId}
            session={session}
            busy={busy}
            onRetry={onRetry}
          />

          {/* Once a session is validated the choice is settled; leaving the list
              under the confirmation would offer an action that no longer means
              anything. */}
          {isConnected ? null : (
            <AccountSelectModal
              accountSource={accountSource}
              choices={choices}
              accountId={accountId}
              busy={busy}
              onSelectAccount={onSelectAccount}
            />
          )}
        </div>
      );
    }

    return (
      <SearchBrokerStep
        query={query}
        matches={matches}
        suggestions={suggestions}
        onQuery={onQuery}
        onPickSaved={onPickSaved}
      />
    );
  })();

  const primaryProps = isConnected
    ? { "data-wizard-done": "" }
    : screen === "accounts"
      ? { "data-connect-account": "" }
      : { "data-wizard-continue": "" };

  const primaryLabel = isConnected
    ? "Done"
    : screen === "accounts"
      ? "Connect account"
      : screen === "intro"
        ? "Continue to cTrader"
        : "Continue";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="cTrader connection wizard"
        tabIndex={-1}
        data-wizard-overlay
        className="my-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <WizardStepper steps={STEPS} currentIndex={stepIndex} />

            <h2 className="text-base font-semibold text-slate-900">
              Connect an existing account
            </h2>
          </div>

          <button
            type="button"
            data-wizard-close
            aria-label="Close the connection wizard"
            onClick={() => onClose?.()}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-5">{body}</div>

        {error ? (
          <p
            role="alert"
            data-wizard-error
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {error}
          </p>
        ) : null}

        {isBlocked && blockReason ? (
          <p data-block-reason className="mt-4 text-xs text-slate-500">
            {blockReason}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {screen === "search" ? null : (
              <button
                type="button"
                data-wizard-back
                disabled={isBlocked}
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
          </div>

          <button
            type="button"
            {...primaryProps}
            disabled={isBlocked}
            onClick={handlePrimary}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
