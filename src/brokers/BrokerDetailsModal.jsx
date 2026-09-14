import React from "react";

import {
  CheckCircle2,
  Landmark,
  Link2,
  ShieldCheck,
  X,
} from "lucide-react";

export default function BrokerDetailsModal({
  broker,
  isOpen,
  onClose,
  onConnect,
}) {
  if (!isOpen || !broker) return null;

  const isAvailable = broker.status === "available";

  const handleConnect = (event) => {
    // Prevent browser/form navigation
    event?.preventDefault();
    event?.stopPropagation();

    if (!isAvailable) return;

    if (onConnect) {
      onConnect(broker);
    }
  };

  const handleClose = (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ============================================================
            HEADER
        ============================================================ */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Broker Details
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Review broker information and integration options.
            </p>
          </div>

          {/* CLOSE BUTTON */}
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* ============================================================
            CONTENT
        ============================================================ */}
        <div className="p-6">

          {/* BROKER INFO */}
          <div className="flex items-start gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
                broker.id === "ctrader"
                  ? "bg-slate-900 text-white"
                  : broker.id === "mt5"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {broker.shortName}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-900">
                  {broker.name}
                </h3>

                {isAvailable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={13} />
                    Available
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    Coming Soon
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {broker.description}
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Landmark size={16} />
                {broker.category}
              </div>
            </div>
          </div>

          {/* ============================================================
              DETAILS CARDS
          ============================================================ */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">

            {/* SUPPORTED MARKETS */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-slate-500">
                <Landmark size={17} />

                <span className="text-xs font-semibold uppercase tracking-wide">
                  Supported Markets
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {broker.markets?.map((market) => (
                  <span
                    key={market}
                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700"
                  >
                    {market}
                  </span>
                ))}
              </div>
            </div>

            {/* INTEGRATION STATUS */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-slate-500">
                <ShieldCheck size={17} />

                <span className="text-xs font-semibold uppercase tracking-wide">
                  Integration Status
                </span>
              </div>

              <p
                className={`mt-4 text-base font-semibold ${
                  isAvailable
                    ? "text-emerald-600"
                    : "text-slate-500"
                }`}
              >
                {isAvailable
                  ? "Available Now"
                  : "Coming Soon"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Connection Type: {broker.connectionType}
              </p>
            </div>
          </div>

          {/* ============================================================
              INTEGRATION FEATURES
          ============================================================ */}
          <div className="mt-5 rounded-2xl bg-slate-50 p-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Integration Features
            </h4>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Trade synchronization",
                "Account information",
                "Position tracking",
                "Performance analytics",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <CheckCircle2
                    size={17}
                    className="text-emerald-500"
                  />

                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* ============================================================
              SECURITY
          ============================================================ */}
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div>
              <h4 className="text-sm font-semibold text-emerald-900">
                Secure Connection
              </h4>

              <p className="mt-2 text-sm leading-6 text-emerald-800">
                EdgeFlo uses secure broker authorization whenever supported.
                Your broker password is never stored inside the application.
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================
            FOOTER
        ============================================================ */}
        <div className="flex justify-end border-t border-slate-100 px-6 py-5">
          {isAvailable ? (
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Link2 size={17} />

              Connect {broker.name}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-400"
            >
              Coming Soon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}