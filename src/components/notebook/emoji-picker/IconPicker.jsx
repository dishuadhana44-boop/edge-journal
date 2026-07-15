import BottomBar from "./BottomBar";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import EmojiGrid from "./EmojiGrid";
import Header from "./Header";
import SearchBar from "./SearchBar";
import IconPanel from "../icon-picker/IconPanel";

function IconPicker({
  onClose,
  onEmojiSelect,
  onIconSelect,
  onEmojiRemove,
}) {
  const [activeTab, setActiveTab] = useState("emoji");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("recent");
  const emojiGridRef = useRef(null);


  return (
    <motion.div
    initial={{
      opacity: 0,
      scale: 0.98,
      y: -6,
    }}
    
    animate={{
      opacity: 1,
      scale: 1,
      y: 0,
    }}
    
    exit={{
      opacity: 0,
      scale: 0.98,
      y: -6,
    }}
    
    transition={{
      duration: 0.16,
      ease: "easeOut",
    }}
      className="
      w-[372px]
      h-[520px]
      bg-white
      rounded-2xl
      border
      border-gray-200
      shadow-2xl
      overflow-hidden
      flex
      flex-col
      "
    >
 <Header
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  onClose={onClose}
  onEmojiRemove={onEmojiRemove}
/>

      {/* Search only for Emoji & Icons */}
      {activeTab !== "upload" && (
        <SearchBar
          search={search}
          setSearch={setSearch}
        />
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden">

      {activeTab === "emoji" && (
        <EmojiGrid
    ref={emojiGridRef}
    search={search}
    onCategoryChange={setActiveCategory}
    onEmojiSelect={(emoji) => {
        onEmojiSelect(emoji);
        onClose();
    }}
/>
)}

{activeTab === "icons" && (
  <IconPanel
    onClose={onClose}
    onIconSelect={(Icon) => {
      onIconSelect(Icon);
    }}
  />
)}

        {activeTab === "upload" && (
          <div className="h-full flex items-center justify-center text-gray-400">
            Upload Coming Soon
          </div>
        )}

      </div>

      
{activeTab === "emoji" ? (
  <BottomBar
    activeCategory={activeCategory}
    onCategoryClick={(id) => {
      setActiveCategory(id);

      emojiGridRef.current?.scrollToCategory(id);
    }}
  />
) : (
  <div className="h-11 border-t border-gray-200 flex items-center px-4 bg-white">
    <button className="text-red-500 hover:text-red-600 text-sm font-medium">
      Remove Icon
    </button>
  </div>
)}
        
      

    </motion.div>
  );
}

export default IconPicker;