import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export default function ChecklistEditor({
  title,
  placeholder,
  items,
  onChange,
}) {
  const [input, setInput] = useState("");

  function addItem() {
    const value = input.trim();

    if (!value) return;

    onChange([
      ...items,
      {
        id: Date.now(),
        text: value,
        checked: false,
      },
    ]);

    setInput("");
  }

  function toggle(id) {
    onChange(
      items.map((item) =>
        item.id === id
          ? { ...item, checked: !item.checked }
          : item
      )
    );
  }

  function remove(id) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <div className="mb-8">

      <div className="flex items-center justify-between mb-3">

        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
          {title}
        </h3>

        <button
          onClick={addItem}
          className="flex items-center gap-1 text-purple-600 text-sm font-medium"
        >
          <Plus size={14} />
          Add
        </button>

      </div>

      <div className="rounded-xl border border-gray-300 p-4">

        <div className="space-y-3 mb-4">

          {items.map((item) => (

            <div
              key={item.id}
              className="flex items-center gap-3"
            >

              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggle(item.id)}
                className="w-4 h-4 accent-purple-600"
              />

              <span
                className={`flex-1 text-sm ${
                  item.checked
                    ? "line-through text-gray-400"
                    : "text-gray-700"
                }`}
              >
                {item.text}
              </span>

              <button
                onClick={() => remove(item.id)}
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          className="w-full outline-none text-sm"
        />

      </div>

    </div>
  );
}