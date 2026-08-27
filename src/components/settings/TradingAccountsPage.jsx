import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import TradingAccountsSidebar from "./TradingAccountsSidebar";
import TradingAccountsView from "./TradingAccountsView";
import TradingAccountsEdit from "./TradingAccountsEdit";
import AddTradingAccountModal from "./AddTradingAccountModal";

import { useJournal } from "../../context/JournalContext";

export default function TradingAccountsPage() {
  // -----------------------------------------
  // JOURNAL CONTEXT
  // -----------------------------------------

  const {
    selectedAccountId,
    setSelectedAccountId,
  } = useJournal();


  // -----------------------------------------
  // LOAD ACCOUNTS
  // -----------------------------------------

  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem("tradingAccounts");

      if (saved !== null) {
        return JSON.parse(saved) || [];
      }

      // Only create default account
      // when there is NO saved account data.
      return [
        {
          id: 1,
          accountName: "FTMO Challenge",
          currency: "USD",
          startingBalance: 100000,
          accountType: "Funded",
          isDefault: true,
        },
      ];
    } catch (error) {
      console.error("Failed to load trading accounts:", error);
      return [];
    }
  });


  // -----------------------------------------
  // SELECTED ACCOUNT
  // -----------------------------------------

  const [selectedAccount, setSelectedAccount] = useState(null);


  // -----------------------------------------
  // KEEP SELECTED ACCOUNT VALID
  // -----------------------------------------

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccount(null);

      // Important:
      // old deleted account ID must be removed.
      setSelectedAccountId(null);
      localStorage.removeItem("selectedAccountId");

      return;
    }


    // First try currently selected account
    let current = accounts.find(
      (account) =>
        Number(account.id) === Number(selectedAccountId)
    );


    // If selected account was deleted,
    // use default account.
    if (!current) {
      current =
        accounts.find((account) => account.isDefault) ||
        accounts[0];
    }


    if (current) {
      setSelectedAccount(current);

      // Keep JournalContext synchronized
      setSelectedAccountId(current.id);

      localStorage.setItem(
        "selectedAccountId",
        String(current.id)
      );
    }

  }, [
    accounts,
    selectedAccountId,
    setSelectedAccountId,
  ]);


  // -----------------------------------------
  // UI STATE
  // -----------------------------------------

  const [isEditing, setIsEditing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);

  const [deleteId, setDeleteId] = useState(null);


  // -----------------------------------------
  // SAVE ACCOUNTS
  // -----------------------------------------

  useEffect(() => {
    localStorage.setItem(
      "tradingAccounts",
      JSON.stringify(accounts)
    );
  }, [accounts]);


  // -----------------------------------------
  // DELETE ACCOUNT
  // -----------------------------------------

  const handleDelete = (id) => {
    const updated = accounts.filter(
      (account) =>
        Number(account.id) !== Number(id)
    );


    setAccounts(updated);


    // -----------------------------------------
    // NO ACCOUNTS LEFT
    // -----------------------------------------

    if (updated.length === 0) {
      setSelectedAccount(null);

      setSelectedAccountId(null);

      localStorage.removeItem(
        "selectedAccountId"
      );

      localStorage.setItem(
        "tradingAccounts",
        JSON.stringify([])
      );

      setIsEditing(false);

      return;
    }


    // -----------------------------------------
    // SELECT FALLBACK ACCOUNT
    // -----------------------------------------

    const nextAccount =
      updated.find(
        (account) => account.isDefault
      ) ||
      updated[0];


    setSelectedAccount(nextAccount);

    setSelectedAccountId(
      nextAccount.id
    );

    localStorage.setItem(
      "selectedAccountId",
      String(nextAccount.id)
    );
  };


  // -----------------------------------------
  // SET DEFAULT ACCOUNT
  // -----------------------------------------

  const handleSetDefault = (id) => {
    const updated = accounts.map(
      (account) => ({
        ...account,

        isDefault:
          Number(account.id) === Number(id),
      })
    );


    const selected = updated.find(
      (account) =>
        Number(account.id) === Number(id)
    );


    setAccounts(updated);


    if (selected) {
      setSelectedAccount(selected);

      setSelectedAccountId(
        selected.id
      );

      localStorage.setItem(
        "selectedAccountId",
        String(selected.id)
      );
    }
  };


  // -----------------------------------------
  // RENDER
  // -----------------------------------------

  return (
    <div className="w-full max-w-6xl mx-auto px-6">

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">

        {/* HEADER */}

        <div className="flex items-center justify-between p-6">

          <div>
            <h2 className="text-2xl font-bold">
              Trading Accounts
            </h2>
          </div>


          {!isEditing && selectedAccount && (
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


        {/* BODY */}

        <div className="flex min-h-[530px]">

          {/* SIDEBAR */}

          <TradingAccountsSidebar
            accounts={accounts}
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
            onAdd={() => setShowAddModal(true)}
            onDelete={(id) => setDeleteId(id)}
            onSetDefault={handleSetDefault}
          />


          {/* MAIN */}

          <div className="flex-1 p-8">

            {!selectedAccount ? (

              <div className="h-full flex items-center justify-center">

                <div className="text-center">

                  <h3 className="text-lg font-semibold text-gray-900">
                    No Trading Account
                  </h3>

                  <p className="text-sm text-gray-500 mt-2">
                    Create a trading account to continue.
                  </p>

                  <button
                    onClick={() => setShowAddModal(true)}
                    className="
                      mt-5
                      bg-violet-600
                      hover:bg-violet-700
                      text-white
                      px-5
                      py-2.5
                      rounded-xl
                    "
                  >
                    Add Trading Account
                  </button>

                </div>

              </div>

            ) : (

              <AnimatePresence mode="wait">

                {isEditing ? (

                  <motion.div
                    key="edit"
                    initial={{
                      opacity: 0,
                      y: 20,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -20,
                    }}
                  >

                    <TradingAccountsEdit
                      account={selectedAccount}
                      accounts={accounts}
                      setAccounts={setAccounts}
                      setSelectedAccount={
                        setSelectedAccount
                      }
                      setIsEditing={
                        setIsEditing
                      }
                    />

                  </motion.div>

                ) : (

                  <motion.div
                    key="view"
                    initial={{
                      opacity: 0,
                      y: 20,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -20,
                    }}
                  >

                    <TradingAccountsView
                      account={selectedAccount}
                    />

                  </motion.div>

                )}

              </AnimatePresence>

            )}

          </div>

        </div>

      </div>


      {/* ADD ACCOUNT */}

      {showAddModal && (
        <AddTradingAccountModal
          accounts={accounts}
          setAccounts={setAccounts}
          setSelectedAccount={
            setSelectedAccount
          }
          setShowModal={
            setShowAddModal
          }
        />
      )}


      {/* DELETE MODAL */}

      {deleteId !== null && (

        <div className="
          fixed
          inset-0
          bg-black/40
          flex
          items-center
          justify-center
          z-50
        ">

          <div className="
            bg-white
            rounded-3xl
            p-8
            w-[420px]
          ">

            <h2 className="text-xl font-bold">
              Delete Account
            </h2>

            <p className="text-gray-500 mt-3">
              Are you sure you want to delete this account?
            </p>


            <div className="flex justify-end gap-4 mt-8">

              <button
                onClick={() => setDeleteId(null)}
                className="
                  border
                  rounded-xl
                  px-5
                  py-3
                "
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