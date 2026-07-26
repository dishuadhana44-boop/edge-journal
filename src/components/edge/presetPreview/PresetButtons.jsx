import {
    Heart,
    Copy,
    Save,
    Share2,
  } from "lucide-react";
  
  import { motion } from "framer-motion";
  
  export default function PresetButtons({
  
    onFavorite,
  
    onDuplicate,
  
    onSave,
  
    onShare,
  
  }) {
  
    return (
  
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
  
        {/* Favorite */}
  
        <motion.button
  
          whileHover={{
  
            scale: 1.03,
  
            y: -2,
  
          }}
  
          whileTap={{ scale: .96 }}
  
          onClick={onFavorite}
  
          className="
  
            h-14
  
            rounded-2xl
  
            bg-gradient-to-r
  
            from-pink-500
  
            to-rose-500
  
            text-white
  
            font-semibold
  
            flex
  
            items-center
  
            justify-center
  
            gap-3
  
            shadow-lg
  
            hover:shadow-pink-300/50
  
            transition-all
  
          "
  
        >
  
          <Heart size={20} />
  
          Favorite
  
        </motion.button>
  
        {/* Duplicate */}
  
        <motion.button
  
          whileHover={{
  
            scale: 1.03,
  
            y: -2,
  
          }}
  
          whileTap={{ scale: .96 }}
  
          onClick={onDuplicate}
  
          className="
  
            h-14
  
            rounded-2xl
  
            bg-white
  
            border
  
            border-gray-200
  
            hover:border-violet-500
  
            hover:bg-violet-50
  
            font-semibold
  
            flex
  
            items-center
  
            justify-center
  
            gap-3
  
            transition-all
  
          "
  
        >
  
          <Copy size={20} />
  
          Duplicate
  
        </motion.button>
  
        {/* Save */}
  
        <motion.button
  
          whileHover={{
  
            scale: 1.03,
  
            y: -2,
  
          }}
  
          whileTap={{ scale: .96 }}
  
          onClick={onSave}
  
          className="
  
            h-14
  
            rounded-2xl
  
            bg-gradient-to-r
  
            from-violet-600
  
            to-indigo-600
  
            text-white
  
            font-semibold
  
            flex
  
            items-center
  
            justify-center
  
            gap-3
  
            shadow-lg
  
            hover:shadow-violet-400/40
  
            transition-all
  
          "
  
        >
  
          <Save size={20} />
  
          Save To My Plans
  
        </motion.button>
  
        {/* Share */}
  
        <motion.button
  
          whileHover={{
  
            scale: 1.03,
  
            y: -2,
  
          }}
  
          whileTap={{ scale: .96 }}
  
          onClick={onShare}
  
          className="
  
            h-14
  
            rounded-2xl
  
            bg-white
  
            border
  
            border-gray-200
  
            hover:border-blue-500
  
            hover:bg-blue-50
  
            font-semibold
  
            flex
  
            items-center
  
            justify-center
  
            gap-3
  
            transition-all
  
          "
  
        >
  
          <Share2 size={20} />
  
          Share
  
        </motion.button>
  
      </div>
  
    );
  
  }