import {
    Trophy,
    TrendingUp,
    Star,
    Camera,
  } from "lucide-react";
  
  export default function BestSetupCard() {
  
    return (
  
      <div className="relative overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-sm hover:shadow-[0_25px_70px_rgba(124,58,237,.12)] transition-all duration-500">
  
        {/* Background Glow */}
  
        <div className="absolute -right-24 -top-20 w-64 h-64 rounded-full bg-purple-100 blur-3xl opacity-70"/>
  
        <div className="relative p-8">
  
          {/* Header */}
  
          <div className="flex items-center justify-between">
  
            <div className="flex items-center gap-4">
  
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
  
                <Trophy className="text-white"/>
  
              </div>
  
              <div>
  
                <p className="uppercase tracking-[6px] text-xs font-bold text-purple-600">
  
                  Weekly Winner
  
                </p>
  
                <h2 className="text-3xl font-black mt-1">
  
                  Best Performing Setup
  
                </h2>
  
              </div>
  
            </div>
  
            <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-full">
  
              <Star className="text-yellow-500" size={18}/>
  
              <span className="font-semibold">
  
                4.8 / 5
  
              </span>
  
            </div>
  
          </div>
  
          {/* Body */}
  
          <div className="grid grid-cols-12 gap-8 mt-8">
  
            {/* Screenshot */}
  
            <div className="col-span-4">
  
              <div className="h-64 rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center hover:border-purple-500 transition cursor-pointer">
  
                <Camera
  
                  size={42}
  
                  className="text-purple-500"
  
                />
  
                <p className="mt-4 font-semibold">
  
                  Upload Best Trade
  
                </p>
  
                <span className="text-gray-400 text-sm mt-2">
  
                  PNG / JPG
  
                </span>
  
              </div>
  
            </div>
  
            {/* Details */}
  
            <div className="col-span-8">
  
              <div className="grid grid-cols-2 gap-5">
  
                <div className="rounded-2xl border border-gray-200 p-5">
  
                  <p className="text-gray-400 text-sm">
  
                    Strategy
  
                  </p>
  
                  <h3 className="font-bold text-xl mt-2">
  
                    Liquidity Sweep
  
                  </h3>
  
                </div>
  
                <div className="rounded-2xl border border-gray-200 p-5">
  
                  <p className="text-gray-400 text-sm">
  
                    Result
  
                  </p>
  
                  <h3 className="text-green-500 text-xl font-black mt-2">
  
                    +4.6R
  
                  </h3>
  
                </div>
  
                <div className="rounded-2xl border border-gray-200 p-5">
  
                  <p className="text-gray-400 text-sm">
  
                    Win Probability
  
                  </p>
  
                  <h3 className="font-black text-xl mt-2">
  
                    88%
  
                  </h3>
  
                </div>
  
                <div className="rounded-2xl border border-gray-200 p-5">
  
                  <p className="text-gray-400 text-sm">
  
                    Confidence
  
                  </p>
  
                  <h3 className="font-black text-xl mt-2">
  
                    High
  
                  </h3>
  
                </div>
  
              </div>
  
              {/* Notes */}
  
              <div className="mt-6 rounded-3xl bg-purple-50 p-6">
  
                <div className="flex items-center gap-3">
  
                  <TrendingUp className="text-purple-600"/>
  
                  <h3 className="font-bold text-lg">
  
                    Why it worked
  
                  </h3>
  
                </div>
  
                <p className="mt-4 leading-8 text-gray-600">
  
                  Waited patiently for liquidity sweep, confirmed
                  market structure shift, entered only after
                  confirmation candle and followed the trading plan
                  without emotional interference.
  
                </p>
  
              </div>
  
            </div>
  
          </div>
  
        </div>
  
      </div>
  
    );
  
  }