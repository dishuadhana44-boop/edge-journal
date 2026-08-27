import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  GripVertical,
} from "lucide-react";

const DEFAULT_ITEMS = [
  {
    id: "trade-plan",
    title: "Review Trade Plan",
    description:
      "Review your setup, bias, entry and invalidation.",
    enabled: true,
  },
  {
    id: "charts",
    title: "Review Charts",
    description:
      "Check market structure, levels and potential setups.",
    enabled: true,
  },
  {
    id: "meditate",
    title: "Meditate",
    description:
      "Take a few minutes to clear your mind before trading.",
    enabled: true,
  },
  {
    id: "calendar",
    title: "Check Economic Calendar",
    description:
      "Review today's important economic events and news.",
    enabled: true,
  },
];

export default function PreMarketSettingsPage() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "preMarketRoutineItems"
      );

      return saved
        ? JSON.parse(saved)
        : DEFAULT_ITEMS;
    } catch {
      return DEFAULT_ITEMS;
    }
  });

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [items]);

  /* ============================================================
     EDIT
  ============================================================ */

  const startEdit = (item) => {
    setEditingId(item.id);

    setForm({
      title: item.title,
      description: item.description,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);

    setForm({
      title: "",
      description: "",
    });
  };

  const saveEdit = () => {
    if (!form.title.trim()) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: form.title.trim(),
              description:
                form.description.trim(),
            }
          : item
      )
    );

    cancelEdit();
  };

  /* ============================================================
     ADD
  ============================================================ */

  const addItem = () => {
    if (!form.title.trim()) return;

    const newItem = {
      id: `routine-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      enabled: true,
    };

    setItems((prev) => [
      ...prev,
      newItem,
    ]);

    cancelEdit();
  };

  /* ============================================================
     DELETE
  ============================================================ */

  const deleteItem = (id) => {
    setItems((prev) =>
      prev.filter((item) => item.id !== id)
    );

    if (editingId === id) {
      cancelEdit();
    }
  };

  /* ============================================================
     TOGGLE
  ============================================================ */

  const toggleItem = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              enabled: !item.enabled,
            }
          : item
      )
    );
  };

  /* ============================================================
     SAVE
  ============================================================ */

  const handleSave = () => {
    localStorage.setItem(
      "preMarketRoutineItems",
      JSON.stringify(items)
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  return (
    <div>

      {/* HEADER */}

      <div className="flex items-start justify-between -mt-6">

        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Pre-Market Routine
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Customize the checklist that must be completed
            before trading.
          </p>
        </div>

        <div className="flex items-center gap-3">

          {saved && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Changes saved
            </span>
          )}

          <button
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
            <Check size={16} />
            Save Changes
          </button>

        </div>

      </div>


      {/* INFO */}

      <div className="
        mt-1
        rounded-xl
        border
        border-violet-100
        bg-violet-50
        px-4
        py-2
      ">

        <p className="text-sm font-medium text-violet-700">
          Pre-market checklist
        </p>

       

      </div>


      {/* ITEMS */}

      <div className="mt-3 space-y-1">

        {items.map((item, index) => (

          <div
            key={item.id}
            className="
              rounded-2xl
              border
              border-gray-200
              bg-white
              p-4
            "
          >

            {editingId === item.id ? (

              /* EDIT MODE */

              <div>

                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      title: e.target.value,
                    })
                  }
                  placeholder="Checklist title"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    px-4
                    py-3
                    text-sm
                    font-medium
                    outline-none
                    focus:border-violet-400
                    focus:ring-2
                    focus:ring-violet-100
                  "
                />

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  placeholder="Description"
                  rows={2}
                  className="
                    w-full
                    mt-3
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    px-4
                    py-3
                    text-sm
                    outline-none
                    resize-none
                    focus:border-violet-400
                    focus:ring-2
                    focus:ring-violet-100
                  "
                />

                <div className="flex justify-end gap-2 mt-3">

                  <button
                    onClick={cancelEdit}
                    className="
                      flex
                      items-center
                      gap-2
                      px-4
                      py-2
                      rounded-lg
                      border
                      border-gray-200
                      text-sm
                      hover:bg-gray-50
                    "
                  >
                    <X size={15} />
                    Cancel
                  </button>

                  <button
                    onClick={saveEdit}
                    className="
                      flex
                      items-center
                      gap-2
                      px-4
                      py-2
                      rounded-lg
                      bg-violet-600
                      text-white
                      text-sm
                      hover:bg-violet-700
                    "
                  >
                    <Check size={15} />
                    Save
                  </button>

                </div>

              </div>

            ) : (

              /* NORMAL MODE */

              <div className="flex items-center gap-4">

                <GripVertical
                  size={18}
                  className="text-gray-300 shrink-0"
                />

                <div className="
                  w-8
                  h-8
                  rounded-lg
                  bg-gray-100
                  flex
                  items-center
                  justify-center
                  text-xs
                  font-semibold
                  text-gray-500
                  shrink-0
                ">
                  {index + 1}
                </div>


                <div className="flex-1 min-w-0">

                  <div className="flex items-center gap-2">

                    <h4 className="
                      text-sm
                      font-semibold
                      text-gray-900
                    ">
                      {item.title}
                    </h4>

                    {!item.enabled && (
                      <span className="
                        text-[10px]
                        font-medium
                        px-2
                        py-0.5
                        rounded-full
                        bg-gray-100
                        text-gray-500
                      ">
                        Disabled
                      </span>
                    )}

                  </div>

                  <p className="
                    mt-1
                    text-xs
                    text-gray-500
                  ">
                    {item.description}
                  </p>

                </div>


                {/* ENABLE */}

                <button
                  onClick={() =>
                    toggleItem(item.id)
                  }
                  className={`
                    relative
                    w-10
                    h-5
                    rounded-full
                    shrink-0
                    transition-colors

                    ${
                      item.enabled
                        ? "bg-violet-600"
                        : "bg-gray-300"
                    }
                  `}
                >

                  <span
                    className={`
                      absolute
                      top-0.5
                      w-4
                      h-4
                      rounded-full
                      bg-white
                      shadow-sm
                      transition-transform

                      ${
                        item.enabled
                          ? "translate-x-5"
                          : "translate-x-0.5"
                      }
                    `}
                  />

                </button>


                {/* EDIT */}

                <button
                  onClick={() =>
                    startEdit(item)
                  }
                  className="
                    w-9
                    h-9
                    rounded-lg
                    flex
                    items-center
                    justify-center
                    text-gray-400
                    hover:text-violet-600
                    hover:bg-violet-50
                    transition
                  "
                >
                  <Pencil size={16} />
                </button>


                {/* DELETE */}

                <button
                  onClick={() =>
                    deleteItem(item.id)
                  }
                  className="
                    w-9
                    h-9
                    rounded-lg
                    flex
                    items-center
                    justify-center
                    text-gray-400
                    hover:text-red-600
                    hover:bg-red-50
                    transition
                  "
                >
                  <Trash2 size={16} />
                </button>

              </div>

            )}

          </div>

        ))}

      </div>


      {/* ADD */}

      {editingId === null && (

        <div className="
          mt-4
          rounded-2xl
          border
          border-dashed
          border-gray-300
          bg-gray-50
          p-5
        ">

<div className="flex items-center justify-between ">

<div className="flex items-center gap-1">
  <Plus
    size={18}
    className="text-violet-600"
  />

  <span className="text-sm font-semibold text-gray-900">
    Add Checklist Item
  </span>
</div>

<button
  onClick={addItem}
  disabled={!form.title.trim()}
  className="
    ml-6
    flex
    items-center
    gap-2
    px-4
    py-2
    rounded-xl
    bg-violet-600
    hover:bg-violet-700
    disabled:bg-gray-300
    disabled:cursor-not-allowed
    text-white
    text-sm
    font-semibold
    transition
  "
>
  <Plus size={16} />
  Add Item
</button>

</div>

          <div className="grid grid-cols-2 gap-3">

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              placeholder="Example: Review risk limits"
              className="
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-violet-400
                focus:ring-2
                focus:ring-violet-100
              "
            />

            <input
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
              placeholder="Short description"
              className="
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                focus:border-violet-400
                focus:ring-2
                focus:ring-violet-100
              "
            />

          </div>

         

        </div>

      )}

    </div>
  );
}