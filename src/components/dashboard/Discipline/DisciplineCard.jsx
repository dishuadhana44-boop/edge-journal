import DisciplineBreakdown from "./DisciplineBreakdown";
import DisciplineScore from "./DisciplineScore";

function DisciplineCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm  h-full">

      {/* Header */}

      <div className="px-5 py-4 border-b">

        <h2 className="text-lg font-semibold text-gray-900">
          Discipline Breakdown
        </h2>

       
      </div>

      {/* Body */}

      <div className="flex flex-col justify-between p-10 ">

        {/* Left */}

        <div>

<DisciplineBreakdown />

</div>

<div className="flex justify-center ">

<DisciplineScore />

</div>

<div className="mt-1 border-t pt-1 space-y-2">

  <div className="flex items-center justify-between">

    <div>
      <p className="text-xs text-gray-500">
        Current Streak
      </p>

      <p className="font-semibold text-gray-900">
        🔥 5 Days
      </p>
    </div>

    <div className="text-right">
      <p className="text-xs text-gray-500">
        Grade
      </p>

      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
        A
      </span>
    </div>

  </div>

</div>

      </div>


    </div>
  );
}

export default DisciplineCard;