import {
    ArrowLeft,
    Save,
    CalendarDays,
  } from "lucide-react";
  
  export default function WeeklyHeader({
  
    onBack,
  
    onSave,
  
  }) {
  
    return (
  
      <div className="sticky top-0 z-20 bg-[#fafafa]/90 backdrop-blur-xl pb-6">
  
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
  
          <div className="flex items-center justify-between">
  
            {/* LEFT */}
  
            <div className="flex items-center gap-5">
  
              <button
  
                onClick={onBack}
  
                className="w-12 h-12 rounded-2xl border border-gray-200 hover:border-purple-500 hover:bg-purple-50 hover:scale-105 transition-all duration-300 flex items-center justify-center"
  
              >
  
                <ArrowLeft size={22} />
  
              </button>
  
              <div>
  
                <p className="text-xs uppercase tracking-[3px] font-semibold text-purple-600">
  
                  Weekly Review
  
                </p>
  
                <h1 className="text-4xl font-bold mt-2">
  
                  Reflect. Improve. Repeat.
  
                </h1>
  
                <p className="text-gray-500 mt-3">
  
                  Review your trading performance for the week.
  
                </p>
  
              </div>
  
            </div>
  
            {/* RIGHT */}
  
            <div className="flex items-center gap-4">
  
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-xl">
  
                <CalendarDays
  
                  size={34}
  
                  className="text-white"
  
                />
  
              </div>
  
              <button
  
                onClick={onSave}
  
                className="h-12 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 hover:scale-105 transition-all duration-300 text-white flex items-center gap-3"
  
              >
  
                <Save size={20}/>
  
                Save
  
              </button>
  
            </div>
  
          </div>
  
        </div>
  
      </div>
  
    );
  
  }