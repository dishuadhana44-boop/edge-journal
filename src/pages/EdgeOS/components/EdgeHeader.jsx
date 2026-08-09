import { Search, Bell, Sparkles } from "lucide-react";

export default function EdgeHeader() {
  return (
    <header
      className="
        bg-white
        rounded-2xl
        shadow-sm
        border
        border-gray-100
        px-6
        py-4
        flex
        items-center
        justify-between
        mb-6
      "
    >
      {/* Left Side */}
      
      <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
          Edge OS
          </h1>
  
          <p className="text-gray-500">
          Your Daily Execution System
          </p>
        </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">

        {/* Search */}
        <div
          className="
            flex
            items-center
            gap-2
            bg-gray-100
            px-4
            py-2
            rounded-xl
            w-72
          "
        >
          <Search size={18} className="text-gray-500" />

          <input
            type="text"
            placeholder="Search..."
            className="
              bg-transparent
              outline-none
              text-sm
              w-full
            "
          />
        </div>

        {/* AI Button */}
        <button
          className="
            flex
            items-center
            gap-2
            bg-violet-600
            text-white
            px-4
            py-2
            rounded-xl
            hover:bg-violet-700
            transition
          "
        >
          <Sparkles size={18} />
          AI
        </button>

        {/* Notification */}
        <button
          className="
            p-2
            rounded-xl
            hover:bg-gray-100
            transition
          "
        >
          <Bell size={20} />
        </button>

        {/* Profile */}
        <div
          className="
            w-10
            h-10
            rounded-full
            bg-violet-600
            text-white
            flex
            items-center
            justify-center
            font-bold
          "
        >
          D
        </div>

      </div>
    </header>
  );
}