import { Save, X } from "lucide-react";

export default function TradingAccountsEdit({

  account,

  accounts,

  setAccounts,

  setSelectedAccount,

  setIsEditing,

}) {

  const handleChange = (e) => {

    const updatedAccount = {
  
      ...account,
  
      [e.target.name]:
        e.target.name === "startingBalance"
          ? Number(e.target.value)
          : e.target.value,
  
    };
  
    setSelectedAccount(updatedAccount);
  
  };

  const handleSave = () => {

    const updatedAccounts = accounts.map((a) =>
      a.id === account.id ? account : a
    );
  
    setAccounts(updatedAccounts);
  
    localStorage.setItem(
      "tradingAccounts",
      JSON.stringify(updatedAccounts)
    );
  
    setIsEditing(false);
  
  };

  return (

    <div>

      <div className="grid grid-cols-2 gap-6">

        {/* Account Name */}

        <div>

          <label className="text-sm font-medium">

            Account Name

          </label>

          <input

            name="accountName"

            value={account.accountName}

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

        {/* Currency */}

        <div>

          <label className="text-sm font-medium">

            Currency

          </label>

          <select

            name="currency"

            value={account.currency}

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

            <option>CHF</option>

            <option>AUD</option>

            <option>JPY</option>

            <option>CAD</option>

            <option>NZD</option>

           

          </select>

        </div>

        {/* Starting Balance */}

        <div>

          <label className="text-sm font-medium">

            Starting Balance

          </label>

          <input

            type="number"

            name="startingBalance"

            value={account.startingBalance}

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

        {/* Account Type */}

        <div>

          <label className="text-sm font-medium">

            Account Type

          </label>

          <select

            name="accountType"

            value={account.accountType}

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

            <option>Demo</option>

            <option>Live</option>

            <option>Funded</option>

          </select>

        </div>

      </div>

      {/* Buttons */}

      <div className="flex justify-end gap-3 mt-8">

        <button

          onClick={() => setIsEditing(false)}

          className="

          px-5

          py-2.5

          rounded-xl

          border

          hover:bg-gray-100

          flex

          items-center

          gap-2

          "

        >

          <X size={18} />

          Cancel

        </button>

        <button

          onClick={handleSave}

          className="

          px-5

          py-2.5

          rounded-xl

          bg-violet-600

          hover:bg-violet-700

          text-white

          flex

          items-center

          gap-2

          "

        >

          <Save size={18} />

          Save

        </button>

      </div>

    </div>

  );

}