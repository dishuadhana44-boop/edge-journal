const KEY = "notion_recent_emojis";

const DEFAULT_RECENT = [
    "🔥",
    "🚀",
    "❤️",
    "⭐",
    "📚",
    "💻",
    "📝",
    "📁",
    "🎯",
    "✅",
  ];
  
  export function getRecentEmojis() {
    const saved = localStorage.getItem(KEY);
  
    if (!saved) {
      return DEFAULT_RECENT;
    }
  
    return JSON.parse(saved);
  }

export function addRecentEmoji(emoji) {

  let recent = getRecentEmojis();

  recent = recent.filter((e) => e !== emoji);

  recent.unshift(emoji);

  recent = recent.slice(0, 24);

  localStorage.setItem(KEY, JSON.stringify(recent));
}