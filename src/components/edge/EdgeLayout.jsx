import EdgeHeader from "./EdgeHeader";
import EdgeSidebar from "./EdgeSidebar";
import EdgeEditor from "./EdgeEditor";
import EdgeRightPanel from "./EdgeRightPanel";

function EdgeLayout() {
  return (
    <div className="h-screen bg-[#F7F7FB] flex flex-col">

      {/* Header */}
      <EdgeHeader />

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left */}
        <EdgeSidebar />

        {/* Center */}
        <div className="flex-1 p-1 overflow-y-auto">
          <EdgeEditor />
        </div>

        {/* Right */}
        <EdgeRightPanel />

      </div>

    </div>
  );
}

export default EdgeLayout;