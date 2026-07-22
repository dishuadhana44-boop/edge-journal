import { useState } from "react";

import PositionsTabs from "./header/PositionsTabs";
import PositionsStats from "./header/PositionsStats";
import PositionsToolbar from "./header/PositionsToolbar";
import OpenPositionsTable from "./tables/OpenPositionsTable";

import PendingOrdersTable from "./tables/PendingOrdersTable";
import ClosedPositionsTable from "./tables/ClosedPositionsTable";

export default function PositionTerminal() {

  const [activeTab, setActiveTab] = useState("open");

  return (

    <div
      className="
        w-full
        rounded-2xl
        border
        border-gray-200
        bg-white
        shadow-sm
        overflow-hidden
      "
    >

      <PositionsTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <PositionsStats />

      <PositionsToolbar />

     

    {activeTab === "open" && (
      <OpenPositionsTable />
    )}

    {activeTab === "pending" && (
      <PendingOrdersTable />
    )}

    {activeTab === "closed" && (
      <ClosedPositionsTable />
    )}

  </div>



  );

}