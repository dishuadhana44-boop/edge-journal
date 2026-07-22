import { useState } from "react";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatCards from "../components/dashboard/StatCards";
import EquityCurve from "../components/dashboard/EquityCurve";
import RecentTradesCard from "../components/dashboard/RecentTrades/RecentTradesCard";
import DisciplineCard from "../components/dashboard/Discipline/DisciplineCard";


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
    <div className="w-full h-[calc(100vh-78px)] px-1 py-2 ">

<DashboardHeader
      accounts={accounts}
      selectedAccount={selectedAccount}
      setSelectedAccount={setSelectedAccount}
      onSaveAccount={handleSaveAccount}
    />

    <div className="-mt-4">
      <StatCards account={currentAccount} />
</div>

<div className="grid grid-cols-12 gap-x-3 ">

  {/* Top Row */}
  <div className="col-span-8">
    <EquityCurve />
  </div>

  <div className="col-span-4">
    <DisciplineCard />
  </div>

  {/* Bottom Row */}
  <div className="col-span-8 -mt-57 ">
    <RecentTradesCard />
  </div>

</div>

</div>



        
  );
}

export default Dashboard;