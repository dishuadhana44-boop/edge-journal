import OrderHeader from "./OrderHeader";
import BuySellToggle from "./BuySellToggle";
import OrderTabs from "./OrderTabs";
import PriceInputs from "./PriceInputs";
import { OrderProvider } from "./context/OrderContext";
import RiskSection from "./RiskSection";



export default function OrderPanel({ setOrderOpen }) {
    return (
      
        <div className="h-[766px] rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
  
        <OrderHeader setOrderOpen={setOrderOpen} />
  
          <BuySellToggle />
  
          <OrderTabs />
  
          <PriceInputs />
  
          <RiskSection />

        </div>
  
      
    );
  }