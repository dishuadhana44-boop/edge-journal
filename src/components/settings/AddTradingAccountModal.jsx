import { useState } from "react";
import { X, Plus } from "lucide-react";

export default function AddTradingAccountModal({

  accounts,
  setAccounts,
  setSelectedAccount,
  setShowModal,

}) {

  const [form, setForm] = useState({

    accountName: "",
    currency: "USD",
    startingBalance: "",
    accountType: "Funded",

  });

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  };

  const handleCreate = () => {

    if (!form.accountName.trim()) return;

    const newAccount = {

      id: Date.now(),

      accountName: form.accountName,

      currency: form.currency,

      startingBalance: Number(form.startingBalance),

      accountType: form.accountType,

      isDefault: accounts.length === 0,

    };

    const updated = [...accounts, newAccount];

    setAccounts(updated);

    setSelectedAccount(newAccount);

    localStorage.setItem(
      "tradingAccounts",
      JSON.stringify(updated)
    );

    setShowModal(false);

  };

  return (

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white rounded-3xl w-[550px] p-8">

        {/* Header */}

        <div className="flex justify-between items-center mb-8">

          <h2 className="text-2xl font-bold">
            Add Trading Account
          </h2>

          <button
            onClick={() => setShowModal(false)}
          >
            <X />
          </button>

        </div>

        <div className="space-y-6">

          <div>

            <label className="text-sm font-medium">
              Account Name
            </label>

            <input

              name="accountName"

              value={form.accountName}

              onChange={handleChange}

              className="
              w-full
              mt-2
              border
              rounded-xl
              px-4
              py-3
              "

            />

          </div>

          <div>

            <label className="text-sm font-medium">
              Currency
            </label>

            <select

              name="currency"

              value={form.currency}

              onChange={handleChange}

              className="
              w-full
              mt-2
              border
              rounded-xl
              px-4
              py-3
              "

            >

              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>INR</option>

            </select>

          </div>

          <div>

            <label className="text-sm font-medium">
              Starting Balance
            </label>

            <input

              type="number"

              name="startingBalance"

              value={form.startingBalance}

              onChange={handleChange}

              className="
              w-full
              mt-2
              border
              rounded-xl
              px-4
              py-3
              "

            />

          </div>

          <div>

            <label className="text-sm font-medium">
              Account Type
            </label>

            <select

              name="accountType"

              value={form.accountType}

              onChange={handleChange}

              className="
              w-full
              mt-2
              border
              rounded-xl
              px-4
              py-3
              "

            >

              <option>Funded</option>
              <option>Live</option>
              <option>Demo</option>

            </select>

          </div>

        </div>

        {/* Buttons */}

        <div className="flex justify-end gap-4 mt-8">

          <button

            onClick={() => setShowModal(false)}

            className="
            px-5
            py-3
            rounded-xl
            border
            "

          >

            Cancel

          </button>

          <button

            onClick={handleCreate}

            className="
            px-6
            py-3
            rounded-xl
            bg-violet-600
            hover:bg-violet-700
            text-white
            flex
            items-center
            gap-2
            "

          >

            <Plus size={18} />

            Create Account

          </button>

        </div>

      </div>

    </div>

  );

}