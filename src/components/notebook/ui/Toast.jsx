import { CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function Toast({ show, message, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 25 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 right-6 z-[9999]"
        >
          <div className="flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl shadow-2xl">

            <CheckCircle2 size={18} className="text-green-400" />

            <span className="text-sm">
              {message}
            </span>

            <button
              onClick={onClose}
              className="hover:text-gray-300"
            >
              <X size={16} />
            </button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Toast;