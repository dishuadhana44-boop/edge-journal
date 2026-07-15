import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function AppLayout() {

  const [collapsed, setCollapsed] = useState(false);

  return (

    <div className="flex min-h-screen bg-gray-50">

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

<main
  className={`
    flex-1
    transition-all
    duration-300
    ${collapsed ? "ml-14" : "ml-34"}
    p-0
    overflow-x-hidden
  `}
>
        <Outlet />
      </main>

    </div>

  );

}

export default AppLayout;