import {
    Plus,
    MoreVertical,
    BarChart3,
    ChevronDown,
    Pencil,
    Copy,
    LayoutGrid,
    Star,
    Upload,
    Download,
    Archive,
    Trash2,
  } from "lucide-react";
  import { useState, useEffect, useRef } from "react";
 
  
  export default function EdgeHeader({
    onStats,
    onNewPlan,
    
  }) {
    const [menuOpen, setMenuOpen] = useState(false);
  
  
   
  
  
  const menuRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
  
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
  
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  
    return (
      <div className="flex items-center justify-between mb-2">
  
        {/* Left */}
  
        <div className="flex items-center gap-4">
  
          <h1 className="text-[30px] font-bold tracking-tight text-gray-900">
            Edge
          </h1>
  
          <p className="text-[15px] text-gray-500">
            Build and refine your trading playbook.
          </p>
  
        </div>
  
        {/* Right */}
  
        <div className="flex items-center gap-3">
  
          {/* Stats */}
  
          <button
            onClick={onStats}
            className="
            h-10
            px-4
            rounded-xl
            border
            border-gray-300
            bg-white
            hover:bg-gray-50
            flex
            items-center
            gap-2
            font-medium
            transition
          "
          >
            <BarChart3 size={18} />
  
            Stats
          </button>
  
          {/* New Plan */}
  
          <button
            onClick={onNewPlan}
            className="
            h-10
            px-4
            rounded-xl
            bg-violet-600
            hover:bg-violet-700
            text-white
            flex
            items-center
            gap-2
            font-semibold
            shadow-lg
            transition
          "
          >
            <Plus size={18} />
  
            New Plan
  
            <ChevronDown size={16} />
          </button>
  
          {/* Three Dots */}
  
          <div
    ref={menuRef}
    className="relative"
  >
  
  <button
    onClick={() => setMenuOpen(!menuOpen)}
    className="
      h-10
      w-10
      rounded-xl
      border
      border-gray-300
      bg-white
      hover:bg-gray-50
      flex
      items-center
      justify-center
      transition-all
      duration-200
    "
  >
    <MoreVertical size={18} />
  </button>
  
  <div
    className={`
      absolute
      right-0
      top-12
      w-64
  
      bg-white
  
      rounded-2xl
  
      border
      border-gray-200
  
      shadow-2xl
  
      overflow-hidden
  
      z-50
  
      origin-top-right
  
      transition-all
      duration-200
      ease-out
  
      ${
        menuOpen
          ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
          : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
      }
    `}
  >
      {/* EDIT */}
  
  <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50">
    Edit
  </div>
  
  <MenuItem icon={Pencil} label="Rename Plan" />
  
  <MenuItem icon={Copy} label="Duplicate Plan" />
  
  <div className="border-t border-gray-100" />
  
  {/* ORGANIZE */}
  
  <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50">
    Organize
  </div>
  
  <MenuItem icon={LayoutGrid} label="Move to Presets" />
  
  <MenuItem icon={Star} label="Add to Favorites" />
  
  <div className="border-t border-gray-100" />
  
  {/* IMPORT / EXPORT */}
  
  <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50">
    Import / Export
  </div>
  
  <MenuItem icon={Upload} label="Export Plan" />
  
  <MenuItem icon={Download} label="Import Plan" />
  
  <div className="border-t border-gray-100" />
  
  {/* DANGER */}
  
  <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50">
    Danger Zone
  </div>
  
  <MenuItem icon={Archive} label="Archive Plan" />
  
  <MenuItem
    icon={Trash2}
    label="Delete Plan"
    danger
  />
  
    </div>
  
  
  
  </div>
  
  </div>
  
 
  
  </div>
  
  
  );
  }
  
  function MenuItem({
    icon: Icon,
    label,
    danger = false,
  }) {
  
    return (
  
      <button
  
        className={`
  
          w-full
  
          flex
  
          items-center
  
          gap-3
  
          px-5
  
          py-3
  
          text-sm
  
          transition-all
  
          duration-150
  
          ${
            danger
              ? "text-red-600 hover:bg-red-50"
              : "text-gray-700 hover:bg-gray-50"
          }
  
        `}
  
      >
  
        <Icon size={17} />
  
        <span>
  
          {label}
  
        </span>
  
      </button>
  
    );
  
  }