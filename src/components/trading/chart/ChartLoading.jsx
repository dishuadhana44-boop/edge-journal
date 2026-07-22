function ChartLoading() {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
        <div className="animate-pulse text-gray-500">
          Loading Chart...
        </div>
      </div>
    );
  }
  
  export default ChartLoading;