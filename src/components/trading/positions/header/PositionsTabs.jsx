import { useTrade } from "../../../../context/TradeContext";

export default function PositionsTabs({

  activeTab,
  setActiveTab,

}) {

  const {

    openTrades,
    closedTrades,
    pendingOrders = [],

  } = useTrade();

  const tabs = [

    {
      id: "open",
      label: "Open Positions",
      count: openTrades.length,
    },

    {
      id: "pending",
      label: "Pending Orders",
      count: pendingOrders.length,
    },

    {
      id: "closed",
      label: "Closed Positions",
      count: closedTrades.length,
    },

  ];

  return (

    <div className="flex border-b border-gray-200 px-6 pt-4">

      {tabs.map((tab) => (

        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            relative

            pb-4
            mr-10

            text-sm
            font-medium

            transition-all

            ${
              activeTab === tab.id
                ? "text-violet-600"
                : "text-gray-500 hover:text-black"
            }
          `}
        >

          {tab.label}

          <span
            className="
              ml-2

              rounded-full

              bg-gray-100

              px-2
              py-0.5

              text-xs
            "
          >
            {tab.count}
          </span>

          {activeTab === tab.id && (

            <div
              className="
                absolute

                bottom-0
                left-0
                right-0

                h-[3px]

                rounded-full

                bg-violet-600
              "
            />

          )}

        </button>

      ))}

    </div>

  );

}