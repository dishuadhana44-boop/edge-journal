import ChartLoading from "./ChartLoading";

function ChartContainer() {
  return (
    <div className="relative w-full h-[600px] bg-white">
      <ChartLoading />

      <div
        id="tv_chart_container"
        className="w-full h-full"
      />
    </div>
  );
}

export default ChartContainer;