import {
    ArrowRightLeft,
    Palette,
    Link2,
    Copy,
    Move,
    Trash2,
    PencilLine,
    Sparkles,
  } from "lucide-react";
  
  const items = [
    {
      title: "Turn into",
      icon: ArrowRightLeft,
      arrow: true,
    },
    {
      title: "Color",
      icon: Palette,
      arrow: true,
    },
  
    { divider: true },
  
    {
      title: "Copy link to block",
      icon: Link2,
    },
    {
      title: "Duplicate",
      icon: Copy,
    },
    {
      title: "Move to",
      icon: Move,
    },
    {
      title: "Delete",
      icon: Trash2,
      danger: true,
    },
  
    { divider: true },
  
    {
      title: "Suggest edits",
      icon: PencilLine,
    },
    {
      title: "Ask AI",
      icon: Sparkles,
    },
  ];
  
  function BlockMenu({ onClose }) {
    return (
      <div
        className="
        w-[280px]
        bg-white
        rounded-xl
        border
        border-gray-200
        shadow-2xl
        py-2
        "
      >
        {items.map((item, index) => {
          if (item.divider) {
            return (
              <div
                key={index}
                className="my-2 border-t border-gray-200"
              />
            );
          }
  
          const Icon = item.icon;
  
          return (
            <button
              key={item.title}
              onClick={() => onClose?.()}
              className={`
              w-full
              flex
              items-center
              justify-between
              px-3
              py-2.5
              hover:bg-gray-100
              transition
              text-[10px]
              tracking-[0.15em]
              font-semibold
              text-gray-400
              ${
                item.danger
                  ? "text-red-600"
                  : "text-gray-700"
              }
              `}
            >
              <div className="flex items-center gap-3">
  
                <Icon size={17} />
  
                <span className="text-sm">
                  {item.title}
                </span>
  
              </div>
  
              {item.arrow && (
                <span className="text-gray-400">
                  ›
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  
  export default BlockMenu;