import TemplateCard from "./TemplateCard";

function TemplateGrid() {
  return (
    <div>
<div className="-mt-2"></div>
      <h2 className="bg-white rounded-2xl border font-bold border-gray-200 p-3 px-4 py-3 flex flex-col">
        Templates
      </h2>

      <div className="grid grid-cols-4 gap-2 mt-3">

        <TemplateCard title="Morning Routine" />
        <TemplateCard title="Daily Planner" />
        <TemplateCard title="Goal Tracker" />
        <TemplateCard title="Habit Tracker" />
        <TemplateCard title="Weekly Review" />
        <TemplateCard title="Monthly Review" />
        <TemplateCard title="Quarterly Review" />
        <TemplateCard title="Yearly Review" />

      </div>

    </div>
  );
}

export default TemplateGrid;