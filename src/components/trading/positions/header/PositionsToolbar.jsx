import {

    Search,
    RefreshCw,
    Filter,
    Columns3,
    Download,
  
  } from "lucide-react";
  
  export default function PositionsToolbar() {
  
    return (
  
      <div
        className="
          flex
          items-center
          justify-between
  
          p-4
  
          border-b
        "
      >
  
        <div className="relative">
  
          <Search
            size={16}
            className="
              absolute
              left-3
              top-3
              text-gray-400
            "
          />
  
          <input
            placeholder="Search trade..."
            className="
              w-72
  
              rounded-xl
  
              border
  
              py-2
              pl-10
              pr-4
  
              outline-none
  
              focus:border-violet-500
            "
          />
  
        </div>
  
        <div className="flex gap-2">
  
          {[
            RefreshCw,
            Filter,
            Columns3,
            Download,
          ].map((Icon, i) => (
  
            <button
              key={i}
              className="
                p-2
  
                rounded-xl
  
                hover:bg-gray-100
              "
            >
              <Icon size={18} />
            </button>
  
          ))}
  
        </div>
  
      </div>
  
    );
  
  }