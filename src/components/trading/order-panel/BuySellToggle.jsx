import useOrder from "./context/useOrder";

export default function BuySellToggle() {

  const {
    side,
    setSide,
  } = useOrder();

  return (
    <div className="px-4 pt-4">

      <div className="
        grid
        grid-cols-2
        gap-2
        p-1
        rounded-xl
        bg-gray-100
      ">

        {/* BUY */}

        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`
            py-2.5
            rounded-lg
            text-sm
            font-semibold
            transition-all
            duration-200

            ${
              side === "buy"
                ? `
                  bg-emerald-500
                  text-white
                  shadow-sm
                `
                : `
                  text-gray-500
                  hover:text-gray-700
                  hover:bg-white
                `
            }
          `}
        >
          Buy
        </button>


        {/* SELL */}

        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`
            py-2.5
            rounded-lg
            text-sm
            font-semibold
            transition-all
            duration-200

            ${
              side === "sell"
                ? `
                  bg-red-500
                  text-white
                  shadow-sm
                `
                : `
                  text-gray-500
                  hover:text-gray-700
                  hover:bg-white
                `
            }
          `}
        >
          Sell
        </button>

      </div>

    </div>
  );
}