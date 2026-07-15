import MenuItem from "./MenuItem";

function MenuCategory({
  title,
  items,
  editor,
  onClose,
}) {
  return (
    <div className="mb-4">

      <div
        className="
          sticky
          top-0
          z-10
          bg-white
          px-3
          py-2
          text-[11px]
          font-semibold
          uppercase
          tracking-wider
          text-gray-400
        "
      >
        {title}
      </div>

      <div className="space-y-1 px-2">

        {items.map((item) => (
         <MenuItem
         key={item.title}
         {...item}
         editor={editor}
         onClose={onClose}
       />
        ))}

      </div>

    </div>
  );
}

export default MenuCategory;