import { useState } from "react";
import {
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import GuardrailsPage from "./GuardrailsPage";
import PreMarketSettingsPage from "./PreMarketSettingsPage";

export default function TradingPreferencesPage() {
  const [activeSection, setActiveSection] = useState("Guardrails");

  return (
    <div className="w-full max-w-6xl mx-auto px-6">

      {/* MAIN WHITE CARD */}

      <div className="bg-white border border-gray-200 rounded-3xl p-5">

        {/* HEADER */}

        <div className="mb-4">

          <h2 className="text-xl font-bold text-gray-900">
            Trading Preferences
          </h2>

         

        </div>


        {/* SUB NAVIGATION */}

        <div className="border-b border-gray-200 mb-8">

          <div className="flex items-center gap-8">

            {/* GUARDRAILS */}

            <button
              type="button"
              onClick={() => setActiveSection("Guardrails")}
              className={`
                flex
                items-center
                gap-2
                pb-3
                text-sm
                whitespace-nowrap
                transition-all

                ${
                  activeSection === "Guardrails"
                    ? "border-b-2 border-violet-600 text-violet-600 font-semibold"
                    : "text-gray-500 hover:text-black"
                }
              `}
            >
              <ShieldCheck size={17} />

              Guardrails
            </button>


            {/* PRE-MARKET */}

            <button
              type="button"
              onClick={() => setActiveSection("Pre-Market")}
              className={`
                flex
                items-center
                gap-2
                pb-3
                text-sm
                whitespace-nowrap
                transition-all

                ${
                  activeSection === "Pre-Market"
                    ? "border-b-2 border-violet-600 text-violet-600 font-semibold"
                    : "text-gray-500 hover:text-black"
                }
              `}
            >
              <ClipboardCheck size={17} />

              Pre-Market Routine
            </button>

          </div>

        </div>


        {/* CONTENT */}

        <div>

          {/* GUARDRAILS */}

          {activeSection === "Guardrails" && (

            <div>

            


              <div className="mt-6">
  <GuardrailsPage />
</div>
            </div>

          )}


          {/* PRE-MARKET */}

          {activeSection === "Pre-Market" && (
  <PreMarketSettingsPage />
)}
        </div>

      </div>

    </div>
  );
}