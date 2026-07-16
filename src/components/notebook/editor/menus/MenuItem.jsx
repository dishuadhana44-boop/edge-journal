import { motion } from "framer-motion";
import { commandItems } from "../commands";

function MenuItem({
  icon: Icon,
  title,
  active,
  editor,
  onClose,
}) {

 
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  
    if (!editor) return;
  
    // Save current selection
    const { from, to } = editor.state.selection;
  
    // Focus editor before command
    editor.commands.focus();
  
    const command = commandItems.find(
      (item) => item.title === title
    );
  
    if (!command) return;
  
    const executed = command.command({
      editor,
      range: { from, to },
    });
  
    console.log("Executed:", title, executed);
  
    // Close menu AFTER command
    requestAnimationFrame(() => {
      onClose?.();
      editor.commands.focus();
    });
  };

    
  return (
    <motion.button
    onMouseDown={(e) => e.preventDefault()}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`
        w-full
        flex
        items-center
        gap-3
        px-3
        py-2
        rounded-lg
        transition-all
        duration-150
        ${
          active
            ? "bg-blue-50"
            : "hover:bg-gray-100"
        }
      `}
    >
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
        {Icon && <Icon size={18} />}
      </div>

      <span className="text-[14px] font-medium text-gray-800">
        {title}
      </span>
    </motion.button>
  );
}

export default MenuItem;