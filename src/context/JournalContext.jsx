import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  normalizeAccountId,
  normalizeJournalTrade,
  normalizeNumber,
} from "../lib/journalTradeNormalization.js";
import {
  canPersistAfterRead,
  readJournalStorage,
  writeJournalStorage,
} from "../lib/journalStorage.js";
import {
  JOURNAL_PERSISTENCE_INITIAL,
  reduceJournalPersistence,
} from "../lib/journalPersistenceStore.js";


const JournalContext = createContext(null);

// ============================================================
// NORMALIZATION LIVES IN src/lib/journalTradeNormalization.js
// ============================================================

// ============================================================
// PERSISTENCE STATUS
// ============================================================
//
// Saving the journal is a write to an external system, and its outcome has to
// be readable by the app. React state is not set from inside that effect: the
// effect publishes to this store and subscribers read it, so a failed save
// becomes visible instead of only being logged.
//
// The store itself is src/lib/journalPersistenceStore.js. This file only
// supplies the two things a pure module cannot hold: the listener set React
// subscribes to, and the count of writes the storage helper proved.

// A verified write is one whose bytes read back identically
// (src/lib/journalStorage.js:245). Failed, blocked, unverified and read-only
// operations never advance this, and the reducer additionally refuses anything
// that is not strictly newer than what it already published.
let journalWriteReceipt = 0;

let journalPersistenceSnapshot =
  JOURNAL_PERSISTENCE_INITIAL;

const journalPersistenceListeners = new Set();

function publishJournalPersistence(patch) {
  const { snapshot, changed } = reduceJournalPersistence(
    journalPersistenceSnapshot,
    patch
  );

  // Unchanged is unchanged: the reducer gives back the same reference, so the
  // store snapshot stays stable and no subscriber is told to re-read.
  if (changed === false) {
    return;
  }

  journalPersistenceSnapshot = snapshot;

  journalPersistenceListeners.forEach(
    (listener) => listener()
  );
}

function subscribeToJournalPersistence(listener) {
  journalPersistenceListeners.add(listener);

  return () => {
    journalPersistenceListeners.delete(listener);
  };
}

function getJournalPersistenceSnapshot() {
  return journalPersistenceSnapshot;
}

// ============================================================
// LOAD SAVED TRADES
// ============================================================

function getJournalStorage() {
  return typeof localStorage === "undefined"
    ? null
    : localStorage;
}

function normalizeJournalRows(rows) {
  return rows
    .map(normalizeJournalTrade)
    .filter(Boolean);
}

// A journal that could not be read has unknown contents rather than empty
// contents, so this result decides whether saving is allowed at all.
function readInitialJournal() {
  const read = readJournalStorage(getJournalStorage());

  const canPersist = canPersistAfterRead(read);

  if (!canPersist) {
    console.error(
      "⚠️ Journal storage could not be read safely, so saving is disabled:",
      read.status,
      read.reason
    );
  }

  return {
    trades:
      read.rows === null
        ? []
        : normalizeJournalRows(read.rows),
    persistence: {
      readStatus: read.status,
      canPersist,
      writeStatus: null,
      persisted: false,
      message: read.message ?? null,
    },
  };
}

// ============================================================
// LOAD SELECTED ACCOUNT
// ============================================================

function loadSelectedAccountId() {
  try {
    const saved =
      localStorage.getItem(
        "selectedAccountId"
      );

    return normalizeAccountId(saved);
  } catch (error) {
    console.error(
      "❌ Failed to load selected account:",
      error
    );

    return null;
  }
}

// ============================================================
// JOURNAL PROVIDER
// ============================================================

