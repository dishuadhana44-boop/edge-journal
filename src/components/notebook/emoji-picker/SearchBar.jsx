import { Search } from "lucide-react";

function SearchBar({
  search,
  setSearch,
}) {
  return (
    <div className=" px-3 py-2">

      <div
        className="
          h-9
          flex
          items-center
          rounded-lg
          border
          border-[#E5E7EB]
          bg-white
          px-3
          transition-all
          focus-within:border-[#BFC4CC]
          focus-within:ring-2
          focus-within:ring-[#EEF2F7]
        "
      >

        <Search
          size={16}
          strokeWidth={2}
          className="text-[#9CA3AF]"
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter..."
          className="
            ml-2
            flex-1
            bg-transparent
            text-[14px]
            text-[#37352F]
            placeholder:text-[#9CA3AF]
            outline-none
          "
        />

        <kbd
          className="
            rounded
            border
            border-gray-200
            bg-gray-50
            px-1.5
            py-0.5
            text-[10px]
            text-gray-400
            font-medium
          "
        >
          Ctrl K
        </kbd>

      </div>

    </div>
  );
}

export default SearchBar;