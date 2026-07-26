import {
    Pencil,
    Plus,
    Copy,
    Palette,
    Archive,
    Trash2,
  } from "lucide-react";
  import { Star } from "lucide-react";


  export default function FolderMenu({
    open,
    onRename,
    onCreatePlan,
    onDuplicate,
    onColor,
    onFavorite,
    onArchive,
    onDelete,
  }) {
    if (!open) return null;
  
    return (
      <div
        className="
          absolute
          right-0
          top-9
          w-56
          bg-white
          rounded-2xl
          border
          border-gray-200
          shadow-2xl
          overflow-hidden
          z-50
        "
      >
  
  <MenuItem
  icon={Pencil}
  label="Rename Folder"
  onClick={onRename}
/>

<MenuItem
  icon={Plus}
  label="Create Plan"
  onClick={onCreatePlan}
/>

<MenuItem
  icon={Copy}
  label="Duplicate Folder"
  onClick={onDuplicate}
/>

<MenuItem
  icon={Palette}
  label="Change Color"
  onClick={onColor}
/>

<MenuItem
  icon={Star}
  label="Add to Favorites"
  onClick={onFavorite}
/>

<MenuItem
  icon={Archive}
  label="Archive Folder"
  onClick={onArchive}
/>

<MenuItem
  icon={Trash2}
  label="Delete Folder"
  danger
  onClick={onDelete}
/>
  
      </div>
    );
  }
  
  function MenuItem({
    icon: Icon,
    label,
    danger = false,
    onClick,
  }) {
    return (
      <button
  onClick={onClick}
        className={`
          w-full
          flex
          items-center
          gap-3
          px-4
          py-3
          text-sm
          transition
  
          ${
            danger
              ? "text-red-600 hover:bg-red-50"
              : "text-gray-700 hover:bg-gray-50"
          }
        `}
      >
        <Icon size={16} />
  
        <span>{label}</span>
      </button>
    );
  }