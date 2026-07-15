function DeleteTradeModal({ onCancel, onConfirm }) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
  
        <div className="bg-white w-[420px] rounded-2xl shadow-xl p-6">
  
          <h2 className="text-2xl font-bold mb-3">
            Delete Trade?
          </h2>
  
          <p className="text-gray-600 mb-8">
            Are you sure you want to delete this trade?
            This action cannot be undone.
          </p>
  
          <div className="flex justify-end gap-3">
  
            <button
              onClick={onCancel}
              className="px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
  
            <button
              onClick={onConfirm}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl"
            >
              Delete
            </button>
  
          </div>
  
        </div>
  
      </div>
    );
  }
  
  export default DeleteTradeModal;