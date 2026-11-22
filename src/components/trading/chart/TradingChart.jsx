
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

import { useTheme } from "../../../context/ThemeContext";

function TradingChart() {
  const { isDark } = useTheme();

  return (
    <div
      className="
        w-full
        h-full
        rounded-xl
        overflow-hidden
        border
        border-gray-200
        dark:border-[#25202f]
        bg-white
        dark:bg-[#0b0b0f]
      "
    >
      <AdvancedRealTimeChart
  theme={isDark ? "dark" : "light"}
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
