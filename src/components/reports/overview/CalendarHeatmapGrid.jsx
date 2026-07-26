import CalendarHeatmapData from "./CalendarHeatmapData";

export default function CalendarHeatmapGrid() {

  const getColor = (value) => {

    if (value === 0) return "bg-gray-100";

    if (value > 500) return "bg-green-600";

    if (value > 250) return "bg-green-500";

    if (value > 0) return "bg-green-300";

    if (value < -150) return "bg-red-600";

    return "bg-red-300";

  };

  return (

    <div className="grid grid-cols-7 gap-2">

      {CalendarHeatmapData.map((item) => (

        <div
          key={item.day}
          className={`${getColor(item.pnl)}
          h-12
          rounded-lg
          flex
          flex-col
          justify-center
          items-center
          cursor-pointer
          transition
          hover:scale-110`}
        >

          <span className="text-xs font-bold text-white">

            {item.day}

          </span>

          <span className="text-[12px] text-white">

            {item.pnl > 0 ? "+" : ""}

            {item.pnl}

          </span>

        </div>

      ))}

    </div>

  );

}