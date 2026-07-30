import { Trash2 } from "lucide-react";

export default function DeletePlanModal({
  onCancel,
  onConfirm,
  planTitle,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[999]">

      <div className="w-[420px] bg-white rounded-2xl shadow-2xl p-7">

        <div className="flex items-center gap-3 mb-5">

          <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
            <Trash2 className="text-red-600" size={22} />
          </div>

          <div>

            <h2 className="text-xl font-bold">
              Delete Plan
            </h2>

            <p className="text-gray-500 text-sm">
              This action cannot be undone.
            </p>

          </div>

        </div>

        <p className="text-gray-700 leading-7">

          Are you sure you want to delete

          <span className="font-semibold">
            {" "}
            "{planTitle}"
          </span>

          ?

        </p>

        <div className="flex justify-end gap-3 mt-8">

          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>

        </div>

      </div>

    </div>
  );
}