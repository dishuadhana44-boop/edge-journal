import {
    Clock3,
    Smile,
    User,
    Dog,
    UtensilsCrossed,
    Car,
    Lightbulb,
    Heart,
    Flag,
  } from "lucide-react";
  
  const categories = [
    { id: "recent", icon: Clock3 },
    { id: "smileys", icon: Smile },
    { id: "people", icon: User },
    { id: "animals", icon: Dog },
    { id: "food", icon: UtensilsCrossed },
    { id: "travel", icon: Car },
    { id: "objects", icon: Lightbulb },
    { id: "symbols", icon: Heart },
    { id: "flags", icon: Flag },
  ];
  
  function BottomBar({
    activeCategory,
    onCategoryClick,
  }) {
    return (
      <div className="h-11 border-t border-gray-200 bg-white flex items-center justify-around">
  
        {categories.map(({ id, icon: Icon }) => (
  
          <button
            key={id}
            onClick={() => onCategoryClick(id)}
            className={`
                w-7
                h-7
                rounded-md
                flex
                items-center
                justify-center
                transition-all
                duration-150
                ${
                activeCategory===id
                ? "bg-gray-100 text-black scale-105"
                : "text-gray-500 hover:bg-gray-100 hover:text-black hover:scale-105"
                }
                `}
          >
            <Icon size={16} strokeWidth={2} />
          </button>
  
        ))}
  
      </div>
    );
  }
  
  export default BottomBar;