export function JournalProvider({
  children,
}) {
  // ==========================================================
  // TRADES
  // ==========================================================

  const [initialJournal] = useState(
    readInitialJournal
  );

  const [trades, setTrades] = useState(
    initialJournal.trades
  );

  const canPersistJournal =
    initialJournal.persistence.canPersist;

  const journalPersistence =
    useSyncExternalStore(
      subscribeToJournalPersistence,
      getJournalPersistenceSnapshot,
      getJournalPersistenceSnapshot
    );

  useEffect(() => {
    publishJournalPersistence(
      initialJournal.persistence
    );
  }, [initialJournal]);

  // ==========================================================
  // SELECTED ACCOUNT
  // ==========================================================

  const [
    selectedAccountId,
    setSelectedAccountIdState,
  ] = useState(() =>
    loadSelectedAccountId()
  );

  // ==========================================================
  // SELECTED ACCOUNT SETTER
  // ==========================================================

  const setSelectedAccountId =
    useCallback((accountId) => {
      const normalizedId =
        normalizeAccountId(accountId);

      setSelectedAccountIdState(
        normalizedId
      );

      try {
        if (normalizedId !== null) {
          localStorage.setItem(
            "selectedAccountId",
            normalizedId
          );
        } else {
          localStorage.removeItem(
            "selectedAccountId"
          );
        }
      } catch (error) {
        console.error(
          "❌ Failed to save selected account:",
          error
        );
      }
    }, []);

  // ==========================================================
  // RELOAD TRADES
  // ==========================================================

  const reloadTrades = useCallback(() => {
    const read = readJournalStorage(getJournalStorage());

    if (!canPersistAfterRead(read)) {
      console.error(
        "⚠️ Journal storage could not be re-read safely, so the current journal is kept:",
        read.status,
        read.reason
      );

      publishJournalPersistence({
        readStatus: read.status,
        message: read.message ?? null,
      });

      return;
    }

    setTrades(normalizeJournalRows(read.rows));

    publishJournalPersistence({
      readStatus: read.status,
      message: null,
    });
  }, []);

  // ==========================================================
  // SAVE TRADES
  // ==========================================================

  useEffect(() => {
    if (!canPersistJournal) {
      return;
    }

    const result = writeJournalStorage(
      getJournalStorage(),
      trades
    );

    if (result.persisted) {
      journalWriteReceipt += 1;
    } else {
      console.error(
        "❌ Failed to save journal trades:",
        result.status,
        result.reason,
        result.message
      );
    }

    publishJournalPersistence({
      writeStatus: result.status,
      persisted: result.persisted,
      message: result.message,
      // On a write that proved nothing this is still the last published value,
      // and the reducer only accepts a strictly newer one, so a failure cannot
      // move it.
      writeReceipt: journalWriteReceipt,
    });
  }, [trades, canPersistJournal]);

  // ==========================================================
  // STORAGE EVENT
  // ==========================================================

  useEffect(() => {
    const handleStorage = (event) => {
      // Another tab/window changed selected account.
      if (
        event.key ===
        "selectedAccountId"
      ) {
        setSelectedAccountIdState(
          normalizeAccountId(
            event.newValue
          )
        );
      }

      // Another tab/window changed trades.
      if (
        event.key === "trades"
      ) {
        reloadTrades();
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [reloadTrades]);

  // ==========================================================
  // ADD TRADE
  // ==========================================================

  const addTrade = useCallback(
    (trade) => {
      if (
        !trade ||
        typeof trade !== "object"
      ) {
        console.error(
          "❌ Cannot add invalid journal trade:",
          trade
        );

        return;
      }

      // ======================================================
      // ACCOUNT SAFETY
      // ======================================================

      const tradeAccountId =
        normalizeAccountId(
          trade.accountId ??
            trade.accountID
        );

      // If the caller did not provide an account,
      // automatically attach the currently selected account.
      const accountId =
        tradeAccountId ??
        selectedAccountId;

      // Never create an account-less journal trade
      // when an account is selected.
      if (!accountId) {
        console.warn(
          "⚠️ Cannot add journal trade: no trading account selected."
        );

        return;
      }

      const normalizedTrade =
        normalizeJournalTrade({
          ...trade,
          accountId,
        });

      console.log(
        "📘 AUTOMATIC JOURNAL TRADE:",
        normalizedTrade
      );

      // ======================================================
      // DUPLICATE / UPDATE CHECK
      // ======================================================

      setTrades((prev) => {
        const exists = prev.some(
          (existingTrade) =>
            String(existingTrade.id) ===
            String(normalizedTrade.id)
        );

        // ====================================================
        // UPDATE EXISTING
        // ====================================================

        if (exists) {
          return prev.map(
            (existingTrade) => {
              if (
                String(existingTrade.id) !==
                String(normalizedTrade.id)
              ) {
                return existingTrade;
              }

              // Prevent moving an existing trade
              // between trading accounts.
              const existingAccountId =
                normalizeAccountId(
                  existingTrade.accountId
                );

              if (
                existingAccountId &&
                existingAccountId !==
                  accountId
              ) {
                console.warn(
                  "⚠️ Prevented moving a trade to another account."
                );

                return existingTrade;
              }

              return normalizeJournalTrade({
                ...existingTrade,
                ...normalizedTrade,
                accountId:
                  existingAccountId ??
                  accountId,
              });
            }
          );
        }

        // ====================================================
        // ADD NEW
        // ====================================================

        return [
          ...prev,
          {
            ...normalizedTrade,
            accountId,
            id:
              normalizedTrade.id ??
              `journal-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
          },
        ];
      });
    },
    [selectedAccountId]
  );

  // ==========================================================
  // UPDATE TRADE
  // ==========================================================

  const updateTrade = useCallback(
    (updatedTrade) => {
      if (
        !updatedTrade ||
        updatedTrade.id === undefined ||
        updatedTrade.id === null
      ) {
        console.error(
          "❌ Cannot update trade without ID:",
          updatedTrade
        );

        return;
      }

      setTrades((prev) =>
        prev.map((trade) => {
          if (
            String(trade.id) !==
            String(updatedTrade.id)
          ) {
            return trade;
          }

          const existingAccountId =
            normalizeAccountId(
              trade.accountId
            );

          const incomingAccountId =
            normalizeAccountId(
              updatedTrade.accountId ??
                updatedTrade.accountID
            );

          // Prevent changing the account of
          // an existing trade.
          if (
            existingAccountId &&
            incomingAccountId &&
            existingAccountId !==
              incomingAccountId
          ) {
            console.warn(
              "⚠️ Prevented changing trade account."
            );

            return trade;
          }

          return normalizeJournalTrade({
            ...trade,
            ...updatedTrade,
            accountId:
              existingAccountId ??
              incomingAccountId ??
              selectedAccountId,
          });
        })
      );
    },
    [selectedAccountId]
  );

  // ==========================================================
  // DELETE TRADE
  // ==========================================================

  const deleteTrade = useCallback(
    (id) => {
      setTrades((prev) =>
        prev.filter(
          (trade) =>
            String(trade.id) !==
            String(id)
        )
      );
    },
    []
  );

  // ==========================================================
  // FILTERED TRADES
  // ==========================================================

  const filteredTrades = useMemo(() => {
    // No selected account = no account-scoped data.
    if (!selectedAccountId) {
      return [];
    }

    return trades.filter((trade) => {
      const tradeAccountId =
        normalizeAccountId(
          trade?.accountId ??
            trade?.accountID
        );

      // IMPORTANT:
      // Old/unassigned trades are NOT shown
      // inside any account.
      if (!tradeAccountId) {
        return false;
      }

      return (
        tradeAccountId ===
        String(selectedAccountId)
      );
    });
  }, [
    trades,
    selectedAccountId,
  ]);

  // ==========================================================
  // ACCOUNT-SCOPED ADD TRADE
  // ==========================================================

  const addAccountTrade = useCallback(
    (trade) => {
      if (!selectedAccountId) {
        console.warn(
          "⚠️ Cannot add account trade: no account selected."
        );

        return;
      }

      const providedAccountId =
        normalizeAccountId(
          trade?.accountId ??
            trade?.accountID
        );

      // If an account ID was supplied, it must
      // match the currently selected account.
      if (
        providedAccountId &&
        providedAccountId !==
          String(selectedAccountId)
      ) {
        console.warn(
          "⚠️ Prevented adding trade to another account."
        );

        return;
      }

      addTrade({
        ...trade,
        accountId:
          providedAccountId ??
          String(selectedAccountId),
      });
    },
    [
      addTrade,
      selectedAccountId,
    ]
  );

  // ==========================================================
  // ACCOUNT-SCOPED UPDATE TRADE
  // ==========================================================

  const updateAccountTrade =
    useCallback(
      (updatedTrade) => {
        if (
          !updatedTrade ||
          updatedTrade.id === undefined ||
          updatedTrade.id === null
        ) {
          return;
        }

        if (!selectedAccountId) {
          console.warn(
            "⚠️ Cannot update account trade: no account selected."
          );

          return;
        }

        const existingTrade =
          trades.find(
            (trade) =>
              String(trade.id) ===
              String(
                updatedTrade.id
              )
          );

        if (!existingTrade) {
          console.warn(
            "⚠️ Trade not found."
          );

          return;
        }

        const existingAccountId =
          normalizeAccountId(
            existingTrade.accountId
          );

        // Prevent accidentally editing
        // another account's trade.
        if (
          existingAccountId !==
          String(selectedAccountId)
        ) {
          console.warn(
            "⚠️ Prevented updating a trade belonging to another account."
          );

          return;
        }

        const incomingAccountId =
          normalizeAccountId(
            updatedTrade.accountId ??
              updatedTrade.accountID
          );

        // Prevent changing the trade's account.
        if (
          incomingAccountId &&
          incomingAccountId !==
            String(selectedAccountId)
        ) {
          console.warn(
            "⚠️ Prevented moving trade to another account."
          );

          return;
        }

        updateTrade({
          ...updatedTrade,
          accountId:
            String(selectedAccountId),
        });
      },
      [
        trades,
        selectedAccountId,
        updateTrade,
      ]
    );

  // ==========================================================
  // ACCOUNT-SCOPED DELETE TRADE
  // ==========================================================

  const deleteAccountTrade =
    useCallback(
      (tradeId) => {
        if (!selectedAccountId) {
          console.warn(
            "⚠️ Cannot delete account trade: no account selected."
          );

          return;
        }

        const existingTrade =
          trades.find(
            (trade) =>
              String(trade.id) ===
              String(tradeId)
          );

        if (!existingTrade) {
          return;
        }

        const tradeAccountId =
          normalizeAccountId(
            existingTrade.accountId
          );

        // Never allow deleting a trade
        // belonging to another account.
        if (
          tradeAccountId !==
          String(selectedAccountId)
        ) {
          console.warn(
            "⚠️ Prevented deleting a trade belonging to another account."
          );

          return;
        }

        deleteTrade(tradeId);
      },
      [
        trades,
        selectedAccountId,
        deleteTrade,
      ]
    );

  // ==========================================================
  // ACCOUNT-SCOPED STATISTICS
  // ==========================================================

  const accountTradeStats = useMemo(() => {
    const totalTrades =
      filteredTrades.length;

    const winningTrades =
      filteredTrades.filter(
        (trade) =>
          Number(trade.pnl) > 0
      ).length;

    const losingTrades =
      filteredTrades.filter(
        (trade) =>
          Number(trade.pnl) < 0
      ).length;

    const breakevenTrades =
      filteredTrades.filter(
        (trade) =>
          Number(trade.pnl) === 0
      ).length;

    const totalPnL =
      filteredTrades.reduce(
        (sum, trade) =>
          sum +
          normalizeNumber(
            trade.pnl
          ),
        0
      );

    const winRate =
      totalTrades > 0
        ? Number(
            (
              (winningTrades /
                totalTrades) *
              100
            ).toFixed(2)
          )
        : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      totalPnL,
      winRate,
    };
  }, [filteredTrades]);

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {
    // --------------------------------------------------------
    // ALL TRADES
    // --------------------------------------------------------

    trades,
    setTrades,

    // --------------------------------------------------------
    // CURRENT ACCOUNT TRADES
    // --------------------------------------------------------

    filteredTrades,

    // --------------------------------------------------------
    // CURRENT ACCOUNT STATISTICS
    // --------------------------------------------------------

    accountTradeStats,

    // --------------------------------------------------------
    // TRADE ACTIONS
    // --------------------------------------------------------

    addTrade,
    addAccountTrade,

    updateTrade,
    updateAccountTrade,

    deleteTrade,
    deleteAccountTrade,

    reloadTrades,

    // --------------------------------------------------------
    // PERSISTENCE STATUS
    // --------------------------------------------------------

    journalPersistence,

    // --------------------------------------------------------
    // GLOBAL ACCOUNT
    // --------------------------------------------------------

    selectedAccountId,
    setSelectedAccountId,
  };

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useJournal() {
  const context =
    useContext(JournalContext);

  if (!context) {
    throw new Error(
      "useJournal must be used inside JournalProvider"
    );
  }

  return context;
}