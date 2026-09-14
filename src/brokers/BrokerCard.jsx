import React from "react";
import {
  CheckCircle2,
  Landmark,
  ChevronRight,
} from "lucide-react";

export default function BrokerCard({
  broker,
  onClick,
  connected = false,
}) {
  const isAvailable = broker.status === "available";

  return (
    <button
      onClick={() => onClick?.(broker)}
      className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
    >
      {/* =========================================
          TOP SECTION
      ========================================= */}

      <div className="flex items-start justify-between gap-4">
        
        {/* BROKER ICON */}

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            broker.id === "ctrader"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {broker.shortName}
        </div>

        {/* STATUS */}

        <div className="flex items-center gap-2">
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 size={12} />
              Connected
            </span>
          ) : isAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700">
              Available
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              Coming Soon
            </span>
          )}
        </div>
      </div>

      {/* =========================================
          BROKER DETAILS
      ========================================= */}

      <div className="mt-5">
        <h3 className="text-base font-semibold text-slate-900">
          {broker.name}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {broker.description}
        </p>
      </div>

      {/* =========================================
          SUPPORTED MARKETS
      ========================================= */}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">
              Supported Markets
            </p>

            <div className="mt-1 flex items-center gap-1.5">
              <Landmark
                size={14}
                className="text-slate-400"
              />

              <p className="text-sm font-medium text-slate-700">
                {broker.markets}
              </p>
            </div>
          </div>

          <ChevronRight
            size={19}
            className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600"
          />
        </div>
      </div>
    </button>
  );
}