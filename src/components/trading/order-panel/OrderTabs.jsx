import useOrder from "./context/useOrder";

const tabs = [
  "Market",
  "Limit",
  "Stop",
];

export default function OrderTabs() {
  const {
    orderType,
    setOrderType,
  } = useOrder();

  return (
    <div className="px-4 pt-4">

      <div className="grid grid-cols-3 rounded-xl bg-gray-100 p-1">

        {tabs.map((tab) => (

          <button
            key={tab}
            onClick={() => setOrderType(tab)}
            className={`
              py-2
              rounded-lg
              text-sm
              font-medium
              transition-all
              duration-200

              ${
                orderType === tab
                  ? "bg-white shadow text-violet-600"
                  : "text-gray-500 hover:bg-gray-50"
              }
            `}
          >
            {tab}
          </button>

        ))}

      </div>

    </div>
  );
}