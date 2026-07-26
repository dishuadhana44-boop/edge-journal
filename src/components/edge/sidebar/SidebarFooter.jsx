import { FolderPlus } from "lucide-react";

export default function SidebarFooter({
  collapsed,
  onCreateFolder,
}) {
  return (
    <div className="border-t border-gray-200 p-3 bg-white">

      <button
        onClick={onCreateFolder}
        className="
          w-full
          h-11
          rounded-xl
          bg-violet-600
          hover:bg-violet-700
          text-white
          flex
          items-center
          justify-center
          gap-2
          font-medium
          transition-all
        "
      >
        <FolderPlus size={18} />

        {!collapsed && (
          <span>Create Folder</span>
        )}

      </button>

    </div>
  );
}