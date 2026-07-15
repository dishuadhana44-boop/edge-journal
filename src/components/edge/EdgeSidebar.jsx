import { useState } from "react";
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronDown,
    Circle,
    MoreHorizontal,
  } from "lucide-react";
  
  
  
  function EdgeSidebar({
    strategies,
    setStrategies,
    selectedStrategy,
    setSelectedStrategy,
  }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
      <div className="w-[230px] bg-white  rounded-2xl border border-gray-200 flex flex-col">
  
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
  
          <div className="flex items-center justify-between mb-4">
  
            <h3 className="text-xs font-bold text-gray-400 tracking-wider">
              MY PLANS
            </h3>
  
            <button
  onClick={() => {
    const newStrategy = {
      id: Date.now(),

      title: "",

      type: "",

      checklist: [],

      entry: "",

      management: "",

      exit: "",

      notes: "",
    };

    setSelectedStrategy(newStrategy);
  }}
  className="hover:bg-gray-100 rounded-lg p-1"
>
              <Plus size={16} />
            </button>
  
          </div>
  
          <div className="relative">
  
            <Search
              size={15}
              className="absolute left-3 top-3 text-gray-400"
            />
  
            <input
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
  
          </div>
  
        </div>
  
        {/* Scroll */}
  
        <div className="flex-1 overflow-y-auto p-3">
  
          {/* MY PLANS */}
  
          <div>
  
          {(strategies || []).length === 0 ? (
<div className="text-center text-gray-400 text-sm py-10">

  No Plans Yet

</div>

) : (

strategies.map((strategy) => (

  <button
    key={strategy.id}
    onClick={() => setSelectedStrategy(strategy)}
    className={`w-full text-left px-3 py-3 rounded-xl mb-2 transition ${
      selectedStrategy?.id === strategy.id
        ? "bg-purple-100 text-purple-700"
        : "hover:bg-gray-100"
    }`}
  >

    {strategy.title || "Untitled Strategy"}

  </button>

))

)}
  
          </div>
  
          
          
  
        </div>
  
        {/* Collapse */}
  
        <div className="border-t border-gray-100 p-3">
  
          <button className="w-full h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50">
  
            <ChevronLeft size={18} />
  
          </button>
  
        </div>
  
      </div>
    );
  }
  
  export default EdgeSidebar;