function TradeFilters({
    searchTerm,
    setSearchTerm,
    selectedSession,
    setSelectedSession,
    selectedResult,
    setSelectedResult,
    selectedDirection,
    setSelectedDirection,
  }) {
    return (
        <div className="flex items-center justify-between gap-4 mb-6 w-full">
  
        {/* Search */}
        <input
  type="text"
  placeholder="Search Pair..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="w-[320px] border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500"
/>
        {/* Filters */}
        <div className="flex gap-3">
  
        <select
  value={selectedSession}
  onChange={(e) => setSelectedSession(e.target.value)}
  className="border border-gray-300 rounded-xl px-4 py-2"
>
  <option value="All">All Sessions</option>
  <option value="London">London</option>
  <option value="New York">New York</option>
  <option value="Asia">Asia</option>
</select>
  
<select
  value={selectedResult}
  onChange={(e) => setSelectedResult(e.target.value)}
  className="border border-gray-300 rounded-xl px-4 py-2"
>
  <option value="All">All Results</option>
  <option value="Win">Win</option>
  <option value="Loss">Loss</option>
  <option value="Break Even">Break Even</option>
</select>
  
<select
  value={selectedDirection}
  onChange={(e) => setSelectedDirection(e.target.value)}
  className="border border-gray-300 rounded-xl px-4 py-2"
>
  <option value="All">All Directions</option>
  <option value="Buy">Buy</option>
  <option value="Sell">Sell</option>
</select>

        </div>
  
      </div>
    );
  }
  
  export default TradeFilters;