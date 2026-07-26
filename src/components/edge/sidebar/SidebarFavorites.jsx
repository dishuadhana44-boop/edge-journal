import { Folder, Star } from "lucide-react";

export default function SidebarFavorites({
  folders,
  collapsed,
}) {

  const favoriteFolders = folders.filter(
    (folder) => folder.favorite
  );

  if (favoriteFolders.length === 0) {

    return (

      <div className="p-8 text-center text-gray-400">

        <Star
          size={42}
          className="mx-auto mb-3"
        />

        {!collapsed && (
          <>
            <p className="font-medium">
              No Favorite Folders
            </p>

            <p className="text-sm mt-1">
              Add folders to favorites from the menu.
            </p>
          </>
        )}

      </div>

    );

  }

  return (

    <div className="p-3">

      {favoriteFolders.map((folder) => (

        <div
          key={folder.id}
          className="
            flex
            items-center
            gap-3
            rounded-xl
            border
            border-gray-200
            bg-white
            p-3
            mb-3
          "
        >

          <Folder
            size={18}
            className="text-violet-600"
          />

          {!collapsed && (

            <div className="flex-1">

              <div className="font-medium">
                {folder.name}
              </div>

              <div className="text-xs text-gray-500">
                {folder.plans.length} Plans
              </div>

            </div>

          )}

          {!collapsed && (

            <Star
              size={16}
              className="fill-yellow-400 text-yellow-400"
            />

          )}

        </div>

      ))}

    </div>

  );

}