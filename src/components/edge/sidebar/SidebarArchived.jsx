import { ArchiveRestore, Folder } from "lucide-react";

export default function SidebarArchived({
  folders,
  setFolders,
  collapsed,
}) {
  const archivedFolders = folders.filter(
    (folder) => folder.archived
  );

  if (archivedFolders.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">

        <Folder
          size={42}
          className="mx-auto mb-3"
        />

        {!collapsed && (
          <>
            <p className="font-medium">
              No Archived Folders
            </p>

            <p className="text-sm mt-1">
              Archived folders will appear here.
            </p>
          </>
        )}

      </div>
    );
  }

  return (
    <div className="p-3">

      {archivedFolders.map((folder) => (

        <div
          key={folder.id}
          className="
            flex
            items-center
            justify-between
            rounded-xl
            border
            border-gray-200
            bg-white
            p-3
            mb-3
          "
        >

          <div className="flex items-center gap-3">

            <Folder
              size={18}
              className="text-gray-500"
            />

            {!collapsed && (
              <span className="font-medium">
                {folder.name}
              </span>
            )}

          </div>

          {!collapsed && (

            <button
              onClick={() => {

                setFolders((prev) =>
                  prev.map((f) =>
                    f.id === folder.id
                      ? {
                          ...f,
                          archived: false,
                        }
                      : f
                  )
                );

              }}
              className="
                flex
                items-center
                gap-2
                text-violet-600
                hover:text-violet-700
                text-sm
              "
            >

              <ArchiveRestore size={16} />

              Restore

            </button>

          )}

        </div>

      ))}

    </div>
  );
}