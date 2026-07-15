import { useState } from "react";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatCards from "../components/dashboard/StatCards";
import BalanceCurve from "../components/dashboard/BalanceCurve";
import DisciplineCard from "../components/dashboard/DisciplineCard";
import RecentTrades from "../components/dashboard/RecentTrades";
import PnlByDay from "../components/dashboard/PnlByDay";
import SetupPerformance from "../components/dashboard/SetupPerformance";
import MetricsOverview from "../components/dashboard/MetricsOverview";
import CalendarHeatmap from "../components/dashboard/CalendarHeatmap";
import AIInsights from "../components/dashboard/AIInsights";

function Dashboard() {
  const [accounts, setAccounts] = useState([
    {
      id: 1,
      name: "Main Account",
      currency: "USD",
      startingBalance: 10000,
      currentBalance: 10000,
      totalPnL: 0,
      winRate: 0,
      trades: [],
    },
  ]);
  
  const [selectedAccount, setSelectedAccount] = useState("Main Account");
  
  const currentAccount = accounts.find(
    (account) => account.name === selectedAccount
  );
  
  const handleSaveAccount = (newAccount) => {
    const account = {
      id: Date.now(),
      ...newAccount,
      currentBalance: newAccount.startingBalance,
      totalPnL: 0,
      winRate: 0,
      trades: [],
    };
  
    setAccounts((prev) => [...prev, account]);
  
    setSelectedAccount(account.name);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-0 space-y-5">

<DashboardHeader
      accounts={accounts}
      selectedAccount={selectedAccount}
      setSelectedAccount={setSelectedAccount}
      onSaveAccount={handleSaveAccount}
    />

    <div className="-mt-4">
      <StatCards account={currentAccount} />
</div>

      {/* Row 1 */}
      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-8">
          <BalanceCurve />
        </div>

        <div className="col-span-4">
          <DisciplineCard />
        </div>

      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-7">
          <RecentTrades />
        </div>

        <div className="col-span-5">
          <PnlByDay />
        </div>

      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-4">
          <SetupPerformance />
        </div>

        <div className="col-span-4">
          <MetricsOverview />
        </div>

        <div className="col-span-4">
          <CalendarHeatmap />
        </div>

      </div>

      {/* Row 4 */}

      <AIInsights />

    </div>
     
  );
}

export default Dashboard;