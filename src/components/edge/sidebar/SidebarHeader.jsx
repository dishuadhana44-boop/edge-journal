import { Plus, PanelLeftClose } from "lucide-react";

export default function SidebarHeader({
    collapsed,
    setCollapsed,
  }) {
  return (
    <div className="p-5 border-b border-gray-200">

      {/* Logo */}

      <div className="flex items-center justify-between mb-1">
      {!collapsed && (
<div>

  <h1 className="text-[18px] font-bold tracking-tight text-gray-700">
    My Plans
  </h1>

 

</div>
)}

<button
  onClick={() => setCollapsed(!collapsed)}
  className="
    h-9
    w-9
    rounded-lg
    border
    border-gray-200
    hover:bg-gray-100
    flex
    items-center
    justify-center
    transition
  "
>
  <PanelLeftClose
    size={18}
    className={`
      transition-transform
      duration-300
      ${collapsed ? "rotate-180" : ""}
    `}
  />
</button>

</div>

      {/* New Plan */}

     

    </div>
  );
}