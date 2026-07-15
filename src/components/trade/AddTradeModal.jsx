import { useState, useEffect } from "react";
import BasicTradeForm from "./BasicTradeForm";
import AdvancedTradeForm from "./AdvancedTradeForm";

function AddTradeModal({
  setShowModal,
  trades,
  setTrades,

  editTrade = null,
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
    if (!editTrade) return;
  
    setForm(editTrade);
  
  }, [editTrade]);
  const handleSaveTrade = () => {
    const newTrade = {
      id: Date.now(),
  
      // BASIC
      pair: form.pair,
      date: form.date,
      session: form.session,
      direction: form.direction,
      result: form.result,
      pnl: form.pnl,
      rr: form.rr,
  
      day: new Date(form.date).toLocaleDateString("en-US", {
        weekday: "long",
      }),
  
      // EXECUTION
      entryTime: form.entryTime,
      exitTime: form.exitTime,
      duration: form.duration,
      entryPrice: form.entryPrice,
      stopLoss: form.stopLoss,
      takeProfit: form.takeProfit,
  
      // POSITION
      lotSize: form.lotSize,
      account: form.account,
      broker: form.broker,
  
      // PERFORMANCE
      riskR: form.riskR,
      returnR: form.returnR,
  
      // EXTRA
      tradeType: form.tradeType,
      timeframe: form.timeframe,
      setup: form.setup,
  
      // JOURNAL (future)
      followedPlan: false,
      plans: [],
      confluences: [],
      mistakes: [],
      notes: "",
      aiAnalysis: "",
  
      // IMAGES
      htfImage: "",
      mtfImage: "",
      ltfImage: "",
  
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  
    setTrades([...trades, newTrade]);
  
    setShowModal(false);
  };
  // Form aur handleSaveTrade yahin rahenge (ya baad me add karenge)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      {showAdvanced ? (
        <AdvancedTradeForm
          form={form}
          setForm={setForm}
          onBack={() => setShowAdvanced(false)}
          onSave={handleSaveTrade}
          onCancel={() => setShowModal(false)}
        />
      ) : (
        <BasicTradeForm
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

export default AddTradeModal;