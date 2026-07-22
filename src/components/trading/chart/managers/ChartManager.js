import { createChart } from "lightweight-charts";
import { chartOptions } from "../config/chartConfig";

class ChartManager {
  constructor(container) {
    this.container = container;
    this.chart = null;
  }

  create() {
    this.chart = createChart(
      this.container,
      {
        ...chartOptions,
        width: this.container.clientWidth,
        height: this.container.clientHeight,
      }
    );

    return this.chart;
  }

  remove() {
    this.chart?.remove();
  }
}

export default ChartManager;