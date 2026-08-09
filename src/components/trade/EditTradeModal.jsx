import { useState, useEffect } from "react";
import EditBasicTradeForm from "./EditBasicTradeForm";
import EditAdvancedTradeForm from "./EditAdvancedTradeForm";

function EditTradeModal({
  setShowModal,
  trades,
  setTrades,
  trade,
}) {

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    pair: "",
    date: "",
    session: "",
    direction: "Buy",
    result: "Win",
    rr: "",
    pnl: "",
  
    entryTime: "",
    exitTime: "",
    duration: "",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
  
    lotSize: "",
    account: "",
    broker: "",
  
    riskR: "",
    returnR: "",
  
    tradeType: "",
    timeframe: "",
    setup: "",
  });
  useEffect(() => {
    if (!trade) return;
  
    setForm(trade);
  
  }, [trade]);
  
  const handleSaveTrade = () => {
    const updatedTrades = trades.map((t) =>
      t.id === trade.id
        ? {
            ...t,
  
            // preserve account
            accountId: t.accountId,
  
            ...form,
  
            updatedAt: new Date().toISOString(),
          }
        : t
    );
  
    setTrades(updatedTrades);
  
    setShowModal(false);
  };
  // Form aur handleSaveTrade yahin rahenge (ya baad me add karenge)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

{showAdvanced ? (
  <EditAdvancedTradeForm
    form={form}
    setForm={setForm}
    onBack={() => setShowAdvanced(false)}
    onSave={handleSaveTrade}
    onCancel={() => setShowModal(false)}
  />
) : (
  <EditBasicTradeForm
    form={form}
    setForm={setForm}
    onNext={() => setShowAdvanced(true)}
    onSave={handleSaveTrade}
    onCancel={() => setShowModal(false)}
  />
)}

    </div>
  );
}

export default EditTradeModal;