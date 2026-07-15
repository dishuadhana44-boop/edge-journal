import {
    forwardRef,
    useImperativeHandle,
    useRef,
    useEffect,
  } from "react";
  import { searchEmojis } from "./data/emojiSearch";
  import { categories } from "./data/emojiData";;
  import {
    addRecentEmoji,
    getRecentEmojis,
  } from "./data/emojiRecent";

  const EmojiGrid = forwardRef(({
    search,
    onEmojiSelect,
    onCategoryChange,
  }, ref) => {
  const query = search.toLowerCase();

  const containerRef = useRef(null);
const sectionRefs = useRef({});

useImperativeHandle(ref, () => ({
    scrollToCategory(id) {
      sectionRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
  }));
  useEffect(() => {
    const container = containerRef.current;
  
    if (!container) return;
  
    function handleScroll() {
      const scrollTop = container.scrollTop;
  
      let current = "recent";
  
      Object.entries(sectionRefs.current).forEach(([id, el]) => {
        if (!el) return;
  
        if (el.offsetTop - 80 <= scrollTop) {
          current = id;
        }
      });
  
      onCategoryChange?.(current);
    }
  
    container.addEventListener("scroll", handleScroll);
  
    return () =>
      container.removeEventListener("scroll", handleScroll);
  
  }, [onCategoryChange]);

  return (
    <div
  ref={containerRef}
  className="h-full overflow-y-auto px-4 pb-4"
>

{!search && (

<div className="mb-6">

  <h3 className="text-xs text-gray-500 mb-3">
    Recently Used
  </h3>

  <div className="grid grid-cols-8 gap-1">

    {getRecentEmojis().map((emoji) => (

      <button
        key={emoji}
        onClick={() => {
          addRecentEmoji(emoji);
          onEmojiSelect(emoji);
        }}
        className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-xl"
      >
        {emoji}
      </button>

    ))}

  </div>

</div>

)}

      {/* Categories */}

      {searchEmojis(categories, search).map((category) => {

      
        return (

            <div
            key={category.id}
            ref={(el) => (sectionRefs.current[category.id] = el)}
            className="mb-6"
          >

            <h3 className="text-xs text-gray-500 mb-3">
              {category.title}
            </h3>

            <div className="grid grid-cols-9 gap-1">

            {category.emojis.map((emoji) => (

                <button
                  key={emoji}
                  onClick={() => {
                    addRecentEmoji(emoji);
                    onEmojiSelect(emoji);
                  }}
                  className="
                  w-8
                  h-8
                  rounded-md
                  flex
                  items-center
                  justify-center
                  text-xl
                  transition-all
                  duration-150
                  hover:bg-gray-100
                  hover:scale-105
                  active:scale-95
                  "
                >
                  {emoji}
                </button>

              ))}

            </div>

          </div>

        );

      })}

    </div>
  );
});

export default EmojiGrid;