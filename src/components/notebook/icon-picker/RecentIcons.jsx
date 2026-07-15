import { getRecentIcons, addRecentIcon } from "./iconRecent";
import { iconList } from "./iconData";
import IconButton from "./IconButton";
import IconCategory from "./IconCategory";

function RecentIcons({ onIconSelect }) {
  const recent = getRecentIcons();

  if (recent.length === 0) return null;

  const icons = recent
    .map((name) =>
      iconList.find((item) => item.name === name)
    )
    .filter(Boolean);

  return (
    <IconCategory title="Recent">
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
}

export default RecentIcons;