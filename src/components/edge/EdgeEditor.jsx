function EdgeEditor() {
    return (
      <div className=" bg-white rounded-2xl border border-gray-200 p-8">
  
        {/* Plan Name */}
        <input
          placeholder="Enter trade plan name"
          className="w-full text-1xl font-semibold outline-none border-b pb-4"
        />
  
        {/* Plan Type */}
        <div className="mt-8">
  
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Plan Type
          </p>
  
          <input
            placeholder="e.g. NY Sweep, London Sweep..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3"
          />
  
        </div>
  
        {/* Checklist */}
        <div className="mt-8">
  
          <div className="flex items-center justify-between">
  
            <p className="text-xs font-semibold text-gray-400 uppercase">
              Checklist Tags
            </p>
  
            <button className="text-purple-600 text-sm">
              + Add
            </button>
  
          </div>
  
          <div className="mt-3 h-12 rounded-xl border border-dashed border-gray-300"></div>
  
        </div>
  
        {/* Entry Criteria */}
  
        <div className="mt-10">
  
          <div className="flex items-center justify-between">
  
            <p className="text-xs font-semibold text-gray-400 uppercase">
              Entry Criteria
            </p>
  
            <button className="text-purple-600 text-sm">
              + Add
            </button>
  
          </div>
  
          <textarea
            rows={5}
            placeholder="Add conditions before entry..."
            className="mt-3 w-full rounded-xl border border-gray-200 p-4 resize-none"
          />
  
        </div>
  
        {/* Entry Models */}
  
        <div className="mt-10">
  
          <p className="text-xs font-semibold text-gray-400 uppercase mb-4">
            Entry Models
          </p>
  
          <div className="grid grid-cols-2 gap-5">
  
            <div className="h-56 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
              Screenshot 1
            </div>
  
            <div className="h-56 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
              Screenshot 2
            </div>
  
          </div>
  
        </div>
  
        {/* Trade Management */}
  
        <div className="mt-10">
  
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">
            Trade Management Rules
          </p>
  
          <textarea
            rows={6}
            className="w-full rounded-xl border border-gray-200 p-4 resize-none"
          />
  
        </div>
  
        {/* Exit */}
  
        <div className="mt-10">
  
          <div className="flex justify-between">
  
            <p className="text-xs font-semibold text-gray-400 uppercase">
              Exit Criteria
            </p>
  
            <button className="text-purple-600 text-sm">
              + Add
            </button>
  
          </div>
  
          <textarea
            rows={4}
            className="mt-3 w-full rounded-xl border border-gray-200 p-4 resize-none"
          />
  
        </div>
  
        {/* Notes */}
  
        <div className="mt-10">
  
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">
            Trading Notes
          </p>
  
          <textarea
            rows={5}
            className="w-full rounded-xl border border-gray-200 p-4 resize-none"
          />
  
        </div>
  
        {/* Save */}
  
        <button className="mt-10 bg-[#7C3AED] text-white rounded-xl px-8 py-3 hover:bg-[#6D28D9]">
          Save
        </button>
  
      </div>
    );
  }
  
  export default EdgeEditor;