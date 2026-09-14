import React from "react";
import {
  Landmark,
  Link2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function BrokerLanding({ onConnect }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <div className="w-full max-w-2xl">

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="p-8 sm:p-12">

            {/* Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
              <Landmark
                size={30}
                className="text-violet-600"
              />
            </div>

            {/* Content */}
            <div className="mt-7 text-center">

              <h2 className="text-2xl font-semibold text-slate-900">
                Connect Your Broker
              </h2>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                Connect your trading account to automatically
                sync your trades, account activity and trading
                performance with EdgeFlo.
              </p>

            </div>

            {/* Connect Button */}
            <div className="mt-8 flex justify-center">

              <button
                onClick={onConnect}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
              >
                <Link2 size={18} />

                Connect Broker

                <ArrowRight size={17} />
              </button>

            </div>

            {/* Security */}
            <div className="mt-10 rounded-xl border border-emerald-100 bg-emerald-50 p-4">

              <div className="flex items-start gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <ShieldCheck
                    size={19}
                    className="text-emerald-600"
                  />
                </div>

                <div>

                  <h3 className="text-sm font-semibold text-emerald-900">
                    Secure Broker Connection
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-emerald-700">
                    EdgeFlo uses secure authorization methods
                    whenever supported. Your broker credentials
                    are not stored inside EdgeFlo.
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* Bottom Info */}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">

              <ShieldCheck
                size={15}
                className="text-slate-400"
              />

              Secure connection • Automatic trade synchronization

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}