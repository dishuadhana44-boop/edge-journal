import { useState } from "react";
import CreateFolderModal from "./modals/CreateFolderModal";
import SidebarHeader from "./sidebar/SidebarHeader";
import SidebarNavigation from "./sidebar/SidebarNavigation";
import SidebarFolders from "./sidebar/SidebarFolders";
import SidebarFooter from "./sidebar/SidebarFooter";
import SidebarArchived from "./sidebar/SidebarArchived";
import SidebarFavorites from "./sidebar/SidebarFavorites";



const initialFolders = [
  {
    id: 1,
    name: "Commodities",
    plans: [],
  },
  {
    id: 2,
    name: "Forex",
    plans: [],
  },
  {
    id: 3,
    name: "Crypto",
    plans: [],
  },
];

export default function EdgeSidebar({
  collapsed,
  setCollapsed,
  activeTab,
  setActiveTab,
}) {
    
    const [folders, setFolders] = useState(initialFolders);
    const [showCreatePlan, setShowCreatePlan] = useState(false);

    const [createPlanFolder, setCreatePlanFolder] = useState(null);

    const [showCreateFolder, setShowCreateFolder] = useState(false);

  return (
 <aside
  className={`
    ${collapsed ? "w-[72px]" : "w-[200px]"}
    h-full
    bg-white
    border-r
    border-gray-200
    flex
    flex-col
    transition-all
    duration-300
  `}
>

      {/* Header */}

      <SidebarHeader
  collapsed={collapsed}
  setCollapsed={setCollapsed}
/>

      {/* Navigation */}

      <SidebarNavigation
  collapsed={collapsed}
  activeTab={activeTab}
  setActiveTab={setActiveTab}
/>

      {/* Plans */}

      <div className="flex-1 flex flex-col min-h-0">

      <div className="flex-1 overflow-y-auto hide-scrollbar">



{activeTab === "favorites" && (

<SidebarFavorites

  collapsed={collapsed}

  folders={folders}

/>

)}



{activeTab === "archive" && (
  <SidebarArchived
    collapsed={collapsed}
    folders={folders}
    setFolders={setFolders}
  />
)}

</div>

      </div>

      {/* Footer */}



    </aside>
  );
}