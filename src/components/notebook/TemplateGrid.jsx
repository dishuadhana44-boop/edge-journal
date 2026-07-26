import { useState } from "react";
import TemplateCard from "./TemplateCard";
import WeeklyReview from "./review/WeeklyReview";

function TemplateGrid() {

  const [activeTemplate, setActiveTemplate] = useState(null);

console.log("Current template:", activeTemplate);
console.log("Render check:", activeTemplate);
  if (activeTemplate === "weekly") {

    return (

      <WeeklyReview
        onBack={() => setActiveTemplate(null)}
      />

    );

  }

  return (

    <div className="grid grid-cols-4 gap-2 mt-3">

      <TemplateCard
        title="Morning Routine"
      />

      <TemplateCard
        title="Daily Planner"
      />

      <TemplateCard
        title="Goal Tracker"
      />

      <TemplateCard
        title="Habit Tracker"
      />

      <TemplateCard
        title="Weekly Review"
        onClick={() => {

          console.log("Setting weekly");
      
          setActiveTemplate("weekly");
      
      }}
      />

      <TemplateCard
        title="Monthly Review"
      />

      <TemplateCard
        title="Quarterly Review"
      />

      <TemplateCard
        title="Yearly Review"
      />

    </div>

  );

}

export default TemplateGrid;