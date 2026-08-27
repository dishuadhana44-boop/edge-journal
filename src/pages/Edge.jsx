import { useState, useEffect } from "react";
import MyPlansPage from "../components/edge/myPlans/MyPlansPage";

import EdgeHeader from "../components/edge/EdgeHeader";
import EdgeSidebar from "../components/edge/EdgeSidebar";

import PlanStatistics from "../components/edge/statistics/PlanStatistics";
import PresetsPage from "../components/edge/presets/PresetsPage";
import EdgeEditor from "../components/edge/editor/EdgeEditor";

import PresetPreview from "../components/edge/presetPreview/PresetPreview";
import PlanPreview from "../components/edge/myPlans/PlanPreview";

import StatsHome from "../components/edge/statistics/StatsHome";


export default function Edge() {

  const [view, setView] = useState("editor");

  const [selectedStatsPlan, setSelectedStatsPlan] = useState(null);

const [statsView, setStatsView] = useState("home");
// home
// dashboard

  const [collapsed, setCollapsed] = useState(false);

  const [activeTab, setActiveTab] = useState("plans");

  const [showEditor, setShowEditor] = useState(false);

  const [mode, setMode] = useState("list");
// list = My Plans
// new = New Plan Editor
// edit = Edit Existing Plan

const [selectedPlan, setSelectedPlan] = useState(null);



const [previewPlan, setPreviewPlan] = useState(null);

const [plans, setPlans] = useState([]);



const selectActivePlan = (plan) => {
  if (!plan) return;

  setSelectedPlan(plan);

  localStorage.setItem(
    "selectedEdgePlan",
    JSON.stringify(plan)
  );

  window.dispatchEvent(
    new Event("selectedEdgePlanUpdated")
  );
};

useEffect(() => {

  const savedPlans =
    JSON.parse(localStorage.getItem("edgeStrategies")) || [];

  setPlans(savedPlans);

}, []);

  return (

    <div className="h-screen flex flex-col bg-[#fafafa]">

     

<EdgeHeader
  isStatsActive={view === "stats"}
  onStats={() => {
    setView("stats");
    setStatsView("home");
    setActiveTab(null);
  }}

  onNewPlan={() => {

    setActiveTab("plans");
  
    setSelectedPlan(null);
  
    setMode("new");
  
  }}
  activeView={view}
/>

      

      <div className="flex flex-1 overflow-hidden">

      <EdgeSidebar
  collapsed={collapsed}
  setCollapsed={setCollapsed}
  activeTab={activeTab}
  setActiveTab={(tab) => {

    setView("editor");      // <-- IMPORTANT

    setStatsView("home");

    setSelectedStatsPlan(null);

    setActiveTab(tab);

    setMode("list");

  }}
/>

<div className="flex-1 overflow-hidden">

{view === "stats" ? (

statsView === "home" ? (

<StatsHome

plans={plans}

onSelectPlan={(plan) => {

setSelectedStatsPlan(plan);

setStatsView("dashboard");

}}

/>

) : (

<PlanStatistics

plan={selectedStatsPlan}

onBack={() => {

setStatsView("home");

}}

/>

)

): 

 previewPlan ? (

  <PlanPreview
  
      plan={previewPlan}
  
      onBack={() => setPreviewPlan(null)}
  
      onEdit={(plan) => {
        setPreviewPlan(null);
        selectActivePlan(plan);
        setMode("edit");
      }}
  
  />
  
  ) :
 activeTab === "presets" ? (

<PresetsPage />

) : (

<div className="flex-1 overflow-y-auto h-[calc(100vh-64px)]">

  {mode === "list" && (

<MyPlansPage
  plans={plans}

  onOpenPlan={(plan) => {
    selectActivePlan(plan);
    setMode("edit");
  }}

  onPreview={(plan) => {
    selectActivePlan(plan);
    setPreviewPlan(plan);
  }}
/>

  )}

{mode === "new" && (
  <EdgeEditor
    mode="new"
    onClose={() => {
      const updatedPlans =
        JSON.parse(
          localStorage.getItem("edgeStrategies")
        ) || [];

      setPlans(updatedPlans);

      // Latest created plan becomes selected plan
      if (updatedPlans.length > 0) {
        const latestPlan =
          updatedPlans[updatedPlans.length - 1];
      
        selectActivePlan(latestPlan);
      }

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