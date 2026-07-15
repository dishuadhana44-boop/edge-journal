import { useState } from "react";
import { motion } from "framer-motion";


import IconSearch from "./IconSearch";
import IconGrid from "./IconGrid";

function IconPanel({
  onClose,
  onIconSelect,
}) {

  const [search, setSearch] = useState("");

  return (

    <motion.div
    
      className="
      h-full
      flex
      flex-col
    "
    >

     

     

      <IconGrid
        search={search}
        onIconSelect={(Icon) => {
          onIconSelect(Icon);
          onClose();
        }}
      />

    </motion.div>

  );
}

export default IconPanel;