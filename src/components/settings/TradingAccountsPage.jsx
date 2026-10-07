import { useState, useEffect, useCallback } from "react";

import { Pencil, RefreshCw, Link2 } from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";

import TradingAccountsSidebar from "./TradingAccountsSidebar";
import TradingAccountsView from "./TradingAccountsView";
import TradingAccountsEdit from "./TradingAccountsEdit";
import AddTradingAccountModal from "./AddTradingAccountModal";
import MT5ConnectionModal from "./MT5ConnectionModal";

import { useJournal } from "../../context/JournalContext";

// ============================================================
// HELPERS
// ============================================================

function normalizeNumber(value, fallback = 0) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

// ============================================================
// ACCOUNT ID
// ============================================================

function normalizeAccountId(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return String(value);
}

// ============================================================
// ACCOUNT TYPE
// ============================================================

function normalizeAccountType(value) {
  return String(value || "Manual");
}

// ============================================================
// CONNECTION STATUS
// ============================================================

function normalizeConnectionStatus(value) {
  const status = String(value || "manual")
    .trim()
    .toLowerCase();

  if (
    status === "connected" ||
    status === "live" ||
    status === "online"
  ) {
    return "connected";
  }

  if (status === "connecting") {
    return "connecting";
  }

  if (
    status === "disconnected" ||
    status === "offline"
  ) {
    return "disconnected";
  }

  return "manual";
}

// ============================================================
// NORMALIZE ACCOUNT
// ============================================================

function normalizeTradingAccount(account = {}) {
  const isMT5Connected =
  Boolean(account.mt5Connected);

const isBrokerAccount =
  Boolean(account.isBrokerAccount) ||
  Boolean(account.broker) ||
  Boolean(account.brokerAccountId) ||
  isMT5Connected;

  return {
    id:
      normalizeAccountId(
        account.id ??
          account.accountId
      ) ??
      `account-${Date.now()}`,

    accountName:
      account.accountName ||
      account.name ||
      "Trading Account",

    currency:
      account.currency ||
      "USD",

    startingBalance:
      normalizeNumber(
        account.startingBalance ??
          account.balance ??
          0
      ),

    balance:
      normalizeNumber(
        account.balance ??
          account.startingBalance ??
          0
      ),

    equity:
      normalizeNumber(
        account.equity ??
          account.balance ??
          account.startingBalance ??
          0
      ),

    accountType:
      normalizeAccountType(
        account.accountType ??
          account.type ??
          "Manual"
      ),

    leverage:
      normalizeNumber(
        account.leverage,
        100
      ),

    isDefault:
      Boolean(account.isDefault),

    // ========================================================
    // BROKER INFORMATION
    // ========================================================

    isBrokerAccount,

    broker:
      account.broker ||
      null,

    brokerAccountId:
      account.brokerAccountId ??
      account.ctidTraderAccountId ??
      account.traderAccountId ??
      null,

    connectionStatus:
      normalizeConnectionStatus(
        account.connectionStatus ??
          (isBrokerAccount
            ? "connected"
            : "manual")
      ),

    lastSynced:
      account.lastSynced ||
      null,

    // ========================================================
    // MT5 CONNECTION
    // ========================================================

    mt5Login:
      account.mt5Login ??
      account.login ??
      null,

    mt5Server:
      account.mt5Server ??
      account.server ??
      null,

    mt5Connected:
      Boolean(account.mt5Connected),

    mt5TerminalId:
      account.mt5TerminalId ??
      null,

    // ========================================================
    // STRATEGY
    // ========================================================

    strategyId:
      account.strategyId ??
      null,

    strategyName:
      account.strategyName ??
      null,

    // ========================================================
    // ACCOUNT DETAILS
    // ========================================================

    marginUsed:
      normalizeNumber(
        account.marginUsed ??
          account.usedMargin ??
          0
      ),

    freeMargin:
      normalizeNumber(
        account.freeMargin ??
          0
      ),

    floatingPnL:
      normalizeNumber(
        account.floatingPnL ??
          account.unrealizedPnL ??
          0
      ),

    createdAt:
      account.createdAt ||
      new Date().toISOString(),
  };
}

// ============================================================
// DEFAULT ACCOUNT
// ============================================================

