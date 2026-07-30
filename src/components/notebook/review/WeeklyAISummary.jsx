import {
    Sparkles,
    TrendingUp,
    AlertTriangle,
    Target,
    Brain,
    ArrowRight,
    } from "lucide-react";
    
    export default function WeeklyAISummary(){
    
    return(
    
    <div className="relative overflow-hidden rounded-[32px] border border-purple-200 bg-gradient-to-br from-white via-purple-50 to-violet-100 p-8">
    
    {/* Glow */}
    
    <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-purple-400/20 blur-3xl"/>
    
    <div className="relative z-10">
    
    <div className="flex items-center gap-4">
    
    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-xl">
    
    <Sparkles
    
    className="text-white"
    
    size={28}
    
    />
    
    </div>
    
    <div>
    
    <p className="uppercase tracking-[7px] text-xs font-bold text-purple-600">
    
    AI Coach
    
    </p>
    
    <h2 className="text-4xl font-black mt-2">
    
    Weekly Summary
    
    </h2>
    
    </div>
    
    </div>
    
    {/* Grade */}
    
    <div className="mt-10 flex items-center justify-between rounded-3xl bg-white border border-purple-100 p-6">
    
    <div>
    
    <p className="text-gray-500">
    
    Overall Grade
    
    </p>
    
    <h2 className="text-6xl font-black text-purple-600 mt-2">
    
    A-
    
    </h2>
    
    </div>
    
    <div className="text-right">
    
    <p className="text-gray-500">
    
    Consistency
    
    </p>
    
    <h2 className="text-4xl font-black mt-2">
    
    84%
    
    </h2>
    
    </div>
    
    </div>
    
    {/* Cards */}
    
    <div className="grid grid-cols-3 gap-5 mt-8">
    
    <div className="rounded-3xl bg-white border border-gray-200 p-6">
    
    <div className="flex items-center gap-3">
    
    <TrendingUp className="text-green-500"/>
    
    <h3 className="font-bold">
    
    Strength
    
    </h3>
    
    </div>
    
    <p className="mt-4 text-gray-600 leading-7">
    
    Excellent patience.
    
    Waited for confirmation before entering.
    
    </p>
    
    </div>
    
    <div className="rounded-3xl bg-white border border-gray-200 p-6">
    
    <div className="flex items-center gap-3">
    
    <AlertTriangle className="text-red-500"/>
    
    <h3 className="font-bold">
    
    Weakness
    
    </h3>
    
    </div>
    
    <p className="mt-4 text-gray-600 leading-7">
    
    Position sizing was inconsistent during volatile sessions.
    
    </p>
    
    </div>
    
    <div className="rounded-3xl bg-white border border-gray-200 p-6">
    
    <div className="flex items-center gap-3">
    
    <Target className="text-purple-600"/>
    
    <h3 className="font-bold">
    
    Focus
    
    </h3>
    
    </div>
    
    <p className="mt-4 text-gray-600 leading-7">
    
    Trade fewer setups.
    
    Increase quality instead of quantity.
    
    </p>
    
    </div>
    
    </div>
    
    {/* Coach Advice */}
    
    <div className="mt-8 rounded-3xl bg-white border border-purple-100 p-7">
    
    <div className="flex items-center gap-3">
    
    <Brain className="text-purple-600"/>
    
    <h3 className="text-2xl font-black">
    
    Coach Advice
    
    </h3>
    
    </div>
    
    <p className="mt-6 leading-8 text-gray-600">
    
    Your execution quality improved compared to last week.
    The biggest improvement opportunity is maintaining
    consistent position sizing. Continue waiting for A+
    setups instead of forcing trades.
    
    </p>
    
    </div>
    
    {/* Motivation */}
    
    <div className="mt-8 rounded-3xl bg-gradient-to-r from-purple-600 to-violet-500 p-7 text-white flex justify-between items-center">
    
    <div>
    
    <h3 className="text-2xl font-black">
    
    Keep Building Your Edge 🚀
    
    </h3>
    
    <p className="mt-3 opacity-90">
    
    Small improvements every week create extraordinary results.
    
    </p>
    
    </div>
    
    <ArrowRight size={40}/>
    
    </div>
    
    </div>
    
    </div>
    
    )
    
    }