import RecentIcons from "./RecentIcons";
import { addRecentIcon } from "./iconRecent";
import { iconList } from "./iconData";
import IconButton from "./IconButton";
import IconCategory from "./IconCategory";
import { iconCategories } from "./iconCategories";

function IconGrid({
  search,
  onIconSelect,
}) {
  const query = search.toLowerCase();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">

<RecentIcons
  onIconSelect={(Icon) => {
    onIconSelect(Icon);
  }}
/>

      {iconCategories.map((category) => {

        const icons = iconList.filter(
          (item) =>
            item.category === category &&
            item.name.toLowerCase().includes(query)
        );

        if (icons.length === 0) return null;

        return (

          <IconCategory
            key={category}
            title={category}
          >

            {icons.map((item) => (

              <IconButton
                key={item.name}
                Icon={item.icon}
                onClick={() => {
                    addRecentIcon(item.name);
                    onIconSelect(item.icon);
                  }}
              />

            ))}

          </IconCategory>
        );

      })}

    </div>
  );
}

export default IconGrid;