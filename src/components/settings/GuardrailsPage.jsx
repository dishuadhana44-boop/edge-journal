import { useEffect, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";

const DEFAULT_GUARDRAILS = {
  enabled: true,

  maxTradesPerDay: 10,

  maxDailyLoss: 500,

  maxDailyProfit: 1000,

  // Maximum dollar risk allowed on one trade
  maxRiskPerTrade: 1000,

  // Default risk percentage per trade
  riskPerTrade: 1,

  maxConsecutiveLosses: 3,

  maxPositionSize: 5,

  tradingWindowStart: "11:30",

  tradingWindowEnd: "20:30",
};

export default function GuardrailsPage() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("tradingGuardrails");

      return saved
        ? { ...DEFAULT_GUARDRAILS, ...JSON.parse(saved) }
        : DEFAULT_GUARDRAILS;
    } catch {
      return DEFAULT_GUARDRAILS;
    }
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    localStorage.setItem(
      "tradingGuardrails",
      JSON.stringify(settings)
    );
  
    // Notify other components immediately
    window.dispatchEvent(
      new Event("guardrailsUpdated")
    );
  
    setSaved(true);
  
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };
  
  return (
    <div>

      {/* SECTION HEADER */}

      <div className="flex items-start justify-between">

        <div className="flex items-start gap-3">

          <div className="
            w-10
            h-10
            rounded-xl
            bg-violet-50
            text-violet-600
            flex
            items-center
            justify-center
          ">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Guardrails
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Set limits to protect your trading discipline and risk.
            </p>
          </div>

        </div>


        {/* ENABLE TOGGLE */}

        <button
          type="button"
          onClick={() =>
            updateSetting(
              "enabled",
              !settings.enabled
            )
          }
          className={`
            relative
            w-11
            h-6
            rounded-full
            transition-colors
            duration-200

            ${
              settings.enabled
                ? "bg-violet-600"
                : "bg-gray-300"
            }
          `}
        >

          <span
            className={`
              absolute
              top-1
              w-4
              h-4
              rounded-full
              bg-white
              shadow-sm
              transition-transform
              duration-200

              ${
                settings.enabled
                  ? "translate-x-6"
                  : "translate-x-1"
              }
            `}
          />

        </button>

      </div>


      {/* STATUS */}

      <div
        className={`
          mt-6
          rounded-xl
          border
          px-4
          py-3

          ${
            settings.enabled
              ? "bg-violet-50 border-violet-100"
              : "bg-gray-50 border-gray-200"
          }
        `}
      >

        <div
          className={`
            text-sm
            font-medium
            ${
              settings.enabled
                ? "text-violet-700"
                : "text-gray-600"
            }
          `}
        >
          {settings.enabled
            ? "Guardrails are active"
            : "Guardrails are disabled"}
        </div>

        <p className="mt-1 text-xs text-gray-500">
          {settings.enabled
            ? ""
            : ""}
        </p>

      </div>


      {/* SETTINGS GRID */}

      <div className="mt-2 grid grid-cols-3 gap-2">

        {/* MAX TRADES */}

        <SettingInput
          label="Max Trades Per Day"
          
          value={settings.maxTradesPerDay}
          onChange={(value) =>
            updateSetting("maxTradesPerDay", value)
          }
          min="1"
          suffix="trades"
        />


        {/* MAX DAILY LOSS */}

        <SettingInput
          label="Max Daily Loss"
         
          value={settings.maxDailyLoss}
          onChange={(value) =>
            updateSetting("maxDailyLoss", value)
          }
          min="0"
          suffix="USD"
        />


        {/* MAX DAILY PROFIT */}

        <SettingInput
          label="Max Daily Profit"
          
          value={settings.maxDailyProfit}
          onChange={(value) =>
            updateSetting("maxDailyProfit", value)
          }
          min="0"
          suffix="USD"
        />


        {/* MAX RISK */}

        <SettingInput
          label="Max Risk Per Trade"
          
          value={settings.maxRiskPerTrade}
          onChange={(value) =>
            updateSetting("maxRiskPerTrade", value)
          }
          min="0"
          suffix="USD"
        />


      {/* RISK PER TRADE */}

<SettingInput
  label="Risk Per Trade"
  value={settings.riskPerTrade}
  onChange={(value) =>
    updateSetting("riskPerTrade", value)
  }
  min="0.25"
  max="10"
  step="0.25"
  suffix="%"
/>

{/* TRADING WINDOW */}

<div className="
  rounded-2xl
  border
  border-gray-200
  bg-white
  p-5
">

  <label className="
    block
    text-sm
    font-semibold
    text-gray-900
  ">
    Trading Window
  </label>

  <p className="
    mt-1
    text-xs
    leading-5
    text-gray-500
  ">
    
  </p>

  <div className="grid grid-cols-2 gap-3 mt-4">

    <div>
      <label className="text-[11px] text-gray-500">
        Start
      </label>

      <input
        type="time"
        value={settings.tradingWindowStart}
        onChange={(e) =>
          updateSetting(
            "tradingWindowStart",
            e.target.value
          )
        }
        className="
          w-full
          mt-1
          rounded-xl
          border
          border-gray-200
          bg-gray-50
          px-3
          py-3
          text-sm
          font-medium
          text-gray-900
          outline-none
          focus:border-violet-400
          focus:ring-2
          focus:ring-violet-100
        "
      />
    </div>

    <div>
      <label className="text-[11px] text-gray-500">
        End
      </label>

      <input
        type="time"
        value={settings.tradingWindowEnd}
        onChange={(e) =>
          updateSetting(
            "tradingWindowEnd",
            e.target.value
          )
        }
        className="
          w-full
          mt-1
          rounded-xl
          border
          border-gray-200
          bg-gray-50
          px-3
          py-3
          text-sm
          font-medium
          text-gray-900
          outline-none
          focus:border-violet-400
          focus:ring-2
          focus:ring-violet-100
        "
      />
    </div>

  </div>

</div>

      </div>


      {/* SAVE */}

      <div className="
        mt-8
        flex
        items-center
        justify-end
        gap-3
        border-t
        border-gray-100
        pt-6
      ">

        {saved && (
          <span className="text-sm text-emerald-600 font-medium">
            ✓ Changes saved
          </span>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="
            flex
            items-center
            gap-2
            px-5
            py-2.5
            rounded-xl
            bg-violet-600
            hover:bg-violet-700
            text-white
            text-sm
            font-semibold
            transition-all
            duration-200
            hover:-translate-y-[1px]
            hover:shadow-md
          "
        >
          <Save size={16} />

          Save Changes
        </button>

      </div>

    </div>
  );
}


/* ============================================================
   INPUT COMPONENT
============================================================ */

function SettingInput({
  label,
  description,
  value,
  onChange,
  min = "0",
  step = "1",
  suffix,
}) {
  return (
    <div className="
      rounded-2xl
      border
      border-gray-200
      bg-white
      p-5
    ">

      <label className="
        block
        text-sm
        font-semibold
        text-gray-900
      ">
        {label}
      </label>

      <p className="
        mt-1
        text-xs
        leading-5
        text-gray-500
      ">
        {description}
      </p>


      <div className="relative mt-4">

        <input
          type="number"
          min={min}
          step={step}
          value={value}
          disabled={false}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? ""
                : Number(e.target.value)
            )
          }
          className="
            w-full
            rounded-xl
            border
            border-gray-200
            bg-gray-50
            px-4
            py-3
            pr-16
            text-sm
            font-medium
            text-gray-900
            outline-none
            transition
            focus:border-violet-400
            focus:ring-2
            focus:ring-violet-100
          "
        />

        <span className="
          absolute
          right-4
          top-1/2
          -translate-y-1/2
          text-xs
          font-medium
          text-gray-400
        ">
          {suffix}
        </span>

      </div>

    </div>
  );
}