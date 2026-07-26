import {
    ArrowLeft,
    Calendar,
    RefreshCw,
    Download,
  } from "lucide-react";
  
  export default function StatisticsHeader({
    onBack,
  }) {
    return (
      <div className="bg-white border-b border-gray-200 px-8 py-5">
  
        <div className="flex items-center justify-between">
  
          {/* Left */}
  
          <div className="flex items-center gap-6">
  
            <button
              onClick={onBack}
              className="
                flex
                items-center
                gap-2
                text-gray-700
                hover:text-violet-600
                transition
              "
            >
              <ArrowLeft size={18} />
  
              Back
            </button>
  
            <div className="h-4 w-px bg-gray-300" />
  
            <div>
  
              <h1 className="text-2xl font-bold">
                Plan Statistics
              </h1>
  
              
  
            </div>
  
          </div>
  
          {/* Right */}
  
          <div className="flex items-center gap-3">
  
            <button className="h-10 px-4 rounded-xl border flex items-center gap-2 hover:bg-gray-50">
  
              <Calendar size={18} />
  
              Last 30 Days
  
            </button>
  
            <button className="h-10 w-10 rounded-xl border flex items-center justify-center hover:bg-gray-50">
  
              <RefreshCw size={18} />
  
            </button>
  
            <button className="h-10 px-4 rounded-xl bg-violet-600 text-white flex items-center gap-2 hover:bg-violet-700">
  
              <Download size={18} />
  
              Export
  
            </button>
  
          </div>
  
        </div>
  
      </div>
    );
  }