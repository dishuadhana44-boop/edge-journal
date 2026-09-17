import React from "react";
import {
  CheckCircle2,
  Landmark,
  X,
} from "lucide-react";

import { brokerRegistry } from "./brokerRegistry";

export default function AddBrokerModal({
  isOpen,
  onClose,
  onSelectBroker,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        
        {/* =========================================
            HEADER
        ========================================= */}

        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Add Broker
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Choose a broker or trading platform to connect
              with EdgeFinder.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={19} />
          </button>
        </div>

        {/* =========================================
            BROKER LIST
        ========================================= */}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {brokerRegistry.map((broker) => {
            const isAvailable =
              broker.status === "available";

            return (
              <button
                key={broker.id}
                onClick={() => {
                  onSelectBroker(broker);
                }}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
              >
                {/* BROKER ICON */}

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700 transition group-hover:bg-white">
                  {broker.shortName}
                </div>

                {/* BROKER INFO */}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-slate-900">
                      {broker.name}
                    </h4>

                    {isAvailable ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        <CheckCircle2 size={11} />

                        Available
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {broker.description}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Landmark size={12} />

                    {broker.category}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* =========================================
            FOOTER
        ========================================= */}

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-center text-xs text-slate-400">
            More broker integrations will be added to EdgeFinder
            over time.
          </p>
        </div>
      </div>
    </div>
  );
}