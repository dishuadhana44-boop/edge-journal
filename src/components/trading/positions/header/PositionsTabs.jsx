import { useTrade } from "../../../../context/TradeContext";

export default function PositionsTabs({
  activeTab,
  onChange,
  counts = {},
}) {
  const { openTrades = [], closedTrades = [], pendingOrders = [] } =
    useTrade();

  const tabs = [
    {
      id: "open",
      label: "Open Positions",
      count: counts.open ?? openTrades.length,
    },
    {
      id: "pending",
      label: "Pending Orders",
      count: counts.pending ?? pendingOrders.length,
    },
    {
      id: "closed",
      label: "Closed Positions",
      count: counts.closed ?? closedTrades.length,
    },
  ];

  return (
    <div className="flex border-b border-gray-200 px-6 pt-4 dark:border-gray-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange?.(tab.id)}
          className={`
            relative
            mr-10
            pb-4
            text-sm
            font-medium
            transition-all
            ${
              activeTab === tab.id
                ? "text-violet-600 dark:text-violet-400"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-gray-100"
            }
          `}
        >
          {tab.label}

          <span
            className={`
              ml-2
              rounded-full
              px-2
              py-0.5
              text-xs
              ${
                activeTab === tab.id
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }
            `}
          >
            {tab.count}
          </span>

          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-violet-600 dark:bg-violet-500" />
          )}
        </button>
      ))}
    </div>
  );
}
