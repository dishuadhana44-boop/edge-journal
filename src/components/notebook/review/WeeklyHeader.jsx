import {
  ArrowLeft,
  CalendarDays,
  Save,
  Trophy,
  TrendingUp,
  BarChart3
} from "lucide-react";

export default function WeeklyHeader({

  onBack,

  onSave,

}) {

  return (

    <div className="relative overflow-hidden rounded-[34px] bg-white border border-gray-200 shadow-[0_20px_60px_rgba(0,0,0,.08)]">

      {/* Background Glow */}

      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl"/>

      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-violet-400/5 blur-3xl"/>

      <div className="relative z-10 p-10">

        <div className="flex items-start justify-between">

          {/* LEFT */}

          <div className="flex gap-8">

            <button

              onClick={onBack}

              className="w-10 h-10 rounded-2xl border border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-300 flex items-center justify-center"

            >

              <ArrowLeft size={24}/>

            </button>

            <div>

            <p className="uppercase tracking-[8px] text-lg font-black bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent">
  Weekly Review
</p>

              <h1 className="mt-2 text-2xl font-black tracking-tight">

                Reflect. Improve. Repeat.

              </h1>

              

            </div>

          </div>

          {/* RIGHT */}

          <div className="flex gap-4">

            <button

              className="w-10 h-10 rounded-3xl bg-gradient-to-br from-purple-600 to-violet-500 text-white shadow-xl hover:scale-105 transition-all"

            >

              <CalendarDays className="mx-auto"/>

            </button>

            <button

              onClick={onSave}

              className="px-8 rounded-3xl bg-gradient-to-r from-purple-600 to-violet-500 text-white font-semibold flex items-center gap-3 shadow-xl hover:scale-105 transition-all"

            >

              <Save size={18}/>

              Save Review

            </button>

          </div>

        </div>

        

        

      </div>

    </div>

  );

}