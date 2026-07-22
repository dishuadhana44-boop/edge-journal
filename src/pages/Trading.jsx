import TradingHeader from "../components/trading/components/TradingHeader";
import TradingWorkspace from "../components/trading/workspace/TradingWorkspace";

import { MarketProvider } from "../context/MarketContext";
import { OrderProvider } from "../components/trading/order-panel/context/OrderContext";

import { UIProvider, useUI } from "../context/UIContext";

import { TradeProvider } from "../context/TradeContext";

function TradingContent() {

  const {
    orderOpen,
    setOrderOpen,

    quickOrderOpen,
    setQuickOrderOpen,

  } = useUI();

  return (
    <div className="w-full max-w-7xl mx-auto px-0 py-1 space-y-5">

      <TradingHeader />

      <TradingWorkspace />

    </div>
  );
}

export default function Trading() {

  return (

    <UIProvider>

      <MarketProvider>

        <OrderProvider>

        <TradeProvider>

          <TradingContent />

          </TradeProvider>

        </OrderProvider>

      </MarketProvider>

    </UIProvider>

  );

}