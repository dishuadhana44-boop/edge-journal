import { useState } from "react";

function AddAccountModal({
    open,
    onClose,
    onSave,
  }) {

    const [accountName, setAccountName] = useState("");
const [currency, setCurrency] = useState("USD");
const [startingBalance, setStartingBalance] = useState("");

const [errors, setErrors] = useState({});

const handleSave = () => {
    const newErrors = {};
  
    if (!accountName.trim()) {
      newErrors.accountName = "Account Name is required";
    }
  
    if (!startingBalance.trim()) {
      newErrors.startingBalance = "Starting Balance is required";
    }
  
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
  
    onSave({
      name: accountName,
      currency,
      startingBalance: Number(startingBalance),
    });
  
    setAccountName("");
    setCurrency("USD");
    setStartingBalance("");
    setErrors({});
  };

    if (!open) return null;
  
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  
        <div className="w-[500px] rounded-2xl bg-white shadow-2xl">
  
          {/* Header */}
  
          <div className="border-b px-6 py-5">
            <h2 className="text-2xl font-bold">
              Add Account
            </h2>
          </div>
  
          {/* Body */}
  
          <div className="p-6 space-y-5">
  
            {/* Account Name */}
  
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">
                Account Name *
              </label>
  
              <input
  type="text"
  value={accountName}
  onChange={(e) => setAccountName(e.target.value)}
  placeholder="Enter account name"
  className="w-full h-12 rounded-xl border border-gray-300 px-4 outline-none focus:border-purple-600"
/>
{errors.accountName && (
  <p className="mt-1 text-sm text-red-600">
    {errors.accountName}
  </p>
)}
            </div>
  
            {/* Currency */}
  
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">
                Currency *
              </label>
  
              <select
  value={currency}
  onChange={(e) => setCurrency(e.target.value)}
  className="w-full h-12 rounded-xl border border-gray-300 px-4 outline-none focus:border-purple-600"
>
                <option>USD ($)</option>
                <option>EUR (€)</option>
                <option>GBP (£)</option>
                <option>INR (₹)</option>
                <option>JPY (¥)</option>
                <option>AUD (A$)</option>
                <option>CAD (C$)</option>
              </select>
            </div>
  
            {/* Starting Balance */}
  
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">
                Starting Balance *
              </label>
  
              <input
  type="number"
  value={startingBalance}
  onChange={(e) => setStartingBalance(e.target.value)}
  placeholder="10000"
  className="w-full h-12 rounded-xl border border-gray-300 px-4 outline-none focus:border-purple-600"
/>
{errors.startingBalance && (
  <p className="mt-1 text-sm text-red-600">
    {errors.startingBalance}
  </p>
)}
            </div>
  
          </div>
  
          {/* Footer */}
  
          <div className="flex justify-end gap-3 border-t p-6">
  
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
  
            <button
  onClick={handleSave}
  className="px-6 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700"
>
  Save Account
</button>
  
          </div>
  
        </div>
  
      </div>
    );
  }
  
  export default AddAccountModal;