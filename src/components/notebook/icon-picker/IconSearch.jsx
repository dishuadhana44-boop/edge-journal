import { Search } from "lucide-react";

function IconSearch({
  search,
  setSearch,
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-100">

      <div className="
        h-9
        rounded-lg
        border
        border-gray-200
        flex
        items-center
        px-3
        bg-white
      ">

        <Search
          size={15}
          className="text-gray-400"
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter..."
          className="
            flex-1
            ml-2
            text-sm
            outline-none
            bg-transparent
          "
        />

      </div>

    </div>
  );
}

export default IconSearch;