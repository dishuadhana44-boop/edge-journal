import { useEffect, useState } from "react";
import TradeFilters from "../components/TradeFilters";
import TradeTable from "../components/TradeTable";
import AddTradeModal from "../components/trade/AddTradeModal";
import EditTradeModal from "../components/trade/EditTradeModal";
import DeleteTradeModal from "../components/DeleteTradeModal";

import { useSearchParams } from "react-router-dom";

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
  const [trades, setTrades] = useState(() => {

    const savedTrades = localStorage.getItem("trades");
  
    return savedTrades
      ? JSON.parse(savedTrades)
      : [
          {
            id: 1,
            pair: "EURUSD",
            date: "06 Jul 2026",
            session: "London",
            result: "Win",
            direction: "Buy",
            pnl: "+₹12,500",
            day: "Monday",
            rr: "1 : 3",
          },
        ];
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("All");
  const [selectedResult, setSelectedResult] = useState("All");
  const [selectedDirection, setSelectedDirection] = useState("All");
  useEffect(() => {
    localStorage.setItem("trades", JSON.stringify(trades));
  }, [trades]);
  const filteredTrades = trades.filter((trade) => {

    // 📅 Date Filter
    const matchesDate =
      !selectedDate || trade.date === selectedDate;
  
    // 🔍 Search
    const matchesSearch =
      trade.pair
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
  
    // Session
    const matchesSession =
      selectedSession === "All" ||
      trade.session === selectedSession;
  
    // Result
    const matchesResult =
      selectedResult === "All" ||
      trade.result === selectedResult;
  
    // Direction
    const matchesDirection =
      selectedDirection === "All" ||
      trade.direction === selectedDirection;
  
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
    setTrades((prevTrades) =>
      prevTrades.filter((trade) => trade.id !== tradeToDelete)
    );
  
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
      <div className="flex items-center justify-between mb-8">

        <div className="flex items-center gap-4">

          <h1 className="text-2xl font-bold text-gray-900">
            Trade Log
          </h1>

          <p className="text-gray-500">
            View and manage all your trades.
          </p>

        </div>

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
    trades={trades}
    setTrades={setTrades}
  />
)}

{/* Edit Trade Modal */}
{showModal && isEditing && (
  <EditTradeModal
    setShowModal={setShowModal}
    trades={trades}
    setTrades={setTrades}
    trade={editingTrade}
  />
)}
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