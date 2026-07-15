import ChartCard from "./ChartCard";
function ChartsSection({
  trade,
  setTrade,
}) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
  
        {/* Title */}
  
        <h2 className="text-lg font-semibold">
          Charts
        </h2>
  
        {/* Images */}

<div className="grid grid-cols-3 gap-2 mt-5">

<ChartCard
  title="HTF"
  image={trade?.charts?.htf}
  onChange={(img) =>
    setTrade({
      ...trade,
      charts: {
        ...trade.charts,
        htf: img,
      },
    })
  }
/>

<ChartCard
  title="MTF"
  image={trade?.charts?.mtf}
  onChange={(img) =>
    setTrade({
      ...trade,
      charts: {
        ...trade.charts,
        mtf: img,
      },
    })
  }
/>

<ChartCard
  title="LTF"
  image={trade?.charts?.ltf}
  onChange={(img) =>
    setTrade({
      ...trade,
      charts: {
        ...trade.charts,
        ltf: img,
      },
    })
  }
/>

</div>
  
        
  
            </div>
  
          
  
        
  
      
    );
  }
  
  export default ChartsSection;