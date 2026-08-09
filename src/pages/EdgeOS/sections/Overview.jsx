export default function Overview() {
    return (
      <div className="p-3 bg-gray-50 min-h-screen">
      
  
        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold">Good Evening 👋</h2>
          <p className="text-gray-600 mt-2">
            Today is 6 August 2026. Let's make today count.
          </p>
        </div>
  
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-gray-500">Today's Score</p>
            <h3 className="text-3xl font-bold text-violet-600 mt-2">92</h3>
          </div>
  
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-gray-500">Habit Streak</p>
            <h3 className="text-3xl font-bold text-orange-500 mt-2">🔥 31</h3>
          </div>
  
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-gray-500">Active Goals</p>
            <h3 className="text-3xl font-bold text-blue-600 mt-2">6</h3>
          </div>
        </div>
  
        {/* Priorities */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            🎯 Today's Top 3 Priorities
          </h2>
  
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50">
              <span className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-semibold">1</span>
              <span className="font-medium">Finish Notebook Editor</span>
            </div>
  
            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50">
              <span className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-semibold">2</span>
              <span className="font-medium">Workout (45 min)</span>
            </div>
  
            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50">
              <span className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-semibold">3</span>
              <span className="font-medium">Read Finance for 30 min</span>
            </div>
          </div>
        </div>
  
        {/* AI Recommendation */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl text-white p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h2 className="text-xl font-semibold">AI Recommendation</h2>
          </div>
  
          <p className="text-violet-100 leading-relaxed">
            You have about <span className="font-semibold text-white">4 focused hours</span> available today.
            Finish the <span className="font-semibold text-white">Notebook Editor</span> first because it is on the critical path for your next app release.
          </p>
        </div>
      </div>
    );
  }