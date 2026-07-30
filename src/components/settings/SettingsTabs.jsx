export default function SettingsTabs({
    activeTab,
    setActiveTab,
  }) {
    const tabs = [
      "Account",
      "Trading Accounts",
      "Language",
      "Notifications",
      "Appearance",
      "Security",
      "Backup & Data",
      "About",
    ];
  
    return (
      <div className="border-b border-gray-200 mb-8">
  
        <div className="flex gap-8 overflow-x-auto">
  
          {tabs.map((tab) => (
  
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                pb-3
                text-sm
                whitespace-nowrap
                transition-all
  
                ${
                  activeTab === tab
                    ? "border-b-2 border-violet-600 text-violet-600 font-semibold"
                    : "text-gray-500 hover:text-black"
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