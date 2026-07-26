import { useState, useEffect } from "react";
import MyPlansPage from "../components/edge/myPlans/MyPlansPage";

import EdgeHeader from "../components/edge/EdgeHeader";
import EdgeSidebar from "../components/edge/EdgeSidebar";

import PlanStatistics from "../components/edge/statistics/PlanStatistics";
import PresetsPage from "../components/edge/presets/PresetsPage";
import EdgeEditor from "../components/edge/editor/EdgeEditor";


export default function Edge() {

  const [view, setView] = useState("editor");

  const [collapsed, setCollapsed] = useState(false);

  const [activeTab, setActiveTab] = useState("plans");

  const [showEditor, setShowEditor] = useState(false);

  const [mode, setMode] = useState("list");
// list = My Plans
// new = New Plan Editor
// edit = Edit Existing Plan

const [selectedPlan, setSelectedPlan] = useState(null);

const [plans, setPlans] = useState([]);

useEffect(() => {

  const savedPlans =
    JSON.parse(localStorage.getItem("edgeStrategies")) || [];

  setPlans(savedPlans);

}, []);

  return (

    <div className="h-screen flex flex-col bg-[#fafafa]">

     

<EdgeHeader
  onStats={() => setView("stats")}

  onNewPlan={() => {

    setActiveTab("plans");
  
    setSelectedPlan(null);
  
    setMode("new");
  
  }}
/>

      

      <div className="flex flex-1 overflow-hidden">

        <EdgeSidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

<div className="flex-1 overflow-hidden">

{view === "stats" ? (

<PlanStatistics
  onBack={() => setView("editor")}
/>

) : activeTab === "presets" ? (

<PresetsPage />

) : (

<div className="flex-1 overflow-y-auto h-[calc(100vh-64px)]">

  {mode === "list" && (

    <MyPlansPage
      plans={plans}
      onOpenPlan={(plan) => {
        setSelectedPlan(plan);
        setMode("edit");
      }}
    />

  )}

  {mode === "new" && (

    <EdgeEditor
      mode="new"
      onClose={() => {
        const updatedPlans =
          JSON.parse(localStorage.getItem("edgeStrategies")) || [];

        setPlans(updatedPlans);
        setMode("list");
      }}
    />

  )}

  {mode === "edit" && (

    <EdgeEditor
      mode="edit"
      strategy={selectedPlan}
      onClose={() => {
        const updatedPlans =
          JSON.parse(localStorage.getItem("edgeStrategies")) || [];

        setPlans(updatedPlans);
        setMode("list");
      }}
    />

  )}

</div>

)}

</div>
          
        

      </div>

    </div>

  );

}