import { MoreVertical } from "lucide-react";

import { useEffect, useRef, useState } from "react";

// ============================================================
// ROW ACTION MENU
// Kebab dropdown used by the open-position and pending-order
// rows. Items: { label, icon, danger, onClick }.
// ============================================================

export default function RowActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);

  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Row actions"
        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          className="
            absolute
            right-0
            top-full
            z-30
            mt-1
            w-48
            overflow-hidden
            rounded-xl
            border
            border-gray-200
            bg-white
            py-1
            shadow-xl
            dark:border-gray-700
            dark:bg-gray-800
          "
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
              className={`
                flex
                w-full
                items-center
                gap-2.5
                px-3.5
                py-2
                text-left
                text-xs
                font-medium
                transition
                ${
                  item.danger
                    ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60"
                }
              `}
            >
              {item.icon}

              <span className="flex-1 whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
