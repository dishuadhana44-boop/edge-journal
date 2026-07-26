import { useState } from "react";

import NotebookHeader from "../components/notebook/NotebookHeader";
import TemplateGrid from "../components/notebook/TemplateGrid";

function Notebook() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
 
  return (
    <div className="h-screen flex flex-col">

      {/* Full Width Header */}
      <div className="  px-6 py-3">
        <NotebookHeader />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
   
        {/* Main */}
        <div className="flex-1 pl-2 pr-4 pt-2 overflow-auto">
    <TemplateGrid />
</div>

      </div>

    </div>
  );
}

export default Notebook;