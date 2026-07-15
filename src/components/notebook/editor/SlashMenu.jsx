import { useState } from "react";

import SearchBox from "./menus/SearchBox";
import MenuCategory from "./menus/MenuCategory";
import { slashItems } from "./data/slashItems";

function SlashMenu({ editor, onClose }) {
  const [search, setSearch] = useState("");

  const filtered = slashItems
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((category) => category.items.length);

  return (
    <div
      className="
        w-[300px]
        max-h-[400px]
        overflow-y-auto
        rounded-2xl
        border
        border-gray-200
        bg-white
        shadow-2xl
        text-[10px]
        tracking-[0.15em]
        font-bold
        text-gray-800
      "
    >
      <SearchBox
        value={search}
        onChange={setSearch}
      />

      <div className="py-2">

        {filtered.map((category) => (
          <MenuCategory
          key={category.category}
          title={category.category}
          items={category.items}
          editor={editor}
          onClose={onClose}
        />
        ))}

      </div>
    </div>
  );
}

export default SlashMenu;