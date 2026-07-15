const STORAGE_KEY = "notion-recent-icons";

export function getRecentIcons() {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addRecentIcon(iconName) {
  const current = getRecentIcons();

  const updated = [
    iconName,
    ...current.filter((name) => name !== iconName),
  ].slice(0, 20);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated)
  );
}