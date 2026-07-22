import { Plus, GripVertical } from "lucide-react";

function BlockToolbar({
  onPlusClick,
  onGripClick,
}) {
  return (
    <div className="flex items-center gap-0 mb-2">

<button
  onMouseDown={(e) => e.preventDefault()}
  onClick={onPlusClick}
  className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
>
  <Plus size={20} strokeWidth={2.2} />
</button>

<button
  onMouseDown={(e) => e.preventDefault()}
  onClick={onGripClick}
  className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
>
  <GripVertical size={20} strokeWidth={2.2} />
</button>

      <span
        className="
          text-gray-500
          text-sm
          select-none
          pointer-events-none
        "
      >
        Type '/' for commands...
      </span>

    </div>
  );
}

export default BlockToolbar;