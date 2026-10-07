import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import TradeFilters from "../components/TradeFilters";
import TradeTable from "../components/TradeTable";
import AddTradeModal from "../components/trade/AddTradeModal";
import EditTradeModal from "../components/trade/EditTradeModal";
import DeleteTradeModal from "../components/DeleteTradeModal";
import { useJournal } from "../context/JournalContext";
import PageHeader from "../components/common/PageHeader";

function TradeLog() {
  const [searchParams] = useSearchParams();
  const selectedDate = searchParams.get("date");

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedTrade, setSelectedTrade] = useState(null);
  const [editingTrade, setEditingTrade] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState(null);

  const {
    trades,
    filteredTrades: accountTrades,
    addTrade,
    updateTrade,
    deleteTrade,
  } = useJournal();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("All");
  const [selectedResult, setSelectedResult] = useState("All");
  const [selectedDirection, setSelectedDirection] = useState("All");

  /*
   * IMPORTANT:
   * accountTrades already comes from JournalContext and is scoped
   * to the currently selected trading account.
   *
   * So all Trade Log filters are applied ONLY to the selected
   * account's trades.
   */
  const filteredTrades = accountTrades.filter((trade) => {
    // Date Filter
    const matchesDate =
      !selectedDate || trade?.date === selectedDate;

    // Search
    const pair = String(trade?.pair ?? "");

    const matchesSearch = pair
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    // Session
    const matchesSession =
      selectedSession === "All" ||
      trade?.session === selectedSession;

    // Result
    const matchesResult =
      selectedResult === "All" ||
      trade?.result === selectedResult;

    // Direction
    const matchesDirection =
      selectedDirection === "All" ||
      trade?.direction === selectedDirection;

    return (
      matchesDate &&
      matchesSearch &&
      matchesSession &&
      matchesResult &&
      matchesDirection
    );
  });

  const handleDeleteTrade = (id) => {
    setTradeToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteTrade = () => {
    if (!tradeToDelete) {
      return;
    }

    /*
     * Use JournalContext's deleteTrade instead of directly
     * modifying the complete trades array.
     *
     * This keeps account isolation intact.
     */
    deleteTrade(tradeToDelete);

    setTradeToDelete(null);
    setShowDeleteModal(false);
  };

  const handleEditTrade = (trade) => {
    setEditingTrade(trade);
    setIsEditing(true);
    setShowModal(true);
  };

  return (
    <div className="w-full max-w-[1450px] mx-auto px-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Trade Log"
          subtitle="Review, analyze and manage your trading activity."
          icon="tradeLog"
        />

        <button
          onClick={() => {
            setIsEditing(false);
            setEditingTrade(null);
            setShowModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-medium transition"
        >
          + Add Trade
        </button>
      </div>

      {/* Filters */}
      <TradeFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedSession={selectedSession}
        setSelectedSession={setSelectedSession}
        selectedResult={selectedResult}
        setSelectedResult={setSelectedResult}
        selectedDirection={selectedDirection}
        setSelectedDirection={setSelectedDirection}
      />

      {/* Table */}
      <TradeTable
        trades={filteredTrades}
        onDelete={handleDeleteTrade}
        onEdit={handleEditTrade}
      />

      {/* Add Trade Modal */}
      {showModal && !isEditing && (
        <AddTradeModal
          setShowModal={setShowModal}
        />
      )}

      {/* Edit Trade Modal */}
      {showModal && isEditing && (
        <EditTradeModal
          setShowModal={setShowModal}
          trades={trades}
          trade={editingTrade}
        />
      )}

      {/* Delete Trade Modal */}
      {showDeleteModal && (
        <DeleteTradeModal
          onCancel={() => {
            setTradeToDelete(null);
            setShowDeleteModal(false);
          }}
          onConfirm={confirmDeleteTrade}
        />
      )}
    </div>
  );
}

export default TradeLog;