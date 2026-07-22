import useOrder from "../order-panel/context/useOrder";
import { useMarket } from "../../../context/MarketContext";
import { useTrade } from "../../../context/TradeContext";

export default function QuickTradeGrid() {
    
    const {
        lots,
        setLots,
      
        setEntry,
        setSide,
      
      } = useOrder();
      const { bid, ask } = useMarket();

      const { executeTrade } = useTrade();

    const increaseLots = () => {
        setLots(Number((lots + 0.01).toFixed(2)));
      };
      
      const decreaseLots = () => {
        if (lots > 0.01) {
          setLots(Number((lots - 0.01).toFixed(2)));
        }
      };
      const handleBuy = () => {

  setSide("buy");

  setEntry(ask.toFixed(5));

  executeTrade({

    symbol: "EURUSD",

    side: "BUY",

    lots,

    entry: Number(ask),

    sl: 0,

    tp: 0,

  });

};
const handleSell = () => {

    setSide("sell");
  
    setEntry(bid.toFixed(5));
  
    executeTrade({
  
      symbol: "EURUSD",
  
      side: "SELL",
  
      lots,
  
      entry: Number(bid),
  
      sl: 0,
  
      tp: 0,
  
    });
  
  };

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
  
        <div className="grid grid-cols-3">
  
          {/* BUY */}
  
          <button
  onClick={handleBuy}
            className="
              flex
              flex-col
              items-center
              justify-center
  
              py-3
  
              bg-emerald-50
  
              hover:bg-emerald-500
              hover:text-white
  
              transition-all
              duration-200
            "
          >
            <span className="text-[10px] font-semibold uppercase">
              Buy
            </span>
  
            <span className="mt-1 text-[12px] font-semibold">
            {ask.toFixed(5)}
            </span>
          </button>
  
          {/* LOTS */}
  
          <div
  className="
    flex
    items-center
    justify-center
    gap-2

    border-x
    border-gray-200

    bg-white

    px-2
  "
>

  <button
    onClick={decreaseLots}
    className="
      w-7
      h-7

      rounded-lg

      bg-gray-100

      hover:bg-gray-200

      text-lg
      font-semibold

      transition
    "
  >
    −
  </button>

  <input
    value={lots}
    onChange={(e) =>
      setLots(Number(e.target.value))
    }
    className="
      w-12

      text-center

      font-semibold

      outline-none

      bg-transparent
    "
  />

  <button
    onClick={increaseLots}
    className="
      w-7
      h-7

      rounded-lg

      bg-gray-100

      hover:bg-gray-200

      text-lg
      font-semibold

      transition
    "
  >
    +
  </button>

</div>
  
          {/* SELL */}
  
          <button
  onClick={handleSell}
            className="
              flex
              flex-col
              items-center
              justify-center
  
              py-3
  
              bg-red-50
  
              hover:bg-red-500
              hover:text-white
  
              transition-all
              duration-200
            "
          >
            <span className="text-[10px] font-semibold uppercase">
              Sell
            </span>
  
            <span className="mt-1 text-[12px] font-semibold">
            {bid.toFixed(5)}
            </span>
          </button>
  
        </div>
  
      </div>
    );
  }