function createDefaultAccount() {
  return {
    id: `manual-${Date.now()}`,

    accountName:
      "My Trading Account",

    currency: "USD",

    startingBalance: 100000,

    balance: 100000,

    equity: 100000,

    accountType: "Manual",

    leverage: 100,

    isDefault: true,

    isBrokerAccount: false,

    broker: null,

    brokerAccountId: null,

    connectionStatus: "manual",

    // MT5
    mt5Login: null,
    mt5Server: null,
    mt5Connected: false,
    mt5TerminalId: null,

    // Strategy
    strategyId: null,
    strategyName: null,

    marginUsed: 0,

    freeMargin: 100000,

    floatingPnL: 0,

    createdAt:
      new Date().toISOString(),
  };
}

// ============================================================
// COMPONENT
// ============================================================

export default function TradingAccountsPage() {
  // ==========================================================
  // GLOBAL JOURNAL / ACCOUNT CONTEXT
  // ==========================================================

  const {
    selectedAccountId,
    setSelectedAccountId,
  } = useJournal();

  // ==========================================================
  // LOAD ACCOUNTS
  // ==========================================================

  const [accounts, setAccounts] = useState(() => {
    try {
      const saved =
        localStorage.getItem(
          "tradingAccounts"
        );

      if (saved !== null) {
        const parsed =
          JSON.parse(saved);

        if (Array.isArray(parsed)) {
          return parsed.map(
            (account) =>
              normalizeTradingAccount(
                account
              )
          );
        }
      }

      return [
        createDefaultAccount(),
      ];
    } catch (error) {
      console.error(
        "❌ Failed to load trading accounts:",
        error
      );

      return [
        createDefaultAccount(),
      ];
    }
  });

  // ==========================================================
  // SELECTED ACCOUNT
  // ==========================================================

  const [
    selectedAccount,
    setSelectedAccount,
  ] = useState(null);

  // ==========================================================
  // UI STATE
  // ==========================================================

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    deleteId,
    setDeleteId,
  ] = useState(null);

  const [
    isSyncing,
    setIsSyncing,
  ] = useState(false);

  const [
    showMT5Modal,
    setShowMT5Modal,
  ] = useState(false);
  // ==========================================================
  // SAVE ACCOUNTS
  // ==========================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "tradingAccounts",
        JSON.stringify(accounts)
      );
    } catch (error) {
      console.error(
        "❌ Failed to save trading accounts:",
        error
      );
    }
  }, [accounts]);

  // ==========================================================
  // SELECT ACCOUNT
  // ==========================================================

  const handleSelectAccount =
    useCallback(
      (account) => {
        if (!account) return;

        const normalized =
          normalizeTradingAccount(
            account
          );

        // Local page state
        setSelectedAccount(
          normalized
        );

        // ====================================================
        // GLOBAL ACCOUNT STATE
        // ====================================================
        // JournalContext is the single
        // source of truth for selected account.
        setSelectedAccountId(
          normalized.id
        );

        setIsEditing(false);
      },
      [setSelectedAccountId]
    );

  // ==========================================================
  // KEEP SELECTED ACCOUNT VALID
  // ==========================================================

  useEffect(() => {
    // ========================================================
    // NO ACCOUNTS
    // ========================================================

    if (!accounts.length) {
      setSelectedAccount(null);

      if (selectedAccountId !== null) {
        setSelectedAccountId(null);
      }

      return;
    }

    // ========================================================
    // FIND CURRENT ACCOUNT
    // ========================================================

    let current =
      accounts.find(
        (account) =>
          String(account.id) ===
          String(selectedAccountId)
      );

    // ========================================================
    // LOCAL STORAGE FALLBACK
    // ========================================================

    if (!current) {
      try {
        const savedSelectedId =
          localStorage.getItem(
            "selectedAccountId"
          );

        if (savedSelectedId) {
          current =
            accounts.find(
              (account) =>
                String(account.id) ===
                String(savedSelectedId)
            );
        }
      } catch (error) {
        console.error(
          "❌ Failed to read selected account:",
          error
        );
      }
    }

    // ========================================================
    // DEFAULT ACCOUNT FALLBACK
    // ========================================================

    if (!current) {
      current =
        accounts.find(
          (account) =>
            account.isDefault
        ) ||
        accounts[0];
    }

    // ========================================================
    // SET CURRENT ACCOUNT
    // ========================================================

    if (current) {
      const normalized =
        normalizeTradingAccount(
          current
        );

      setSelectedAccount(
        normalized
      );

      // Keep global context synchronized.
      if (
        String(selectedAccountId) !==
        String(normalized.id)
      ) {
        setSelectedAccountId(
          normalized.id
        );
      }
    }
  }, [
    accounts,
    selectedAccountId,
    setSelectedAccountId,
  ]);

  // ==========================================================
