import { Inbox } from "lucide-react";

export default function EmptyPositions() {
  return (
    <div className="h-[340px] flex flex-col items-center justify-center text-center">

      <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">

        <Inbox
          size={30}
          className="text-violet-600"
        />

      </div>

      <h3 className="mt-5 text-lg font-semibold text-gray-800">
        No Open Positions
      </h3>

      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        Your active trades will appear here after you execute a Buy or Sell order.
      </p>

    </div>
  );
}