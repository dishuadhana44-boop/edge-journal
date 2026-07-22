import { useState } from "react";
import AddAccountModal from "../AddAccountModal";

import DateRangePicker from "./DateRangePicker";

function DashboardHeader({
  accounts,
  selectedAccount,
  setSelectedAccount,
  onSaveAccount,
}) {
  
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
  
        {/* Left */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard
          </h1>
  
          <p className="text-gray-500">
            Review, analyze and improve every day.
          </p>
        </div>
  
        {/* Right */}
        <div className="flex items-center gap-3">
  
          <DateRangePicker />
  
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl font-medium transition"
          >
            + Add Account
          </button>
  
         
          <select
  value={selectedAccount}
  onChange={(e) => setSelectedAccount(e.target.value)}
  className="border border-gray-300 rounded-xl px-4 py-2 bg-white min-w-[150px]"
>
  {accounts?.map((account) => (
    <option key={account.id} value={account.name}>
      {account.name}
    </option>
  ))}
</select>

  
        </div>
  
      </div>
  
      {/* 👇 STEP D YAHI PASTE KARNA HAI */}
  
      <AddAccountModal
  open={showAddAccountModal}
  onClose={() => setShowAddAccountModal(false)}
  onSave={(account) => {
    onSaveAccount(account);
    setShowAddAccountModal(false);
  }}
/>
  
    </>
  );
}

export default DashboardHeader;