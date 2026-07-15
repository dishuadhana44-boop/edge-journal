const keywordMap = {
    "😀": ["happy", "smile", "grinning", "face"],
    "😂": ["laugh", "lol", "funny", "cry"],
    "😍": ["love", "heart", "eyes"],
    "❤️": ["heart", "love", "red"],
    "🔥": ["fire", "hot", "lit"],
    "🚀": ["rocket", "space", "launch"],
    "⭐": ["star", "favorite"],
    "📚": ["book", "study", "education"],
    "💻": ["computer", "laptop", "coding"],
    "📝": ["note", "write", "document"],
    "📁": ["folder", "file"],
    "🎯": ["target", "goal"],
    "✅": ["check", "done", "tick"],
  };
  
  export function searchEmojis(categories, query) {
    if (!query.trim()) return categories;
  
    const q = query.toLowerCase();
  
    return categories
      .map((category) => ({
        ...category,
        emojis: category.emojis.filter((emoji) => {
          const keywords = keywordMap[emoji] || [];
  
          return (
            emoji.includes(q) ||
            keywords.some((word) =>
              word.includes(q)
            )
          );
        }),
      }))
      .filter((category) => category.emojis.length > 0);
  }