import {
    Star,
    FolderOpen,
    LayoutGrid,
    Archive,
  } from "lucide-react";
  
  const items = [
    {
      id: "favorites",
      label: "Favorites",
      icon: Star,
    },
    {
      id: "plans",
      label: "My Plan",
      icon: FolderOpen,
    },
    {
      id: "presets",
      label: "Presets",
      icon: LayoutGrid,
    },
    {
      id: "archive",
      label: "Archived",
      icon: Archive,
    },
  ];
  
  export default function SidebarNavigation({
    collapsed,
    activeTab,
    setActiveTab,
  }) {
    return (
      <div className="px-3 py-1 border-b border-gray-200">
  
        {items.map((item) => {
  
          const Icon = item.icon;
  
          const active = item.id === activeTab;
  
          return (
  
            <button
  key={item.id}
  onClick={() => setActiveTab(item.id)}
              className={`
                w-full
                h-11
                rounded-xl
                flex
                items-center
                gap-3
                px-3
                mb-2
                transition-all
                duration-200
  
                ${
                  active
                    ? "bg-violet-100 text-violet-700 font-semibold"
                    : "hover:bg-gray-100 text-gray-600"
                }
  
                ${collapsed ? "justify-center px-0" : ""}
              `}
            >
  
              <Icon size={19} />
  
              {!collapsed && (
                <span>
                  {item.label}
                </span>
              )}
  
            </button>
  
          );
  
        })}
  
      </div>
    );
  }