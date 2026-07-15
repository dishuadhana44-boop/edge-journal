function News() {
    return (
      <div className="w-full">
  
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">
            News
          </h1>
  
          <p className="text-gray-500 mt-2">
            Stay updated with the latest financial and market news.
          </p>
        </div>
  
        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 flex flex-col items-center justify-center">
  
          <div className="text-6xl mb-4">
            📰
          </div>
  
          <h2 className="text-2xl font-semibold mb-2">
            Market News
          </h2>
  
          <p className="text-gray-500 text-center max-w-xl">
            Follow real-time market news, economic events, earnings,
            central bank updates and breaking financial headlines
            from one place.
          </p>
  
        </div>
  
      </div>
    );
  }
  
  export default News;