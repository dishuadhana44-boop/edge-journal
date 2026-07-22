import { useEffect, useRef } from "react";
import ChartManager from "./managers/ChartManager";

function ChartEngine() {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const manager = new ChartManager(
      chartRef.current
    );

    manager.create();

    return () => manager.remove();
  }, []);

  return (
    <div
      ref={chartRef}
      className="w-full h-full"
    />
  );
}

export default ChartEngine;