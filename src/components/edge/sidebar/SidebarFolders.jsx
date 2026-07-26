import { useState, useEffect, useRef } from "react";

import CreateFolderModal from "../modals/CreateFolderModal";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import FolderMenu from "./FolderMenu";

const initialFolders = [
  {
    id: 1,
    name: "Commodities",
    plans: [],
    archived: false,
    favorite: false,
  },
  {
    id: 2,
    name: "Forex",
    plans: [],
archived: false,
favorite: false,
  },
  {
    id: 3,
    name: "Crypto",
    plans: [],
archived: false,
favorite: false,
  },
];

export default function SidebarFolders({
  collapsed,
  folders,
  setFolders,
}) {
  const [openFolders, setOpenFolders] = useState([1, 2, 3]);

  const [editingFolderId, setEditingFolderId] = useState(null);

const [editingName, setEditingName] = useState("");
 
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {

    function handleClickOutside(event) {
  
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setActiveMenu(null);
      }
  
    }
  
    function handleKeyDown(event) {
  
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
  
    }
  
    document.addEventListener(
      "mousedown",
      handleClickOutside
    );
  
    document.addEventListener(
      "keydown",
      handleKeyDown
    );
  
    return () => {
  
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
  
    };
  
  }, []);

  const toggleFolder = (id) => {
    if (openFolders.includes(id)) {
      setOpenFolders(openFolders.filter((x) => x !== id));
    } else {
      setOpenFolders([...openFolders, id]);
    }
  };

  return (
    <div className="p-3 pb-24">

      {!collapsed && (
        <p className="text-xs uppercase tracking-wider text-gray-400 mb-3 px-2">
          My Plans
        </p>
      )}

      {folders
  .filter(folder => !folder.archived)
  .map((folder) => (
        <div key={folder.id} className="mb-2">

          {/* Folder */}

          <div
  onClick={() => toggleFolder(folder.id)}
  className="
    w-full
    flex
    items-center
    justify-between
    rounded-lg
    hover:bg-gray-100
    px-2
    py-2
    cursor-pointer
    transition
  "
>
            <div className="flex items-center gap-2">

              {!collapsed &&
                (openFolders.includes(folder.id)
                  ? <ChevronDown size={15} />
                  : <ChevronRight size={15} />)}

<Folder
  size={18}
  className="text-violet-600"
/>

{!collapsed && (

  editingFolderId === folder.id ? (

    <input
      autoFocus
      value={editingName}
      onChange={(e) =>
        setEditingName(e.target.value)
      }

      onKeyDown={(e) => {

        if (e.key === "Enter") {

          setFolders((prev) =>
            prev.map((f) =>
              f.id === folder.id
                ? {
                    ...f,
                    name: editingName,
                  }
                : f
            )
          );

          setEditingFolderId(null);

        }

        if (e.key === "Escape") {

          setEditingFolderId(null);

        }

      }}

      onBlur={() => {

        setFolders((prev) =>
          prev.map((f) =>
            f.id === folder.id
              ? {
                  ...f,
                  name: editingName,
                }
              : f
          )
        );

        setEditingFolderId(null);

      }}

      className="
        h-8
        w-full
        rounded-lg
        border
        border-violet-400
        px-2
        text-sm
        outline-none
      "
    />

  ) : (

    <span className="font-medium">
      {folder.name}
    </span>

  )

)}

            </div>

            {!collapsed && (

<div
  ref={menuRef}
  className="relative overflow-visible"
>

  <button
    onClick={(e) => {
      e.stopPropagation();

      setActiveMenu(
        activeMenu === folder.id
          ? null
          : folder.id
      );
    }}
    className="
      p-1.5
      rounded-lg
      hover:bg-gray-100
      transition
    "
  >
    <MoreHorizontal size={16} />
  </button>

  <FolderMenu
  open={activeMenu === folder.id}

  onRename={() => {

    setEditingFolderId(folder.id);
  
    setEditingName(folder.name);
  
    setActiveMenu(null);
  
  }}

  onCreatePlan={() => {

    setCreatePlanFolder(folder.id);
  
    setShowCreatePlan(true);
  
    setActiveMenu(null);
  
  }}

  onFavorite={() => {

    setFolders(prev =>
      prev.map(f =>
        f.id === folder.id
          ? {
              ...f,
              favorite: !f.favorite,
            }
          : f
      )
    );
  
    setActiveMenu(null);
  
  }}

  onDuplicate={() => {

    setFolders(prev=>{

      const folderToCopy =
        prev.find(f=>f.id===folder.id);
    
      if(!folderToCopy) return prev;
    
      return [
    
        ...prev,
    
        {
    
          ...folderToCopy,
    
          id:Date.now(),
    
          name:
            folderToCopy.name + " Copy",
    
          plans:[
            ...folderToCopy.plans
          ]
    
        }
    
      ];
    
    });

    setActiveMenu(null);

  }}

  onColor={() => {

    setSelectedFolder(folder.id);

setShowColorPicker(true);

    setActiveMenu(null);

  }}

  onArchive={() => {

    setFolders(prev =>
      prev.map(f =>
        f.id === folder.id
          ? {
              ...f,
              archived: true,
            }
          : f
      )
    );
  
    setActiveMenu(null);
  
  }}

  onDelete={() => {

    if(

      window.confirm(
      
      `Delete "${folder.name}" ?`
      
      )
      
      ){
      
      setFolders(prev=>
      
      prev.filter(
      
      f=>f.id!==folder.id
      
      )
      
      );
      
      }

    setActiveMenu(null);

  }}
/>

</div>

)}

</div>

          {/* Plans */}

          {!collapsed &&
            openFolders.includes(folder.id) && (

              <div className="ml-8 mt-1">

                {folder.plans.map((plan) => (

                  <button
                    key={plan}
                    className="
                      w-full
                      flex
                      items-center
                      gap-2
                      px-2
                      py-2
                      rounded-lg
                      hover:bg-violet-50
                      text-gray-600
                      transition
                    "
                  >

                    <FileText size={15} />

                    <span className="text-sm">
                      {plan}
                    </span>

                  </button>

                ))}

              </div>

            )}

        </div>
      ))}





    </div>
  );
}