import TradingHeader from "../components/trading/components/TradingHeader";
import TradingWorkspace from "../components/trading/workspace/TradingWorkspace";

import { OrderProvider } from "../components/trading/order-panel/context/OrderContext";

import { UIProvider, useUI } from "../context/UIContext";

import {
  TradeObjectsProvider,
} from "../context/TradeObjectsContext";

function TradingContent() {
  const {
    orderOpen,
    setOrderOpen,
    quickOrderOpen,
    setQuickOrderOpen,
  } = useUI();

  return (
    <div className="w-full max-w-7xl mx-auto px-0 space-y-5">
      <TradingHeader />

      <TradingWorkspace />
    </div>
  );
}

export default function Trading() {
  return (
    <UIProvider>

      <OrderProvider>

        <TradeObjectsProvider>

          <TradingContent />

        </TradeObjectsProvider>

      </OrderProvider>

    </UIProvider>
  );
}