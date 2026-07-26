import { useState } from "react";

import EdgeHeader from "./EdgeHeader";
import PlanEditor from "./PlanEditor";
import PlanStatistics from "./statistics/PlanStatistics";

export default function EdgeView() {

  const [view, setView] = useState("editor");

  return (

    <div className="h-full">

      <EdgeHeader

        onStats={() => setView("stats")}

        onNewPlan={() => {}}

      />

      {view === "editor" ? (

        <PlanEditor />

      ) : (

        <PlanStatistics

          onBack={() => setView("editor")}

        />

      )}

    </div>

  );

}