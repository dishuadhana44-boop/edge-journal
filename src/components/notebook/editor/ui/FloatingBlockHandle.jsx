import { Plus, GripVertical } from "lucide-react";

function FloatingBlockHandle({
  onPlus,
  onGrip,
}) {
  return (
    <div
      className="
      absolute
      -left-16
      top-2
      hidden
      group-hover:flex
      items-center
      gap-1
      "
    >
      <button
        onClick={onPlus}
        className="
        w-8
        h-8
        rounded-md
        hover:bg-gray-100
        flex
        items-center
        justify-center
        "
      >
        <Plus size={20} />
      </button>

      <button
        onClick={onGrip}
        className="
        w-8
        h-8
        rounded-md
        hover:bg-gray-100
        flex
        items-center
        justify-center
        "
      >
        <GripVertical size={20} />
      </button>
    </div>
  );
}

export default FloatingBlockHandle;