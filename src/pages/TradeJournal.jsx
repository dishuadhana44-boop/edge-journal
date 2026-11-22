import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import JournalLayout from "../components/trade/JournalLayout";
import { useJournal } from "../context/JournalContext";
import { describeJournalPersistence } from "../lib/journalPersistenceStatus.js";
import {
  compareJournalPersistence,
  journalPersistenceKey,
} from "../lib/journalPersistenceStore.js";



function TradeJournal() {

  const { trades, setTrades, journalPersistence } = useJournal();
  const { id } = useParams();
  console.log(id);
  const navigate = useNavigate();

  // What the published storage outcome proves right now, in wording the
  // status module already tested.
  const persistenceView =
    describeJournalPersistence(journalPersistence);

  // The published status is a snapshot of what storage already did, so it can
  // still describe the previous save while this click's write is pending.
  // Nothing here may assume JournalContext's save effect has finished. The key
  // comes from the tested store so it also moves when a newer verified write is
  // reported with status fields that repeated.
  const persistenceKey =
    journalPersistenceKey(journalPersistence);

  const trade = trades.find(
    (t) => String(t.id) === String(id)
  );
 
 
  const currentIndex = trades.findIndex(
    (t) => String(t.id) === String(id)
  );
  
  const previousTrade =
    currentIndex > 0
      ? trades[currentIndex - 1]
      : null;
  
  const nextTrade =
    currentIndex < trades.length - 1
      ? trades[currentIndex + 1]
      : null;


  const [saveAcknowledged, setSaveAcknowledged] = useState(false);

  // Snapshot of the published status taken when this save was requested.
  const [saveBaseline, setSaveBaseline] = useState(null);
 

  // A save may be called confirmed only when the published state moved AND the
  // status module allows the saved claim. The comparison is the tested helper's
  // job, so neither half can be satisfied on its own: a newer receipt with a
  // failed or unverified write confirms nothing, and a healthy state left over
  // from an earlier save confirms nothing either. A receipt says a verified
  // write happened after this click, not that this click caused it.
  const saveConfirmed = compareJournalPersistence(
    journalPersistence,
    saveBaseline,
    persistenceView
  ).confirmed;

  const saveWording = saveConfirmed
    ? {
        badge: "✓",
        tone: "bg-green-500",
        title: persistenceView.title,
        detail: persistenceView.detail,
        bar: "bg-green-400",
      }
    : {
        badge: "!",
        tone: "bg-amber-500",
        title: "Changes are not confirmed as saved",
        detail:
          "This browser has not confirmed that these changes reached its storage.",
        bar: "bg-amber-300",
      };


  const handleSave = () => {
    if (!trade) return;
  
    setTrades((prev) =>
      prev.map((t) =>
        t.id === trade.id
          ? {
              ...trade,
              updatedAt: new Date().toISOString(),
            }
          : t
      )
    );
  
    setSaveBaseline(persistenceKey);
    setSaveAcknowledged(true);
  };

  // The acknowledgement stays only while the published status keeps changing.
  // The persistent banner in AppLayout carries any failure after it goes away.
  useEffect(() => {
    if (!saveAcknowledged) return;

    const timer = setTimeout(
      () => setSaveAcknowledged(false),
      4000
    );

    return () => clearTimeout(timer);
  }, [saveAcknowledged, journalPersistence]);

  
  return (
    <>
      {saveAcknowledged && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 toast-slide-in"
        >
  
          <div className="bg-[#7C3AED] text-white rounded-2xl shadow-2xl overflow-hidden min-w-[330px]">
  
            <div className="flex items-center gap-4 px-5 py-4">
  
              <div
                className={`w-9 h-9 rounded-full ${saveWording.tone} flex items-center justify-center text-lg font-bold`}
              >
                {saveWording.badge}
              </div>
  
              <div>
                <p className="font-semibold">
                  {saveWording.title}
                </p>
  
                <p className="text-sm text-purple-100">
                  {saveWording.detail}
                </p>
              </div>
  
            </div>
  
            <div className="h-1 bg-purple-300">
            <div className={`h-full ${saveWording.bar} toast-progress`}></div>
            </div>
  
          </div>
  
        </div>
      )}
  
  <JournalLayout
  trade={trade}
  setTrade={(updatedTrade) => {
    setTrades((prev) =>
      prev.map((t) =>
        t.id === updatedTrade.id ? updatedTrade : t
      )
    );
  }}
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