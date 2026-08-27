
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

function TradingChart() {
  
  return (
    <div
      className="
        w-full
        h-full
        rounded-xl
        overflow-hidden
        border
        border-gray-200
        bg-white
      "
    >
      <AdvancedRealTimeChart
  theme="light"
  autosize={true}
  symbol="OANDA:EURUSD"
  interval="15"
  allow_symbol_change={true}
  hide_side_toolbar={false}
  withdateranges={true}
  details={false}
  calendar={false}
/>
    </div>
  );
}

export default TradingChart;