import { useState, useEffect } from "react";

import EditBasicTradeForm from "./EditBasicTradeForm";
import EditAdvancedTradeForm from "./EditAdvancedTradeForm";

import { useJournal } from "../../context/JournalContext";

function EditTradeModal({
  setShowModal,
  trade,
}) {
  const { updateTrade } = useJournal();

  const [showAdvanced, setShowAdvanced] =
    useState(false);

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

  // ============================================================
  // LOAD TRADE INTO FORM
  // ============================================================

  useEffect(() => {
    if (!trade) {
      return;
    }

    setForm({
      ...form,
      ...trade,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade]);

  // ============================================================
  // UPDATE TRADE
  // ============================================================

  const handleSaveTrade = () => {
    if (!trade?.id) {
      console.error(
        "❌ Cannot update trade: trade ID is missing."
      );
      return;
    }

    const updatedTrade = {
      ...form,

      // IMPORTANT:
      // Never allow editing a trade to move it
      // to another trading account.
      accountId:
        trade.accountId ??
        trade.accountID ??
        null,

      updatedAt:
        new Date().toISOString(),
    };

    console.log(
      "🟣 UPDATING TRADE:",
      {
        tradeId: trade.id,
        accountId:
          updatedTrade.accountId,
        updatedTrade,
      }
    );

    updateTrade(updatedTrade);

    setShowModal(false);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      {showAdvanced ? (
        <EditAdvancedTradeForm
          form={form}
          setForm={setForm}
          onBack={() =>
            setShowAdvanced(false)
          }
          onSave={handleSaveTrade}
          onCancel={() =>
            setShowModal(false)
          }
        />
      ) : (
        <EditBasicTradeForm
          form={form}
          setForm={setForm}
          onNext={() =>
            setShowAdvanced(true)
          }
          onSave={handleSaveTrade}
          onCancel={() =>
            setShowModal(false)
          }
        />
      )}
    </div>
  );
}

export default EditTradeModal;