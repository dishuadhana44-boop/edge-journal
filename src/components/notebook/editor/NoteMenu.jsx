import { useState, useRef, useEffect } from "react";
import {
  Pencil,
  Copy,
  Star,
  Download,
  Trash2,
} from "lucide-react";

function NoteMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const item =
    "w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition text-sm";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-gray-100 transition"
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">

<button
  className={item}
  onClick={() => {
    const newName = prompt("Enter new note title");

    if (newName) {
      console.log("New Title:", newName);
    }

    setOpen(false);
  }}
>
  <Pencil size={16} />
  Rename
</button>

          <button className={item}>
            <Copy size={16} />
            Duplicate
          </button>

          <button className={item}>
            <Star size={16} />
            Add to Favorites
          </button>

          <button className={item}>
            <Download size={16} />
            Export
          </button>

          <hr />

          <button className={`${item} text-red-600`}>
            <Trash2 size={16} />
            Delete
          </button>

        </div>
      )}
    </div>
  );
}

export default NoteMenu;