// MT5 ACCOUNT UPDATE EVENT
// ==========================================================

useEffect(() => {
  const handleMT5AccountUpdate = (event) => {
    const incomingAccount = event?.detail;

    if (!incomingAccount) {
      return;
    }

    console.log(
      "🔄 MT5 Account Update Received:",
      incomingAccount
    );

    const normalizedAccount =
      normalizeTradingAccount(
        incomingAccount
      );

    setAccounts((previousAccounts) => {
      const existingIndex =
        previousAccounts.findIndex(
          (account) =>
            String(account.id) ===
            String(normalizedAccount.id)
        );

      // ==================================================
      // UPDATE EXISTING MT5 ACCOUNT
      // ==================================================

      if (existingIndex >= 0) {
        const updatedAccounts = [
          ...previousAccounts,
        ];

        updatedAccounts[existingIndex] = {
          ...updatedAccounts[existingIndex],
          ...normalizedAccount,
        };

        return updatedAccounts;
      }

      // ==================================================
      // ADD NEW MT5 ACCOUNT
      // ==================================================

      return [
        ...previousAccounts,
        normalizedAccount,
      ];
    });

    // ==================================================
    // SELECT THIS MT5 ACCOUNT
    // ==================================================

    setSelectedAccount(
      normalizedAccount
    );

    setSelectedAccountId(
      normalizedAccount.id
    );

    console.log(
      "✅ MT5 ACCOUNT ADDED/UPDATED IN TRADING ACCOUNTS:",
      normalizedAccount
    );
  };

  window.addEventListener(
    "mt5AccountUpdated",
    handleMT5AccountUpdate
  );

  return () => {
    window.removeEventListener(
      "mt5AccountUpdated",
      handleMT5AccountUpdate
    );
  };
}, [setSelectedAccountId]);

  // ==========================================================
  // cTRADER ACCOUNT UPDATE EVENT
  // ==========================================================

  useEffect(() => {
    const handleCTraderAccountUpdate =
      (event) => {
        const brokerAccount =
          event?.detail;

        if (!brokerAccount) return;

        console.log(
          "🔄 cTrader Account Update Received:",
          brokerAccount
        );

        const brokerAccountId =
          brokerAccount.brokerAccountId ??
          brokerAccount.accountId ??
          brokerAccount.ctidTraderAccountId ??
          brokerAccount.traderAccountId ??
          brokerAccount.id;

        if (!brokerAccountId) {
          console.error(
            "❌ cTrader account has no account ID:",
            brokerAccount
          );

          return;
        }

        const normalizedAccount =
          normalizeTradingAccount({
            ...brokerAccount,

            id:
              brokerAccount.id ??
              `ctrader-${brokerAccountId}`,

            broker: "cTrader",

            brokerAccountId:
              String(
                brokerAccountId
              ),

            isBrokerAccount: true,

            connectionStatus:
              brokerAccount.connectionStatus ??
              "connected",

            lastSynced:
              new Date().toISOString(),
          });

        setAccounts(
          (previousAccounts) => {
            const existingIndex =
              previousAccounts.findIndex(
                (account) =>
                  String(
                    account.brokerAccountId
                  ) ===
                  String(
                    brokerAccountId
                  )
              );

            // ==================================================
            // UPDATE EXISTING
            // ==================================================

            if (existingIndex >= 0) {
              const updated = [
                ...previousAccounts,
              ];

              updated[
                existingIndex
              ] = {
                ...updated[
                  existingIndex
                ],

                ...normalizedAccount,

                // Keep original local ID.
                id:
                  updated[
                    existingIndex
                  ].id,
              };

              return updated;
            }

            // ==================================================
            // ADD NEW CONNECTED ACCOUNT
            // ==================================================

            return [
              ...previousAccounts,
              normalizedAccount,
            ];
          }
        );

        // Immediately make this account
        // the global selected account.
        handleSelectAccount(
          normalizedAccount
        );
      };

    window.addEventListener(
      "ctraderAccountUpdated",
      handleCTraderAccountUpdate
    );

    return () => {
      window.removeEventListener(
        "ctraderAccountUpdated",
        handleCTraderAccountUpdate
      );
    };
  }, [handleSelectAccount]);

  // ==========================================================
  // DELETE ACCOUNT
  // ==========================================================

  const handleDelete =
    useCallback(
      (id) => {
        const targetAccount =
          accounts.find(
            (account) =>
              String(account.id) ===
              String(id)
          );

        // ====================================================
        // CONNECTED ACCOUNT WARNING
        // ====================================================

        if (
          targetAccount?.isBrokerAccount &&
          targetAccount?.connectionStatus ===
            "connected"
        ) {
          console.warn(
            "⚠️ Removing connected broker account locally."
          );
        }

        const updated =
          accounts.filter(
            (account) =>
              String(account.id) !==
              String(id)
          );

        // ====================================================
        // NO ACCOUNTS LEFT
        // ====================================================

        if (updated.length === 0) {
          setAccounts([]);
          setSelectedAccount(null);
          setSelectedAccountId(null);
          setIsEditing(false);

          return;
        }

        // ====================================================
        // SELECT FALLBACK
        // ====================================================

        const nextAccount =
          updated.find(
            (account) =>
              account.isDefault
          ) ||
          updated[0];

        setAccounts(updated);

        handleSelectAccount(
          nextAccount
        );
      },
      [
        accounts,
        handleSelectAccount,
        setSelectedAccountId,
      ]
    );

  // ==========================================================
  // SET DEFAULT ACCOUNT
  // ==========================================================

  const handleSetDefault =
    useCallback(
      (id) => {
        const updated =
          accounts.map(
            (account) => ({
              ...account,

              isDefault:
                String(
                  account.id
                ) ===
                String(id),
            })
          );

        const selected =
          updated.find(
            (account) =>
              String(
                account.id
              ) ===
              String(id)
          );

        setAccounts(updated);

        if (selected) {
          handleSelectAccount(
            selected
          );
        }
      },
      [
        accounts,
        handleSelectAccount,
      ]
    );

  // ==========================================================
  // SYNC ACCOUNT
  // ==========================================================

  const handleSyncAccount =
    async () => {
      if (!selectedAccount) {
        return;
      }

      // ======================================================
      // MANUAL ACCOUNT
      // ======================================================

      if (
        !selectedAccount.isBrokerAccount
      ) {
        alert(
          "This is a manual account. There is no broker connection to sync."
        );

        return;
      }

      try {
        setIsSyncing(true);

        console.log(
          "🔄 REQUESTING BROKER ACCOUNT SYNC:",
          selectedAccount
        );

        // ====================================================
        // REQUEST cTRADER SYNC
        // ====================================================

        window.dispatchEvent(
          new CustomEvent(
            "requestCTraderAccountSync",
            {
              detail: {
                accountId:
                  selectedAccount.brokerAccountId,

                account:
                  selectedAccount,
              },
            }
          )
        );

        // ====================================================
        // OPTIONAL GLOBAL SYNC FUNCTION
        // ====================================================

        if (
          typeof window.syncCTraderAccount ===
          "function"
        ) {
          const result =
            await window.syncCTraderAccount(
              selectedAccount.brokerAccountId
            );

          if (result) {
            window.dispatchEvent(
              new CustomEvent(
                "ctraderAccountUpdated",
                {
                  detail: result,
                }
              )
            );
          }
        }

        setTimeout(() => {
          setIsSyncing(false);
        }, 800);
      } catch (error) {
        console.error(
          "❌ Account sync failed:",
          error
        );

        setIsSyncing(false);

        alert(
          error?.message ||
            "Failed to sync broker account."
        );
      }
    };

  // ==========================================================
  // CONNECT cTRADER
  // ==========================================================

  const handleConnectBroker = () => {
    if (!selectedAccount) {
      alert(
        "Please select a trading account first."
      );
      return;
    }
  
    console.log(
      "🔵 OPEN MT5 CONNECTION MODAL:",
      {
        accountId:
          selectedAccount.id,
        accountName:
          selectedAccount.accountName,
        mt5Login:
          selectedAccount.mt5Login,
        mt5Server:
          selectedAccount.mt5Server,
      }
    );
  
    setShowMT5Modal(true);
  };

  const handleMT5Connected = useCallback(
    (updatedAccount) => {
      if (!updatedAccount) {
        return;
      }
  
      const normalizedAccount =
        normalizeTradingAccount(
          updatedAccount
        );
  
      setAccounts(
        (currentAccounts) => {
          const nextAccounts =
            currentAccounts.map(
              (account) =>
                String(account.id) ===
                String(
                  normalizedAccount.id
                )
                  ? normalizedAccount
                  : account
            );
  
          return nextAccounts;
        }
      );
  
      setSelectedAccount(
        normalizedAccount
      );
  
      setSelectedAccountId(
        normalizedAccount.id
      );
  
      console.log(
        "✅ MT5 CONNECTED TO EDGEFLO ACCOUNT:",
        normalizedAccount
      );
    },
    [setSelectedAccountId]
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="w-full max-w-6xl mx-auto px-6">
      <div
        className="
          bg-white
          rounded-3xl
          border
          border-gray-200
          overflow-hidden
        "
      >
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div
          className="
            flex
            items-center
            justify-between
            p-6
            border-b
            border-gray-100
          "
        >
          <div>
            <h2
              className="
                text-2xl
                font-bold
                text-gray-900
              "
            >
              Trading Accounts
            </h2>

            <p
              className="
                text-sm
                text-gray-500
                mt-1
              "
            >
              Manage your manual and connected broker accounts.
            </p>
          </div>

          <div className="flex items-center gap-3">
  {/* ADD TRADING ACCOUNT */}
  <button
    onClick={() =>
      setShowAddModal(true)
    }
    className="
      bg-violet-600
      hover:bg-violet-700
      text-white
      px-4
      py-2.5
      rounded-xl
      flex
      items-center
      gap-2
      transition
      shadow-sm
    "
  >
    <span className="text-lg leading-none">
      +
    </span>

    Add Trading Account
  </button>

  {/* MT5 CONNECTION */}
  <button
    onClick={
      handleConnectBroker
    }
    className="
      border
      border-violet-200
      text-violet-700
      hover:bg-violet-50
      px-4
      py-2.5
      rounded-xl
      flex
      items-center
      gap-2
      transition
    "
  >
    <Link2 size={18} />

    {selectedAccount?.isBrokerAccount ||
    selectedAccount?.mt5Connected
      ? "Manage Connection"
      : "Connect MT5"}
  </button>

  {/* SYNC */}
  {selectedAccount?.isBrokerAccount && (
    <button
      onClick={
        handleSyncAccount
      }
      disabled={isSyncing}
      className="
        border
        border-gray-200
        text-gray-700
        hover:bg-gray-50
        px-4
        py-2.5
        rounded-xl
        flex
        items-center
        gap-2
        transition
        disabled:opacity-60
      "
    >
      <RefreshCw
        size={18}
        className={
          isSyncing
            ? "animate-spin"
            : ""
        }
      />

      {isSyncing
        ? "Syncing..."
        : "Sync"}
    </button>
  )}

  {/* EDIT ACCOUNT */}
  {!isEditing &&
    selectedAccount &&
    !selectedAccount.isBrokerAccount && (
      <button
        onClick={() =>
          setIsEditing(true)
        }
        className="
          border
          border-gray-200
          bg-white
          hover:bg-gray-50
          text-gray-800
          px-4
          py-2.5
          rounded-xl
          flex
          items-center
          gap-2
          transition
        "
      >
        <Pencil size={18} />

        Edit Account
      </button>
    )}
</div>
        </div>

        {/* =====================================================
            BODY
        ===================================================== */}

        <div className="flex min-h-[530px]">
          {/* SIDEBAR */}

          <TradingAccountsSidebar
            accounts={accounts}
            selectedAccount={
              selectedAccount
            }
            setSelectedAccount={
              handleSelectAccount
            }
            onAdd={() =>
              setShowAddModal(true)
            }
            onDelete={(id) =>
              setDeleteId(id)
            }
            onSetDefault={
              handleSetDefault
            }
          />

          {/* MAIN CONTENT */}

          <div className="flex-1 p-8">
            {/* NO ACCOUNT */}

            {!selectedAccount ? (
              <div
                className="
                  h-full
                  flex
                  items-center
                  justify-center
                "
              >
                <div className="text-center">
                  <h3
                    className="
                      text-lg
                      font-semibold
                      text-gray-900
                    "
                  >
                    No Trading Account
                  </h3>

                  <p
                    className="
                      text-sm
                      text-gray-500
                      mt-2
                    "
                  >
                    Create a manual account or connect a broker account.
                  </p>

                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      gap-3
                      mt-5
                    "
                  >
                    <button
                      onClick={() =>
                        setShowAddModal(
                          true
                        )
                      }
                      className="
                        bg-violet-600
                        hover:bg-violet-700
                        text-white
                        px-5
                        py-2.5
                        rounded-xl
                        transition
                      "
                    >
                      Add Trading Account
                    </button>

                    <button
                      onClick={
                        handleConnectBroker
                      }
                      className="
                        border
                        border-gray-300
                        hover:bg-gray-50
                        text-gray-700
                        px-5
                        py-2.5
                        rounded-xl
                        transition
                      "
                    >
                      Connect Broker
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {/* EDIT */}

                {isEditing &&
                !selectedAccount.isBrokerAccount ? (
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
                    transition={{
                      duration: 0.2,
                    }}
                  >
                    <TradingAccountsEdit
                      account={
                        selectedAccount
                      }
                      accounts={
                        accounts
                      }
                      setAccounts={
                        setAccounts
                      }
                      setSelectedAccount={
                        handleSelectAccount
                      }
                      setIsEditing={
                        setIsEditing
                      }
                    />
                  </motion.div>
                ) : (
                  /* VIEW */

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
                    transition={{
                      duration: 0.2,
                    }}
                  >
                    {/* CONNECTED STATUS */}

                    {selectedAccount.isBrokerAccount && (
                      <div
                        className="
                          mb-5
                          flex
                          items-center
                          justify-between
                          rounded-2xl
                          border
                          border-emerald-100
                          bg-emerald-50
                          px-5
                          py-3
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >
                          <div
                            className="
                              w-3
                              h-3
                              rounded-full
                              bg-emerald-500
                            "
                          />

                          <div>
                            <p
                              className="
                                text-sm
                                font-semibold
                                text-emerald-800
                              "
                            >
                              Connected to{" "}
                              {selectedAccount.broker ||
                                "Broker"}
                            </p>

                            <p
                              className="
                                text-xs
                                text-emerald-600
                                mt-0.5
                              "
                            >
                              Account ID:{" "}
                              {selectedAccount.brokerAccountId ||
                                "-"}
                            </p>
                          </div>
                        </div>

                        <span
                          className="
                            text-xs
                            font-semibold
                            text-emerald-700
                          "
                        >
                          LIVE DATA
                        </span>
                      </div>
                    )}

                    <TradingAccountsView
                      account={
                        selectedAccount
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* =======================================================
          ADD ACCOUNT MODAL
      ======================================================= */}

      {showAddModal && (
        <AddTradingAccountModal
          accounts={accounts}
          setAccounts={
            setAccounts
          }
          setSelectedAccount={
            handleSelectAccount
          }
          setShowModal={
            setShowAddModal
          }
        />
      )}

{showMT5Modal && (
  <MT5ConnectionModal
    isOpen={showMT5Modal}
    account={selectedAccount}
    onClose={() =>
      setShowMT5Modal(false)
    }
    onConnected={
      handleMT5Connected
    }
  />
)}

      {/* =======================================================
          DELETE MODAL
      ======================================================= */}

      {deleteId !== null && (
        <div
          className="
            fixed
            inset-0
            bg-black/40
            flex
            items-center
            justify-center
            z-50
            px-4
          "
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            className="
              bg-white
              rounded-3xl
              p-8
              w-full
              max-w-[420px]
              shadow-2xl
            "
          >
            <h2
              className="
                text-xl
                font-bold
                text-gray-900
              "
            >
              Delete Account
            </h2>

            <p
              className="
                text-gray-500
                mt-3
              "
            >
              Are you sure you want to delete this account?
              This will remove the account from your app.
            </p>

            <div
              className="
                flex
                justify-end
                gap-4
                mt-8
              "
            >
              {/* CANCEL */}

              <button
                onClick={() =>
                  setDeleteId(null)
                }
                className="
                  border
                  border-gray-300
                  hover:bg-gray-50
                  rounded-xl
                  px-5
                  py-3
                  transition
                "
              >
                Cancel
              </button>

              {/* DELETE */}

              <button
                onClick={() => {
                  handleDelete(
                    deleteId
                  );

                  setDeleteId(null);
                }}
                className="
                  bg-red-600
                  hover:bg-red-700
                  text-white
                  rounded-xl
                  px-6
                  py-3
                  transition
                "
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}