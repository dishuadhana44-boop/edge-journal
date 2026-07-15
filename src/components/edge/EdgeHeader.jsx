function EdgeHeader() {
    return (
      <div className="h-12  flex items-center justify-between px-8">
  
  <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Edge
          </h1>
  
          <p className="text-gray-500">
          Build and test your trading playbooks — checklists, lessons, and strategy execution
          </p>
        </div>

  
        <button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl px-3 py-2 font-medium transition">
          + New Plan
        </button>
  
      </div>
    );
  }
  
  export default EdgeHeader;