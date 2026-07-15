import { motion, AnimatePresence } from "framer-motion";

function DeleteCommentModal({
  open,
  onClose,
  onDelete,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: .95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: .95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
            w-[420px] bg-white rounded-2xl shadow-2xl"
          >

            <div className="p-6">

              <h2 className="text-xl font-semibold">
                Delete Comment
              </h2>

              <p className="text-gray-500 mt-2">
                Are you sure you want to delete this comment?
              </p>

              <p className="text-red-500 text-sm mt-1">
                This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3 mt-8">

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  onClick={onDelete}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </button>

              </div>

            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default DeleteCommentModal;