import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function ChecklistTags({
  strategy,
  setStrategy,
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const value = input.trim();

    if (!value) return;

    if (strategy.checklistTags.includes(value)) {
      setInput("");
      return;
    }

    setStrategy({
      ...strategy,
      checklistTags: [
        ...strategy.checklistTags,
        value,
      ],
    });

    setInput("");
  }

  function removeTag(tag) {
    setStrategy({
      ...strategy,
      checklistTags: strategy.checklistTags.filter(
        (t) => t !== tag
      ),
    });
  }

  return (
    <div className="mb-8">

      <div className="flex items-center justify-between mb-3">

        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
          Charting Process
        </h3>

        <button
          onClick={addTag}
          className="flex items-center gap-1 text-purple-600 text-sm font-medium"
        >
          <Plus size={14} />
          Add
        </button>

      </div>

      <div className="rounded-xl border border-gray-300 p-4">

        <div className="flex flex-wrap gap-2 mb-3">

          {strategy.checklistTags.map((tag) => (

            <div
              key={tag}
              className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
            >
              {tag}

              <button
                onClick={() => removeTag(tag)}
              >
                <X size={14} />
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
              addTag();
            }
          }}
          placeholder="Type tag and press Enter..."
          className="w-full outline-none text-sm"
        />

      </div>

    </div>
  );
}