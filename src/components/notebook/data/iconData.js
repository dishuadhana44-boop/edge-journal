import * as TablerIcons from "@tabler/icons-react";

export const emojis = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😎",
  "🔥",
  "⭐",
  "❤️",
  "📚",
  "🚀",
  "💻",
  "📁",
  "📝",
];

export const icons = Object.values(TablerIcons).filter(
  (icon) => typeof icon === "function"
);