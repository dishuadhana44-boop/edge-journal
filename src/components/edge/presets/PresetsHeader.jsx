import { Search, Filter } from "lucide-react";

const filters = [
  "All",
  "ICT",
  "SMC",
  "Mechanical",
  "Risk Management",
  "Psychology",
];

export default function PresetsHeader() {
  return (
    <div>

      {/* Title */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold text-gray-900">
            Plan Templates
          </h1>

        

        </div>

      </div>

      {/* Search */}

      <div className="mt-8 flex items-center gap-1">

        <div
          className="
            flex-1
            h-12
            rounded-2xl
            border
            border-gray-200
            bg-white
            flex
            items-center
            px-4
            gap-3
          "
        >

          <Search
            size={18}
            className="text-gray-400"
          />

          <input
            placeholder="Search Plan..."
            className="
              flex-1
              outline-none
              bg-transparent
              text-[15px]
            "
          />

        </div>

        <button
          className="
            h-12
            px-5
            rounded-2xl
            border
            border-gray-200
            bg-white
            hover:bg-gray-50
            flex
            items-center
            gap-2
          "
        >

          <Filter size={17} />

          Filters

        </button>

      </div>

      {/* Categories */}

      <div className="flex gap-3 mt-7 flex-wrap">

        {filters.map((item, index) => (

          <button
            key={item}
            className={`
              h-10
              px-5
              rounded-xl
              transition

              ${
                index === 0
                  ? "bg-violet-600 text-white"
                  : "bg-white border border-gray-200 hover:border-violet-400 hover:text-violet-600"
              }
            `}
          >

            {item}

          </button>

        ))}

      </div>

    </div>
  );
}