import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";


function TradingChart({ isCollapsed }) {
  return (
    <div
    className={`
      w-full
      rounded-xl
      overflow-hidden
      border
      border-gray-200
      bg-white
      transition-all
      duration-300
      ${
        isCollapsed
          ? "h-[calc(100vh-120px)]"
          : "h-[650px]"
      }
    `}
  >
      <AdvancedRealTimeChart
        theme="light"
        autosize
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