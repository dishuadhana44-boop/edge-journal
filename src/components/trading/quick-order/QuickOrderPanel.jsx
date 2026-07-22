import { motion } from "framer-motion";
import QuickOrderHeader from "./QuickOrderHeader";
import QuickTradeGrid from "./QuickTradeGrid";



export default function QuickOrderPanel({ setQuickOrderOpen }) {
  return (
  
  
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.05}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="
          absolute
          top-16
          right-6
          z-50
          w-[400px]
          rounded-xl
          border
          border-gray-200
          bg-white
          shadow-xl
          overflow-hidden
        "
      >
        <QuickOrderHeader
          setQuickOrderOpen={setQuickOrderOpen}
        />
  
        <div className="p-3 space-y-4">
          <QuickTradeGrid />
        </div>
  
      </motion.div>
  
    
  );
}