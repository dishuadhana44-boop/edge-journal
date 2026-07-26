export default function CancelButton({
    onClick,
  }) {
    return (
      <div className="mt-10 border-t border-gray-200 pt-6">
  
        <div className="flex items-center justify-between">
  
          <div></div>
  
          <button
            onClick={onClick}
            className="
              h-11
              px-6
              rounded-xl
              border
              border-gray-300
              bg-white
              hover:bg-gray-100
              text-gray-700
              font-medium
              transition
            "
          >
            Cancel
          </button>
  
        </div>
  
      </div>
    );
  }