import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import TradingAccountsSidebar from "./TradingAccountsSidebar";
import TradingAccountsView from "./TradingAccountsView";
import TradingAccountsEdit from "./TradingAccountsEdit";
import AddTradingAccountModal from "./AddTradingAccountModal";

import { useJournal } from "../../context/JournalContext";

export default function TradingAccountsPage() {

  const [accounts, setAccounts] = useState(() => {
    const { setSelectedAccountId } = useJournal();


    return (
      JSON.parse(localStorage.getItem("tradingAccounts")) ||

      [
        {
          id: 1,
          accountName: "FTMO Challenge",
          currency: "USD",
          startingBalance: 100000,
          accountType: "Funded",
          isDefault: true,
        },
      ]

    );

  });

  const [selectedAccount, setSelectedAccount] = useState(accounts[0]);
  const {
    selectedAccountId,
    setSelectedAccountId,
  } = useJournal();

  useEffect(() => {

    const current =
      accounts.find(
        (a) => Number(a.id) === Number(selectedAccountId)
      ) || accounts[0];
  
    if (current) {
      setSelectedAccount(current);
    }
  
  }, [accounts, selectedAccountId]);

  const [isEditing, setIsEditing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {

    localStorage.setItem(
      "tradingAccounts",
      JSON.stringify(accounts)
    );

  }, [accounts]);

  const [deleteId, setDeleteId] = useState(null);

  const handleDelete = (id) => {

    const updated = accounts.filter(
      (a) => a.id !== id
    );
  
    setAccounts(updated);
  
    localStorage.setItem(
      "tradingAccounts",
      JSON.stringify(updated)
    );
  
    if (updated.length > 0) {
  
      setSelectedAccount(updated[0]);
  
    }
  
  };
  
  const handleSetDefault = (id) => {
  
    const updated = accounts.map((a) => ({
  
      ...a,
  
      isDefault: a.id === id,
  
    }));
    setSelectedAccount(
      updated.find((a) => a.id === id)
    );
    
    setSelectedAccountId(id);
    
    localStorage.setItem(
      "selectedAccountId",
      id
    );
  
    setAccounts(updated);
  
    localStorage.setItem(
      "tradingAccounts",
      JSON.stringify(updated)
    );
  
  };

  return (

    <div className="w-full max-w-6xl mx-auto px-6">

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">

        {/* Header */}

        <div className="flex items-center justify-between p-6 ">

          <div>

            <h2 className="text-2xl font-bold">
              Trading Accounts
            </h2>

           

          </div>

          {!isEditing && (

            <button

              onClick={() => setIsEditing(true)}

              className="
              bg-violet-600
              hover:bg-violet-700
              text-white
              px-5
              py-2.5
              rounded-xl
              flex
              items-center
              gap-2
              "

            >

              <Pencil size={18} />

              Edit

            </button>

          )}

        </div>

        {/* Body */}

        <div className="flex min-h-[530px]">

        <TradingAccountsSidebar

accounts={accounts}

selectedAccount={selectedAccount}

setSelectedAccount={setSelectedAccount}

onAdd={() => setShowAddModal(true)}

onDelete={(id) => setDeleteId(id)}

onSetDefault={handleSetDefault}

/>

          <div className="flex-1 p-8">

            <AnimatePresence mode="wait">

              {isEditing ? (

                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >

                  <TradingAccountsEdit

                    account={selectedAccount}

                    accounts={accounts}

                    setAccounts={setAccounts}

                    setSelectedAccount={setSelectedAccount}

                    setIsEditing={setIsEditing}

                  />

                </motion.div>

              ) : (

                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >

                  <TradingAccountsView
                    account={selectedAccount}
                  />

                </motion.div>

              )}

            </AnimatePresence>

          </div>

        </div>

      </div>

      {showAddModal && (

        <AddTradingAccountModal

          accounts={accounts}

          setAccounts={setAccounts}

          setSelectedAccount={setSelectedAccount}

          setShowModal={setShowAddModal}

        />

      )}

{deleteId && (

<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

  <div className="bg-white rounded-3xl p-8 w-[420px]">

    <h2 className="text-xl font-bold">

      Delete Account

    </h2>

    <p className="text-gray-500 mt-3">

      Are you sure you want to delete this account?

    </p>

    <div className="flex justify-end gap-4 mt-8">

      <button

        onClick={() => setDeleteId(null)}

        className="border rounded-xl px-5 py-3"

      >

        Cancel

      </button>

      <button

        onClick={() => {

          handleDelete(deleteId);

          setDeleteId(null);

        }}

        className="
        bg-red-600
        hover:bg-red-700
        text-white
        rounded-xl
        px-6
        py-3
        "

      >

        Delete

      </button>

    </div>

  </div>

</div>

)}

    </div>

  );

}