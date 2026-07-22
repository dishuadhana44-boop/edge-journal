import { motion } from "framer-motion";
import { useContext } from "react";
import EditorContext from "../core/EditorContext";
import { commandItems } from "../commands";



function MenuItem({
  icon: Icon,
  title,
  active,
  editor,
  onClose,
}) {

const { engine } = useContext(EditorContext);
 
 const handleClick = (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!editor || !engine) return;

  engine.selectionManager.save(editor);

  editor.commands.focus();
  
  engine.selectionManager.restore(editor);
  
  const executed = engine.execute(title);

  console.log("Executed:", title, executed);

  onClose?.();
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