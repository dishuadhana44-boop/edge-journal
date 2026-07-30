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