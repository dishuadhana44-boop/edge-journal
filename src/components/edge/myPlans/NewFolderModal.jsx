import { useState } from "react";
import { FolderPlus, X } from "lucide-react";

export default function NewFolderModal({
  open,
  onClose,
  onCreate,
}) {

  const [folderName, setFolderName] = useState("");

  if (!open) return null;

  function handleCreate() {

    if (!folderName.trim()) return;

    onCreate(folderName);

    setFolderName("");

    onClose();

  }

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">

      <div className="w-[430px] rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden">

        {/* Header */}

        <div className="flex items-center justify-between px-6 py-5 border-b">

          <div className="flex items-center gap-3">

            <div className="w-11 h-11 rounded-2xl bg-violet-100 flex items-center justify-center">

              <FolderPlus className="text-violet-600" size={22} />

            </div>

            <div>

              <h2 className="text-lg font-bold">

                Create Folder

              </h2>

             

            </div>

          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
          >
            <X size={18} />
          </button>

        </div>

        {/* Body */}

        <div className="p-6">

          <label className="text-sm font-medium text-gray-600">

            Folder Name

          </label>

          <input

            value={folderName}

            onChange={(e) => setFolderName(e.target.value)}

            placeholder="Example: Forex"

            className="

              mt-2

              w-full

              h-12

              rounded-xl

              border

              border-gray-200

              px-4

              outline-none

              focus:border-violet-500

            "

          />

        </div>

        {/* Footer */}

        <div className="flex justify-end gap-3 px-6 py-5 ">

          <button

            onClick={onClose}

            className="

              h-11

              px-5

              rounded-xl

              border

              border-gray-200

              hover:bg-gray-100

            "

          >

            Cancel

          </button>

          <button

            onClick={handleCreate}

            className="

              h-11

              px-6

              rounded-xl

              bg-violet-600

              hover:bg-violet-700

              text-white

              font-medium

            "

          >

            Create Folder

          </button>

        </div>

      </div>

    </div>

  );

}