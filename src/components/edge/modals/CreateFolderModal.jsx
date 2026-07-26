import { X, Folder } from "lucide-react";
import { useState } from "react";

export default function CreateFolderModal({
  open,
  onClose,
  onCreate,
}) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      {/* Background */}

      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />

      {/* Modal */}

      <div
        className="
          relative
          w-[460px]
          rounded-2xl
          bg-white
          shadow-2xl
          border
          border-gray-200
          p-7
        "
      >

        {/* Header */}

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <Folder
              size={22}
              className="text-violet-600"
            />

            <h2 className="text-xl font-bold">

              Create Folder

            </h2>

          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>

        </div>

        {/* Input */}

        <div className="mt-7">

          <label className="text-sm font-medium">

            Folder Name

          </label>

          <input
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="Example : Futures"
            className="
              mt-2
              w-full
              h-11
              rounded-xl
              border
              border-gray-300
              px-4
              outline-none
              focus:border-violet-500
            "
          />

        </div>

        {/* Buttons */}

        <div className="flex justify-end gap-3 mt-8">

          <button
            onClick={onClose}
            className="
              h-10
              px-5
              rounded-xl
              border
              border-gray-300
            "
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onCreate(name);
              setName("");
            }}
            className="
              h-10
              px-5
              rounded-xl
              bg-violet-600
              text-white
            "
          >
            Create Folder
          </button>

        </div>

      </div>

    </div>
  );
}