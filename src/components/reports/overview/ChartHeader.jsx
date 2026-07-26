import { useState } from "react";
import { Download, Settings2 } from "lucide-react";

export default function ChartHeader() {
  const [period, setPeriod] = useState("1Y");
  const [mode, setMode] = useState("Balance");

  const periods = [
    "1D",
    "1W",
    "1M",
    "3M",
    "6M",
    "1Y",
    "ALL",
  ];

  const modes = [
    "Balance",
    "Equity",
    "Drawdown",
  ];

  return (
    <div className="flex items-center justify-between px-6 py-2 border-b">

      {/* Left */}

      <div>

        <h2 className="text-lg font-semibold text-gray-900">
          Overview Equity
        </h2>

       
      </div>

      {/* Right */}

      <div className="flex items-center gap-2">

        {/* Period Buttons */}

        <div className="flex bg-gray-100 rounded-xl p-1">

          {periods.map((item) => (

            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                period === item
                  ? "bg-violet-600 text-white shadow"
                  : "text-gray-600 hover:bg-white"
              }`}
            >
              {item}
            </button>

          ))}

        </div>

        {/* Mode */}

        <div className="flex bg-gray-100 rounded-xl p-1">

          {modes.map((item) => (

            <button
              key={item}
              onClick={() => setMode(item)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                mode === item
                  ? "bg-violet-600 text-white shadow"
                  : "text-gray-600 hover:bg-white"
              }`}
            >
              {item}
            </button>

          ))}

        </div>

        {/* Export */}

        <button className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition">

          <Download size={17} />

        </button>

        {/* Settings */}

        <button className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition">

          <Settings2 size={17} />

        </button>

      </div>

    </div>
  );
}