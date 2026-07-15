import { Plus, GripVertical } from "lucide-react";
import { motion } from "framer-motion";

function BlockHandle({ onAdd }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      whileHover={{ opacity: 1 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-[2px]"
    >
      {/* Plus Button */}
      <button
        onClick={onAdd}
        className="
          w-6 h-6
          rounded-md
          flex items-center justify-center
          text-gray-800
          hover:bg-gray-100
          hover:text-gray-700
          transition-all
        "
      >
        <Plus size={20} strokeWidth={2.2} />
      </button>

      {/* Drag Handle */}
      <button
        className="
          w-6 h-6
          rounded-md
          flex items-center justify-center
          text-gray-800
          hover:bg-gray-100
          hover:text-gray-700
          cursor-grab
          active:cursor-grabbing
          transition-all
        "
      >
        <GripVertical size={20} strokeWidth={2.2} />
      </button>
    </motion.div>
  );
}

export default BlockHandle;