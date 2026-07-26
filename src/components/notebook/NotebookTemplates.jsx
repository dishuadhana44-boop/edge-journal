import { useState } from "react";
import TemplateCard from "./TemplateCard";
import { notebookTemplates } from "./TemplateData";
import WeeklyReview from "../review/WeeklyReview";

export default function NotebookTemplates() {

  const [activeTemplate, setActiveTemplate] = useState(null);

  // Open Weekly Review
  if (activeTemplate === "weekly") {
    return (
      <WeeklyReview
        onBack={() => setActiveTemplate(null)}
      />
    );
  }

  return (

    <div className="grid grid-cols-3 gap-6">

      {notebookTemplates.map((item) => (

        <TemplateCard
          key={item.title}
          {...item}
          onClick={() => {

            console.log(item);
          
            setActiveTemplate("weekly");
          
          }}
        />

      ))}

    </div>

  );

}