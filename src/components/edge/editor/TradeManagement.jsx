import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export default function TradeManagement({
  strategy,
  setStrategy,
}) {
  const [input, setInput] = useState("");

  function addRule() {
    const value = input.trim();

    if (!value) return;

    setStrategy({
      ...strategy,
      managementRules: [
        ...strategy.managementRules,
        value,
      ],
    });

    setInput("");
  }

  function removeRule(index) {
    setStrategy({
      ...strategy,
      managementRules: strategy.managementRules.filter(
        (_, i) => i !== index
      ),
    });
  }

  return (
    <div className="mb-2">

      <div className="flex items-center justify-between mb-4">

        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
          Trade Management Rules
        </h3>

        <button
          onClick={addRule}
          className="flex items-center gap-1 text-sm font-medium text-purple-600"
        >
          <Plus size={14} />
          Add Rule
        </button>

      </div>

      <div className="rounded-2xl border border-gray-300 p-5">

        <div className="space-y-3 mb-4">

          {strategy.managementRules.map((rule, index) => (

            <div
              key={index}
              className="flex items-center gap-3"
            >

              <span className="text-xl leading-none">
                •
              </span>

              <span className="flex-1 text-sm">
                {rule}
              </span>

              <button
                onClick={() => removeRule(index)}
              >
                <Trash2
                  size={15}
                  className="text-gray-400 hover:text-red-500"
                />
              </button>

            </div>

          ))}

        </div>

        <input
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRule();
            }
          }}
          placeholder="Type rule and press Enter..."
          className="w-full outline-none text-sm"
        />

      </div>

    </div>
  );
}