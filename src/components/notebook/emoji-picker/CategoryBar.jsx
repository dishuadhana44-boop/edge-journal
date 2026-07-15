function CategoryBar({ onCategoryClick }) {
    const items = [
      { id: "recent", icon: "🕘" },
      { id: "smileys", icon: "😀" },
      { id: "people", icon: "👋" },
      { id: "animals", icon: "🐶" },
      { id: "food", icon: "🍔" },
      { id: "travel", icon: "🚗" },
      { id: "objects", icon: "💡" },
      { id: "symbols", icon: "❤️" },
    ];
  
    return (
      <div className="h-11 border-t border-gray-200 bg-white flex items-center justify-around">
  
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onCategoryClick(item.id)}
            className="
              w-8
              h-8
              rounded-lg
              hover:bg-gray-100
              transition
              text-lg
            "
          >
            {item.icon}
          </button>
        ))}
  
      </div>
    );
  }
  
  export default CategoryBar;