import { motion, AnimatePresence } from "framer-motion";
import { Folder, X } from "lucide-react";

export default function FolderSelectModal({

  open,

  folders,

  onClose,

  onSelect,

}) {

  if (!open) return null;

  return (

    <AnimatePresence>

      <motion.div

        initial={{ opacity: 0 }}

        animate={{ opacity: 1 }}

        exit={{ opacity: 0 }}

        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"

      >

        <motion.div

          initial={{ y: 40, scale: .95 }}

          animate={{ y: 0, scale: 1 }}

          exit={{ y: 20, opacity: 0 }}

          transition={{ duration: .25 }}

          className="

            w-[560px]

            rounded-3xl

            bg-white

            shadow-2xl

            border

            border-gray-200

            overflow-hidden

          "

        >

          {/* Header */}

          <div className="

            px-8

            py-6

            flex

            items-center

            justify-between

            border-b

          ">

            <div>

              <h2 className="text-2xl font-bold">

                Choose Folder

              </h2>

             

            </div>

            <button

              onClick={onClose}

              className="

                w-10

                h-10

                rounded-xl

                hover:bg-gray-100

                flex

                items-center

                justify-center

              "

            >

              <X size={18} />

            </button>

          </div>

          {/* Folder List */}

<div className="px-6 py-5 max-h-[420px] overflow-y-auto">

<div className="space-y-3">

  {folders.map((folder) => (

    <motion.button

      key={folder.id}

      whileHover={{ scale: 1.02 }}

      whileTap={{ scale: 0.98 }}

      onClick={() => onSelect(folder)}

      className="

        w-full

        flex

        items-center

        gap-4

        rounded-2xl

        border

        border-gray-200

        hover:border-violet-500

        hover:bg-violet-50

        transition-all

        p-5

        text-left

      "

    >

      <div

        className="

          w-12

          h-12

          rounded-xl

          bg-violet-100

          flex

          items-center

          justify-center

        "

      >

        <Folder

          size={22}

          className="text-violet-600"

        />

      </div>

      <div className="flex-1">

        <h3 className="font-semibold text-gray-900">

          {folder.name}

        </h3>

        <p className="text-sm text-gray-500 mt-1">

          {folder.plans.length} Plans

        </p>

      </div>

    </motion.button>

  ))}

</div>

</div>

{/* Footer */}

<div className="



px-6

py-5

flex

justify-end

">

<button

  onClick={onClose}

  className="

    px-5

    py-2.5

    rounded-xl

    bg-gray-100

    hover:bg-gray-200

    transition

  "

>

  Cancel

</button>

</div>

      </motion.div>

    </motion.div>

  </AnimatePresence>

);

}