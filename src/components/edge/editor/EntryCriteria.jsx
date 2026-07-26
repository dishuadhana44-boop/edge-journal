import { Plus } from "lucide-react";

export default function EntryCriteria() {
  return (
    <div className="mb-2">

      {/* Header */}

      <div className="flex items-center justify-between mb-3">

        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
          Entry Criteria
        </h3>

        <button className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition">
          <Plus size={14} />
          Add
        </button>

      </div>

      {/* Container */}

      <div className="rounded-xl border border-gray-300 overflow-hidden">

        {/* Future checklist */}

        <div className="min-h-[48px] px-4 py-3">

          <p className="text-sm text-gray-400">
            Add the conditions that must be true before entering a trade.
          </p>

        </div>

      </div>

    </div>
  );
}