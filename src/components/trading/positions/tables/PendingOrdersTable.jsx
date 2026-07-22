export default function PendingOrdersTable() {
    return (
  
      <div
        className="
          h-[340px]
          overflow-y-auto
          overflow-x-hidden
        "
      >
  
        {/* Yahan apna table ya pending orders content rakho */}
  
        <div className="p-16 text-center text-gray-500">
  
          <h2 className="text-lg font-semibold">
            No Pending Orders
          </h2>
  
          <p className="mt-2 text-sm">
            Pending limit & stop orders will appear here.
          </p>
  
        </div>
  
      </div>
  
    );
  }