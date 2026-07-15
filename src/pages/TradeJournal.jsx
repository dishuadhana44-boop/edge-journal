import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import JournalLayout from "../components/trade/JournalLayout";

function TradeJournal() {

  const { id } = useParams();
  
  const navigate = useNavigate();

  const trades =
    JSON.parse(localStorage.getItem("trades")) || [];

    const trade = trades.find(
      (t) => String(t.id) === String(id)
    );
  const currentIndex = trades.findIndex(
    (t) => t.id.toString() === id
  );
  
  const previousTrade =
    currentIndex > 0
      ? trades[currentIndex - 1]
      : null;
  
  const nextTrade =
    currentIndex < trades.length - 1
      ? trades[currentIndex + 1]
      : null;
  const [tradeState, setTradeState] = useState(trade);
  useEffect(() => {
    const latestTrades =
      JSON.parse(localStorage.getItem("trades")) || [];
  
    const latestTrade = latestTrades.find(
      (t) => String(t.id) === String(id)
    );
  
    if (latestTrade) {
      setTradeState(latestTrade);
    }
  }, [id]);
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (!tradeState) return;
  
    const allTrades =
      JSON.parse(localStorage.getItem("trades")) || [];
  
    const updatedTrades = allTrades.map((t) =>
      t.id === tradeState.id
        ? {
            ...tradeState,
            updatedAt: new Date().toISOString(),
          }
        : t
    );
  
    localStorage.setItem(
      "trades",
      JSON.stringify(updatedTrades)
    );
  }, [tradeState]);
  const handleSave = () => {
    const allTrades =
      JSON.parse(localStorage.getItem("trades")) || [];
  
    const updatedTrades = allTrades.map((t) =>
      t.id === tradeState.id
        ? {
          ...tradeState,
            updatedAt: new Date().toISOString(),
          }
        : t
    );
  
    localStorage.setItem(
      "trades",
      JSON.stringify(updatedTrades)
    );
    
    setShowSaved(true);
    
    setTimeout(() => {
      setShowSaved(false);
    }, 2500);
  
    
  };

  
  return (
    <>
      {showSaved && (
        <div className="fixed top-6 right-6 z-50 toast-slide-in">
  
          <div className="bg-[#7C3AED] text-white rounded-2xl shadow-2xl overflow-hidden min-w-[330px]">
  
            <div className="flex items-center gap-4 px-5 py-4">
  
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-lg font-bold">
                ✓
              </div>
  
              <div>
                <p className="font-semibold">
                  Trade Saved
                </p>
  
                <p className="text-sm text-purple-100">
                  Journal saved successfully.
                </p>
              </div>
  
            </div>
  
            <div className="h-1 bg-purple-300">
            <div className="h-full bg-green-400 toast-progress"></div>
            </div>
  
          </div>
  
        </div>
      )}
  
  <JournalLayout
  trade={tradeState}
  setTrade={setTradeState}
  onSave={handleSave}
  previousTrade={previousTrade}
  nextTrade={nextTrade}
/>
    </>
  );
}
<style>
{`
@keyframes slideIn{
0%{
transform:translateX(120%);
opacity:0;
}
100%{
transform:translateX(0);
opacity:1;
}
}

@keyframes progress{
from{
width:100%;
}
to{
width:0%;
}
}
`}
</style>
export default TradeJournal;