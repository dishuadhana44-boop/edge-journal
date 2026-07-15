import { Search } from "lucide-react";

function SearchBox({ value, onChange }) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 p-3">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
        <Search size={16} className="text-gray-400" />

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for a block..."
          className="w-full bg-transparent outline-none text-sm"
        />
      </div>
    </div>
  );
}

export default SearchBox;