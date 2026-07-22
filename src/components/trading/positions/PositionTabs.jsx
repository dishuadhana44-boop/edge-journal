export default function PositionTabs({

    activeTab,
    setActiveTab,
  
    openCount,
    pendingCount,
    closedCount,
  
  }) {
  
    const tabs = [
  
      {
        id: "open",
        label: `Open Positions ${openCount}`,
      },
  
      {
        id: "pending",
        label: `Pending Orders ${pendingCount}`,
      },
  
      {
        id: "closed",
        label: `Closed Positions ${closedCount}`,
      },
  
    ];
  
    return (
  
      <div className="flex border-b border-gray-200">
  
        {tabs.map((tab) => (
  
          <button
  
            key={tab.id}
  
            onClick={() => setActiveTab(tab.id)}
  
            className={`
  
              px-5
              py-3
  
              text-sm
  
              border-b-2
  
              transition
  
              ${
                activeTab === tab.id
  
                  ? "border-violet-600 text-violet-600 font-semibold"
  
                  : "border-transparent text-gray-500"
  
              }
  
            `}
          >
  
            {tab.label}
  
          </button>
  
        ))}
  
      </div>
  
    );
  
  }