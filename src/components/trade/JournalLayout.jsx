import TradeHeader from "./TradeHeader";
import TradeDetails from "./TradeDetails";
import ChartsSection from "./ChartsSection";
import ReflectionSection from "./ReflectionSection";

function JournalLayout({
  trade,
  setTrade,
  onSave,
  previousTrade,
  nextTrade,
}) {

  if (!trade) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-gray-500 text-lg">
          Loading Trade...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-2">

      <div className="bg-white rounded-2xl border border-gray-200 p-6">

      <TradeHeader
  trade={trade}
  previousTrade={previousTrade}
  nextTrade={nextTrade}
  onSave={onSave}
/>

      </div>
      <div className="flex gap-5 mt-5">

<TradeDetails
  trade={trade}
  setTrade={setTrade}
/>

<div className="flex-1 flex flex-col gap-5">

  <ChartsSection
    trade={trade}
    setTrade={setTrade}
  />

  <ReflectionSection
    trade={trade}
    setTrade={setTrade}
  />

</div>

</div>

    </div>
  );
}

export default JournalLayout;